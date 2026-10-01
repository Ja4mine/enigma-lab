import * as THREE from "three";
import { ALPHABET } from "./enigma";

export const KEY_ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"] as const;

export const ROTOR_AXIS = { y: 1.79, z: -1.53 } as const;
export const ROTOR_CENTERS = [-0.7, 0.26, 1.22] as const;
export const ROTOR_NUMBER_RING = {
  radius: 0.744,
  labelRadius: 0.75,
  labelWidth: 0.21,
  labelHeight: 0.16,
} as const;
export const ROTOR_THUMBWHEEL = {
  xOffset: 0.29,
  radius: 0.86,
  innerRadius: 0.57,
  thickness: 0.09,
} as const;

export const HOOD = {
  x: -0.13,
  z: ROTOR_AXIS.z,
  width: 4.9,
  depth: 1.9,
  bottom: 2.555,
  thickness: 0.05,
} as const;

export const HOOD_SLOT = {
  xOffset: ROTOR_THUMBWHEEL.xOffset,
  zOffset: 0,
  width: 0.14,
  depth: 0.84,
  radius: 0.035,
  frameWidth: 0.17,
  frameDepth: 0.912,
  frameBottom: 2.606,
  frameThickness: 0.027,
} as const;

export const HOOD_WINDOW = {
  xOffset: 0,
  zOffset: 0.025,
  width: 0.37,
  depth: 0.25,
  radius: 0.035,
  frameWidth: 0.4,
  frameDepth: 0.345,
  frameBottom: 2.606,
  frameThickness: 0.019,
} as const;

export const HOOD_FRONT = {
  z: -0.6,
  bottom: 1.4,
  thickness: 0.042,
  lipZ: -0.578,
  lipY: 1.408,
  lipHeight: 0.035,
  lipDepth: 0.09,
} as const;

export const DECK = {
  width: 6,
  depth: 4.82,
  bottom: 1.18,
  thickness: 0.06,
} as const;

export const ROTOR_WELL = {
  x: -0.13,
  z: -1.59,
  width: 4.8,
  depth: 1.5,
  radius: 0.08,
} as const;

export const LAMP_BAY = {
  x: 0,
  z: -0.09,
  width: 5.4,
  depth: 1.22,
  radius: 0.06,
} as const;

export const KEY_BAY = {
  x: 0,
  z: 1.44,
  width: 5.4,
  depth: 1.68,
  radius: 0.06,
} as const;

export const LAMP_PANEL = {
  width: 5.52,
  depth: 1.26,
  x: 0,
  z: -0.07,
  bottom: 1.267,
  thickness: 0.035,
} as const;

export const KEY_PANEL = {
  width: 5.52,
  depth: 1.74,
  x: 0,
  z: 1.44,
  bottom: 1.255,
  thickness: 0.035,
} as const;

/** Shared machine coordinates, used by the physical panels and their apertures. */
export function keyPoint(
  letter: string,
  type: "key" | "lamp",
): [number, number, number] {
  const normalized = letter.toUpperCase();
  for (let row = 0; row < KEY_ROWS.length; row++) {
    const col = KEY_ROWS[row].indexOf(normalized);
    if (normalized.length === 1 && col !== -1)
      return [
        (col - (KEY_ROWS[row].length - 1) / 2) * 0.56,
        type === "key" ? 1.45 : 1.3,
        (type === "key" ? 0.83 : -0.33) + row * (type === "key" ? 0.55 : 0.33),
      ];
  }
  throw new Error("面板触点必须是 A–Z 字母。");
}

export interface HorizontalPanelHole {
  x: number;
  z: number;
  width?: number;
  depth?: number;
  /** Rectangle corner radius, or the radius of a circular aperture. */
  radius?: number;
}

export const deckHoles: HorizontalPanelHole[] = [
  { ...ROTOR_WELL },
  { ...LAMP_BAY },
  { ...KEY_BAY },
];

/** Hood-local apertures; the physical numeral ring remains beneath each window. */
export const hoodHoles: HorizontalPanelHole[] = ROTOR_CENTERS.flatMap((x) =>
  [HOOD_WINDOW, HOOD_SLOT].map((opening) => ({
    x: x + opening.xOffset - HOOD.x,
    z: ROTOR_AXIS.z + opening.zOffset - HOOD.z,
    width: opening.width,
    depth: opening.depth,
    radius: opening.radius,
  })),
);

export const lampHoles: HorizontalPanelHole[] = [...ALPHABET].map((letter) => {
  const [x, , z] = keyPoint(letter, "lamp");
  return { x: x - LAMP_PANEL.x, z: z - LAMP_PANEL.z, radius: 0.174 };
});

export const keyHoles: HorizontalPanelHole[] = [...ALPHABET].map((letter) => {
  const [x, , z] = keyPoint(letter, "key");
  return { x: x - KEY_PANEL.x, z: z - KEY_PANEL.z, radius: 0.105 };
});

function roundedRectangle(
  path: THREE.Path,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const left = x - width / 2;
  const right = x + width / 2;
  const bottom = y - height / 2;
  const top = y + height / 2;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  path.moveTo(left + r, bottom);
  path.lineTo(right - r, bottom);
  path.quadraticCurveTo(right, bottom, right, bottom + r);
  path.lineTo(right, top - r);
  path.quadraticCurveTo(right, top, right - r, top);
  path.lineTo(left + r, top);
  path.quadraticCurveTo(left, top, left, top - r);
  path.lineTo(left, bottom + r);
  path.quadraticCurveTo(left, bottom, left + r, bottom);
  path.closePath();
}

/**
 * A real perforated plate. Local X/Z are the caller's panel coordinates;
 * extrusion runs upward from Y=0 to thickness, without bevels narrowing holes.
 */
export function createHorizontalPanelGeometry(
  width: number,
  depth: number,
  thickness: number,
  holes: HorizontalPanelHole[],
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  roundedRectangle(shape, 0, 0, width, depth, 0.035);
  for (const aperture of holes) {
    const hole = new THREE.Path();
    // Rotating the extrusion onto X/Z maps the shape's +Y to world −Z.
    if (aperture.width !== undefined && aperture.depth !== undefined)
      roundedRectangle(
        hole,
        aperture.x,
        -aperture.z,
        aperture.width,
        aperture.depth,
        aperture.radius ?? 0,
      );
    else
      hole.absarc(
        aperture.x,
        -aperture.z,
        aperture.radius ?? 0,
        0,
        Math.PI * 2,
        true,
      );
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 32,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  return geometry;
}
