import * as THREE from "three";
import { oakTexture, speckleTexture } from "./textures";
import { vintageMaps, type VintageSurface } from "./vintage";

export type Theme = "light" | "dark";

/** Repeat a surface per centimetre-ish so its grain reads at machine scale. */
function surface(kind: VintageSurface, repeat = 1) {
  const m = vintageMaps(kind);
  const clone = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(repeat, repeat);
    c.needsUpdate = true;
    return c;
  };
  return { map: clone(m.map), roughnessMap: clone(m.roughnessMap), bumpMap: clone(m.bumpMap), bumpScale: m.bumpScale * 40 };
}

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

/** Shared physical materials. Created lazily because textures need a DOM. */
function create() {
  const oak = oakTexture();
  const speck = speckleTexture();
  return {
    // Old varnished case: the grain comes from the oak map, the stain from here.
    oak: std({ map: oak, color: "#b98a68", roughness: 0.64, metalness: 0 }),
    oakEnd: std({ map: oak, color: "#96694e", roughness: 0.7 }),
    felt: std({ color: "#6d6b4c", roughness: 1 }),
    crackle: std({ color: "#2a281f", roughness: 0.74, metalness: 0.1, bumpMap: speck, bumpScale: 0.6 }),
    castGrey: std({ color: "#6a6455", roughness: 0.6, metalness: 0.5, bumpMap: speck, bumpScale: 0.25 }),
    bakelite: phys({ ...surface("bakelite", 0.12), color: "#4c3424", roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.42 }),
    bakeliteBrown: phys({ ...surface("bakelite", 0.12), color: "#6a4128", roughness: 0.5, clearcoat: 0.3 }),
    nickel: std({ ...surface("steel", 0.1), color: "#cfc8b4", roughness: 0.42, metalness: 0.92 }),
    aluminium: std({ ...surface("steel", 0.1), color: "#c9c2ae", roughness: 0.52, metalness: 0.85 }),
    steel: std({ ...surface("steel", 0.1), color: "#8e8a78", roughness: 0.5, metalness: 0.9 }),
    darkSteel: std({ ...surface("steel", 0.04), color: "#4a4538", roughness: 0.62, metalness: 0.7 }),
    brass: std({ ...surface("brass", 0.1), color: "#d9b06a", roughness: 0.44, metalness: 0.95 }),
    copper: std({ ...surface("brass", 0.1), color: "#c98452", roughness: 0.44, metalness: 0.95 }),
    cable: std({ color: "#2f271f", roughness: 0.92 }),
    cableRed: std({ color: "#7d2d22", roughness: 0.85 }),
    glass: phys({
      color: "#f2ecdd",
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
    bulb: phys({ color: "#f3e9d2", roughness: 0.14, transparent: true, opacity: 0.7, emissive: "#000000" }),
    paper: std({ color: "#e6d9bc", roughness: 0.92 }),
    red: std({ color: "#9c3a26", roughness: 0.55 }),
    rubber: std({ color: "#17130f", roughness: 0.95 }),
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
  I: "#a33a2c",
  II: "#6b2a34",
  III: "#3f6a4b",
  IV: "#c99a3c",
  V: "#6f4b2f",
};
