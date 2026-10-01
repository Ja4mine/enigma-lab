import { useId, useMemo } from "react";
import {
  ArrowRight,
  ChevronDown,
  Layers3,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { letter, mod26 } from "../core/enigma";
import type { MachineConfig } from "../core/enigma";
import type { ComponentInspection } from "../core/inspection";
import { getRingExperiment } from "../core/ring-experiment";
import type { Language } from "../i18n";

export interface RingExperimentControlsProps {
  config: MachineConfig;
  detail: ComponentInspection;
  language: Language;
  onChange: (change: Partial<ComponentInspection>) => void;
}

const LETTERS = Array.from({ length: 26 }, (_, index) => index);
const ringLabel = (value: number) =>
  `${String(value + 1).padStart(2, "0")} · ${letter(value)}`;

/** An isolated rotor experiment: changing its controls never applies a key. */
export default function RingExperimentControls({
  config,
  detail,
  language,
  onChange,
}: RingExperimentControlsProps) {
  const en = language === "en";
  const id = useId();
  const experiment = useMemo(
    () =>
      getRingExperiment(
        config,
        detail.rotorIndex,
        detail.trialRing ?? config.rings[detail.rotorIndex],
        detail.probeInput,
      ),
    [config, detail.rotorIndex, detail.trialRing, detail.probeInput],
  );
  const { baseline, trial } = experiment;
  const enabled = detail.ringExperiment;
  const changed = experiment.trialRing !== experiment.installedRing;
  const offset = mod26(experiment.position - experiment.trialRing);
  const setRing = (value: number) => onChange({ trialRing: mod26(value) });
  const steps = [
    { zh: "外部输入", en: "External in", value: trial.input, kind: "external" },
    { zh: "线芯入口", en: "Core in", value: trial.shiftedInput, kind: "core" },
    {
      zh: "固定线出口",
      en: "Wired out",
      value: trial.wiredOutput,
      kind: "core",
    },
    {
      zh: "外部输出",
      en: "External out",
      value: trial.output,
      kind: "external",
    },
  ];
  return (
    <section
      className={`ring-experiment${enabled ? " is-enabled" : ""}`}
      aria-labelledby={`${id}-title`}
    >
      <header className="ring-experiment-heading">
        <div>
          <small>RINGSTELLUNG / LAB</small>
          <h3 id={`${id}-title`}>
            {en ? "Ring setting · signal probe" : "环设置 · 信号实验"}
          </h3>
        </div>
        <label className="ring-experiment-toggle">
          <input
            type="checkbox"
            checked={enabled}
            aria-label={
              en ? "Enable ring-setting experiment" : "开启环设置实验"
            }
            aria-controls={`${id}-body`}
            onChange={(event) =>
              onChange({ ringExperiment: event.target.checked })
            }
          />
          <span aria-hidden="true" />
          <small>
            {en ? (enabled ? "ON" : "OFF") : enabled ? "已开启" : "开启"}
          </small>
        </label>
      </header>
      {!enabled ? (
        <p className="ring-experiment-off">
          {en
            ? "Hold the window and input still. Change only the ring and watch how the core shifts beneath the alphabet ring."
            : "固定窗口与输入，只改变环设置，观察字母环下的线芯如何相对偏移。"}
        </p>
      ) : (
        <div id={`${id}-body`} className="ring-experiment-body">
          <div className="ring-fixed-window">
            <LockKeyhole size={14} />
            <div>
              <small>{en ? "FIXED WINDOW" : "窗口固定"}</small>
              <span>
                {en ? "No stepping in this experiment" : "此实验不推动转子"}
              </span>
            </div>
            <b>{letter(experiment.position)}</b>
            <em>
              {experiment.rotorId} /{" "}
              {en
                ? ["LEFT", "MIDDLE", "RIGHT"][experiment.rotorIndex]
                : ["左", "中", "右"][experiment.rotorIndex]}
            </em>
          </div>
          <button
            type="button"
            className="ring-open-observation"
            onClick={() =>
              onChange({ spread: 0.55, isolate: "all", showWiring: true })
            }
          >
            <Layers3 size={13} />
            {en ? "Separate to observe" : "展开观察"}
            <ArrowRight size={12} />
          </button>
          {detail.isolate === "ring" && (
            <p className="ring-forward-note">
              {en
                ? "The core and contact plates stay visible as a reference while you inspect the alphabet ring."
                : "检视字母环时，保留相连的线芯和触点板，便于观察相对变化。"}
            </p>
          )}
          <div className="ring-trial-setting">
            <div className="ring-setting-label">
              <label htmlFor={`${id}-ring`}>
                {en ? "Trial ring setting" : "试验环设置"}
              </label>
              <small>
                {en ? "Installed" : "实际"}{" "}
                {ringLabel(experiment.installedRing)}
              </small>
            </div>
            <div className="ring-dial-row">
              <button
                type="button"
                onClick={() => setRing(experiment.trialRing - 1)}
                aria-label={en ? "Previous ring setting" : "前一个环设置"}
              >
                <Minus size={15} />
              </button>
              <select
                id={`${id}-ring`}
                value={experiment.trialRing}
                aria-label={
                  en ? "Trial ring setting, 01 to 26" : "试验环设置，01至26"
                }
                onChange={(event) => setRing(Number(event.target.value))}
              >
                {LETTERS.map((value) => (
                  <option key={value} value={value}>
                    {ringLabel(value)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRing(experiment.trialRing + 1)}
                aria-label={en ? "Next ring setting" : "后一个环设置"}
              >
                <Plus size={15} />
              </button>
            </div>
            <input
              className="ring-range"
              type="range"
              min={0}
              max={25}
              step={1}
              value={experiment.trialRing}
              aria-label={en ? "Explore trial ring setting" : "拖动探索环设置"}
              aria-valuetext={ringLabel(experiment.trialRing)}
              onChange={(event) => setRing(Number(event.target.value))}
            />
            <div className="ring-range-caption">
              <span>01 · A</span>
              <span>26 · Z</span>
            </div>
            <button
              className="ring-restore"
              type="button"
              disabled={detail.trialRing === null}
              onClick={() => onChange({ trialRing: null })}
            >
              <RotateCcw size={11} />
              {en ? "Restore installed ring" : "恢复实际环设置"}
            </button>
          </div>
          <div className="ring-probe-input">
            <label htmlFor={`${id}-probe`}>
              {en ? "Fixed external input" : "固定外部输入"}
            </label>
            <select
              id={`${id}-probe`}
              value={experiment.input}
              onChange={(event) =>
                onChange({ probeInput: Number(event.target.value) })
              }
            >
              {LETTERS.map((value) => (
                <option key={value} value={value}>
                  {letter(value)}
                </option>
              ))}
            </select>
          </div>
          <p className="ring-forward-note">
            {en
              ? "One forward pass through this rotor, with its current window held still."
              : "信号正向穿过这一枚转子，窗口保持在当前字母。"}
          </p>
          <div
            className="ring-output-comparison"
            aria-label={en ? "External output comparison" : "外部输出对比"}
          >
            <div>
              <span>{en ? "INSTALLED" : "实际环设置"}</span>
              <small>{ringLabel(experiment.installedRing)}</small>
              <b>{letter(baseline.output)}</b>
              <em>{en ? "External out" : "外部输出"}</em>
            </div>
            <ArrowRight size={15} />
            <div className={changed ? "changed" : ""}>
              <span>{en ? "TRIAL" : "试验环设置"}</span>
              <small>{ringLabel(experiment.trialRing)}</small>
              <b>{letter(trial.output)}</b>
              <em>{en ? "External out" : "外部输出"}</em>
            </div>
          </div>
          <p
            className="ring-result-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {!changed
              ? en
                ? "Trial and installed settings match."
                : "试验与实际环设置相同。"
              : baseline.output === trial.output
                ? en
                  ? "The ring changed; this input happens to keep the same output."
                  : "环设置已变化；这个输入恰好仍得到同一输出。"
                : en
                  ? `${letter(experiment.input)} now exits as ${letter(trial.output)}, instead of ${letter(baseline.output)}.`
                  : `${letter(experiment.input)} 的出口由 ${letter(baseline.output)} 变为 ${letter(trial.output)}。`}
          </p>
          <div className="ring-offset-rule">
            <span>{en ? "OFFSET · WINDOW − RING" : "偏移 · 窗口 − 环"}</span>
            <strong>
              {experiment.position} − {experiment.trialRing} <small>≡</small>{" "}
              {offset} <small>mod 26</small>
            </strong>
          </div>
          <ol
            className="ring-coordinate-route"
            aria-label={
              en ? "Four steps through the rotor" : "穿过转子的四段路径"
            }
          >
            {steps.map((step, index) => (
              <li key={step.en} className={step.kind}>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <span>{en ? step.en : step.zh}</span>
                <b>{letter(step.value)}</b>
                <em>{step.value}</em>
              </li>
            ))}
          </ol>
          <div className="ring-route-operations" aria-hidden="true">
            <span>+{offset}</span>
            <span>{en ? "FIXED WIRE" : "固定接线"}</span>
            <span>−{offset}</span>
          </div>
          <div className="ring-teaching-notes">
            <p>
              {en
                ? "The visible window and alphabet ring stay still; the wired core moves relative to them."
                : "窗口与字母环不动，内部线芯相对偏移。"}
            </p>
            <p>
              {en
                ? "The 26 fixed wire pairs stay the same. The offset changes which core contact receives the input."
                : "26 根导线接法不变；偏移改变外部输入落到哪一个线芯触点。"}
            </p>
            <small>
              {en
                ? "Letters use A = 0 … Z = 25. Ring 01 enters the calculation as 0."
                : "字母按 A=0…Z=25 计算；环 01 对应计算值 0。"}
            </small>
          </div>
          <details className="ring-whole-machine">
            <summary>
              <ChevronDown size={13} />
              <span>
                {en ? "Compare one whole-machine keypress" : "对照一次整机按键"}
              </span>
            </summary>
            <div className="ring-whole-machine-body">
              <p>
                {en
                  ? "This separate calculation steps the rotors first, then runs the full plugboard–rotor–reflector circuit."
                  : "这个独立计算先推动转子，再经过插线板、转子和反射器的完整电路。"}
              </p>
              {[
                {
                  name: en ? "Installed" : "实际",
                  ring: experiment.installedRing,
                  result: experiment.baselineKey,
                },
                {
                  name: en ? "Trial" : "试验",
                  ring: experiment.trialRing,
                  result: experiment.trialKey,
                },
              ].map(({ name, ring, result }) => (
                <div className="ring-key-comparison" key={name}>
                  <div>
                    <span>
                      {name} · {ringLabel(ring)}
                    </span>
                    <strong>
                      {result.input} <ArrowRight size={11} /> {result.output}
                    </strong>
                  </div>
                  <small>
                    {en ? "WINDOW" : "窗口"}{" "}
                    <b>{result.before.map(letter).join("")}</b>
                    <ArrowRight size={10} />
                    <b>{result.after.map(letter).join("")}</b>
                  </small>
                </div>
              ))}
              <p className="ring-local-only">
                {en
                  ? "The rotor experiment above does not step. These full-machine outputs include stepping and the entire return path, so they need not match its single-rotor outputs."
                  : "上面的单转子实验不步进；此处包含步进与整机往返，因此结果不必与单转子出口相同。"}
              </p>
            </div>
          </details>
          <p className="ring-experiment-boundary">
            {en
              ? "Local experiment only · Machine settings, ciphertext and records stay unchanged."
              : "仅局部试验 · 机器设置、密文与记录保持不变。"}
          </p>
        </div>
      )}
    </section>
  );
}
