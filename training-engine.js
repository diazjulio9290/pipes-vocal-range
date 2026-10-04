/* Pipes' audio analysis and practice scoring. No browser/device lifecycle here. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PipesTraining = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MIN_HZ = 55;
  var MAX_HZ = 1400;
  var MIN_RMS = 0.006;

  function validFrequency(value) {
    return Number.isFinite(value) && value > 0;
  }

  function midiToHz(midi) {
    return Number.isFinite(midi) ? 440 * Math.pow(2, (midi - 69) / 12) : NaN;
  }

  function hzToMidi(frequency) {
    return validFrequency(frequency)
      ? 69 + 12 * Math.log2(frequency / 440)
      : NaN;
  }

  // targetMidi is an absolute note, including octave. Never fold pitch classes.
  function centsFromTarget(frequency, targetMidi) {
    return Number.isFinite(targetMidi)
      ? (hzToMidi(frequency) - targetMidi) * 100
      : NaN;
  }

  function classifyPitch(frequency, targetMidi, toleranceCents) {
    var tolerance =
      Number.isFinite(toleranceCents) && toleranceCents >= 0
        ? toleranceCents
        : 35;
    var cents = centsFromTarget(frequency, targetMidi);
    if (!Number.isFinite(cents)) {
      return {
        status: "silent",
        cents: null,
        inTune: false,
        octaveError: false,
      };
    }
    var inTune = Math.abs(cents) <= tolerance + 1e-8;
    var octaves = Math.round(cents / 1200);
    var octaveError =
      !inTune && octaves !== 0 && Math.abs(cents - octaves * 1200) <= tolerance;
    return {
      status: inTune
        ? "in-tune"
        : octaveError
          ? cents > 0
            ? "octave-high"
            : "octave-low"
          : cents > 0
            ? "sharp"
            : "flat",
      cents: cents,
      inTune: inTune,
      octaveError: octaveError,
    };
  }

  /**
   * YIN-style cumulative normalized difference with a periodicity gate.
   * Algorithm reference: de Cheveigne & Kawahara (2002), doi:10.1121/1.1458024.
   * A 4096-sample frame at 44.1/48 kHz works well for the supported 55-1400 Hz
   * range. confidence describes periodicity, not proof that a human is singing.
   * Caller must stop guide audio before scoring: speakers can enter the mic.
   */
  function detectPitch(buffer, sampleRate) {
    if (
      !buffer ||
      buffer.length < 128 ||
      !Number.isFinite(sampleRate) ||
      sampleRate < 8000
    )
      return null;
    var length = buffer.length;
    var mean = 0;
    var i;
    for (i = 0; i < length; i++) {
      if (!Number.isFinite(buffer[i])) return null;
      mean += buffer[i];
    }
    mean /= length;
    var energy = 0;
    for (i = 0; i < length; i++) {
      var centered = buffer[i] - mean;
      energy += centered * centered;
    }
    var rms = Math.sqrt(energy / length);
    if (rms < MIN_RMS) return null;

    // Average neighboring samples before decimating, reducing work on phones.
    // At 48 kHz this uses 1365 samples instead of 4096 for the lag search.
    var stride = Math.max(1, Math.floor(sampleRate / 16000));
    var rate = sampleRate / stride;
    var count = Math.floor(length / stride);
    var samples = new Float32Array(count);
    for (i = 0; i < count; i++) {
      var sum = 0;
      for (var j = 0; j < stride; j++) sum += buffer[i * stride + j] - mean;
      samples[i] = sum / stride;
    }
    // Inspect short periods too, so an above-range tone isn't accepted via its
    // second period and misreported an octave lower inside the singing range.
    var minLag = 2;
    var maxLag = Math.min(Math.ceil(rate / MIN_HZ), Math.floor(count / 2) - 1);
    if (maxLag <= minLag + 2) return null;
    var windowSize = count - maxLag - 1;
    var difference = new Float32Array(maxLag + 2);
    var cumulative = 0;
    difference[0] = 1;
    for (var lag = 1; lag <= maxLag + 1; lag++) {
      var distance = 0;
      for (i = 0; i < windowSize; i++) {
        var delta = samples[i] - samples[i + lag];
        distance += delta * delta;
      }
      cumulative += distance;
      difference[lag] = cumulative > 0 ? (distance * lag) / cumulative : 1;
    }

    // The first sufficiently periodic dip avoids selecting a multiple period.
    // Do not fall back to a best guess when hiss/noise has no periodic dip.
    var period = -1;
    for (lag = minLag; lag <= maxLag; lag++) {
      if (difference[lag] < 0.15) {
        while (lag < maxLag && difference[lag + 1] < difference[lag]) lag++;
        period = lag;
        break;
      }
    }
    if (period < 0) return null;

    // A dominant second harmonic can create a shallow early dip. Prefer its
    // double period only if the mismatch is dramatically smaller there.
    var doubled = period * 2;
    if (doubled < maxLag && difference[period] > 0.025) {
      var candidate = doubled;
      if (difference[candidate - 1] < difference[candidate]) candidate--;
      if (difference[doubled + 1] < difference[candidate])
        candidate = doubled + 1;
      if (
        difference[candidate] < difference[period] * 0.25 &&
        difference[candidate] < 0.02
      )
        period = candidate;
    }

    var left = difference[period - 1];
    var center = difference[period];
    var right = difference[period + 1];
    var denominator = left - 2 * center + right;
    var adjustment =
      denominator !== 0 ? (0.5 * (left - right)) / denominator : 0;
    adjustment = Math.max(-0.5, Math.min(0.5, adjustment));
    var frequency = rate / (period + adjustment);
    var confidence = Math.max(0, Math.min(1, 1 - center));
    if (
      !validFrequency(frequency) ||
      frequency < MIN_HZ ||
      frequency > MAX_HZ ||
      confidence < 0.85
    )
      return null;
    return { frequency: frequency, confidence: confidence, rms: rms };
  }

  /**
   * A single-note attempt. Call feed(detection|null, performance.now()) on every
   * analysis frame, including silence. A numeric frequency is also accepted for
   * callers supplying already validated pitch. Call summary() to finish.
   *
   * Time is credited only between two voiced frames, and successful time only
   * between two in-tune frames. Unvoiced frames and scheduling gaps interrupt a
   * hold. No interpolation across silence, suspended tabs, or dropped frames.
   * Accuracy is a 0-100 percentage of voiced time; success additionally needs
   * the requested uninterrupted hold. A perfect but brief sound cannot pass.
   */
  function createAttempt(options) {
    options = options || {};
    if (!Number.isFinite(options.targetMidi))
      throw new TypeError("A finite targetMidi is required.");
    var targetMidi = options.targetMidi;
    var tolerance =
      Number.isFinite(options.toleranceCents) && options.toleranceCents > 0
        ? options.toleranceCents
        : 35;
    var holdMs =
      Number.isFinite(options.holdMs) && options.holdMs > 0
        ? options.holdMs
        : 1200;
    var minConfidence = Number.isFinite(options.minConfidence)
      ? Math.max(0, Math.min(1, options.minConfidence))
      : 0.85;
    var minRms =
      Number.isFinite(options.minRms) && options.minRms >= 0
        ? options.minRms
        : MIN_RMS;
    var maxFrameMs =
      Number.isFinite(options.maxFrameMs) && options.maxFrameMs > 0
        ? options.maxFrameMs
        : 150;
    var firstTime;
    var previousTime;
    var previousPitch;
    var current;
    var voicedMs;
    var inTuneMs;
    var hold;
    var longestHoldMs;
    var absoluteErrorSum;
    var centsSum;
    var squaredCentsSum;

    function reset() {
      firstTime = null;
      previousTime = null;
      previousPitch = null;
      current = classifyPitch(null, targetMidi, tolerance);
      voicedMs = 0;
      inTuneMs = 0;
      hold = 0;
      longestHoldMs = 0;
      absoluteErrorSum = 0;
      centsSum = 0;
      squaredCentsSum = 0;
    }

    function summary() {
      var meanCents = voicedMs > 0 ? centsSum / voicedMs : null;
      return {
        targetMidi: targetMidi,
        status: current.status,
        cents: current.cents,
        inTune: current.inTune,
        octaveError: current.octaveError,
        elapsedMs: firstTime === null ? 0 : previousTime - firstTime,
        voicedMs: voicedMs,
        inTuneMs: inTuneMs,
        holdMs: hold,
        longestHoldMs: longestHoldMs,
        requiredHoldMs: holdMs,
        progress: Math.min(1, hold / holdMs),
        accuracy: voicedMs > 0 ? Math.round((100 * inTuneMs) / voicedMs) : 0,
        meanCents: meanCents,
        meanAbsoluteCents: voicedMs > 0 ? absoluteErrorSum / voicedMs : null,
        steadinessCents:
          voicedMs > 0
            ? Math.sqrt(
                Math.max(0, squaredCentsSum / voicedMs - meanCents * meanCents),
              )
            : null,
        passed: longestHoldMs + 1e-8 >= holdMs,
      };
    }

    function feed(detection, timestampMs) {
      if (!Number.isFinite(timestampMs))
        throw new TypeError("A finite timestamp in milliseconds is required.");
      // Ignore duplicate and out-of-order events without altering the hold.
      if (previousTime !== null && timestampMs <= previousTime)
        return summary();
      var frequency = null;
      if (typeof detection === "number") {
        if (validFrequency(detection)) frequency = detection;
      } else if (
        detection &&
        validFrequency(detection.frequency) &&
        Number.isFinite(detection.confidence) &&
        detection.confidence >= minConfidence &&
        Number.isFinite(detection.rms) &&
        detection.rms >= minRms
      ) {
        frequency = detection.frequency;
      }
      current = classifyPitch(frequency, targetMidi, tolerance);
      var voiced = current.cents !== null;
      if (firstTime === null) firstTime = timestampMs;
      var duration = previousTime === null ? 0 : timestampMs - previousTime;
      var continuous = duration > 0 && duration <= maxFrameMs;
      if (
        continuous &&
        voiced &&
        previousPitch &&
        previousPitch.cents !== null
      ) {
        voicedMs += duration;
        // Trapezoidal integration makes the result independent of frame rate.
        absoluteErrorSum +=
          (Math.abs(previousPitch.cents) + Math.abs(current.cents)) *
          0.5 *
          duration;
        centsSum += (previousPitch.cents + current.cents) * 0.5 * duration;
        squaredCentsSum +=
          (previousPitch.cents * previousPitch.cents +
            current.cents * current.cents) *
          0.5 *
          duration;
        if (current.inTune && previousPitch.inTune) {
          inTuneMs += duration;
          hold += duration;
          longestHoldMs = Math.max(longestHoldMs, hold);
        } else hold = 0;
      } else hold = 0;
      previousTime = timestampMs;
      previousPitch = current;
      return summary();
    }

    reset();
    return { feed: feed, summary: summary, reset: reset };
  }

  return {
    detectPitch: detectPitch,
    midiToHz: midiToHz,
    hzToMidi: hzToMidi,
    centsFromTarget: centsFromTarget,
    classifyPitch: classifyPitch,
    createAttempt: createAttempt,
  };
});
