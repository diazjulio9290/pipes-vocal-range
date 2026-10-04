# PIPES — Find your voice

A browser-based singing practice app for beginners, with a six-lesson path, live pitch feedback, ear training, adjustable practice notes, and a local progress journal. The original range and warm-up tools remain available in `studio.html`.

## Run locally

Use a current Node.js version with the built-in test runner. No package installation or build step is required.

```sh
npm start
```

Open **http://127.0.0.1:4173**. The development server binds to the local computer only. A different port can be passed with `npm start -- 4174`.

```sh
npm test
```

Tests cover synthetic pitch detection, sustained-note scoring, and regressions in the legacy studio, including comfortable-range limits and octave errors. Browser interaction checks should also exercise microphone denial, stopping and switching lessons, settings, ear-training answers, and reloading saved progress.

With Playwright and Google Chrome installed, run `npm run test:browser` while the local server is running. The optional browser suite sends generated tones, noise, and silence through real Web Audio streams, and checks lesson scoring, saved progress, microphone cleanup, settings, and mobile layouts. Set `PLAYWRIGHT_MODULE` to an existing Playwright module path if needed; `PIPES_URL` overrides the tested site and `PIPES_SCREENSHOTS` controls screenshot output. These are development tools, not application dependencies.

For hosting, serve the app's HTML, CSS, JavaScript, and audio assets through a static HTTPS host. There is no application backend. Do not use the local development server as a public production service.

## The learning path

| Lesson                             | Practice                                                 | Goal                                |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| 1. First, learn to listen          | Higher, lower, or the same                               | 4 of 5 first answers correct        |
| 2. Find your first note            | Listen, imagine, then hum a target                       | 3 of 4 targets held for 0.8 seconds |
| 3. Make it a steady note           | Sustain an easy pitch                                    | 3 targets held for 1.5 seconds      |
| 4. One small step at a time        | Guided do–re–mi–re–do                                    | 4 of 5 targets matched              |
| 5. Give your ears a little stretch | Hear repeated notes, steps, and skips                    | 4 of 5 first answers correct        |
| 6. Turn notes into a melody        | Preview a short phrase, then echo its notes individually | 6 of 7 targets held for 0.7 seconds |

Every lesson is open. Singing attempts use separate guide and response phases; pitch scoring starts after the reference tone stops. A matched target requires an uninterrupted hold inside the selected pitch tolerance, including the target octave. Silence, low-confidence detection, and octave errors do not earn a matched target. Retrying is encouraged, and sessions distinguish practice from reaching a lesson goal.

Choose a starting note and practice limits that feel easy today. These settings are not a measured vocal range. Narrow windows adapt the guided patterns; adapted sessions are saved without completing the original lesson goal. Legacy patterns that cannot fit the saved comfortable range are unavailable rather than extending that range automatically.

## Privacy and storage

Microphone audio is analyzed in the browser. The app does not record, store, or upload microphone audio. Microphone access requires permission and **HTTPS or localhost**; listening exercises work without it. Headphones help prevent reference audio from reaching the microphone.

Settings, lesson goals, and up to 200 recent sessions are stored in this browser's `localStorage` under `pipes-learning-v2`. The legacy tools use `pipes-range-v1` and `pipes-timbre`. Progress does not sync across devices. Export progress from **My progress** before clearing browser data. If storage is unavailable, progress lasts for the current visit. Fonts are requested from Google Fonts; no microphone audio accompanies those requests.

## Teaching references and limits

The lesson sequence and numerical goals are product design choices, not a validated diagnostic or certification system. The final lesson provides guided note-by-note practice; it does not assess unprompted melody recall, expressive quality, or rhythm.

- [Foundations of Aural Skills: Matching Pitch and Tuning](https://uen.pressbooks.pub/auralskills/chapter/matching-pitch-and-tuning/) informs comfortable reference pitches, imagining a note before singing, and repeated pitch-matching practice.
- [Open University: Revisiting key concepts](https://www.open.edu/openlearn/history-the-arts/introduction-music-theory-2-pitch-and-notation/content-section-5) explains octave relationships. PIPES uses an explicit target octave for feedback; adjust the reference to suit the singer.
- [NIDCD: Taking Care of Your Voice](https://www.nidcd.nih.gov/health/taking-care-your-voice) informs the emphasis on comfortable use and rest when a voice is tired or hoarse.

Synthetic audio tests verify known signals and scoring rules; they do not establish accuracy for every real singer, microphone, room, or browser. Background music, breathy tones, harmonics, and speaker bleed can affect detection. Treat feedback as a practice aid, keep singing comfortable, and stop if it feels strained or painful.
