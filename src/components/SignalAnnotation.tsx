import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Point3 } from "../core/visual-paths";

export interface SignalAnnotationProps {
  text: string;
  secondaryText?: string;
  position: Point3;
  color: string;
  compact?: boolean;
  variant?: "mapping" | "contact" | "reference";
  /** Light engraving-like ink for annotations placed over dark machine panels. */
  tone?: "ink" | "light";
}

const FONT_FAMILY =
  '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif';
const INK = "#4c3b29";
const MUTED_INK = "#776348";
const PAPER_HALO = "rgba(242, 230, 206, 0.87)";
const ignoreRaycast = () => {};

/**
 * Floating ink, not a label card. A very fine paper-coloured outline keeps the
 * letters legible across the wooden case and dark enamel without a background.
 * Native sprites participate in their parent's material fade and lifecycle.
 */
export function SignalAnnotation({
  text,
  secondaryText,
  position,
  color,
  compact = false,
  variant = "mapping",
  tone = "ink",
}: SignalAnnotationProps) {
  const { texture, width, height } = useMemo(() => {
    const contact =
      variant === "contact" ||
      (variant === "mapping" && compact && !secondaryText);
    const reference = variant === "reference";
    const primarySize = contact ? 64 : 52;
    const secondarySize = contact ? 32 : reference ? 29 : 31;
    const primaryWeight = contact ? 650 : 600;
    const secondaryWeight = 500;
    const canvas = document.createElement("canvas");
    const measure = canvas.getContext("2d")!;
    measure.font = `${primaryWeight} ${primarySize}px ${FONT_FAMILY}`;
    const primaryWidth = measure.measureText(text).width;
    measure.font = `${secondaryWeight} ${secondarySize}px ${FONT_FAMILY}`;
    const secondaryWidth = secondaryText
      ? measure.measureText(secondaryText).width
      : 0;
    const pad = contact ? 7 : 9;
    const markerInset = contact ? 0 : 13;
    const lineGap = secondaryText ? 12 : 0;
    const primaryY = pad + primarySize * 0.56;
    const secondaryY = pad + primarySize + lineGap + secondarySize * 0.48;
    const inkHeight = secondaryText
      ? primarySize + lineGap + secondarySize
      : primarySize;
    // Width follows the actual glyphs, including compact one-letter endpoints.
    // There is no minimum card width and no invisible panel-shaped padding.
    canvas.width = Math.ceil(
      Math.max(primaryWidth, secondaryWidth) + pad * 2 + markerInset,
    );
    canvas.height = Math.ceil(inkHeight + pad * 2 + (contact ? 2 : 8));
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const x = pad + markerInset;
    const drawInk = (
      value: string,
      y: number,
      size: number,
      weight: number,
      fill: string,
      halo: number,
    ) => {
      ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
      ctx.strokeStyle = tone === "light" ? "rgba(42, 36, 27, 0.8)" : PAPER_HALO;
      ctx.lineWidth = halo;
      ctx.strokeText(value, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(value, x, y);
    };
    drawInk(
      text,
      primaryY,
      primarySize,
      primaryWeight,
      contact
        ? color
        : tone === "light"
          ? "#eee0bd"
          : reference
            ? MUTED_INK
            : INK,
      contact ? 3 : 2.6,
    );
    if (secondaryText)
      drawInk(
        secondaryText,
        secondaryY,
        secondarySize,
        secondaryWeight,
        tone === "light" ? "#cabb9b" : MUTED_INK,
        2.2,
      );
    if (!contact) {
      // One small point ties the annotation to the signal colour. The short
      // underline is an accent, deliberately unrelated to the text's bounds.
      ctx.fillStyle = color;
      ctx.globalAlpha = reference ? 0.72 : 0.9;
      ctx.beginPath();
      ctx.arc(pad + 1.5, primaryY, reference ? 2.4 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = reference ? 1.5 : 2;
      const underlineY = canvas.height - pad * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, underlineY);
      ctx.lineTo(
        x + Math.min(reference ? 24 : 37, primaryWidth * 0.4),
        underlineY,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = false;
    // Keep actual glyph height readable without giving short labels the width
    // of long ones. A slight reduction for long copy avoids masking neighbours.
    const longCopy = Math.max(
      primaryWidth / primarySize,
      secondaryWidth / secondarySize,
    );
    const compression = Math.max(
      0.85,
      Math.min(1, 17 / Math.max(17, longCopy)),
    );
    const primaryWorldSize = contact
      ? compact
        ? 0.13
        : 0.19
      : reference
        ? compact
          ? 0.135
          : 0.155
        : compact
          ? 0.155
          : 0.16;
    const unitsPerPixel = (primaryWorldSize * compression) / primarySize;
    return {
      texture: map,
      width: canvas.width * unitsPerPixel,
      height: canvas.height * unitsPerPixel,
    };
  }, [text, secondaryText, color, compact, variant, tone]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={position}
      scale={[width, height, 1]}
      renderOrder={20}
      raycast={ignoreRaycast}
    >
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

export default SignalAnnotation;
