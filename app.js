/* Local-first singing practice. No audio is recorded, stored, or uploaded. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    E = window.PipesTraining,
    KEY = "pipes-learning-v2";
  const defaults = {
    root: 57,
    low: 48,
    high: 72,
    tolerance: 35,
    volume: 0.55,
    timbre: "warm",
  };
  const lessons = [
    {
      id: "direction",
      number: "01",
      title: "First, learn to listen",
      subtitle: "Hear the difference between higher, lower, and the same.",
      type: "LISTEN",
      time: "2–3 min",
      kind: "ear",
      mode: "direction",
      goal: "Recognize 4 out of 5 pairs on the first try.",
      cue: "Listen to the first note, then notice where the second one goes.",
    },
    {
      id: "match",
      number: "02",
      title: "Find your first note",
      subtitle: "Connect a sound in your ear to a sound in your voice.",
      type: "SING",
      time: "2–4 min",
      pattern: [0, 0, 2, 0],
      hold: 800,
      goal: "Match 3 of 4 notes for 0.8 seconds each.",
      cue: "Listen. Imagine the note. Then hum gently or sing “oo”.",
    },
    {
      id: "steady",
      number: "03",
      title: "Make it a steady note",
      subtitle: "Give one comfortable pitch a little room to settle.",
      type: "SING",
      time: "2–4 min",
      pattern: [0, 2, 0],
      hold: 1500,
      goal: "Hold all 3 targets for 1.5 seconds each.",
      cue: "Keep the sound easy and even. Take a fresh breath between notes.",
    },
    {
      id: "steps",
      number: "04",
      title: "One small step at a time",
      subtitle: "Sing do–re–mi, then find your way back home.",
      type: "SING",
      time: "3–5 min",
      pattern: [0, 2, 4, 2, 0],
      hold: 800,
      goal: "Match 4 of 5 notes in this guided pattern.",
      cue: "Hear the small distance between notes. Move gently, without getting louder.",
    },
    {
      id: "intervals",
      number: "05",
      title: "Give your ears a little stretch",
      subtitle: "Recognize the feeling of a step and a skip.",
      type: "LISTEN",
      time: "2–3 min",
      kind: "ear",
      mode: "intervals",
      goal: "Recognize 4 out of 5 pairs on the first try.",
      cue: "A step is 1–2 piano-key distances; a skip is 3 or more. Count black keys too.",
    },
    {
      id: "melody",
      number: "06",
      title: "Turn notes into a melody",
      subtitle: "Bring it together in a little musical conversation.",
      type: "SING",
      time: "3–5 min",
      pattern: [0, 2, 4, 0, 4, 2, 0],
      hold: 700,
      goal: "Match at least 6 of 7 notes. Then repeat without watching the guide.",
      cue: "Listen to the whole phrase first. We’ll echo it one note at a time.",
    },
  ];
  const paths = {
    path: '<path d="M6 4h12M6 20h12M6 4c0 8 12 8 12 16M18 4c0 8-12 8-12 16"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/>',
    ear: '<path d="M7 9a5 5 0 0 1 10 0c0 4-5 4-5 7s-5 4-5 0M10 9a2 2 0 0 1 4 0c0 2-2 2-2 4"/>',
    chart: '<path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/>',
    sliders:
      '<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
    shield: '<path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6zM8 12l3 3 5-6"/>',
    piano:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v9h3V4m3 0v9h3V4M9 13v7m6-7v7"/>',
    play: '<path d="m9 5 10 7-10 7z"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    spark:
      '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    headphones:
      '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  };
  const icon = (name) =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
  const noteName = (m) =>
    ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][
      ((Math.round(m) % 12) + 12) % 12
    ] +
    (Math.floor(Math.round(m) / 12) - 1);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const dateKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let store = { settings: { ...defaults }, completions: {}, history: [] },
    storageWorks = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === "object") {
      const s = saved.settings || {};
      store.settings = {
        root: clamp(Number(s.root) || 57, 36, 84),
        low: clamp(Number(s.low) || 48, 36, 84),
        high: clamp(Number(s.high) || 72, 36, 84),
        tolerance: [25, 35, 45].includes(Number(s.tolerance))
          ? Number(s.tolerance)
          : 35,
        volume: clamp(Number(s.volume) || 0.55, 0.1, 0.9),
        timbre: s.timbre === "pure" ? "pure" : "warm",
      };
      if (store.settings.low > store.settings.high)
        store.settings = { ...defaults };
      store.settings.root = clamp(
        store.settings.root,
        store.settings.low,
        store.settings.high,
      );
      store.completions =
        saved.completions && typeof saved.completions === "object"
          ? saved.completions
          : {};
      store.history = Array.isArray(saved.history)
        ? saved.history
            .filter(
              (h) =>
                h &&
                lessons.some((l) => l.id === h.lesson) &&
                Number.isFinite(h.score) &&
                Number.isFinite(h.seconds) &&
                Number.isFinite(new Date(h.date).getTime()),
            )
            .slice(-200)
        : [];
    }
  } catch (_) {
    storageWorks = false;
  }
  let route = "learn",
    currentLesson = lessons[1],
    session = null,
    quiz = null;
  let audio = null,
    output = null,
    voices = [],
    stream = null,
    analyser = null,
    input = null,
    frame = 0,
    run = 0,
    micPending = false;
  let toastTimer,
    lastFeedback = "",
    trace = [],
    lastRender = 0;
  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
      return true;
    } catch (_) {
      storageWorks = false;
      toast(
        "Progress lasts for this visit only. Browser storage is unavailable.",
      );
      return false;
    }
  }
  function streak() {
    const days = new Set(store.history.map((h) => dateKey(new Date(h.date))));
    let n = 0,
      d = new Date();
    if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dateKey(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function updateChrome() {
    document
      .querySelectorAll("[data-icon]")
      .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
    document.querySelectorAll("[data-route]").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === route);
      if (el.dataset.route === route) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    $("routeLabel").textContent = {
      learn: "My learning path",
      practice: "Pitch studio",
      ear: "Ear training",
      progress: "My progress",
    }[route];
    $("streakLabel").innerHTML =
      `${icon("spark")} ${streak() ? `${streak()} day streak` : "A fresh start"}`;
  }
  function cleanup() {
    run++;
    micPending = false;
    stopAudio();
    releaseMic();
  }
  function navigate(next, focus = false) {
    cleanup();
    session = null;
    quiz = null;
    route = ["learn", "practice", "ear", "progress"].includes(next)
      ? next
      : "learn";
    if (location.hash !== `#${route}`)
      history.replaceState(null, "", `#${route}`);
    render();
    if (focus) {
      $("main").focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function render() {
    updateChrome();
    ({
      learn: renderLearn,
      practice: renderPractice,
      ear: renderEar,
      progress: renderProgress,
    })[route]();
  }
  function weekHTML() {
    const practiced = new Set(
        store.history.map((h) => dateKey(new Date(h.date))),
      ),
      day = new Date(),
      monday = new Date(day);
    monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return ["M", "T", "W", "T", "F", "S", "S"]
      .map((label, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return `<div class="day ${practiced.has(dateKey(d)) ? "done" : ""} ${dateKey(d) === dateKey(day) ? "today" : ""}" title="${d.toLocaleDateString()}: ${practiced.has(dateKey(d)) ? "practiced" : "no practice yet"}"><span>${label}</span><span>${practiced.has(dateKey(d)) ? "✓" : d.getDate()}</span></div>`;
      })
      .join("");
  }
  function renderLearn() {
    const next = lessons.find((l) => !store.completions[l.id]) || lessons[5],
      completed = lessons.filter((l) => store.completions[l.id]).length,
      minutes = Math.round(
        store.history.reduce((sum, h) => sum + h.seconds, 0) / 60,
      );
    $("main").innerHTML =
      `<div class="page-heading"><div><span class="eyebrow">A LITTLE PRACTICE. A LOT OF POSSIBILITY.</span><h1>Find your voice.</h1><p>You don’t need to be a natural. You just need a place to begin.</p></div><span class="badge sage">${icon("spark")} Beginner foundations</span></div>
    <div class="dashboard-grid"><div class="main-column"><section class="hero"><div class="hero-copy"><span class="eyebrow">YOUR NEXT SMALL STEP · LESSON ${next.number}</span><h1>${next.id === "direction" ? "Good singing<br>starts with listening." : next.title + "."}</h1><p>${next.id === "direction" ? "Train your ear, get to know your voice, and build the confidence to sing in tune. One note at a time." : next.subtitle}</p><div class="hero-actions"><button class="button primary" data-lesson="${next.id}">${completed ? "Continue learning" : "Let’s begin"} ${icon("arrow")}</button><span class="hero-meta">${icon("clock")} ${next.time} · ${next.kind === "ear" ? "No mic needed" : "Guided practice"}</span></div></div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 270 250"><defs><linearGradient id="wave"><stop stop-color="#e8a182"/><stop offset="1" stop-color="#b7b0e2"/></linearGradient></defs><circle cx="140" cy="122" r="99" fill="none" stroke="#fff" stroke-opacity=".07"/><circle cx="140" cy="122" r="72" fill="none" stroke="#fff" stroke-opacity=".10"/><circle cx="140" cy="122" r="42" fill="none" stroke="#fff" stroke-opacity=".14"/><path d="M14 125h20l10-17 12 38 12-77 12 112 13-93 12 66 13-126 13 173 12-131 13 101 12-59 12 26 11-13h35" fill="none" stroke="url(#wave)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="213" cy="50" r="17" fill="#e87751"/><path d="M209 57V44l10-2v11m-10 4c-5 2-7-3-2-4m12 0c-5 2-7-3-2-4" fill="none" stroke="#25292b" stroke-width="1.8"/></svg><span>listen · feel · sing</span></div></section>
    <div class="metric-grid"><div class="metric"><span class="metric-icon lavender">${icon("path")}</span><div><span class="metric-value">${completed}<small> / 6</small></span><span class="metric-label">Lesson goals reached</span></div></div><div class="metric"><span class="metric-icon sage">${icon("clock")}</span><div><span class="metric-value">${minutes}<small> min</small></span><span class="metric-label">Time well spent</span></div></div><div class="metric"><span class="metric-icon orange">${icon("mic")}</span><div><span class="metric-value">${store.history.length}</span><span class="metric-label">Practice sessions</span></div></div></div>
    <section><div class="section-heading"><div><span class="eyebrow">THE FOUNDATIONS</span><h2>Your path to singing in tune</h2></div><span class="muted">6 small steps</span></div><div class="lesson-list">${lessons.map((l) => `<button class="lesson-card ${l.id === next.id ? "recommended" : ""}" data-lesson="${l.id}"><span class="lesson-number ${store.completions[l.id] ? "complete" : ""}">${store.completions[l.id] ? icon("check") : l.number}</span><span class="lesson-info"><h3>${l.title}</h3><p>${l.subtitle}</p><span class="lesson-mobile-meta">${l.time} · ${l.type}</span></span><span class="lesson-type">${icon(l.kind === "ear" ? "ear" : "mic")} ${l.type}<small>${l.time}</small></span><span class="lesson-status">${store.completions[l.id] ? "Complete" : l.id === next.id ? "Up next" : ""}</span><span class="lesson-arrow">${icon("arrow")}</span></button>`).join("")}</div><p class="muted path-footnote">Follow the path or explore. Every lesson is open, and repetition is part of learning.</p></section></div>
    <aside class="side-column"><section class="daily-card"><div class="daily-icon">${icon("spark")}</div><span class="eyebrow">YOUR DAILY RITUAL</span><h2>A moment for<br>your voice.</h2><p>Keep it simple. Keep it comfortable.</p><ol class="daily-steps"><li><span>01</span><div><b>Settle in</b><small>Relax your jaw. Take an easy breath.</small></div></li><li><span>02</span><div><b>Listen closely</b><small>Hear a note before you sing it.</small></div></li><li><span>03</span><div><b>Try a little practice</b><small>One lesson is a lovely start.</small></div></li></ol><div class="daily-foot">Progress comes from showing up.</div></section><section class="coach-card"><div class="coach-orb">♪</div><span class="eyebrow">A NOTE FROM YOUR COACH</span><h3>Curiosity over perfection.</h3><p>Start with a soft hum. If a note feels too high or low, move it. Your practice should fit your voice.</p><button class="button ghost small" data-action="settings">Find a comfortable note ${icon("arrow")}</button></section><section class="card week-card"><div class="section-heading"><h3>This week</h3><span class="muted">Your rhythm</span></div><div class="week-row">${weekHTML()}</div><small class="muted">A rest day belongs in the rhythm, too.</small></section></aside></div>`;
  }
  function getTargets(lesson) {
    const { low, high, root } = store.settings,
      source = lesson.pattern || [0],
      span = Math.max(...source),
      available = high - low,
      offsets = source.map((n) => Math.min(n, available)),
      base = clamp(root, low, high - Math.min(span, available));
    return {
      notes: offsets.map((n) => base + n),
      adapted: available < span,
      base,
    };
  }
  function renderPractice() {
    const l = currentLesson.kind === "ear" ? lessons[1] : currentLesson;
    currentLesson = l;
    const targets = getTargets(l);
    $("main").innerHTML =
      `<div class="page-heading"><div><span class="eyebrow">LISTEN. IMAGINE. SING.</span><h1>Your pitch studio.</h1><p>A quiet place to bring your voice and your ear together.</p></div><button class="button secondary small" data-action="settings">${icon("sliders")} Adjust my notes</button></div><div class="practice-layout"><section class="practice-main card"><div class="session-top"><div><span class="eyebrow">LESSON ${l.number} · ${l.title}</span><h2 id="practiceTitle">Let’s find a comfortable note.</h2></div><span class="phase-pill" id="phaseLabel">Ready when you are</span></div><div class="attempt-dots" id="attemptDots">${targets.notes.map((n, i) => `<span class="attempt-dot ${i === 0 ? "current" : ""}" aria-label="Note ${i + 1}: ${noteName(n)}">${i + 1}</span>`).join("")}</div>
    <div class="practice-readout"><div class="target-note"><span class="eyebrow">YOUR TARGET</span><strong id="targetNote">${noteName(targets.notes[0])}</strong><span class="muted" id="targetFrequency">${Math.round(E.midiToHz(targets.notes[0]))} Hz</span></div><div class="detected-note"><span class="eyebrow">YOUR VOICE</span><strong id="heardNote">—</strong><span class="muted" id="pitchCents">Waiting for you</span></div></div>
    <div class="pitch-stage"><div class="pitch-grid"></div><div class="target-band"><span>your target</span></div><svg class="pitch-chart" id="pitchChart" viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Live pitch trace. The middle line is the target note."><path id="pitchPath" d="" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><div class="chart-placeholder" id="traceHint">Your voice will draw a line here.</div></div><div class="tuner-scale"><div class="tuner-center"></div><span class="tuner-needle" id="tunerNeedle"></span></div><div class="tuner-labels"><span>A little low</span><span>On target</span><span>A little high</span></div><div class="hold-row"><span id="holdLabel">Hold comfortably for ${(l.hold / 1000).toFixed(1)} seconds</span><div class="progress-track"><span id="holdProgress" style="width:0%"></span></div></div><div class="feedback-box" id="practiceFeedback" role="status">${l.cue}</div><div class="mic-status"><span class="mic-meter"><span id="micLevel"></span></span><span id="micStatus">Microphone off · enabled only when you start</span></div><div class="practice-controls" id="practiceControls"><button class="button secondary" data-action="preview">${icon("play")} Hear ${l.pattern.length > 4 ? "the pattern" : "my note"}</button><button class="button primary" data-action="start-sing">${icon("mic")} Listen &amp; sing</button></div><div class="note-stepper" id="noteStepper"><button class="icon-btn" data-action="lower" aria-label="Lower starting note">−</button><span>Starting note <b>${noteName(targets.base)}</b></span><button class="icon-btn" data-action="higher" aria-label="Higher starting note">+</button></div>${targets.adapted ? '<p class="feedback-box warning">This pattern uses fewer distinct notes to fit your practice limits. Widen the limits only if comfortable. Adapted practice is saved without completing the original lesson goal.</p>' : ""}</section>
    <aside class="practice-sidebar"><section class="coach-card"><span class="eyebrow">THE IDEA</span><h2>Hear it first.<br>Then make it yours.</h2><p>${l.cue}</p><ol class="coaching-steps"><li>Listen while the guide plays.</li><li>Let the sound settle in your ear.</li><li>Sing after “Your turn” appears.</li></ol><div class="tip-card">${icon("headphones")} Headphones help the microphone hear only you.</div></section><section class="card"><span class="eyebrow">A SMALL, CLEAR GOAL</span><h3>${l.goal}</h3><p class="muted">We look for a steady note within ±${store.settings.tolerance} cents of the target. This is practice feedback, not a label for your voice.</p></section><div class="section-heading"><h3>Choose your focus</h3></div><div class="exercise-grid">${lessons
      .filter((x) => !x.kind)
      .map(
        (x) =>
          `<button class="exercise-card ${x.id === l.id ? "active" : ""}" data-lesson="${x.id}"><span>${x.number}</span><b>${x.title}</b>${icon(x.id === l.id ? "check" : "arrow")}</button>`,
      )
      .join(
        "",
      )}</div><p class="muted">Keep it comfortable. Rest if your voice feels tired or strained.</p></aside></div>`;
    // The green regions use the same tolerance as scoring and trace coordinates.
    const tolerance = store.settings.tolerance;
    document.querySelector(".target-band").style.height =
      `${(tolerance / 160) * 100}%`;
    document.querySelector(".tuner-scale").style.background =
      `linear-gradient(90deg, #f2e4d9 0 ${50 - tolerance / 2}%, #d8e2c8 ${50 - tolerance / 2}% ${50 + tolerance / 2}%, #f2e4d9 ${50 + tolerance / 2}%)`;
  }
  function renderEar() {
    const l = currentLesson.kind === "ear" ? currentLesson : lessons[0];
    currentLesson = l;
    const mode = l.mode;
    $("main").innerHTML =
      `<div class="page-heading"><div><span class="eyebrow">A GOOD EAR CAN BE PRACTICED.</span><h1>Listen a little closer.</h1><p>Simple musical puzzles. No microphone, no pressure.</p></div><span class="badge lavender">${icon("headphones")} Headphones welcome</span></div><div class="practice-layout"><section class="ear-card card"><div class="session-top"><div><span class="eyebrow">LESSON ${l.number} · EAR TRAINING</span><h2>${mode === "direction" ? "Where does the second note go?" : "Is it a step or a skip?"}</h2></div><span class="phase-pill" id="quizCounter">5 listening moments</span></div><div class="quiz-progress" id="quizDots">${Array.from({ length: 5 }, () => "<span></span>").join("")}</div><div class="ear-orbit" aria-hidden="true"><div class="sound-bars">${[18, 32, 53, 76, 48, 85, 60, 35, 20].map((h) => `<span style="height:${h}px"></span>`).join("")}</div></div><p class="ear-instruction" id="earInstruction">${l.cue}</p><div class="practice-controls"><button class="button primary" data-action="play-pair" id="playPair">${icon("play")} Play two notes</button></div><div class="answer-grid" id="answerButtons">${(mode ===
      "direction"
        ? [
            ["lower", "↘", "Lower"],
            ["same", "→", "The same"],
            ["higher", "↗", "Higher"],
          ]
        : [
            ["same", "→", "The same"],
            ["step", "↗", "A step"],
            ["skip", "⤴", "A skip"],
          ]
      )
        .map(
          ([key, arrow, label]) =>
            `<button class="answer-btn" data-answer="${key}" disabled><span>${arrow}</span><b>${label}</b></button>`,
        )
        .join(
          "",
        )}</div><div class="feedback-box" id="earFeedback" role="status">Listen to both notes before you choose. Replay as often as you like.</div><div class="practice-controls" id="earNext"></div></section><aside class="practice-sidebar"><section class="coach-card"><span class="eyebrow">LISTEN FOR THE RELATIONSHIP</span><h2>${mode === "direction" ? "Two notes.<br>One tiny discovery." : "Small steps.<br>Bigger spaces."}</h2><p>${mode === "direction" ? "You don’t need to name the notes. Notice whether the second sound moves up, down, or stays in the same place." : "We begin with repeated notes, steps of 1–2 semitones, and skips of 3–7. Both directions count."}</p><p>Imagine tracing the sound with your hand as you listen.</p></section><section class="card"><span class="eyebrow">YOUR GOAL</span><h3>4 out of 5 on the first try.</h3><p class="muted">Replaying is part of practice. Each question gets one scored answer; feedback helps you learn the rest.</p></section><div class="exercise-grid"><button class="exercise-card ${mode === "direction" ? "active" : ""}" data-lesson="direction">${icon("ear")}<b>Higher, lower, or same</b></button><button class="exercise-card ${mode === "intervals" ? "active" : ""}" data-lesson="intervals">${icon("ear")}<b>Steps and skips</b></button></div></aside></div>`;
  }
  function renderProgress() {
    const completed = lessons.filter((l) => store.completions[l.id]).length,
      hs = store.history,
      singing = hs.filter((h) => h.kind === "sing"),
      ear = hs.filter((h) => h.kind === "ear");
    const avg = (list) =>
      list.length
        ? `${Math.round(list.reduce((s, h) => s + h.score, 0) / list.length)}%`
        : "—";
    $("main").innerHTML =
      `<div class="page-heading"><div><span class="eyebrow">YOU’RE BUILDING SOMETHING.</span><h1>Small wins add up.</h1><p>Your practice story, saved on this browser.</p></div><button class="button secondary small" data-action="export" ${hs.length ? "" : "disabled"}>Export my progress</button></div>${!storageWorks ? '<p class="feedback-box warning">Browser storage is unavailable. Progress lasts only for this visit. Use Export to keep a copy.</p>' : ""}<div class="stats-grid"><div class="stat-card"><span class="eyebrow">FOUNDATIONS</span><strong>${completed}<small> / 6</small></strong><p>Lesson goals reached</p></div><div class="stat-card"><span class="eyebrow">PITCH MATCHING</span><strong>${avg(singing)}</strong><p>Average targets matched</p></div><div class="stat-card"><span class="eyebrow">MUSICAL EAR</span><strong>${avg(ear)}</strong><p>Average first answers correct</p></div><div class="stat-card"><span class="eyebrow">SHOWING UP</span><strong>${streak()}<small> days</small></strong><p>Current practice streak</p></div></div>
    <div class="dashboard-grid"><div class="main-column"><section class="chart-card card"><div class="section-heading"><div><span class="eyebrow">ONE SESSION AT A TIME</span><h2>Your recent practice</h2></div><span class="muted">Last 10 sessions</span></div>${
      hs.length
        ? `<div class="session-chart">${hs
            .slice(-10)
            .map(
              (h) =>
                `<div class="session-bar-wrap" title="${lessons.find((l) => l.id === h.lesson).title}: ${h.score}%"><span>${h.score}%</span><div class="session-bar ${h.kind === "ear" ? "ear" : ""}" style="height:${Math.max(3, h.score * 1.5)}px"></div><small>${new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div>`,
            )
            .join(
              "",
            )}</div><p class="muted chart-legend"><span>● Singing targets</span><span>● Ear training answers</span></p>`
        : `<div class="empty-state">${icon("chart")}<h3>A blank page is a good beginning.</h3><p>Finish your first session and your practice will appear here.</p><button class="button primary" data-lesson="direction">Start your first lesson ${icon("arrow")}</button></div>`
    }</section><section><div class="section-heading"><h2>Practice journal</h2><span class="muted">${hs.length} sessions</span></div><div class="history-list">${
      hs.length
        ? hs
            .slice(-15)
            .reverse()
            .map(
              (h) =>
                `<div class="history-row"><span class="metric-icon ${h.kind === "ear" ? "lavender" : "sage"}">${icon(h.kind === "ear" ? "ear" : "mic")}</span><div><h3>${lessons.find((l) => l.id === h.lesson).title}</h3><p>${new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${Math.max(1, Math.round(h.seconds / 60))} min · ${h.kind === "ear" ? "Listening" : "Singing"}</p></div><span class="badge ${h.passed ? "sage" : "lavender"}">${h.passed ? "Goal reached" : "Practiced"}</span><b>${h.score}%</b></div>`,
            )
            .join("")
        : '<p class="muted">Your first small win is waiting.</p>'
    }</div></section></div><aside class="side-column"><section class="card curriculum-progress"><span class="eyebrow">YOUR FOUNDATIONS</span><h2>${completed} steps forward.</h2><div class="progress-track"><span style="width:${(completed / 6) * 100}%"></span></div>${lessons.map((l) => `<div class="foundation-row"><span>${store.completions[l.id] ? "✓" : l.number}</span><span>${l.title}</span></div>`).join("")}</section><section class="coach-card"><h3>Progress isn’t a straight line.</h3><p>Different notes and different days feel different. These scores describe the practice, not your potential.</p><div class="week-row">${weekHTML()}</div></section></aside></div>`;
  }
  async function getAudio() {
    if (!audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio)
        throw new Error(
          "This browser does not support audio. Try Chrome, Edge, Firefox, or Safari.",
        );
      audio = new Audio();
      const compressor = audio.createDynamicsCompressor();
      output = audio.createGain();
      output.gain.value = 0.4;
      output.connect(compressor);
      compressor.connect(audio.destination);
    }
    if (audio.state === "suspended") await audio.resume();
    return audio;
  }
  function stopAudio() {
    voices.forEach((v) => {
      try {
        v.stop();
      } catch (_) {}
    });
    voices = [];
  }
  function tone(midi, when, seconds = 0.8, sound = store.settings) {
    const envelope = audio.createGain();
    envelope.connect(output);
    const vol = sound.volume * 0.4;
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(vol, when + 0.035);
    envelope.gain.setValueAtTime(
      vol * 0.75,
      when + Math.max(0.04, seconds - 0.12),
    );
    envelope.gain.linearRampToValueAtTime(0, when + seconds);
    const parts =
      sound.timbre === "pure"
        ? [["sine", 1]]
        : [
            ["sine", 1],
            ["triangle", 0.22],
          ];
    let remaining = parts.length;
    parts.forEach(([type, level]) => {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type;
      o.frequency.value = E.midiToHz(midi);
      g.gain.value = level;
      o.connect(g);
      g.connect(envelope);
      o.start(when);
      o.stop(when + seconds + 0.03);
      voices.push(o);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        voices = voices.filter((x) => x !== o);
        if (--remaining === 0) envelope.disconnect();
      };
    });
  }
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function preview(notes, sound = store.settings) {
    const token = ++run;
    stopAudio();
    try {
      await getAudio();
      if (token !== run) return;
      const start = audio.currentTime + 0.05;
      notes.forEach((n, i) => tone(n, start + i * 0.72, 0.58, sound));
    } catch (e) {
      toast(e.message);
    }
  }
  function releaseMic() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (input) {
      try {
        input.disconnect();
      } catch (_) {}
    }
    input = null;
    analyser = null;
  }
  async function getMic(token) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Microphone practice needs HTTPS or localhost. Ear training still works without a microphone.",
      );
    if (stream && stream.getAudioTracks().some((t) => t.readyState === "live"))
      return true;
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    if (token !== run) {
      acquired.getTracks().forEach((t) => t.stop());
      return false;
    }
    stream = acquired;
    analyser = audio.createAnalyser();
    analyser.fftSize = 4096;
    input = audio.createMediaStreamSource(stream);
    input.connect(analyser);
    stream.getAudioTracks().forEach((t) =>
      t.addEventListener("ended", () => {
        if (session?.phase === "singing")
          finishAttempt(
            false,
            "The microphone disconnected. Check your input and try again.",
          );
      }),
    );
    return true;
  }
  function microphoneError(err) {
    if (["NotAllowedError", "PermissionDeniedError"].includes(err.name))
      return "Microphone access was declined. Allow it in your browser’s site settings, then try again. Ear training works without a mic.";
    if (err.name === "NotFoundError")
      return "No microphone was found. Connect one and try again, or explore Ear training.";
    if (err.name === "NotReadableError")
      return "The microphone is busy. Close other apps using it and try again.";
    return (
      err.message || "We couldn’t start your microphone. Please try again."
    );
  }
  function updateDots() {
    if (!$("attemptDots")) return;
    $("attemptDots").innerHTML = session.notes
      .map(
        (n, i) =>
          `<span class="attempt-dot ${session.results[i]?.passed ? "passed" : i < session.index ? "attempted" : ""} ${i === session.index ? "current" : ""}" aria-label="Note ${i + 1}${session.results[i] ? (session.results[i].passed ? " matched" : " practiced") : ""}">${session.results[i]?.passed ? "✓" : i + 1}</span>`,
      )
      .join("");
  }
  function feedback(text, type = "") {
    if ($("practiceFeedback")) {
      $("practiceFeedback").textContent = text;
      $("practiceFeedback").className = `feedback-box ${type}`;
    }
  }
  async function startSing() {
    if (
      micPending ||
      session?.phase === "singing" ||
      session?.phase === "guide"
    )
      return;
    if (!session || session.phase === "done") {
      const targets = getTargets(currentLesson);
      session = {
        lesson: currentLesson,
        notes: targets.notes,
        adapted: targets.adapted,
        index: 0,
        results: [],
        started: Date.now(),
        phase: "ready",
        scored: false,
      };
    }
    const target = session.notes[session.index],
      token = ++run;
    session.phase = "guide";
    micPending = true;
    trace = [];
    lastFeedback = "";
    stopAudio();
    $("targetNote").textContent = noteName(target);
    $("targetFrequency").textContent = `${Math.round(E.midiToHz(target))} Hz`;
    $("heardNote").textContent = "—";
    $("pitchCents").textContent = "Listen first";
    $("holdProgress").style.width = "0%";
    $("pitchPath").setAttribute("d", "");
    $("traceHint").hidden = false;
    $("tunerNeedle").style.left = "50%";
    $("phaseLabel").textContent = "Getting ready";
    $("practiceTitle").textContent = "First the guide. Then your voice.";
    $("practiceControls").innerHTML =
      '<button class="button secondary" data-action="stop-sing">Cancel / stop</button>';
    $("noteStepper").hidden = true;
    feedback(
      "Allow microphone access if your browser asks. No recording is saved.",
    );
    try {
      await getAudio();
      if (token !== run) return;
      if (!(await getMic(token))) return;
      if (token !== run) return;
      micPending = false;
      $("phaseLabel").textContent = "Listen";
      $("micStatus").textContent =
        "Microphone ready · scoring paused during the guide";
      feedback("Listen to the target. Imagine singing it before you begin.");
      tone(target, audio.currentTime + 0.05, 1.05);
      await delay(1750);
      if (token !== run) return;
      session.phase = "singing";
      session.attempt = E.createAttempt({
        targetMidi: target,
        toleranceCents: store.settings.tolerance,
        holdMs: currentLesson.hold,
        minConfidence: 0.85,
      });
      session.roundStarted = performance.now();
      $("phaseLabel").textContent = "Your turn";
      $("practiceTitle").textContent = "Let your note settle gently.";
      $("micStatus").textContent = "Listening · processed only on this device";
      feedback("Your turn. Hum gently or sing “oo”.");
      const buffer = new Float32Array(analyser.fftSize);
      lastRender = 0;
      const loop = (now) => {
        if (token !== run || session?.phase !== "singing" || !analyser) return;
        if (now - lastRender >= 40) {
          lastRender = now;
          analyser.getFloatTimeDomainData(buffer);
          const detected = E.detectPitch(buffer, audio.sampleRate),
            result = session.attempt.feed(detected, now);
          updatePitch(detected, result);
          if (result.passed) {
            finishAttempt(true);
            return;
          }
          if (now - session.roundStarted > 12000) {
            finishAttempt(false);
            return;
          }
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    } catch (err) {
      if (token !== run) return;
      micPending = false;
      releaseMic();
      session.phase = "ready";
      $("phaseLabel").textContent = "Let’s try again";
      $("micStatus").textContent = "Microphone off";
      feedback(microphoneError(err), "warning");
      $("practiceControls").innerHTML =
        '<button class="button secondary" data-route="ear">Try ear training</button><button class="button primary" data-action="start-sing">Try microphone again</button>';
      $("noteStepper").hidden = false;
    }
  }
  function updatePitch(detected, result) {
    const cents = detected
      ? E.centsFromTarget(detected.frequency, session.notes[session.index])
      : null;
    $("micLevel").style.width =
      `${detected ? clamp(detected.rms * 600, 3, 100) : 0}%`;
    $("heardNote").textContent = detected
      ? noteName(E.hzToMidi(detected.frequency))
      : "—";
    $("pitchCents").textContent = detected
      ? `${Math.round(cents) > 0 ? "+" : ""}${Math.round(cents)} cents`
      : "Waiting for a clear note";
    $("tunerNeedle").style.left =
      `${cents === null ? 50 : clamp(50 + cents / 2, 2, 98)}%`;
    $("tunerNeedle").classList.toggle("on-target", result.inTune);
    $("holdProgress").style.width =
      `${clamp(result.progress || 0, 0, 1) * 100}%`;
    const status = result.status,
      messages = {
        "in-tune": "That’s the pitch. Keep it easy and steady.",
        sharp: "A little lower. Make a small, gentle adjustment.",
        flat: "A little higher. Think a lighter, slightly higher note.",
        "octave-high":
          "You’re in a higher octave. Try the lower target, or adjust your practice notes.",
        "octave-low":
          "You’re in a lower octave. Try the higher target, or lower your target in settings.",
        silent:
          "Waiting for a clear note. Try a gentle “oo” closer to the mic.",
      };
    if (status !== lastFeedback) {
      feedback(
        messages[status] || "Keep the sound easy and steady.",
        status === "in-tune" ? "success" : "",
      );
      lastFeedback = status;
    }
    trace.push(cents);
    if (trace.length > 140) trace.shift();
    let path = "",
      drawing = false;
    trace.forEach((v, i) => {
      if (v === null) {
        drawing = false;
        return;
      }
      path += `${drawing ? "L" : "M"}${((i / 139) * 600).toFixed(1)},${clamp(80 - v / 2, 5, 155).toFixed(1)} `;
      drawing = true;
    });
    $("pitchPath").setAttribute("d", path);
    if (detected) $("traceHint").hidden = true;
  }
  function finishAttempt(passed, reason) {
    cancelAnimationFrame(frame);
    releaseMic();
    stopAudio();
    if (!session) return;
    session.phase = "feedback";
    session.lastResult = { ...session.attempt?.summary(), passed };
    $("phaseLabel").textContent = passed ? "Note matched" : "A useful attempt";
    $("micStatus").textContent = "Microphone off · take an easy breath";
    $("practiceTitle").textContent = passed
      ? "There it is. That’s your note."
      : "Let’s take it one note at a time.";
    feedback(
      reason ||
        (passed
          ? "You held the target steadily. Take a breath before the next note."
          : "The target hasn’t settled yet. Listen again, try a softer hum, or choose an easier starting note."),
      passed ? "success" : "",
    );
    $("practiceControls").innerHTML =
      `<button class="button secondary" data-action="start-sing">${icon("play")} Try this note again</button><button class="button primary" data-action="next-note">${session.index + 1 === session.notes.length ? "See my session" : passed ? "Next note" : "Continue practicing"} ${icon("arrow")}</button>`;
  }
  function nextNote() {
    if (!session || session.phase !== "feedback") return;
    session.results[session.index] = session.lastResult;
    session.index++;
    updateDots();
    if (session.index < session.notes.length) {
      session.phase = "ready";
      startSing();
    } else finishSession();
  }
  function recordSession(lesson, kind, score, passed, started) {
    const entry = {
      lesson: lesson.id,
      kind,
      score,
      passed,
      seconds: Math.min(
        3600,
        Math.max(1, Math.round((Date.now() - started) / 1000)),
      ),
      date: new Date().toISOString(),
    };
    store.history.push(entry);
    store.history = store.history.slice(-200);
    if (passed) store.completions[lesson.id] = entry.date;
    save();
    updateChrome();
  }
  function finishSession() {
    cleanup();
    session.phase = "done";
    const matched = session.results.filter((x) => x.passed).length,
      total = session.notes.length,
      score = Math.round((matched / total) * 100),
      needed =
        session.lesson.id === "match"
          ? 3
          : session.lesson.id === "steady"
            ? 3
            : Math.ceil(total * 0.8),
      passed = matched >= needed && !session.adapted;
    if (!session.scored) {
      recordSession(session.lesson, "sing", score, passed, session.started);
      session.scored = true;
    }
    $("phaseLabel").textContent = passed ? "Goal reached" : "Practice saved";
    $("practiceTitle").textContent = passed
      ? "A small step. A real achievement."
      : "Every attempt teaches you something.";
    feedback(
      `${matched} of ${total} targets matched (${score}%). ${session.adapted ? "Adapted practice saved. Try the full pattern when your practice window allows." : passed ? "Your lesson goal is complete. Repeat to build confidence, or explore the next lesson." : "Practice is saved. Repeat when you’re ready; there’s no rush."}`,
      passed ? "success" : "",
    );
    $("practiceControls").innerHTML =
      '<button class="button secondary" data-action="restart-sing">Practice again</button><button class="button primary" data-route="learn">Back to my path</button>';
    $("noteStepper").hidden = true;
  }
  function startQuiz() {
    const mode = currentLesson.mode,
      s = store.settings,
      width = s.high - s.low;
    if (width < (mode === "intervals" ? 3 : 1)) {
      toast(
        "Widen your practice window in settings to hear contrasting notes.",
      );
      return false;
    }
    const pool =
      mode === "direction"
        ? [
            0,
            Math.min(4, width),
            -Math.min(5, width),
            Math.min(2, width),
            -Math.min(3, width),
          ]
        : [0, Math.min(2, width), -Math.min(3, width), Math.min(5, width), -1];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    quiz = {
      lesson: currentLesson,
      index: 0,
      questions: pool.map((delta) => {
        const lo = s.low + Math.max(0, -delta),
          hi = s.high - Math.max(0, delta),
          first = clamp(s.root + Math.floor(Math.random() * 5) - 2, lo, hi);
        return {
          first,
          second: first + delta,
          delta,
          answer:
            delta === 0
              ? "same"
              : mode === "direction"
                ? delta > 0
                  ? "higher"
                  : "lower"
                : Math.abs(delta) <= 2
                  ? "step"
                  : "skip",
        };
      }),
      results: [],
      answered: false,
      played: false,
      playing: false,
      started: Date.now(),
      scored: false,
    };
    return true;
  }
  async function playPair() {
    if (!quiz && !startQuiz()) return;
    if (quiz.playing || quiz.index >= 5) return;
    const token = ++run;
    stopAudio();
    quiz.playing = true;
    $("playPair").disabled = true;
    $("playPair").innerHTML = `${icon("ear")} Listen closely…`;
    document
      .querySelectorAll("[data-answer]")
      .forEach((b) => (b.disabled = true));
    $("quizCounter").textContent = `${quiz.index + 1} of 5`;
    try {
      await getAudio();
      if (token !== run) return;
      const q = quiz.questions[quiz.index],
        start = audio.currentTime + 0.05;
      tone(q.first, start, 0.7);
      tone(q.second, start + 1.05, 0.7);
      await delay(1950);
      if (token !== run || !quiz) return;
      quiz.playing = false;
      quiz.played = true;
      $("playPair").disabled = false;
      $("playPair").innerHTML = `${icon("play")} Hear them again`;
      if (!quiz.answered) {
        document
          .querySelectorAll("[data-answer]")
          .forEach((b) => (b.disabled = false));
        $("earFeedback").textContent =
          "What did you hear? Pick the relationship between the two notes.";
      }
    } catch (err) {
      if (token !== run) return;
      quiz.playing = false;
      $("playPair").disabled = false;
      $("playPair").textContent = "Try audio again";
      toast(err.message);
    }
  }
  function answerQuiz(answer) {
    if (!quiz || !quiz.played || quiz.playing || quiz.answered) return;
    quiz.answered = true;
    const q = quiz.questions[quiz.index],
      correct = answer === q.answer;
    quiz.results.push(correct);
    document.querySelectorAll("[data-answer]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("correct", b.dataset.answer === q.answer);
      b.classList.toggle("wrong", b.dataset.answer === answer && !correct);
    });
    $("quizDots").children[quiz.index].className = correct
      ? "correct"
      : "attempted";
    const relationship =
      q.answer === "same"
        ? "stayed on the same pitch"
        : q.answer === "higher"
          ? "moved higher"
          : q.answer === "lower"
            ? "moved lower"
            : `made a ${q.answer}`;
    $("earFeedback").className = `feedback-box ${correct ? "success" : ""}`;
    $("earFeedback").textContent =
      `${correct ? "You heard it." : "Here’s what to listen for:"} The second note ${relationship}. ${noteName(q.first)} → ${noteName(q.second)}${currentLesson.mode === "intervals" ? ` · ${Math.abs(q.delta)} semitone${Math.abs(q.delta) === 1 ? "" : "s"}` : ""}. You can replay the pair.`;
    $("earNext").innerHTML =
      `<button class="button primary" data-action="next-question">${quiz.index === 4 ? "See my session" : "Next listening moment"} ${icon("arrow")}</button>`;
  }
  function nextQuestion() {
    if (!quiz?.answered || quiz.scored) return;
    ++run;
    stopAudio();
    quiz.index++;
    if (quiz.index === 5) {
      const score = quiz.results.filter(Boolean).length * 20,
        passed = score >= 80;
      quiz.scored = true;
      recordSession(quiz.lesson, "ear", score, passed, quiz.started);
      $("quizCounter").textContent = passed ? "Goal reached" : "Practice saved";
      $("earInstruction").textContent =
        `${score / 20} out of 5. ${passed ? "Your musical ear is making connections." : "Every listen is a little more experience."}`;
      $("earFeedback").textContent = passed
        ? "Lesson goal reached. Try another lesson, or repeat with fresh note pairs."
        : "Your session is saved. Listen again and notice what feels clearer the second time.";
      $("playPair").hidden = true;
      $("answerButtons").hidden = true;
      $("earNext").innerHTML =
        '<button class="button secondary" data-action="restart-quiz">Try a fresh set</button><button class="button primary" data-route="learn">Back to my path</button>';
    } else {
      quiz.answered = false;
      quiz.played = false;
      quiz.playing = false;
      $("earNext").innerHTML = "";
      document.querySelectorAll("[data-answer]").forEach((b) => {
        b.disabled = true;
        b.classList.remove("correct", "wrong");
      });
      $("earFeedback").className = "feedback-box";
      $("earFeedback").textContent =
        "A fresh pair. Listen for the relationship.";
      playPair();
    }
  }
  function openSettings() {
    if (session && !["ready", "feedback", "done"].includes(session.phase)) {
      toast("Finish or stop this attempt before adjusting your notes.");
      return;
    }
    cleanup();
    if (quiz?.playing) {
      quiz.playing = false;
      $("playPair").disabled = false;
      $("playPair").textContent = "Replay these notes";
    }
    const options = Array.from(
      { length: 49 },
      (_, i) => `<option value="${i + 36}">${noteName(i + 36)}</option>`,
    ).join("");
    ["rootNote", "lowNote", "highNote"].forEach(
      (id) => ($(id).innerHTML = options),
    );
    const s = store.settings;
    $("rootNote").value = s.root;
    $("lowNote").value = s.low;
    $("highNote").value = s.high;
    $("tolerance").value = s.tolerance;
    $("guideSound").value = s.timbre;
    $("volume").value = s.volume;
    $("settingsError").hidden = true;
    $("settingsDialog").showModal();
  }
  $("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const s = {
      root: +$("rootNote").value,
      low: +$("lowNote").value,
      high: +$("highNote").value,
      tolerance: +$("tolerance").value,
      timbre: $("guideSound").value,
      volume: +$("volume").value,
    };
    if (s.low > s.high || s.root < s.low || s.root > s.high) {
      $("settingsError").textContent =
        "Keep the starting note between your lowest and highest practice notes.";
      $("settingsError").hidden = false;
      return;
    }
    store.settings = s;
    save();
    cleanup();
    session = null;
    quiz = null;
    $("settingsDialog").close();
    render();
    toast("Your practice notes are updated.");
  });
  $("settingsDialog").addEventListener("close", () => {
    ++run;
    stopAudio();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button, a.brand");
    if (!button || button.disabled) return;
    if (button.dataset.route) {
      navigate(button.dataset.route, true);
      return;
    }
    if (button.dataset.lesson) {
      currentLesson = lessons.find((l) => l.id === button.dataset.lesson);
      navigate(currentLesson.kind === "ear" ? "ear" : "practice", true);
      return;
    }
    if (button.dataset.answer) {
      answerQuiz(button.dataset.answer);
      return;
    }
    const action = button.dataset.action;
    if (action === "settings") openSettings();
    if (action === "close-settings") $("settingsDialog").close();
    if (action === "preview-setting")
      preview([+$("rootNote").value], {
        timbre: $("guideSound").value,
        volume: +$("volume").value,
      });
    if (action === "preview")
      preview(
        currentLesson.pattern.length > 4
          ? getTargets(currentLesson).notes
          : [getTargets(currentLesson).notes[0]],
      );
    if (action === "start-sing") startSing();
    if (action === "next-note") nextNote();
    if (action === "restart-sing") {
      cleanup();
      session = null;
      renderPractice();
    }
    if (action === "stop-sing") {
      cleanup();
      session = null;
      renderPractice();
      feedback("Paused. Take your time, then start again when you’re ready.");
    }
    if (action === "lower" || action === "higher") {
      const targets = getTargets(currentLesson),
        span = Math.max(...targets.notes) - Math.min(...targets.notes),
        delta = action === "lower" ? -1 : 1,
        root = clamp(
          targets.base + delta,
          store.settings.low,
          store.settings.high - span,
        );
      if (root === targets.base) {
        toast(
          "That’s the edge of your practice window. Adjust your limits in settings if comfortable.",
        );
        return;
      }
      cleanup();
      session = null;
      store.settings.root = root;
      save();
      renderPractice();
      preview([root]);
    }
    if (action === "play-pair") playPair();
    if (action === "next-question") nextQuestion();
    if (action === "restart-quiz") {
      cleanup();
      quiz = null;
      renderEar();
    }
    if (action === "export") {
      const blob = new Blob(
          [
            JSON.stringify(
              { app: "PIPES", exported: new Date().toISOString(), ...store },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pipes-progress-${dateKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  });
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    $("main").focus();
    $("main").scrollIntoView({ block: "start" });
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#main") {
      $("main").focus();
      return;
    }
    navigate(location.hash.slice(1), true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      const wasActive = session && ["guide", "singing"].includes(session.phase),
        wasQuiz = quiz?.playing;
      cleanup();
      if (wasActive) {
        session = null;
        renderPractice();
        feedback(
          "Practice paused while you were away. Your microphone is off.",
        );
      }
      if (wasQuiz) {
        quiz.playing = false;
        $("playPair").disabled = false;
        $("playPair").textContent = "Replay these notes";
      }
    }
  });
  window.addEventListener("pagehide", cleanup);
  if (!E) {
    $("main").innerHTML =
      '<div class="card"><h1>The studio couldn’t load.</h1><p>Refresh the page to load the pitch engine.</p></div>';
    return;
  }
  navigate(location.hash.slice(1));
})();
