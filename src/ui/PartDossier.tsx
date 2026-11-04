import type { ReactNode } from "react";
import type { Exhibit, PartMeta } from "../engine/Exhibit";
import { useLang, type Text } from "../i18n";

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
  const meta = exhibit.meta(partId);
  if (!meta) return null;
  const other = lang === "zh" ? meta.name.en : meta.name.zh;
  const kids = exhibit.childrenOf(partId);
  const specs = [...(meta.specs ?? []), ...extraSpecs];
  return (
    <>
      <div className="title-block">
        <div className="tb-name">
          <h2>{t(meta.name)}</h2>
          <div className="tb-alt">
            {meta.german && <i lang="de">{meta.german}</i>}
            {meta.german && " · "}
            <span>{other}</span>
          </div>
        </div>
        <div className="tb-no">
          <span>{lang === "zh" ? "图号" : "Drawing"}</span>
          <b>{meta.number}</b>
        </div>
        {meta.material && (
          <dl className="tb-row" style={{ margin: 0, padding: "6px 11px" }}>
            <dt>{lang === "zh" ? "材料" : "Material"}</dt>
            <dd>{t(meta.material)}</dd>
          </dl>
        )}
      </div>
      <div className="section">
        <p className="prose">{t(meta.summary)}</p>
      </div>
      {meta.role && <div className="role">{t(meta.role)}</div>}
      {meta.features && meta.features.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>{lang === "zh" ? "图中标注" : "Callouts"}</h3>
            <span className="aside">{lang === "zh" ? "悬停可在模型上对应" : "Hover to match on the model"}</span>
          </div>
          <ol className="features">
            {meta.features.map((f, i) => (
              <li
                key={f.id}
                className={hot === f.id ? "hot" : ""}
                onMouseEnter={() => onHot(f.id)}
                onMouseLeave={() => onHot(null)}
              >
                <span className="balloon">{i + 1}</span>
                <div>
                  {t(f.label)}
                  {f.note && <p>{t(f.note)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {specs.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>{lang === "zh" ? "参数" : "Data"}</h3>
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
            <h3>{lang === "zh" ? "下一级零件" : "Sub-assemblies"}</h3>
            <span className="aside">{kids.length}</span>
          </div>
          <PartsList parts={kids} current={partId} onSelect={onSelect} depthOf={() => 1} />
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
  const { t } = useLang();
  return (
    <ul className="parts-list">
      {parts.map((p) => (
        <li key={p.id} className={`depth-${Math.min(3, depthOf(p.id))}`}>
          <button type="button" onClick={() => onSelect(p.id)} aria-current={p.id === current}>
            <span className="no">{p.number}</span>
            <span className="nm">{t(p.name)}</span>
            {p.german && <span className="de">{p.german.replace(/ \(.*\)/, "")}</span>}
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
        <h3>{lang === "zh" ? "零件清单" : "Parts list"}</h3>
        <span className="aside">{ordered.length}</span>
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
