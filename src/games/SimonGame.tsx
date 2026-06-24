import { useEffect, useMemo, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import { advanceStableSignal } from "../lib/gameLogic";
import type {
  FaceTracking,
  GameResult,
  TrackerMode,
  TrackingFrame,
} from "../types";

type SimonTarget =
  | "Open_Palm"
  | "Closed_Fist"
  | "Victory"
  | "Thumb_Up"
  | "smile"
  | "jawOpen"
  | "browRaise";

interface SimonPrompt {
  detector: Exclude<TrackerMode, "off">;
  target: SimonTarget;
  label: string;
  emoji: string;
  simon: boolean;
}

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  onTrackerModeChange: (mode: TrackerMode) => void;
  onFinish: (result: GameResult) => void;
}

const GESTURES: Omit<SimonPrompt, "simon">[] = [
  {
    detector: "hand",
    target: "Open_Palm",
    label: "Show an open palm",
    emoji: "✋",
  },
  {
    detector: "hand",
    target: "Closed_Fist",
    label: "Make a gentle fist",
    emoji: "✊",
  },
  {
    detector: "hand",
    target: "Victory",
    label: "Make a victory sign",
    emoji: "✌️",
  },
  {
    detector: "hand",
    target: "Thumb_Up",
    label: "Give a thumbs up",
    emoji: "👍",
  },
  { detector: "face", target: "smile", label: "Show a big smile", emoji: "😊" },
  {
    detector: "face",
    target: "jawOpen",
    label: "Open your mouth",
    emoji: "😮",
  },
  {
    detector: "face",
    target: "browRaise",
    label: "Raise your eyebrows",
    emoji: "🤨",
  },
];

function createPrompts(): SimonPrompt[] {
  const prompts: SimonPrompt[] = [];
  for (let index = 0; index < 12; index += 1) {
    const gesture =
      GESTURES[
        (index * 3 + Math.floor(Math.random() * GESTURES.length)) %
          GESTURES.length
      ];
    prompts.push({ ...gesture, simon: index < 2 || Math.random() > 0.32 });
  }
  return prompts;
}

function faceMatches(
  target: SimonTarget,
  face: FaceTracking,
  neutral: FaceTracking,
): boolean {
  if (target === "smile")
    return face.smile > 0.48 && face.smile - neutral.smile > 0.18;
  if (target === "jawOpen")
    return face.jawOpen > 0.48 && face.jawOpen - neutral.jawOpen > 0.2;
  if (target === "browRaise")
    return face.browRaise > 0.38 && face.browRaise - neutral.browRaise > 0.13;
  return false;
}

export function SimonGame({
  tracking,
  paused,
  soundEnabled,
  onTrackerModeChange,
  onFinish,
}: Props) {
  const prompts = useMemo(createPrompts, []);
  const pausedRef = useRef(paused);
  const finishRef = useRef(onFinish);
  const modeRef = useRef(onTrackerModeChange);
  const soundRef = useRef(soundEnabled);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<"ready" | "active" | "success" | "miss">(
    "ready",
  );
  const [holdProgress, setHoldProgress] = useState(0);
  const [message, setMessage] = useState("Get ready");

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    modeRef.current = onTrackerModeChange;
  }, [onTrackerModeChange]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  const prompt = prompts[round - 1];

  useEffect(() => {
    let index = 0;
    let current = prompts[index];
    let currentPhase: "ready" | "active" | "success" | "miss" = "ready";
    let phaseStarted = performance.now();
    const gameStarted = phaseStarted;
    let stableStarted = 0;
    let pauseStarted = 0;
    let scoreValue = 0;
    let correct = 0;
    let livesValue = 3;
    let finished = false;
    let neutral: FaceTracking = { smile: 0, jawOpen: 0, browRaise: 0 };
    let neutralSamples = 0;

    modeRef.current(current.detector);

    const complete = (now: number) => {
      if (finished) return;
      finished = true;
      finishRef.current({
        gameId: "simon",
        score: scoreValue,
        accuracy: Math.round((correct / Math.max(index + 1, 1)) * 100),
        durationMs: now - gameStarted,
        completedAt: new Date().toISOString(),
        detail: `${correct} of ${index + 1} prompts correct`,
      });
    };

    const resolveRound = (success: boolean, now: number) => {
      stableStarted = 0;
      setHoldProgress(0);
      if (success) {
        correct += 1;
        const activeFor = now - phaseStarted;
        scoreValue +=
          100 +
          Math.max(0, Math.round((current.simon ? 3500 - activeFor : 0) / 35));
        setScore(scoreValue);
        setPhase("success");
        setMessage(current.simon ? "Well done!" : "Good listening!");
        currentPhase = "success";
        playSound(soundRef.current, "success");
      } else {
        livesValue -= 1;
        setLives(livesValue);
        setPhase("miss");
        setMessage(
          current.simon ? "Try the gesture next time" : "Simon did not say!",
        );
        currentPhase = "miss";
        playSound(soundRef.current, "miss");
      }
      phaseStarted = now;
    };

    const moveNext = (now: number) => {
      if (livesValue <= 0 || index >= prompts.length - 1) {
        complete(now);
        return;
      }
      index += 1;
      current = prompts[index];
      neutral = { smile: 0, jawOpen: 0, browRaise: 0 };
      neutralSamples = 0;
      currentPhase = "ready";
      phaseStarted = now;
      setRound(index + 1);
      setPhase("ready");
      setMessage("Return to neutral");
      modeRef.current(current.detector);
    };

    const timer = window.setInterval(() => {
      if (finished) return;
      const now = performance.now();
      if (pausedRef.current) {
        if (!pauseStarted) pauseStarted = now;
        return;
      }
      if (pauseStarted) {
        phaseStarted += now - pauseStarted;
        if (stableStarted) stableStarted += now - pauseStarted;
        pauseStarted = 0;
      }

      const frame = tracking.current;
      if (currentPhase === "ready") {
        const face = frame?.face;
        if (current.detector === "face" && face) {
          neutralSamples += 1;
          neutral.smile += (face.smile - neutral.smile) / neutralSamples;
          neutral.jawOpen += (face.jawOpen - neutral.jawOpen) / neutralSamples;
          neutral.browRaise +=
            (face.browRaise - neutral.browRaise) / neutralSamples;
        }
        if (now - phaseStarted >= 900) {
          currentPhase = "active";
          phaseStarted = now;
          setPhase("active");
          setMessage(current.simon ? "Simon says…" : "Careful…");
        }
        return;
      }

      if (currentPhase === "success" || currentPhase === "miss") {
        if (now - phaseStarted >= 750) moveNext(now);
        return;
      }

      let matches = false;
      if (current.detector === "hand") {
        matches =
          frame?.mode === "hand" &&
          frame.hand?.gesture === current.target &&
          frame.hand.gestureScore >= 0.58;
      } else if (frame?.mode === "face" && frame.face) {
        matches = faceMatches(current.target, frame.face, neutral);
      }

      const stable = advanceStableSignal(stableStarted, matches, now);
      stableStarted = stable.startedAt;
      setHoldProgress(stable.progress);
      if (stable.complete) {
        resolveRound(current.simon, now);
        return;
      }

      const responseWindow = current.simon ? 3500 : 2000;
      if (now - phaseStarted >= responseWindow)
        resolveRound(!current.simon, now);
    }, 50);

    return () => window.clearInterval(timer);
  }, [prompts, tracking]);

  return (
    <div className="simon-stage">
      <div className="game-hud" aria-live="polite">
        <div>
          <span>Round</span>
          <strong>{round}/12</strong>
        </div>
        <div className="lives" aria-label={`${lives} lives remaining`}>
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className={index < lives ? "" : "lost"}>
              ♥
            </span>
          ))}
        </div>
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
      </div>
      <div className={`simon-card simon-card--${phase}`}>
        <div className="simon-card__eyebrow">{message}</div>
        <div className="simon-card__emoji" aria-hidden="true">
          {prompt.emoji}
        </div>
        <h2>
          {prompt.simon
            ? `Simon says: ${prompt.label.toLowerCase()}`
            : prompt.label}
        </h2>
        <p>{prompt.detector === "hand" ? "Hand gesture" : "Face gesture"}</p>
        <div
          className="hold-meter"
          aria-label={`Gesture hold progress ${Math.round(holdProgress * 100)} percent`}
        >
          <span style={{ transform: `scaleX(${holdProgress})` }} />
        </div>
      </div>
      <p className="simon-help">
        Hold the gesture until the meter fills. If Simon did not say, stay
        neutral.
      </p>
    </div>
  );
}
