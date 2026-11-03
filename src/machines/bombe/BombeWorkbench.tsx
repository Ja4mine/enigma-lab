import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Stage } from "../../engine/Stage";
import type { Crumb } from "../../App";
import { ALPHABET, mod26, type MachineConfig, type RotorId, type Triple } from "../../core/enigma";
import {
  BombeEvaluator,
  BombeRun,
  POSITIONS,
  WHEEL_ORDERS,
  analyseStop,
  buildMenu,
  coreAt,
  coreOf,
  indexOf,
  recoverKey,
  type BombeSpec,
  type BombeStop,
  type Menu,
  type RecoveredKey,
} from "../../core/bombe";
import { encryptText } from "../../core/enigma";
import { DEFAULT_SCENARIO, randomScenario, type Scenario } from "../../core/scenario";
import { useLang, tx, type Text } from "../../i18n";
import { BillOfMaterials, PartDossier } from "../../ui/PartDossier";
import { Callouts, StageCaption, StageView, Track, useProcedure } from "../../ui/stage-ui";
import { IconFrame, IconLabels, IconPause, IconPlay, IconReset, IconShuffle } from "../../ui/icons";
import { buildBombe, type BombeModel } from "./model";
import { CribSheet, MenuGraph, MenuSheet, RelationSheet, StopSummary, WireGrid, coreText } from "./sheets";

type Mode = "break" | "teardown";
interface SweepRank {
  order: Triple<RotorId>;
  core: Triple<number>;
  score: number;
  text: string;
}
interface Sweep {
  order: number;
  stops: { order: Triple<RotorId>; stop: BombeStop; consistent: boolean }[];
  done: boolean;
  ranked?: SweepRank[];
}
const L = (n: number) => ALPHABET[mod26(n)];
const groups = (s: string) => s.match(/.{1,5}/g)?.join(" ") ?? "";
const fmt = (n: number) => n.toLocaleString("en-US");

let shared: BombeModel | null = null;
const getModel = () => (shared ??= buildBombe(DEFAULT_SCENARIO.key.rotors));

const WALK: { title: Text; sheet: boolean }[] = [
  { title: tx("截获电文", "The intercept"), sheet: false },
  { title: tx("猜词与拖动", "Crib & crashes"), sheet: true },
  { title: tx("画出菜单", "Draw the menu"), sheet: true },
  { title: tx("消掉插线板", "Eliminate the plugboard"), sheet: true },
  { title: tx("把菜单接成电路", "Wire the menu"), sheet: false },
  { title: tx("矛盾即排除", "Contradiction"), sheet: true },
  { title: tx("对角板", "Diagonal board"), sheet: true },
  { title: tx("运行与停机", "Run & stops"), sheet: false },
  { title: tx("核对与解密", "Check & read"), sheet: true },
];

export default function BombeWorkbench({ stage, onCrumbs }: { stage: Stage; onCrumbs: (c: Crumb[]) => void }) {
  const { lang, t } = useLang();
  const zh = lang === "zh";
  const model = useMemo(getModel, []);
  const exhibit = model.exhibit;
  const [mode, setMode] = useState<Mode>("break");
  const [walk, setWalk] = useState(0);
  const [focus, setFocus] = useState("bombe");
  const [hot, setHot] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /* ---------- the problem ---------- */
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [offset, setOffset] = useState(DEFAULT_SCENARIO.cribOffset);
  const [loop, setLoop] = useState<number | null>(null);
  const [order, setOrder] = useState<Triple<RotorId>>(DEFAULT_SCENARIO.key.rotors);
  const [diagonal, setDiagonal] = useState(true);
  const [probe, setProbe] = useState<"wrong" | "right">("wrong");
  const [revealKey, setRevealKey] = useState(false);
  const cipher = scenario.ciphertext,
    crib = scenario.crib;
  const menu: Menu | null = useMemo(() => {
    try {
      return buildMenu(crib, cipher.slice(offset, offset + crib.length));
    } catch {
      return null;
    }
  }, [cipher, crib, offset]);
  const fallbackMenu = useMemo(
    () => buildMenu(crib, cipher.slice(scenario.cribOffset, scenario.cribOffset + crib.length)),
    [cipher, crib, scenario],
  );
  const activeMenu = menu ?? fallbackMenu;
  const trueCore = useMemo(
    () => coreOf({ positions: encryptText(scenario.key, scenario.plaintext).steps[scenario.cribOffset].after, rings: scenario.key.rings }),
    [scenario],
  );
  const trueStecker = useMemo(() => {
    const pairs = scenario.key.plugboard.split(" ");
    const input = ALPHABET[activeMenu.input];
    const pair = pairs.find((p) => p.includes(input));
    return pair ? ALPHABET.indexOf(pair[0] === input ? pair[1] : pair[0]) : activeMenu.input;
  }, [scenario, activeMenu]);
  const inputWire = trueStecker === 0 ? 1 : 0;
  const spec: BombeSpec = useMemo(
    () => ({ rotors: order, reflector: "B", menu: activeMenu, diagonal, inputWire }),
    [order, activeMenu, diagonal, inputWire],
  );
  /** A nearby position that really contradicts (all 26 live) in the current mode. */
  const wrongCore: Triple<number> = useMemo(() => {
    const ev = new BombeEvaluator(spec);
    for (let k = 0; k < 400; k++) {
      const c: Triple<number> = [mod26(trueCore[0] + 7 + k), mod26(trueCore[1] + 11), mod26(trueCore[2] + 5)];
      if (ev.evaluate(c).count === 26) return c;
    }
    return [mod26(trueCore[0] + 7), mod26(trueCore[1] + 11), mod26(trueCore[2] + 5)];
  }, [spec, trueCore]);

  /* ---------- the run ---------- */
  const runRef = useRef<BombeRun | null>(null);
  const [runIndex, setRunIndex] = useState(0);
  const [stops, setStops] = useState<BombeStop[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(3000);
  const [pauseAtStops, setPauseAtStops] = useState(true);
  const [current, setCurrent] = useState<BombeStop | null>(null);
  const [selected, setSelected] = useState<BombeStop | null>(null);
  const resetRun = useCallback(() => {
    runRef.current = null;
    setRunIndex(0);
    setStops([]);
    setRunning(false);
    setCurrent(null);
    setSelected(null);
    model.setPosition([0, 0, 0]);
    model.setRegister(null);
  }, [model]);
  useEffect(resetRun, [spec, resetRun]);

  const registerShown = useRef(false);
  useEffect(() => {
    if (!running) return;
    runRef.current ??= new BombeRun(spec);
    const run = runRef.current;
    let carry = 0;
    const off = stage.onFrame((dt) => {
      carry += dt * speed;
      const budget = Math.floor(carry);
      if (budget <= 0) return;
      carry -= budget;
      const found = run.advance(Math.min(budget, 6000), pauseAtStops);
      setRunIndex(run.index);
      if (found.length) {
        const last = found[found.length - 1];
        setStops([...run.stops]);
        setCurrent(last);
        model.setPosition(last.core);
        model.setRegister(last.live);
        registerShown.current = true;
        if (pauseAtStops) setRunning(false);
      } else {
        model.setPosition(coreAt(Math.min(POSITIONS - 1, run.index)));
        if (registerShown.current) {
          model.setRegister(null);
          registerShown.current = false;
          setCurrent(null);
        }
      }
      if (run.done) setRunning(false);
    });
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, pauseAtStops, spec]);

  /* ---------- all 60 wheel orders ---------- */
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const sweepCancel = useRef(false);
  const runAllOrders = async () => {
    sweepCancel.current = false;
    const found: { order: Triple<RotorId>; stop: BombeStop; consistent: boolean }[] = [];
    setSweep({ order: 0, stops: [], done: false });
    for (let o = 0; o < WHEEL_ORDERS.length; o++) {
      const s: BombeSpec = { ...spec, rotors: WHEEL_ORDERS[o] };
      const run = new BombeRun(s);
      while (!run.done) {
        run.advance(2500);
        await new Promise((r) => setTimeout(r, 0));
        if (sweepCancel.current) return setSweep(null);
      }
      for (const stop of run.stops)
        found.push({ order: WHEEL_ORDERS[o], stop, consistent: analyseStop(s, stop.core).some((h) => h.consistent) });
      setSweep({ order: o + 1, stops: [...found], done: false });
    }
    // Trial-decrypt every stop that survived checking and rank by German score.
    const ranked: SweepRank[] = [];
    for (const f of found.filter((x) => x.consistent)) {
      const s: BombeSpec = { ...spec, rotors: f.order };
      const h = analyseStop(s, f.stop.core).find((x) => x.consistent)!;
      const key = recoverKey(cipher, offset, f.order, spec.reflector, f.stop.core, h.steckers);
      ranked.push({ order: f.order, core: f.stop.core, score: key.score, text: key.plaintext });
      await new Promise((r) => setTimeout(r, 0));
      if (sweepCancel.current) return setSweep(null);
    }
    ranked.sort((a, b) => b.score - a.score);
    setSweep({ order: WHEEL_ORDERS.length, stops: found, done: true, ranked });
  };
  useEffect(() => () => void (sweepCancel.current = true), []);

  /* ---------- checking a stop ---------- */
  const checked: { stop: BombeStop; order: Triple<RotorId>; key: RecoveredKey | null; consistent: boolean } | null = useMemo(() => {
    if (walk !== 8) return null;
    const stop = selected ?? stops.find((s) => s.index === indexOf(trueCore)) ?? stops[0] ?? null;
    if (!stop) return null;
    const hyps = analyseStop(spec, stop.core).filter((h) => h.consistent);
    if (!hyps.length) return { stop, order: spec.rotors, key: null, consistent: false };
    const key = recoverKey(cipher, offset, spec.rotors, spec.reflector, stop.core, hyps[0].steckers);
    return { stop, order: spec.rotors, key, consistent: true };
  }, [walk, selected, stops, spec, trueCore, cipher, offset]);

  /* ---------- stage ---------- */
  const frame = useCallback(
    (part: string | null, dir: [number, number, number], fill = 0.8, duration = 0.9) => {
      const box = exhibit.bounds(part);
      stage.frame(box, new THREE.Vector3(...dir), {
        fill,
        duration,
        offset: stage.width > 700 ? new THREE.Vector2(-0.06, 0.06) : new THREE.Vector2(0, 0.04),
      });
    },
    [exhibit, stage],
  );
  const procedure = useProcedure(stage, exhibit, (step) => {
    if (modeRef.current !== "teardown") return;
    if (step === 0) return frame(null, [0.3, 0.18, 1], 0.84);
    const view = exhibit.steps[step - 1]?.view;
    if (view) frame(view.focus ?? null, view.dir, view.fill ?? 0.7);
  });

  useEffect(() => {
    stage.setExhibit(exhibit);
    const off = stage.onFrame((dt) => {
      if (model.update(dt)) stage.invalidate(true);
    });
    frame(null, [0.3, 0.18, 1], 0.84, 0.01);
    return () => {
      off();
      stage.onPick = () => {};
      stage.onHover = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    model.setWheelOrder(order);
  }, [order, model]);
  useEffect(() => {
    model.setMenu(activeMenu);
  }, [activeMenu, model]);

  const select = useCallback(
    (id: string, move = true) => {
      setFocus(id);
      setHot(null);
      exhibit.setFocus(id === "bombe" ? null : id);
      if (move) frame(id === "bombe" ? null : id, exhibit.meta(id)?.view ?? [0.3, 0.2, 1], id === "bombe" ? 0.84 : 0.5);
    },
    [exhibit, frame],
  );
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
      if (modeRef.current !== "teardown") return;
      if (!picked) return select("bombe");
      const next = nextLevel(picked);
      if (next !== focus) select(next);
    };
    stage.onHover = (picked) => exhibit.setHover(modeRef.current === "teardown" && picked ? nextLevel(picked) : null);
  }, [stage, exhibit, select, nextLevel, focus]);

  /* The diagonal board is introduced at step 7; before that it is left off. */
  useEffect(() => {
    if (walk === 5) setDiagonal(false);
    if (walk === 7 || walk === 8) setDiagonal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk]);

  /* Camera per walkthrough step. */
  useEffect(() => {
    if (mode !== "break") return;
    exhibit.setFocus(null);
    exhibit.setHover(null);
    if (exhibit.progress !== 0) procedure.seek(0);
    if (walk === 0) frame(null, [0.3, 0.18, 1], 0.84);
    if (walk === 4) frame("gate", [0.3, 0.16, -1], 0.8);
    if (walk === 7) frame("drums", [0.42, 0.12, 1], 0.86);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, mode]);
  useEffect(() => {
    if (mode === "teardown") {
      setRunning(false);
      frame(focus === "bombe" ? null : focus, exhibit.meta(focus)?.view ?? [0.3, 0.18, 1], focus === "bombe" ? 0.84 : 0.5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* Breadcrumbs. */
  useEffect(() => {
    if (mode === "break") {
      onCrumbs([
        { label: "Bombe", onClick: () => setWalk(0) },
        { label: `${walk + 1}. ${t(WALK[walk].title)}`, current: true },
      ]);
      return;
    }
    const line = exhibit.lineage(focus);
    onCrumbs(line.map((m, i) => ({ label: t(m.name), current: i === line.length - 1, onClick: () => select(m.id) })));
  }, [mode, walk, focus, lang, exhibit, onCrumbs, select, t]);

  /* Keyboard: arrows step through the walkthrough. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (modeRef.current === "break") {
        if (e.key === "ArrowRight") setWalk((w) => Math.min(WALK.length - 1, w + 1));
        if (e.key === "ArrowLeft") setWalk((w) => Math.max(0, w - 1));
      } else if (e.key === "Escape") {
        const parent = exhibit.meta(focus)?.parent;
        if (parent) select(parent);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exhibit, focus, select]);

  const newMessage = () => {
    const s = randomScenario(Math.floor(Math.random() * 1e9));
    setScenario(s);
    setOffset(s.cribOffset);
    setOrder(s.key.rotors);
    setRevealKey(false);
    setLoop(null);
    setSweep(null);
  };

  /* ---------- rendering ---------- */
  const sheet = mode === "break" && WALK[walk].sheet;
  const stepIndex = Math.round(procedure.progress);
  const tdSteps = exhibit.steps;
  const caption =
    mode === "teardown"
      ? stepIndex === 0
        ? {
            title: zh ? "Bombe · 正面" : "The Bombe, front",
            text: zh ? "点击滚筒、指示器或背门进入检视，或沿下方步骤拆开一个滚筒。" : "Click a drum, the indicator or the gate to inspect it, or follow the steps below to take a drum apart.",
          }
        : { title: t(tdSteps[stepIndex - 1].title), text: t(tdSteps[stepIndex - 1].caption) }
      : walkCaption(walk, zh);
  const calloutPart = mode === "teardown" ? (focus !== "bombe" ? focus : stepIndex >= 1 && stepIndex <= 2 ? "drum" : stepIndex === 3 || stepIndex === 4 ? "gate" : stepIndex === 5 ? "indicator" : "bombe") : walk === 0 ? "bombe" : walk === 7 ? "indicator" : null;

  return (
    <div className="workbench">
      <StageView stage={stage} sheet={sheet}>
        <StageCaption
          kicker={
            mode === "teardown" ? (
              <span>
                {zh ? "拆解步骤" : "Step"} {String(stepIndex).padStart(2, "0")} / {String(tdSteps.length).padStart(2, "0")}
              </span>
            ) : (
              <span>
                {zh ? "破译步骤" : "Codebreaking"} {walk + 1} / {WALK.length}
              </span>
            )
          }
          title={caption.title}
          text={caption.text}
        />
        {!sheet && calloutPart && (
          <Callouts stage={stage} exhibit={exhibit} partId={calloutPart} hot={hot} onHot={setHot} visible={labels} />
        )}
        {!sheet && (
          <div className="stage-tools">
            <button
              type="button"
              className="icon-button"
              onClick={() => frame(mode === "teardown" && focus !== "bombe" ? focus : null, [0.3, 0.18, 1], 0.84)}
              title={zh ? "重新取景" : "Reframe"}
              aria-label={zh ? "重新取景" : "Reframe"}
            >
              <IconFrame />
            </button>
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
          </div>
        )}
        <div className="sheet-layer" aria-hidden={!sheet}>
          {sheet && (
            <StageCaption
              kicker={
                <span>
                  {zh ? "破译步骤" : "Codebreaking"} {walk + 1} / {WALK.length}
                </span>
              }
              title={caption.title}
              text={caption.text}
            />
          )}
          {walk === 1 && <CribSheet cipher={cipher} crib={crib} offset={offset} onOffset={setOffset} />}
          {walk === 2 && menu && <MenuSheet menu={menu} loop={loop} onLoop={setLoop} />}
          {walk === 2 && !menu && <NoMenu zh={zh} onFix={() => setOffset(scenario.cribOffset)} />}
          {walk === 3 && <RelationSheet spec={spec} trueCore={trueCore} wrongCore={wrongCore} />}
          {walk === 5 && (
            <div className="sheet">
              <div className="sheet-card">
                <h4>
                  {probe === "wrong"
                    ? zh
                      ? `错误位置 ${coreText(wrongCore)}：电流流遍全部 26 根`
                      : `Wrong position ${coreText(wrongCore)}: current reaches all 26`
                    : zh
                      ? `真实位置 ${coreText(trueCore)}：有一根线始终没电`
                      : `True position ${coreText(trueCore)}: one wire never goes live`}
                </h4>
                <WireGrid
                  spec={spec}
                  core={probe === "wrong" ? wrongCore : trueCore}
                  trueStecker={probe === "right" && order.join() === scenario.key.rotors.join() ? trueStecker : null}
                  playKey={`${probe}-${diagonal}-${order.join()}-${offset}`}
                />
              </div>
            </div>
          )}
          {walk === 6 && <DiagonalSheet spec={spec} trueCore={trueCore} diagonal={diagonal} setDiagonal={setDiagonal} />}
          {walk === 8 && (
            <CheckSheet
              checked={checked}
              scenario={scenario}
              offset={offset}
              reveal={revealKey}
              onReveal={() => setRevealKey(true)}
              trueCore={trueCore}
              hasRun={stops.length > 0}
              goRun={() => {
                // Run the whole wheel order at once and keep its stops.
                const run = new BombeRun(spec);
                run.runToEnd();
                runRef.current = run;
                setRunIndex(run.index);
                setStops([...run.stops]);
                setRunning(false);
                const hit = run.stops.find((s) => s.index === indexOf(trueCore)) ?? run.stops[0] ?? null;
                setSelected(hit);
                if (hit) {
                  model.setPosition(hit.core);
                  model.setRegister(hit.live);
                }
              }}
            />
          )}
        </div>
        {mode === "teardown" ? (
          <Track
            steps={tdSteps}
            progress={procedure.progress}
            onSeek={(i) => procedure.seek(i)}
            onScrub={(v, done) => procedure.scrub(v, done)}
            label={zh ? "拆解步骤" : "Disassembly steps"}
          />
        ) : (
          <Track
            steps={WALK.slice(1)}
            firstLabel={t(WALK[0].title)}
            numbering={1}
            progress={walk}
            onSeek={(i) => setWalk(i)}
            label={zh ? "破译步骤" : "Codebreaking steps"}
          />
        )}
      </StageView>
      <aside className="panel" aria-label={zh ? "Bombe 面板" : "Bombe panel"}>
        <div className="panel-tabs" role="tablist">
          {(
            [
              ["break", zh ? "破译原理" : "How it breaks Enigma"],
              ["teardown", zh ? "拆解检视" : "Teardown"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel-body" role="tabpanel">
          {mode === "teardown" ? (
            <>
              <PartDossier exhibit={exhibit} partId={focus} onSelect={(id) => select(id)} hot={hot} onHot={setHot} />
              <BillOfMaterials exhibit={exhibit} root="bombe" current={focus} onSelect={(id) => select(id)} />
            </>
          ) : (
            <>
              <div className="section">
                <ol className="walk">
                  {WALK.map((w, i) => (
                    <li key={i}>
                      <button type="button" aria-current={walk === i ? "step" : undefined} onClick={() => setWalk(i)}>
                        <span className="balloon">{i + 1}</span>
                        <span>{t(w.title)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="section">
                {walk === 0 && <InterceptPanel scenario={scenario} onNew={newMessage} zh={zh} />}
                {walk === 1 && <CribPanel zh={zh} offset={offset} scenario={scenario} menuOk={!!menu} />}
                {walk === 2 && <MenuPanel zh={zh} menu={activeMenu} />}
                {walk === 3 && <RelationPanel zh={zh} />}
                {walk === 4 && <WiringPanel zh={zh} menu={activeMenu} order={order} setOrder={setOrder} trueOrder={scenario.key.rotors} />}
                {walk === 5 && <ContradictionPanel zh={zh} probe={probe} setProbe={setProbe} spec={spec} />}
                {walk === 6 && <DiagonalPanel zh={zh} />}
                {walk === 7 && (
                  <RunPanel
                    zh={zh}
                    index={runIndex}
                    running={running}
                    onToggle={() => {
                      if (runRef.current?.done) resetRun();
                      setRunning((r) => !r);
                    }}
                    onReset={resetRun}
                    speed={speed}
                    setSpeed={setSpeed}
                    pauseAtStops={pauseAtStops}
                    setPauseAtStops={setPauseAtStops}
                    stops={stops}
                    current={current}
                    selected={selected}
                    onSelect={(s) => {
                      setSelected(s);
                      model.setPosition(s.core);
                      model.setRegister(s.live);
                    }}
                    onCheck={(s) => {
                      setSelected(s);
                      setWalk(8);
                    }}
                    order={order}
                    setOrder={setOrder}
                    trueOrder={scenario.key.rotors}
                    sweep={sweep}
                    onSweep={runAllOrders}
                    onCancelSweep={() => (sweepCancel.current = true)}
                    diagonal={diagonal}
                  />
                )}
                {walk === 8 && <CheckPanel zh={zh} checked={checked} spec={spec} />}
              </div>
              <div className="section">
                <div className="btn-row" style={{ justifyContent: "space-between" }}>
                  <button type="button" className="btn quiet" disabled={walk === 0} onClick={() => setWalk(walk - 1)}>
                    {zh ? "上一步" : "Back"}
                  </button>
                  {walk < WALK.length - 1 && (
                    <button type="button" className="btn primary" onClick={() => setWalk(walk + 1)}>
                      {zh ? "下一步：" : "Next: "}
                      {t(WALK[walk + 1].title)}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Captions and panels                                                 */
/* ------------------------------------------------------------------ */

function walkCaption(walk: number, zh: boolean) {
  const c = [
    {
      title: zh ? "一份截获的电文" : "One intercepted message",
      text: zh
        ? "我们不知道当天密钥：转子排列、起始位置、环设置、插线板全都未知。Bombe 要从一小段猜到的明文出发，把它们找回来。"
        : "The day's key is unknown: wheel order, start, rings and plugboard. The Bombe starts from a short guessed plaintext and brings them back.",
    },
    {
      title: zh ? "猜词，并利用“不自映射”" : "A crib, and the no-self-encipherment rule",
      text: zh ? "把猜测的明文贴在密文下滑动：出现同字母相对的位置全部排除。" : "Slide the guess beneath the ciphertext: every position with a letter over itself is ruled out.",
    },
    {
      title: zh ? "菜单：字母与位置构成的图" : "The menu: a graph of letters and positions",
      text: zh ? "闭环是关键——每个闭环都是一条与插线板无关的检验。" : "Loops are what matter: each one is a test that does not involve the plugboard.",
    },
    {
      title: zh ? "插线板为什么能被绕开" : "Why the plugboard can be sidestepped",
      text: zh ? "S 是对合，所以 c = S E S(p) 可以改写成 S(c) = E(S(p))。" : "S is an involution, so c = S E S(p) becomes S(c) = E(S(p)).",
    },
    {
      title: zh ? "把菜单接成电路" : "Turn the menu into wiring",
      text: zh
        ? "每条边是一台三联滚筒（下层多转 i 格），每个字母是一束 26 根线；背门上的电缆按菜单把它们连起来。"
        : "Each edge becomes a drum triple (bottom drum i places on), each letter a bundle of 26 wires; cables on the rear gate join them as the menu says.",
    },
    {
      title: zh ? "电流流遍 = 自相矛盾" : "Current everywhere means contradiction",
      text: zh
        ? "给测试字母的某一根线加电，相当于假设一条插线；电流能到达的每根线都是它的推论。"
        : "Putting voltage on one wire of the test letter is a stecker hypothesis; every wire the current reaches is one of its consequences.",
    },
    {
      title: zh ? "Welchman 的对角板" : "Welchman's diagonal board",
      text: zh ? "S(a) = b 当且仅当 S(b) = a：把这条对称性也接成导线。" : "S(a) = b exactly when S(b) = a: wire that symmetry in as well.",
    },
    {
      title: zh ? "转过 17,576 个位置" : "Through all 17,576 positions",
      text: zh ? "上层滚筒最快。只要有一根测试线没电，机器就停下，记下位置和测试寄存器。" : "The top drums turn fastest. Whenever a test wire stays dead the machine stops; record the position and the register.",
    },
    {
      title: zh ? "核对停机，恢复密钥" : "Check the stops, recover the key",
      text: zh ? "假停机会在逐一检验中露出矛盾；真停机给出插线、再试出环设置，电文便读出来了。" : "False stops reveal a contradiction when checked; the true one gives the steckers, then the ring settings, and the message reads.",
    },
  ];
  return c[walk];
}

function InterceptPanel({ scenario, onNew, zh }: { scenario: Scenario; onNew: () => void; zh: boolean }) {
  return (
    <>
      <div className="section-head">
        <h3>{zh ? "截获的电文" : "The intercept"}</h3>
        <button type="button" className="link" onClick={onNew}>
          <IconShuffle width={14} height={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          {zh ? "换一份" : "Another message"}
        </button>
      </div>
      <div className="tape">{groups(scenario.ciphertext)}</div>
      <p className="note">
        {zh ? `${scenario.ciphertext.length} 个字母。空军气象站的例行报告，开头格式固定。` : `${scenario.ciphertext.length} letters. A routine Luftwaffe weather report with a fixed opening.`}
      </p>
      <div className="section-head" style={{ marginTop: 14 }}>
        <h3>{zh ? "密钥空间" : "Key space"}</h3>
      </div>
      <dl className="specs">
        <dt>{zh ? "转子排列" : "Wheel orders"}</dt>
        <dd>5 × 4 × 3 = 60</dd>
        <dt>{zh ? "转子位置" : "Rotor positions"}</dt>
        <dd>26³ = 17,576</dd>
        <dt>{zh ? "环设置（中、右）" : "Rings (middle, right)"}</dt>
        <dd>26² = 676</dd>
        <dt>{zh ? "10 根插线" : "10 plug cables"}</dt>
        <dd>26! / (6! · 10! · 2¹⁰) ≈ 1.5 × 10¹⁴</dd>
        <dt>{zh ? "合计" : "Total"}</dt>
        <dd>≈ 1.07 × 10²³</dd>
      </dl>
      <p className="prose" style={{ marginTop: 10 }}>
        {zh
          ? "插线板贡献了绝大部分。Bombe 的设计思想是：根本不去枚举插线板，只枚举 60 × 17,576 ≈ 10⁶ 种转子状态，让电路替我们判断插线板“能不能存在”。"
          : "The plugboard contributes most of it. The Bombe never enumerates plugboards: it runs only the 60 × 17,576 ≈ 10⁶ rotor states and lets the circuit decide whether any plugboard could fit."}
      </p>
    </>
  );
}

function CribPanel({ zh, offset, scenario, menuOk }: { zh: boolean; offset: number; scenario: Scenario; menuOk: boolean }) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "为什么能排除" : "Why positions fall away"}</h3>
      <p className="prose">
        {zh
          ? "反射器让每次加密 Cᵢ 都没有不动点：Cᵢ(x) ≠ x。所以猜词放对的位置上，绝不会有一列上下字母相同。"
          : "The reflector makes every Cᵢ fixed-point-free: Cᵢ(x) ≠ x. In the right place, no column of the crib can show a letter above itself."}
      </p>
      <p className="prose">
        {zh
          ? "这只能“排除”，不能“确认”：剩下的位置仍有好几个。实际工作中，报告格式（这里电文前 19 个字母是收报单位）把位置缩小到一两个，每个都单独上 Bombe。"
          : "It only excludes, never confirms: several positions survive. In practice the report format (here the first 19 letters address the unit) narrows it to one or two, each run on the Bombe separately."}
      </p>
      <p className="note">
        {menuOk
          ? zh
            ? `当前选择：第 ${offset} 位。${offset === scenario.cribOffset ? "这是电文里猜词真正所在的位置。" : "这个位置无冲突，但不一定正确——继续往下，Bombe 会告诉你。"}`
            : `Chosen: position ${offset}. ${offset === scenario.cribOffset ? "This is where the crib really is." : "Crash-free, but not necessarily right; carry on and the Bombe will tell."}`
          : zh
            ? "当前位置有冲突，无法构成菜单。"
            : "This position crashes; it cannot form a menu."}
      </p>
    </>
  );
}

function MenuPanel({ zh, menu }: { zh: boolean; menu: Menu }) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "从对照表到图" : "From pairs to a graph"}</h3>
      <dl className="specs">
        {menu.links.map((l) => (
          <div key={l.index} style={{ display: "contents" }}>
            <dt className="mono">{l.index + 1}</dt>
            <dd className="mono">
              {L(l.plain)} — {L(l.cipher)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="prose" style={{ marginTop: 10 }}>
        {zh
          ? `闭环数 = 边数 − 字母数 + 连通块数 = ${menu.links.length} − ${menu.letters.length} + ${menu.components.length} = ${menu.closures}。Turing 的经验表：闭环越多，每种转子排列的假停机越少。`
          : `Loops = edges − letters + parts = ${menu.links.length} − ${menu.letters.length} + ${menu.components.length} = ${menu.closures}. Turing's tables: the more loops, the fewer false stops per wheel order.`}
      </p>
    </>
  );
}

function RelationPanel({ zh }: { zh: boolean }) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "要点" : "In short"}</h3>
      <ol className="derive">
        <li>{zh ? "插线板是对合，可以从两侧“剥掉”。" : "The plugboard is an involution, so it peels off both sides."}</li>
        <li>{zh ? "剩下的 Eᵢ 只取决于转子：滚筒可以照做。" : "What remains, Eᵢ, depends only on the rotors, which drums can copy."}</li>
        <li>{zh ? "闭环把未知的 S(a) 夹成“合成置换的不动点”。" : "A loop pins the unknown S(a) to a fixed point of a composite permutation."}</li>
        <li>{zh ? "多个闭环同时成立的转子位置极少。" : "Rotor positions that satisfy several loops at once are rare."}</li>
      </ol>
    </>
  );
}

function WiringPanel({
  zh,
  menu,
  order,
  setOrder,
  trueOrder,
}: {
  zh: boolean;
  menu: Menu;
  order: Triple<RotorId>;
  setOrder: (o: Triple<RotorId>) => void;
  trueOrder: Triple<RotorId>;
}) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "接线规则" : "Wiring rules"}</h3>
      <ul className="derive" style={{ listStyle: "disc" }}>
        <li>{zh ? "每个菜单字母 → 一个“公共接点”，即一束 26 根线（第 k 根代表“这个字母插到第 k 个字母”）。" : "Each menu letter → a common: a bundle of 26 wires (wire k means “this letter is plugged to the k-th letter”)."}</li>
        <li>{zh ? "每条边 i → 一台三联滚筒，两端分别接到两个字母的公共接点；下层滚筒比基准多转 i 格。" : "Each edge i → one drum triple, its two ends on the two letters' commons; its bottom drum is set i places on."}</li>
        <li>{zh ? "测试字母的公共接点再接到测试寄存器。" : "The test letter's common also goes to the test register."}</li>
      </ul>
      <MenuGraph menu={menu} loop={null} height={250} />
      <WheelOrderPicker zh={zh} order={order} setOrder={setOrder} trueOrder={trueOrder} />
    </>
  );
}

function WheelOrderPicker({
  zh,
  order,
  setOrder,
  trueOrder,
}: {
  zh: boolean;
  order: Triple<RotorId>;
  setOrder: (o: Triple<RotorId>) => void;
  trueOrder: Triple<RotorId>;
}) {
  const ids: RotorId[] = ["I", "II", "III", "IV", "V"];
  const set = (slot: number, id: RotorId) => {
    const next = [...order] as Triple<RotorId>;
    const other = next.indexOf(id);
    if (other >= 0) next[other] = next[slot];
    next[slot] = id;
    setOrder(next);
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-head">
        <h3>{zh ? "装上的滚筒（转子排列）" : "Drums fitted (wheel order)"}</h3>
      </div>
      <div className="rotor-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {(zh ? ["上层 · 左转子", "中层 · 中转子", "下层 · 右转子"] : ["Top · left", "Middle", "Bottom · right"]).map((h) => (
          <span key={h} className="head">
            {h}
          </span>
        ))}
        {[0, 1, 2].map((i) => (
          <select key={i} value={order[i]} onChange={(e) => set(i, e.target.value as RotorId)} aria-label={`wheel ${i + 1}`}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        ))}
      </div>
      <p className="note">
        {order.join() === trueOrder.join()
          ? zh
            ? "已装上当天真正的转子排列（为了节省时间）。历史上 60 种排列要逐一运行；第 7 步可以一次跑完全部 60 种。"
            : "Fitted with the day's actual wheel order to save time. Historically each of the 60 orders was a separate run; step 7 can run all 60."
          : zh
            ? "这不是当天的转子排列：运行后只会得到假停机。"
            : "Not the day's wheel order: a run will only produce false stops."}
      </p>
    </div>
  );
}

function ContradictionPanel({
  zh,
  probe,
  setProbe,
  spec,
}: {
  zh: boolean;
  probe: "wrong" | "right";
  setProbe: (p: "wrong" | "right") => void;
  spec: BombeSpec;
}) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "一次测试读出 26 个假设" : "One test reads 26 hypotheses"}</h3>
      <div className="segmented small" role="group" style={{ marginBottom: 10 }}>
        <button type="button" aria-pressed={probe === "wrong"} onClick={() => setProbe("wrong")}>
          {zh ? "错误位置" : "Wrong position"}
        </button>
        <button type="button" aria-pressed={probe === "right"} onClick={() => setProbe("right")}>
          {zh ? "真实位置" : "True position"}
        </button>
      </div>
      <ol className="derive">
        <li>
          {zh
            ? `给 ${L(spec.menu.input)} 组的第 ${L(spec.inputWire)} 根线加电 = 假设 S(${L(spec.menu.input)}) = ${L(spec.inputWire)}。`
            : `Voltage on wire ${L(spec.inputWire)} of bundle ${L(spec.menu.input)} = the hypothesis S(${L(spec.menu.input)}) = ${L(spec.inputWire)}.`}
        </li>
        <li>
          {zh
            ? "扰频器是双端的，电流沿每条约束双向传播；能到达的每根线都是被这个假设逼出来的结论。"
            : "Scramblers are double-ended, so current follows every constraint both ways; each wire it reaches is forced by the hypothesis."}
        </li>
        <li>
          {zh
            ? `如果 ${L(spec.menu.input)} 组的线被点亮不止一根，就是同一个字母插到两处——矛盾。真插线所在的那组导线自成一体，与假假设不连通。`
            : `If more than one wire of ${L(spec.menu.input)} lights, one letter is plugged to two places: a contradiction. The true steckers form a closed set of wires that a false hypothesis cannot reach.`}
        </li>
        <li>
          {zh
            ? "因此：26 根全亮 → 所有假设都错，这个位置排除；25 根亮 → 没亮的那根就是插线；只亮 1 根 → 注入的假设本身就对。"
            : "So: all 26 live → every hypothesis fails, position rejected; 25 live → the dead one is the stecker; just 1 live → the injected guess was right."}
        </li>
      </ol>
    </>
  );
}

function DiagonalPanel({ zh }: { zh: boolean }) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "把对称性接成导线" : "Wiring in the symmetry"}</h3>
      <p className="prose">
        {zh
          ? "导线网格里，第 a 行第 b 列表示“S(a) = b”。插线板是对合，所以 (a, b) 与 (b, a) 永远同真同假。对角板把这两根线焊在一起——网格因此沿虚线对角线对称。"
          : "In the grid, row a, column b means S(a) = b. The plugboard is an involution, so (a, b) and (b, a) are always true together. The diagonal board solders the two wires together, which makes the grid symmetric about the dashed diagonal."}
      </p>
      <p className="prose">
        {zh
          ? "效果：推论可以经过菜单之外的字母绕回来，矛盾出现得更早。第一台 Bombe“Victory”没有对角板，需要至少 3 个闭环；加上对角板后，闭环更少、甚至没有闭环的菜单也能用。"
          : "Consequences can now travel through letters outside the menu and come back, so contradictions arrive sooner. The first Bombe, “Victory”, had no diagonal board and needed at least three loops; with it, menus with fewer loops, even none, became usable."}
      </p>
    </>
  );
}

function DiagonalSheet({
  spec,
  trueCore,
  diagonal,
  setDiagonal,
}: {
  spec: BombeSpec;
  trueCore: Triple<number>;
  diagonal: boolean;
  setDiagonal: (d: boolean) => void;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [counts, setCounts] = useState<{ with: number; without: number } | null>(null);
  const key = `${spec.rotors.join()}-${spec.menu.links.map((l) => l.cipher).join()}`;
  useEffect(() => {
    let cancelled = false;
    setCounts(null);
    (async () => {
      const result = { with: 0, without: 0 };
      for (const d of [true, false]) {
        const run = new BombeRun({ ...spec, diagonal: d });
        while (!run.done) {
          run.advance(3000);
          await new Promise((r) => setTimeout(r, 0));
          if (cancelled) return;
        }
        result[d ? "with" : "without"] = run.stops.length;
      }
      if (!cancelled) setCounts(result);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const wrong: Triple<number> = [mod26(trueCore[0] + 3), mod26(trueCore[1] + 9), mod26(trueCore[2] + 14)];
  return (
    <div className="sheet">
      <div className="sheet-card">
        <div className="section-head">
          <h4 style={{ margin: 0 }}>
            {zh ? `同一个错误位置 ${coreText(wrong)}：` : `The same wrong position ${coreText(wrong)}: `}
            {diagonal ? (zh ? "接上对角板" : "with the diagonal board") : zh ? "不接对角板" : "without it"}
          </h4>
          <div className="segmented small" role="group">
            <button type="button" aria-pressed={!diagonal} onClick={() => setDiagonal(false)}>
              {zh ? "无对角板" : "No board"}
            </button>
            <button type="button" aria-pressed={diagonal} onClick={() => setDiagonal(true)}>
              {zh ? "对角板" : "Diagonal board"}
            </button>
          </div>
        </div>
        <WireGrid spec={spec} core={wrong} trueStecker={null} playKey={`diag-${diagonal}-${key}`} />
      </div>
      <div className="sheet-card">
        <h4>{zh ? "这个菜单、这种转子排列，完整跑一遍的停机数" : "Stops for this menu and wheel order, full run"}</h4>
        <div className="stat-row">
          <div>
            <b>{counts ? fmt(counts.without) : "…"}</b>
            <span>{zh ? "不接对角板" : "without the board"}</span>
          </div>
          <div>
            <b>{counts ? fmt(counts.with) : "…"}</b>
            <span>{zh ? "接上对角板" : "with the board"}</span>
          </div>
          <div>
            <b>17,576</b>
            <span>{zh ? "被测试的位置" : "positions tested"}</span>
          </div>
        </div>
        <p className="note">
          {zh ? "每次停机都要人工核对；停机数决定了一台 Bombe 一天能处理多少菜单。" : "Every stop has to be checked by hand, so the stop count decided how many menus a Bombe could get through in a day."}
        </p>
      </div>
    </div>
  );
}

function RunPanel(props: {
  zh: boolean;
  index: number;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
  speed: number;
  setSpeed: (n: number) => void;
  pauseAtStops: boolean;
  setPauseAtStops: (b: boolean) => void;
  stops: BombeStop[];
  current: BombeStop | null;
  selected: BombeStop | null;
  onSelect: (s: BombeStop) => void;
  onCheck: (s: BombeStop) => void;
  order: Triple<RotorId>;
  setOrder: (o: Triple<RotorId>) => void;
  trueOrder: Triple<RotorId>;
  sweep: Sweep | null;
  onSweep: () => void;
  onCancelSweep: () => void;
  diagonal: boolean;
}) {
  const { zh, index, running, stops } = props;
  const at = coreAt(Math.min(POSITIONS - 1, index));
  const done = index >= POSITIONS;
  return (
    <>
      <div className="section-head">
        <h3>{zh ? "运行" : "Run"}</h3>
        <span className="aside mono">
          {fmt(Math.min(index, POSITIONS))} / {fmt(POSITIONS)}
        </span>
      </div>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${(Math.min(index, POSITIONS) / POSITIONS) * 100}%` }} />
      </div>
      <div className="stat-row">
        <div>
          <b>{coreText(at)}</b>
          <span>{zh ? "指示器（上·中·下）" : "Indicator (top·mid·bottom)"}</span>
        </div>
        <div>
          <b>{stops.length}</b>
          <span>{zh ? "停机次数" : "stops so far"}</span>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={props.onToggle}>
          {running ? <IconPause /> : <IconPlay />}
          {running ? (zh ? "暂停" : "Pause") : done ? (zh ? "重新运行" : "Run again") : index > 0 ? (zh ? "继续" : "Continue") : zh ? "启动" : "Start"}
        </button>
        <button type="button" className="btn quiet" onClick={props.onReset}>
          <IconReset /> {zh ? "复位" : "Reset"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 6 }}>
        <div className="segmented small" role="group" aria-label={zh ? "速度" : "Speed"}>
          {[
            [28, "1×"],
            [400, "15×"],
            [3000, "100×"],
            [40000, zh ? "最快" : "max"],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={props.speed === v} onClick={() => props.setSpeed(v as number)}>
              {l}
            </button>
          ))}
        </div>
        <label className="note" style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={props.pauseAtStops} onChange={(e) => props.setPauseAtStops(e.target.checked)} />
          {zh ? "停机时暂停" : "Halt at each stop"}
        </label>
      </div>
      <p className="note">
        {zh
          ? `1× 约等于原机速度（每秒约 28 个位置，跑完要 10 分钟）。${props.diagonal ? "" : "注意：对角板已关闭。"}`
          : `1× is roughly the original speed (≈ 28 positions a second, 10 minutes a run).${props.diagonal ? "" : " Note: the diagonal board is off."}`}
      </p>
      {stops.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 12 }}>
            <h3>{zh ? "停机记录" : "Stops"}</h3>
            <span className="aside">{zh ? "点选查看，再核对" : "Pick one, then check it"}</span>
          </div>
          <ul className="stops">
            {stops.map((s, i) => {
              const dead = [...ALPHABET].filter((_, k) => !(s.live & (1 << k)));
              return (
                <li key={s.index}>
                  <button type="button" aria-pressed={props.selected?.index === s.index} onClick={() => props.onSelect(s)} onDoubleClick={() => props.onCheck(s)}>
                    <span className="mono">{i + 1}</span>
                    <span className="mono">{coreText(s.core)}</span>
                    <span className="mono">
                      {s.count}/26
                    </span>
                    <span>
                      {s.count === 25
                        ? zh
                          ? `没电：${dead[0]}`
                          : `dead: ${dead[0]}`
                        : s.count === 1
                          ? zh
                            ? `仅 ${[...ALPHABET].find((_, k) => s.live & (1 << k))} 有电`
                            : `only ${[...ALPHABET].find((_, k) => s.live & (1 << k))} live`
                          : zh
                            ? `${s.count} 根有电`
                            : `${s.count} live`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="btn-row">
            <button type="button" className="btn" disabled={!props.selected} onClick={() => props.selected && props.onCheck(props.selected)}>
              {zh ? "核对选中的停机" : "Check the selected stop"}
            </button>
          </div>
        </>
      )}
      <WheelOrderPicker zh={zh} order={props.order} setOrder={props.setOrder} trueOrder={props.trueOrder} />
      <div className="section-head" style={{ marginTop: 14 }}>
        <h3>{zh ? "一整天的工作量" : "A whole day's work"}</h3>
      </div>
      <p className="prose">
        {zh
          ? "真实情况下转子排列未知，要把 60 种都跑一遍（一台 Bombe 约 20 小时）。浏览器里只需几十秒："
          : "With the wheel order unknown, all 60 must be run (about 20 hours on one Bombe). In the browser it takes some seconds:"}
      </p>
      {props.sweep ? (
        <>
          <div className="progress">
            <div style={{ width: `${(props.sweep.order / 60) * 100}%` }} />
          </div>
          <div className="stat-row">
            <div>
              <b>{props.sweep.order}/60</b>
              <span>{zh ? "已跑的排列" : "orders run"}</span>
            </div>
            <div>
              <b>{props.sweep.stops.length}</b>
              <span>{zh ? "停机" : "stops"}</span>
            </div>
            <div>
              <b>{props.sweep.stops.filter((s) => s.consistent).length}</b>
              <span>{zh ? "通过核对" : "pass checking"}</span>
            </div>
          </div>
          {props.sweep.done && props.sweep.ranked ? (
            <>
              <p className="note">
                {zh
                  ? "通过核对的停机逐一试译，按德文得分排序（常用词与常见字母对）："
                  : "Each stop that passed checking is trial-decrypted and ranked by a German score (common words and letter pairs):"}
              </p>
              <ul className="stops">
                {props.sweep.ranked.slice(0, 6).map((r, i) => (
                  <li key={i}>
                    <div className="rank-row">
                      <span className="mono">{r.order.join("-")}</span>
                      <span className="mono">{coreText(r.core)}</span>
                      <span className={i === 0 ? "tag good" : "tag neutral"}>{r.score}</span>
                      <span className="mono rank-text">{r.text.slice(0, 26)}…</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <button type="button" className="btn quiet" onClick={props.onCancelSweep}>
              {zh ? "停止" : "Stop"}
            </button>
          )}
        </>
      ) : (
        <button type="button" className="btn" onClick={props.onSweep}>
          {zh ? "跑完全部 60 种排列" : "Run all 60 wheel orders"}
        </button>
      )}
    </>
  );
}

function CheckSheet({
  checked,
  scenario,
  offset,
  reveal,
  onReveal,
  trueCore,
  hasRun,
  goRun,
}: {
  checked: { stop: BombeStop; order: Triple<RotorId>; key: RecoveredKey | null; consistent: boolean } | null;
  scenario: Scenario;
  offset: number;
  reveal: boolean;
  onReveal: () => void;
  trueCore: Triple<number>;
  hasRun: boolean;
  goRun: () => void;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  if (!checked)
    return (
      <div className="sheet">
        <div className="sheet-card">
          <h4>{zh ? "还没有停机可以核对" : "No stop to check yet"}</h4>
          <p className="prose">
            {zh
              ? "可以回到第 8 步看滚筒转动，也可以直接把这一种转子排列一次跑完。"
              : "Go back to step 8 to watch the drums turn, or run this wheel order to the end in one go."}
          </p>
          <button type="button" className="btn primary" onClick={goRun}>
            {zh ? "立即跑完并核对" : "Run it now and check"}
          </button>
        </div>
      </div>
    );
  const { stop, key } = checked;
  const text = key?.plaintext ?? "";
  const cribEnd = offset + scenario.crib.length;
  const pairs = key ? key.config.plugboard.split(" ").filter(Boolean) : [];
  void hasRun;
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>
          {zh ? "停机 " : "Stop "}
          <span className="mono">{coreText(stop.core)}</span>
          {zh ? `（转子 ${checked.order.join("-")}）` : ` (wheels ${checked.order.join("-")})`}
          {"  "}
          {checked.consistent ? (
            <span className="tag good">{zh ? "通过核对" : "passes checking"}</span>
          ) : (
            <span className="tag bad">{zh ? "假停机" : "false stop"}</span>
          )}
        </h4>
        {key ? (
          <>
            <p className="prose">
              {zh
                ? "由停机推出的插线（实心）与试译补上的插线（虚线）："
                : "Steckers implied by the stop (solid) and those added by trial decryption (dashed):"}
            </p>
            <div className="pairs">
              {pairs.map((p) => (
                <span key={p} className={key.addedPairs.includes(p) ? "added" : "found"}>
                  {p}
                </span>
              ))}
            </div>
            <dl className="specs" style={{ marginTop: 12 }}>
              <dt>{zh ? "线芯偏转（停机读数）" : "Core offsets (the stop)"}</dt>
              <dd className="mono">{coreText(stop.core)}</dd>
              <dt>{zh ? "环设置（中、右）" : "Rings (middle, right)"}</dt>
              <dd>
                <span className="mono">
                  {String(key.config.rings[1] + 1).padStart(2, "0")} · {String(key.config.rings[2] + 1).padStart(2, "0")}
                </span>
                <span className="note" style={{ marginLeft: 8 }}>
                  {key.determinedRings[2] ? (zh ? "右环由中转子进位位置确定" : "right ring fixed by where the middle rotor turns") : ""}
                  {!key.determinedRings[1] ? (zh ? "；中环在本电文内无法区分" : "; middle ring not observable in this message") : ""}
                </span>
              </dd>
              <dt>{zh ? "电文起始窗口" : "Start windows"}</dt>
              <dd className="mono">{key.config.positions.map((p) => ALPHABET[p]).join(" ")}</dd>
            </dl>
            <div className="section-head" style={{ marginTop: 14 }}>
              <h4 style={{ margin: 0 }}>{zh ? "试译结果" : "Trial decryption"}</h4>
            </div>
            <div className="plain-out">
              <span>{text.slice(0, offset)}</span>
              <span className="crib">{text.slice(offset, cribEnd)}</span>
              <span>{text.slice(cribEnd)}</span>
            </div>
            {text === scenario.plaintext && (
              <p className="note">
                {zh
                  ? "全文读通：“致第三航空队：瑟堡地区天气预报……”。"
                  : "It reads all the way through: “To Air Fleet Three: weather forecast for the Cherbourg area…”."}
              </p>
            )}
          </>
        ) : (
          <p className="prose">
            {zh
              ? "26 种插线假设逐一检验，每一种都会让某个字母同时插到两处。这是一次假停机——记下、丢弃，继续运行。"
              : "All 26 stecker hypotheses fail when checked one by one: each leaves some letter plugged to two places. A false stop: note it, discard it, run on."}
          </p>
        )}
      </div>
      <div className="sheet-card">
        <div className="section-head">
          <h4 style={{ margin: 0 }}>{zh ? "对照当天真实密钥" : "Compare with the day's real key"}</h4>
          {!reveal && (
            <button type="button" className="btn quiet" onClick={onReveal}>
              {zh ? "揭晓" : "Reveal"}
            </button>
          )}
        </div>
        {reveal ? (
          <dl className="specs">
            <dt>{zh ? "转子" : "Wheels"}</dt>
            <dd className="mono">{scenario.key.rotors.join(" ")}</dd>
            <dt>{zh ? "环设置" : "Rings"}</dt>
            <dd className="mono">{scenario.key.rings.map((r) => String(r + 1).padStart(2, "0")).join(" ")}</dd>
            <dt>{zh ? "起始位置" : "Start"}</dt>
            <dd className="mono">{scenario.key.positions.map((p) => ALPHABET[p]).join(" ")}</dd>
            <dt>{zh ? "插线" : "Plugs"}</dt>
            <dd className="mono">{scenario.key.plugboard}</dd>
            <dt>{zh ? "猜词处的线芯偏转" : "Core offsets at the crib"}</dt>
            <dd className="mono">{coreText(trueCore)}</dd>
          </dl>
        ) : (
          <p className="note">{zh ? "核对之前先别看。" : "Try checking before you peek."}</p>
        )}
        {reveal && (
          <p className="note">
            {zh
              ? "环设置与起始位置可能和真实值不同，但“起始 − 环”相同：Bombe 只能也只需确定导线看到的偏转。"
              : "Rings and start may differ from the real ones while start − ring agrees: the Bombe can only, and need only, fix what the wiring sees."}
          </p>
        )}
      </div>
    </div>
  );
}

function CheckPanel({
  zh,
  checked,
  spec,
}: {
  zh: boolean;
  checked: { stop: BombeStop; order: Triple<RotorId>; key: RecoveredKey | null; consistent: boolean } | null;
  spec: BombeSpec;
}) {
  return (
    <>
      <h3 style={{ margin: "0 0 8px" }}>{zh ? "核对的三步" : "Checking, in three moves"}</h3>
      <ol className="derive">
        <li>{zh ? "读出测试寄存器，得到测试字母的插线候选。" : "Read the test register: a stecker candidate for the test letter."}</li>
        <li>{zh ? "沿菜单推出其余字母的插线；任何冲突都说明是假停机。" : "Follow the menu to the other letters' steckers; any clash means a false stop."}</li>
        <li>{zh ? "用推出的插线试译，调整右、中转子的环设置直到全文通顺。" : "Decrypt with them, adjusting the right and middle ring settings until the whole text reads."}</li>
      </ol>
      {checked && <StopSummary spec={spec} core={checked.stop.core} />}
    </>
  );
}

function NoMenu({ zh, onFix }: { zh: boolean; onFix: () => void }) {
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>{zh ? "这个位置有冲突，画不出菜单" : "This position crashes: no menu"}</h4>
        <p className="prose">{zh ? "回到第 2 步选一个没有冲突的位置。" : "Go back to step 2 and pick a crash-free position."}</p>
        <button type="button" className="btn" onClick={onFix}>
          {zh ? "用电文中真实的位置" : "Use the real position"}
        </button>
      </div>
    </div>
  );
}

export type { MachineConfig };
