import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LangContext, makeT, storeLang, storedLang, type Lang } from "./i18n";
import { Stage, StageCanvas } from "./engine/Stage";
import { loadLetterFonts } from "./engine/textures";
import type { Theme } from "./engine/materials";
import { BrandMark, IconClose, IconInfo, IconMoon, IconSun } from "./ui/icons";
import EnigmaWorkbench from "./machines/enigma/EnigmaWorkbench";

const BombeWorkbench = lazy(() => import("./machines/bombe/BombeWorkbench"));

export interface Crumb {
  label: string;
  onClick?: () => void;
  current?: boolean;
}
type Machine = "enigma" | "bombe";

const THEME_KEY = "enigma-lab.theme";
/** Saved choice, else the page's own data-theme, else the system setting. */
function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const ctx = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    // Release the probe context right away; a second live context slows the GPU process.
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!ctx;
  } catch {
    return false;
  }
}

const machineFromHash = (): Machine => (location.hash.replace("#", "") === "bombe" ? "bombe" : "enigma");

export default function App() {
  const [lang, setLangState] = useState<Lang>(storedLang);
  const [theme, setTheme] = useState<Theme>(storedTheme);
  /** Only the in-app toggle is remembered; outside changes are followed but not saved. */
  const chooseTheme = (next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  };
  const [machine, setMachine] = useState<Machine>(machineFromHash);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [ready, setReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [about, setAbout] = useState(false);
  const gl = useMemo(webglAvailable, []);
  const stage = useMemo(() => (gl ? new Stage() : null), [gl]);
  useEffect(() => {
    // Debug hook for automated checks: /?debug exposes the stage.
    if (stage && new URLSearchParams(location.search).has("debug")) (window as unknown as { __lab: unknown }).__lab = { stage };
  }, [stage]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storeLang(l);
  }, []);
  const langValue = useMemo(() => ({ lang, setLang, t: makeT(lang) }), [lang, setLang]);
  const zh = lang === "zh";
  const markCanvasReady = useCallback(() => setCanvasReady(true), []);

  useEffect(() => {
    loadLetterFonts().then(() => setReady(true));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = zh ? "zh-CN" : "en";
    stage?.setTheme(theme);
  }, [theme, stage, zh]);
  useEffect(() => {
    // Follow a host page that sets data-theme, or the system setting when nothing was chosen here.
    const root = document.documentElement;
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    const system = (): Theme => (media?.matches ? "dark" : "light");
    const observer = new MutationObserver(() => {
      const v = root.dataset.theme;
      if (v === "light" || v === "dark") setTheme(v);
      else {
        const next = system();
        root.dataset.theme = next;
        setTheme(next);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    const onSystem = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch {
        /* ignore */
      }
      if (!saved) setTheme(system());
    };
    media?.addEventListener?.("change", onSystem);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", onSystem);
    };
  }, []);
  useEffect(() => {
    const onHash = () => setMachine(machineFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const switchMachine = (m: Machine) => {
    if (m === machine) return;
    try {
      history.replaceState(null, "", m === "bombe" ? "#bombe" : location.pathname + location.search);
    } catch {
      /* some embedded frames refuse history changes; the view still switches */
    }
    setCrumbs([]);
    setMachine(m);
  };
  useEffect(() => {
    if (!about) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbout(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [about]);

  return (
    <LangContext.Provider value={langValue}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <BrandMark />
            <span>Enigma Lab</span>
            <small>{zh ? "拆解检视台" : "teardown bench"}</small>
          </div>
          <div className="segmented" role="group" aria-label={zh ? "选择机器" : "Choose machine"}>
            <button type="button" aria-pressed={machine === "enigma"} onClick={() => switchMachine("enigma")}>
              Enigma I
            </button>
            <button type="button" aria-pressed={machine === "bombe"} onClick={() => switchMachine("bombe")}>
              Bombe
            </button>
          </div>
          <nav className="crumbs" aria-label={zh ? "当前位置" : "Location"}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="sep">/</span>}
                <button type="button" onClick={c.onClick} aria-current={c.current ? "page" : undefined}>
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
          <span className="spacer" />
          <div className="segmented small" role="group" aria-label={zh ? "语言" : "Language"}>
            <button type="button" aria-pressed={zh} onClick={() => setLang("zh")}>
              中文
            </button>
            <button type="button" aria-pressed={!zh} onClick={() => setLang("en")}>
              EN
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => chooseTheme(theme === "light" ? "dark" : "light")}
            aria-label={zh ? "切换明暗" : "Toggle light and dark"}
            title={zh ? "切换明暗" : "Toggle light and dark"}
          >
            {theme === "light" ? <IconMoon /> : <IconSun />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setAbout(true)}
            aria-label={zh ? "关于与资料" : "About and sources"}
            title={zh ? "关于与资料" : "About and sources"}
          >
            <IconInfo />
          </button>
        </header>
        {!stage ? (
          <div className="fallback">
            {zh
              ? "这个浏览器无法启用 WebGL，三维检视不可用。请换用支持 WebGL 的浏览器。"
              : "WebGL is not available in this browser, so the 3D bench cannot start. Try a browser with WebGL enabled."}
          </div>
        ) : !ready || !canvasReady ? (
          <div className="fallback">{zh ? "正在准备工作台…" : "Preparing the bench…"}</div>
        ) : machine === "enigma" ? (
          <EnigmaWorkbench key="enigma" stage={stage} onCrumbs={setCrumbs} />
        ) : (
          <Suspense fallback={<div className="fallback">{zh ? "正在载入 Bombe…" : "Loading the Bombe…"}</div>}>
            <BombeWorkbench key="bombe" stage={stage} onCrumbs={setCrumbs} />
          </Suspense>
        )}
      </div>
      {stage && createPortal(<StageCanvas stage={stage} onReady={markCanvasReady} />, stage.element)}
      {about && (
        <div className="modal-backdrop" onClick={() => setAbout(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={zh ? "关于" : "About"}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <h2>{zh ? "关于 Enigma Lab" : "About Enigma Lab"}</h2>
              <button className="icon-button" onClick={() => setAbout(false)} aria-label={zh ? "关闭" : "Close"} autoFocus>
                <IconClose />
              </button>
            </div>
            <p className="prose">
              {zh
                ? "两台机器的程序化三维教学模型：恩尼格玛 I 型可以逐步拆开、逐件检视并实际加密；Bombe 部分用一份截获电文，从猜词、菜单、电路矛盾一直走到恢复密钥。所有字母、导线和停机都来自同一个经过测试的密码内核。"
                : "Procedural 3D teaching models of two machines: the Enigma I comes apart step by step and really enciphers; the Bombe section takes one intercepted message from crib to menu, contradiction, stops and the recovered key. Every letter, wire and stop comes from the same tested cipher core."}
            </p>
            <h3>{zh ? "准确性" : "Accuracy"}</h3>
            <ul>
              <li>
                {zh
                  ? "加密内核与 Py-Enigma 1.0.2 的 120 组参考向量逐字一致；Bombe 推理有独立测试（真实位置必停、对角板效果、恢复全文）。"
                  : "The cipher core matches 120 Py-Enigma 1.0.2 reference vectors letter for letter; the Bombe logic has its own tests (true position always stops, diagonal-board effect, full plaintext recovered)."}
              </li>
              <li>
                {zh
                  ? "几何是依据照片与文字资料的教学建模，不是测绘；导线走向、内部机构位置是示意，电气端点准确。"
                  : "Geometry is a teaching model drawn from photographs and descriptions, not a survey; wire routing and internal layout are schematic, electrical endpoints are exact."}
              </li>
            </ul>
            <h3>{zh ? "资料" : "Sources"}</h3>
            <ul>
              <li>
                <a href="https://www.cryptomuseum.com/crypto/enigma/i/index.htm" target="_blank" rel="noreferrer">
                  Crypto Museum — Enigma I
                </a>
              </li>
              <li>
                <a href="https://en.wikipedia.org/wiki/Bombe" target="_blank" rel="noreferrer">
                  Wikipedia — Bombe
                </a>
              </li>
              <li>
                <a href="https://www.tnmoc.org/bh-10-bombe-description" target="_blank" rel="noreferrer">
                  TNMOC — Bombe description
                </a>
              </li>
              <li>
                <a href="https://codesandciphers.org.uk/virtualbp/tbombe/thebmb.htm" target="_blank" rel="noreferrer">
                  Codes and Ciphers — The Turing/Welchman Bombe
                </a>
              </li>
              <li>
                <a href="https://bombe.org.uk/" target="_blank" rel="noreferrer">
                  John Harper — Bombe rebuild project
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}
    </LangContext.Provider>
  );
}
