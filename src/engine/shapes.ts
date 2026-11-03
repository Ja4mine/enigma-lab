import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Geometry helpers. Units are centimetres; rotor axes run along +x. */

export const TAU = Math.PI * 2;
export const STEP = TAU / 26;

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: { name?: string; pos?: [number, number, number]; edges?: boolean; edgeAngle?: number; pick?: boolean } = {},
) {
  const m = new THREE.Mesh(geometry, material);
  if (opts.name) m.name = opts.name;
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.edges === false) m.userData.noEdges = true;
  if (opts.edgeAngle) m.userData.edgeAngle = opts.edgeAngle;
  if (opts.pick === false) m.userData.pickable = false;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const cachedGeo = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key) as T;
};

export const roundedBox = (w: number, h: number, d: number, r = 0.3, seg = 3) =>
  cachedGeo(`rb:${w}:${h}:${d}:${r}:${seg}`, () =>
    new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)),
  );

export const boxGeo = (w: number, h: number, d: number) =>
  cachedGeo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));

/** Cylinder whose axis is +x. */
export const cylX = (r: number, len: number, seg = 48, open = false) =>
  cachedGeo(`cx:${r}:${len}:${seg}:${open}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
    g.rotateZ(-Math.PI / 2);
    return g;
  });

/** Cylinder whose axis is +y. */
export const cylY = (r: number, len: number, seg = 32, rTop = r) =>
  cachedGeo(`cy:${r}:${rTop}:${len}:${seg}`, () => new THREE.CylinderGeometry(rTop, r, len, seg));

/** Cylinder whose axis is +z. */
export const cylZ = (r: number, len: number, seg = 32) =>
  cachedGeo(`cz:${r}:${len}:${seg}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2);
    return g;
  });

/** Annulus (washer) of thickness `len` along +x. */
export const annulusX = (rOuter: number, rInner: number, len: number, seg = 64) =>
  cachedGeo(`ax:${rOuter}:${rInner}:${len}:${seg}`, () => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOuter, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, rInner, 0, TAU, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: seg });
    g.translate(0, 0, -len / 2);
    g.rotateY(Math.PI / 2);
    return g;
  });

/** Toothed wheel along +x. `asym` gives ratchet teeth; otherwise rounded knurl. */
export const gearX = (teeth: number, rOuter: number, rRoot: number, rInner: number, len: number, asym: boolean) =>
  cachedGeo(`gx:${teeth}:${rOuter}:${rRoot}:${rInner}:${len}:${asym}`, () => {
    const shape = new THREE.Shape();
    const n = teeth;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU,
        a1 = ((i + 1) / n) * TAU;
      if (asym) {
        const p0 = [Math.cos(a0) * rRoot, Math.sin(a0) * rRoot];
        const tip = [Math.cos(a0 + (a1 - a0) * 0.12) * rOuter, Math.sin(a0 + (a1 - a0) * 0.12) * rOuter];
        if (i === 0) shape.moveTo(p0[0], p0[1]);
        else shape.lineTo(p0[0], p0[1]);
        shape.lineTo(tip[0], tip[1]);
      } else {
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const a = a0 + (a1 - a0) * t;
          const r = rRoot + (rOuter - rRoot) * Math.sin(Math.PI * t) ** 0.6;
          if (i === 0 && s === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
      }
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, rInner, 0, TAU, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -len / 2);
    g.rotateY(Math.PI / 2);
    return g;
  });

/** Point on a circle of radius r about +x at angle φ (from +y toward +z). */
export const onCircle = (x: number, r: number, phi: number) =>
  new THREE.Vector3(x, r * Math.cos(phi), r * Math.sin(phi));

/** One instanced mesh with `count` copies placed by `place(i, matrix)`. */
export function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  place: (i: number, dummy: THREE.Object3D) => void,
) {
  const im = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    place(i, dummy);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true;
  im.receiveShadow = true;
  im.userData.noEdges = true;
  im.computeBoundingSphere();
  im.computeBoundingBox();
  return im;
}

/** Many tubes merged into one geometry (wiring looms). */
export function tubes(curves: THREE.Curve<THREE.Vector3>[], radius: number, segments = 24, radial = 5) {
  const parts = curves.map((c) => new THREE.TubeGeometry(c, segments, radius, radial, false));
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Empty marker used as a callout anchor. */
export function anchor(parent: THREE.Object3D, pos: [number, number, number] | THREE.Vector3) {
  const a = new THREE.Object3D();
  if (pos instanceof THREE.Vector3) a.position.copy(pos);
  else a.position.set(...pos);
  parent.add(a);
  return a;
}

export function group(name?: string, pos?: [number, number, number]) {
  const g = new THREE.Group();
  if (name) g.name = name;
  if (pos) g.position.set(...pos);
  return g;
}
