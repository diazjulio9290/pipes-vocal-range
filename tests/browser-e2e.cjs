'use strict';
// Optional browser check: npm start, then run with Playwright installed or set
// PLAYWRIGHT_MODULE to its absolute module directory. No runtime dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { installSyntheticMicrophone, denyMicrophone } = require('./browser-fixtures.cjs');
const url = process.env.PIPES_URL || 'http://127.0.0.1:4173';
const screenshots = process.env.PIPES_SCREENSHOTS || path.resolve(__dirname, '../..');
const failures = [], consoleErrors = [];
const filter = process.env.PIPES_E2E_FILTER ? new RegExp(process.env.PIPES_E2E_FILTER) : null;
let checks = 0;
let verificationBrowser;

function observeGuideTones() {
  window.__playedTones = [];
  window.__audioRamps = [];
  const ramp = AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime = function (value, when) {
    window.__audioRamps.push({ value, when });
    return ramp.apply(this, arguments);
  };
  const original = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when) {
    if (!this.__syntheticMicrophone) window.__playedTones.push({ frequency: this.frequency.value, when, type: this.type });
    return original.apply(this, arguments);
  };
}
async function step(name, callback) {
  if (filter && !filter.test(name) && !name.startsWith('no JavaScript')) return;
  checks++;
  try { await callback(); console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

(async () => {
  const browser = verificationBrowser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  async function createPage(options = {}, init = installSyntheticMicrophone) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
    const page = await context.newPage();
    // Font downloads can be blocked in offline developer environments. Verify
    // the app's system-font fallback without waiting on a third-party server.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('pageerror', error => consoleErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com|ERR_CERT_AUTHORITY_INVALID/.test(message.text())) consoleErrors.push(message.text()); });
    if (init) await page.addInitScript(init);
    await page.addInitScript(observeGuideTones);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.lesson-card').first().waitFor();
    return page;
  }
  const page = await createPage();
  async function navigate(route) { await page.locator(`.sidebar [data-route="${route}"]`).click(); }
  async function store() { return page.evaluate(() => JSON.parse(localStorage.getItem('pipes-learning-v2'))); }
  async function waitPhase(text, timeout = 7000) { await page.waitForFunction(value => document.getElementById('phaseLabel')?.textContent === value, text, { timeout }); }
  async function setTarget(multiplier = 1) {
    await page.evaluate(multiplier => {
      const text = document.getElementById('targetNote').textContent;
      const name = text.slice(0, -1), octave = Number(text.slice(-1));
      const pitchClass = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'].indexOf(name);
      window.__testMic.setFrequency(440 * Math.pow(2, ((octave + 1) * 12 + pitchClass - 69) / 12) * multiplier);
    }, multiplier);
  }

  await step('desktop dashboard shows six lessons without overflow', async () => {
    assert.equal(await page.locator('.lesson-card').count(), 6);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(screenshots, 'pipes-desktop.png'), fullPage: true });
  });

  await step('ear scores five first answers; replay cannot score twice; progress persists', async () => {
    await page.locator('.lesson-card[data-lesson="direction"]').click();
    assert.equal(await page.locator('[data-answer]:disabled').count(), 3);
    await page.locator('#playPair').click();
    for (let question = 0; question < 5; question++) {
      await page.locator('[data-answer]:enabled').first().waitFor();
      const tones = await page.evaluate(() => window.__playedTones.slice(-4).map(tone => tone.frequency));
      const answer = Math.abs(tones[3] - tones[0]) < 0.1 ? 'same' : tones[3] > tones[0] ? 'higher' : 'lower';
      await page.locator(`[data-answer="${answer}"]`).click();
      assert.match(await page.locator('#earFeedback').textContent(), /You heard it/);
      if (question === 0) {
        await page.locator('#playPair').click();
        await page.waitForFunction(() => !document.getElementById('playPair').disabled);
        assert.equal(await page.locator('[data-answer]:disabled').count(), 3);
      }
      await page.locator('[data-action="next-question"]').click();
    }
    assert.match(await page.locator('#earInstruction').textContent(), /5 out of 5/);
    let saved = await store();
    assert.equal(saved.history.length, 1);
    assert.equal(saved.history[0].score, 100);
    assert.ok(saved.completions.direction);
    await page.reload();
    await navigate('progress');
    saved = await store();
    assert.equal(saved.history.length, 1);
    assert.ok(await page.locator('main').getByText('100%', { exact: true }).count());
  });

  await step('silence/noise/octave errors cannot pass; real synthetic microphone completes four targets', async () => {
    await navigate('practice');
    await page.evaluate(() => window.__testMic.setAmplitude(0));
    await page.locator('[data-action="start-sing"]').click();
    await waitPhase('Your turn');
    await page.waitForTimeout(1250);
    assert.equal(await page.locator('#phaseLabel').textContent(), 'Your turn');
    assert.equal(await page.locator('#holdProgress').evaluate(element => element.style.width), '0%');
    await page.evaluate(() => { window.__testMic.setAmplitude(0.3); window.__testMic.setNoise(true); });
    await page.waitForTimeout(1250);
    assert.equal(await page.locator('#phaseLabel').textContent(), 'Your turn');
    assert.equal(await page.locator('#holdProgress').evaluate(element => element.style.width), '0%');
    await setTarget(2);
    await page.evaluate(() => window.__testMic.setNoise(false));
    await page.waitForTimeout(1250);
    assert.match(await page.locator('#practiceFeedback').textContent(), /higher octave/);
    assert.equal(await page.locator('#phaseLabel').textContent(), 'Your turn');
    await setTarget();
    await waitPhase('Note matched');
    assert.equal(await page.evaluate(() => window.__testMic.activeTracks()), 0);
    await page.screenshot({ path: path.join(screenshots, 'pipes-pitch.png'), fullPage: true });
    for (let note = 1; note < 4; note++) {
      await page.locator('[data-action="next-note"]').click();
      await setTarget();
      await waitPhase('Note matched');
    }
    await page.locator('[data-action="next-note"]').click();
    assert.equal(await page.locator('#phaseLabel').textContent(), 'Goal reached');
    const saved = await store();
    assert.equal(saved.history.length, 2);
    assert.equal(saved.history[1].score, 100);
    assert.ok(saved.completions.match);
    assert.equal(await page.evaluate(() => window.__testMic.activeTracks()), 0);
  });

  await step('remaining singing lessons complete steady, steps and melody goals', async () => {
    await page.evaluate(() => { window.__testMic.setAmplitude(0.2); window.__testMic.setNoise(false); });
    for (const [lesson, count] of [['steady',3],['steps',5],['melody',7]]) {
      await navigate('learn');
      await page.locator(`.lesson-card[data-lesson="${lesson}"]`).click();
      await setTarget();
      await page.locator('[data-action="start-sing"]').click();
      for (let index = 0; index < count; index++) {
        await setTarget();
        await waitPhase('Note matched');
        await page.locator('[data-action="next-note"]').click();
      }
      assert.equal(await page.locator('#phaseLabel').textContent(), 'Goal reached');
      assert.ok((await store()).completions[lesson]);
      assert.equal((await store()).history.at(-1).score, 100);
      assert.equal(await page.evaluate(() => window.__testMic.activeTracks()), 0);
    }
  });

  await step('interval lesson distinguishes repeated notes, steps and skips', async () => {
    await navigate('learn');
    await page.locator('.lesson-card[data-lesson="intervals"]').click();
    await page.locator('#playPair').click();
    for (let question = 0; question < 5; question++) {
      await page.locator('[data-answer]:enabled').first().waitFor();
      const tones = await page.evaluate(() => window.__playedTones.slice(-4).map(tone => tone.frequency));
      const semitones = Math.abs(Math.round(12 * Math.log2(tones[3] / tones[0])));
      const answer = semitones === 0 ? 'same' : semitones <= 2 ? 'step' : 'skip';
      await page.locator(`[data-answer="${answer}"]`).click();
      assert.match(await page.locator('#earFeedback').textContent(), /You heard it/);
      await page.locator('[data-action="next-question"]').click();
    }
    assert.match(await page.locator('#earInstruction').textContent(), /5 out of 5/);
    assert.ok((await store()).completions.intervals);
  });

  await step('skip link keeps active singing intact and settings preview uses unsaved sound and volume', async () => {
    await navigate('practice');
    await page.evaluate(() => window.__testMic.setAmplitude(0));
    await page.locator('[data-action="start-sing"]').click();
    await waitPhase('Your turn');
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#phaseLabel').textContent(), 'Your turn');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    assert.equal(await page.evaluate(() => window.__testMic.activeTracks()), 1);
    await navigate('learn');
    await page.locator('.topbar [data-action="settings"]').click();
    await page.locator('#guideSound').selectOption('pure');
    await page.locator('#volume').fill('0.1');
    await page.evaluate(() => { window.__playedTones.length = 0; window.__audioRamps.length = 0; });
    await page.locator('[data-action="preview-setting"]').click();
    const tones = await page.evaluate(() => window.__playedTones);
    assert.equal(tones.length, 1);
    assert.equal(tones[0].type, 'sine');
    const positiveRamps = await page.evaluate(() => window.__audioRamps.filter(ramp => ramp.value > 0).map(ramp => ramp.value));
    assert.ok(positiveRamps.some(value => Math.abs(value - 0.04) < 1e-8), JSON.stringify(positiveRamps));
    await page.locator('[data-action="close-settings"]').click();
    assert.notEqual((await store())?.settings?.timbre, 'pure');
  });

  await step('navigation releases live microphone tracks', async () => {
    await navigate('practice');
    await page.evaluate(() => window.__testMic.setAmplitude(0));
    await page.locator('[data-action="start-sing"]').click();
    await waitPhase('Your turn');
    assert.equal(await page.evaluate(() => window.__testMic.activeTracks()), 1);
    await navigate('learn');
    assert.equal(await page.evaluate(() => window.__testMic.activeTracks()), 0);
  });

  await step('settings reject invalid ranges; adapted targets stay within limits', async () => {
    await page.locator('.topbar [data-action="settings"]').click();
    await page.locator('#lowNote').selectOption('60');
    await page.locator('#highNote').selectOption('58');
    await page.locator('#settingsForm [type="submit"]').click();
    assert.equal(await page.locator('#settingsError').isVisible(), true);
    assert.equal(await page.locator('#settingsDialog').isVisible(), true);
    await page.locator('#rootNote').selectOption('60');
    await page.locator('#lowNote').selectOption('60');
    await page.locator('#highNote').selectOption('61');
    await page.locator('#settingsForm [type="submit"]').click();
    await navigate('practice');
    await page.locator('[data-lesson="steps"]').click();
    const notes = await page.locator('.attempt-dot').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
    assert.ok(notes.every(text => /C[♯]?4$/.test(text)), JSON.stringify(notes));
    assert.match(await page.locator('.practice-main').textContent(), /Adapted practice/);
    await page.locator('[data-action="higher"]').click();
    assert.equal(await page.locator('#targetNote').textContent(), 'C4');
    await page.reload();
    assert.equal((await store()).settings.high, 61);
  });

  await step('denied microphone gives recovery controls', async () => {
    const denied = await createPage({}, denyMicrophone);
    await denied.locator('.sidebar [data-route="practice"]').click();
    await denied.locator('[data-action="start-sing"]').click();
    await denied.waitForFunction(() => document.getElementById('practiceFeedback').textContent.includes('declined'));
    assert.match(await denied.locator('#micStatus').textContent(), /off/);
    assert.equal(await denied.locator('[data-action="start-sing"]').textContent(), 'Try microphone again');
    await denied.context().close();
  });

  await step('cancel during pending permission stops a late microphone stream', async () => {
    const delayed = await createPage();
    await delayed.evaluate(() => {
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => new Promise(resolve => { window.__resolveMicrophone = async () => resolve(await acquire()); }) });
    });
    await delayed.locator('.sidebar [data-route="practice"]').click();
    await delayed.locator('[data-action="start-sing"]').click();
    await delayed.waitForFunction(() => typeof window.__resolveMicrophone === 'function');
    await delayed.locator('[data-action="stop-sing"]').click();
    await delayed.evaluate(() => window.__resolveMicrophone());
    await delayed.waitForFunction(() => window.__testMic.activeTracks() === 0);
    assert.equal(await delayed.locator('#phaseLabel').textContent(), 'Ready when you are');
    await delayed.context().close();
  });

  await step('tolerance band reflects selected pitch accuracy', async () => {
    await navigate('practice');
    assert.equal(await page.locator('.target-band').evaluate(element => element.style.height), '21.875%');
    await page.locator('.topbar [data-action="settings"]').click();
    await page.locator('#tolerance').selectOption('25');
    await page.locator('#settingsForm [type="submit"]').click();
    assert.equal(await page.locator('.target-band').evaluate(element => element.style.height), '15.625%');
  });

  await step('mobile screens fit 320px and 390px viewports', async () => {
    for (const width of [320,390]) {
      const mobile = await createPage({ viewport: { width, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
      await mobile.screenshot({ path: path.join(screenshots, `pipes-mobile-${width}.png`), fullPage: true });
      if (width === 390) await mobile.screenshot({ path: path.join(screenshots, 'pipes-mobile.png'), fullPage: true });
      for (const route of ['learn','practice','ear','progress']) {
        await mobile.locator(`.sidebar [data-route="${route}"]`).click();
        assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflows at ${width}px`);
      }
      await mobile.context().close();
    }
  });

  await step('no JavaScript runtime or application resource errors', async () => assert.deepEqual(consoleErrors, []));
  await browser.close();
  console.log(JSON.stringify({ passed: checks - failures.length, failures, consoleErrors }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(async error => { console.error(error); if (verificationBrowser) await verificationBrowser.close(); process.exitCode = 1; });
