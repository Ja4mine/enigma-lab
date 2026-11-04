import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Stage } from "../../engine/Stage";
import {
  ALPHABET,
  DEFAULT_CONFIG,
  ROTORS,
  cloneConfig,
  encryptKey,
  encryptText,
  mod26,
  type KeyResult,
  type MachineConfig,
} from "../../core/enigma";
import { useLang, type Text } from "../../i18n";
import { BillOfMaterials, PartDossier } from "../../ui/PartDossier";
import { Callouts, StageCaption, StageView, Track, useProcedure } from "../../ui/stage-ui";
import { IconFrame, IconLabels, IconXray } from "../../ui/icons";
import type { Crumb } from "../../App";
import { buildEnigma, type EnigmaModel } from "./model";
import { SLOTS, SLOT_INDEX, type Slot } from "./catalog";
import { SignalOverlay } from "./signal";
import { OperatePanel } from "./EnigmaOperate";
import { EnigmaPrinciple } from "./EnigmaPrinciple";

type Tab = "teardown" | "operate" | "principle";
const OPERATE_POSE = 4;
/** In the circuit view the entry wheel rises with the rotors so contacts meet. */
const ETW_LIFT = [{ part: "etw", offset: [2.75, 13.5, 2] as [number, number, number] }];
const CORES = SLOTS.map((s) => `rotor-${s}-core`);

let shared: EnigmaModel | null = null;
const getModel = () => (shared ??= buildEnigma(DEFAULT_CONFIG));
let sharedOverlay: SignalOverlay | null = null;

const two = (n: number) => String(n + 1).padStart(2, "0");

export default function EnigmaWorkbench({ stage, onCrumbs }: { stage: Stage; onCrumbs: (c: Crumb[]) => void }) {
  const { lang, t } = useLang();
  const zh = lang === "zh";
  const model = useMemo(getModel, []);
  const exhibit = model.exhibit;
  const [tab, setTab] = useState<Tab>("teardown");
  const [focus, setFocus] = useState("enigma");
  const [hot, setHot] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [wires, setWires] = useState(false);
  const [detail, setDetail] = useState<Slot>(model.detailRotor);
  const [playing, setPlaying] = useState(false);
  const teardownProgress = useRef(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  /* ---------- machine state ---------- */
  const [initial, setInitial] = useState<MachineConfig>(() => cloneConfig(DEFAULT_CONFIG));
  const [machine, setMachine] = useState<MachineConfig>(() => cloneConfig(DEFAULT_CONFIG));
  const [trace, setTrace] = useState<KeyResult | null>(null);
  const [history, setHistory] = useState<KeyResult[]>([]);
  const [signal, setSignal] = useState(0);
  const [down, setDown] = useState<string | null>(null);
  const overlay = useMemo(() => (sharedOverlay ??= new SignalOverlay(stage.scene)), [stage]);
  const signalAnim = useRef<(() => void) | null>(null);

  const etwLift = useRef(0);
  /** Frame several parts as they will stand at `pose` (computed before animating). */
  const frameParts = useCallback(
    (ids: string[], dir: [number, number, number], fill: number, pose?: { progress: number; lift: number }) => {
      const box = new THREE.Box3();
      const saved = { progress: exhibit.progress, lift: etwLift.current };
      if (pose) {
        exhibit.setOverlayPose(ETW_LIFT, pose.lift);
        exhibit.setProgress(pose.progress);
      }
      for (const id of ids) box.union(exhibit.bounds(id));
      if (pose) {
        exhibit.setOverlayPose(ETW_LIFT, saved.lift);
        exhibit.setProgress(saved.progress);
      }
      const duration = 1.0;
      stage.frame(box, new THREE.Vector3(...dir), {
        fill,
        duration,
        offset: stage.width > 700 ? new THREE.Vector2(-0.04, 0.05) : new THREE.Vector2(0, 0.04),
      });
    },
    [exhibit, stage],
  );

  const frame = useCallback(
    (part: string | null, dir?: [number, number, number], fill = 0.8, duration = 0.9) => {
      const box = exhibit.bounds(part);
      // Leave room for the caption (top left) and the track (bottom).
      const wide = stage.width > 700;
      stage.frame(box, dir ? new THREE.Vector3(...dir) : undefined, {
        fill,
        duration,
        offset: wide ? new THREE.Vector2(-0.07, 0.07) : new THREE.Vector2(0, 0.04),
      });
    },
    [exhibit, stage],
  );

  const procedure = useProcedure(stage, exhibit, (step) => {
    if (tabRef.current !== "teardown") return;
    if (step === 0) return frame(null, [0.42, 0.78, 1], 0.78);
    const view = exhibit.steps[step - 1]?.view;
    if (view) frame(view.focus ?? null, view.dir, view.fill ?? 0.7);
  });

  /* ---------- stage wiring ---------- */
  useEffect(() => {
    stage.setExhibit(exhibit);
    const off = stage.onFrame((dt) => {
      if (model.update(dt)) stage.invalidate(true);
    });
    frame(null, [0.42, 0.78, 1], 0.78, 0.01);
    return () => {
      off();
      overlay.clear();
      stage.onPick = () => {};
      stage.onHover = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (id: string, move = true) => {
      setFocus(id);
      setHot(null);
      exhibit.setFocus(id === "enigma" ? null : id);
      if (move) {
        const meta = exhibit.meta(id);
        frame(id === "enigma" ? null : id, meta?.view, id === "enigma" ? 0.78 : 0.55);
      }
    },
    [exhibit, frame],
  );

  /** Click drills one level below the current focus along the picked part's lineage. */
  const nextLevel = useCallback(
    (picked: string) => {
      const line = exhibit.lineage(picked).map((m) => m.id);
      const at = line.indexOf(focus);
      if (at >= 0) return line[Math.min(line.length - 1, at + 1)];
      return line[1] ?? line[0];
    },
    [exhibit, focus],
  );

  useEffect(() => {
    stage.onPick = (picked) => {
      if (tabRef.current !== "teardown") return;
      if (!picked) return select("enigma");
      const next = nextLevel(picked);
      if (next !== focus) select(next);
    };
    stage.onHover = (picked) => {
      if (tabRef.current !== "teardown") return exhibit.setHover(null);
      exhibit.setHover(picked ? nextLevel(picked) : null);
    };
  }, [stage, exhibit, select, nextLevel, focus]);

  /* ---------- breadcrumbs ---------- */
  useEffect(() => {
    if (tab !== "teardown") {
      onCrumbs([
        { label: zh ? "恩尼格玛 I 型" : "Enigma I", onClick: () => setTab("teardown") },
        { label: tab === "operate" ? (zh ? "加密操作" : "Operate") : zh ? "数学原理" : "Principle", current: true },
      ]);
      return;
    }
    const line = exhibit.lineage(focus);
    onCrumbs(
      line.map((m, i) => ({
        label: t(m.name),
        current: i === line.length - 1,
        onClick: () => select(m.id),
      })),
    );
  }, [focus, tab, lang, exhibit, onCrumbs, select, t, zh]);

  /* ---------- keyboard: Esc goes up, letters type in Operate ---------- */
  const pressRef = useRef<(ch: string) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape" && tabRef.current === "teardown") {
        const parent = exhibit.meta(focus)?.parent;
        if (parent) select(parent);
        return;
      }
      if (tabRef.current === "operate" && /^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        pressRef.current(e.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exhibit, focus, select]);

  const liftAnim = useRef<(() => void) | null>(null);
  const liftEtw = (to: number) => {
    liftAnim.current?.();
    const from = etwLift.current;
    liftAnim.current = stage.animate({
      duration: 0.8,
      update: (k) => {
        etwLift.current = from + (to - from) * k;
        exhibit.setOverlayPose(ETW_LIFT, etwLift.current);
      },
    });
  };

  /* ---------- tabs change the pose ---------- */
  const prevTab = useRef<Tab>("teardown");
  useEffect(() => {
    const from = prevTab.current;
    prevTab.current = tab;
    if (from === tab) return;
    if (tab === "teardown") {
      overlay.clear();
      model.lightLamp(null);
      model.setLoomVisible(true);
      liftEtw(0);
      exhibit.setXray(wires ? CORES : []);
      model.setWiringVisible(wires);
      exhibit.setFocus(focus === "enigma" ? null : focus);
      procedure.seek(teardownProgress.current);
      frame(focus === "enigma" ? null : focus, exhibit.meta(focus)?.view, focus === "enigma" ? 0.78 : 0.55);
    } else if (from === "teardown") {
      teardownProgress.current = Math.round(exhibit.progress);
      exhibit.setFocus(null);
      exhibit.setHover(null);
      exhibit.setXray(CORES);
      model.setWiringVisible(true);
      procedure.seek(OPERATE_POSE);
      model.setLoomVisible(false);
      liftEtw(1);
      frameParts(["rotor-set", "etw", "lampboard", "keyboard"], [0.12, 0.62, 1], 0.76, { progress: OPERATE_POSE, lift: 1 });
      if (trace) window.setTimeout(() => showSignal(trace, false), 1300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "teardown") return;
    exhibit.setXray(wires ? CORES : []);
    model.setWiringVisible(wires);
  }, [wires, tab, exhibit, model]);

  useEffect(() => {
    model.setDetailRotor(detail);
  }, [detail, model]);

  /* ---------- play through the procedure ---------- */
  useEffect(() => {
    if (!playing) return;
    if (procedure.progress >= exhibit.steps.length - 1e-3) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => procedure.seek(Math.floor(procedure.progress + 0.01) + 1), 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, Math.round(procedure.progress * 100)]);

  /* ---------- operate: key press → step → current → lamp ---------- */
  const showSignal = useCallback(
    (result: KeyResult, animate = true) => {
      signalAnim.current?.();
      const st = Object.fromEntries(result.stages.map((x) => [x.id, x]));
      overlay.show(model.signalPath(result), {
        key: model.keyPosition(result.input),
        entry: model.contact("etw", "right", st["right-forward"].input),
        exit: model.contact("etw", "right", st["right-reverse"].output),
        lamp: model.lampPosition(result.output),
      });
      if (!animate) {
        overlay.setProgress(2);
        setSignal(2);
        model.lightLamp(result.output);
        return;
      }
      setSignal(0);
      signalAnim.current = stage.animate({
        duration: 1.6,
        update: (k) => {
          overlay.setProgress(k * 2);
          setSignal(k * 2);
        },
        done: () => {
          model.lightLamp(result.output);
          signalAnim.current = null;
        },
      });
    },
    [model, overlay, stage],
  );

  const press = useCallback(
    (ch: string) => {
      if (tabRef.current !== "operate") setTab("operate");
      const result = encryptKey(machine, ch);
      const next = { ...machine, positions: result.after };
      setMachine(next);
      setTrace(result);
      setHistory((h) => [...h, result]);
      setDown(ch);
      model.lightLamp(null);
      model.pressKey(ch);
      overlay.clear();
      setSignal(0);
      window.setTimeout(() => model.setConfig(next, true), 90);
      window.setTimeout(() => {
        model.pressKey(null);
        setDown(null);
      }, 420);
      window.setTimeout(() => showSignal(result), 300);
    },
    [machine, model, overlay, showSignal],
  );
  pressRef.current = press;

  const applyConfig = (config: MachineConfig) => {
    setInitial(cloneConfig(config));
    setMachine(cloneConfig(config));
    setTrace(null);
    setHistory([]);
    setSignal(0);
    overlay.clear();
    model.lightLamp(null);
    model.setConfig(config, true);
  };

  const resetMachine = () => applyConfig(initial);

  const message = (text: string): string | null => {
    const letters = text.replace(/\s+/g, "");
    if (!letters) return zh ? "先输入一些字母。" : "Type some letters first.";
    if (!/^[A-Z]+$/i.test(letters)) return zh ? "只能输入 A–Z 字母（空格会被忽略）。" : "Letters A–Z only (spaces are ignored).";
    if (letters.length > 500) return zh ? "一次最多 500 个字母。" : "At most 500 letters at a time.";
    const { steps, config } = encryptText(machine, letters.toUpperCase());
    setMachine(config);
    setHistory((h) => [...h, ...steps]);
    const last = steps[steps.length - 1];
    setTrace(last);
    model.setConfig(config, true);
    window.setTimeout(() => showSignal(last), 200);
    return null;
  };

  /* ---------- derived ---------- */
  const steps = exhibit.steps;
  const stepIndex = Math.round(procedure.progress);
  const caption =
    tab === "teardown"
      ? stepIndex === 0
        ? {
            title: zh ? "恩尼格玛 I 型 · 整机" : "Enigma I · assembled",
            text: zh
              ? "点击任意部件进入检视，或沿下方的拆解步骤一步步把机器拆开。"
              : "Click any part to inspect it, or take the machine apart step by step along the track below.",
          }
        : { title: t(steps[stepIndex - 1].title), text: t(steps[stepIndex - 1].caption) }
      : tab === "operate"
        ? {
            title: zh ? "电路展开视图" : "Exploded circuit view",
            text: zh
              ? "转子组被提起分开，线芯改为透视。按键后先看转子步进，再看电流去程（琥珀）与回程（青绿）。"
              : "The rotor set is lifted and spread, cores shown as x-ray. Press a key: first the rotors step, then the current goes out (amber) and back (teal).",
          }
        : {
            title: zh ? "为什么它长成这样" : "Why it looks like this",
            text: zh ? "右侧逐个部件说明它解决了什么问题，又留下了什么破绽。" : "The panel takes each part in turn: what problem it solved, and what weakness it left.",
          };

  const rotorSpecs = (() => {
    const m = /^rotor-([lmr])/.exec(focus);
    if (!m) return [];
    const slot = m[1] as Slot,
      i = SLOT_INDEX[slot];
    const id = machine.rotors[i];
    const def = ROTORS[id];
    const k = mod26(machine.positions[i] - machine.rings[i]);
    const rows: { k: Text; v: string }[] = [
      { k: { zh: "型号", en: "Type" }, v: id },
      { k: { zh: "接线（A→…）", en: "Wiring (A→…)" }, v: def.wiring },
      { k: { zh: "进位（窗口）", en: "Turnover (window)" }, v: `${def.notch} · ${two(ALPHABET.indexOf(def.notch))}` },
      { k: { zh: "窗口读数 p", en: "Window p" }, v: `${two(machine.positions[i])} · ${ALPHABET[machine.positions[i]]}` },
      { k: { zh: "环设置 r", en: "Ring r" }, v: `${two(machine.rings[i])} · ${ALPHABET[machine.rings[i]]}` },
      { k: { zh: "线芯偏转 k = p − r", en: "Core offset k = p − r" }, v: `${k} · ${ALPHABET[k]}` },
    ];
    return rows;
  })();
  const ukwSpecs =
    focus === "ukw"
      ? [
          {
            k: { zh: "当前配对", en: "Current pairs" },
            v: (() => {
              const w = machine.reflector === "B" ? "YRUHQSLDPXNGOKMIEBFZCWVJAT" : "FVPJIAOYEDRZXWGCTKUQSBNMHL";
              const pairs: string[] = [];
              [...w].forEach((ch, i) => {
                if (ALPHABET.indexOf(ch) > i) pairs.push(ALPHABET[i] + ch);
              });
              return `UKW-${machine.reflector}: ${pairs.join(" ")}`;
            })(),
          },
        ]
      : [];
  const plugSpecs =
    focus === "plugboard"
      ? [{ k: { zh: "当前插线", en: "Current cables" }, v: initial.plugboard || (zh ? "无" : "none") }]
      : [];

  const inRotorDetail = stepIndex >= 5 && stepIndex <= 6;
  const currentStep = stepIndex > 0 ? steps[stepIndex - 1] : null;
  const calloutPart =
    focus !== "enigma" ? focus : currentStep?.callouts ? null : (currentStep?.view?.focus ?? "enigma");
  const calloutExtra =
    focus === "enigma" && currentStep?.callouts
      ? currentStep.callouts.flatMap(([p, f]) => exhibit.featureAnchors(p).filter((x) => x.feature.id === f))
      : [];

  return (
    <div className="workbench">
      <StageView stage={stage}>
        <StageCaption
          kicker={
            tab === "teardown" ? (
              <span>
                {zh ? "拆解步骤" : "Step"} {String(stepIndex).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
              </span>
            ) : (
              <span>{zh ? "恩尼格玛 I 型" : "Enigma I"}</span>
            )
          }
          title={caption.title}
          text={caption.text}
        />
        {tab === "teardown" && (
          <Callouts
            stage={stage}
            exhibit={exhibit}
            partId={calloutPart}
            extra={calloutExtra}
            hot={hot}
            onHot={setHot}
            visible={labels}
          />
        )}
        <div className="stage-tools">
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              tab === "teardown"
                ? frame(focus === "enigma" ? null : focus, undefined, 0.8)
                : frameParts(["rotor-set", "etw", "lampboard", "keyboard"], [0.12, 0.62, 1], 0.76)
            }
            title={zh ? "重新取景" : "Reframe"}
            aria-label={zh ? "重新取景" : "Reframe"}
          >
            <IconFrame />
          </button>
          {tab === "teardown" && (
            <>
              <button
                type="button"
                className="icon-button"
                aria-pressed={labels}
                onClick={() => setLabels((v) => !v)}
                title={zh ? "显示标注" : "Show callouts"}
                aria-label={zh ? "显示标注" : "Show callouts"}
              >
                <IconLabels />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-pressed={wires}
                onClick={() => setWires((v) => !v)}
                title={zh ? "透视转子接线" : "X-ray rotor wiring"}
                aria-label={zh ? "透视转子接线" : "X-ray rotor wiring"}
              >
                <IconXray />
              </button>
            </>
          )}
        </div>
        {tab === "teardown" && (
          <Track
            steps={steps}
            progress={procedure.progress}
            onSeek={(i) => {
              setPlaying(false);
              procedure.seek(i);
            }}
            onScrub={(v, done) => {
              setPlaying(false);
              procedure.scrub(v, done);
            }}
            playing={playing}
            onPlay={() => {
              if (!playing && procedure.progress >= steps.length - 1e-3) procedure.seek(0);
              setPlaying((p) => !p);
            }}
            label={zh ? "拆解步骤" : "Disassembly steps"}
          />
        )}
      </StageView>
      <aside className="panel" aria-label={zh ? "检视面板" : "Inspection panel"}>
        <div className="panel-tabs" role="tablist">
          {(
            [
              ["teardown", zh ? "拆解检视" : "Teardown"],
              ["operate", zh ? "加密操作" : "Operate"],
              ["principle", zh ? "数学原理" : "Principle"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel-body" role="tabpanel">
          {tab === "teardown" && (
            <>
              <PartDossier
                exhibit={exhibit}
                partId={focus}
                onSelect={(id) => select(id)}
                hot={hot}
                onHot={setHot}
                extraSpecs={[...rotorSpecs, ...ukwSpecs, ...plugSpecs]}
              >
                {inRotorDetail && (
                  <div className="section">
                    <div className="section-head">
                      <h3>{zh ? "拆哪一枚转子" : "Which rotor to take apart"}</h3>
                    </div>
                    <div className="segmented small" role="group">
                      {SLOTS.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={detail === s}
                          onClick={() => {
                            setDetail(s);
                            select(`rotor-${s}`);
                          }}
                        >
                          {(zh ? ["左", "中", "右"] : ["Left", "Middle", "Right"])[i]} · {machine.rotors[i]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </PartDossier>
              <BillOfMaterials exhibit={exhibit} root="enigma" current={focus} onSelect={(id) => select(id)} />
            </>
          )}
          {tab === "operate" && (
            <OperatePanel
              initial={initial}
              current={machine}
              trace={trace}
              history={history}
              signal={signal}
              onKey={press}
              onApply={applyConfig}
              onReset={resetMachine}
              onMessage={message}
              down={down}
            />
          )}
          {tab === "principle" && <EnigmaPrinciple trace={trace} config={machine} />}
        </div>
      </aside>
    </div>
  );
}
