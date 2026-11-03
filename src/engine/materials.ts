import * as THREE from "three";
import { oakTexture, speckleTexture } from "./textures";

export type Theme = "light" | "dark";

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

/** Shared physical materials. Created lazily because textures need a DOM. */
function create() {
  const oak = oakTexture();
  const speck = speckleTexture();
  return {
    oak: std({ map: oak, color: "#ffffff", roughness: 0.62, metalness: 0 }),
    oakEnd: std({ map: oak, color: "#d8c6ae", roughness: 0.7 }),
    felt: std({ color: "#8c8f86", roughness: 1 }),
    crackle: std({ color: "#202224", roughness: 0.78, metalness: 0.15, bumpMap: speck, bumpScale: 0.6 }),
    castGrey: std({ color: "#5d6266", roughness: 0.55, metalness: 0.55, bumpMap: speck, bumpScale: 0.25 }),
    bakelite: phys({ color: "#16110d", roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    bakeliteBrown: phys({ color: "#3a2416", roughness: 0.36, clearcoat: 0.4 }),
    nickel: std({ color: "#d6d6d2", roughness: 0.26, metalness: 1 }),
    aluminium: std({ color: "#c5c8ca", roughness: 0.4, metalness: 1 }),
    steel: std({ color: "#7d8287", roughness: 0.38, metalness: 1 }),
    darkSteel: std({ color: "#3d4145", roughness: 0.45, metalness: 1 }),
    brass: std({ color: "#c79b45", roughness: 0.3, metalness: 1 }),
    copper: std({ color: "#c8743f", roughness: 0.32, metalness: 1 }),
    cable: std({ color: "#2c2622", roughness: 0.92 }),
    cableRed: std({ color: "#7d2d22", roughness: 0.85 }),
    glass: phys({
      color: "#eef3f1",
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
    bulb: phys({ color: "#f3efe2", roughness: 0.12, transparent: true, opacity: 0.7, emissive: "#000000" }),
    paper: std({ color: "#ece6d8", roughness: 0.9 }),
    red: std({ color: "#a8342a", roughness: 0.5 }),
    rubber: std({ color: "#121212", roughness: 0.95 }),
  };
}

export type MaterialLibrary = ReturnType<typeof create>;
let library: MaterialLibrary | null = null;
export const materials = () => (library ??= create());

/* Theme-dependent overlay materials (ghost/x-ray parts and ink edges). */
export const overlay = {
  ghost: new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  }),
  edge: new THREE.LineBasicMaterial({ color: "#191b1e", transparent: true, opacity: 0.42 }),
  edgeGhost: new THREE.LineBasicMaterial({ color: "#191b1e", transparent: true, opacity: 0.1, depthWrite: false }),
  edgeHover: new THREE.LineBasicMaterial({ color: "#191b1e", transparent: true, opacity: 0.95 }),
  forward: new THREE.MeshBasicMaterial({ color: "#e08c06", toneMapped: false }),
  back: new THREE.MeshBasicMaterial({ color: "#0d9a92", toneMapped: false }),
  wire: new THREE.MeshStandardMaterial({ color: "#b8693a", roughness: 0.4, metalness: 0.9 }),
  wireDim: new THREE.MeshBasicMaterial({ color: "#a26a45", transparent: true, opacity: 0.35, depthWrite: false }),
};

export function applyTheme(theme: Theme) {
  const dark = theme === "dark";
  overlay.ghost.color.set(dark ? "#8b939c" : "#ffffff");
  overlay.ghost.opacity = dark ? 0.07 : 0.2;
  const ink = dark ? "#e9e7e2" : "#191b1e";
  overlay.edge.color.set(dark ? "#000000" : ink);
  overlay.edge.opacity = dark ? 0.5 : 0.4;
  overlay.edgeGhost.color.set(ink);
  overlay.edgeGhost.opacity = dark ? 0.16 : 0.11;
  overlay.edgeHover.color.set(dark ? "#f0a324" : ink);
  overlay.forward.color.set(dark ? "#f0a324" : "#e08c06");
  overlay.back.color.set(dark ? "#2db8b0" : "#0d9a92");
}

/** Colours of the British Bombe drums by Enigma wheel number. */
export const DRUM_COLORS: Record<string, string> = {
  I: "#b0342b",
  II: "#6e2433",
  III: "#2e6a47",
  IV: "#d6a630",
  V: "#6f4b2f",
};
