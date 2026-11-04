import { useEffect, useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import { ALPHABET, mod26, type Triple } from "../../core/enigma";
import {
  analyseStop,
  chase,
  crashes,
  cribOffsets,
  propagate,
  scrambler,
  type BombeSpec,
  type Menu,
} from "../../core/bombe";
import { useLang } from "../../i18n";
import { IconReset } from "../../ui/icons";
import { Tex, TexBlock } from "../../ui/Explain";

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
            ? `猜词 ${crib}（“天气预报”）。点下面的数字移动它：只要有一列上下字母相同，这个位置就不可能。`
            : `The crib is ${crib} (“weather forecast”). Click a number below to move it: any column with a letter over itself makes that position impossible.`}
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

/** d3-force layout of one connected part of the menu. */
function forceLayout(nodes: number[], links: { a: number; b: number }[], w: number, h: number) {
  const ns: (SimulationNodeDatum & { id: number })[] = nodes.map((id) => ({ id }));
  const ls = links.map((l) => ({ source: l.a, target: l.b }));
  const sim = forceSimulation(ns)
    .force("link", forceLink(ls).id((d) => (d as { id: number }).id).distance(84).strength(0.7))
    .force("charge", forceManyBody().strength(-420))
    .force("collide", forceCollide(30))
    .force("center", forceCenter(w / 2, h / 2))
    .stop();
  sim.tick(400);
  return new Map(ns.map((n) => [n.id, { x: n.x!, y: n.y! }]));
}

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
  known,
  usedLinks,
  clashLetter,
}: {
  menu: Menu;
  loop: number | null;
  hotLink?: number | null;
  height?: number;
  /** Letters whose stecker has been deduced so far. */
  known?: Map<number, number>;
  usedLinks?: Set<number>;
  clashLetter?: number | null;
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
        const walked = usedLinks?.has(link.index);
        const cls = hotLink === i ? "edge hot" : walked ? "edge walked" : known ? "edge" : inLoop.has(i) ? "edge loop" : "edge";
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
          <g key={l} className={`node${l === menu.input ? " input" : ""}${dim ? " dim" : ""}${clashLetter === l ? " clash" : ""}`}>
            <circle cx={p.x} cy={p.y} r={15} />
            <text x={p.x} y={p.y + 6} textAnchor="middle">
              {L(l)}
            </text>
            {known?.has(l) && (
              <text className="node-value" x={p.x} y={p.y + 30} textAnchor="middle">
                S={L(known.get(l)!)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function MenuSheet({
  menu,
  spec,
  trueCore,
  wrongCore,
}: {
  menu: Menu;
  spec: BombeSpec;
  trueCore: Triple<number>;
  wrongCore: Triple<number>;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [where, setWhere] = useState<"wrong" | "true">("wrong");
  const [guess, setGuess] = useState(0);
  const [shown, setShown] = useState(1);
  const core = where === "wrong" ? wrongCore : trueCore;
  const input = menu.input;
  const run = useMemo(() => chase(spec, core, input, guess), [spec, core, input, guess]);
  const outcomes = useMemo(() => Array.from({ length: 26 }, (_, v) => chase(spec, core, input, v).failed), [spec, core, input]);
  useEffect(() => setShown(1), [where, guess, spec]);
  const steps = run.steps.slice(0, shown);
  const finished = shown >= run.steps.length;
  const known = new Map<number, number>([[input, guess]]);
  for (const d of steps) if (d.clash === null) known.set(d.to, d.value);
  const last = steps[steps.length - 1];
  const alive = outcomes.filter((failed) => !failed).length;
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>{zh ? "亲手推一遍：字母点是推理能到的地方" : "Follow it by hand: the graph is where reasoning can go"}</h4>
        <p className="prose">
          {zh
            ? `每条边是猜词的一列，边上的数字是第几列。先猜 ${L(input)} 插到哪，再沿着边一步步推。`
            : `Each edge is one column of the crib, numbered by position. Guess where ${L(input)} is plugged, then follow the edges.`}
        </p>
        <div className="chase-controls">
          <div className="segmented small" role="group" aria-label={zh ? "转子位置" : "Rotor position"}>
            <button type="button" aria-pressed={where === "wrong"} onClick={() => setWhere("wrong")}>
              {zh ? "某个错误位置 " : "A wrong position "}
              {coreText(wrongCore)}
            </button>
            <button type="button" aria-pressed={where === "true"} onClick={() => setWhere("true")}>
              {zh ? "真实位置 " : "The true position "}
              {coreText(trueCore)}
            </button>
          </div>
          <div className="guess-row" role="group" aria-label={zh ? `猜 S(${L(input)})` : `Guess S(${L(input)})`}>
            <span className="guess-label">
              <Tex>{`S(\\mathrm{${L(input)}}) =`}</Tex>
            </span>
            {Array.from({ length: 26 }, (_, v) => (
              <button key={v} type="button" aria-pressed={guess === v} onClick={() => setGuess(v)}>
                {L(v)}
              </button>
            ))}
          </div>
        </div>
        <MenuGraph
          menu={menu}
          loop={null}
          known={known}
          usedLinks={new Set(steps.map((d) => d.link.index))}
          clashLetter={last && last.clash !== null ? last.to : null}
          height={340}
        />
        <ol className="chase-log" aria-live="polite">
          {steps.map((d, i) => (
            <li key={i} className={d.clash !== null ? "bad" : d.closesLoop ? "good" : ""}>
              <span className="n">{i + 1}</span>
              <Tex>{`S(\\mathrm{${L(d.to)}}) = E_{${d.link.index + 1}}(S(\\mathrm{${L(d.from)}})) = E_{${d.link.index + 1}}(\\mathrm{${L(d.input)}}) = \\mathrm{${L(d.value)}}`}</Tex>
              {d.clash !== null && <em>{zh ? `但刚才已推出 S(${L(d.to)}) = ${L(d.clash)}，撞车` : `but S(${L(d.to)}) = ${L(d.clash)} already, a clash`}</em>}
              {d.closesLoop && <em>{zh ? "绕回来，相符" : "back round, it agrees"}</em>}
            </li>
          ))}
        </ol>
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={finished} onClick={() => setShown((n) => n + 1)}>
            {zh ? "推下一步" : "Next deduction"}
          </button>
          <button type="button" className="btn" disabled={finished} onClick={() => setShown(run.steps.length)}>
            {zh ? "推到底" : "Finish"}
          </button>
        </div>
        {finished && (
          <p className={`note ${run.failed ? "verdict-bad" : "verdict-good"}`}>
            {run.failed
              ? zh
                ? `假设 S(${L(input)}) = ${L(guess)} 被证伪。我们没有用到插线板的任何信息。`
                : `The guess S(${L(input)}) = ${L(guess)} is disproved, without using anything about the plugboard.`
              : zh
                ? `所有边都走完，没有撞车：S(${L(input)}) = ${L(guess)} 活了下来。`
                : `Every edge used and no clash: S(${L(input)}) = ${L(guess)} survives.`}{" "}
            {zh
              ? `这个转子位置上，26 个猜测有 ${26 - alive} 个撞车，${alive} 个活下来。`
              : `At this rotor position ${26 - alive} of the 26 guesses clash and ${alive} survive.`}
          </p>
        )}
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
  loop: chosen,
  onLoop,
}: {
  spec: BombeSpec;
  trueCore: Triple<number>;
  wrongCore: Triple<number>;
  loop: number | null;
  onLoop: (i: number | null) => void;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  // Start from the longest loop: it shows the argument most clearly.
  const longest = spec.menu.loops.reduce((best, l, i, all) => (l.letters.length > all[best].letters.length ? i : best), 0);
  const index = chosen ?? longest;
  const loop = spec.menu.loops[index];
  if (!loop) return null;
  const atTrue = loopPermutation(spec, trueCore, index);
  const atWrong = loopPermutation(spec, wrongCore, index);
  const start = loop.letters[0];
  const chain = [...loop.links].reverse().map((li) => `E_{${spec.menu.links[li].index + 1}}`).join("\\,");
  const steps = loop.links.map((li, i) => {
    const a = loop.letters[i],
      b = loop.letters[(i + 1) % loop.letters.length],
      n = spec.menu.links[li].index + 1;
    return `S(\\mathrm{${L(b)}}) &= E_{${n}}\\,S(\\mathrm{${L(a)}})`;
  });
  const Row = ({ label, fixed }: { label: string; fixed: number[] }) => (
    <div className="fixed-row">
      <span>{label}</span>
      <span className="alpha">
        {Array.from({ length: 26 }, (_, v) => (
          <i key={v} className={fixed.includes(v) ? "on" : ""}>
            {L(v)}
          </i>
        ))}
      </span>
      <b>{zh ? `${fixed.length} 个` : `${fixed.length}`}</b>
    </div>
  );
  return (
    <div className="sheet">
      <div className="sheet-card">
        <h4>{zh ? "挑一个闭环，绕一圈" : "Pick a loop and go round it"}</h4>
        <div className="loops" role="group" aria-label={zh ? "闭环" : "Loops"}>
          {spec.menu.loops.map((lp, i) => (
            <button key={i} type="button" aria-pressed={index === i} onClick={() => onLoop(i)}>
              {lp.letters.map(L).join("→")}→{L(lp.letters[0])}
            </button>
          ))}
        </div>
        <MenuGraph menu={spec.menu} loop={index} height={260} />
        <TexBlock>{`\\begin{aligned}${steps.join("\\\\")}\\end{aligned}`}</TexBlock>
        <p className="prose">{zh ? "把这几行一层层代入，起点又回到自己：" : "Substitute these lines into each other and the start comes back to itself:"}</p>
        <TexBlock>{`S(\\mathrm{${L(start)}}) = ${chain}\\; S(\\mathrm{${L(start)}})`}</TexBlock>
      </div>
      <div className="sheet-card">
        <h4>{zh ? `哪些字母能当 S(${L(start)})？只有绕一圈不变的` : `Which letters can be S(${L(start)})? Only those unchanged by the trip`}</h4>
        <Row label={zh ? `真实位置 ${coreText(trueCore)}` : `True ${coreText(trueCore)}`} fixed={atTrue} />
        <Row label={zh ? `错误位置 ${coreText(wrongCore)}` : `Wrong ${coreText(wrongCore)}`} fixed={atWrong} />
        <p className="note">
          {zh
            ? "真实位置上，真正的插线一定在亮的字母里。单个闭环通常筛不到唯一，两字母的短环尤其如此，所以要多个闭环同时成立。"
            : "At the true position the real stecker is always among the lit letters. One loop rarely narrows it to a single letter, short two-letter loops least of all, which is why several loops must hold together."}
        </p>
      </div>
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
