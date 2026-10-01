import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Layers2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Scan,
} from "lucide-react";
import {
  encryptKey,
  letter,
  plugboardMapping,
  REFLECTORS,
  rotorMapping,
} from "../core/enigma";
import type { MachineConfig } from "../core/enigma";
import { stageLabel, translate } from "../i18n";
import type { Language } from "../i18n";

type Trace = ReturnType<typeof encryptKey>;

export default function Circuit({
  config,
  trace,
  phase,
  language,
  onSeek,
  visible = true,
}: {
  config: MachineConfig;
  trace: Trace | null;
  phase: number;
  language: Language;
  onSeek: (phase: number) => void;
  visible?: boolean;
}) {
  const [allWires, setAllWires] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [diagramWidth, setDiagramWidth] = useState(800);
  const diagramRef = useRef<HTMLDivElement>(null);
  const phaseStripRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const t = (text: string) => translate(text, language);
  const diagramPixels =
    zoom === "fit" ? Math.max(640, diagramWidth - 2) : 955 * zoom;
  const phases = [
    language === "en" ? "Step" : "步进",
    language === "en" ? "Plug in" : "插线进入",
    `${config.rotors[2]} · ${language === "en" ? "FWD" : "正"}`,
    `${config.rotors[1]} · ${language === "en" ? "FWD" : "正"}`,
    `${config.rotors[0]} · ${language === "en" ? "FWD" : "正"}`,
    `UKW ${config.reflector}`,
    `${config.rotors[0]} · ${language === "en" ? "RET" : "返"}`,
    `${config.rotors[1]} · ${language === "en" ? "RET" : "返"}`,
    `${config.rotors[2]} · ${language === "en" ? "RET" : "返"}`,
    language === "en" ? "Plug out" : "插线返回",
    language === "en" ? "Lamp" : "点灯",
  ];
  const adjustZoom = (delta: number) => {
    const current = zoom === "fit" ? diagramPixels / 955 : zoom;
    setZoom(
      Math.max(0.5, Math.min(2, Math.round((current + delta) * 10) / 10)),
    );
  };
  useEffect(() => {
    const element = diagramRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // A temporarily hidden workspace has no useful fit width. Retain the
      // measured width so a mode switch cannot flash a tiny schematic.
      if (entry.contentRect.width > 0) setDiagramWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const strip = phaseStripRef.current;
    const item = strip?.children[Math.max(phase, 0)] as HTMLElement | undefined;
    if (!strip || !item) return;
    if (
      item.offsetLeft < strip.scrollLeft ||
      item.offsetLeft + item.offsetWidth > strip.scrollLeft + strip.clientWidth
    )
      strip.scrollTo({
        left: Math.max(
          0,
          item.offsetLeft - strip.clientWidth / 2 + item.offsetWidth / 2,
        ),
        behavior: "smooth",
      });
  }, [phase]);
  const activeStage =
    trace && phase >= 1 && phase <= 9 ? trace.stages[phase - 1] : null;
  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);
  useEffect(() => {
    if (!expanded || !visible) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setExpanded(false);
        expandButtonRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),input:not([disabled]),select:not([disabled])",
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [expanded, visible]);
  const y = (n: number) => 58 + n * 13.8;
  const columns = [
    {
      x: 94,
      label: `UKW ${config.reflector}`,
      sub: t("反射器"),
      s: 4,
      r: 4,
      rotor: -1,
    },
    {
      x: 260,
      label: `ROTOR ${config.rotors[0]}`,
      sub: `${t("左转子")} · ${t("环")} ${String(config.rings[0] + 1).padStart(2, "0")}`,
      s: 3,
      r: 5,
      rotor: 0,
    },
    {
      x: 435,
      label: `ROTOR ${config.rotors[1]}`,
      sub: `${t("中转子")} · ${t("环")} ${String(config.rings[1] + 1).padStart(2, "0")}`,
      s: 2,
      r: 6,
      rotor: 1,
    },
    {
      x: 610,
      label: `ROTOR ${config.rotors[2]}`,
      sub: `${t("右转子")} · ${t("环")} ${String(config.rings[2] + 1).padStart(2, "0")}`,
      s: 1,
      r: 7,
      rotor: 2,
    },
    { x: 800, label: "STECKER", sub: t("插线板"), s: 0, r: 8, rotor: -1 },
  ];
  const enabled = (s: number) => !!trace && phase >= s + 1;
  const color = (s: number) => (s < 5 ? "#b66b2d" : "#46847e");
  const path = (x: number, a: number, b: number, reflect = false) =>
    reflect
      ? `M ${x + 44} ${y(a)} C ${x - 65} ${y(a)}, ${x - 65} ${y(b)}, ${x + 44} ${y(b)}`
      : `M ${x + 44} ${y(a)} C ${x + 12} ${y(a)}, ${x - 12} ${y(b)}, ${x - 44} ${y(b)}`;
  const mapping = (column: (typeof columns)[number]) => {
    if (trace) return trace.stages[column.s].activeWiring;
    // An idle schematic must show the visible windows, not a hypothetical next keypress.
    if (column.rotor >= 0)
      return rotorMapping(
        config.rotors[column.rotor],
        config.positions[column.rotor],
        config.rings[column.rotor],
        "forward",
      );
    return column.s === 4
      ? REFLECTORS[config.reflector].contacts
      : plugboardMapping(config.plugboard);
  };

  return (
    <div
      ref={panelRef}
      className={`circuit-view${expanded ? " circuit-expanded" : ""}`}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? t("电路展开图") : undefined}
    >
      <div className="circuit-overview">
        <div className="circuit-title">
          <span>
            <small>E—01 / ELECTRICAL SCHEMATIC</small>
            <strong>{t("电路展开图")}</strong>
          </span>
          <div className="circuit-tools">
            <button
              className={allWires ? "mini active" : "mini"}
              onClick={() => setAllWires(!allWires)}
              aria-pressed={allWires}
            >
              <Layers2 size={13} />
              {t(allWires ? "全部走线" : "当前路径")}
            </button>
            <button
              ref={expandButtonRef}
              className="mini circuit-expand"
              onClick={() => {
                if (!expanded && trace) onSeek(Math.max(phase, 0));
                setExpanded(!expanded);
              }}
              aria-expanded={expanded}
              aria-label={t(expanded ? "收起电路" : "放大电路")}
            >
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {t(expanded ? "收起电路" : "放大电路")}
            </button>
          </div>
        </div>
        <div className="circuit-snapshot">
          <div className="circuit-message-state">
            <small>{language === "en" ? "SIGNAL" : "本次信号"}</small>
            <b>{trace?.input ?? "—"}</b>
            <ArrowRight size={15} />
            <b className={phase === 10 ? "complete" : ""}>
              {phase === 10 ? trace?.output : "·"}
            </b>
          </div>
          <div>
            <small>{t("窗口")}</small>
            <b>{config.positions.map(letter).join(" · ")}</b>
          </div>
          <div>
            <small>{t("环设置")}</small>
            <b>
              {config.rings
                .map((n) => String(n + 1).padStart(2, "0"))
                .join(" / ")}
            </b>
          </div>
          <span className="circuit-phase-count">
            {trace
              ? `${String(Math.max(phase, 0) + 1).padStart(2, "0")} / 11`
              : "STANDBY"}
          </span>
        </div>
        <div
          className="circuit-phase-strip"
          ref={phaseStripRef}
          aria-label={language === "en" ? "Electrical stages" : "电路阶段"}
        >
          {phases.map((label, index) => (
            <button
              key={index}
              disabled={!trace}
              className={`${phase === index ? "current " : ""}${index >= 6 ? "return-stage" : "forward-stage"}`}
              aria-current={phase === index ? "step" : undefined}
              onClick={() => onSeek(index)}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="circuit-diagram-heading">
        <div className="circuit-diagram-directions">
          <span>
            <i className="dot amber" />
            {language === "en" ? "FORWARD · RIGHT TO LEFT" : "正向 · 从右向左"}
          </span>
          <span>
            <i className="dot teal" />
            {language === "en" ? "RETURN · LEFT TO RIGHT" : "返回 · 从左向右"}
          </span>
        </div>
        <div className="circuit-zoom">
          <button
            onClick={() => adjustZoom(-0.2)}
            aria-label={language === "en" ? "Zoom out diagram" : "缩小电路图"}
          >
            <Minus size={13} />
          </button>
          <span>
            {zoom === "fit"
              ? language === "en"
                ? "FIT"
                : "适配"
              : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            onClick={() => adjustZoom(0.2)}
            aria-label={language === "en" ? "Zoom in diagram" : "放大电路图"}
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => setZoom("fit")}
            aria-label={language === "en" ? "Fit diagram" : "适配电路图"}
          >
            <Scan size={13} />
          </button>
        </div>
      </div>
      <div
        className="circuit-diagram-scroll"
        ref={diagramRef}
        tabIndex={0}
        aria-label={
          language === "en"
            ? "Scroll to inspect the 26 contacts"
            : "滚动查看26个触点"
        }
      >
        <svg
          style={{ width: diagramPixels, height: (diagramPixels * 465) / 955 }}
          viewBox="0 0 955 465"
          role="img"
          aria-label={t(
            "Enigma 26触点走线图，琥珀色为正向电流，绿色为返回电流",
          )}
        >
          {columns.map((c, ci) => (
            <g
              key={c.label}
              className={
                phase === c.s + 1 || phase === c.r + 1
                  ? "circuit-node active-node"
                  : "circuit-node"
              }
            >
              <rect
                x={c.x - 57}
                y={40}
                width={114}
                height={385}
                rx={5}
                fill={
                  phase === c.s + 1 || phase === c.r + 1
                    ? "#eee0bf"
                    : ci === 0
                      ? "#ded0b8"
                      : "#ede3d0"
                }
                stroke={
                  phase === c.s + 1 || phase === c.r + 1
                    ? color(phase - 1)
                    : "#c4b291"
                }
                strokeWidth={phase === c.s + 1 || phase === c.r + 1 ? 1.4 : 0.7}
              />
              <text x={c.x} y={17} textAnchor="middle" className="svg-label">
                {c.label}
              </text>
              <text x={c.x} y={450} textAnchor="middle" className="svg-sub">
                {c.sub}
              </text>
              {allWires &&
                mapping(c).map((out, i) =>
                  ci === 0 && i > out ? null : (
                    <path
                      key={i}
                      d={path(c.x, i, out, ci === 0)}
                      fill="none"
                      stroke="#9d8b6e"
                      opacity={ci === 0 ? 0.24 : 0.2}
                      strokeWidth={0.6}
                    />
                  ),
                )}
              {Array.from({ length: 26 }, (_, i) => {
                const forward =
                  trace && enabled(c.s) ? trace.stages[c.s] : null;
                const reverse =
                  trace && ci > 0 && enabled(c.r) ? trace.stages[c.r] : null;
                const rightColor =
                  forward?.input === i
                    ? color(c.s)
                    : reverse?.output === i
                      ? color(c.r)
                      : ci === 0 && forward?.output === i
                        ? color(c.s)
                        : null;
                const leftColor =
                  forward?.output === i
                    ? color(c.s)
                    : reverse?.input === i
                      ? color(c.r)
                      : null;
                return (
                  <g key={i}>
                    <circle
                      cx={c.x + 44}
                      cy={y(i)}
                      r={rightColor ? 3.5 : 1.8}
                      fill={rightColor || "#a5967c"}
                    />
                    <text
                      x={c.x + 49}
                      y={y(i) + 2.5}
                      className={
                        rightColor
                          ? "terminal-label active-terminal"
                          : "terminal-label"
                      }
                      style={rightColor ? { fill: rightColor } : undefined}
                    >
                      {letter(i)}
                    </text>
                    {ci > 0 && (
                      <>
                        <circle
                          cx={c.x - 44}
                          cy={y(i)}
                          r={leftColor ? 3.5 : 1.8}
                          fill={leftColor || "#a5967c"}
                        />
                        <text
                          x={c.x - 52}
                          y={y(i) + 2.5}
                          className={
                            leftColor
                              ? "terminal-label active-terminal"
                              : "terminal-label"
                          }
                          style={leftColor ? { fill: leftColor } : undefined}
                        >
                          {letter(i)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
              {trace && enabled(c.s) && (
                <path
                  d={path(
                    c.x,
                    trace.stages[c.s].input,
                    trace.stages[c.s].output,
                    ci === 0,
                  )}
                  fill="none"
                  stroke={color(c.s)}
                  strokeWidth={phase === c.s + 1 ? 3.2 : 2}
                  className={phase === c.s + 1 ? "wire-current" : ""}
                />
              )}
              {trace && ci > 0 && enabled(c.r) && (
                <path
                  d={path(
                    c.x,
                    trace.stages[c.r].output,
                    trace.stages[c.r].input,
                  )}
                  fill="none"
                  stroke={color(c.r)}
                  strokeWidth={phase === c.r + 1 ? 3.2 : 2}
                  className={phase === c.r + 1 ? "wire-current" : ""}
                />
              )}
            </g>
          ))}
          {columns.slice(1).map((c, i) => (
            <g key={c.x}>
              {Array.from({ length: 26 }, (_, n) => (
                <path
                  key={n}
                  d={`M ${c.x - 44} ${y(n)} H ${columns[i].x + 44}`}
                  stroke="#b0a18c"
                  strokeWidth={0.5}
                  opacity={allWires ? 0.18 : 0.04}
                />
              ))}
              {trace && enabled(c.s) && (
                <path
                  d={`M ${c.x - 44} ${y(trace.stages[c.s].output)} H ${columns[i].x + 44}`}
                  stroke="#b66b2d"
                  strokeWidth={1.8}
                />
              )}
              {trace && enabled(c.r) && (
                <path
                  d={`M ${columns[i].x + 44} ${y(trace.stages[c.r].input)} H ${c.x - 44}`}
                  stroke="#46847e"
                  strokeWidth={1.8}
                />
              )}
            </g>
          ))}
          {trace && phase >= 1 && (
            <>
              <path
                d={`M 920 ${y(trace.input.charCodeAt(0) - 65)} H 844`}
                stroke="#b66b2d"
                strokeWidth={2}
              />
              <text
                x={931}
                y={y(trace.input.charCodeAt(0) - 65) + 4}
                fill="#b66b2d"
                className="svg-label"
              >
                {trace.input}
              </text>
              {phase >= 9 && (
                <>
                  <path
                    d={`M 844 ${y(trace.output.charCodeAt(0) - 65)} H 920`}
                    stroke="#46847e"
                    strokeWidth={2}
                  />
                  <text
                    x={931}
                    y={y(trace.output.charCodeAt(0) - 65) + 4}
                    fill="#46847e"
                    className="svg-label"
                  >
                    {trace.output}
                  </text>
                </>
              )}
            </>
          )}
        </svg>
      </div>
      <div className="circuit-diagram-caption">
        <span>026 CONTACTS / ENIGMA I</span>
        <span>
          {language === "en"
            ? "Zoom for contact letters · Scroll to inspect"
            : "放大阅读触点字母 · 滚动查看局部"}
        </span>
      </div>
      {trace && (
        <div className="circuit-playback">
          <button
            className="mini"
            disabled={phase <= 0}
            onClick={() => onSeek(Math.max(phase - 1, 0))}
          >
            <ArrowLeft size={13} />
            {t("上一步")}
          </button>
          <input
            type="range"
            min={0}
            max={10}
            value={Math.max(phase, 0)}
            aria-label={t("过程进度")}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <span>{Math.max(phase, 0) + 1} / 11</span>
          <button
            className="mini"
            disabled={phase >= 10}
            onClick={() => onSeek(Math.min(phase + 1, 10))}
          >
            {t("下一步")}
            <ArrowRight size={13} />
          </button>
        </div>
      )}
      <div className="circuit-legend">
        <span>
          <i className="dot amber" />
          {t("正向")}: {t("插线板")} →{" "}
          {[...config.rotors].reverse().join(" → ")} → UKW
        </span>
        <span>
          <i className="dot teal" />
          {t("返回")}: UKW → {config.rotors.join(" → ")} → {t("插线板")}
        </span>
      </div>
      <p className="circuit-note">
        {t(
          "字母为机架触点坐标；走线已计入当前窗口位置与环设置。固定输入轮 ETW 按字母顺序直通。",
        )}
        {!trace && ` ${t("按下一个字母，追踪真实电路。")}`}
      </p>
      <div className="stage-detail" aria-live="polite">
        <div className="stage-detail-title">
          <strong>
            {activeStage
              ? stageLabel(
                  activeStage.id,
                  language,
                  activeStage.rotorId,
                  config.reflector,
                )
              : t(
                  phase === 0
                    ? "机械步进"
                    : phase === 10
                      ? "完整电路闭合"
                      : "从触点到线芯",
                )}
          </strong>
          {activeStage && (
            <span>
              {letter(activeStage.input)} → {letter(activeStage.output)}
            </span>
          )}
        </div>
        {activeStage?.rotorId ? (
          <>
            <div className="stage-facts">
              <span>
                {t("窗口")}{" "}
                <b>
                  {letter(activeStage.position!)} / {activeStage.position}
                </b>
              </span>
              <span>
                {t("环设置")}{" "}
                <b>
                  {String(activeStage.ring! + 1).padStart(2, "0")} /{" "}
                  {letter(activeStage.ring!)}
                </b>
              </span>
              <span>
                {t("线芯入口")}{" "}
                <b>
                  {letter(activeStage.shiftedInput!)} /{" "}
                  {activeStage.shiftedInput}
                </b>
              </span>
              <span>
                {t("线芯出口")}{" "}
                <b>
                  {letter(activeStage.wiredOutput!)} / {activeStage.wiredOutput}
                </b>
              </span>
            </div>
            <p className="stage-formula">
              <code>
                ({activeStage.input} + {activeStage.position} −{" "}
                {activeStage.ring}) mod 26 = {activeStage.shiftedInput} [
                {letter(activeStage.shiftedInput!)}]{" → "}
                {activeStage.wiredOutput} [{letter(activeStage.wiredOutput!)}]
                {" → "}({activeStage.wiredOutput} − {activeStage.position} +{" "}
                {activeStage.ring}) mod 26 = {activeStage.output} [
                {letter(activeStage.output)}]
              </code>
            </p>
            <p>
              {t(
                "计算使用 A=0…Z=25；环 01 以 0 参与计算。入口加“位置−环”，通过固定接线后，出口减去相同偏移。",
              )}
              {activeStage.direction === "reverse" &&
                ` ${t("回程使用同一组固定接线的逆向映射。")}`}
            </p>
          </>
        ) : (
          <p>
            {activeStage?.id === "reflector"
              ? `${t("反射器的固定配对")}: ${letter(activeStage.input)} ↔ ${letter(activeStage.output)}. ${t("反射器不旋转；它把信号送回转子的逆向走线。")}`
              : activeStage
                ? `${t("插线板交换已连接的字母，未连接的字母直通。")} ${letter(activeStage.input)} → ${letter(activeStage.output)}`
                : phase === 0
                  ? `${trace?.before.map(letter).join("")} → ${trace?.after.map(letter).join("")}. ${t("转子先步进，随后电路闭合")}`
                  : phase === 10
                    ? `${trace?.input} → ${trace?.output}. ${t("拖动回放进度，查看每一步的触点与计算。")}`
                    : t(
                        "按下字母后暂停，再用单步或进度条观察偏移、固定接线与回程。",
                      )}
          </p>
        )}
      </div>
    </div>
  );
}
