export interface ScreenRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Expanded paper pane footprint, matching the CSS breakpoints. */
export function stagePaneBounds(width: number, height: number): ScreenRect {
  if (width <= 800) {
    const edge = width <= 430 ? 12 : 18;
    return {
      left: edge,
      right: width - edge,
      top: height * 0.58 - 12,
      bottom: height - 12,
    };
  }
  const edge = width >= 1400 ? 34 : width <= 1050 ? 20 : 26;
  const paneWidth = width >= 1400 ? 380 : width <= 1050 ? 330 : 360;
  return {
    left: width - edge - paneWidth,
    right: width - edge,
    top: height <= 700 ? 82 : 99,
    bottom: height - (height <= 700 ? 18 : 24),
  };
}

/** Positive distance separates rectangles; negative distance means overlap. */
export function rectangleClearance(subject: ScreenRect, pane: ScreenRect) {
  return Math.max(
    pane.left - subject.right,
    subject.left - pane.right,
    pane.top - subject.bottom,
    subject.top - pane.bottom,
  );
}

/** Screen-space room left by the floating paper panes. */
export function stageFraming(
  width: number,
  height: number,
  fullStage: boolean,
  collapsed = false,
) {
  if (!fullStage)
    return { offsetX: 0, offsetY: 0, aspect: width / height, distanceScale: 1 };
  const narrow = width <= 800;
  const top = narrow ? 88 : 100;
  const bottom = narrow ? (collapsed ? 82 : height * 0.42 + 24) : 54;
  const left = narrow ? 16 : 24;
  const pane = stagePaneBounds(width, height);
  const right = narrow
    ? 16
    : collapsed
      ? width - pane.right + 60 + 12
      : width - pane.left + 12;
  const safeWidth = Math.max(180, width - left - right);
  const safeHeight = Math.max(170, height - top - bottom);
  return {
    offsetX: (right - left) / 2,
    offsetY: (bottom - top) / 2,
    aspect: safeWidth / safeHeight,
    distanceScale: height / safeHeight,
  };
}

/** Only explicit orbit gestures should collapse the panes, never camera tours. */
export function createUserZoomTracker() {
  let active = false;
  let previous = 0;
  let collapsed = false;
  return {
    start(distance: number) {
      active = true;
      previous = distance;
    },
    end() {
      active = false;
    },
    reset() {
      active = false;
      collapsed = false;
    },
    change(distance: number, clearance: number): boolean | undefined {
      if (!active) return;
      const last = previous;
      previous = distance;
      if (!Number.isFinite(clearance)) return;
      // Only make space when the model actually approaches the pane. The
      // wider restore margin prevents flicker around the occlusion boundary.
      if (!collapsed && distance < last * 0.9999 && clearance <= 18) {
        collapsed = true;
        return true;
      }
      if (collapsed && distance > last * 1.0001 && clearance >= 64) {
        collapsed = false;
        return false;
      }
    },
  };
}
