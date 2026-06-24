export interface StableSignal {
  startedAt: number;
  progress: number;
  complete: boolean;
}

export function advanceStableSignal(
  startedAt: number,
  matches: boolean,
  now: number,
  requiredMs = 350,
): StableSignal {
  if (!matches) return { startedAt: 0, progress: 0, complete: false };
  const nextStartedAt = startedAt || now;
  const progress = Math.min(1, (now - nextStartedAt) / requiredMs);
  return { startedAt: nextStartedAt, progress, complete: progress >= 1 };
}

export function bubblePoints(bonus: boolean, combo: number): number {
  return bonus ? 50 : 10 * Math.min(Math.max(combo, 1), 5);
}

export function puzzleScore(
  elapsedMs: number,
  unnecessaryGrabs: number,
  placedCount: number,
): number {
  return Math.max(
    0,
    Math.round(
      1000 - elapsedMs / 180 - unnecessaryGrabs * 25 + placedCount * 50,
    ),
  );
}
