import { useEffect, useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";

export type VintageSurface = "wood" | "brass" | "steel" | "bakelite" | "enamel";
type VintageMaps = {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  bumpScale: number;
};
type CachedSurface = {
  maps: VintageMaps;
  users: number;
  release?: ReturnType<typeof setTimeout>;
};
const surfaces = new Map<VintageSurface, CachedSurface>();

function randomSequence(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** Local, deterministic pigments and relief; they never touch labels or wiring. */
function createSurface(kind: VintageSurface): VintageMaps {
  const size = kind === "wood" ? 512 : 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const relief = document.createElement("canvas");
  relief.width = relief.height = size;
  const roughness = document.createElement("canvas");
  roughness.width = roughness.height = size;
  const ctx = canvas.getContext("2d")!,
    bump = relief.getContext("2d")!,
    rough = roughness.getContext("2d")!;
  const rand = randomSequence(
    { wood: 1807, brass: 4057, steel: 2011, bakelite: 3041, enamel: 709 }[kind],
  );
  ctx.fillStyle = {
    wood: "#956b43",
    brass: "#e7dabc",
    steel: "#d8d7ce",
    bakelite: "#ded8cc",
    enamel: "#dbd7c7",
  }[kind];
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#808080";
  bump.fillRect(0, 0, size, size);
  rough.fillStyle =
    kind === "wood" ? "#dedede" : kind === "bakelite" ? "#ababab" : "#c8c8c8";
  rough.fillRect(0, 0, size, size);
  if (kind === "wood") {
    // Long irregular grain and growth bands, with pores beneath old varnish.
    for (let row = -24; row < size + 24; row += 0.9) {
      const wave = 3.2 * Math.sin(row * 0.073) + 1.4 * Math.sin(row * 0.31);
      ctx.strokeStyle = `rgba(41,23,11,${0.07 + rand() * 0.19})`;
      ctx.lineWidth = 0.3 + rand() * 1.3;
      ctx.beginPath();
      ctx.moveTo(0, row);
      ctx.bezierCurveTo(
        size * 0.25,
        row + wave,
        size * 0.73,
        row - wave * 1.3,
        size,
        row,
      );
      ctx.stroke();
      bump.strokeStyle = `rgba(30,30,30,${0.03 + rand() * 0.06})`;
      bump.lineWidth = 0.55;
      bump.beginPath();
      bump.moveTo(0, row);
      bump.bezierCurveTo(
        size * 0.25,
        row + wave,
        size * 0.73,
        row - wave * 1.3,
        size,
        row,
      );
      bump.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const y = rand() * size;
      const stain = ctx.createLinearGradient(0, y - 16, 0, y + 16);
      stain.addColorStop(0, "rgba(27,15,8,0)");
      stain.addColorStop(0.5, `rgba(38,20,9,${0.035 + rand() * 0.065})`);
      stain.addColorStop(1, "rgba(27,15,8,0)");
      ctx.fillStyle = stain;
      ctx.fillRect(0, y - 16, size, 32);
    }
    // Soft rub-through along edges and a few small nicks, not evenly worn stripes.
    for (let i = 0; i < 160; i++) {
      const x = rand() * size,
        y = rand() < 0.5 ? rand() * 7 : size - rand() * 7;
      ctx.fillStyle = `rgba(222,175,109,${0.06 + rand() * 0.16})`;
      ctx.fillRect(x, y, 2 + rand() * 13, 0.5 + rand());
    }
  } else {
    const patina =
      kind === "brass"
        ? "69,82,61"
        : kind === "steel"
          ? "86,79,64"
          : "50,46,35";
    if (kind === "brass") {
      // Fine overlapping value-noise fields produce irregular oxidation rather
      // than radial spots. Periodic grids keep texture seams imperceptible.
      const fields = [13, 31, 71].map((count) => ({
        count,
        values: Array.from({ length: count * count }, () => rand()),
      }));
      const fieldAt = (
        field: (typeof fields)[number],
        x: number,
        y: number,
      ) => {
        const u = (x / size) * field.count,
          v = (y / size) * field.count;
        const ix = Math.floor(u),
          iy = Math.floor(v);
        const fx = u - ix,
          fy = v - iy;
        const sx = fx * fx * (3 - 2 * fx),
          sy = fy * fy * (3 - 2 * fy);
        const at = (a: number, b: number) =>
          field.values[(b % field.count) * field.count + (a % field.count)];
        return (
          (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) +
          (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy
        );
      };
      const pigment = ctx.getImageData(0, 0, size, size);
      const matte = rough.getImageData(0, 0, size, size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const n =
            fieldAt(fields[0], x, y) * 0.43 +
            fieldAt(fields[1], x, y) * 0.37 +
            fieldAt(fields[2], x, y) * 0.2;
          const tarnish = Math.max(0, n - 0.34) * 0.43;
          const offset = (y * size + x) * 4;
          [94, 99, 72].forEach((shade, channel) => {
            pigment.data[offset + channel] =
              pigment.data[offset + channel] * (1 - tarnish) + shade * tarnish;
            matte.data[offset + channel] = 193 + n * 36;
          });
        }
      ctx.putImageData(pigment, 0, 0);
      rough.putImageData(matte, 0, 0);
      // Tiny broken flecks add a second scale; no dark circular centers.
      for (let i = 0; i < 340; i++) {
        const x = rand() * size,
          y = rand() * size,
          r = 0.5 + rand() * 2.1;
        ctx.fillStyle = `rgba(86,90,65,${0.035 + rand() * 0.085})`;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x - r * 0.24, y - r * 0.65);
        ctx.lineTo(x + r * 0.77, y - r * 0.34);
        ctx.lineTo(x + r * 0.44, y + r * 0.71);
        ctx.lineTo(x - r * 0.6, y + r * 0.36);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 26; i++) {
        const x = rand() * size,
          y = rand() * size,
          r = 7 + rand() * 29;
        const spot = ctx.createRadialGradient(x, y, 0, x, y, r);
        spot.addColorStop(
          0,
          `rgba(${patina},${kind === "enamel" ? 0.06 + rand() * 0.12 : 0.035 + rand() * 0.09})`,
        );
        spot.addColorStop(1, `rgba(${patina},0)`);
        ctx.fillStyle = spot;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        const matte = rough.createRadialGradient(x, y, 0, x, y, r);
        matte.addColorStop(0, "rgba(250,250,250,.3)");
        matte.addColorStop(1, "rgba(250,250,250,0)");
        rough.fillStyle = matte;
        rough.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    if (kind === "enamel") {
      // A few worn patches expose the warmer undercoat without broad rust.
      for (let i = 0; i < 14; i++) {
        const x = rand() * size,
          y = rand() * size,
          r = 3 + rand() * 8;
        const wear = ctx.createRadialGradient(x, y, 0, x, y, r);
        wear.addColorStop(0, `rgba(228,214,176,${0.08 + rand() * 0.1})`);
        wear.addColorStop(1, "rgba(228,214,176,0)");
        ctx.fillStyle = wear;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // Fine handling marks are directional and vary in length and depth.
    for (let i = 0; i < (kind === "bakelite" ? 110 : 170); i++) {
      const x = rand() * size,
        y = rand() * size,
        length = 0.8 + rand() * (kind === "steel" ? 30 : 12),
        slant = (rand() - 0.5) * 5;
      ctx.strokeStyle = `rgba(250,238,208,${0.025 + rand() * 0.12})`;
      ctx.lineWidth = 0.3 + rand() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y + slant);
      ctx.stroke();
      bump.strokeStyle = "rgba(35,35,35,.15)";
      bump.lineWidth = 0.4;
      bump.beginPath();
      bump.moveTo(x, y);
      bump.lineTo(x + length, y + slant);
      bump.stroke();
    }
    if (kind === "bakelite") {
      // Broad satin polish where fingers repeatedly touch the cap/grip.
      const polish = rough.createRadialGradient(
        size * 0.47,
        size * 0.46,
        5,
        size * 0.47,
        size * 0.46,
        size * 0.45,
      );
      polish.addColorStop(0, "rgba(42,42,42,.65)");
      polish.addColorStop(1, "rgba(42,42,42,0)");
      rough.fillStyle = polish;
      rough.fillRect(0, 0, size, size);
    }
  }
  for (let i = 0; i < size * 5; i++) {
    const x = rand() * size,
      y = rand() * size;
    ctx.fillStyle = `rgba(25,23,15,${rand() * 0.055})`;
    ctx.fillRect(x, y, 0.5, 0.5);
  }
  const texture = (source: HTMLCanvasElement, color = false) => {
    const map = new THREE.CanvasTexture(source);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };
  return {
    map: texture(canvas, true),
    roughnessMap: texture(roughness),
    bumpMap: texture(relief),
    bumpScale: kind === "wood" ? 0.012 : kind === "brass" ? 0.004 : 0.002,
  };
}

/** A small ref-counted shared palette, released after the last model unmounts. */
export function useVintageMaps(kind: VintageSurface): VintageMaps {
  const entry = useMemo(() => {
    let surface = surfaces.get(kind);
    if (!surface) {
      surface = { maps: createSurface(kind), users: 0 };
      surfaces.set(kind, surface);
    }
    return surface;
  }, [kind]);
  useEffect(() => {
    if (entry.release) clearTimeout(entry.release);
    entry.users++;
    return () => {
      entry.users--;
      entry.release = setTimeout(() => {
        if (entry.users || surfaces.get(kind) !== entry) return;
        entry.maps.map.dispose();
        entry.maps.roughnessMap.dispose();
        entry.maps.bumpMap.dispose();
        surfaces.delete(kind);
      }, 1000);
    };
  }, [entry, kind]);
  return entry.maps;
}

export function VintageMaterial({
  surface = "brass",
  ...props
}: ThreeElements["meshStandardMaterial"] & { surface?: VintageSurface }) {
  const maps = useVintageMaps(surface);
  return <meshStandardMaterial {...maps} {...props} />;
}
