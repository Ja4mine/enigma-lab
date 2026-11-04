import { useMemo, useState } from "react";
import { ALPHABET, ROTORS, mod26, type KeyResult, type MachineConfig } from "../../core/enigma";
import { useLang } from "../../i18n";
import { Beat, Tex, TexBlock } from "../../ui/Explain";

const L = (n: number) => ALPHABET[mod26(n)];

/** The substitution a single rotor performs at offset k, as a live table. */
function RotorTable() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [k, setK] = useState(0);
  const wiring = ROTORS.I.wiring;
  const map = useMemo(
    () => Array.from({ length: 26 }, (_, x) => mod26(ALPHABET.indexOf(wiring[mod26(x + k)]) - k)),
    [k, wiring],
  );
  return (
    <figure className="rotor-table">
      <figcaption>
        <span>{zh ? "转子 I 的替换表" : "Rotor I as a substitution table"}</span>
        <output>
          k = {k}
        </output>
      </figcaption>
      <div className="perm-row in" aria-hidden="true">
        {ALPHABET.split("").map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="perm-row out">
        {map.map((v, x) => (
          <span key={x} className={v === 0 ? "mark" : ""}>
            {L(v)}
          </span>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={25}
        value={k}
        onChange={(e) => setK(+e.target.value)}
        aria-label={zh ? "转子偏转 k" : "Rotor offset k"}
      />
      <p className="note">
        {zh
          ? `拖动滑块转动转子：同一个字母 A 这时加密成 ${L(map[0])}，整张表都换了。`
          : `Drag to turn the rotor: the letter A now goes to ${L(map[0])}, and the whole table has changed.`}
      </p>
    </figure>
  );
}

function Chapter({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="section chapter">
      <h3>
        <span className="chapter-n">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Why the machine looks the way it does: each part answers a weakness of the
 * previous design, and each answer leaves a mark the Bombe later exploits.
 */
export function EnigmaPrinciple({ trace, config }: { trace: KeyResult | null; config: MachineConfig }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const st = trace ? Object.fromEntries(trace.stages.map((s) => [s.id, s])) : null;
  const k = trace ? trace.after.map((p, i) => mod26(p - config.rings[i])) : null;
  return (
    <>
      <Chapter n={1} title={zh ? "为什么要转子" : "Why rotors at all"}>
        <Beat kind="ask">{zh ? "怎样用字母替换来保密？" : "How can letter substitution keep a secret?"}</Beat>
        <Beat kind="try">
          {zh ? "最简单的办法是固定一张替换表，比如 A→E、B→K。" : "The simplest way is one fixed table, say A→E, B→K."}
        </Beat>
        <Beat kind="wall">
          {zh
            ? "每个 E 都变成同一个字母，字母频率原样保留。德文里最常见的字母一数就出来，几百字就能破。"
            : "Every E becomes the same letter, so letter frequencies survive untouched. Count the commonest letter and a few hundred characters fall."}
        </Beat>
        <Beat kind="idea">
          {zh
            ? "让替换表在每打一个字母后都换一张。可是几千张表没法随身带。转子的妙处是：一个接线固定的圆盘，转到不同角度就是不同的表。"
            : "Change the table after every letter. Thousands of tables can't be carried around, though. The rotor's trick: one disc with fixed wiring is a different table at each angle."}
        </Beat>
        <RotorTable />
        <Beat kind="work">
          {zh ? (
            <>
              怎么写出这件事？字母记作 0…25，<Tex>{"\\rho(x)=x+1"}</Tex> 表示错开一位，<Tex>{"W"}</Tex> 是转子内部固定的接线。转子转过 <Tex>{"k"}</Tex> 格时，电流先错开 <Tex>{"k"}</Tex> 位进入线芯，走固定的线，再错回来：
            </>
          ) : (
            <>
              How to write this? Number letters 0…25, let <Tex>{"\\rho(x)=x+1"}</Tex> shift by one, and <Tex>{"W"}</Tex> be the fixed internal wiring. With the rotor turned <Tex>{"k"}</Tex> places, current shifts <Tex>{"k"}</Tex> into the core, follows the fixed wire, then shifts back:
            </>
          )}
          <TexBlock>{"R_k=\\rho^{-k}\\,W\\,\\rho^{k},\\qquad k=p-r"}</TexBlock>
          {zh ? (
            <>
              这里 <Tex>{"p"}</Tex> 是窗口读数，<Tex>{"r"}</Tex> 是环设置。这种“先变换、做事、再变回去”的形式叫共轭，后面会反复出现。
            </>
          ) : (
            <>
              Here <Tex>{"p"}</Tex> is the window reading and <Tex>{"r"}</Tex> the ring setting. This “change, act, change back” shape is called conjugation, and it will keep returning.
            </>
          )}
        </Beat>
        <Beat kind="so" tag={zh ? "留下的破绽" : "The mark it leaves"}>
          {zh ? (
            <>
              <Tex>{"p"}</Tex> 和 <Tex>{"r"}</Tex> 只以差的形式出现。对导线来说，拨环和转转子是一回事，所以破译时可以先不管环设置。
            </>
          ) : (
            <>
              <Tex>{"p"}</Tex> and <Tex>{"r"}</Tex> appear only as a difference. To the wires, turning the ring and turning the rotor are the same, so a codebreaker may ignore rings at first.
            </>
          )}
        </Beat>
        {trace && st && k && (
          <p className="note">
            {zh ? "你最近一次击键：" : "Your last key press: "}k = ({k.join(", ")})
            {zh ? "，右转子把 " : "; the right rotor took "}
            {L(st["right-forward"].input)} {zh ? "变成 " : "to "}
            {L(st["right-forward"].output)}.
          </p>
        )}
      </Chapter>

      <Chapter n={2} title={zh ? "为什么要三枚，还要步进" : "Why three, and why they step"}>
        <Beat kind="wall">
          {zh ? "一枚转子转 26 下就回到原来的表，长电文立刻露出周期。" : "One rotor repeats after 26 letters, and long messages expose that period at once."}
        </Beat>
        <Beat kind="idea">
          {zh
            ? "像里程表那样串联：右转子每打一个字母走一格，走到凹口时带动中转子，中转子再带动左转子。"
            : "Chain them like an odometer: the right rotor steps on every letter, and at its notch carries the middle, which in turn carries the left."}
        </Beat>
        <Beat kind="work">
          {zh ? (
            <>
              中转子走到自己的凹口时会连走两步（双步进），所以周期不是 <Tex>{"26^3"}</Tex>，而是 <Tex>{"26\\times25\\times26=16{,}900"}</Tex>。例：I–II–III 从 ADU 连按三键：ADU → ADV → AEW → BFX。
            </>
          ) : (
            <>
              The middle rotor moves twice in a row at its own notch (the double step), so the period is not <Tex>{"26^3"}</Tex> but <Tex>{"26\\times25\\times26=16{,}900"}</Tex>. Example: I–II–III from ADU over three keys: ADU → ADV → AEW → BFX.
            </>
          )}
        </Beat>
        <Beat kind="so" tag={zh ? "留下的破绽" : "The mark it leaves"}>
          {zh
            ? "短短几十个字母内，左、中转子基本不动，只有右转子一格格走。Bombe 正是靠这一点，用“下层滚筒多转 i 格”模拟第 i 个字母。"
            : "Over a few dozen letters the left and middle rotors barely move; only the right one steps along. That is why the Bombe can model letter i by setting a drum i places on."}
        </Beat>
      </Chapter>

      <Chapter n={3} title={zh ? "为什么要反射器" : "Why a reflector"}>
        <Beat kind="ask">
          {zh ? "收报员怎么解密？如果解密要反着接线，机器就要多一套切换。" : "How does the receiver decipher? If that meant reversing the wiring, the machine would need a mode switch."}
        </Beat>
        <Beat kind="idea">
          {zh
            ? "在转子尽头放一块把触点两两连死的反射器 U，电流折返再穿回转子。"
            : "At the end of the rotors put a reflector U that wires the contacts in fixed pairs, sending current back through the rotors."}
        </Beat>
        <Beat kind="work">
          {zh ? (
            <>
              记 <Tex>{"Q=L\\,M\\,R"}</Tex> 为依次穿过三枚转子，则第 <Tex>{"i"}</Tex> 次击键的转子组是
            </>
          ) : (
            <>
              With <Tex>{"Q=L\\,M\\,R"}</Tex> for passing through all three rotors, the scrambler at keystroke <Tex>{"i"}</Tex> is
            </>
          )}
          <TexBlock>{"E_i=Q^{-1}\\,U\\,Q"}</TexBlock>
          {zh ? (
            <>
              又是共轭。<Tex>{"U"}</Tex> 是 13 对互换，所以 <Tex>{"U^2=1"}</Tex> 且 <Tex>{"U(x)\\ne x"}</Tex>，这两条性质都传给 <Tex>{"E_i"}</Tex>：
            </>
          ) : (
            <>
              Conjugation again. <Tex>{"U"}</Tex> is 13 swaps, so <Tex>{"U^2=1"}</Tex> and <Tex>{"U(x)\\ne x"}</Tex>, and both properties pass to <Tex>{"E_i"}</Tex>:
            </>
          )}
          <TexBlock>{"E_i^2=Q^{-1}U^2Q=1,\\qquad E_i(x)=x\\Rightarrow U(Qx)=Qx\\ \\text{(impossible)}"}</TexBlock>
        </Beat>
        <Beat kind="so" tag={zh ? "好处" : "The gain"}>
          {zh ? "加密和解密是同一个操作：相同设置下把密文打进去，灯上亮的就是明文。" : "Enciphering and deciphering are the same act: type the ciphertext at the same settings and the plaintext lights up."}
        </Beat>
        <Beat kind="wall" tag={zh ? "留下的破绽" : "The mark it leaves"}>
          {zh
            ? "字母绝不会加密成自己。这个方便带来的副作用，让猜词可以拖动比对，一眼排除错误位置。"
            : "No letter ever enciphers to itself. This side effect of convenience lets a crib be slid along a message, ruling positions out at a glance."}
        </Beat>
      </Chapter>

      <Chapter n={4} title={zh ? "为什么要插线板" : "Why a plugboard"}>
        <Beat kind="wall">
          {zh
            ? "转子接线一旦被掌握（波兰密码局 1932 年就做到了），转子状态只有约百万种，靠人力和机械可以穷举。"
            : "Once the rotor wiring is known (the Polish Cipher Bureau managed it in 1932), there are only about a million rotor states, within reach of exhaustive search."}
        </Beat>
        <Beat kind="idea">
          {zh
            ? "在键盘、灯板和转子之间加一层可以每天重接的字母互换。"
            : "Between keyboard, lamps and rotors add a layer of letter swaps that can be rewired daily."}
        </Beat>
        <Beat kind="work">
          {zh ? "10 根线：从 26 个字母选 20 个配成 10 对，种数是" : "With 10 cables: choose 20 of 26 letters and pair them up, giving"}
          <TexBlock>{"\\binom{26}{20}\\cdot\\frac{20!}{10!\\,2^{10}}=\\frac{26!}{6!\\,10!\\,2^{10}}\\approx1.5\\times10^{14}"}</TexBlock>
          {zh ? "整台机器的一次加密于是写成" : "One encipherment of the whole machine is then"}
          <TexBlock>{"C_i=S\\,E_i\\,S,\\qquad S=S^{-1}"}</TexBlock>
          {trace && st && (
            <p className="note">
              {zh ? "你最近一次击键：" : "Your last key press: "}
              <Tex>{`S(\\mathrm{${trace.input}})=\\mathrm{${L(st["plug-in"].output)}},\\ E(\\mathrm{${L(st["plug-in"].output)}})=\\mathrm{${L(st["plug-out"].input)}},\\ S(\\mathrm{${L(st["plug-out"].input)}})=\\mathrm{${trace.output}}`}</Tex>
            </p>
          )}
        </Beat>
        <Beat kind="wall" tag={zh ? "留下的破绽" : "The mark it leaves"}>
          {zh ? (
            <>
              这个数字看上去无法穷举，但结构有弱点：<Tex>{"S"}</Tex> 是对合，两边作用一次就变成 <Tex>{"S(c)=E_i(S(p))"}</Tex>。巨大的未知量被拆成了“每个字母插到哪”，可以一个字母一个字母地推理。
            </>
          ) : (
            <>
              The number looks unsearchable, but its structure is weak: <Tex>{"S"}</Tex> is an involution, so applying it to both sides gives <Tex>{"S(c)=E_i(S(p))"}</Tex>. The huge unknown splits into “where is each letter plugged”, which can be reasoned about one letter at a time.
            </>
          )}
        </Beat>
      </Chapter>

      <Chapter n={5} title={zh ? "设计决定与破译的对应" : "Design choices and how they were used"}>
        <table className="ledger">
          <thead>
            <tr>
              <th>{zh ? "设计" : "Design"}</th>
              <th>{zh ? "副作用" : "Side effect"}</th>
              <th>{zh ? "破译如何利用" : "How it was used"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{zh ? "反射器" : "Reflector"}</td>
              <td>{zh ? "字母不自映射" : "No letter maps to itself"}</td>
              <td>{zh ? "拖动猜词" : "Crib dragging"}</td>
            </tr>
            <tr>
              <td>{zh ? "插线成对互换" : "Plugs swap in pairs"}</td>
              <td>
                <Tex>{"S(c)=E_i(S(p))"}</Tex>
              </td>
              <td>{zh ? "菜单与闭环" : "Menus and loops"}</td>
            </tr>
            <tr>
              <td>{zh ? "环只改变差值" : "Rings only shift a difference"}</td>
              <td>
                <Tex>{"k=p-r"}</Tex>
              </td>
              <td>{zh ? "搜索时不管环" : "Ignore rings while searching"}</td>
            </tr>
            <tr>
              <td>{zh ? "左、中转子很少动" : "Left and middle rarely move"}</td>
              <td>{zh ? "短段内只有右转子走" : "Only the right steps in a short run"}</td>
              <td>{zh ? "滚筒偏移 i 格" : "Drums offset by i"}</td>
            </tr>
            <tr>
              <td>{zh ? "格式固定的报告" : "Fixed report formats"}</td>
              <td>{zh ? "可猜的明文" : "Guessable plaintext"}</td>
              <td>{zh ? "猜词来源" : "Source of cribs"}</td>
            </tr>
          </tbody>
        </table>
        <p className="prose">
          <a className="link" href="#bombe">
            {zh ? "到 Bombe 看这些破绽怎样被一步步用上" : "See on the Bombe how each weakness was used"}
          </a>
        </p>
      </Chapter>
    </>
  );
}
