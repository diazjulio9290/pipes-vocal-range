"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../studio.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Run the actual legacy functions with just their browser/audio boundaries stubbed.
function load(names, extra = {}) {
  const context = vm.createContext({
    KB_LO: 33,
    KB_HI: 89,
    median: (values) =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
    freqToMidiFloat: (frequency) => 69 + 12 * Math.log2(frequency / 440),
    midiToName: (midi) => `MIDI ${midi}`,
    ...extra,
  });
  for (const name of names) {
    const match = script.match(new RegExp(`  function ${name}\\([^]*?\\n  }`));
    assert.ok(match, `Function ${name} exists`);
    vm.runInContext(match[0], context);
  }
  return context;
}

test("legacy inline script parses", () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test("wide exercises do not extend a narrow comfortable range", () => {
  const app = load(["exerciseLimits"]);
  assert.equal(app.exerciseLimits({ comfyLo: 60, comfyHi: 64 }, 7), null);
  const limits = app.exerciseLimits({ comfyLo: 60, comfyHi: 67 }, 7);
  assert.equal(limits.lo, 60);
  assert.equal(limits.hi, 60);
  const shorter = app.exerciseLimits({ comfyLo: 60, comfyHi: 67 }, 4);
  assert.equal(shorter.lo, 60);
  assert.equal(shorter.hi, 63);
});

test("chord targets fit the range or explicitly report no matching octave", () => {
  const app = load(["snapToRange"]);
  assert.equal(app.snapToRange(67, 60, 64), null);
  assert.equal(app.snapToRange(48, 60, 64), 60);
  assert.equal(app.snapToRange(55, 60, 72), 67);
  for (let lo = 40; lo <= 72; lo++) {
    for (let width = 0; width <= 15; width++) {
      for (let midi = 40; midi <= 80; midi++) {
        const result = app.snapToRange(midi, lo, lo + width);
        if (result === null) {
          assert.equal(
            Array.from({ length: width + 1 }, (_, i) => lo + i).some(
              (n) => (n - midi) % 12 === 0,
            ),
            false,
          );
        } else {
          assert.ok(result >= lo && result <= lo + width);
          assert.equal(Math.abs(result - midi) % 12, 0);
        }
      }
    }
  }
});

test("sing-along accepts the reference octave and coaches octave errors", () => {
  const nodes = {};
  const app = load(["saFrame"], {
    saStageEl: {
      querySelector: (selector) => (nodes[selector] ||= { style: {} }),
    },
    toneCtx: { currentTime: 1 },
    saSchedule: [{ at: 0, until: 5, midi: 60 }],
    saRecent: [],
  });
  app.saFrame(261.625565, 0);
  assert.equal(nodes[".sa-verdict"].className, "sa-verdict hit");
  app.saRecent = [];
  app.saFrame(523.251131, 0);
  assert.equal(nodes[".sa-verdict"].className, "sa-verdict miss");
  assert.match(nodes[".sa-verdict"].textContent, /different octave/);
  app.saRecent = [];
  app.saFrame(130.812783, 0);
  assert.equal(nodes[".sa-verdict"].className, "sa-verdict miss");
});

test("chord grading does not award octave errors or count missing input as an attempt", () => {
  const app = load(["ctGrade"], {
    ctEls: () => null,
    ctTarget: { midi: 60 },
    ctSamples: [],
    ctScore: { asked: 0, hits: 0, streak: 0, best: 0 },
    ctLastVerdict: null,
  });
  assert.equal(app.ctGrade().verdict, "quiet");
  assert.equal(app.ctScore.asked, 0);
  app.ctSamples = Array.from({ length: 20 }, (_, i) => ({ t: i * 50, m: 72 }));
  assert.equal(app.ctGrade().verdict, "miss");
  assert.equal(app.ctScore.hits, 0);
  app.ctSamples = Array.from({ length: 20 }, (_, i) => ({ t: i * 50, m: 60 }));
  assert.equal(app.ctGrade().verdict, "hit");
  assert.equal(app.ctScore.hits, 1);
  assert.equal(app.ctScore.asked, 2);
});

test("unavailable chord tone stops before audio starts", () => {
  let stopped = false;
  const nodes = { target: {}, verdict: {} };
  const app = load(["snapToRange", "ctPhaseChord"], {
    ctStopped: false,
    ctEls: () => nodes,
    ctProg: { chords: [{ q: "maj", r: 0, d: "I" }] },
    ctIdx: 0,
    CHORD_TONES: { maj: [0, 4, 7] },
    CT_TARGET_MODES: [{ id: "fifth", idx: 2 }],
    ctTargetMode: "fifth",
    ctTarget: null,
    getComfyRange: () => ({ comfyLo: 60, comfyHi: 64 }),
    ctKeyRoot: () => ({ accomp: 48 }),
    stopChordTrainer: () => {
      stopped = true;
    },
    getToneCtx: () => {
      throw new Error("No audio should start for an unavailable target");
    },
  });
  app.ctPhaseChord();
  assert.equal(stopped, true);
  assert.equal(app.ctTarget, null);
  assert.match(nodes.target.textContent, /outside your comfortable/);
});
