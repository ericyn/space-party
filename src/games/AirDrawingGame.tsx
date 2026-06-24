import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { playSound } from "../lib/audio";
import { distance } from "../lib/tracking/math";
import type { GameResult, Point, TrackingFrame } from "../types";

interface Stroke {
  color: string;
  points: Point[];
}

interface Props {
  tracking: RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  onFinish: (result: GameResult) => void;
}

const PALETTE_COLORS = [
  {
    id: "red",
    label: "Red",
    code: "#FF3B30",
    color: "oklch(0.637 0.237 25.331)",
    labelColor: "oklch(1 0 0)",
  },
  {
    id: "orange",
    label: "Orange",
    code: "#FF9500",
    color: "oklch(0.746 0.181 55.934)",
    labelColor: "oklch(0.205 0 0)",
  },
  {
    id: "yellow",
    label: "Yellow",
    code: "#FFD60A",
    color: "oklch(0.879 0.169 91.605)",
    labelColor: "oklch(0.205 0 0)",
  },
  {
    id: "green",
    label: "Green",
    code: "#34C759",
    color: "oklch(0.716 0.176 142.495)",
    labelColor: "oklch(0.205 0 0)",
  },
  {
    id: "blue",
    label: "Blue",
    code: "#007AFF",
    color: "oklch(0.617 0.199 258.338)",
    labelColor: "oklch(1 0 0)",
  },
  {
    id: "purple",
    label: "Purple",
    code: "#AF52DE",
    color: "oklch(0.627 0.265 303.9)",
    labelColor: "oklch(1 0 0)",
  },
  {
    id: "pink",
    label: "Pink",
    code: "#FF13FF",
    color: "oklch(0.705 0.319 328.327)",
    labelColor: "oklch(1 0 0)",
  },
  {
    id: "black",
    label: "Black",
    code: "#000000",
    color: "oklch(0 0 0)",
    labelColor: "oklch(1 0 0)",
  },
];
const DEFAULT_COLOR = PALETTE_COLORS[0].color;
const CLEAR_HOLD_MS = 700;
const MIN_POINT_GAP = 0.005;

function paletteCardLeft(index: number): string {
  const gap = 75 / Math.max(PALETTE_COLORS.length - 1, 1);
  return `${index * gap}%`;
}

export function AirDrawingGame({
  tracking,
  paused,
  soundEnabled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const colorCardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cameraPaletteActiveRef = useRef(false);
  const mousePaletteActiveRef = useRef(false);
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const selectedColorRef = useRef(DEFAULT_COLOR);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const chooseColor = (color: string) => {
    if (selectedColorRef.current === color) return;
    selectedColorRef.current = color;
    setSelectedColor(color);
  };
  const selectedColorIndex = () =>
    Math.max(
      0,
      PALETTE_COLORS.findIndex(
        (colorCard) => colorCard.color === selectedColorRef.current,
      ),
    );
  const resetPaletteTransforms = () => {
    for (const node of colorCardRefs.current) {
      if (!node) continue;
      node.style.setProperty("--palette-card-y", "0px");
      node.style.setProperty("--palette-card-rotation", "0deg");
    }
  };
  const handlePalettePointerLeave = () => {
    mousePaletteActiveRef.current = false;
    if (!cameraPaletteActiveRef.current) resetPaletteTransforms();
  };
  const updatePaletteTransforms = (activeIndex?: number) => {
    const nodes = colorCardRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (nodes.length < 2) return;
    const selectedIndex = activeIndex ?? selectedColorIndex();

    nodes.forEach((node, index) => {
      const offset = Math.abs(index - selectedIndex);
      const lift =
        offset === 0 ? 0.62 : offset === 1 ? 0.18 : offset === 2 ? 0.06 : 0;
      const direction =
        index < selectedIndex ? -1 : index > selectedIndex ? 1 : 0;
      const maxLift = -node.offsetHeight * 0.48;
      const maxAngle = -1.15;

      node.style.setProperty(
        "--palette-card-y",
        `${(lift * maxLift).toFixed(2)}px`,
      );
      node.style.setProperty(
        "--palette-card-rotation",
        `${(lift * maxAngle * direction).toFixed(3)}deg`,
      );
    });
  };
  const choosePaletteColorAtIndex = (activeIndex: number) => {
    const color = PALETTE_COLORS[activeIndex]?.color;
    if (!color) return false;
    chooseColor(color);
    updatePaletteTransforms(activeIndex);
    return true;
  };
  const handlePalettePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    mousePaletteActiveRef.current = true;
    if (event.target instanceof Element) {
      const card = event.target.closest<HTMLButtonElement>(
        ".drawing-color-card",
      );
      const targetIndex = colorCardRefs.current.indexOf(card);
      if (targetIndex >= 0) {
        choosePaletteColorAtIndex(targetIndex);
        return;
      }
    }
    choosePaletteColorAtClientPoint(event.clientX, event.clientY);
  };
  const choosePaletteColorAtClientPoint = (
    clientX: number,
    clientY: number,
  ) => {
    const palette = paletteRef.current;
    if (!palette) return false;

    const paletteRect = palette.getBoundingClientRect();
    const insideVisiblePaletteBand =
      clientY >= paletteRect.top - 132 && clientY <= paletteRect.bottom + 12;
    if (!insideVisiblePaletteBand) return false;

    const cardWidth = paletteRect.width * 0.25;
    const cardGap =
      (paletteRect.width - cardWidth) / Math.max(PALETTE_COLORS.length - 1, 1);
    let activeIndex = 0;
    let closestDistance = Infinity;

    PALETTE_COLORS.forEach((_, index) => {
      const center = paletteRect.left + index * cardGap + cardWidth / 2;
      const distanceFromCenter = Math.abs(clientX - center);
      if (distanceFromCenter < closestDistance) {
        activeIndex = index;
        closestDistance = distanceFromCenter;
      }
    });

    return choosePaletteColorAtIndex(activeIndex);
  };
  const handleColorCardPointerEnter = (
    event: PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    mousePaletteActiveRef.current = true;
    choosePaletteColorAtIndex(index);
  };
  const handleColorCardSelect = (index: number) => {
    choosePaletteColorAtIndex(index);
  };
  const updateTrackedPaletteHover = (tip: Point, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + tip.x * rect.width;
    const clientY = rect.top + tip.y * rect.height;
    const didHitColor = choosePaletteColorAtClientPoint(clientX, clientY);

    if (didHitColor) {
      cameraPaletteActiveRef.current = true;
      return true;
    }

    if (cameraPaletteActiveRef.current) {
      cameraPaletteActiveRef.current = false;
      if (!mousePaletteActiveRef.current) resetPaletteTransforms();
    }
    return false;
  };

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let strokes: Stroke[] = [];
    let current: Stroke | null = null;
    let openSince = 0;
    let pauseStarted = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const addPoint = (point: Point) => {
      if (!current) return;
      const last = current.points[current.points.length - 1];
      if (last) {
        const step = distance(last, point);
        if (step < MIN_POINT_GAP) return;
      }
      current.points.push({ ...point });
    };

    const draw = (now: number, tip: Point | null, pinch: boolean) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "oklch(0.977 0 0)";
      ctx.fillRect(0, 0, width, height);

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 7;
      for (const stroke of [...strokes, ...(current ? [current] : [])]) {
        if (stroke.points.length === 0) continue;
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
        for (let index = 1; index < stroke.points.length; index += 1) {
          ctx.lineTo(
            stroke.points[index].x * width,
            stroke.points[index].y * height,
          );
        }
        if (stroke.points.length === 1) {
          ctx.lineTo(
            stroke.points[0].x * width + 0.1,
            stroke.points[0].y * height,
          );
        }
        ctx.stroke();
      }

      if (tip) {
        ctx.beginPath();
        ctx.arc(tip.x * width, tip.y * height, pinch ? 11 : 8, 0, Math.PI * 2);
        ctx.fillStyle = pinch
          ? selectedColorRef.current
          : "oklch(0.205 0 0 / 0.35)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "oklch(1 0 0)";
        ctx.stroke();
        ctx.lineWidth = 7;
      }

      if (openSince) {
        const held = Math.min(1, (now - openSince) / CLEAR_HOLD_MS);
        ctx.fillStyle = "oklch(0.627 0 0)";
        ctx.font = "600 13px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          `Hold open palm to clear… ${Math.round(held * 100)}%`,
          width / 2,
          28,
        );
      }
    };

    const frame = (now: number) => {
      if (pausedRef.current) {
        if (!pauseStarted) pauseStarted = now;
        draw(now, null, false);
        animationId = requestAnimationFrame(frame);
        return;
      }
      if (pauseStarted) {
        if (openSince) openSince += now - pauseStarted;
        pauseStarted = 0;
      }

      const hand = tracking.current?.hand;
      const tip = hand ? hand.index : null;
      const pinch = Boolean(hand?.pinch);
      const hoveringPalette = tip
        ? updateTrackedPaletteHover(tip, canvas)
        : false;

      if (!tip && cameraPaletteActiveRef.current) {
        cameraPaletteActiveRef.current = false;
        if (!mousePaletteActiveRef.current) resetPaletteTransforms();
      }

      if (!hoveringPalette && hand?.gesture === "Open_Palm" && !pinch) {
        if (!openSince) openSince = now;
        else if (now - openSince >= CLEAR_HOLD_MS && strokes.length) {
          strokes = [];
          current = null;
          playSound(soundRef.current, "puzzle-reject");
          openSince = now + 400;
        }
      } else {
        openSince = 0;
      }

      if (pinch && tip && !hoveringPalette) {
        if (!current) {
          current = {
            color: selectedColorRef.current,
            points: [],
          };
          playSound(soundRef.current, "puzzle-grab");
        }
        addPoint(tip);
      } else if (current) {
        if (current.points.length > 0) {
          strokes.push(current);
        }
        current = null;
      }

      draw(now, tip, pinch);
      animationId = requestAnimationFrame(frame);
    };

    animationId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [tracking]);

  return (
    <div className="game-stage game-stage--drawing">
      <div className="game-hud game-hud--drawing" aria-live="polite">
        <strong>Draw</strong>
      </div>
      <div className="bubble-playfield bubble-playfield--drawing">
        <canvas
          ref={canvasRef}
          className="bubble-overlay"
          aria-label="Air Drawing game area"
        />
        <div
          ref={paletteRef}
          className="drawing-palette"
          role="toolbar"
          aria-label="Drawing colors"
          onPointerEnter={handlePalettePointerMove}
          onPointerMove={handlePalettePointerMove}
          onPointerLeave={handlePalettePointerLeave}
          onPointerCancel={handlePalettePointerLeave}
        >
          {PALETTE_COLORS.map((colorCard, index) => (
            <button
              key={colorCard.id}
              ref={(node) => {
                colorCardRefs.current[index] = node;
              }}
              type="button"
              className={
                colorCard.color === selectedColor
                  ? "drawing-color-card is-selected"
                  : "drawing-color-card"
              }
              style={
                {
                  "--palette-card-color": colorCard.color,
                  "--palette-card-label-color": colorCard.labelColor,
                  "--palette-card-left": paletteCardLeft(index),
                  "--palette-card-z": index + 1,
                } as CSSProperties
              }
              data-palette-color={colorCard.color}
              aria-label={`Use ${colorCard.label}`}
              aria-pressed={colorCard.color === selectedColor}
              onPointerEnter={(event) =>
                handleColorCardPointerEnter(event, index)
              }
              onFocus={() => handleColorCardSelect(index)}
              onClick={() => handleColorCardSelect(index)}
            >
              <span className="drawing-color-card__surface" aria-hidden="true">
                <span className="drawing-color-card__label">
                  {colorCard.label}
                </span>
                <span className="drawing-color-card__code">
                  {colorCard.code}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
