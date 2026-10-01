import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Layers3, Pause, Play, RotateCcw } from "lucide-react";
import { encryptKey, letter, ROTORS, REFLECTORS } from "../core/enigma";
import type { MachineConfig } from "../core/enigma";
import { createInspection } from "../core/inspection";
import type { ComponentInspection } from "../core/inspection";
import type { Language } from "../i18n";
import { INSPECTION_ASSEMBLIES, INSPECTION_PARTS } from "./inspection-catalog";
import RingExperimentControls from "./RingExperimentControls";

export default function ComponentInspectionControls({
  detail,
  config,
  language,
  onChange,
  onToggleSpread,
}: {
  detail: ComponentInspection;
  config: MachineConfig;
  language: Language;
  onChange: (change: Partial<ComponentInspection>) => void;
  onToggleSpread: () => void;
}) {
  const en = language === "en";
  const assembly = INSPECTION_ASSEMBLIES.find((a) => a.id === detail.assembly)!;
  const [playing, setPlaying] = useState(false);
  const progress = useRef(detail.progress);
  useEffect(() => {
    progress.current = detail.progress;
  }, [detail.progress]);
  useEffect(() => {
    setPlaying(false);
  }, [detail.assembly]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      progress.current = Math.min(
        1,
        progress.current + Math.min(now - last, 100) / 4200,
      );
      last = now;
      onChange({ progress: progress.current });
      if (progress.current < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, onChange]);
  const setAt = (value: number) => {
    setPlaying(false);
    progress.current = value;
    onChange({ progress: value });
  };
  const demoConfig = useMemo(
    () => ({
      ...config,
      rotors:
        detail.scenario === "current"
          ? config.rotors
          : (["I", "II", "III"] as MachineConfig["rotors"]),
      positions:
        detail.scenario === "current"
          ? config.positions
          : detail.scenario === "right"
            ? ([0, 0, 0] as MachineConfig["positions"])
            : detail.scenario === "carry"
              ? ([0, 3, 21] as MachineConfig["positions"])
              : ([0, 4, 22] as MachineConfig["positions"]),
    }),
    [config, detail.scenario],
  );
  const step = useMemo(() => encryptKey(demoConfig, "A"), [demoConfig]);
  const rotor = config.rotors[detail.rotorIndex];
  const animated = detail.assembly === "drive" || detail.assembly === "key";
  const related =
    detail.assembly === "rotor" ||
    detail.assembly === "drive" ||
    detail.assembly === "key";
  return (
    <div className="component-controls">
      <div className="component-panel-label">
        {en ? "COMPONENT INSPECTION" : "组件检视"}
        <span>{assembly.scale}</span>
      </div>
      <h2>{en ? assembly.en : assembly.zh}</h2>
      <p className="component-description">
        {assembly.description[en ? 1 : 0]}
      </p>
      {detail.assembly === "rotor" && (
        <div className="component-setup">
          <label htmlFor="component-rotor">
            {en ? "Installed rotor" : "已安装转子"}
          </label>
          <select
            id="component-rotor"
            value={detail.rotorIndex}
            onChange={(e) =>
              onChange({
                rotorIndex: Number(e.target.value) as 0 | 1 | 2,
                wire: -1,
                isolate: "all",
                trialRing: null,
              })
            }
          >
            {config.rotors.map((id, i) => (
              <option key={i} value={i}>
                {(en ? ["Left", "Middle", "Right"] : ["左", "中", "右"])[i]} ·{" "}
                {id}
              </option>
            ))}
          </select>
          <small>
            {en ? "Window" : "窗口"}{" "}
            {letter(config.positions[detail.rotorIndex])}
            {" · "}
            {en ? "Installed ring" : "实装环"}{" "}
            {String(config.rings[detail.rotorIndex] + 1).padStart(2, "0")}
            {" · "}
            {en ? "Notch" : "缺口"} {ROTORS[rotor].notch}
          </small>
          <RingExperimentControls
            detail={detail}
            config={config}
            language={language}
            onChange={onChange}
          />
        </div>
      )}
      {related && (
        <div className="component-related">
          {(detail.assembly === "drive" ? ["rotor", "key"] : ["drive"]).map(
            (id) => (
              <button
                key={id}
                onClick={() => {
                  setPlaying(false);
                  onChange(
                    createInspection(
                      id as "drive" | "rotor" | "key",
                      detail.rotorIndex,
                    ),
                  );
                }}
              >
                {en
                  ? id === "drive"
                    ? "Inspect stepping linkage"
                    : id === "rotor"
                      ? "Inspect rotor"
                      : "Inspect key mechanism"
                  : id === "drive"
                    ? "查看相连的步进机构"
                    : id === "rotor"
                      ? "回到转子"
                      : "查看按键机构"}
                <ArrowRight size={12} />
              </button>
            ),
          )}
        </div>
      )}
      <div className="component-separation">
        <label htmlFor="component-spread">
          <Layers3 size={13} />
          {en ? "Separation" : "拆解间距"}
          <b>{Math.round(detail.spread * 100)}%</b>
        </label>
        <div>
          <input
            id="component-spread"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={detail.spread}
            onChange={(e) => {
              onChange({ spread: Number(e.target.value) });
            }}
          />
          <button onClick={onToggleSpread}>
            {detail.spread > 0.02
              ? en
                ? "Assemble"
                : "合拢组件"
              : en
                ? "Separate"
                : "拆开组件"}
          </button>
        </div>
      </div>
      {animated && (
        <div className="component-motion">
          <button
            onClick={() => {
              if (progress.current >= 1) {
                progress.current = 0;
                onChange({ progress: 0 });
              }
              setPlaying((v) => !v);
            }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}{" "}
            {playing
              ? en
                ? "Pause"
                : "暂停动作"
              : en
                ? "Play mechanism"
                : "播放机械动作"}
          </button>
          <input
            aria-label={en ? "Mechanical motion progress" : "机械动作进度"}
            type="range"
            min="0"
            max="1"
            step=".001"
            value={detail.progress}
            onChange={(e) => setAt(Number(e.target.value))}
          />
          <button
            aria-label={en ? "Reset mechanical motion" : "复位机械动作"}
            onClick={() => setAt(0)}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      )}
      {detail.assembly === "drive" && (
        <div className="component-setup">
          <label htmlFor="component-scenario">
            {en ? "Stepping example" : "步进示例"}
          </label>
          <select
            id="component-scenario"
            value={detail.scenario}
            onChange={(e) => {
              setAt(0);
              onChange({
                scenario: e.target.value as ComponentInspection["scenario"],
              });
            }}
          >
            <option value="current">
              {en ? "Current machine settings" : "当前机器设置"}
            </option>
            <option value="right">
              {en ? "Right rotor · AAA → AAB" : "右轮步进 · AAA → AAB"}
            </option>
            <option value="carry">
              {en ? "Carry · ADV → AEW" : "缺口进位 · ADV → AEW"}
            </option>
            <option value="double">
              {en ? "Double-step · AEW → BFX" : "双步进 · AEW → BFX"}
            </option>
          </select>
          <div className="mechanical-windows">
            <b>{step.before.map(letter).join("")}</b>
            <ArrowRight size={13} />
            <b>{step.after.map(letter).join("")}</b>
          </div>
          <small>
            {en ? "Advancing: " : "本次推进："}
            {step.stepped
              .map((moves, i) =>
                moves
                  ? (en
                      ? ["Left", "Middle", "Right"]
                      : ["左轮", "中轮", "右轮"])[i]
                  : null,
              )
              .filter(Boolean)
              .join(" · ")}
          </small>
        </div>
      )}
      {detail.assembly === "rotor" && (
        <div className="component-setup">
          {!detail.ringExperiment && (
            <>
              <label htmlFor="component-wire">
                {en ? "Fixed core wire" : "线芯固定导线"}
              </label>
              <select
                id="component-wire"
                value={detail.wire}
                onChange={(e) =>
                  onChange({ wire: Number(e.target.value), showWiring: true })
                }
              >
                <option value="-1">{en ? "All 26 wires" : "全部 26 条"}</option>
                {Array.from({ length: 26 }, (_, i) => (
                  <option key={i} value={i}>
                    {letter(i)} → {letter(ROTORS[rotor].forward[i])}
                  </option>
                ))}
              </select>
            </>
          )}
          <label className="component-checkbox">
            <input
              type="checkbox"
              checked={detail.showWiring}
              onChange={(e) => onChange({ showWiring: e.target.checked })}
            />
            {en ? "Transparent core casing" : "透视线芯外罩"}
          </label>
        </div>
      )}
      {detail.assembly === "reflector" && (
        <div className="component-setup reflector-setup">
          <div className="mechanical-windows">
            <b>UKW {config.reflector}</b>
            <small>
              {en ? "26 CONTACTS / 13 PAIRS" : "26 位触点 / 13 对接线"}
            </small>
          </div>
          <small>
            {en
              ? "Stationary · no ring setting · current enters and returns on the contact face"
              : "固定不转 · 无环设置 · 电流从触点面进入并返回"}
          </small>
          <label htmlFor="reflector-wire">
            {en ? "Fixed contact pair" : "反射器固定接线"}
          </label>
          <select
            id="reflector-wire"
            value={
              detail.wire < 0
                ? -1
                : Math.min(
                    detail.wire,
                    REFLECTORS[config.reflector].contacts[detail.wire],
                  )
            }
            onChange={(e) =>
              onChange({ wire: Number(e.target.value), showWiring: true })
            }
          >
            <option value="-1">{en ? "All 13 pairs" : "全部 13 对"}</option>
            {REFLECTORS[config.reflector].contacts.map((to, from) =>
              from < to ? (
                <option key={from} value={from}>
                  {letter(from)} ↔ {letter(to)}
                </option>
              ) : null,
            )}
          </select>
          <label className="component-checkbox">
            <input
              type="checkbox"
              checked={detail.showWiring}
              onChange={(e) => onChange({ showWiring: e.target.checked })}
            />
            {en ? "Reveal internal wiring" : "显示内部接线"}
          </label>
          <small>
            {en
              ? "Connections match the selected historical wiring. Layered wire routes illustrate the connections around the central sleeve."
              : "配对遵循当前型号的历史接线；分层走线用于展示连接关系，并绕开中央轴套。"}
          </small>
        </div>
      )}
      <div className="component-part-label">
        {en
          ? "SELECT A PART · OR CLICK THE MODEL"
          : "选择零件 · 也可直接点击模型"}
      </div>
      <div className="component-parts">
        <button
          aria-pressed={detail.isolate === "all"}
          onClick={() => onChange({ isolate: "all" })}
        >
          {en ? "Complete component" : "完整组件"}
        </button>
        {INSPECTION_PARTS[detail.assembly].map(([id, zh, english]) => (
          <button
            key={id}
            aria-pressed={detail.isolate === id}
            onClick={() => onChange({ isolate: id })}
          >
            {en ? english : zh}
          </button>
        ))}
      </div>
      <p className="component-boundary">
        {en
          ? "Inspecting parts preserves your machine settings and records. Wiring and stepping follow Enigma I; mechanical dimensions and motion are teaching illustrations."
          : "检视保留机器设置与实验记录。接线与步进遵循 Enigma I；机械尺寸及动作轨迹为教学示意。"}
      </p>
    </div>
  );
}
