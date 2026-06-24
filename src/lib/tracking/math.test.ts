import { describe, expect, it } from "vitest";
import {
  airTapSignal,
  mirrorPoint,
  nextPinchState,
  segmentCircleHit,
  smoothPoint,
} from "./math";

describe("tracking math", () => {
  it("mirrors camera coordinates horizontally", () => {
    expect(mirrorPoint({ x: 0.2, y: 0.7 })).toEqual({ x: 0.8, y: 0.7 });
  });

  it("smooths movement without changing the target axis", () => {
    expect(smoothPoint({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 0.35)).toEqual({
      x: 0.35,
      y: 0.5,
    });
  });

  it("uses separate pinch and release thresholds", () => {
    expect(nextPinchState(false, 0.34)).toBe(true);
    expect(nextPinchState(false, 0.4)).toBe(false);
    expect(nextPinchState(true, 0.49)).toBe(true);
    expect(nextPinchState(true, 0.51)).toBe(false);
  });

  it("finds a circle crossed between sparse tracker samples", () => {
    expect(
      segmentCircleHit(
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 0.52 },
        0.03,
      ),
    ).toBe(true);
    expect(
      segmentCircleHit(
        { x: 0, y: 0.2 },
        { x: 1, y: 0.2 },
        { x: 0.5, y: 0.5 },
        0.03,
      ),
    ).toBe(false);
  });

  it("detects a forward air tap and enforces its debounce", () => {
    expect(airTapSignal(1.2, 0, 500).tap).toBe(true);
    expect(airTapSignal(0, 0.22, 500).tap).toBe(true);
    expect(airTapSignal(1.2, 0, 100).tap).toBe(false);
    expect(airTapSignal(0.2, 0.05, 500).tap).toBe(false);
  });
});
