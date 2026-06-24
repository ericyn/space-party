# Space Party

<img src=".github/assets/mario-sleep-mario.gif" alt="Mario" width="120" />

## Quick run

```bash
bun install
bun run dev
```

## Tech

Built with React, TypeScript, and Vite. MediaPipe Tasks Vision runs in the
browser to track hands and face landmarks locally, then each game maps those
signals into controls like pointing, pinching, swiping, and mouth movement.
Motion handles UI transitions, and Web Audio handles game feedback.

## Privacy

Everything runs on-device. Camera frames are used for local tracking only, and
nothing is recorded or uploaded.
