import { useEffect, useMemo, useRef, useState } from "react";
import { ALPHABET, mod26, type Triple } from "../../core/enigma";
import {
  analyseStop,
  crashes,
  cribOffsets,
  propagate,
  scrambler,
  type BombeSpec,
  type Menu,
} from "../../core/bombe";
import { useLang } from "../../i18n";
import { IconReset } from "../../ui/icons";

const L = (n: number) => ALPHABET[mod26(n)];
export const coreText = (c: Triple<number>) => c.map(L).join("");

/* ------------------------------------------------------------------ */
/* Crib dragging                                                       */
/* ------------------------------------------------------------------ */

export function CribSheet({
  cipher,
  crib,
  offset,
  onOffset,
  window: span = 48,
}: {
  cipher: string;
  crib: string;
  offset: number;
  onOffset: (o: number) => void;
  window?: number;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const hits = crashes(cipher, crib, offset);
  const all = cribOffsets(cipher, crib).filter((o) => o.offset <= span - crib.length);
  const valid = all.filter((o) => !o.crashes.length).length;
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>{zh ? "把猜测的明文放到密文下面滑动" : "Slide the guessed plaintext along the ciphertext"}</h4>
        <p className="prose">
          {zh
            ? `猜词：${crib}（“天气预报”）。在第 ${offset} 位，若有任何一列上下字母相同，这个位置就不可能——恩尼格玛从不把字母加密成自己。`
            : `Crib: ${crib} (“weather forecast”). At position ${offset}, any column where a letter sits over itself rules the position out: Enigma never enciphers a letter to itself.`}
        </p>
        <div className="drag" role="img" aria-label={zh ? "猜词对齐" : "Crib alignment"}>
          <div className="drag-row index">
            {Array.from({ length: span }, (_, i) => (
              <span key={i}>{i % 5 === 0 ? i : ""}</span>
            ))}
          </div>
          <div className="drag-row cipher">
            {[...cipher.slice(0, span)].map((ch, i) => (
              <span key={i} className={i >= offset && i < offset + crib.length ? "under" : ""}>
                {ch}
              </span>
            ))}
          </div>
          <div className="drag-row crib">
            {Array.from({ length: span }, (_, i) => {
              const k = i - offset;
              if (k < 0 || k >= crib.length) return <span key={i} />;
              return (
                <span key={i} className={hits.includes(k) ? "crash" : "l"}>
                  {crib[k]}
                </span>
              );
            })}
          </div>
        </div>
        <div className="legend">
          <span>
            <i style={{ background: "var(--red)" }} />
            {zh ? "冲突（同字母相对）" : "Crash (letter over itself)"}
          </span>
          <span>
            {zh ? `前 ${span} 个字母里，${valid} 个位置没有冲突` : `${valid} crash-free positions in the first ${span} letters`}
          </span>
        </div>
        <div className="offset-strip" role="group" aria-label={zh ? "选择位置" : "Choose position"}>
          {all.map((o) => (
            <button
              key={o.offset}
              type="button"
              className={o.crashes.length ? "crash" : ""}
              aria-pressed={o.offset === offset}
              onClick={() => onOffset(o.offset)}
              title={o.crashes.length ? (zh ? `${o.crashes.length} 处冲突` : `${o.crashes.length} crash(es)`) : ""}
            >
              {o.offset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu graph                                                          */
/* ------------------------------------------------------------------ */

/** Fruchterman–Reingold inside a box; deterministic start on a circle. */
function forceLayout(nodes: number[], links: { a: number; b: number }[], w: number, h: number) {
  const pos = new Map<number, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 + 0.3;
    pos.set(n, { x: Math.cos(a) * w * 0.3, y: Math.sin(a) * h * 0.3 });
  });
  if (nodes.length === 1) pos.set(nodes[0], { x: 0, y: 0 });
  const k = Math.sqrt((w * h) / Math.max(2, nodes.length)) * 0.85;
  for (let it = 0; it < 500; it++) {
    const temp = (1 - it / 500) * k * 0.5 + 0.3;
    const disp = new Map(nodes.map((n) => [n, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const p = pos.get(nodes[i])!,
          q = pos.get(nodes[j])!;
        let dx = p.x - q.x,
          dy = p.y - q.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (k * k) / d;
        dx /= d;
        dy /= d;
        disp.get(nodes[i])!.x += dx * f;
        disp.get(nodes[i])!.y += dy * f;
        disp.get(nodes[j])!.x -= dx * f;
        disp.get(nodes[j])!.y -= dy * f;
      }
    for (const { a, b } of links) {
      if (a === b) continue;
      const p = pos.get(a)!,
        q = pos.get(b)!;
      let dx = p.x - q.x,
        dy = p.y - q.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d * d) / k;
      dx /= d;
      dy /= d;
      disp.get(a)!.x -= dx * f;
      disp.get(a)!.y -= dy * f;
      disp.get(b)!.x += dx * f;
      disp.get(b)!.y += dy * f;
    }
    for (const n of nodes) {
      const p = pos.get(n)!,
        dd = disp.get(n)!;
      dd.x -= p.x * 0.08;
      dd.y -= p.y * 0.08;
      const len = Math.max(1e-6, Math.hypot(dd.x, dd.y));
      p.x += (dd.x / len) * Math.min(len, temp);
      p.y += (dd.y / len) * Math.min(len, temp);
    }
  }
  return pos;
}

/** Fit points into a rectangle, keeping aspect ratio. */
function fit(pos: Map<number, { x: number; y: number }>, x0: number, y0: number, w: number, h: number, pad: number) {
  const pts = [...pos.values()];
  const minX = Math.min(...pts.map((p) => p.x)),
    maxX = Math.max(...pts.map((p) => p.x)),
    minY = Math.min(...pts.map((p) => p.y)),
    maxY = Math.max(...pts.map((p) => p.y));
  const sw = Math.max(1, maxX - minX),
    sh = Math.max(1, maxY - minY);
  const s = Math.min((w - 2 * pad) / sw, (h - 2 * pad) / sh, 2.2);
  for (const p of pts) {
    p.x = x0 + pad + (p.x - minX) * s + (w - 2 * pad - sw * s) / 2;
    p.y = y0 + pad + (p.y - minY) * s + (h - 2 * pad - sh * s) / 2;
  }
}

/**
 * Parts with four or more letters share the main area side by side; single
 * edges and tiny parts are stacked in a narrow column on the right.
 */
function layoutMenu(menu: Menu, w: number, h: number) {
  const out = new Map<number, { x: number; y: number }>();
  const comps = [...menu.components].sort((a, b) => b.length - a.length);
  const big = comps.filter((c, i) => i === 0 || c.length >= 4);
  const small = comps.filter((c) => !big.includes(c));
  const mainW = small.length ? w * 0.76 : w;
  const linksOf = (c: number[]) =>
    menu.links.filter((l) => c.includes(l.plain)).map((l) => ({ a: l.plain, b: l.cipher }));
  const weights = big.map((c) => Math.sqrt(c.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = 0;
  big.forEach((c, i) => {
    const bw = (mainW * weights[i]) / total;
    const p = forceLayout(c, linksOf(c), bw, h);
    fit(p, x, 0, bw, h, 36);
    p.forEach((v, n) => out.set(n, v));
    x += bw;
  });
  const slot = small.length ? h / small.length : h;
  small.forEach((c, i) => {
    const p = forceLayout(c, linksOf(c), w - mainW, slot);
    fit(p, mainW, i * slot, w - mainW, slot, 30);
    p.forEach((v, n) => out.set(n, v));
  });
  return out;
}

export function MenuGraph({
  menu,
  loop,
  hotLink,
  height = 330,
}: {
  menu: Menu;
  loop: number | null;
  hotLink?: number | null;
  height?: number;
}) {
  const W = 640,
    H = height;
  const pos = useMemo(() => layoutMenu(menu, W, H), [menu, H]);
  const inLoop = new Set(loop !== null ? menu.loops[loop]?.links ?? [] : menu.loops.flatMap((l) => l.links));
  const pairCount = new Map<string, number>();
  return (
    <svg className="menu-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="menu">
      {menu.links.map((link, i) => {
        const a = pos.get(link.plain)!,
          b = pos.get(link.cipher)!;
        const key = [link.plain, link.cipher].sort().join("-");
        const nth = pairCount.get(key) ?? 0;
        pairCount.set(key, nth + 1);
        const mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const bend = nth === 0 ? 0 : (nth % 2 ? 1 : -1) * 26 * Math.ceil(nth / 2);
        const cx = mx - (dy / len) * bend,
          cy = my + (dx / len) * bend;
        const lx = (a.x + 2 * cx + b.x) / 4,
          ly = (a.y + 2 * cy + b.y) / 4;
        const cls = hotLink === i ? "edge hot" : inLoop.has(i) ? "edge loop" : "edge";
        return (
          <g key={i}>
            <path className={cls} d={`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`} />
            <rect className="edge-label-bg" x={lx - 9} y={ly - 8} width={18} height={15} rx={2} />
            <text className="edge-label" x={lx} y={ly + 4} textAnchor="middle">
              {link.index + 1}
            </text>
          </g>
        );
      })}
      {menu.letters.map((l) => {
        const p = pos.get(l)!;
        const dim = loop !== null && !(menu.loops[loop]?.letters ?? []).includes(l);
        return (
          <g key={l} className={`node${l === menu.input ? " input" : ""}${dim ? " dim" : ""}`}>
            <circle cx={p.x} cy={p.y} r={15} />
            <text x={p.x} y={p.y + 6} textAnchor="middle">
              {L(l)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MenuSheet({ menu, loop, onLoop }: { menu: Menu; loop: number | null; onLoop: (i: number | null) => void }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>{zh ? "菜单：把明密对照画成图" : "The menu: plain/cipher pairs drawn as a graph"}</h4>
        <p className="prose">
          {zh
            ? `每一列给出一条边：明文字母 — 密文字母，边上的数字是它在猜词里的位置 i。${menu.letters.length} 个字母、${menu.links.length} 条边，形成 ${menu.closures} 个独立闭环。黑色圆是测试寄存器所接的字母。`
            : `Each column gives an edge: plain letter — cipher letter, labelled with its crib position i. ${menu.letters.length} letters and ${menu.links.length} edges close ${menu.closures} independent loops. The black node is the letter wired to the test register.`}
        </p>
        <MenuGraph menu={menu} loop={loop} />
        <div className="loops" role="group" aria-label={zh ? "闭环" : "Loops"}>
          <button type="button" aria-pressed={loop === null} onClick={() => onLoop(null)}>
            {zh ? "全部闭环" : "All loops"}
          </button>
          {menu.loops.map((lp, i) => (
            <button key={i} type="button" aria-pressed={loop === i} onClick={() => onLoop(i)}>
              {lp.letters.map(L).join("→")}→{L(lp.letters[0])}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The relation S(c) = E_i(S(p)) and its loops                         */
/* ------------------------------------------------------------------ */

function loopPermutation(spec: BombeSpec, core: Triple<number>, loopIndex: number) {
  const loop = spec.menu.loops[loopIndex];
  // Walk the loop: x_{next} = E_i(x_current) for each link in order.
  const perms = loop.links.map((li) => {
    const link = spec.menu.links[li];
    return scrambler(spec.rotors, spec.reflector, [core[0], core[1], mod26(core[2] + link.index)]);
  });
  const fixed: number[] = [];
  for (let x = 0; x < 26; x++) {
    let y = x;
    for (const p of perms) y = p[y];
    if (y === x) fixed.push(x);
  }
  return fixed;
}

export function RelationSheet({
  spec,
  trueCore,
  wrongCore,
}: {
  spec: BombeSpec;
  trueCore: Triple<number>;
  wrongCore: Triple<number>;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const loop = spec.menu.loops[0];
  const first = loop ? spec.menu.links[loop.links[0]] : null;
  const atTrue = loop ? loopPermutation(spec, trueCore, 0) : [];
  const atWrong = loop ? loopPermutation(spec, wrongCore, 0) : [];
  const start = loop ? loop.letters[0] : 0;
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>{zh ? "第一步：把插线板“消掉”" : "Step one: make the plugboard drop out"}</h4>
        <div className="math eq">
          <i>c</i>
          <sub>
            <i>i</i>
          </sub>{" "}
          = <i>S</i> <i>E</i>
          <sub>
            <i>i</i>
          </sub>{" "}
          <i>S</i> (<i>p</i>
          <sub>
            <i>i</i>
          </sub>
          )　⟹　<i>S</i>(<i>c</i>
          <sub>
            <i>i</i>
          </sub>
          ) = <i>E</i>
          <sub>
            <i>i</i>
          </sub>
          (<i>S</i>(<i>p</i>
          <sub>
            <i>i</i>
          </sub>
          ))
        </div>
        <dl className="symbols">
          <dt>
            <i>p</i>
            <sub>i</sub>, <i>c</i>
            <sub>i</sub>
          </dt>
          <dd>{zh ? "猜词第 i 位的明文字母与其下方的密文字母（菜单的一条边）。" : "Crib letter at position i and the cipher letter under it (one menu edge)."}</dd>
          <dt>
            <i>S</i>
          </dt>
          <dd>{zh ? "未知的插线板，对合：S = S⁻¹。左右两边各乘一次 S 就得到右式。" : "The unknown plugboard, an involution S = S⁻¹; apply S to both sides to get the right form."}</dd>
          <dt>
            <i>E</i>
            <sub>i</sub>
          </dt>
          <dd>{zh ? "去掉插线板后的转子组置换：只取决于转子排列和位置，可以由滚筒直接模拟。" : "The scrambler without plugboard: depends only on wheel order and position, which drums can imitate."}</dd>
        </dl>
        <p className="prose">
          {zh ? "未知量从“整块插线板”缩成了“每个字母插到哪”：记 " : "The unknown shrinks from the whole plugboard to where each letter is plugged: write "}
          <span className="math">
            <i>x</i>
            <sub>
              <i>a</i>
            </sub>{" "}
            = <i>S</i>(<i>a</i>)
          </span>
          {zh ? "。每条边都是一条约束 " : ". Every edge is one constraint "}
          <span className="math">
            <i>x</i>
            <sub>
              <i>c</i>
            </sub>{" "}
            = <i>E</i>
            <sub>
              <i>i</i>
            </sub>
            (<i>x</i>
            <sub>
              <i>p</i>
            </sub>
            )
          </span>
          {zh ? "。" : "."}
        </p>
      </div>
      {loop && first && (
        <div className="sheet-card">
          <h4>{zh ? "第二步：闭环给出不含 S 的检验" : "Step two: a loop gives a test without S"}</h4>
          <p className="prose">
            {zh ? "沿闭环 " : "Around the loop "}
            <b className="mono">
              {loop.letters.map(L).join(" → ")} → {L(loop.letters[0])}
            </b>
            {zh ? "，把约束一条条代进去：" : ", substitute one constraint after another:"}
          </p>
          <div className="math eq">
            <i>x</i>
            <sub>{L(start)}</sub> ={" "}
            {[...loop.links]
              .reverse()
              .map((li) => (
                <span key={li}>
                  <i>E</i>
                  <sub>{spec.menu.links[li].index + 1}</sub>
                </span>
              ))}{" "}
            (<i>x</i>
            <sub>{L(start)}</sub>)
          </div>
          <p className="prose">
            {zh
              ? `所以 S(${L(start)}) 必须是这个合成置换的不动点。不动点越少，这个转子位置越“可疑”。在真实位置（${coreText(trueCore)}）它有 ${atTrue.length} 个不动点：${atTrue.map(L).join("、") || "无"}；在随便一个错误位置（${coreText(wrongCore)}）有 ${atWrong.length} 个：${atWrong.map(L).join("、") || "无"}。`
              : `So S(${L(start)}) must be a fixed point of this composite permutation. At the true position (${coreText(trueCore)}) it has ${atTrue.length} fixed point(s): ${atTrue.map(L).join(", ") || "none"}; at an arbitrary wrong position (${coreText(wrongCore)}) it has ${atWrong.length}: ${atWrong.map(L).join(", ") || "none"}.`}
          </p>
          <p className="note">
            {zh
              ? "一个闭环平均只剩约 1 个候选；几个闭环同时要求就足以排除绝大多数位置。Bombe 用导线同时检查所有闭环——而且不需要先算出不动点。"
              : "One loop leaves about one candidate on average; several loops together rule out nearly every position. The Bombe checks all loops at once with wires, without computing fixed points at all."}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live-wire grid: 26 letter bundles × 26 wires                        */
/* ------------------------------------------------------------------ */

export function WireGrid({
  spec,
  core,
  trueStecker,
  playKey,
}: {
  spec: BombeSpec;
  core: Triple<number>;
  /** Shown as an outline on the test register row (only at the true position). */
  trueStecker: number | null;
  playKey: string;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const result = useMemo(() => propagate(spec, core), [spec, core]);
  const maxLayer = result.lit.reduce((m, c) => Math.max(m, c.layer), 0);
  const [layer, setLayer] = useState(maxLayer);
  const timer = useRef(0);
  const play = () => {
    window.clearInterval(timer.current);
    setLayer(0);
    let l = 0;
    timer.current = window.setInterval(() => {
      l++;
      setLayer(l);
      if (l >= maxLayer) window.clearInterval(timer.current);
    }, 240);
  };
  useEffect(() => {
    play();
    return () => window.clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, maxLayer]);
  const cell = 14,
    pad = 22;
  const size = pad + 26 * cell + 4;
  const inMenu = new Set(spec.menu.letters);
  const visible = result.lit.filter((c) => c.layer <= layer);
  const liveTest = visible.filter((c) => c.letter === spec.menu.input).length;
  const finalTest = result.lit.filter((c) => c.letter === spec.menu.input).length;
  const viaDiagonal = visible.filter((c) => c.via === "diagonal").length;
  return (
    <div className="grid-wrap">
      <svg className="wire-grid" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={zh ? "带电导线" : "Live wires"}>
        {[...ALPHABET].map((ch, i) => (
          <g key={ch}>
            <text className={`axis${inMenu.has(i) ? " menu" : ""}`} x={pad - 6} y={pad + i * cell + 10} textAnchor="end">
              {ch}
            </text>
            <text className="axis" x={pad + i * cell + cell / 2} y={pad - 7} textAnchor="middle">
              {ch}
            </text>
          </g>
        ))}
        {[...ALPHABET].map((_, r) =>
          [...ALPHABET].map((__, c) => (
            <rect
              key={`${r}-${c}`}
              className={`cell${inMenu.has(r) ? " menu" : ""}`}
              x={pad + c * cell}
              y={pad + r * cell}
              width={cell}
              height={cell}
            />
          )),
        )}
        {spec.diagonal && <line className="diag-line" x1={pad} y1={pad} x2={pad + 26 * cell} y2={pad + 26 * cell} />}
        {visible.map((c, i) => (
          <rect
            key={i}
            className={`cell live${c.via === "diagonal" ? " diag" : ""}${c.via === "inject" ? " inject" : ""}`}
            x={pad + c.wire * cell + 1}
            y={pad + c.letter * cell + 1}
            width={cell - 2}
            height={cell - 2}
          />
        ))}
        {trueStecker !== null && layer >= maxLayer && (
          <rect
            className="cell dead-true"
            x={pad + trueStecker * cell + 1}
            y={pad + spec.menu.input * cell + 1}
            width={cell - 2}
            height={cell - 2}
          />
        )}
        <rect className="test-row" x={pad - 1} y={pad + spec.menu.input * cell - 1} width={26 * cell + 2} height={cell + 2} />
      </svg>
      <div className="grid-side">
      <p className="note" style={{ marginTop: 0 }}>
        {zh
          ? `第 a 行第 b 列 = “S(a) = b”这根线。粗框是测试寄存器（${L(spec.menu.input)} 行）。`
          : `Row a, column b is the wire “S(a) = b”. The heavy frame is the test register (row ${L(spec.menu.input)}).`}
      </p>
      <div className="legend">
        <span>
          <i style={{ background: "var(--ink)" }} />
          {zh ? `注入：${L(spec.menu.input)} 组第 ${L(spec.inputWire)} 线` : `Injected: wire ${L(spec.inputWire)} of ${L(spec.menu.input)}`}
        </span>
        <span>
          <i style={{ background: "var(--amber)" }} />
          {zh ? "经扰频器带电" : "Live via a scrambler"}
        </span>
        {spec.diagonal && (
          <span>
            <i style={{ background: "var(--teal)" }} />
            {zh ? "经对角板带电" : "Live via the diagonal board"}
          </span>
        )}
      </div>
      <div className="stat-row">
        <div>
          <b>
            {liveTest}/26
          </b>
          <span>{zh ? "测试寄存器带电" : "test register live"}</span>
        </div>
        <div>
          <b>{visible.length}</b>
          <span>{zh ? "带电导线（全部）" : "live wires (all)"}</span>
        </div>
        <div>
          <b>{viaDiagonal}</b>
          <span>{zh ? "其中经对角板" : "of them via diagonal"}</span>
        </div>
        <div>
          <b>
            {layer}/{maxLayer}
          </b>
          <span>{zh ? "传导层数" : "relay hops"}</span>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn quiet" onClick={play}>
          <IconReset /> {zh ? "重放电流" : "Replay current"}
        </button>
        <span className="note" style={{ alignSelf: "center" }}>
          {finalTest === 26
            ? zh
              ? "全部 26 根都通电：任何插线假设都自相矛盾，这个位置被排除。"
              : "All 26 wires live: every stecker hypothesis contradicts itself; this position is rejected."
            : zh
              ? `只有 ${finalTest} 根通电：没有矛盾，机器在这里停下。`
              : `Only ${finalTest} live: no contradiction, so the machine stops here.`}
        </span>
      </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stop analysis                                                       */
/* ------------------------------------------------------------------ */

export function StopSummary({ spec, core }: { spec: BombeSpec; core: Triple<number> }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const hyps = useMemo(() => analyseStop(spec, core), [spec, core]);
  const consistent = hyps.filter((h) => h.consistent);
  return (
    <div>
      <p className="prose">
        {zh
          ? `逐一检验测试字母 ${L(spec.menu.input)} 的 26 种插线假设：`
          : `Test each of the 26 stecker hypotheses for ${L(spec.menu.input)} on its own:`}
      </p>
      <div className="pairs" aria-label={zh ? "假设" : "Hypotheses"}>
        {hyps.map((h) => (
          <span key={h.wire} className={h.consistent ? "found" : ""} title={h.consistent ? "consistent" : "contradiction"}>
            {L(spec.menu.input)}↔{L(h.wire)}
          </span>
        ))}
      </div>
      <p className="note">
        {consistent.length
          ? zh
            ? `自洽的假设：${consistent.map((h) => `${L(spec.menu.input)}↔${L(h.wire)}`).join("、")}。其余都会让某个字母同时插到两个地方。`
            : `Consistent: ${consistent.map((h) => `${L(spec.menu.input)}↔${L(h.wire)}`).join(", ")}. Every other one makes some letter plugged to two places at once.`
          : zh
            ? "没有自洽的假设：这是一次假停机，检查后丢弃。"
            : "No consistent hypothesis: a false stop, thrown away after checking."}
      </p>
    </div>
  );
}

export { crashes };
