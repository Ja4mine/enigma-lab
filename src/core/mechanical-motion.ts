import type { KeyResult, Triple } from "./enigma";

/** A single tooth on the model's 26-tooth ratchets, expressed in radians. */
export const RATCHET_TOOTH_ANGLE = (Math.PI * 2) / 26;

export interface MechanicalStrokePose {
  /** 0…1 tooth; the drive finishes before the return stroke starts. */
  advance: number;
  /** Completed fraction of the linkage's return movement. */
  recovery: number;
  /** One outward-and-back rocker cycle, independent of which pawls engage. */
  rocker: number;
  /** Continuous angles: Z→A ends at 26 teeth rather than jumping to zero. */
  rotorAngles: Triple<number>;
}

function smoothInterval(value: number, start: number, end: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

/**
 * Teaching linkage driven directly by encryptKey's BEFORE windows and stepped
 * decisions. It never independently decides turnover or double-stepping.
 *
 * The tooth advances during the drive stroke, then stays locked while the
 * linkage returns. The timing describes an explanatory animation, not rigid
 * body contact forces or historically measured mechanism timing.
 */
export function mechanicalStrokePose(
  before: KeyResult["before"],
  stepped: KeyResult["stepped"],
  progress: number,
): MechanicalStrokePose {
  const p = Math.max(0, Math.min(1, progress));
  const advance = smoothInterval(p, 0.13, 0.63);
  const recovery = smoothInterval(p, 0.63, 1);
  return {
    advance,
    recovery,
    rocker: p === 0 || p === 1 ? 0 : Math.sin(Math.PI * p),
    rotorAngles: before.map(
      (position, index) =>
        (position + (stepped[index] ? advance : 0)) * RATCHET_TOOTH_ANGLE,
    ) as Triple<number>,
  };
}
