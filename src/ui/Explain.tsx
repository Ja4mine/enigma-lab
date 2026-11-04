import { useMemo, type ReactNode } from "react";
import katex from "katex";
import { useLang } from "../i18n";

const render = (src: string, display: boolean) => katex.renderToString(src, { throwOnError: false, strict: false, displayMode: display, output: "html" });

/** Inline formula. */
export function Tex({ children }: { children: string }) {
  const html = useMemo(() => render(children, false), [children]);
  return <span className="tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Display formula. */
export function TexBlock({ children }: { children: string }) {
  const html = useMemo(() => render(children, true), [children]);
  return <div className="tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

type Kind = "ask" | "try" | "wall" | "idea" | "work" | "so";
const TAGS: Record<Kind, { zh: string; en: string }> = {
  ask: { zh: "问题", en: "The question" },
  try: { zh: "先试试", en: "First attempt" },
  wall: { zh: "碰壁", en: "Dead end" },
  idea: { zh: "想法", en: "The idea" },
  work: { zh: "推一下", en: "Work it out" },
  so: { zh: "所以", en: "So" },
};

/** One move in the reasoning: what is asked, what fails, what follows. */
export function Beat({ kind, children, tag }: { kind: Kind; children: ReactNode; tag?: string }) {
  const { lang } = useLang();
  return (
    <div className={`beat beat-${kind}`}>
      <span className="beat-tag">{tag ?? TAGS[kind][lang]}</span>
      <div className="beat-body">{children}</div>
    </div>
  );
}
