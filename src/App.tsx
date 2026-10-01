import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  AudioLines,
  BookOpen,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  CircuitBoard,
  Copy,
  Expand,
  FlaskConical,
  Focus,
  Keyboard,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipForward,
  X,
  ArrowLeft,
} from "lucide-react";
import MachineScene from "./components/MachineScene";
import ComponentInspectionControls from "./components/ComponentInspectionControls";
import {
  INSPECTION_ASSEMBLIES,
  INSPECTION_PARTS,
} from "./components/inspection-catalog";
import { createInspection, type ComponentInspection } from "./core/inspection";
import type { PartId } from "./components/MachineScene";
import type { MachineSceneProps } from "./components/MachineScene";
import { previewConfig, updateRotorDraft } from "./core/configuration-preview";
import Circuit from "./components/Circuit";
import RotorReadout from "./components/RotorReadout";
import {
  DEFAULT_CONFIG,
  encryptKey,
  encryptText,
  letter,
  validateConfig,
} from "./core/enigma";
import type { MachineConfig, RotorId, ReflectorId } from "./core/enigma";
import { stageLabel, useLanguage } from "./i18n";

type Trace = ReturnType<typeof encryptKey>;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PARTS: {
  id: PartId;
  name: string;
  en: string;
  description: string;
  specs: [string, string][];
}[] = [
  {
    id: "machine",
    name: "恩尼格玛 I 型",
    en: "ENIGMA I · COMPLETE ASSEMBLY",
    description:
      "木箱、胶木与黄铜，封存一段机械密码的历史。按下字母，沿着真实接线，追踪电流往返的旅程。",
    specs: [
      ["制式", "陆军 · 三转子"],
      ["字母系统", "26 个拉丁字母"],
      ["运作方式", "机电式置换"],
      ["结构模型", "历史结构教学模型"],
    ],
  },
  {
    id: "rotors",
    name: "转子组",
    en: "WALZEN · ROTOR ASSEMBLY",
    description:
      "三枚转子，每枚藏着 26 条固定走线。窗口位置控制转动，环设置改变字母环与内部线芯的偏移。",
    specs: [
      ["可选转子", "I / II / III / IV / V"],
      ["触点数量", "每侧 26 个"],
      ["步进顺序", "先步进，再通电"],
      ["进位机制", "缺口触发 · 双步进"],
    ],
  },
  {
    id: "reflector",
    name: "反射器",
    en: "UMKEHRWALZE · REFLECTOR",
    description:
      "将电流送回转子组的另一条路径。13 对固定连接让同一设置既能加密，也能解密。",
    specs: [
      ["可选型号", "UKW B / UKW C"],
      ["连接数量", "13 对"],
      ["运动状态", "固定不旋转"],
      ["密码特征", "字母不加密为自身"],
    ],
  },
  {
    id: "plugboard",
    name: "插线板",
    en: "STECKERBRETT · PLUGBOARD",
    description:
      "两两交换字母。电流在进入转子之前、离开转子之后，都会经过同一组插线。",
    specs: [
      ["常规配置", "最多 10 对插线"],
      ["连接规则", "一个字母只用一次"],
      ["未连接字母", "保持原样"],
      ["配置位置", "顶部 · 机器设置"],
    ],
  },
  {
    id: "keyboard",
    name: "按键机构",
    en: "TASTATUR · KEYBOARD",
    description:
      "按下按键时，棘爪先推动转子，再闭合电路。可以使用实体键盘，也可以点击下方按键。",
    specs: [
      ["键盘布局", "德式 QWERTZ"],
      ["输入范围", "A–Z"],
      ["机械动作", "步进 → 触点闭合"],
      ["重复输入", "每次击键独立推进"],
    ],
  },
  {
    id: "lampboard",
    name: "灯板",
    en: "LAMPENFELD · LAMP PANEL",
    description:
      "完成往返旅程的电流，点亮一个输出字母。保存好初始设置，再输入密文，就能还原明文。",
    specs: [
      ["灯泡数量", "26 盏"],
      ["输出方式", "单灯指示"],
      ["显示内容", "当前加密字母"],
      ["复原条件", "相同初始机器设置"],
    ],
  },
];
const PHASES = [
  "机械步进",
  "插线板 · 进入",
  "右转子 · 正向",
  "中转子 · 正向",
  "左转子 · 正向",
  "反射器",
  "左转子 · 返回",
  "中转子 · 返回",
  "右转子 · 返回",
  "插线板 · 返回",
  "输出灯点亮",
];
const clone = (c: MachineConfig): MachineConfig => ({
  ...c,
  rotors: [...c.rotors],
  positions: [...c.positions],
  rings: [...c.rings],
});
const group = (s: string) => s.match(/.{1,5}/g)?.join(" ") ?? "";
const normalizePlugs = (s: string) =>
  s.trim().toUpperCase().replace(/\s+/g, " ");
function App() {
  const { language, setLanguage, t } = useLanguage();
  const modalRef = useRef<HTMLElement>(null);
  const modalOpener = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<PartId>("machine");
  const [exploded, setExploded] = useState(false);
  const [rotorCoverRemoved, setRotorCoverRemoved] = useState(false);
  const [lampCoverRemoved, setLampCoverRemoved] = useState(false);
  const [view, setView] = useState<"model" | "circuit">("model");
  const [config, setConfig] = useState(() => clone(DEFAULT_CONFIG));
  const [draft, setDraft] = useState(() => clone(DEFAULT_CONFIG));
  const [initialConfig, setInitialConfig] = useState(() =>
    clone(DEFAULT_CONFIG),
  );
  const [trace, setTrace] = useState<Trace | null>(null);
  const [phase, setPhase] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [inspection, setInspection] = useState(false);
  const [pane, setPane] = useState<
    "inspect" | "settings" | "operate" | "message"
  >("inspect");
  const settingsOpen = pane === "settings";
  const [collapseReason, setCollapseReason] = useState<
    "manual" | "zoom" | null
  >(null);
  const paneCollapsed = collapseReason !== null;
  const paneRef = useRef<HTMLElement>(null);
  const paneExpandRef = useRef<HTMLButtonElement>(null);
  const paneToggleRef = useRef<HTMLButtonElement>(null);
  const collapsedRailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (paneCollapsed && active && paneRef.current?.contains(active))
      paneExpandRef.current?.focus({ preventScroll: true });
    else if (
      !paneCollapsed &&
      active &&
      collapsedRailRef.current?.contains(active)
    )
      paneToggleRef.current?.focus({ preventScroll: true });
  }, [paneCollapsed, view]);
  const handleUserZoom = useCallback((zoomedIn: boolean) => {
    setCollapseReason((reason) =>
      reason === "manual" ? reason : zoomedIn ? "zoom" : null,
    );
  }, []);
  const [detail, setDetail] = useState<ComponentInspection | null>(null);
  const detailSpreadFrame = useRef(0);
  const updateDetail = useCallback((change: Partial<ComponentInspection>) => {
    if (change.spread !== undefined || change.assembly !== undefined)
      cancelAnimationFrame(detailSpreadFrame.current);
    setDetail((current) => (current ? { ...current, ...change } : null));
  }, []);
  useEffect(
    () => () => cancelAnimationFrame(detailSpreadFrame.current),
    [detail?.assembly],
  );
  const toggleDetailSpread = () => {
    if (!detail) return;
    cancelAnimationFrame(detailSpreadFrame.current);
    const from = detail.spread,
      to = from > 0.02 ? 0 : 0.85,
      start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650),
        smooth = t * t * (3 - 2 * t);
      setDetail((current) =>
        current ? { ...current, spread: from + (to - from) * smooth } : null,
      );
      if (t < 1) detailSpreadFrame.current = requestAnimationFrame(tick);
    };
    detailSpreadFrame.current = requestAnimationFrame(tick);
  };
  const [previewFocus, setPreviewFocus] =
    useState<MachineSceneProps["previewFocus"]>(null);
  const previewOrigin = useRef<{
    selected: PartId;
    followSignal: boolean;
  } | null>(null);
  const stageProgressRef = useRef(0);
  const [transition, setTransition] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const transitionProgressRef = useRef(0);
  const stopAfterTransition = useRef(false);
  const [followSignal, setFollowSignal] = useState(true);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!followSignal || phase < 0) return;
    setSelected(
      phase === 0
        ? "keyboard"
        : phase === 1 || phase === 9
          ? "plugboard"
          : phase === 5
            ? "reflector"
            : phase === 10
              ? "lampboard"
              : "rotors",
    );
  }, [followSignal, phase]);
  const [records, setRecords] = useState<Trace[]>([]);
  const [error, setError] = useState("");
  const [resetView, setResetView] = useState(0);
  const [tab, setTab] = useState<"operate" | "records">("operate");
  const [modal, setModal] = useState<"help" | "about" | null>(null);
  const [message, setMessage] = useState("HELLOWORLD");
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const busy = (phase >= 0 && phase < 10) || !!transition;
  const isPreview = !!previewFocus;
  const modelConfig = isPreview ? previewConfig(draft, config) : config;
  const inputsLocked = busy || isPreview;
  const part = PARTS.find((p) => p.id === selected)!;
  const plain = records.map((r) => r.input).join("");
  const cipher = records.map((r) => r.output).join("");
  const send = useCallback(
    (key: string) => {
      if (lock.current || isPreview) return;
      setDetail(null);
      setFollowSignal(true);
      const result = encryptKey(config, key);
      lock.current = true;
      setConfig((c) => ({ ...c, positions: result.after }));
      setTrace(result);
      setTransition(null);
      stopAfterTransition.current = false;
      stageProgressRef.current = 0;
      setPhase(0);
      setPlaying(true);
      setRecords((r) => [...r, result]);
      setError("");
    },
    [config, isPreview],
  );
  const togglePlayback = useCallback(() => {
    if (isPreview) return;
    setDetail(null);
    setFollowSignal(true);
    if (!trace) {
      send("A");
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!transition && phase === 10) {
      lock.current = true;
      stageProgressRef.current = 0;
      setPhase(0);
    } else if (!transition && stageProgressRef.current >= 1) {
      stageProgressRef.current = 0;
    }
    setPlaying(true);
  }, [trace, playing, phase, send, transition, isPreview]);
  useEffect(() => {
    lock.current = busy;
  }, [busy]);
  useEffect(() => {
    if (!playing || !busy || isPreview) return;
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(now - previous, 100);
      previous = now;
      if (transition) {
        transitionProgressRef.current = Math.min(
          1,
          transitionProgressRef.current + delta / (850 / speed),
        );
        if (transitionProgressRef.current >= 1) {
          const stop = stopAfterTransition.current || transition.to === 10;
          stageProgressRef.current = stop ? 1 : 0;
          setPhase(transition.to);
          setTransition(null);
          stopAfterTransition.current = false;
          if (stop) setPlaying(false);
        } else frame = requestAnimationFrame(animate);
        return;
      }
      stageProgressRef.current = Math.min(
        1,
        stageProgressRef.current + delta / (1200 / speed),
      );
      if (stageProgressRef.current >= 1) {
        transitionProgressRef.current = 0;
        stopAfterTransition.current = false;
        setTransition({ from: phase, to: phase + 1 });
      } else frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, busy, phase, speed, transition, isPreview]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || modal) return;
      if (e.key === "Escape" && detail) {
        setDetail(null);
        setSelected("machine");
        setResetView((v) => v + 1);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable=true]"))
        return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        send(e.key.toUpperCase());
      } else if (e.code === "Space" && trace && !target.closest("button")) {
        e.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [send, trace, modal, togglePlayback, detail]);
  useEffect(() => {
    if (!modal) return;
    const previousFocus = modalOpener.current;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (e.key !== "Tab") return;
      const controls = modalRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", fn);
    return () => {
      window.removeEventListener("keydown", fn);
      previousFocus?.focus();
    };
  }, [modal]);
  const apply = (c: MachineConfig) => {
    try {
      validateConfig(c);
      setDetail(null);
      const normalized = {
        ...clone(c),
        plugboard: normalizePlugs(c.plugboard),
      };
      setConfig(clone(normalized));
      setDraft(clone(normalized));
      setInitialConfig(clone(normalized));
      setPreviewFocus(null);
      previewOrigin.current = null;
      setTrace(null);
      setRecords([]);
      stageProgressRef.current = 0;
      transitionProgressRef.current = 0;
      stopAfterTransition.current = false;
      setTransition(null);
      setPhase(-1);
      setPlaying(false);
      setFollowSignal(true);
      setError("");
      lock.current = false;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const applyPlugboard = () => {
    if (isPreview) return;
    const pending = clone(draft);
    if (apply({ ...clone(initialConfig), plugboard: pending.plugboard })) {
      setDraft({ ...pending, plugboard: normalizePlugs(pending.plugboard) });
      setSelected("plugboard");
      setView("model");
    }
  };
  const seek = (next: number) => {
    if (isPreview) return;
    setDetail(null);
    setFollowSignal(true);
    setTransition(null);
    stopAfterTransition.current = false;
    transitionProgressRef.current = 0;
    stageProgressRef.current = 1;
    setPhase(next);
    setPlaying(false);
    lock.current = next < 10;
  };
  const travelTo = (next: number) => {
    if (!trace || transition || isPreview) return;
    setDetail(null);
    setFollowSignal(true);
    stageProgressRef.current = 1;
    transitionProgressRef.current = 0;
    stopAfterTransition.current = true;
    setTransition({ from: phase, to: next });
    setPlaying(true);
    lock.current = true;
  };
  const rotorField = (
    field: "rotors" | "positions" | "rings",
    index: number,
    value: string,
  ) => {
    const next = updateRotorDraft(
      draft,
      field,
      index as 0 | 1 | 2,
      field === "rotors" ? (value as RotorId) : Number(value),
    );
    setDraft(next);
    beginPreview({ field, rotorIndex: index as 0 | 1 | 2 });
  };
  const beginPreview = (
    focus: NonNullable<MachineSceneProps["previewFocus"]>,
  ) => {
    setDetail(null);
    setPane("settings");
    if (!previewFocus) previewOrigin.current = { selected, followSignal };
    setPreviewFocus(focus);
    setPlaying(false);
    setFollowSignal(false);
    setSelected(focus.field === "reflector" ? "reflector" : "rotors");
    setView("model");
    setError("");
  };
  const discardPreview = () => {
    setDraft(clone(initialConfig));
    setPreviewFocus(null);
    if (previewOrigin.current) {
      setSelected(previewOrigin.current.selected);
      setFollowSignal(previewOrigin.current.followSignal);
    }
    previewOrigin.current = null;
    setError("");
  };
  const step = () => {
    if (transition || isPreview) return;
    setDetail(null);
    setFollowSignal(true);
    if (!trace) {
      const result = encryptKey(config, "A");
      setTrace(result);
      setConfig((c) => ({ ...c, positions: result.after }));
      setRecords((r) => [...r, result]);
      stageProgressRef.current = 1;
      setPhase(0);
      setPlaying(false);
      lock.current = true;
    } else {
      travelTo(phase < 10 ? phase + 1 : 0);
    }
  };
  const batch = () => {
    if (inputsLocked) return;
    setDetail(null);
    try {
      if (!/^[a-zA-Z\s]+$/.test(message))
        throw new Error("请输入 A–Z 字母；空格与换行会被忽略。");
      const normalized = message.replace(/\s/g, "").toUpperCase();
      if (!normalized) throw new Error("请先输入至少一个字母。");
      if (normalized.length > 500) throw new Error("单次最多处理 500 个字母。");
      const result = encryptText(config, normalized);
      setConfig(result.config);
      setRecords((r) => [...r, ...result.steps]);
      setTrace(result.steps.at(-1)!);
      setTransition(null);
      stopAfterTransition.current = false;
      stageProgressRef.current = 1;
      setPhase(10);
      setPlaying(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cipher);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("浏览器未允许复制，请在输出区域选择文字复制。");
    }
  };
  const returnToMachine = () => {
    setPane("inspect");
    setCollapseReason(null);
    setDetail(null);
    setSelected("machine");
    setFollowSignal(false);
    setResetView((v) => v + 1);
  };
  const choose = (p: PartId, rotorIndex: 0 | 1 | 2 = 2, fromModel = false) => {
    setFollowSignal(false);
    setSelected(p);
    setView("model");
    if (isPreview) return;
    setPlaying(false);
    setPane("inspect");
    setCollapseReason(null);
    const assembly =
      p === "rotors"
        ? "rotor"
        : p === "reflector"
          ? "reflector"
          : p === "plugboard"
            ? "plug"
            : p === "keyboard"
              ? "key"
              : p === "machine" && fromModel
                ? "housing"
                : null;
    setDetail(
      assembly
        ? {
            ...createInspection(assembly, rotorIndex),
            ...(assembly === "reflector"
              ? { spread: 0.35, wire: trace?.stages[4].input ?? -1 }
              : {}),
          }
        : null,
    );
    setResetView((v) => v + 1);
  };
  const detailAssembly = detail
    ? INSPECTION_ASSEMBLIES.find((a) => a.id === detail.assembly)!
    : null;
  const detailTitle = detailAssembly
    ? language === "en"
      ? detailAssembly.en
      : detailAssembly.zh
    : "";
  const detailPart =
    detail && detail.isolate !== "all"
      ? INSPECTION_PARTS[detail.assembly].find(
          (p) => p[0] === detail.isolate,
        )?.[language === "en" ? 2 : 1]
      : null;
  const openModal = (kind: "help" | "about") => {
    modalOpener.current = document.activeElement as HTMLElement;
    setModal(kind);
  };
  return (
    <div
      className={`app-shell model-mode${view === "circuit" ? " circuit-stage" : ""}${paneCollapsed ? " pane-collapsed" : ""}${isPreview ? " config-preview" : ""}`}
      lang={language === "zh" ? "zh-CN" : "en"}
    >
      <header className="topbar">
        <a className="brand" href="#" aria-label={t("Enigma Lab 首页")}>
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <div>
            ENIGMA<span>ELECTROMECHANICAL ARCHIVE</span>
          </div>
        </a>
        <nav>
          <button
            className={
              settingsOpen ? "settings-toggle active" : "settings-toggle"
            }
            onClick={() => {
              setDetail(null);
              setCollapseReason(null);
              setPane((current) =>
                current === "settings" ? "inspect" : "settings",
              );
            }}
            aria-expanded={settingsOpen}
          >
            <Settings2 size={14} />
            {t("机器设置")}
          </button>
          <button
            className="nav-active"
            onClick={() => {
              setModal(null);
              returnToMachine();
              setView("model");
            }}
          >
            <Box size={14} />
            {t("检视终端")}
          </button>
          <button onClick={() => openModal("help")}>
            <BookOpen size={14} />
            {t("工作原理")}
          </button>
          <button onClick={() => openModal("about")}>
            <CircleHelp size={14} />
            {t("项目说明")}
          </button>
        </nav>
        <button
          className="language-toggle"
          aria-label="Switch language"
          title={language === "zh" ? "Switch to English" : "切换为中文"}
          onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        >
          <span className={language === "zh" ? "active" : ""}>中文</span>
          <span aria-hidden="true">/</span>
          <span className={language === "en" ? "active" : ""}>EN</span>
        </button>
        <div className="system-status">
          <i /> SYSTEM ONLINE <span> / </span> VOL. 001
        </div>
      </header>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t("密码机械档案")} <span>/</span> INTERNAL DATABASE / ENIGMA I
          </div>
          <h1>
            {t("恩尼格玛")} <span>ENIGMA I</span>
            <small>1930 — 1945</small>
          </h1>
        </div>
        <div className="heading-note">
          <span>{t("探索机械，追踪电流，理解密码。")}</span>
          <span className="mono">INTERACTIVE STUDY / THREE-ROTOR MACHINE</span>
        </div>
      </div>
      <main
        className={`workspace${detail ? " component-active" : ""}${settingsOpen ? " settings-open" : ""}${view === "circuit" ? " circuit-active" : ""}`}
      >
        <section className="viewer">
          <div className="viewer-toolbar">
            <div className="segmented">
              <button
                className={view === "model" ? "selected" : ""}
                aria-pressed={view === "model"}
                onClick={() => setView("model")}
              >
                <Box size={13} />
                {t("三维检视")}
              </button>
              <button
                className={view === "circuit" ? "selected" : ""}
                aria-pressed={view === "circuit"}
                onClick={() => {
                  setView("circuit");
                }}
              >
                <CircuitBoard size={13} />
                {t("电路剖面")}
              </button>
            </div>
            <span className="viewer-mode">
              {view === "model" ? "ARCHIVE / E–01" : "LIVE SIGNAL / 026"}
            </span>
          </div>
          {detail && view === "model" && (
            <div className="component-breadcrumb">
              <button onClick={returnToMachine}>
                <ArrowLeft size={13} />
                {language === "en" ? "Whole machine" : "返回整机"}
              </button>
              <ChevronRight size={12} />
              <button onClick={() => updateDetail({ isolate: "all" })}>
                {detailTitle}
                {detail.assembly === "rotor"
                  ? ` · ${modelConfig.rotors[detail.rotorIndex]}`
                  : detail.assembly === "reflector"
                    ? ` · UKW ${modelConfig.reflector}`
                    : ""}
              </button>
              {detailPart && (
                <>
                  <ChevronRight size={12} />
                  <span>{detailPart}</span>
                </>
              )}
            </div>
          )}
          <div className="scene-area">
            <div
              className="model-layer"
              aria-hidden={view !== "model"}
              inert={view !== "model"}
            >
              <MachineScene
                presentation="full-stage"
                paneCollapsed={paneCollapsed}
                onUserZoom={handleUserZoom}
                detail={detail}
                onDetailPart={(id) => updateDetail({ isolate: id })}
                language={language}
                selected={selected}
                previewFocus={previewFocus}
                exploded={exploded}
                rotorCoverRemoved={rotorCoverRemoved}
                lampCoverRemoved={lampCoverRemoved}
                positions={modelConfig.positions}
                previousPositions={isPreview ? undefined : trace?.before}
                reflectorId={modelConfig.reflector}
                rings={modelConfig.rings}
                rotorIds={modelConfig.rotors}
                plugboard={modelConfig.plugboard}
                input={isPreview ? null : (trace?.input ?? null)}
                output={isPreview ? null : (trace?.output ?? null)}
                phase={isPreview ? -1 : phase}
                trace={isPreview ? null : trace}
                inspection={inspection}
                playing={playing}
                stageProgressRef={stageProgressRef}
                transition={isPreview ? null : transition}
                transitionProgressRef={transitionProgressRef}
                followSignal={followSignal}
                onSelect={(p, rotorIndex) => choose(p, rotorIndex, true)}
                resetView={resetView}
              />
              <div className="scene-caption">
                <span>{detail ? detailTitle : "ENIGMA I"}</span>
                <small>
                  {detail
                    ? language === "en"
                      ? "Click a part to inspect · Separate with the slider"
                      : "点击零件继续检视 · 拖动滑杆拆解"
                    : t(
                        isPreview
                          ? "设置实时预览 · 尚未应用"
                          : "木与黄铜 / 三转子密码机",
                      )}
                </small>
              </div>
              <span className="corner-coordinate">
                MODEL E–01
                <br />
                LOGIC / ENIGMA I
              </span>
              <div className="scene-tag">
                <i />{" "}
                {detail
                  ? detail.spread > 0.02
                    ? "COMPONENT / SEPARATED"
                    : "COMPONENT / ASSEMBLED"
                  : exploded
                    ? "EXPLODED ASSEMBLY"
                    : "ASSEMBLED VIEW"}
                <span className="scene-windows">
                  {modelConfig.rotors.map((r, i) => (
                    <b key={i}>
                      {r}
                      <strong>{letter(modelConfig.positions[i])}</strong>
                    </b>
                  ))}
                </span>
              </div>
            </div>
            <div
              className="circuit-workspace"
              aria-hidden={view !== "circuit"}
              inert={view !== "circuit"}
            >
              <Circuit
                visible={view === "circuit"}
                config={modelConfig}
                trace={isPreview ? null : trace}
                phase={isPreview ? -1 : phase}
                language={language}
                onSeek={seek}
              />
            </div>
          </div>
          <div
            className="viewer-bottom"
            aria-hidden={view !== "model"}
            inert={view !== "model"}
          >
            <span className="interaction-hint">
              <Focus size={13} />
              {t("拖动旋转 · 滚轮缩放 · 点击部件")}
            </span>
            <div>
              {detail ? (
                <>
                  <button className="icon-text" onClick={toggleDetailSpread}>
                    <Layers3 size={14} />
                    {language === "en"
                      ? detail.spread > 0.02
                        ? "Assemble component"
                        : "Separate component"
                      : detail.spread > 0.02
                        ? "合拢组件"
                        : "拆开组件"}
                  </button>
                  <button
                    className="icon-only"
                    aria-label={t("重置机位")}
                    onClick={() => setResetView((v) => v + 1)}
                  >
                    <Focus size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={followSignal ? "icon-text active" : "icon-text"}
                    disabled={isPreview}
                    aria-pressed={followSignal}
                    onClick={() => setFollowSignal((v) => !v)}
                  >
                    <Focus size={14} />
                    {t("跟随电流")}
                  </button>
                  <button
                    className={inspection ? "icon-text active" : "icon-text"}
                    aria-pressed={inspection}
                    onClick={() => {
                      setInspection((v) => !v);
                      setView("model");
                    }}
                  >
                    <CircuitBoard size={14} />
                    {t("内部接线")}
                  </button>
                  <button
                    className={exploded ? "icon-text active" : "icon-text"}
                    onClick={() => {
                      setExploded((v) => !v);
                      setView("model");
                    }}
                    aria-pressed={exploded}
                  >
                    <Layers3 size={14} />
                    {language === "en"
                      ? exploded
                        ? "Assemble machine"
                        : "Spread assemblies"
                      : exploded
                        ? "合拢整机"
                        : "展开整机层次"}
                  </button>
                  <button
                    className="icon-only"
                    title={t("重置机位")}
                    aria-label={t("重置机位")}
                    onClick={() => {
                      setResetView((v) => v + 1);
                      setFollowSignal(false);
                      setSelected("machine");
                    }}
                  >
                    <Expand size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
        <aside
          ref={paneRef}
          className="control-pane"
          inert={paneCollapsed}
          aria-hidden={paneCollapsed}
          aria-label={language === "en" ? "Machine controls" : "机器控制窗格"}
        >
          <div className="pane-heading">
            <span>
              {language === "en" ? "INSPECTION DESK" : "机械档案 · 控制窗格"}
            </span>
            <small>E—01 / {String(records.length).padStart(3, "0")}</small>
            <button
              ref={paneToggleRef}
              className="pane-collapse"
              type="button"
              aria-expanded={!paneCollapsed}
              aria-label={
                language === "en"
                  ? paneCollapsed
                    ? "Expand control pane"
                    : "Collapse control pane"
                  : paneCollapsed
                    ? "展开控制窗格"
                    : "收起控制窗格"
              }
              title={
                language === "en"
                  ? paneCollapsed
                    ? "Expand controls"
                    : "Collapse controls"
                  : paneCollapsed
                    ? "展开控制窗格"
                    : "收起控制窗格"
              }
              onClick={() => setCollapseReason(paneCollapsed ? null : "manual")}
            >
              {paneCollapsed ? (
                <ArrowLeft size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
            </button>
          </div>
          <div
            className="pane-tabs"
            role="tablist"
            aria-label={language === "en" ? "Control panels" : "控制面板"}
          >
            {(
              [
                ["inspect", "检视", "Inspect", Box],
                ["settings", "设置", "Settings", Settings2],
                ["operate", "操作", "Operate", Keyboard],
                ["message", "电文", "Message", FlaskConical],
              ] as const
            ).map(([id, zh, en, Icon]) => (
              <button
                key={id}
                id={`pane-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={pane === id}
                aria-controls={`pane-${id}`}
                className={pane === id ? "active" : ""}
                onClick={() => {
                  setPane(id);
                  setCollapseReason(null);
                  if (id === "settings") setDetail(null);
                }}
              >
                <Icon size={13} />
                <span>{language === "en" ? en : zh}</span>
              </button>
            ))}
          </div>
          <div className="pane-scroll">
            <div
              id="pane-inspect"
              role="tabpanel"
              aria-labelledby="pane-tab-inspect"
              hidden={pane !== "inspect"}
            >
              <aside
                className={
                  detail && view === "model"
                    ? "archive component-archive"
                    : "archive"
                }
              >
                {detail && view === "model" ? (
                  <>
                    <ComponentInspectionControls
                      detail={detail}
                      config={modelConfig}
                      language={language}
                      onChange={updateDetail}
                      onToggleSpread={toggleDetailSpread}
                    />
                    {detail.assembly === "plug" && (
                      <button
                        className="component-edit-plugs"
                        onClick={() => setDetail(null)}
                      >
                        {language === "en"
                          ? "Edit plugboard pairs"
                          : "设置插线配对"}
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="panel-label">
                      {t("部件索引")} <span>01—06</span>
                    </div>
                    <div className="archive-list">
                      {PARTS.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => choose(p.id)}
                          className={selected === p.id ? "selected" : ""}
                        >
                          <span className="index">0{i + 1}</span>
                          <span>
                            {t(p.name)}
                            {selected === p.id && (
                              <small>{p.en.split(" · ")[0]}</small>
                            )}
                          </span>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                    <div className="part-dossier">
                      <div className="dossier-number">
                        0{PARTS.indexOf(part) + 1}
                        <span> / COMPONENT</span>
                      </div>
                      <h2>{t(part.name)}</h2>
                      <p>{t(part.description)}</p>
                      {selected === "plugboard" ? (
                        <form
                          className="plug-editor"
                          onSubmit={(e) => {
                            e.preventDefault();
                            applyPlugboard();
                          }}
                        >
                          <label htmlFor="quick-plugs">{t("插线配对")}</label>
                          <div>
                            <input
                              id="quick-plugs"
                              aria-label={t("快速插线配对")}
                              value={draft.plugboard}
                              placeholder="AZ BY"
                              autoComplete="off"
                              spellCheck={false}
                              onChange={(e) => {
                                setDraft((c) => ({
                                  ...c,
                                  plugboard: e.target.value.toUpperCase(),
                                }));
                                setError("");
                              }}
                            />
                            <button type="submit" disabled={isPreview}>
                              {t("连接并复位")}
                            </button>
                          </div>
                          <small>
                            {t("空格分隔，最多 10 对；留空可拔除全部插线。")}
                          </small>
                          <small>{t("连接后复位窗口并清空记录。")}</small>
                          {isPreview && (
                            <small>{t("请先应用或取消转子预览。")}</small>
                          )}
                          <p className="plug-status" role="status">
                            {t("当前连接")}:{" "}
                            <b>
                              {config.plugboard
                                ? config.plugboard
                                    .split(/\s+/)
                                    .map((p) => `${p[0]} ↔ ${p[1]}`)
                                    .join(" · ")
                                : t("无插线")}
                            </b>
                            {normalizePlugs(draft.plugboard) !==
                              config.plugboard && <em>{t("待应用")}</em>}
                          </p>
                          {error && (
                            <p className="plug-error" role="alert">
                              {t(error)}
                            </p>
                          )}
                        </form>
                      ) : (
                        <dl>
                          {part.specs.map(([a, b]) => (
                            <div key={a}>
                              <dt>{t(a)}</dt>
                              <dd>{t(b)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <button
                      className="wire-demo"
                      onClick={() => {
                        const c = {
                          ...clone(DEFAULT_CONFIG),
                          rings: [0, 2, 5] as [number, number, number],
                          plugboard: "AB CD EF",
                        };
                        apply(c);
                        const result = encryptKey(c, "A");
                        setConfig({ ...c, positions: result.after });
                        setTrace(result);
                        setRecords([result]);
                        setPhase(1);
                        stageProgressRef.current = 1;
                        setPlaying(false);
                        setInspection(true);
                        setFollowSignal(true);
                        setView("model");
                        setSelected("plugboard");
                        lock.current = true;
                      }}
                    >
                      {t("载入接线演示")}
                      <ArrowRight size={14} />
                    </button>
                    {isPreview ? (
                      <div className="preview-card">
                        <b>{t("设置实时预览")}</b>
                        <p>
                          {t(
                            "模型显示草稿设置；已有记录保留，应用后才用于新的加密。",
                          )}
                        </p>
                        <button onClick={() => apply(draft)}>
                          {t("应用设置并复位")}
                        </button>
                        <button onClick={discardPreview}>
                          {t("取消预览")}
                        </button>
                      </div>
                    ) : (
                      <div className="scene-transport">
                        <div className="scene-transport-header">
                          <span>{t("电流检视")}</span>
                          <small>
                            {trace
                              ? transition
                                ? `${String(transition.from + 1).padStart(2, "0")} → ${String(transition.to + 1).padStart(2, "0")}`
                                : `${String(Math.max(0, phase) + 1).padStart(2, "0")} / 11`
                              : "STANDBY"}
                          </small>
                        </div>
                        <div className="scene-signal-readout">
                          <b>{trace?.input ?? "A"}</b>
                          <ArrowRight size={14} />
                          <b>{phase >= 10 ? trace?.output : "·"}</b>
                          <span>
                            {trace
                              ? t(PHASES[Math.max(0, phase)])
                              : t("一次击键，一段旅程")}
                          </span>
                        </div>
                        <div className="scene-control-row">
                          <button
                            aria-label={t("三维播放控制")}
                            onClick={togglePlayback}
                          >
                            {playing ? <Pause size={12} /> : <Play size={12} />}{" "}
                            {t(
                              playing ? "暂停" : trace ? "回放" : "按下 A 体验",
                            )}
                          </button>
                          <button
                            aria-label={t("三维上一步")}
                            disabled={!trace || phase <= 0 || !!transition}
                            onClick={() => travelTo(Math.max(0, phase - 1))}
                          >
                            ←
                          </button>
                          <button
                            aria-label={t("三维下一步")}
                            onClick={step}
                            disabled={!!transition}
                          >
                            <SkipForward size={13} />
                          </button>
                          <select
                            aria-label={t("三维播放速度")}
                            value={speed}
                            onChange={(e) => setSpeed(Number(e.target.value))}
                          >
                            <option value={0.5}>0.5×</option>
                            <option value={1}>1×</option>
                            <option value={2}>2×</option>
                            <option value={4}>4×</option>
                          </select>
                        </div>
                        <input
                          type="range"
                          aria-label={t("三维阶段进度")}
                          min={0}
                          max={10}
                          value={Math.max(phase, 0)}
                          disabled={!trace}
                          onChange={(e) => seek(Number(e.target.value))}
                        />
                        {transition && (
                          <p className="transition-note" role="status">
                            {t("步骤衔接")} · {t(PHASES[transition.from])} →{" "}
                            {t(PHASES[transition.to])}
                          </p>
                        )}
                        <small className="connection-legend">
                          {t("虚线：部件间教学示意连接")}
                        </small>
                        {trace && phase >= 1 && phase <= 9 && (
                          <p className="scene-wire-label">
                            {stageLabel(
                              trace.stages[phase - 1].id,
                              language,
                              trace.stages[phase - 1].rotorId,
                              config.reflector,
                            )}
                            <strong>
                              {trace.stages[phase - 1].rotorId && (
                                <span className="external-label">
                                  {t("外部")}
                                </span>
                              )}
                              {letter(trace.stages[phase - 1].input)} →{" "}
                              {letter(trace.stages[phase - 1].output)}
                            </strong>
                          </p>
                        )}
                        {trace && phase >= 1 && phase <= 9 && (
                          <RotorReadout
                            stage={trace.stages[phase - 1]}
                            language={language}
                          />
                        )}
                      </div>
                    )}
                    <div className="archive-foot">
                      <ShieldCheck size={17} />
                      <span>
                        {t("真实置换 · 可复核路径")}
                        <small>VERIFIABLE BY DESIGN</small>
                      </span>
                    </div>
                  </>
                )}
              </aside>
            </div>
            <div
              id="pane-settings"
              role="tabpanel"
              aria-labelledby="pane-tab-settings"
              hidden={pane !== "settings"}
            >
              <aside className="configuration">
                <div className="panel-label">
                  {t("机器设置")} <Settings2 size={14} />
                </div>
                <div className="config-title">
                  {t("密钥配置")}
                  <small>KEY CONFIGURATION</small>
                </div>
                <p className="live-preview-hint">
                  {t("调整即预览：型号、窗口、环与反射器会同步到模型。")}
                </p>
                <div className="rotor-labels">
                  <span>{t("左 · SLOW")}</span>
                  <span>{t("中 · MIDDLE")}</span>
                  <span>{t("右 · FAST")}</span>
                </div>
                <div className="live-windows">
                  {modelConfig.positions.map((n, i) => (
                    <div
                      key={i}
                      className={
                        trace?.stepped[i] && phase === 0 ? "stepping" : ""
                      }
                    >
                      <span>{modelConfig.rotors[i]}</span>
                      <strong>{letter(n)}</strong>
                      <small>{String(n + 1).padStart(2, "0")}</small>
                    </div>
                  ))}
                </div>
                <div className="setting">
                  <label>
                    {t("转子排列")} <span>WALZENLAGE</span>
                  </label>
                  <div className="triple">
                    {draft.rotors.map((r, i) => (
                      <select
                        key={i}
                        aria-label={t(`${["左", "中", "右"][i]}转子型号`)}
                        value={r}
                        onChange={(e) =>
                          rotorField("rotors", i, e.target.value)
                        }
                      >
                        {(["I", "II", "III", "IV", "V"] as RotorId[]).map(
                          (v) => (
                            <option key={v}>{v}</option>
                          ),
                        )}
                      </select>
                    ))}
                  </div>
                </div>
                <div className="setting">
                  <label>
                    {t("初始窗口")} <span>GRUNDSTELLUNG</span>
                  </label>
                  <div className="triple">
                    {draft.positions.map((n, i) => (
                      <select
                        key={i}
                        aria-label={t(`${["左", "中", "右"][i]}转子初始窗口`)}
                        value={n}
                        onChange={(e) =>
                          rotorField("positions", i, e.target.value)
                        }
                      >
                        {ALPHABET.split("").map((v, n) => (
                          <option key={v} value={n}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
                <div className="setting">
                  <label>
                    {t("环设置")} <span>RINGSTELLUNG</span>
                  </label>
                  <div className="triple">
                    {draft.rings.map((n, i) => (
                      <select
                        key={i}
                        aria-label={t(`${["左", "中", "右"][i]}转子环设置`)}
                        value={n}
                        onChange={(e) => rotorField("rings", i, e.target.value)}
                      >
                        {ALPHABET.split("").map((v, n) => (
                          <option key={v} value={n}>
                            {String(n + 1).padStart(2, "0")} · {v}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
                <div className="setting reflector-setting">
                  <label>
                    {t("反射器")} <span>UKW</span>
                  </label>
                  <select
                    aria-label={t("反射器型号")}
                    value={draft.reflector}
                    onChange={(e) => {
                      setDraft((c) => ({
                        ...c,
                        reflector: e.target.value as ReflectorId,
                      }));
                      beginPreview({ field: "reflector" });
                    }}
                  >
                    <option value="B">UKW — B</option>
                    <option value="C">UKW — C</option>
                  </select>
                </div>
                <div className="setting">
                  <label>
                    {t("插线配对")} <span>STECKER</span>
                  </label>
                  <input
                    aria-label={t("插线配对")}
                    placeholder={t("例如 AB CD EF")}
                    value={draft.plugboard}
                    onChange={(e) =>
                      setDraft((c) => ({
                        ...c,
                        plugboard: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                  <small>{t("空格分隔 · 常规作战配置最多 10 对")}</small>
                  <small className="applied-plugs" role="status">
                    {t("当前连接")}: {config.plugboard || t("无插线")}
                    {normalizePlugs(draft.plugboard) !== config.plugboard
                      ? ` · ${t("待应用")}`
                      : ""}
                  </small>
                </div>
                <button className="apply-button" onClick={() => apply(draft)}>
                  {t("应用设置并复位")} <ArrowRight size={15} />
                </button>
                {isPreview && (
                  <div className="preview-explanation" role="status">
                    <b>{t("设置实时预览")}</b>
                    <p>
                      {t(
                        previewFocus.field === "rings"
                          ? "窗口保持不变，线芯相对字母环转动；紫色标记标出线芯 A。"
                          : previewFocus.field === "positions"
                            ? "字母环与线芯一起转动，窗口位置随之改变。"
                            : previewFocus.field === "rotors"
                              ? "型号改变会替换内部接线与缺口；已安装的型号会交换位置。"
                              : "反射器配对与内部接线已随型号更新。",
                      )}
                    </p>
                    <small>
                      {t(
                        "模型显示草稿设置；已有记录保留，应用后才用于新的加密。",
                      )}
                    </small>
                    <button onClick={discardPreview}>{t("取消预览")}</button>
                  </div>
                )}
                <p className="config-note">
                  {t("应用后停止当前回放、恢复初始窗口并清空记录。")}
                </p>
                {error && (
                  <p className="plug-error" role="alert">
                    {t(error)}
                  </p>
                )}
              </aside>
            </div>
            <div
              id="pane-operate"
              role="tabpanel"
              aria-labelledby="pane-tab-operate"
              hidden={pane !== "operate"}
            >
              <section
                className="mechanical-display"
                aria-labelledby="mechanical-display-title"
              >
                <h3 id="mechanical-display-title">
                  <Box size={14} aria-hidden="true" />
                  {language === "en" ? "Mechanical display" : "机械展示"}
                </h3>
                <div className="mechanical-display-actions">
                  <button
                    type="button"
                    aria-pressed={rotorCoverRemoved}
                    aria-describedby="rotor-cover-hint"
                    onClick={() => {
                      setRotorCoverRemoved((removed) => !removed);
                      setView("model");
                      setDetail(null);
                      setSelected("machine");
                      setInspection(false);
                      setExploded(false);
                      setFollowSignal(false);
                    }}
                  >
                    {rotorCoverRemoved ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Layers3 size={13} aria-hidden="true" />
                    )}
                    <span>
                      {language === "en"
                        ? rotorCoverRemoved
                          ? "Replace rotor cover"
                          : "Remove rotor cover"
                        : rotorCoverRemoved
                          ? "装回转子护罩"
                          : "移开转子护罩"}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={lampCoverRemoved}
                    aria-describedby="lamp-cover-hint"
                    onClick={() => {
                      setLampCoverRemoved((removed) => !removed);
                      setView("model");
                      setDetail(null);
                    }}
                  >
                    {lampCoverRemoved ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Layers3 size={13} aria-hidden="true" />
                    )}
                    <span>
                      {language === "en"
                        ? lampCoverRemoved
                          ? "Replace lamp cover"
                          : "Remove lamp cover"
                        : lampCoverRemoved
                          ? "装回灯板盖板"
                          : "移开灯板盖板"}
                    </span>
                  </button>
                  <p id="rotor-cover-hint">
                    {language === "en"
                      ? "Reveal the solid rotor assembly."
                      : "露出实体转子与机械结构。"}
                  </p>
                  <p id="lamp-cover-hint">
                    {language === "en"
                      ? "Reveal the bulbs, sockets and wiring."
                      : "露出灯泡、灯座和接线。"}
                  </p>
                </div>
                <small>
                  {language === "en"
                    ? "Cover controls show the solid machine. You can re-enable Follow current or Internal wiring at any time. Wire routing is illustrative."
                    : "护罩开关切回实体整机；可随时开启跟随电流或内部接线。布线路径为教学示意。"}
                </small>
              </section>
              <section className="signal-strip">
                <div className="signal-heading">
                  <AudioLines size={16} />
                  <div>
                    {t("信号追踪")}
                    <small>SIGNAL TRACE</small>
                  </div>
                </div>
                <div className="signal-sequence">
                  <span className={phase >= 0 ? "passed" : ""}>
                    {t("按键")} <b>{trace?.input ?? "—"}</b>
                  </span>
                  <ChevronRight />
                  <span className={phase >= 0 ? "passed" : ""}>
                    {t("步进")}
                  </span>
                  <ChevronRight />
                  <span className={phase >= 1 ? "passed" : ""}>
                    {t("插线板")}
                  </span>
                  <ChevronRight />
                  <span className={phase >= 2 ? "passed" : ""}>
                    {[...config.rotors].reverse().join(" → ")}
                  </span>
                  <ChevronRight />
                  <span className={phase >= 5 ? "passed" : ""}>UKW</span>
                  <ChevronRight />
                  <span className={phase >= 6 ? "returned" : ""}>
                    {config.rotors.join(" → ")}
                  </span>
                  <ChevronRight />
                  <span className={phase >= 9 ? "returned" : ""}>
                    {t("插线板")}
                  </span>
                  <ChevronRight />
                  <span className={phase >= 10 ? "returned" : ""}>
                    {t("灯板")} <b>{phase >= 10 ? trace?.output : "—"}</b>
                  </span>
                </div>
                <button
                  onClick={() => {
                    setView("circuit");
                  }}
                >
                  {t("展开电路")} <ArrowDownRight size={15} />
                </button>
              </section>
              <section className="workbench" inert={isPreview}>
                <div className="input-console">
                  <div className="section-heading">
                    <div className="tabs">
                      <button
                        className={tab === "operate" ? "active" : ""}
                        onClick={() => setTab("operate")}
                      >
                        <Keyboard size={15} />
                        {t("操作台")}
                      </button>
                      <button
                        className={tab === "records" ? "active" : ""}
                        onClick={() => setTab("records")}
                      >
                        {t("实验记录")}{" "}
                        <span>
                          {records.length.toString().padStart(2, "0")}
                        </span>
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => apply(initialConfig)}
                    >
                      <RotateCcw size={12} />
                      {t("复位至初始设置")}
                    </button>
                  </div>
                  {tab === "operate" ? (
                    <>
                      <div className="keyboard">
                        {["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"].map((row) => (
                          <div className="key-row" key={row}>
                            {row.split("").map((k) => (
                              <button
                                aria-label={`${t("按键")} ${k}`}
                                disabled={inputsLocked}
                                key={k}
                                className={`${trace?.input === k && busy ? "pressed " : ""}${trace?.output === k && phase === 10 ? "lit" : ""}`}
                                onClick={() => send(k)}
                              >
                                {k}
                                {trace?.output === k && phase === 10 && <i />}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="keyboard-caption">
                        <span>
                          <i className="dot teal" />
                          {t("灯板输出")}
                        </span>
                        <span>
                          {t(
                            busy
                              ? "正在追踪 · 可暂停或逐步前进"
                              : "点击按键或使用键盘 A–Z",
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="record-list">
                      {records.length === 0 ? (
                        <div className="empty-record">
                          {t("第一封密文，从一次击键开始。")}
                          <small>
                            {t("输入字母后，这里会保留每次步进和字母置换。")}
                          </small>
                        </div>
                      ) : (
                        <>
                          <div className="record-head">
                            <span>{t("序号")}</span>
                            <span>{t("输入 → 输出")}</span>
                            <span>{t("窗口变化")}</span>
                            <span>{t("步进")}</span>
                          </div>
                          {records.map((r, i) => (
                            <div className="record-row" key={i}>
                              <span>{String(i + 1).padStart(3, "0")}</span>
                              <b>
                                {r.input} <ArrowRight size={11} /> {r.output}
                              </b>
                              <span>
                                {r.before.map(letter).join("")} →{" "}
                                {r.after.map(letter).join("")}
                              </span>
                              <span>
                                {t(
                                  r.doubleStep
                                    ? "中轮双步进"
                                    : r.stepped[1]
                                      ? "缺口进位"
                                      : "右轮步进",
                                )}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="playback-console">
                  <div className="section-heading">
                    <span>
                      {t("过程回放")} <small>PROCESS PLAYBACK</small>
                    </span>
                    <div className="playback-speed">
                      <select
                        aria-label={t("动画速度")}
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                      >
                        <option value={0.5}>0.5×</option>
                        <option value={1}>1×</option>
                        <option value={2}>2×</option>
                        <option value={4}>4×</option>
                      </select>
                    </div>
                  </div>
                  <div className="playback-status">
                    <div>
                      <span className="eyebrow">
                        {trace
                          ? `STEP ${String(Math.max(0, phase) + 1).padStart(2, "0")} / 11`
                          : "READY TO TRANSMIT"}
                      </span>
                      <h3>
                        {t(
                          trace ? PHASES[Math.max(0, phase)] : "等待第一次击键",
                        )}
                      </h3>
                      <p>
                        {!trace
                          ? t("试试按下 A，观察每一段电流路径。")
                          : phase === 0
                            ? `${trace.before.map(letter).join(" ")} → ${trace.after.map(letter).join(" ")} · ${t(trace.doubleStep ? "中间转子触发双步进" : "转子先步进，随后电路闭合")}`
                            : phase === 10
                              ? `${t("完整电路闭合")}: ${trace.input} → ${trace.output}`
                              : `${stageLabel(trace.stages[phase - 1].id, language, trace.stages[phase - 1].rotorId, config.reflector)}: ${letter(trace.stages[phase - 1].input)} → ${letter(trace.stages[phase - 1].output)}`}
                      </p>
                    </div>
                    <div className="signal-output">
                      <span>{trace?.input ?? "A"}</span>
                      <ArrowRight size={17} />
                      <strong>{phase >= 10 ? trace?.output : "?"}</strong>
                    </div>
                  </div>
                  <div className="scrubber">
                    <input
                      type="range"
                      aria-label={t("过程进度")}
                      min={0}
                      max={10}
                      value={Math.max(0, phase)}
                      disabled={!trace}
                      onChange={(e) => seek(Number(e.target.value))}
                    />
                    <div>
                      <span>{t("步进")}</span>
                      <span>{t("反射")}</span>
                      <span>{t("点灯")}</span>
                    </div>
                  </div>
                  <div className="playback-actions">
                    <button className="primary" onClick={togglePlayback}>
                      {playing ? <Pause size={13} /> : <Play size={13} />}{" "}
                      {t(
                        !trace
                          ? "按下 A 体验"
                          : playing
                            ? "暂停"
                            : phase === 10
                              ? "再次回放"
                              : "继续播放",
                      )}
                    </button>
                    <button onClick={step} disabled={!!transition}>
                      <SkipForward size={14} />
                      {t("单步")}
                    </button>
                    <span>{t("回放与拖动进度不会再次推进机器")}</span>
                  </div>
                </div>
              </section>
            </div>
            <div
              id="pane-message"
              role="tabpanel"
              aria-labelledby="pane-tab-message"
              hidden={pane !== "message"}
            >
              <section className="message-console" inert={isPreview}>
                <div className="message-title">
                  <FlaskConical size={17} />
                  <span>
                    {t("电文实验")}
                    <small>MESSAGE LAB</small>
                  </span>
                </div>
                <div className="message-input">
                  <label htmlFor="message">
                    {t("连续输入")} <small>{t("A–Z / 忽略空格")}</small>
                  </label>
                  <div>
                    <input
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value.toUpperCase())}
                      placeholder="HELLOWORLD"
                      maxLength={700}
                    />
                    <button disabled={inputsLocked} onClick={batch}>
                      {t("加密")} <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
                <div className="message-output">
                  <div>
                    <label>
                      {t("输出记录")} <small>{records.length} LETTERS</small>
                    </label>
                    <button
                      aria-label={t("复制密文")}
                      disabled={!cipher}
                      onClick={copy}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <p data-testid="ciphertext">
                    {cipher ? group(cipher) : "— — — — —"}
                  </p>
                  <small className="plain-record">
                    {plain
                      ? `${t("输入")}: ${group(plain)}`
                      : t(
                          "初始 I–II–III / AAA / 01–01–01 / UKW B 时，HELLOWORLD → ILBDAAMTAZ",
                        )}
                  </small>
                </div>
              </section>
            </div>
          </div>
        </aside>
        <nav
          ref={collapsedRailRef}
          className="pane-rail"
          aria-label={
            language === "en" ? "Collapsed control pane" : "收起的控制窗格"
          }
          aria-hidden={!paneCollapsed}
          inert={!paneCollapsed}
        >
          <button
            ref={paneExpandRef}
            type="button"
            className="rail-expand"
            aria-label={
              language === "en" ? "Expand control pane" : "展开控制窗格"
            }
            title={language === "en" ? "Expand controls" : "展开控制窗格"}
            onClick={() => setCollapseReason(null)}
          >
            <ArrowLeft size={15} />
          </button>
          {(
            [
              ["inspect", "检视", "Inspect", Box],
              ["settings", "设置", "Settings", Settings2],
              ["operate", "操作", "Operate", Keyboard],
              ["message", "电文", "Message", FlaskConical],
            ] as const
          ).map(([id, zh, en, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={pane === id}
              onClick={() => {
                setPane(id);
                setCollapseReason(null);
                if (id === "settings") setDetail(null);
              }}
            >
              <Icon size={14} />
              <span>{language === "en" ? en : zh}</span>
            </button>
          ))}
        </nav>
      </main>
      {error && (
        <div role="alert" className="error-toast">
          <span>{t(error)}</span>
          <button aria-label={t("关闭提示")} onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <footer>
        <span>
          <i className="dot" /> ENIGMA LAB <b>/</b> {t("交互研究原型 0.1")}
        </span>
        <span>{t("机械的秩序，秘密的起点。")}</span>
        <button onClick={() => openModal("about")}>
          {t("模型说明与验证依据")} <ChevronRight size={12} />
        </button>
      </footer>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t(modal === "help" ? "工作原理" : "项目说明")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label={t("关闭说明")}
              onClick={() => setModal(null)}
              autoFocus
            >
              <X size={18} />
            </button>
            <div className="eyebrow">ENIGMA LAB / FIELD NOTES</div>
            <h2>
              {t(
                modal === "help"
                  ? "一次击键，十一段旅程。"
                  : "从机械档案，到可验证的实验。",
              )}
            </h2>
            {modal === "help" ? (
              <>
                <p>
                  {t(
                    "打开顶部“机器设置”，选定转子、初始窗口、环设置和插线配对，再点击“应用设置并复位”。使用屏幕按键或键盘 A–Z；开启“内部接线”观察三维导线。",
                  )}
                </p>
                <ol>
                  <li>
                    <b>{t("机械先行：")}</b>
                    {t(
                      "右转子每次前进一步；缺口决定中间转子与左转子的进位。中间转子可能在连续两次击键中步进，这就是“双步进”。",
                    )}
                  </li>
                  <li>
                    <b>{t("正向通电：")}</b>
                    {t("按键 → 插线板 → 输入轮 ETW → 右、中、左转子。")}
                  </li>
                  <li>
                    <b>{t("折返回路：")}</b>
                    {t(
                      "反射器 → 左、中、右转子的逆向走线 → ETW → 插线板 → 输出灯。",
                    )}
                  </li>
                </ol>
                <p>
                  <b>{t("环设置 ≠ 窗口位置。")}</b>
                  {t(
                    "环设置改变线芯相对字母环的偏移；Enigma I 的缺口固定在字母环上，因此窗口进位字母不随环设置改变。",
                  )}
                </p>
                <div className="note-box">
                  <b>{t("双步进实验")}</b>
                  <p>
                    {t(
                      "初始 I–II–III、窗口 A–D–U，连续按三次任意字母，窗口依次变成 A–D–V、A–E–W、B–F–X。",
                    )}
                  </p>
                  <button
                    onClick={() => {
                      apply({
                        ...clone(DEFAULT_CONFIG),
                        positions: [0, 3, 20],
                      });
                      setModal(null);
                    }}
                  >
                    {t("载入双步进示例")} <ArrowRight size={13} />
                  </button>
                </div>
                <p>
                  {t(
                    "解密时，先恢复到加密前相同的初始设置，再输入密文。连续输入会从机器当前窗口继续运行。",
                  )}
                </p>
              </>
            ) : (
              <>
                <p>
                  {t(
                    "以米黄色旧纸、木箱与黄铜呈现历史密码机。参考 OHM TAPE 的器物陈列与档案界面，模型用于教学检视，电气连接遵循 Enigma I。",
                  )}
                </p>
                <p>
                  <b>{t("这版支持：")}</b>
                  {t(
                    "Enigma I，五选三转子（I–V），反射器 B / C，26 档环设置，常规 10 对插线，双步进，26 触点完整电路和逐步回放。",
                  )}
                </p>
                <p>
                  <b>{t("精度边界：")}</b>
                  {t(
                    "三维高亮逐段对应真实接线：插线板配对、转子线芯触点、反射器回路与返回路径。导线的空间弯曲形状及棘爪等机械细节为教学示意，不代表实物测绘。",
                  )}
                </p>
                <p>
                  <b>{t("验证：")}</b>
                  {t(
                    "公开标准向量 AAAAA → BDZGO、HELLOWORLD → ILBDAAMTAZ；另测双步进、非默认环设置、插线板和加解密互逆。",
                  )}
                </p>
                <div className="source-links">
                  <a
                    href="https://www.cryptomuseum.com/crypto/enigma/working.htm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Crypto Museum · 工作原理 ↗")}
                  </a>
                  <a
                    href="https://github.com/LBEILC/RhineLabUI"
                    target="_blank"
                    rel="noreferrer"
                  >
                    RhineLabUI · MIT ↗
                  </a>
                  <a
                    href="https://github.com/zcy83821448/cassette"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Cassette · 视觉参考 ↗")}
                  </a>
                </div>
                <p className="muted">
                  {t("全部加密与检视在本地浏览器完成，无账号、无后端。")}
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
export default App;
