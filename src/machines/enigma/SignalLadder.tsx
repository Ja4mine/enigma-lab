import { ALPHABET, type KeyResult } from "../../core/enigma";
import { useLang } from "../../i18n";

const COLS = 6;
const ROW = 9.2;
const TOP = 30;
const LEFT = 26;
const WIDTH = 360;
const colX = (c: number) => LEFT + c * ((WIDTH - LEFT - 18) / (COLS - 1));
const rowY = (r: number) => TOP + r * ROW;

/**
 * Contact ladder: the 26 contacts at each boundary of the circuit, from the
 * keyboard on the left to the reflector on the right. Amber goes out, teal
 * comes back. `progress` (0…2) reveals the path in step with the 3D view.
 */
export function SignalLadder({ trace, progress }: { trace: KeyResult | null; progress: number }) {
  const { lang } = useLang();
  const labels =
    lang === "zh"
      ? ["键/灯", "插线板", "右转子", "中转子", "左转子", "反射器"]
      : ["Key/lamp", "Plugboard", "Right", "Middle", "Left", "Reflector"];
  const st = trace ? Object.fromEntries(trace.stages.map((s) => [s.id, s])) : null;
  let fwd = "",
    back = "";
  const hits: { c: number; r: number; dir: "fwd" | "back" }[] = [];
  if (st) {
    const f = [
      [0, st["plug-in"].input, 1, st["plug-in"].output],
      [1, st["right-forward"].input, 2, st["right-forward"].output],
      [2, st["middle-forward"].input, 3, st["middle-forward"].output],
      [3, st["left-forward"].input, 4, st["left-forward"].output],
    ];
    fwd = f.map(([c0, r0, c1, r1], i) => `${i ? "L" : "M"}${colX(c0)} ${rowY(r0)} L${colX(c1)} ${rowY(r1)}`).join(" ");
    // Reflector: a short loop at the last column.
    const r4 = st.reflector.input,
      r5 = st.reflector.output;
    fwd += ` L${colX(5)} ${rowY(r4)} C${colX(5) + 12} ${rowY(r4)} ${colX(5) + 12} ${rowY(r5)} ${colX(5)} ${rowY(r5)}`;
    const b = [
      [5, st["left-reverse"].input, 4, st["left-reverse"].input],
      [4, st["left-reverse"].input, 3, st["left-reverse"].output],
      [3, st["middle-reverse"].input, 2, st["middle-reverse"].output],
      [2, st["right-reverse"].input, 1, st["right-reverse"].output],
      [1, st["plug-out"].input, 0, st["plug-out"].output],
    ];
    back = b.map(([c0, r0, c1, r1], i) => `${i ? "L" : "M"}${colX(c0)} ${rowY(r0)} L${colX(c1)} ${rowY(r1)}`).join(" ");
    f.forEach(([c0, r0]) => hits.push({ c: c0, r: r0, dir: "fwd" }));
    hits.push({ c: 4, r: r4, dir: "fwd" });
    b.forEach(([, , c1, r1]) => hits.push({ c: c1, r: r1, dir: "back" }));
  }
  const fp = Math.max(0, Math.min(1, progress));
  const bp = Math.max(0, Math.min(1, progress - 1));
  return (
    <svg
      className="ladder"
      viewBox={`0 0 ${WIDTH} ${TOP + 26 * ROW + 8}`}
      role="img"
      aria-label={
        trace
          ? `${trace.input} → ${trace.output}`
          : lang === "zh"
            ? "按一个键查看电流路径"
            : "Press a key to trace the current"
      }
    >
      {labels.map((l, c) => (
        <text key={l} className="col-label" x={colX(c)} y={14} textAnchor="middle">
          {l}
        </text>
      ))}
      {Array.from({ length: COLS }, (_, c) => (
        <line key={c} className="rail" x1={colX(c)} x2={colX(c)} y1={TOP - 6} y2={rowY(25) + 5} />
      ))}
      {[...ALPHABET].map((ch, r) => (
        <text
          key={ch}
          x={8}
          y={rowY(r) + 3}
          className={
            trace && (ch === trace.input || (progress >= 2 && ch === trace.output)) ? "hit-label" : undefined
          }
        >
          {ch}
        </text>
      ))}
      {fwd && <path className="fwd" d={fwd} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - fp} />}
      {back && <path className="back" d={back} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - bp} />}
      {progress > 0 &&
        hits.map((h, i) => (
          <circle
            key={i}
            cx={colX(h.c)}
            cy={rowY(h.r)}
            r={2.6}
            className={h.dir === "fwd" ? "hit-fwd" : "hit-back"}
            opacity={h.dir === "fwd" ? fp : bp}
          />
        ))}
    </svg>
  );
}
