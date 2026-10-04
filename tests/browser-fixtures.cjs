"use strict";

// Install with page.addInitScript(installSyntheticMicrophone). This sends an
// actual Web Audio MediaStream into the app's microphone analyser, exercising
// pitch detection and scoring without using the tester's physical microphone.
function installSyntheticMicrophone() {
  let frequency = 220;
  let amplitude = 0.2;
  let noiseEnabled = false;
  const sessions = [];
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  window.__testMic = {
    setFrequency(value) {
      frequency = value;
      sessions.forEach((session) =>
        session.oscillator.frequency.setValueAtTime(
          value,
          session.context.currentTime,
        ),
      );
    },
    setAmplitude(value) {
      amplitude = value;
      sessions.forEach((session) => {
        session.gain.gain.setValueAtTime(noiseEnabled ? 0 : value, session.context.currentTime);
        session.noiseGain.gain.setValueAtTime(noiseEnabled ? value : 0, session.context.currentTime);
      });
    },
    setNoise(enabled) {
      noiseEnabled = enabled;
      this.setAmplitude(amplitude);
    },
    activeTracks() {
      return sessions
        .flatMap((session) => session.destination.stream.getTracks())
        .filter((track) => track.readyState === "live").length;
    },
    async close() {
      await Promise.all(
        sessions.map(async (session) => {
          session.destination.stream
            .getTracks()
            .forEach((track) => track.stop());
          await session.context.close();
        }),
      );
    },
  };
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async function () {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      oscillator.__syntheticMicrophone = true;
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      const noise = context.createBufferSource();
      const noiseGain = context.createGain();
      const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < noiseData.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        noiseData[i] = 2 * seed / 4294967296 - 1;
      }
      noise.buffer = noiseBuffer;
      noise.loop = true;
      oscillator.frequency.value = frequency;
      gain.gain.value = noiseEnabled ? 0 : amplitude;
      noiseGain.gain.value = noiseEnabled ? amplitude : 0;
      oscillator.connect(gain).connect(destination);
      noise.connect(noiseGain).connect(destination);
      oscillator.start();
      noise.start();
      await context.resume();
      sessions.push({ context, oscillator, gain, destination, noise, noiseGain });
      return destination.stream;
    },
  });
}

function denyMicrophone() {
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async function () {
      throw new DOMException("Permission denied by test", "NotAllowedError");
    },
  });
}

module.exports = { installSyntheticMicrophone, denyMicrophone };
