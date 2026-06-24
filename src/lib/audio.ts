import {
  defineSequence,
  defineSound,
  ensureReady,
  setMasterVolume,
  type PlayOptions,
} from "@web-kits/audio";

export type SoundCue =
  | "ui-select"
  | "ui-confirm"
  | "card-hover"
  | "countdown-tick"
  | "countdown-start"
  | "bubble-pop"
  | "bonus-pop"
  | "puzzle-grab"
  | "puzzle-place"
  | "puzzle-reject"
  | "success"
  | "miss";

const uiSelect = defineSound({
  source: { type: "sine", frequency: { start: 760, end: 980 } },
  envelope: { attack: 0.004, decay: 0.055 },
  gain: 0.13,
});

const uiConfirm = defineSequence([
  {
    sound: {
      source: { type: "triangle", frequency: 540 },
      envelope: { attack: 0.004, decay: 0.1 },
      gain: 0.13,
    },
    at: 0,
  },
  {
    sound: {
      source: { type: "sine", frequency: 810 },
      envelope: { attack: 0.004, decay: 0.13 },
      gain: 0.11,
    },
    at: 0.055,
  },
]);

const cardHover = defineSound({
  layers: [
    {
      source: { type: "triangle", frequency: { start: 420, end: 620 } },
      envelope: { attack: 0.002, decay: 0.045 },
      gain: 0.055,
      filter: { type: "lowpass", frequency: 1700, resonance: 0.2 },
    },
    {
      source: { type: "sine", frequency: 1040 },
      envelope: { attack: 0.001, decay: 0.035 },
      gain: 0.025,
    },
  ],
});

const countdownTick = defineSound({
  layers: [
    {
      source: { type: "triangle", frequency: { start: 620, end: 760 } },
      envelope: { attack: 0.002, decay: 0.08 },
      gain: 0.12,
      filter: { type: "lowpass", frequency: 1800, resonance: 0.15 },
    },
    {
      source: { type: "sine", frequency: 1240 },
      envelope: { attack: 0.001, decay: 0.04 },
      gain: 0.035,
    },
  ],
});

const countdownStart = defineSequence([
  {
    sound: {
      source: { type: "triangle", frequency: 660 },
      envelope: { attack: 0.002, decay: 0.1 },
      gain: 0.13,
    },
    at: 0,
  },
  {
    sound: {
      source: { type: "sine", frequency: 990 },
      envelope: { attack: 0.002, decay: 0.16 },
      gain: 0.12,
    },
    at: 0.06,
  },
  {
    sound: {
      source: { type: "sine", frequency: 1320 },
      envelope: { attack: 0.002, decay: 0.2 },
      gain: 0.09,
    },
    at: 0.13,
  },
]);

const bubblePop = defineSound({
  layers: [
    {
      source: { type: "sine", frequency: { start: 680, end: 170 } },
      envelope: { attack: 0.001, decay: 0.085 },
      gain: 0.2,
      filter: { type: "lowpass", frequency: 1800, resonance: 0.7 },
    },
    {
      source: { type: "noise", color: "pink" },
      envelope: { attack: 0.001, decay: 0.035 },
      gain: 0.055,
      filter: { type: "highpass", frequency: 900, resonance: 0.4 },
    },
  ],
});

const bonusPop = defineSequence([
  { sound: bubblePop, at: 0 },
  {
    sound: {
      source: { type: "sine", frequency: 880 },
      envelope: { attack: 0.003, decay: 0.12 },
      gain: 0.13,
    },
    at: 0.035,
  },
  {
    sound: {
      source: { type: "sine", frequency: 1175 },
      envelope: { attack: 0.003, decay: 0.18 },
      gain: 0.11,
    },
    at: 0.095,
  },
]);

const puzzleGrab = defineSound({
  source: { type: "triangle", frequency: { start: 320, end: 470 } },
  envelope: { attack: 0.003, decay: 0.075 },
  gain: 0.14,
});

const puzzlePlace = defineSequence([
  {
    sound: {
      source: { type: "sine", frequency: 620 },
      envelope: { attack: 0.003, decay: 0.13 },
      gain: 0.15,
    },
    at: 0,
  },
  {
    sound: {
      source: { type: "sine", frequency: 930 },
      envelope: { attack: 0.003, decay: 0.18 },
      gain: 0.12,
    },
    at: 0.065,
  },
]);

const puzzleReject = defineSound({
  source: { type: "triangle", frequency: { start: 250, end: 155 } },
  envelope: { attack: 0.003, decay: 0.15 },
  gain: 0.11,
  filter: { type: "lowpass", frequency: 750 },
});

const success = defineSequence([
  {
    sound: {
      source: { type: "sine", frequency: 523 },
      envelope: { decay: 0.18 },
      gain: 0.1,
    },
    at: 0,
  },
  {
    sound: {
      source: { type: "sine", frequency: 659 },
      envelope: { decay: 0.2 },
      gain: 0.1,
    },
    at: 0.075,
  },
  {
    sound: {
      source: { type: "sine", frequency: 784 },
      envelope: { decay: 0.3 },
      gain: 0.1,
      effects: [{ type: "reverb", decay: 0.35, damping: 0.6, mix: 0.12 }],
    },
    at: 0.15,
  },
]);

const miss = defineSound({
  source: { type: "triangle", frequency: { start: 290, end: 145 } },
  envelope: { attack: 0.004, decay: 0.22 },
  gain: 0.12,
  filter: { type: "lowpass", frequency: 680 },
});

const players: Record<SoundCue, (options?: PlayOptions) => unknown> = {
  "ui-select": uiSelect,
  "ui-confirm": uiConfirm,
  "card-hover": cardHover,
  "countdown-tick": countdownTick,
  "countdown-start": countdownStart,
  "bubble-pop": bubblePop,
  "bonus-pop": bonusPop,
  "puzzle-grab": puzzleGrab,
  "puzzle-place": puzzlePlace,
  "puzzle-reject": puzzleReject,
  success,
  miss,
};

const BACKGROUND_MUSIC_SRC = "/media/Miitopia%20OST%20-%20%20Catalog.mp3";
const BACKGROUND_MUSIC_VOLUME = 0.32;

let backgroundMusic: HTMLAudioElement | null = null;

function getBackgroundMusic(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (backgroundMusic) return backgroundMusic;

  backgroundMusic = new Audio(BACKGROUND_MUSIC_SRC);
  backgroundMusic.loop = true;
  backgroundMusic.preload = "auto";
  backgroundMusic.volume = BACKGROUND_MUSIC_VOLUME;
  return backgroundMusic;
}

export async function prepareAudio(enabled: boolean): Promise<void> {
  if (!enabled || typeof window === "undefined") return;
  try {
    await ensureReady({ latencyHint: "interactive" });
    setMasterVolume(0.8);
  } catch {
    // Browsers may still reject audio until a later user gesture; playSound can retry.
  }
}

export function syncBackgroundMusic(
  enabled: boolean,
  shouldPlay: boolean,
): void {
  const music = getBackgroundMusic();
  if (!music) return;

  if (!enabled || !shouldPlay) {
    music.pause();
    return;
  }

  void music.play().catch(() => {
    // Autoplay may be blocked until the next user gesture; callers retry on clicks.
  });
}

export function playSound(
  enabled: boolean,
  cue: SoundCue,
  options?: PlayOptions,
): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    players[cue](options);
  } catch {
    // Audio is non-critical and must never interrupt a game loop.
  }
}
