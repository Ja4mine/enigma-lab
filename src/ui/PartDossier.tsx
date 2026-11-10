import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Exhibit, PartMeta } from "../engine/Exhibit";
import { useLang, type Text } from "../i18n";
import { IconNext, IconPrev } from "./icons";

export function PartDossier({
  exhibit,
  partId,
  onSelect,
  hot,
  onHot,
  extraSpecs = [],
  children,
}: {
  exhibit: Exhibit;
  partId: string;
  onSelect: (id: string) => void;
  hot: string | null;
  onHot: (id: string | null) => void;
  extraSpecs?: { k: Text; v: string | Text }[];
  children?: ReactNode;
}) {
  const { t, lang } = useLang();
  const heading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = heading.current?.closest<HTMLElement>(".panel-body");
    if (panel) panel.scrollTop = 0;
  }, [partId]);
  const meta = exhibit.meta(partId);
  if (!meta) return null;
  const other = lang === "zh" ? meta.name.en : meta.name.zh;
  const kids = exhibit.childrenOf(partId);
  const parent = meta.parent ? exhibit.meta(meta.parent) : null;
  const specs = [...(meta.specs ?? []), ...extraSpecs];
  return (
    <>
      <div ref={heading} className="dossier-heading">
        <span className="dossier-eyebrow">
          {lang === "zh" ? "组件档案" : "COMPONENT RECORD"}
        </span>
        {parent && (
          <button
            type="button"
            className="dossier-back"
            onClick={() => onSelect(parent.id)}
          >
            <IconPrev size={13} aria-hidden="true" />
            {t(parent.name)}
          </button>
        )}
      </div>
      <div className="title-block dossier-title">
        <div className="tb-name">
          <h2>{t(meta.name)}</h2>
          <div className="tb-alt">
            {meta.german && <i lang="de">{meta.german}</i>}
            {meta.german && " · "}
            <span>{other}</span>
          </div>
        </div>
        <div className="tb-no">
          <span>{lang === "zh" ? "藏品编号" : "CATALOGUE"}</span>
          <b>{meta.number}</b>
        </div>
        {meta.material && (
          <dl className="tb-row dossier-material">
            <dt>{lang === "zh" ? "材料" : "Material"}</dt>
            <dd>{t(meta.material)}</dd>
          </dl>
        )}
      </div>
      <div className="section dossier-summary">
        <p className="prose">{t(meta.summary)}</p>
      </div>
      {meta.role && (
        <div className="role dossier-role">
          <span className="dossier-role-label">
            {lang === "zh" ? "工作原理" : "ITS ROLE"}
          </span>
          <p>{t(meta.role)}</p>
        </div>
      )}
      {meta.features && meta.features.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>{lang === "zh" ? "细节检视" : "A closer look"}</h3>
            <span className="aside">
              {lang === "zh" ? "轻触以定位" : "Select to locate"}
            </span>
          </div>
          <ol className="features dossier-features">
            {meta.features.map((f, i) => (
              <li key={f.id} className={hot === f.id ? "hot" : ""}>
                <button
                  type="button"
                  className="feature-button"
                  onPointerEnter={() => onHot(f.id)}
                  onPointerLeave={(event) => {
                    if (document.activeElement !== event.currentTarget)
                      onHot(null);
                  }}
                  onFocus={() => onHot(f.id)}
                  onBlur={() => onHot(null)}
                  onClick={() => onHot(f.id)}
                >
                  <span className="balloon">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="feature-copy">
                    <span className="feature-name">{t(f.label)}</span>
                    {f.note && (
                      <span className="feature-note">{t(f.note)}</span>
                    )}
                  </span>
                  <span className="feature-target" aria-hidden="true">
                    ⌖
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {specs.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>{lang === "zh" ? "技术资料" : "Technical record"}</h3>
          </div>
          <dl className="specs">
            {specs.map((s, i) => (
              <div key={i} style={{ display: "contents" }}>
                <dt>{t(s.k)}</dt>
                <dd>{typeof s.v === "string" ? s.v : t(s.v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {children}
      {kids.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>{lang === "zh" ? "继续探索" : "Explore the assembly"}</h3>
            <span className="aside">
              {String(kids.length).padStart(2, "0")}
            </span>
          </div>
          <PartsList
            parts={kids}
            current={partId}
            onSelect={onSelect}
            depthOf={() => 1}
          />
        </div>
      )}
    </>
  );
}

export function PartsList({
  parts,
  current,
  onSelect,
  depthOf,
}: {
  parts: PartMeta[];
  current: string;
  onSelect: (id: string) => void;
  depthOf: (id: string) => number;
}) {
  const { t, lang } = useLang();
  return (
    <ul className="parts-list">
      {parts.map((p) => (
        <li key={p.id} className={`depth-${Math.min(3, depthOf(p.id))}`}>
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            aria-current={p.id === current}
            aria-label={`${lang === "zh" ? "检视" : "Inspect"} ${t(p.name)}`}
            title={p.german}
          >
            <span className="no">{p.number}</span>
            <span className="nm">
              {t(p.name)}
              {p.german && (
                <span className="de">{p.german.replace(/ \(.*\)/, "")}</span>
              )}
            </span>
            <IconNext className="part-open" size={14} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Whole bill of materials in tree order. */
export function BillOfMaterials({
  exhibit,
  root,
  current,
  onSelect,
}: {
  exhibit: Exhibit;
  root: string;
  current: string;
  onSelect: (id: string) => void;
}) {
  const { lang } = useLang();
  const ordered: { meta: PartMeta; depth: number }[] = [];
  const walk = (id: string, depth: number) => {
    const meta = exhibit.meta(id);
    if (!meta) return;
    if (depth > 0) ordered.push({ meta, depth });
    for (const child of exhibit.childrenOf(id)) walk(child.id, depth + 1);
  };
  walk(root, 0);
  const depth = new Map(ordered.map((o) => [o.meta.id, o.depth]));
  return (
    <div className="section">
      <div className="section-head">
        <h3>{lang === "zh" ? "组件索引" : "Component index"}</h3>
        <span className="aside">{String(ordered.length).padStart(2, "0")}</span>
      </div>
      <PartsList
        parts={ordered.map((o) => o.meta)}
        current={current}
        onSelect={onSelect}
        depthOf={(id) => depth.get(id) ?? 1}
      />
    </div>
  );
}
