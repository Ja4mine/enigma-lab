import { describe, expect, it } from "vitest";
import {
  createUserZoomTracker,
  rectangleClearance,
  stageFraming,
  stagePaneBounds,
} from "./stage-framing";

describe("model stage framing leaves room for the controls", () => {
  it("keeps the original projection outside full-stage mode, regardless of panel state", () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      for (const collapsed of [false, true]) {
        expect(stageFraming(width, height, false, collapsed)).toEqual({
          offsetX: 0,
          offsetY: 0,
          aspect: width / height,
          distanceScale: 1,
        });
      }
    }
  });

  it("reserves the desktop right pane and returns more space when it collapses", () => {
    const expanded = stageFraming(1440, 900, true);
    const collapsed = stageFraming(1440, 900, true, true);
    // Positive projection offset moves the visible subject left of the pane.
    expect(expanded.offsetX).toBeGreaterThan(0);
    expect(collapsed.offsetX).toBeGreaterThanOrEqual(0);
    expect(collapsed.offsetX).toBeLessThan(expanded.offsetX);
    expect(collapsed.aspect).toBeGreaterThan(expanded.aspect);
    expect(collapsed.offsetY).toBe(expanded.offsetY);
    expect(collapsed.distanceScale).toBe(expanded.distanceScale);
  });

  it("keeps narrow-screen subjects above the bottom pane, including the 800px breakpoint", () => {
    for (const width of [390, 800]) {
      const expanded = stageFraming(width, 900, true);
      const collapsed = stageFraming(width, 900, true, true);
      expect(expanded.offsetX).toBe(0);
      expect(collapsed.offsetX).toBe(0);
      // Positive projection Y offset raises the visible subject above the pane.
      expect(expanded.offsetY).toBeGreaterThan(0);
      expect(collapsed.offsetY).toBeLessThan(expanded.offsetY);
      expect(expanded.distanceScale).toBeGreaterThan(collapsed.distanceScale);
      expect(expanded.aspect).toBeGreaterThan(collapsed.aspect);
    }
    expect(stageFraming(801, 900, true).offsetX).toBeGreaterThan(0);
  });

  it("keeps a finite positive camera fit even when the viewport is smaller than the panels", () => {
    const fit = stageFraming(240, 180, true);
    expect(Object.values(fit).every(Number.isFinite)).toBe(true);
    expect(fit.aspect).toBeGreaterThan(0);
    expect(fit.distanceScale).toBeGreaterThan(0);
  });
});

describe("expanded control pane bounds match the responsive layout", () => {
  it("tracks desktop pane widths and edges across both breakpoints", () => {
    for (const [width, paneWidth, edge] of [
      [801, 330, 20],
      [1050, 330, 20],
      [1051, 360, 26],
      [1399, 360, 26],
      [1400, 380, 34],
      [1920, 380, 34],
    ]) {
      const pane = stagePaneBounds(width, 900);
      expect(pane.left).toBe(width - paneWidth - edge);
      expect(pane.right).toBe(width - edge);
      expect(pane.top).toBe(99);
      expect(pane.bottom).toBe(876);
    }
  });

  it("uses the actual bottom pane at 800px and the compact phone edge at 430px", () => {
    for (const [width, edge] of [
      [390, 12],
      [430, 12],
      [431, 18],
      [690, 18],
      [800, 18],
    ]) {
      const pane = stagePaneBounds(width, 900);
      expect(pane.left).toBe(edge);
      expect(pane.right).toBe(width - edge);
      expect(pane.bottom).toBe(888);
      expect(pane.top).toBeCloseTo(900 - 12 - 900 * 0.42);
    }
  });
});

describe("pane clearance follows the actual screen rectangles", () => {
  it("does not treat horizontal proximity as occlusion when the model is well above the pane", () => {
    const pane = { left: 600, right: 980, top: 200, bottom: 880 };
    const above = { left: 580, right: 680, top: 20, bottom: 120 };
    expect(rectangleClearance(above, pane)).toBe(80);

    const approaching = { left: 200, right: 582, top: 300, bottom: 650 };
    expect(rectangleClearance(approaching, pane)).toBe(18);
    expect(rectangleClearance({ ...approaching, right: 630 }, pane)).toBe(-30);
  });

  it("uses vertical clearance for the mobile bottom pane and rejects side-only proximity", () => {
    const pane = { left: 18, right: 782, top: 510, bottom: 888 };
    const approaching = { left: 150, right: 650, top: 150, bottom: 492 };
    expect(rectangleClearance(approaching, pane)).toBe(18);
    expect(rectangleClearance({ ...approaching, bottom: 446 }, pane)).toBe(64);
    const beside = { left: 862, right: 970, top: 490, bottom: 660 };
    expect(rectangleClearance(beside, pane)).toBe(80);
  });
});

describe("pane collapse follows user zoom only when the model approaches the pane", () => {
  it("keeps a safely framed model visible while the user zooms closer", () => {
    const tracker = createUserZoomTracker();
    tracker.start(12);
    expect(tracker.change(11, 120)).toBeUndefined();
    expect(tracker.change(10, 50)).toBeUndefined();
    expect(tracker.change(9, 18.01)).toBeUndefined();
    expect(tracker.change(8.5, 18)).toBe(true);
  });

  it("collapses for an inward gesture when the model already overlaps the pane", () => {
    const tracker = createUserZoomTracker();
    tracker.start(10);
    expect(tracker.change(9, -25)).toBe(true);
  });

  it("ignores automatic movement, rotation-distance noise, and panning near the pane", () => {
    const tracker = createUserZoomTracker();
    expect(tracker.change(8, -100)).toBeUndefined();
    tracker.start(10);
    expect(tracker.change(10 + 1e-10, 0)).toBeUndefined();
    expect(tracker.change(10 - 1e-10, -30)).toBeUndefined();
    expect(tracker.change(10, -50)).toBeUndefined();
    expect(tracker.change(9.995, 10)).toBe(true);
  });

  it("requires outward movement and 64px of free space before restoring the pane", () => {
    const tracker = createUserZoomTracker();
    tracker.start(10);
    expect(tracker.change(8, 5)).toBe(true);
    expect(tracker.change(8.5, 18)).toBeUndefined();
    expect(tracker.change(9, 50)).toBeUndefined();
    expect(tracker.change(9.5, 63.99)).toBeUndefined();
    expect(tracker.change(9.995, 64)).toBe(false);
  });

  it("does not reopen on inward movement even if a rotated model has ample clearance", () => {
    const tracker = createUserZoomTracker();
    tracker.start(12);
    expect(tracker.change(10, 8)).toBe(true);
    expect(tracker.change(9, 100)).toBeUndefined();
  });

  it("does not collapse on outward movement when the model still overlaps the pane", () => {
    const tracker = createUserZoomTracker();
    tracker.start(5);
    expect(tracker.change(5.5, -60)).toBeUndefined();
    expect(tracker.change(6, 17)).toBeUndefined();
  });

  it("keeps its current state throughout the hysteresis band instead of chattering", () => {
    const tracker = createUserZoomTracker();
    tracker.start(10);
    expect(tracker.change(8, 17)).toBe(true);
    expect(tracker.change(8.5, 22)).toBeUndefined();
    expect(tracker.change(8.4, 20)).toBeUndefined();
    expect(tracker.change(9.5, 60)).toBeUndefined();
    expect(tracker.change(9.4, 57)).toBeUndefined();
    expect(tracker.change(10, 65)).toBe(false);
    expect(tracker.change(9.5, 60)).toBeUndefined();
    expect(tracker.change(8.4, 20)).toBeUndefined();
    expect(tracker.change(8, 17)).toBe(true);
  });

  it("ends each wheel gesture so automatic camera changes cannot toggle the pane", () => {
    const tracker = createUserZoomTracker();
    tracker.start(10);
    expect(tracker.change(8, 5)).toBe(true);
    tracker.end();
    expect(tracker.change(6, -100)).toBeUndefined();
    expect(tracker.change(15, 150)).toBeUndefined();
    tracker.start(8);
    expect(tracker.change(10, 65)).toBe(false);
  });

  it("reset cancels an active gesture and a fresh gesture uses current clearance", () => {
    const tracker = createUserZoomTracker();
    tracker.start(10);
    expect(tracker.change(7, 10)).toBe(true);
    tracker.reset();
    expect(tracker.change(12, 120)).toBeUndefined();
    tracker.start(20);
    expect(tracker.change(19, 120)).toBeUndefined();
    expect(tracker.change(15, 17)).toBe(true);
    expect(tracker.change(18, 65)).toBe(false);
  });
});
