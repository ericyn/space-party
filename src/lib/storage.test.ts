import { describe, expect, it } from "vitest";
import type { GameResult } from "../types";
import { DEFAULT_DATA, addResult, parseStoredData } from "./storage";

const result: GameResult = {
  gameId: "bubbles",
  score: 120,
  accuracy: 80,
  durationMs: 45_000,
  completedAt: "2026-06-24T10:00:00.000Z",
  detail: "12 bubbles popped",
};

describe("local persistence", () => {
  it("falls back safely for invalid or unknown data", () => {
    expect(parseStoredData("{nope")).toEqual(DEFAULT_DATA);
    expect(parseStoredData('{"version":2}')).toEqual(DEFAULT_DATA);
  });

  it("keeps the best score and limits result history", () => {
    let data = addResult(DEFAULT_DATA, result);
    data = addResult(data, { ...result, score: 80 });
    expect(data.bestScores.bubbles).toBe(120);
    for (let index = 0; index < 10; index += 1)
      data = addResult(data, { ...result, score: index });
    expect(data.recentResults).toHaveLength(8);
  });

  it('migrates legacy "balloons" data to "bubbles" without leaking the old key', () => {
    const stored = JSON.stringify({
      version: 1,
      bestScores: { balloons: 150, puzzle: 40, mystery: 99 },
      recentResults: [{ ...result, gameId: "balloons" }],
    });
    const parsed = parseStoredData(stored);
    expect(parsed.bestScores.bubbles).toBe(150);
    expect(parsed.bestScores.puzzle).toBe(40);
    expect("balloons" in parsed.bestScores).toBe(false);
    expect("mystery" in parsed.bestScores).toBe(false);
    expect(parsed.recentResults).toHaveLength(1);
    expect(parsed.recentResults[0].gameId).toBe("bubbles");
  });
});
