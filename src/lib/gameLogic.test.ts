import { describe, expect, it } from "vitest";
import { advanceStableSignal, bubblePoints, puzzleScore } from "./gameLogic";

describe("game logic", () => {
  it("requires a continuous 350ms signal for Simon", () => {
    const started = advanceStableSignal(0, true, 1000);
    expect(started.progress).toBe(0);
    const partial = advanceStableSignal(started.startedAt, true, 1200);
    expect(partial.complete).toBe(false);
    expect(partial.progress).toBeCloseTo(200 / 350);
    expect(advanceStableSignal(partial.startedAt, false, 1250)).toEqual({
      startedAt: 0,
      progress: 0,
      complete: false,
    });
    expect(advanceStableSignal(started.startedAt, true, 1350).complete).toBe(
      true,
    );
  });

  it("caps bubble combo points and keeps bonuses fixed", () => {
    expect(bubblePoints(false, 1)).toBe(10);
    expect(bubblePoints(false, 8)).toBe(50);
    expect(bubblePoints(true, 1)).toBe(50);
  });

  it("rewards completed puzzle pieces and penalizes wasted grabs", () => {
    expect(puzzleScore(10_000, 0, 4)).toBeGreaterThan(
      puzzleScore(10_000, 2, 4),
    );
    expect(puzzleScore(10_000, 0, 8)).toBeGreaterThan(
      puzzleScore(10_000, 0, 4),
    );
    expect(puzzleScore(10_000, 0, 4)).toBeGreaterThan(
      puzzleScore(40_000, 0, 4),
    );
    expect(puzzleScore(90_000, 100, 0)).toBe(0);
  });
});
