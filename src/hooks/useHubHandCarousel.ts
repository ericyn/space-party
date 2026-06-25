import { useEffect, useRef, useState, type RefObject } from "react";
import type { GameId, Point, TrackingFrame } from "../types";
import { findPointTarget, viewportPointFromAim } from "../lib/targetSelection";

interface HubHandCarouselOptions {
  active: boolean;
  tracking: RefObject<TrackingFrame | null>;
  cardRefs: RefObject<Partial<Record<GameId, HTMLButtonElement | null>>>;
  carouselRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: GameId) => void;
}

export interface HubHandCarouselState {
  point: Point | null;
  targetId: GameId | null;
  dragging: boolean;
}

interface DragState {
  kind: "pinch" | "two-finger";
  startX: number;
  scrollLeft: number;
  moved: boolean;
}

const EMPTY_STATE: HubHandCarouselState = {
  point: null,
  targetId: null,
  dragging: false,
};
const SCROLL_DRAG_MULTIPLIER = 1.35;
const TWO_FINGER_SCROLL_MULTIPLIER = 1.12;
const SCROLL_SMOOTHING = 0.34;
const TAP_COOLDOWN_MS = 650;
const DRAG_TAP_LOCKOUT_MS = 260;
const PALM_CONFIRM_SCORE = 0.58;

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function useHubHandCarousel({
  active,
  tracking,
  cardRefs,
  carouselRef,
  onSelect,
}: HubHandCarouselOptions): HubHandCarouselState {
  const [state, setState] = useState<HubHandCarouselState>(EMPTY_STATE);
  const dragRef = useRef<DragState | null>(null);
  const lastPalmPushRef = useRef(false);
  const lastSelectAtRef = useRef(0);
  const lastDragEndAtRef = useRef(0);
  const scrollTargetRef = useRef<number | null>(null);
  const lastPublishedRef = useRef<HubHandCarouselState>(EMPTY_STATE);

  useEffect(() => {
    if (!active) {
      dragRef.current = null;
      lastPalmPushRef.current = false;
      scrollTargetRef.current = null;
      lastPublishedRef.current = EMPTY_STATE;
      setState(EMPTY_STATE);
      return;
    }

    let animationFrame = 0;
    let cancelled = false;

    const publish = (next: HubHandCarouselState) => {
      const previous = lastPublishedRef.current;
      const pointChanged =
        Boolean(previous.point) !== Boolean(next.point) ||
        Math.abs((previous.point?.x ?? 0) - (next.point?.x ?? 0)) > 8 ||
        Math.abs((previous.point?.y ?? 0) - (next.point?.y ?? 0)) > 8;
      const targetChanged = previous.targetId !== next.targetId;
      const draggingChanged = previous.dragging !== next.dragging;

      if (pointChanged || targetChanged || draggingChanged) {
        lastPublishedRef.current = next;
        setState(next);
      }
    };

    const reset = () => {
      dragRef.current = null;
      lastPalmPushRef.current = false;
      scrollTargetRef.current = null;
      publish(EMPTY_STATE);
    };

    const tick = (now: number) => {
      const frame = tracking.current;
      const hand = frame?.mode === "hand" ? frame.hand : null;
      const palm = frame?.mode === "hand" ? frame.hands[0]?.point : null;

      if (!hand) {
        reset();
        if (!cancelled) animationFrame = requestAnimationFrame(tick);
        return;
      }

      const openPalm =
        hand.gesture === "Open_Palm" &&
        hand.gestureScore >= PALM_CONFIRM_SCORE &&
        !hand.pinch &&
        !hand.twoFinger;
      const palmPush = openPalm && hand.tap;
      const aim = hand.twoFinger
        ? midpoint(hand.index, hand.middle)
        : openPalm && palm
          ? palm
          : hand.index;
      const point = viewportPointFromAim(aim, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      const carousel = carouselRef.current;
      const scrollKind = hand.pinch
        ? "pinch"
        : hand.twoFinger
          ? "two-finger"
          : null;

      if (scrollKind && carousel) {
        if (!dragRef.current || dragRef.current.kind !== scrollKind) {
          dragRef.current = {
            kind: scrollKind,
            startX: point.x,
            scrollLeft: carousel.scrollLeft,
            moved: false,
          };
          scrollTargetRef.current = carousel.scrollLeft;
        }

        const drag = dragRef.current;
        const deltaX = point.x - drag.startX;
        if (Math.abs(deltaX) > 8) drag.moved = true;
        const multiplier =
          scrollKind === "pinch"
            ? SCROLL_DRAG_MULTIPLIER
            : TWO_FINGER_SCROLL_MULTIPLIER;
        const scrollTarget = drag.scrollLeft - deltaX * multiplier;
        scrollTargetRef.current = scrollTarget;
        const easedScroll =
          carousel.scrollLeft +
          (scrollTarget - carousel.scrollLeft) * SCROLL_SMOOTHING;
        carousel.scrollLeft =
          Math.abs(scrollTarget - easedScroll) < 0.5
            ? scrollTarget
            : easedScroll;
        publish({ point, targetId: null, dragging: true });
        lastPalmPushRef.current = false;
        if (!cancelled) animationFrame = requestAnimationFrame(tick);
        return;
      }

      if (!scrollKind && dragRef.current) {
        if (dragRef.current.moved) lastDragEndAtRef.current = now;
        dragRef.current = null;
      }

      if (!scrollKind && carousel && scrollTargetRef.current !== null) {
        const scrollTarget = scrollTargetRef.current;
        const easedScroll =
          carousel.scrollLeft +
          (scrollTarget - carousel.scrollLeft) * SCROLL_SMOOTHING;
        carousel.scrollLeft =
          Math.abs(scrollTarget - easedScroll) < 0.5
            ? scrollTarget
            : easedScroll;
        if (Math.abs(scrollTarget - carousel.scrollLeft) < 0.5) {
          scrollTargetRef.current = null;
        }
      }

      const candidates = Object.entries(cardRefs.current)
        .map(([id, element]) =>
          element
            ? {
                id: id as GameId,
                rect: element.getBoundingClientRect(),
              }
            : null,
        )
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate),
        );
      const targetId = findPointTarget(point, candidates, 18);
      const tapBlocked =
        now - lastSelectAtRef.current < TAP_COOLDOWN_MS ||
        now - lastDragEndAtRef.current < DRAG_TAP_LOCKOUT_MS;

      publish({ point, targetId, dragging: false });

      if (palmPush && !lastPalmPushRef.current && targetId && !tapBlocked) {
        lastSelectAtRef.current = now;
        onSelect(targetId);
        return;
      }

      lastPalmPushRef.current = palmPush;
      if (!cancelled) animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [active, cardRefs, carouselRef, onSelect, tracking]);

  return state;
}
