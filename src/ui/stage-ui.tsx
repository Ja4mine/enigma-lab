import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import type { Stage } from "../engine/Stage";
import type { Exhibit, FeatureMeta, Step } from "../engine/Exhibit";
import { useLang, type Text } from "../i18n";
import { IconNext, IconPause, IconPlay, IconPrev, IconReset } from "./icons";
import { MousePointer2, Move, ZoomIn } from "lucide-react";

/** Hosts the shared WebGL canvas plus any overlays rendered as children. */
export function StageView({
  stage,
  sheet = false,
  inspectionHint = true,
  children,
}: {
  stage: Stage;
  sheet?: boolean;
  inspectionHint?: boolean;
  children?: ReactNode;
}) {
  const { lang } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) stage.mount(ref.current);
  }, [stage]);
  return (
    <section
      ref={ref}
      className={sheet ? "stage is-sheet" : "stage"}
      aria-label={
        lang === "zh"
          ? "三维组件检视工作台"
          : "Three-dimensional component inspection bench"
      }
    >
      {children}
      {!sheet && inspectionHint && (
        <div
          className="bench-hints"
          aria-label={lang === "zh" ? "检视操作提示" : "Inspection controls"}
        >
          <span>
            <Move size={12} aria-hidden="true" />
            {lang === "zh" ? "拖动旋转" : "Drag to orbit"}
          </span>
          <span>
            <ZoomIn size={12} aria-hidden="true" />
            {lang === "zh" ? "滚轮缩放" : "Scroll to zoom"}
          </span>
          <span className="bench-hint-primary">
            <MousePointer2 size={12} aria-hidden="true" />
            {lang === "zh" ? "点击检视组件" : "Click to inspect"}
          </span>
          <span className="bench-hint-key">
            <kbd>esc</kbd>
            {lang === "zh" ? "返回上一级" : "Back one level"}
          </span>
        </div>
      )}
    </section>
  );
}

/** Name of the part under the pointer, so it is clear what a click will open. */
export function HoverTag({
  stage,
  exhibit,
  resolve,
}: {
  stage: Stage;
  exhibit: Exhibit;
  resolve: (id: string) => string;
}) {
  const { t, lang } = useLang();
  const el = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [record, setRecord] = useState({ name: "", number: "" });
  const place = () => {
    const tag = el.current;
    if (!tag) return;
    const { x, y } = pointer.current;
    // Keep the label inside the canvas even when a component sits near an edge.
    const left = Math.max(
      10,
      Math.min(x + 18, stage.width - tag.offsetWidth - 10),
    );
    const top = Math.max(
      10,
      Math.min(y + 20, stage.height - tag.offsetHeight - 10),
    );
    tag.style.transform = `translate(${left}px, ${top}px)`;
  };
  useLayoutEffect(place, [record, stage, lang]);
  useEffect(
    () =>
      stage.onPointerHover((part, x, y) => {
        const meta = part ? exhibit.meta(resolve(part)) : null;
        const name = meta ? t(meta.name) : "";
        const number = meta?.number ?? "";
        setRecord((previous) =>
          previous.name === name && previous.number === number
            ? previous
            : { name, number },
        );
        pointer.current = { x, y };
        place();
      }),
    [stage, exhibit, resolve, t],
  );
  return (
    <div
      ref={el}
      className="hover-tag"
      hidden={!record.name}
      aria-hidden="true"
    >
      <span className="hover-tag-number">{record.number}</span>
      <strong>{record.name}</strong>
      <span className="hover-tag-action">
        {lang === "zh" ? "点击检视" : "Click to inspect"}
        <IconNext size={12} />
      </span>
    </div>
  );
}

export function StageCaption({
  kicker,
  title,
  text,
}: {
  kicker?: ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <div className="stage-caption" aria-live="polite">
      {kicker && <div className="kicker">{kicker}</div>}
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Callouts                                                            */
/* ------------------------------------------------------------------ */

interface CalloutItem {
  id: string;
  n: number;
  label: Text;
  anchor: THREE.Object3D;
}

/**
 * Numbered balloons arranged in two columns beside the model, each tied to its
 * feature by a leader line. Positions are recomputed after every render of the
 * stage, without React re-rendering.
 */
export function Callouts({
  stage,
  exhibit,
  partId,
  hot,
  onHot,
  visible = true,
  extra = [],
}: {
  stage: Stage;
  exhibit: Exhibit;
  partId: string | null;
  hot: string | null;
  onHot: (id: string | null) => void;
  visible?: boolean;
  extra?: { feature: FeatureMeta; anchor: THREE.Object3D }[];
}) {
  const { t, lang } = useLang();
  const items: CalloutItem[] = [
    ...(partId ? exhibit.featureAnchors(partId) : []),
    ...extra,
  ]
    .map(({ feature, anchor }, i) => ({
      id: feature.id,
      n: i + 1,
      label: feature.label,
      anchor,
    }))
    // A requested detail remains discoverable when the overall labels are off.
    .filter((item) => visible || item.id === hot);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const svg = useRef<SVGSVGElement>(null);
  const key = items.map((i) => i.id).join("|") + lang + partId;

  useEffect(() => {
    if (!items.length) {
      if (svg.current) svg.current.innerHTML = "";
      return;
    }
    const v = new THREE.Vector3();
    const place = () => {
      const W = stage.width - stage.coveredRight,
        H = stage.height;
      const top = W < 700 ? 64 : 112,
        bottom = H - (W < 700 ? 64 : 84);
      const pts = items.map((item) => {
        item.anchor.getWorldPosition(v);
        const p = stage.project(v);
        return { item, ...p };
      });
      const shown = pts.filter(
        (p) =>
          p.visible && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20,
      );
      if (!shown.length) {
        if (svg.current) svg.current.innerHTML = "";
        for (const el of labels.current.values()) {
          el.style.opacity = "0";
          el.style.visibility = "hidden";
          el.tabIndex = -1;
        }
        return;
      }
      const cx = shown.reduce((s, p) => s + p.x, 0) / shown.length;
      const minX = Math.min(...shown.map((p) => p.x)),
        maxX = Math.max(...shown.map((p) => p.x));
      const narrow = W < 560;
      const sides = { left: [] as typeof shown, right: [] as typeof shown };
      for (const p of shown)
        (p.x < cx || (narrow && sides.left.length < sides.right.length)
          ? sides.left
          : sides.right
        ).push(p);
      let paths = "";
      for (const side of ["left", "right"] as const) {
        const list = sides[side].sort((a, b) => a.y - b.y);
        const gap = 30;
        const ys = list.map((p) => Math.min(bottom, Math.max(top, p.y)));
        for (let i = 1; i < ys.length; i++)
          ys[i] = Math.max(ys[i], ys[i - 1] + gap);
        const over = ys.length ? ys[ys.length - 1] - bottom : 0;
        if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
        for (let i = ys.length - 2; i >= 0; i--)
          ys[i] = Math.min(ys[i], ys[i + 1] - gap);
        list.forEach((p, i) => {
          const el = labels.current.get(p.item.id);
          if (!el) return;
          const w = el.offsetWidth;
          const y = ys[i];
          let x: number, edge: number, elbow: number;
          if (side === "left") {
            x = Math.max(14, Math.min(minX - 70 - w, p.x - 60 - w));
            edge = x + w;
            elbow = Math.min(p.x - 12, edge + 18);
          } else {
            x = Math.min(W - 14 - w, Math.max(maxX + 70, p.x + 60));
            edge = x;
            elbow = Math.max(p.x + 12, edge - 18);
          }
          el.style.opacity = "1";
          el.style.visibility = "visible";
          el.tabIndex = 0;
          el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 12).toFixed(1)}px)`;
          paths += `<path class="leader" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${elbow.toFixed(1)} ${y.toFixed(1)} L${edge.toFixed(1)} ${y.toFixed(1)}"/>`;
          paths += `<circle class="dot-ring" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"/><circle class="dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.8"/>`;
        });
      }
      for (const p of pts)
        if (!shown.includes(p)) {
          const el = labels.current.get(p.item.id);
          if (el) {
            el.style.opacity = "0";
            el.style.visibility = "hidden";
            el.tabIndex = -1;
          }
        }
      if (svg.current) svg.current.innerHTML = paths;
    };
    place();
    const off = stage.onRender(place);
    stage.invalidate();
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, key, visible]);

  if (!items.length) return null;
  return (
    <div className="callouts">
      <svg ref={svg} aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`callout-label${hot === item.id ? " hot" : ""}`}
          style={{ opacity: 0, visibility: "hidden" }}
          tabIndex={-1}
          ref={(el) => {
            if (el) labels.current.set(item.id, el);
            else labels.current.delete(item.id);
          }}
          onPointerEnter={() => onHot(item.id)}
          onPointerLeave={(event) => {
            if (document.activeElement !== event.currentTarget) onHot(null);
          }}
          onFocus={() => onHot(item.id)}
          onBlur={() => onHot(null)}
          onClick={() => onHot(item.id)}
        >
          <span className="balloon">{item.n}</span>
          <span className="callout-text">{t(item.label)}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Procedure track                                                     */
/* ------------------------------------------------------------------ */

export function Track({
  steps,
  progress,
  onSeek,
  onScrub,
  label,
  playing,
  onPlay,
  firstLabel,
  numbering = 0,
}: {
  steps: { title: Text }[];
  /** Label of node 0 (default: "assembled"). */
  firstLabel?: string;
  /** Number shown on node 0 (walkthroughs start at 1). */
  numbering?: number;
  /** Continuous position, 0…steps.length. */
  progress: number;
  onSeek: (target: number) => void;
  onScrub?: (value: number, done: boolean) => void;
  label: string;
  playing?: boolean;
  onPlay?: () => void;
}) {
  const { t, lang } = useLang();
  const rail = useRef<HTMLDivElement>(null);
  const n = steps.length;
  const current = Math.round(progress);
  const [hover, setHover] = useState<number | null>(null);
  const valueAt = (clientX: number) => {
    const r = rail.current!.getBoundingClientRect();
    const usable = r.width - 18;
    return Math.max(0, Math.min(n, ((clientX - r.left - 9) / usable) * n));
  };
  const pct = (i: number) => `calc(9px + (100% - 18px) * ${i / n})`;
  return (
    <div className="track" role="group" aria-label={label}>
      <div className="buttons">
        <button
          type="button"
          className="icon-button"
          onClick={() => onSeek(0)}
          aria-label={lang === "zh" ? "回到整机" : "Back to assembled"}
          title={lang === "zh" ? "回到整机" : "Back to assembled"}
        >
          <IconReset />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => onSeek(Math.max(0, Math.ceil(progress - 0.01) - 1))}
          aria-label={lang === "zh" ? "上一步" : "Previous step"}
          title={lang === "zh" ? "上一步" : "Previous step"}
          disabled={progress <= 0}
        >
          <IconPrev />
        </button>
      </div>
      <div
        ref={rail}
        className="track-rail"
        onPointerDown={(e) => {
          if (!onScrub || (e.target as HTMLElement).closest("button")) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onScrub(valueAt(e.clientX), false);
        }}
        onPointerMove={(e) => {
          if (
            !onScrub ||
            !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)
          )
            return;
          onScrub(valueAt(e.clientX), false);
        }}
        onPointerUp={(e) => {
          if (
            !onScrub ||
            !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)
          )
            return;
          onScrub(valueAt(e.clientX), true);
        }}
      >
        <div className="line" />
        <div
          className="fill"
          style={{ width: `calc((100% - 18px) * ${progress / n})` }}
        />
        {Array.from({ length: n + 1 }, (_, i) => {
          const title =
            i === 0
              ? (firstLabel ?? (lang === "zh" ? "整机" : "Assembled"))
              : t(steps[i - 1].title);
          const near = i === current || i === hover;
          return (
            <button
              key={i}
              type="button"
              className={`node${i <= progress + 0.001 ? " done" : ""}${i === current ? " current" : ""}${near ? "" : " far"}`}
              style={{ left: pct(i) }}
              onClick={() => onSeek(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${i + numbering}. ${title}`}
              aria-current={i === current ? "step" : undefined}
            >
              {i + numbering}
              <span className="tip">{title}</span>
            </button>
          );
        })}
      </div>
      <div className="buttons">
        <span className="count">
          {String(current + numbering).padStart(2, "0")}/
          {String(n + numbering).padStart(2, "0")}
        </span>
        {onPlay && (
          <button
            type="button"
            className="icon-button"
            onClick={onPlay}
            aria-label={
              playing
                ? lang === "zh"
                  ? "暂停"
                  : "Pause"
                : lang === "zh"
                  ? "自动演示"
                  : "Play through"
            }
            title={
              playing
                ? lang === "zh"
                  ? "暂停"
                  : "Pause"
                : lang === "zh"
                  ? "自动演示"
                  : "Play through"
            }
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={() => onSeek(Math.min(n, Math.floor(progress + 0.01) + 1))}
          aria-label={lang === "zh" ? "下一步" : "Next step"}
          title={lang === "zh" ? "下一步" : "Next step"}
          disabled={progress >= n}
        >
          <IconNext />
        </button>
      </div>
    </div>
  );
}

/** Seeks an exhibit's disassembly progress with an eased animation. */
export function useProcedure(
  stage: Stage,
  exhibit: Exhibit,
  onArrive?: (step: number) => void,
) {
  const [progress, setProgress] = useState(exhibit.progress);
  const cancel = useRef<(() => void) | null>(null);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const seek = (target: number, speed = 1) => {
    cancel.current?.();
    const from = exhibit.progress;
    const distance = Math.abs(target - from);
    if (distance < 1e-3) {
      arrive.current?.(Math.round(target));
      return;
    }
    cancel.current = stage.animate({
      duration: Math.min(2.4, 0.55 + distance * 0.5) / speed,
      update: (k) => {
        const p = from + (target - from) * k;
        exhibit.setProgress(p);
        setProgress(p);
      },
      done: () => {
        cancel.current = null;
        arrive.current?.(Math.round(target));
      },
    });
  };
  const scrub = (value: number, done: boolean) => {
    cancel.current?.();
    cancel.current = null;
    exhibit.setProgress(value);
    setProgress(value);
    if (done) seek(Math.round(value));
  };
  useEffect(() => () => cancel.current?.(), []);
  return { progress, seek, scrub, setProgress };
}

export function stepTitle(steps: Step[], index: number, lang: "zh" | "en") {
  if (index <= 0) return lang === "zh" ? "整机" : "Assembled";
  return steps[index - 1].title[lang];
}
