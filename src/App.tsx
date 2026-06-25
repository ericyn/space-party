import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CameraFlightPreview,
  CameraPreview,
  type CameraFlightRect,
} from "./components/CameraPreview";
import {
  BackIcon,
  BubbleIcon,
  CameraIcon,
  FruitIcon,
  HandIcon,
  PenIcon,
  PuzzleIcon,
  SeesawIcon,
  SoundIcon,
} from "./components/Icons";
import { GAMES, getGame } from "./data/games";
import { BubblesGame } from "./games/BubblesGame";
import { PuzzleGame } from "./games/PuzzleGame";
import { SimonGame } from "./games/SimonGame";
import { FruitSlicerGame } from "./games/FruitSlicerGame";
import { AirDrawingGame } from "./games/AirDrawingGame";
import { SixSevenGame } from "./games/SixSevenGame";
import { useCamera } from "./hooks/useCamera";
import { useCameraCalibration } from "./hooks/useCameraCalibration";
import { useHubHandCarousel } from "./hooks/useHubHandCarousel";
import { useVisionTracking } from "./hooks/useVisionTracking";
import { addResult, loadStoredData, saveStoredData } from "./lib/storage";
import { playSound, prepareAudio, syncBackgroundMusic } from "./lib/audio";
import type {
  AppView,
  GameId,
  GameResult,
  StoredData,
  TrackerMode,
} from "./types";

const FACE_WARM_VIEWS = new Set<AppView>(["instructions", "playing"]);
const RESULT_CONTENT_VARIANTS = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.08,
    },
  },
};
const RESULT_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 12, filter: "blur(3px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};
const RESULT_CONFETTI = [
  {
    x: -280,
    y: -86,
    rotate: -140,
    delay: 0,
    width: 12,
    height: 6,
    color: "var(--pink-main)",
  },
  {
    x: -228,
    y: -146,
    rotate: 112,
    delay: 0.02,
    width: 9,
    height: 9,
    color: "oklch(0.817 0.14 80.096)",
    round: true,
  },
  {
    x: -172,
    y: -106,
    rotate: -78,
    delay: 0.05,
    width: 14,
    height: 6,
    color: "oklch(0.639 0.133 252.308)",
  },
  {
    x: -126,
    y: -172,
    rotate: 166,
    delay: 0.08,
    width: 11,
    height: 5,
    color: "oklch(0.205 0 0)",
  },
  {
    x: -72,
    y: -124,
    rotate: -114,
    delay: 0.03,
    width: 10,
    height: 10,
    color: "var(--pink-lighter)",
    round: true,
  },
  {
    x: -34,
    y: -188,
    rotate: 66,
    delay: 0.06,
    width: 16,
    height: 6,
    color: "oklch(0.681 0.123 221.269)",
  },
  {
    x: 28,
    y: -154,
    rotate: -34,
    delay: 0.01,
    width: 12,
    height: 6,
    color: "var(--pink-main)",
  },
  {
    x: 82,
    y: -204,
    rotate: 142,
    delay: 0.09,
    width: 9,
    height: 9,
    color: "oklch(0.817 0.14 80.096)",
    round: true,
  },
  {
    x: 138,
    y: -132,
    rotate: -92,
    delay: 0.04,
    width: 15,
    height: 6,
    color: "oklch(0.639 0.133 252.308)",
  },
  {
    x: 194,
    y: -176,
    rotate: 84,
    delay: 0.07,
    width: 12,
    height: 5,
    color: "oklch(0.205 0 0)",
  },
  {
    x: 250,
    y: -98,
    rotate: -156,
    delay: 0.03,
    width: 10,
    height: 10,
    color: "var(--pink-light)",
    round: true,
  },
  {
    x: 302,
    y: -38,
    rotate: 124,
    delay: 0.1,
    width: 15,
    height: 6,
    color: "oklch(0.681 0.123 221.269)",
  },
  {
    x: -314,
    y: 4,
    rotate: 82,
    delay: 0.06,
    width: 13,
    height: 6,
    color: "oklch(0.639 0.133 252.308)",
  },
  {
    x: -246,
    y: 68,
    rotate: -118,
    delay: 0.1,
    width: 10,
    height: 10,
    color: "var(--pink-light)",
    round: true,
  },
  {
    x: -184,
    y: 30,
    rotate: 148,
    delay: 0.12,
    width: 14,
    height: 5,
    color: "oklch(0.817 0.14 80.096)",
  },
  {
    x: -118,
    y: 102,
    rotate: -72,
    delay: 0.14,
    width: 11,
    height: 6,
    color: "oklch(0.205 0 0)",
  },
  {
    x: -48,
    y: 56,
    rotate: 96,
    delay: 0.11,
    width: 9,
    height: 9,
    color: "var(--pink-main)",
    round: true,
  },
  {
    x: 56,
    y: 84,
    rotate: -126,
    delay: 0.13,
    width: 14,
    height: 6,
    color: "oklch(0.639 0.133 252.308)",
  },
  {
    x: 124,
    y: 44,
    rotate: 68,
    delay: 0.09,
    width: 10,
    height: 10,
    color: "oklch(0.817 0.14 80.096)",
    round: true,
  },
  {
    x: 196,
    y: 104,
    rotate: -104,
    delay: 0.15,
    width: 15,
    height: 6,
    color: "var(--pink-lighter)",
  },
  {
    x: 266,
    y: 42,
    rotate: 152,
    delay: 0.12,
    width: 12,
    height: 5,
    color: "oklch(0.681 0.123 221.269)",
  },
  {
    x: 318,
    y: 92,
    rotate: -72,
    delay: 0.16,
    width: 10,
    height: 10,
    color: "var(--pink-main)",
    round: true,
  },
] as const;

function getDigitStagger(index: number, total: number) {
  if (total < 2 || index < total - 2) return undefined;
  return index - (total - 2) + 1;
}

type WelcomeStep = "start" | "camera";

type SetupStage = {
  id: "loading" | "hand" | "face" | "expression" | "complete";
  title: string;
  body?: string;
};

type HubTitleMetrics = {
  left: number;
  top: number;
  width: number;
};

function getSetupStage(
  step: string,
  progress: number,
  trackingReady: boolean,
): SetupStage {
  if (!trackingReady) {
    return {
      id: "loading",
      title: "Downloading models.",
      body: "Getting everything ready. Everything runs on-device.",
    };
  }
  if (step === "complete") return { id: "complete", title: "You are ready." };
  if (step === "face" && progress > 0.25) {
    return { id: "expression", title: "Smile or wink." };
  }
  if (step === "face") return { id: "face", title: "Look at the camera." };
  return { id: "hand", title: "Move your hand." };
}

function SetupActionIcon({ stage }: { stage: SetupStage["id"] }) {
  if (stage === "loading") {
    return (
      <svg className="setup-loader" viewBox="0 0 96 96" aria-hidden="true">
        <circle className="setup-loader__track" cx="48" cy="48" r="38" />
        <circle className="setup-loader__bar" cx="48" cy="48" r="38" />
      </svg>
    );
  }

  if (stage === "hand") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 7.5V11M8 7.5C8 6.67157 7.32843 6 6.5 6C5.67157 6 5 6.67157 5 7.5V13.5C5 17.6421 8.35786 21 12.5 21C16.6421 21 20 17.6421 20 13.5V9C20 8.44772 19.5523 8 19 8C18.2316 8 17.5308 8.28885 17 8.76389M8 7.5V5.5C8 4.67157 8.67157 4 9.5 4C10.3284 4 11 4.67157 11 5.5M11 5.5V10M11 5.5V4.5C11 3.67157 11.6716 3 12.5 3C13.3284 3 14 3.67157 14 4.5V5.5M14 10V5.5M14 5.5C14 4.67157 14.6716 4 15.5 4C16.3284 4 17 4.67157 17 5.5V8.76389M13 16C13 14.507 13.9553 13.1816 15.3717 12.7094C15.7469 12.5844 16 12.2332 16 11.8377V11C16 10.1115 16.3863 9.31321 17 8.76389"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (stage === "expression") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M15.852 13.615C16.1785 13.56 16.4731 13.83 16.4116 14.1553C15.4438 19.2729 8.5539 19.2902 7.58792 14.1552C7.52673 13.8299 7.82136 13.56 8.14778 13.6149C9.06489 13.7693 10.7673 14.0244 12 14.0244C13.2326 14.0244 14.9349 13.7693 15.852 13.615Z"
          fill="currentColor"
        />
        <path
          d="M10.75 9.9C10.75 11.0046 10.0784 11.75 9.25 11.75C8.42157 11.75 7.75 11.0046 7.75 9.9C7.75 8.79543 8.42157 8 9.25 8C10.0784 8 10.75 8.79543 10.75 9.9Z"
          fill="currentColor"
        />
        <path
          d="M16.5 10.2461C16.5 11.5 15.6605 10.6886 14.625 10.6886C13.5895 10.6886 12.75 11.5 12.75 10.2461C12.75 9.52169 13.5895 9 14.625 9C15.6605 9 16.5 9.52169 16.5 10.2461Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.4 8H8.4V10H9.4V8ZM9.6 10C10.1523 10 10.6 9.55228 10.6 9C10.6 8.44772 10.1523 8 9.6 8V10ZM14.4 8H13.4V10H14.4V8ZM14.6 10C15.1523 10 15.6 9.55228 15.6 9C15.6 8.44772 15.1523 8 14.6 8V10ZM7.57412 12.8193C7.47434 12.2761 6.95311 11.9167 6.40991 12.0165C5.86672 12.1162 5.50725 12.6375 5.60703 13.1807L7.57412 12.8193ZM18.3927 13.1807C18.4925 12.6375 18.1331 12.1162 17.5899 12.0165C17.0467 11.9167 16.5254 12.2761 16.4257 12.8193L18.3927 13.1807ZM9 9C9 8.72386 9.22386 8.5 9.5 8.5V10.5C10.3284 10.5 11 9.82843 11 9H9ZM9.5 8.5C9.77614 8.5 10 8.72386 10 9H8C8 9.82843 8.67157 10.5 9.5 10.5V8.5ZM10 9C10 9.27614 9.77614 9.5 9.5 9.5V7.5C8.67157 7.5 8 8.17157 8 9H10ZM9.5 9.5C9.22386 9.5 9 9.27614 9 9H11C11 8.17157 10.3284 7.5 9.5 7.5V9.5ZM14 9C14 8.72386 14.2239 8.5 14.5 8.5V10.5C15.3284 10.5 16 9.82843 16 9H14ZM14.5 8.5C14.7761 8.5 15 8.72386 15 9H13C13 9.82843 13.6716 10.5 14.5 10.5V8.5ZM15 9C15 9.27614 14.7761 9.5 14.5 9.5V7.5C13.6716 7.5 13 8.17157 13 9H15ZM14.5 9.5C14.2239 9.5 14 9.27614 14 9H16C16 8.17157 15.3284 7.5 14.5 7.5V9.5ZM20 12C20 16.4183 16.4183 20 12 20V22C17.5228 22 22 17.5228 22 12H20ZM12 20C7.58172 20 4 16.4183 4 12H2C2 17.5228 6.47715 22 12 22V20ZM4 12C4 7.58172 7.58172 4 12 4V2C6.47715 2 2 6.47715 2 12H4ZM12 4C16.4183 4 20 7.58172 20 12H22C22 6.47715 17.5228 2 12 2V4ZM11.9999 16.5C9.79509 16.5 7.95876 14.9134 7.57412 12.8193L5.60703 13.1807C6.1629 16.2069 8.81255 18.5 11.9999 18.5V16.5ZM16.4257 12.8193C16.041 14.9134 14.2047 16.5 11.9999 16.5V18.5C15.1872 18.5 17.8369 16.2069 18.3927 13.1807L16.4257 12.8193ZM9.4 10H9.6V8H9.4V10ZM14.4 10H14.6V8H14.4V10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GameGlyph({ id }: { id: GameId }) {
  if (id === "bubbles") return <BubbleIcon />;
  if (id === "puzzle") return <PuzzleIcon />;
  if (id === "fruit") return <FruitIcon />;
  if (id === "draw") return <PenIcon />;
  if (id === "sixseven") return <SeesawIcon />;
  return <HandIcon />;
}

function InstructionGestureIcon({ id }: { id: GameId }) {
  if (id === "puzzle" || id === "draw") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11.6425 8.63752L15.9948 6.0406C17.437 5.18005 19.2812 5.69074 20.1139 7.18125L21.0332 8.82682C23.0235 12.3895 21.8423 16.9451 18.395 19.002C16.0776 20.3848 13.2096 20.3269 10.9462 18.8514L5.5 15.3013L5.68184 14.0674C5.84901 12.9331 6.87428 12.1536 7.97184 12.3263L9.16579 12.5143L6.15043 7.11666C5.59532 6.12298 5.92474 4.85238 6.88623 4.27868C7.84771 3.70499 9.07716 4.04544 9.63227 5.03912L11.6425 8.63752Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="round"
        />
        <path
          d="M2.5 7.75C1.83333 9.47447 1.83333 11.0255 2.5 12.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (id === "sixseven") return <SeesawIcon />;

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 9V12H16C17.6569 12 19 13.3431 19 15V16C19 18.7614 16.7614 21 14 21H13.1407C11.8033 21 10.5544 20.3316 9.81253 19.2188L7 15L7.19275 14.5181C7.6273 13.4317 8.89757 12.9488 9.94413 13.4721L10 13.5V9C10 8.17157 10.6716 7.5 11.5 7.5C12.3284 7.5 13 8.17157 13 9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.417 8C16.941 5.16229 14.473 3 11.5 3C8.18629 3 5.5 5.68629 5.5 9C5.5 9.34071 5.5284 9.67479 5.58296 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const systemReducedMotion = useReducedMotion();
  const [data, setData] = useState<StoredData>(loadStoredData);
  const [view, setView] = useState<AppView>("welcome");
  const [welcomeStep, setWelcomeStep] = useState<WelcomeStep>("start");
  const [selectedGame, setSelectedGame] = useState<GameId>("bubbles");
  const [result, setResult] = useState<GameResult | null>(null);
  const [personalBest, setPersonalBest] = useState(false);
  const [difficulty, setDifficulty] = useState<4 | 6 | 8>(4);
  const [trackerMode, setTrackerMode] = useState<TrackerMode>("off");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hoveredHubGame, setHoveredHubGame] = useState<GameId | null>(null);
  const [hubFade, setHubFade] = useState({ left: false, right: false });
  const [hubTitleMetrics, setHubTitleMetrics] =
    useState<HubTitleMetrics | null>(null);
  const [documentPaused, setDocumentPaused] = useState(document.hidden);
  const [cameraFlightRect, setCameraFlightRect] =
    useState<CameraFlightRect | null>(null);
  const cameraFlying = cameraFlightRect !== null;
  const cameraDockRef = useRef<HTMLDivElement>(null);
  const cameraPreviewRef = useRef<HTMLDivElement>(null);
  const permissionCircleRef = useRef<HTMLButtonElement>(null);
  const hubScreenRef = useRef<HTMLElement>(null);
  const gameCarouselRef = useRef<HTMLDivElement>(null);
  const lastHubPreviewSoundRef = useRef<GameId | null>(null);
  const gameCardRefs = useRef<
    Partial<Record<GameId, HTMLButtonElement | null>>
  >({});
  const shouldReduceMotion =
    data.settings.reducedMotion || Boolean(systemReducedMotion);
  const isCountdownActive = view === "instructions" && countdown !== null;

  useEffect(() => {
    saveStoredData(data);
  }, [data]);

  useEffect(() => {
    syncBackgroundMusic(
      data.settings.soundEnabled,
      view !== "playing" && !isCountdownActive,
    );
  }, [data.settings.soundEnabled, isCountdownActive, view]);

  const updateCameraId = useCallback((cameraDeviceId: string) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, cameraDeviceId },
    }));
  }, []);

  const camera = useCamera(data.settings.cameraDeviceId, updateCameraId);
  const game = useMemo(() => getGame(selectedGame), [selectedGame]);
  const warmFace =
    view === "setup" ||
    (FACE_WARM_VIEWS.has(view) &&
      (selectedGame === "simon" || game.tracker === "face"));
  const tracking = useVisionTracking(
    camera.videoRef,
    camera.stream,
    trackerMode,
    warmFace,
  );
  const calibration = useCameraCalibration({
    active: view === "setup",
    resetKey: camera.stream,
    tracking: tracking.latestFrame,
    onTrackerModeChange: setTrackerMode,
  });

  useEffect(() => {
    const onVisibility = () => setDocumentPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!isCountdownActive || documentPaused) return;
    const timer = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
        return;
      }

      setCountdown(null);
      setView("playing");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, documentPaused, isCountdownActive]);

  useEffect(() => {
    if (!isCountdownActive || documentPaused) return;
    playSound(
      data.settings.soundEnabled,
      countdown > 1 ? "countdown-tick" : "countdown-start",
    );
  }, [countdown, data.settings.soundEnabled, documentPaused, isCountdownActive]);

  useEffect(() => {
    if (view === "hub" && !cameraFlying) setTrackerMode("hand");
  }, [cameraFlying, view]);

  useEffect(() => {
    if (view !== "hub") setHoveredHubGame(null);
  }, [view]);

  useEffect(() => {
    if (view !== "hub") {
      setHubFade({ left: false, right: false });
      return;
    }

    const carousel = gameCarouselRef.current;
    if (!carousel) return;

    let frame = 0;
    const syncFade = () => {
      frame = 0;
      const maxScroll = carousel.scrollWidth - carousel.clientWidth;
      const next = {
        left: carousel.scrollLeft > 2,
        right: maxScroll > 2 && carousel.scrollLeft < maxScroll - 2,
      };
      setHubFade((current) =>
        current.left === next.left && current.right === next.right
          ? current
          : next,
      );
    };
    const syncSoon = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncFade);
    };

    syncFade();
    carousel.addEventListener("scroll", syncSoon, { passive: true });
    window.addEventListener("resize", syncSoon);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncSoon);
    observer?.observe(carousel);
    if (carousel.firstElementChild) observer?.observe(carousel.firstElementChild);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      carousel.removeEventListener("scroll", syncSoon);
      window.removeEventListener("resize", syncSoon);
      observer?.disconnect();
    };
  }, [view]);

  useEffect(() => {
    if (view !== "setup" || calibration.step !== "complete") return;
    playSound(data.settings.soundEnabled, "ui-confirm");
    const timer = window.setTimeout(
      () => {
        if (shouldReduceMotion) {
          setCameraFlightRect(null);
          setView("hub");
          return;
        }

        const rect = cameraPreviewRef.current?.getBoundingClientRect();
        setCameraFlightRect(
          rect
            ? {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }
            : null,
        );
        setView("hub");
      },
      shouldReduceMotion ? 40 : 420,
    );
    return () => window.clearTimeout(timer);
  }, [calibration.step, data.settings.soundEnabled, shouldReduceMotion, view]);

  const updateSettings = useCallback(
    (updates: Partial<StoredData["settings"]>) => {
      setData((current) => ({
        ...current,
        settings: { ...current.settings, ...updates },
      }));
    },
    [],
  );

  const beginCamera = useCallback(async () => {
    const sourceRect = permissionCircleRef.current?.getBoundingClientRect();
    const started = await camera.start();
    if (started) {
      setCameraFlightRect(
        sourceRect && !shouldReduceMotion
          ? {
              left: sourceRect.left,
              top: sourceRect.top,
              width: sourceRect.width,
              height: sourceRect.height,
            }
          : null,
      );
      setTrackerMode("hand");
      setView("setup");
    }
  }, [camera, shouldReduceMotion]);

  const activateWelcomeCircle = useCallback(() => {
    if (welcomeStep === "start") {
      void prepareAudio(data.settings.soundEnabled);
      syncBackgroundMusic(data.settings.soundEnabled, true);
      playSound(data.settings.soundEnabled, "ui-select");
      setWelcomeStep("camera");
      return;
    }

    void beginCamera();
  }, [beginCamera, data.settings.soundEnabled, welcomeStep]);

  const openInstructions = useCallback(
    (id: GameId, tone: "select" | "confirm" = "select") => {
      const selected = getGame(id);
      const rect = cameraPreviewRef.current?.getBoundingClientRect();
      void prepareAudio(data.settings.soundEnabled);
      syncBackgroundMusic(data.settings.soundEnabled, false);
      playSound(
        data.settings.soundEnabled,
        tone === "confirm" ? "ui-confirm" : "ui-select",
      );
      setSelectedGame(id);
      setResult(null);
      setTrackerMode(selected.tracker);
      setCountdown(5);
      setCameraFlightRect(
        rect && view === "hub" && !shouldReduceMotion
          ? {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }
          : null,
      );
      setView("instructions");
    },
    [data.settings.soundEnabled, shouldReduceMotion, view],
  );

  const chooseGame = useCallback(
    (id: GameId) => {
      openInstructions(id, "confirm");
    },
    [openInstructions],
  );

  const previewHubGame = useCallback(
    (id: GameId) => {
      setHoveredHubGame(id);
      if (lastHubPreviewSoundRef.current === id) return;
      lastHubPreviewSoundRef.current = id;
      playSound(data.settings.soundEnabled, "card-hover");
    },
    [data.settings.soundEnabled],
  );

  const clearHubGamePreview = useCallback((id: GameId) => {
    setHoveredHubGame((current) => (current === id ? null : current));
    lastHubPreviewSoundRef.current = null;
  }, []);

  const startGameFromHub = useCallback(
    (id: GameId) => {
      openInstructions(id, "confirm");
    },
    [openInstructions],
  );

  const finishGame = useCallback(
    (nextResult: GameResult) => {
      playSound(data.settings.soundEnabled, "success");
      setResult(nextResult);
      setPersonalBest(
        nextResult.score > (data.bestScores[nextResult.gameId] ?? 0),
      );
      setData((current) => addResult(current, nextResult));
      setTrackerMode("hand");
      setView("results");
    },
    [data.bestScores, data.settings.soundEnabled],
  );

  const returnToHub = useCallback(() => {
    playSound(data.settings.soundEnabled, "ui-select", { detune: -120 });
    setCountdown(null);
    setCameraFlightRect(null);
    setTrackerMode("hand");
    setView("hub");
  }, [data.settings.soundEnabled]);

  const stopCamera = useCallback(() => {
    camera.stop();
    setTrackerMode("off");
    setCountdown(null);
    setCameraFlightRect(null);
    setWelcomeStep("start");
    setView("welcome");
  }, [camera]);

  const finishCameraFlight = useCallback(() => {
    setCameraFlightRect(null);
  }, []);

  const showShell = view !== "welcome";
  const showHeader =
    showShell &&
    view !== "hub" &&
    view !== "setup" &&
    view !== "instructions" &&
    view !== "playing";
  const showInlineGameCamera = view === "playing" && selectedGame === "sixseven";
  const showCamera = Boolean(camera.stream) && showShell;
  const trackingMessage = tracking.error || camera.error;
  const handCarousel = useHubHandCarousel({
    active: view === "hub" && !cameraFlying && trackerMode === "hand",
    tracking: tracking.latestFrame,
    cardRefs: gameCardRefs,
    carouselRef: gameCarouselRef,
    onSelect: startGameFromHub,
  });
  const hubFocusedGameId = handCarousel.targetId ?? hoveredHubGame;
  const hubFocusedGame = hubFocusedGameId ? getGame(hubFocusedGameId) : null;
  const setupTrackingLoading =
    view === "setup" &&
    calibration.step === "hand" &&
    (!tracking.ready || tracking.quality === "loading");
  const setupStage = getSetupStage(
    calibration.step,
    calibration.progress,
    !setupTrackingLoading,
  );
  const setupMotion = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };
  const hubTitleStyle = hubTitleMetrics
    ? ({
        "--hub-title-left": `${hubTitleMetrics.left}px`,
        "--hub-title-anchor-y": `${hubTitleMetrics.top}px`,
        "--hub-title-width": `${hubTitleMetrics.width}px`,
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (view !== "hub") return;
    if (!handCarousel.targetId) {
      if (!hoveredHubGame) lastHubPreviewSoundRef.current = null;
      return;
    }

    if (lastHubPreviewSoundRef.current === handCarousel.targetId) return;
    lastHubPreviewSoundRef.current = handCarousel.targetId;
    playSound(data.settings.soundEnabled, "card-hover");
  }, [
    data.settings.soundEnabled,
    handCarousel.targetId,
    hoveredHubGame,
    view,
  ]);

  useLayoutEffect(() => {
    if (view !== "hub" || !hubFocusedGameId) {
      setHubTitleMetrics(null);
      return;
    }

    const screen = hubScreenRef.current;
    const carousel = gameCarouselRef.current;
    const card = gameCardRefs.current[hubFocusedGameId];
    if (!screen || !card) {
      setHubTitleMetrics(null);
      return;
    }

    let frame = 0;
    const syncTitle = () => {
      frame = 0;
      const screenRect = screen.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const next = {
        left: cardRect.left + cardRect.width / 2 - screenRect.left,
        top: cardRect.top - screenRect.top - 14,
        width: cardRect.width,
      };

      setHubTitleMetrics((current) =>
        current &&
        Math.abs(current.left - next.left) < 0.5 &&
        Math.abs(current.top - next.top) < 0.5 &&
        Math.abs(current.width - next.width) < 0.5
          ? current
          : next,
      );
    };
    const syncSoon = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncTitle);
    };

    syncTitle();
    carousel?.addEventListener("scroll", syncSoon, { passive: true });
    window.addEventListener("resize", syncSoon);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncSoon);
    observer?.observe(screen);
    observer?.observe(card);
    if (carousel) observer?.observe(carousel);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      carousel?.removeEventListener("scroll", syncSoon);
      window.removeEventListener("resize", syncSoon);
      observer?.disconnect();
    };
  }, [hubFocusedGameId, view]);

  return (
    <div
      className={`app app--${view} ${shouldReduceMotion ? "reduce-motion" : ""}`}
    >
      <div className="ambient-shape ambient-shape--one" />
      <div className="ambient-shape ambient-shape--two" />

      {showHeader ? (
        <header className="app-header">
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() =>
                updateSettings({ soundEnabled: !data.settings.soundEnabled })
              }
              aria-label={
                data.settings.soundEnabled
                  ? "Mute sound effects"
                  : "Turn on sound effects"
              }
              aria-pressed={!data.settings.soundEnabled}
            >
              <SoundIcon muted={!data.settings.soundEnabled} />
            </button>
            <button className="quiet-button" onClick={stopCamera}>
              <CameraIcon /> Stop camera
            </button>
          </div>
        </header>
      ) : null}

      {showCamera ? (
        <>
          <div
            ref={cameraDockRef}
            className="camera-dock-target"
            aria-hidden="true"
          />
          {view === "results" && !shouldReduceMotion ? (
            <div className="result-confetti" aria-hidden="true">
              {RESULT_CONFETTI.map((piece, index) => (
                <span
                  key={index}
                  className={`result-confetti__piece ${
                    "round" in piece ? "result-confetti__piece--round" : ""
                  }`}
                  style={
                    {
                      "--confetti-x": `${piece.x}px`,
                      "--confetti-y": `${piece.y}px`,
                      "--confetti-rotate": `${piece.rotate}deg`,
                      "--confetti-delay": `${piece.delay}s`,
                      "--confetti-width": `${piece.width}px`,
                      "--confetti-height": `${piece.height}px`,
                      "--confetti-color": piece.color,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ) : null}
          <CameraPreview
            containerRef={cameraPreviewRef}
            videoRef={camera.videoRef}
            stream={camera.stream!}
            large={view === "setup"}
            hidden={cameraFlying || showInlineGameCamera}
          />
          {isCountdownActive && !cameraFlying ? (
            <div
              key={`camera-countdown-${countdown}`}
              className="camera-countdown"
              role="status"
              aria-live="assertive"
            >
              <span className="camera-countdown__eyebrow">Get ready</span>
              <strong
                key={countdown}
                className="camera-countdown__number t-digit-group is-animating"
                aria-label={`${countdown}`}
              >
                <span className="t-digit" aria-hidden="true">
                  {countdown}
                </span>
              </strong>
            </div>
          ) : null}
          {cameraFlightRect ? (
            <CameraFlightPreview
              stream={camera.stream!}
              fromRect={cameraFlightRect}
              reducedMotion={shouldReduceMotion}
              dockRef={cameraDockRef}
              onFlightComplete={finishCameraFlight}
            />
          ) : null}
        </>
      ) : null}

      {trackingMessage && showShell ? (
        <div className="system-alert" role="alert">
          {trackingMessage}
        </div>
      ) : null}
      {documentPaused && (view === "playing" || isCountdownActive) ? (
        <div className="pause-overlay">
          <div>
            <strong>Game paused</strong>
            <span>Return to this tab when you are ready.</span>
          </div>
        </div>
      ) : null}
      {view === "hub" && handCarousel.point ? (
        <div
          className={`hand-cursor ${handCarousel.dragging ? "hand-cursor--dragging" : ""}`}
          style={{
            left: handCarousel.point.x,
            top: handCarousel.point.y,
          }}
          aria-hidden="true"
        />
      ) : null}

      <main className="app-main">
        {view === "welcome" ? (
          <section
            className="welcome-screen welcome-screen--minimal"
            aria-label={
              welcomeStep === "start"
                ? "Start Space Party"
                : "Camera permission"
            }
          >
            {camera.error && welcomeStep === "camera" ? (
              <div className="permission-error" role="alert">
                {camera.error}
              </div>
            ) : null}
            <button
              ref={permissionCircleRef}
              className={`permission-circle welcome-start-circle welcome-start-circle--${welcomeStep}`}
              onClick={activateWelcomeCircle}
              disabled={camera.state === "requesting"}
              aria-label={
                welcomeStep === "start"
                  ? "Start Space Party"
                  : camera.state === "requesting"
                    ? "Opening camera"
                    : "Allow camera and continue"
              }
            >
              <span
                className="welcome-circle-pages t-page-slide"
                data-page={welcomeStep === "start" ? "1" : "2"}
                aria-hidden="true"
              >
                <span className="welcome-circle-page t-page" data-page-id="1">
                  <span className="welcome-circle-title">Start</span>
                </span>
                <span className="welcome-circle-page t-page" data-page-id="2">
                  <CameraIcon />
                  <span className="welcome-circle-title">
                    {camera.state === "requesting"
                      ? "Opening camera"
                      : "Allow camera"}
                  </span>
                </span>
              </span>
            </button>
          </section>
        ) : null}

        {view === "setup" ? (
          <section className="setup-screen">
            <div className="setup-copy">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={setupStage.id}
                  className={`setup-action setup-action--${setupStage.id}`}
                  role="status"
                  aria-live="polite"
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, y: 10, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, filter: "blur(2px)" }
                  }
                  transition={setupMotion}
                >
                  <span className="setup-action__icon">
                    <SetupActionIcon stage={setupStage.id} />
                  </span>
                  <h1>{setupStage.title}</h1>
                  {setupStage.body ? <p>{setupStage.body}</p> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        ) : null}

        {view === "hub" ? (
          <section
            className="hub-screen"
            ref={hubScreenRef}
            aria-busy={cameraFlying}
          >
            <div
              className={`hub-card-title ${hubFocusedGame && hubTitleMetrics ? "is-visible" : ""}`}
              style={hubTitleStyle}
              aria-hidden="true"
            >
              <span className="hub-card-title__frame">
                <span className="hub-card-title__text">
                  {hubFocusedGame?.title}
                </span>
              </span>
            </div>
            <div
              className={`game-carousel ${hubFade.left ? "has-left-fade" : ""} ${hubFade.right ? "has-right-fade" : ""}`}
              ref={gameCarouselRef}
            >
              <div className="game-grid">
                {GAMES.map((item) => (
                  <button
                    ref={(element) => {
                      gameCardRefs.current[item.id] = element;
                    }}
                    className={`game-card game-card--${item.id} ${hubFocusedGameId === item.id ? "game-card--hand" : ""}`}
                    key={item.id}
                    aria-label={item.title}
                    onClick={() => chooseGame(item.id)}
                    onBlur={() => clearHubGamePreview(item.id)}
                    onFocus={() => previewHubGame(item.id)}
                    onPointerEnter={() => previewHubGame(item.id)}
                    onPointerLeave={() => clearHubGamePreview(item.id)}
                    disabled={cameraFlying}
                  >
                    {item.coverImage ? (
                      <span className="game-card__cover" aria-hidden="true">
                        <img src={item.coverImage} alt="" loading="eager" />
                      </span>
                    ) : (
                      <span className="game-card__icon" aria-hidden="true">
                        <GameGlyph id={item.id} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="hub-navigation-hint" aria-label="How to navigate">
              <span>How to navigate</span>
              <strong>Pinch or use two fingers to scroll.</strong>
              <strong>Open palm push to choose.</strong>
            </div>
          </section>
        ) : null}

        {view === "instructions" ? (
          <section
            className={`instructions-screen instructions-screen--${selectedGame} ${
              isCountdownActive ? "instructions-screen--countdown" : ""
            }`}
            aria-busy={isCountdownActive}
          >
            <button
              className="back-button instructions-back"
              onClick={returnToHub}
            >
              <BackIcon /> All games
            </button>
            <div className="instruction-copy">
              <span
                className={`instruction-gesture instruction-gesture--${selectedGame}`}
              >
                <InstructionGestureIcon id={selectedGame} />
              </span>
              <h1>{game.title}</h1>
              <p>{game.instruction}</p>
              {selectedGame === "puzzle" ? (
                <fieldset className="difficulty-picker">
                  <legend>Choose puzzle size</legend>
                  {([4, 6, 8] as const).map((value) => (
                    <button
                      key={value}
                      className={difficulty === value ? "selected" : ""}
                      onClick={() => setDifficulty(value)}
                      aria-pressed={difficulty === value}
                    >
                      {value}
                      <span>pieces</span>
                    </button>
                  ))}
                </fieldset>
              ) : null}
            </div>
          </section>
        ) : null}

        {view === "playing" ? (
          <section className="playing-screen">
            <button className="game-exit" onClick={returnToHub}>
              <BackIcon /> Leave game
            </button>
            <>
                {selectedGame === "bubbles" ? (
                  <BubblesGame
                    tracking={tracking.latestFrame}
                    paused={documentPaused}
                    soundEnabled={data.settings.soundEnabled}
                    reducedMotion={data.settings.reducedMotion}
                    onFinish={finishGame}
                  />
                ) : null}
                {selectedGame === "puzzle" ? (
                  <PuzzleGame
                    tracking={tracking.latestFrame}
                    difficulty={difficulty}
                    paused={documentPaused}
                    soundEnabled={data.settings.soundEnabled}
                    reducedMotion={data.settings.reducedMotion}
                    onFinish={finishGame}
                  />
                ) : null}
                {selectedGame === "simon" ? (
                  <SimonGame
                    tracking={tracking.latestFrame}
                    paused={documentPaused}
                    soundEnabled={data.settings.soundEnabled}
                    onTrackerModeChange={setTrackerMode}
                    onFinish={finishGame}
                  />
                ) : null}
                {selectedGame === "fruit" ? (
                  <FruitSlicerGame
                    tracking={tracking.latestFrame}
                    paused={documentPaused}
                    soundEnabled={data.settings.soundEnabled}
                    reducedMotion={data.settings.reducedMotion}
                    onFinish={finishGame}
                  />
                ) : null}
                {selectedGame === "draw" ? (
                  <AirDrawingGame
                    tracking={tracking.latestFrame}
                    paused={documentPaused}
                    soundEnabled={data.settings.soundEnabled}
                    onFinish={finishGame}
                  />
                ) : null}
                {selectedGame === "sixseven" ? (
                  <SixSevenGame
                    stream={camera.stream}
                    tracking={tracking.latestFrame}
                    paused={documentPaused}
                    soundEnabled={data.settings.soundEnabled}
                    reducedMotion={data.settings.reducedMotion}
                    onFinish={finishGame}
                  />
                ) : null}
            </>
          </section>
        ) : null}

        {view === "results" && result ? (
          <motion.section
            key={`${result.gameId}-${result.score}-${result.detail}`}
            className="center-screen results-screen"
            variants={shouldReduceMotion ? undefined : RESULT_CONTENT_VARIANTS}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={shouldReduceMotion ? undefined : "show"}
          >
            <motion.div
              className="eyebrow"
              variants={shouldReduceMotion ? undefined : RESULT_ITEM_VARIANTS}
            >
              Round complete
            </motion.div>
            <motion.h1
              variants={shouldReduceMotion ? undefined : RESULT_ITEM_VARIANTS}
            >
              {personalBest ? "A new personal best!" : "Nicely played!"}
            </motion.h1>
            <motion.div
              className="result-score"
              variants={shouldReduceMotion ? undefined : RESULT_ITEM_VARIANTS}
            >
              <span>Score</span>
              <strong
                className="result-score-value t-digit-group is-animating"
                aria-label={`${result.score}`}
              >
                {String(result.score)
                  .split("")
                  .map((digit, index, digits) => (
                    <span
                      key={`${digit}-${index}`}
                      className="t-digit"
                      data-stagger={getDigitStagger(index, digits.length)}
                      aria-hidden="true"
                    >
                      {digit}
                    </span>
                  ))}
              </strong>
            </motion.div>
            <motion.div
              className="result-details"
              variants={shouldReduceMotion ? undefined : RESULT_ITEM_VARIANTS}
            >
              <div>
                <strong>{result.accuracy}%</strong>
                <span>Accuracy</span>
              </div>
              <div>
                <strong>{result.detail}</strong>
                <span>Round result</span>
              </div>
            </motion.div>
            <motion.div
              className="result-actions"
              variants={shouldReduceMotion ? undefined : RESULT_ITEM_VARIANTS}
            >
              <button
                className="primary-button"
                onClick={() => openInstructions(result.gameId, "confirm")}
              >
                Play again
              </button>
              <button className="secondary-button" onClick={returnToHub}>
                Choose another game
              </button>
            </motion.div>
          </motion.section>
        ) : null}
      </main>
    </div>
  );
}
