export type AppView =
  | "welcome"
  | "setup"
  | "hub"
  | "instructions"
  | "playing"
  | "results";

export type GameId =
  | "bubbles"
  | "puzzle"
  | "simon"
  | "fruit"
  | "flap"
  | "draw"
  | "sixseven";
export type TrackerMode = "hand" | "face" | "off";
export type TrackingQuality =
  | "loading"
  | "good"
  | "searching"
  | "poor-light"
  | "error";

export interface Point {
  x: number;
  y: number;
}

export interface HandTracking {
  pointer: Point;
  index: Point;
  middle: Point;
  thumb: Point;
  twoFinger: boolean;
  pinch: boolean;
  pinchRatio: number;
  tap: boolean;
  tapStrength: number;
  gesture: string | null;
  gestureScore: number;
  handedness: string | null;
}

export interface FaceTracking {
  smile: number;
  jawOpen: number;
  browRaise: number;
  aim?: Point | null;
}

export interface HandSample {
  point: Point;
  wrist: Point;
  thumb: Point;
  index: Point;
  middle: Point;
  pinky: Point;
  tap: boolean;
  tapStrength: number;
  handedness: string | null;
}

export interface TrackingFrame {
  timestamp: number;
  mode: TrackerMode;
  quality: TrackingQuality;
  hand: HandTracking | null;
  hands: HandSample[];
  face: FaceTracking | null;
  inferenceMs: number;
}

export interface GameResult {
  gameId: GameId;
  score: number;
  accuracy: number;
  durationMs: number;
  completedAt: string;
  detail: string;
}

export interface StoredSettings {
  cameraDeviceId: string;
  soundEnabled: boolean;
  reducedMotion: boolean;
}

export interface StoredData {
  version: 1;
  settings: StoredSettings;
  bestScores: Partial<Record<GameId, number>>;
  recentResults: GameResult[];
}

export interface GameModule {
  id: GameId;
  title: string;
  shortTitle: string;
  description: string;
  instruction: string;
  tracker: TrackerMode;
  durationLabel: string;
  accent: string;
}

export type VisionWorkerInMessage =
  | { type: "init"; baseUrl: string }
  | { type: "warm-face" }
  | { type: "set-mode"; mode: TrackerMode }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number };

export type VisionWorkerOutMessage =
  | { type: "ready"; mode: TrackerMode }
  | { type: "result"; frame: TrackingFrame }
  | { type: "error"; message: string };
