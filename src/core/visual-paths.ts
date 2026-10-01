import type { SignalStage } from "./enigma";

export type Point3 = [number, number, number];

interface WireDescription {
  /** Stationary contacts, as seen by the adjacent component. */
  input: number;
  output: number;
  /** Contacts on the actual wire, before the wired core is rotated. */
  wireFrom: number;
  wireTo: number;
  reverse: boolean;
}

export type StagePathDescription =
  | (WireDescription & {
      kind: "rotor";
      rotorIndex: 0 | 1 | 2;
      position: number;
      ring: number;
    })
  | (WireDescription & { kind: "reflector" | "plugboard" });

const CONTACT_RADIUS = 0.516;
const STEP = (Math.PI * 2) / 26;

/**
 * Local contact coordinates used by both the static wires and signal overlay.
 * A sits at the top; increasing labels travel from +Y towards -Z. This handedness
 * lets a positive X rotation of position − ring align a shifted core contact
 * with its stationary external contact.
 */
export function contactPoint(
  index: number,
  x: number,
  radius = CONTACT_RADIUS,
): Point3 {
  const angle = Math.PI / 2 + index * STEP;
  return [x, Math.sin(angle) * radius, Math.cos(angle) * radius];
}

/** Apply the same positive X-axis rotation as the Three.js wired-core group. */
export function rotateXPoint(point: Point3, offsetSteps: number): Point3 {
  const angle = offsetSteps * STEP;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    point[0],
    point[1] * cosine - point[2] * sine,
    point[1] * sine + point[2] * cosine,
  ];
}

/** One physical rotor wire, always ordered right face → left face. */
export function rotorWirePoints(from: number, to: number): Point3[] {
  return [
    contactPoint(from, 0.33),
    contactPoint(from, 0.13, CONTACT_RADIUS * 0.7),
    contactPoint(to, -0.13, CONTACT_RADIUS * 0.7),
    contactPoint(to, -0.33),
  ];
}

/**
 * A reflector joins two contacts on its right-hand face. Route the illustrative
 * insulated leads around the shaft instead of cutting a chord through it.
 * Depth and radial lanes belong to the physical pair, never its current flow
 * direction; traversing the other way must reverse this exact same wire.
 */
export function reflectorWirePoints(from: number, to: number): Point3[] {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const depth = -0.145 + (low % 13) * 0.024;
  const leadDepth = (0.21 + depth) / 2;
  const radius = 0.34 + Math.floor(low / 13) * 0.07;
  const difference = high - low;
  const span = difference <= 13 ? difference : difference - 26;
  const segments = Math.max(1, Math.abs(span) * 2);
  const points: Point3[] = [
    contactPoint(low, 0.21),
    contactPoint(low, leadDepth, 0.48),
    contactPoint(low, depth, radius),
  ];
  // At most half a contact pitch per arc segment keeps Catmull–Rom smoothing
  // close to the annulus, including the two diametrically opposite pairings.
  for (let segment = 1; segment <= segments; segment++)
    points.push(contactPoint(low + (span * segment) / segments, depth, radius));
  points.push(contactPoint(high, leadDepth, 0.48), contactPoint(high, 0.21));
  return from === low ? points : points.reverse();
}

/**
 * Resolve the exact wire from the encryption trace. Inverse traversal never
 * invents another wire: it follows the same forward-wiring pair backwards.
 */
export function describeStage(stage: SignalStage): StagePathDescription {
  if (stage.id === "plug-in" || stage.id === "plug-out") {
    return {
      kind: "plugboard",
      input: stage.input,
      output: stage.output,
      wireFrom: stage.input,
      wireTo: stage.output,
      reverse: stage.id === "plug-out",
    };
  }
  if (stage.id === "reflector") {
    return {
      kind: "reflector",
      input: stage.input,
      output: stage.output,
      wireFrom: stage.input,
      wireTo: stage.output,
      reverse: false,
    };
  }
  if (
    stage.shiftedInput === undefined ||
    stage.wiredOutput === undefined ||
    stage.rotorIndex === undefined ||
    stage.position === undefined ||
    stage.ring === undefined ||
    stage.direction === undefined
  ) {
    throw new Error(`Incomplete rotor trace for ${stage.id}`);
  }
  const reverse = stage.direction === "reverse";
  return {
    kind: "rotor",
    input: stage.input,
    output: stage.output,
    wireFrom: reverse ? stage.wiredOutput : stage.shiftedInput,
    wireTo: reverse ? stage.shiftedInput : stage.wiredOutput,
    reverse,
    rotorIndex: stage.rotorIndex,
    position: stage.position,
    ring: stage.ring,
  };
}

/**
 * Control points ordered in the direction of the current. Rotor points remain
 * local to the wired core: render them inside its position − ring rotation.
 * Plugboard geometry is scene-specific, so it deliberately has no rotary path.
 */
export function pathPointsForStage(stage: SignalStage): Point3[] | undefined {
  const description = describeStage(stage);
  if (description.kind === "plugboard") return undefined;
  if (description.kind === "reflector") {
    return reflectorWirePoints(description.wireFrom, description.wireTo);
  }
  const points = rotorWirePoints(description.wireFrom, description.wireTo);
  return description.reverse ? points.reverse() : points;
}
