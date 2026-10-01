import type { SignalStage } from "../core/enigma";
import { letter } from "../core/enigma";
import type { Language } from "../i18n";

/** Both coordinate systems describe the same conductor, not two extra substitutions. */
export default function RotorReadout({
  stage,
  language,
}: {
  stage: SignalStage;
  language: Language;
}) {
  if (
    !stage.rotorId ||
    stage.position === undefined ||
    stage.ring === undefined ||
    stage.shiftedInput === undefined ||
    stage.wiredOutput === undefined
  )
    return null;
  const en = language === "en";
  const offset = stage.position - stage.ring;
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
  const nodes = [
    [en ? "External in" : "外部输入", stage.input],
    [en ? "Core in" : "线芯入口", stage.shiftedInput],
    [en ? "Core out" : "线芯出口", stage.wiredOutput],
    [en ? "External out" : "外部输出", stage.output],
  ] as const;
  const operations = [
    signed(offset),
    stage.direction === "reverse" ? `${stage.rotorId}⁻¹` : stage.rotorId,
    signed(-offset),
  ];
  return (
    <div
      className="rotor-readout"
      aria-label={en ? "External and core contacts" : "外部触点与线芯换算"}
    >
      <p className="rotor-offset">
        {en ? "Window" : "窗口"} <b>{letter(stage.position)}</b> ·{" "}
        {en ? "Ring" : "环"} <b>{String(stage.ring + 1).padStart(2, "0")}</b> ·{" "}
        {en ? "Offset" : "偏移"} <b>{signed(offset)}</b>
      </p>
      <div className="rotor-coordinate-chain">
        {nodes.map(([label, value], i) => (
          <div
            className={
              i === 1 || i === 2 ? "core-coordinate" : "external-coordinate"
            }
            key={label}
          >
            <small>{label}</small>
            <b>{letter(value)}</b>
            {i < 3 && (
              <span className="coordinate-operation">
                <small>{operations[i]}</small>→
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="rotor-coordinate-note">
        {en
          ? "Large 3D letters are external contacts; “Core” identifies the fixed internal wire. Letters wrap A–Z."
          : "三维大字母表示外部触点；“线芯”标明内部固定接线。字母按 A–Z 循环。"}
      </p>
    </div>
  );
}
