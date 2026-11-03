export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeInOut = (t: number) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const smooth = (t: number) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Time-based animation driven by the stage's frame loop. */
export interface Animation {
  duration: number;
  elapsed: number;
  update: (t: number) => void;
  done?: () => void;
}
