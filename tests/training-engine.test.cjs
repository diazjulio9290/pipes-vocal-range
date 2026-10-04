"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
// Isolate the standalone script from any parent workspace's package type.
const engineSource = fs.readFileSync(
  path.join(__dirname, "../training-engine.js"),
  "utf8",
);
const commonJs = { module: { exports: {} } };
vm.runInNewContext(engineSource, commonJs);
const engine = commonJs.module.exports;

function waveform(frequency, sampleRate = 48000, options = {}) {
  let seed = 1234567;
  return Float32Array.from({ length: options.length || 4096 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = ((seed / 4294967296) * 2 - 1) * (options.noise || 0);
    const phase = (2 * Math.PI * frequency * i) / sampleRate + 0.43;
    const harmonics = options.harmonics || [0.25];
    return harmonics.reduce(
      (value, amplitude, h) => value + amplitude * Math.sin(phase * (h + 1)),
      noise + (options.dc || 0),
    );
  });
}

function assertPitch(frequency, sampleRate, options, toleranceCents = 8) {
  const detection = engine.detectPitch(
    waveform(frequency, sampleRate, options),
    sampleRate,
  );
  assert.ok(detection, `Should detect ${frequency} Hz at ${sampleRate} Hz`);
  const cents = 1200 * Math.log2(detection.frequency / frequency);
  assert.ok(
    Math.abs(cents) < toleranceCents,
    `${frequency} Hz: error ${cents.toFixed(2)} cents`,
  );
  assert.ok(detection.confidence >= 0.85 && detection.confidence <= 1);
  assert.ok(detection.rms >= 0.006);
}

test("detects low, mid and high notes at common browser sample rates", () => {
  for (const sampleRate of [44100, 48000]) {
    for (const frequency of [65.406, 110, 196, 261.626, 440, 880, 1046.502]) {
      assertPitch(frequency, sampleRate);
    }
  }
});

test("tracks voice-like harmonics, missing fundamentals and moderate background noise", () => {
  assertPitch(146.832, 48000, {
    harmonics: [0.2, 0.34, 0.18, 0.08],
    noise: 0.025,
  });
  assertPitch(220, 44100, { harmonics: [0, 0.3, 0.24, 0.1] });
  assertPitch(196, 48000, { harmonics: [0.08, 0.4], noise: 0.005 });
  assertPitch(329.628, 48000, {
    harmonics: [0.18, 0.09],
    noise: 0.04,
    dc: 0.3,
  });
});

test("rejects silence, DC, too quiet input, nonperiodic noise and invalid data", () => {
  assert.equal(engine.detectPitch(new Float32Array(4096), 48000), null);
  assert.equal(
    engine.detectPitch(new Float32Array(4096).fill(0.4), 48000),
    null,
  );
  assert.equal(
    engine.detectPitch(waveform(220, 48000, { harmonics: [0.001] }), 48000),
    null,
  );
  for (const noise of [0.01, 0.2, 0.8]) {
    assert.equal(
      engine.detectPitch(waveform(0, 48000, { harmonics: [0], noise }), 48000),
      null,
    );
  }
  assert.equal(
    engine.detectPitch(new Float32Array(4096).fill(NaN), 48000),
    null,
  );
  assert.equal(engine.detectPitch(new Float32Array(32), 48000), null);
  assert.equal(engine.detectPitch(waveform(220), 0), null);
  assert.equal(engine.detectPitch(waveform(1600), 48000), null);
  assert.equal(engine.detectPitch(waveform(40), 48000), null);
});

test("exposes the same API in a browser without CommonJS", () => {
  const browser = {};
  vm.runInNewContext(engineSource, browser);
  assert.equal(typeof browser.PipesTraining.detectPitch, "function");
  assert.equal(browser.PipesTraining.midiToHz(69), 440);
});

test("converts notes without rounding and preserves full octave errors", () => {
  assert.equal(engine.midiToHz(69), 440);
  assert.equal(engine.hzToMidi(440), 69);
  assert.ok(Math.abs(engine.hzToMidi(engine.midiToHz(60.37)) - 60.37) < 1e-9);
  assert.ok(Number.isNaN(engine.hzToMidi(0)));
  assert.equal(engine.centsFromTarget(880, 69), 1200);
  assert.equal(engine.classifyPitch(880, 69).status, "octave-high");
  assert.equal(engine.classifyPitch(220, 69).status, "octave-low");
  assert.equal(engine.classifyPitch(880, 69).inTune, false);
  assert.equal(engine.classifyPitch(engine.midiToHz(69.4), 69).status, "sharp");
  assert.equal(engine.classifyPitch(engine.midiToHz(68.6), 69).status, "flat");
  assert.equal(
    engine.classifyPitch(engine.midiToHz(69.2), 69).status,
    "in-tune",
  );
  assert.equal(engine.classifyPitch(null, 69).status, "silent");
});

test("requires real continuous voiced duration and passes a stable hold", () => {
  const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 1000 });
  assert.equal(attempt.feed(440, 0).passed, false);
  for (let time = 40; time <= 960; time += 40) attempt.feed(440, time);
  assert.equal(attempt.summary().passed, false);
  const result = attempt.feed(440, 1000);
  assert.equal(result.passed, true);
  assert.equal(result.inTuneMs, 1000);
  assert.equal(result.voicedMs, 1000);
  assert.equal(result.longestHoldMs, 1000);
  assert.equal(result.accuracy, 100);
  assert.equal(result.progress, 1);
});

test("a confident detected tone earns the same duration as validated numeric input", () => {
  const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 400 });
  const detection = engine.detectPitch(waveform(440), 48000);
  for (let time = 0; time <= 400; time += 40) attempt.feed(detection, time);
  assert.equal(attempt.summary().passed, true);
  assert.equal(attempt.summary().voicedMs, 400);
});

test("silent frames, low confidence and low volume cannot earn a pass", () => {
  for (const rejected of [
    null,
    -1,
    { frequency: 440, confidence: 0.5, rms: 0.2 },
    { frequency: 440, confidence: 0.99, rms: 0.001 },
  ]) {
    const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 400 });
    for (let time = 0; time <= 1000; time += 40) attempt.feed(rejected, time);
    assert.equal(attempt.summary().passed, false);
    assert.equal(attempt.summary().inTuneMs, 0);
    assert.equal(attempt.summary().accuracy, 0);
  }
});

test("silence and a suspended tab interrupt a hold and are never credited", () => {
  const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 800 });
  for (let time = 0; time <= 400; time += 40) attempt.feed(440, time);
  attempt.feed(null, 440);
  attempt.feed(440, 480);
  for (let time = 520; time <= 880; time += 40) attempt.feed(440, time);
  assert.equal(attempt.summary().passed, false);
  assert.equal(attempt.summary().longestHoldMs, 400);
  assert.equal(attempt.summary().inTuneMs, 800);
  attempt.feed(440, 6000);
  assert.equal(attempt.summary().holdMs, 0);
  assert.equal(attempt.summary().inTuneMs, 800);
  assert.equal(attempt.summary().passed, false);
});

test("wrong-octave singing stays voiced but never receives in-tune credit", () => {
  const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 400 });
  for (let time = 0; time <= 1000; time += 40) attempt.feed(880, time);
  const result = attempt.summary();
  assert.equal(result.voicedMs, 1000);
  assert.equal(result.inTuneMs, 0);
  assert.equal(result.passed, false);
  assert.equal(result.meanAbsoluteCents, 1200);
  assert.equal(result.status, "octave-high");
});

test("alternating sharp and flat notes cannot pass merely because their average matches", () => {
  const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 400 });
  for (let time = 0; time <= 1000; time += 40) {
    attempt.feed(engine.midiToHz(69 + (time % 80 === 0 ? 0.8 : -0.8)), time);
  }
  assert.ok(Math.abs(attempt.summary().meanCents) < 1e-8);
  assert.equal(attempt.summary().inTuneMs, 0);
  assert.equal(attempt.summary().passed, false);
});

test("scores duration rather than counting frames, ignores stale timestamps and resets cleanly", () => {
  const attempt = engine.createAttempt({ targetMidi: 69, holdMs: 500 });
  [0, 20, 40, 60, 80, 100].forEach((time) => attempt.feed(440, time));
  [200, 300, 400, 500].forEach((time) =>
    attempt.feed(engine.midiToHz(70), time),
  );
  const result = attempt.summary();
  assert.equal(result.voicedMs, 500);
  assert.equal(result.inTuneMs, 100);
  assert.equal(result.accuracy, 20);
  assert.deepEqual(attempt.feed(440, 500), result);
  assert.deepEqual(attempt.feed(440, 490), result);
  attempt.reset();
  assert.equal(attempt.summary().elapsedMs, 0);
  assert.equal(attempt.summary().voicedMs, 0);
  assert.equal(attempt.summary().passed, false);
});
