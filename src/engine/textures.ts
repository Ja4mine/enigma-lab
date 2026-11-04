import * as THREE from "three";

/** Lettering used on keys, rings and drums (DIN-like Barlow). */
export const LETTER_FONT = '"Barlow Semi Condensed", "Arial Narrow", sans-serif';

export async function loadLetterFonts() {
  if (!("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`600 64px ${LETTER_FONT}`),
      document.fonts.load(`400 32px "Courier Prime"`),
    ]);
  } catch {
    /* fall back to system faces */
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

/** Deterministic pseudo-random numbers so textures are identical every load. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const cache = new Map<string, THREE.Texture>();
const cached = (key: string, make: () => THREE.Texture) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};

/** Quarter-sawn oak: long grain lines, medullary flecks and pores. */
export function oakTexture() {
  return cached("oak", () => {
    const { c, g } = canvas(1024, 512);
    const r = rng(11);
    g.fillStyle = "#9b7650";
    g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 260; i++) {
      const y0 = r() * 512,
        amp = 2 + r() * 7,
        freq = 0.002 + r() * 0.006,
        phase = r() * 6;
      const dark = r() < 0.6;
      g.strokeStyle = dark
        ? `rgba(70,45,24,${0.08 + r() * 0.22})`
        : `rgba(205,170,120,${0.05 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      for (let x = 0; x <= 1024; x += 16) {
        const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 180; i++) {
      // medullary rays: short, lighter, slightly glossy flakes
      const x = r() * 1024,
        y = r() * 512,
        w = 14 + r() * 60;
      g.fillStyle = `rgba(214,182,135,${0.08 + r() * 0.12})`;
      g.beginPath();
      g.ellipse(x, y, w, 1 + r() * 2.2, (r() - 0.5) * 0.08, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(55,35,18,${0.1 + r() * 0.2})`;
      g.fillRect(r() * 1024, r() * 512, 1 + r() * 3, 0.8);
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 32, 1 / 16); // UVs are in centimetres
    return t;
  });
}

/** Grey speckle used as bump for wrinkle paint and cast metal. */
export function speckleTexture() {
  return cached("speckle", () => {
    const { c, g } = canvas(256, 256);
    const r = rng(5);
    g.fillStyle = "#808080";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = Math.floor(60 + r() * 140);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 0.6 + r() * 2.4, 0, Math.PI * 2);
      g.fill();
    }
    const t = toTexture(c, false);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.3, 0.3);
    return t;
  });
}

/**
 * Labels around a cylinder side (CylinderGeometry rotated so its axis is +x).
 * `angleOf(i)` is the label's angle φ, measured about +x from +y toward +z.
 * Text runs along the axis and reads from the front-top.
 */
export function ringLabelTexture(
  key: string,
  labels: string[],
  angleOf: (i: number) => number,
  opts: { bg: string; fg: string; height?: number; size?: number; ticks?: boolean; tickColor?: string },
) {
  return cached(key, () => {
    const W = 2048,
      H = opts.height ?? 160;
    const { c, g } = canvas(W, H);
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = opts.fg;
    g.font = `600 ${opts.size ?? 58}px ${LETTER_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const n = labels.length;
    for (let i = 0; i < n; i++) {
      const phi = angleOf(i);
      // φ = θ + π/2 for a Y cylinder rotated by −90° about z; u = θ / 2π.
      let u = (phi - Math.PI / 2) / (Math.PI * 2);
      u -= Math.floor(u);
      const x = u * W;
      for (const dx of [-W, 0, W]) {
        g.save();
        g.translate(x + dx, H / 2);
        g.rotate(-Math.PI / 2);
        g.fillText(labels[i], 0, 2);
        g.restore();
        if (opts.ticks) {
          g.fillStyle = opts.tickColor ?? opts.fg;
          const half = W / n / 2;
          g.fillRect(x + dx + half - 1, 0, 2, H * 0.18);
          g.fillRect(x + dx + half - 1, H * 0.82, 2, H * 0.18);
          g.fillStyle = opts.fg;
        }
      }
    }
    const t = toTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return t;
  });
}

/** Round cap with a centred glyph (keys, lamp windows, plugboard labels). */
export function glyphTexture(
  key: string,
  glyph: string,
  opts: { bg: string; fg: string; size?: number; ring?: string; font?: string; weight?: number; glowOnly?: boolean },
) {
  return cached(key, () => {
    const S = 128;
    const { c, g } = canvas(S, S);
    g.fillStyle = opts.glowOnly ? "#000" : opts.bg;
    g.fillRect(0, 0, S, S);
    if (opts.ring && !opts.glowOnly) {
      g.strokeStyle = opts.ring;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = opts.fg;
    g.font = `${opts.weight ?? 600} ${opts.size ?? 74}px ${opts.font ?? LETTER_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(glyph, S / 2, S / 2 + 4);
    return toTexture(c);
  });
}

/** Flat label strip, e.g. engraved plate text. */
export function plateTexture(
  key: string,
  text: string,
  opts: { w?: number; h?: number; bg: string; fg: string; size?: number; align?: CanvasTextAlign; font?: string },
) {
  return cached(key, () => {
    const W = opts.w ?? 512,
      H = opts.h ?? 96;
    const { c, g } = canvas(W, H);
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = opts.fg;
    g.font = `600 ${opts.size ?? 56}px ${opts.font ?? LETTER_FONT}`;
    g.textAlign = opts.align ?? "center";
    g.textBaseline = "middle";
    g.fillText(text, opts.align === "left" ? 16 : W / 2, H / 2 + 3);
    return toTexture(c);
  });
}

/** Bombe drum face: A–Z round the rim (letter i at i·Δ clockwise from the top). */
export function drumFaceTexture(key: string, color: string | null, ink: string) {
  return cached(key, () => {
    const S = 512;
    const { c, g } = canvas(S, S);
    if (color) {
      g.fillStyle = color;
      g.fillRect(0, 0, S, S);
    }
    g.strokeStyle = color ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.55)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = ink;
    g.font = `600 44px ${LETTER_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 0; i < 26; i++) {
      // Letter i sits at angle i·Δ clockwise from the top in texture space.
      const a = (i / 26) * Math.PI * 2;
      const x = S / 2 + Math.sin(a) * S * 0.43,
        y = S / 2 - Math.cos(a) * S * 0.43;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillText(String.fromCharCode(65 + i), 0, 2);
      g.restore();
    }
    // Index mark beside A.
    g.fillStyle = ink;
    g.beginPath();
    g.moveTo(S / 2, S * 0.015);
    g.lineTo(S / 2 - 9, S * 0.0);
    g.lineTo(S / 2 + 9, S * 0.0);
    g.fill();
    return toTexture(c);
  });
}
