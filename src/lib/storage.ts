import type { GameId, GameResult, StoredData, StoredSettings } from "../types";

const GAME_IDS: readonly GameId[] = [
  "bubbles",
  "puzzle",
  "simon",
  "fruit",
  "draw",
  "sixseven",
];

function normalizeGameId(value: unknown): GameId | null {
  if (value === "balloons") return "bubbles";
  return GAME_IDS.includes(value as GameId) ? (value as GameId) : null;
}

export const STORAGE_KEY = "space-party:v1";
const LEGACY_STORAGE_KEY = "motion-room:v1";

export const DEFAULT_SETTINGS: StoredSettings = {
  cameraDeviceId: "",
  soundEnabled: true,
  reducedMotion: false,
};

export const DEFAULT_DATA: StoredData = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  bestScores: {},
  recentResults: [],
};

export function parseStoredData(value: string | null): StoredData {
  if (!value) return structuredClone(DEFAULT_DATA);
  try {
    const parsed = JSON.parse(value) as Partial<StoredData>;
    if (parsed.version !== 1) return structuredClone(DEFAULT_DATA);
    const bestScores: Partial<Record<GameId, number>> = {};
    for (const [key, score] of Object.entries(parsed.bestScores ?? {})) {
      const id = normalizeGameId(key);
      if (id && typeof score === "number")
        bestScores[id] = Math.max(bestScores[id] ?? 0, score);
    }
    const recentResults = Array.isArray(parsed.recentResults)
      ? parsed.recentResults
          .slice(0, 8)
          .map((result) => {
            const gameId = normalizeGameId(result?.gameId);
            return gameId ? { ...result, gameId } : null;
          })
          .filter((result): result is GameResult => result !== null)
      : [];
    return {
      version: 1,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      bestScores,
      recentResults,
    };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

export function loadStoredData(): StoredData {
  if (typeof window === "undefined") return structuredClone(DEFAULT_DATA);
  return parseStoredData(
    window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY),
  );
}

export function saveStoredData(data: StoredData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Persistence is best-effort: private-browsing modes and quota limits can
    // reject writes, and a lost save must never crash an in-progress session.
  }
}

export function addResult(data: StoredData, result: GameResult): StoredData {
  return {
    ...data,
    bestScores: {
      ...data.bestScores,
      [result.gameId]: Math.max(
        data.bestScores[result.gameId] ?? 0,
        result.score,
      ),
    },
    recentResults: [result, ...data.recentResults].slice(0, 8),
  };
}
