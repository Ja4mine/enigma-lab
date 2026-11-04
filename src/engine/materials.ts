import * as THREE from "three";
import { wrinkleHeight } from "./textures";
import { normalFromHeight, vintageMaps, type VintageSurface } from "./vintage";

export type Theme = "light" | "dark";

/** Aged surface with `repeat` tiles per UV unit. Box-projected UVs are in cm. */
function surface(kind: VintageSurface, repeat = 1, normal = 1) {
  const m = vintageMaps(kind);
  const clone = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(repeat, repeat);
    c.needsUpdate = true;
    return c;
  };
  return {
    map: clone(m.map),
    roughnessMap: clone(m.roughnessMap),
    normalMap: clone(m.normalMap),
    normalScale: new THREE.Vector2(normal, normal),
  };
}

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

/** Wrinkle-finish paint, as on the real machine's lid and panels. */
export function wrinkle(repeat: number) {
  const n = normalFromHeight(wrinkleHeight(), 3);
  n.repeat.set(repeat, repeat);
  return { normalMap: n, normalScale: new THREE.Vector2(0.7, 0.7) };
}

/** Shared physical materials. Created lazily because textures need a DOM. */
function create() {
  const paint = wrinkle(0.1);
  return {
    // Old varnished hardwood. Roughness comes from the map, so the varnish looks worn in places.
    oak: phys({ ...surface("wood", 1 / 24, 0.7), color: "#a97c50", roughness: 1, clearcoat: 0.2, clearcoatRoughness: 0.45 }),
    oakEnd: phys({ ...surface("wood", 1 / 24, 0.7), color: "#8c6642", roughness: 1, clearcoat: 0.16, clearcoatRoughness: 0.5 }),
    felt: std({ ...surface("enamel", 1 / 16, 0.3), color: "#6e6c44", roughness: 1 }),
    crackle: phys({ ...paint, color: "#24231d", roughness: 0.8, metalness: 0, specularIntensity: 0.35 }),
    castGrey: std({ ...surface("steel", 1 / 30, 0.5), color: "#57574c", roughness: 0.8, metalness: 0.45 }),
    bakelite: phys({ ...surface("bakelite", 0.2, 0.25), color: "#2c1e15", roughness: 0.75, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    bakeliteBrown: phys({ ...surface("bakelite", 0.2, 0.25), color: "#452b1c", roughness: 0.75, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    nickel: std({ ...surface("steel", 0.6, 0.3), color: "#bdb7a4", roughness: 0.72, metalness: 1 }),
    aluminium: std({ ...surface("steel", 0.6, 0.4), color: "#a29c8b", roughness: 0.95, metalness: 0.75 }),
    steel: std({ ...surface("steel", 0.15, 0.4), color: "#9a9584", roughness: 0.8, metalness: 1 }),
    darkSteel: std({ ...surface("steel", 0.15, 0.4), color: "#3f3b31", roughness: 0.85, metalness: 0.85 }),
    brass: std({ ...surface("brass", 0.6, 0.4), color: "#c39a58", roughness: 0.8, metalness: 1 }),
    copper: std({ ...surface("brass", 0.15, 0.3), color: "#cf8a58", roughness: 0.7, metalness: 1 }),
    cable: std({ color: "#2f271f", roughness: 0.92 }),
    cableRed: std({ color: "#7d2d22", roughness: 0.85 }),
    glass: phys({
      color: "#f2ecdd",
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
    bulb: phys({ color: "#f3e9d2", roughness: 0.14, transparent: true, opacity: 0.7, emissive: "#000000" }),
    paper: std({ ...surface("enamel", 1 / 14, 0.15), color: "#d9c9a6", roughness: 0.95 }),
    red: std({ color: "#8f3524", roughness: 0.6 }),
    rubber: std({ color: "#14110d", roughness: 0.95 }),
  };
}

export type MaterialLibrary = ReturnType<typeof create>;
let library: MaterialLibrary | null = null;
export const materials = () => (library ??= create());

/**
 * Keeps decals and ink lines stable on their surfaces. Solid faces are pushed
 * back a little and printed decals pulled forward, so neither fights the depth
 * buffer as the view turns.
 */
export function layerMaterial(material: THREE.Material, decal: boolean) {
  material.polygonOffset = true;
  material.polygonOffsetFactor = decal ? -2 : 1;
  material.polygonOffsetUnits = decal ? -2 : 1;
}

/* Theme-dependent overlay materials (ghost/x-ray parts and ink edges). */
export const overlay = {
  ghost: new THREE.MeshBasicMaterial({
    color: "#fff6e4",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  }),
  /** Everything outside the part under inspection: nearly gone, not a drawing. */
  faint: new THREE.MeshBasicMaterial({ color: "#fff6e4", transparent: true, opacity: 0.045, depthWrite: false }),
  edge: new THREE.LineBasicMaterial({ color: "#2b2115", transparent: true, opacity: 0.42 }),
  edgeGhost: new THREE.LineBasicMaterial({ color: "#2b2115", transparent: true, opacity: 0.1, depthWrite: false }),
  edgeHover: new THREE.LineBasicMaterial({ color: "#2b2115", transparent: true, opacity: 0.95 }),
  forward: new THREE.MeshBasicMaterial({ color: "#d07a10", toneMapped: false }),
  back: new THREE.MeshBasicMaterial({ color: "#2f7f77", toneMapped: false }),
  wire: new THREE.MeshStandardMaterial({ color: "#b8693a", roughness: 0.45, metalness: 0.85 }),
  wireDim: new THREE.MeshBasicMaterial({ color: "#a26a45", transparent: true, opacity: 0.35, depthWrite: false }),
};

export function applyTheme(theme: Theme) {
  const dark = theme === "dark";
  overlay.ghost.color.set(dark ? "#b39f7e" : "#fff6e4");
  overlay.ghost.opacity = dark ? 0.08 : 0.2;
  overlay.faint.color.set(dark ? "#b39f7e" : "#fff6e4");
  const ink = dark ? "#efe3cc" : "#2b2115";
  overlay.edge.color.set(dark ? "#000000" : ink);
  overlay.edge.opacity = dark ? 0.5 : 0.34;
  overlay.edgeGhost.color.set(ink);
  overlay.edgeGhost.opacity = dark ? 0.16 : 0.13;
  overlay.edgeHover.color.set(dark ? "#e8a33a" : ink);
  overlay.forward.color.set(dark ? "#e8a33a" : "#d07a10");
  overlay.back.color.set(dark ? "#5cb5a9" : "#2f7f77");
}

/** Colours of the British Bombe drums by Enigma wheel number. */
export const DRUM_COLORS: Record<string, string> = {
  I: "#8a3a2e",
  II: "#5c2c33",
  III: "#3f5a45",
  IV: "#a98a48",
  V: "#5f4630",
};
