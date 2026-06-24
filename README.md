# Space Party

A desktop-first camera game hub. Seven small games are controlled entirely with
your hands and face, tracked locally in the browser. There is no controller,
keyboard, or mouse needed once you are in a game.

Camera frames are processed on your own machine with
[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe). The app never
records, stores, or uploads video or images.

## Games

| Game | Tracker | How you play |
| --- | --- | --- |
| **Pop the Bubbles** | Hand | Aim with one or both index fingers, then poke forward to burst bubbles. |
| **Pinch Puzzle** | Hand | Pinch to grab a shape, carry it, and open your fingers to drop it into its matching home. Choose 4, 6, or 8 pieces. |
| **Simon Says** | Hand + Face | Hold the matching hand sign or face expression until the ring fills—but only when Simon says. |
| **Fruit Slicer** | Hand | Swipe your fingertip through flying fruit and dodge the bombs. |
| **Mouth Flap** | Face | Open your mouth to fly up, close it to drift down, and glide through the gates. |
| **Air Drawing** | Hand | Pinch to paint in the air with shifting colors, open your hand to lift the pen. |
| **Doing the 6 7** | Hand | Hold both arms up/down and alternate as fast as you can for a clean pose. |

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost address in a current Chrome, Edge, Firefox, or Safari
browser and allow camera access.

The `dev` and `build` scripts first run `scripts/copy-mediapipe-assets.mjs`,
which copies the pinned MediaPipe WASM runtime from `node_modules` into
`public/mediapipe/wasm`. The hand and face model bundles
(`gesture_recognizer.task`, `face_landmarker.task`) are self-hosted in
`public/models`, so the app runs without contacting any external CDN.

> Camera access requires a secure origin. Browsers treat `localhost` as secure
> for development; any deployed instance must be served over HTTPS.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Copy MediaPipe assets and start the Vite dev server. |
| `npm run build` | Copy assets, type-check with `tsc -b`, and build for production. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the unit test suite once with Vitest. |
| `npm run test:watch` | Run Vitest in watch mode. |

## Tech stack

- **React 19** + **TypeScript** for the app shell and game UI.
- **Vite 8** for dev server and bundling, with an ES-module web worker.
- **Motion** for view transitions and micro-interactions.
- **MediaPipe Tasks Vision** for hand-gesture and face-landmark tracking.
- **Vitest** for unit tests.

## Architecture

- React owns the flow between views: welcome, privacy notice, calibration setup,
  game hub, instructions, gameplay, and results (see `src/App.tsx`).
- A dedicated web worker (`src/lib/tracking/vision.worker.ts`) owns MediaPipe
  initialization and inference. `useVisionTracking` keeps one downscaled
  (640×360) camera frame in flight at a time and transfers it to the worker as
  an `ImageBitmap`.
- Games receive normalized `TrackingFrame` values (fingertip points, pinch/tap
  state, recognized gesture, face expression signals) and never touch raw camera
  pixels.
- Tracking can run in `hand`, `face`, or `off` mode. The hub uses face-based
  gaze selection so you can start a game without touching anything.
- Preferences, best scores, and recent results persist to `localStorage` under
  the versioned `space-party:v1` key (`src/lib/storage.ts`), with best-effort
  writes that never crash an in-progress session.

## Project structure

```
src/
  App.tsx                 App shell and view flow
  data/games.ts           Game catalog metadata
  components/             Camera preview and shared icons
  games/                  One component per game + bubble shader
  hooks/                  Camera, calibration, gaze selection, vision tracking
  lib/                    Game logic, calibration, storage, audio, tracking math
  lib/tracking/           Vision worker and face-aim helpers
  types.ts                Shared types and worker message contracts
public/
  models/                 Self-hosted MediaPipe model bundles
  mediapipe/wasm/         Copied MediaPipe WASM runtime (generated)
  fonts/                  Bundled fonts
scripts/
  copy-mediapipe-assets.mjs   Copies the MediaPipe WASM runtime into public/
```

## Privacy

Everything runs on-device. Camera frames are read into a worker, used for
inference, and discarded. No video, image, or tracking data ever leaves your
computer, and you can stop the camera at any time from the header.
