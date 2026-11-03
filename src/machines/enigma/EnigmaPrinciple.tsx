import { ALPHABET, mod26, type KeyResult, type MachineConfig } from "../../core/enigma";
import { useLang } from "../../i18n";

const L = (n: number) => ALPHABET[mod26(n)];

/**
 * The cipher as permutation algebra, built up one layer at a time, with the
 * live numbers of the last key press substituted in.
 */
export function EnigmaPrinciple({ trace, config }: { trace: KeyResult | null; config: MachineConfig }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const st = trace ? Object.fromEntries(trace.stages.map((s) => [s.id, s])) : null;
  const k = trace ? trace.after.map((p, i) => mod26(p - config.rings[i])) : null;
  return (
    <>
      <div className="section">
        <div className="section-head">
          <h3>{zh ? "1　记号" : "1  Notation"}</h3>
        </div>
        <p className="prose">
          {zh
            ? "把字母 A…Z 记作 0…25（模 26 运算）。置换按函数复合书写，最右边的先作用。"
            : "Write the letters A…Z as 0…25 (arithmetic mod 26). Permutations compose like functions: the rightmost acts first."}
        </p>
        <dl className="symbols">
          <dt className="math">
            <i>ρ</i>
          </dt>
          <dd>{zh ? "循环移位 ρ(x) = x + 1，转子转一格就是一次 ρ。" : "Cyclic shift ρ(x) = x + 1; one rotor step is one ρ."}</dd>
          <dt className="math">
            <i>W</i>
          </dt>
          <dd>{zh ? "转子的固定接线（线芯触点 j 接到 W(j)）。" : "A rotor's fixed wiring (core contact j goes to W(j))."}</dd>
          <dt className="math">
            <i>p</i>, <i>r</i>
          </dt>
          <dd>{zh ? "窗口读数和环设置，都取 0…25。" : "Window reading and ring setting, both 0…25."}</dd>
        </dl>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>{zh ? "2　一枚转子" : "2  One rotor"}</h3>
        </div>
        <p className="prose">
          {zh
            ? "转子转到偏转 k = p − r 时，外部触点 x 对着线芯触点 x + k；电流沿导线到 W(x + k)，再从外部触点 W(x + k) − k 出来："
            : "At offset k = p − r the fixed contact x faces core contact x + k; the current follows the wire to W(x + k) and leaves at fixed contact W(x + k) − k:"}
        </p>
        <span className="math eq">
          <i>R</i>
          <sub>
            <i>k</i>
          </sub>{" "}
          = <i>ρ</i>
          <sup>−<i>k</i></sup> ∘ <i>W</i> ∘ <i>ρ</i>
          <sup>
            <i>k</i>
          </sup>
          ,　<i>k</i> = <i>p</i> − <i>r</i>
        </span>
        <p className="prose">
          {zh
            ? "环设置只出现在差 p − r 里：拨动环和拨动转子对导线来说是一回事。这正是 Bombe 可以不管环设置、只搜索 26³ 个偏转的原因。"
            : "The ring setting only appears in the difference p − r: turning the ring and turning the rotor look the same to the wiring. That is why the Bombe could ignore ring settings and search only the 26³ offsets."}
        </p>
        {trace && st && k && (
          <p className="note">
            {zh ? "本次击键" : "This key press"}: k = ({k.map(L).join(", ")}) ={" "}
            ({k.join(", ")}){zh ? "，例如右转子把 " : "; e.g. the right rotor takes "}
            {L(st["right-forward"].input)} {zh ? "经线芯 " : "via core "}
            {L(st["right-forward"].shiftedInput!)} → {L(st["right-forward"].wiredOutput!)}{" "}
            {zh ? "送到 " : "to "}
            {L(st["right-forward"].output)}.
          </p>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h3>{zh ? "3　转子组：对合、无不动点" : "3  The scrambler: an involution with no fixed point"}</h3>
        </div>
        <p className="prose">
          {zh
            ? "电流依次穿过右、中、左转子（R, M, L），在反射器 U 折返，再逆着原路穿回。第 i 次击键的转子组置换是"
            : "The current crosses the right, middle and left rotors (R, M, L), turns in the reflector U, and crosses back. At keystroke i the scrambler is"}
        </p>
        <span className="math eq">
          <i>E</i>
          <sub>
            <i>i</i>
          </sub>{" "}
          = <i>R</i>
          <sup>−1</sup>
          <i>M</i>
          <sup>−1</sup>
          <i>L</i>
          <sup>−1</sup> <i>U</i> <i>L M R</i> = <i>Q</i>
          <sup>−1</sup>
          <i>U Q</i>,　<i>Q</i> = <i>L M R</i>
        </span>
        <ol className="derive">
          <li>
            {zh
              ? "U 把 26 个触点连成 13 对，所以 U² = 1 且 U(x) ≠ x。"
              : "U joins the 26 contacts in 13 pairs, so U² = 1 and U(x) ≠ x."}
          </li>
          <li>
            {zh ? "共轭保持这两条性质：" : "Conjugation keeps both properties: "}
            <span className="math">
              <i>E</i>² = <i>Q</i>
              <sup>−1</sup>
              <i>U</i>²<i>Q</i> = 1
            </span>
            {zh ? "；若 E(x) = x，则 U(Qx) = Qx，矛盾。" : "; if E(x) = x then U(Qx) = Qx, a contradiction."}
          </li>
        </ol>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>{zh ? "4　加上插线板" : "4  Adding the plugboard"}</h3>
        </div>
        <span className="math eq">
          <i>C</i>
          <sub>
            <i>i</i>
          </sub>{" "}
          = <i>S</i> <i>E</i>
          <sub>
            <i>i</i>
          </sub>{" "}
          <i>S</i>,　<i>S</i> = <i>S</i>
          <sup>−1</sup>
        </span>
        <p className="prose">
          {zh
            ? "S 也是对合，所以 Cᵢ 仍是 Eᵢ 的共轭。两条后果直接决定了这台机器的命运："
            : "S is an involution too, so Cᵢ is again a conjugate of Eᵢ. Two consequences decided the machine's fate:"}
        </p>
        <ol className="derive">
          <li>
            <b>{zh ? "互逆：" : "Reciprocity: "}</b>
            {zh ? "Cᵢ = Cᵢ⁻¹，同一套设置下加密即解密，操作很方便。" : "Cᵢ = Cᵢ⁻¹, so the same setting enciphers and deciphers. Convenient."}
          </li>
          <li>
            <b>{zh ? "从不自映射：" : "Never to itself: "}</b>
            {zh
              ? "Cᵢ(x) ≠ x。猜到一段明文后，只要它与密文在某一位上字母相同，这个位置就不可能。"
              : "Cᵢ(x) ≠ x. Slide a guessed plaintext along the ciphertext: any position where a letter sits over itself is impossible."}
          </li>
          <li>
            <b>{zh ? "插线板能被“消掉”：" : "The plugboard can be eliminated: "}</b>
            {zh ? "由 c = S Eᵢ S(p) 得 " : "From c = S Eᵢ S(p) follows "}
            <span className="math">
              <i>S</i>(<i>c</i>) = <i>E</i>
              <sub>
                <i>i</i>
              </sub>
              (<i>S</i>(<i>p</i>))
            </span>
            {zh
              ? "。这条关系把未知量缩成“每个字母插到哪”，Bombe 就建立在它上面。"
              : ". The unknown shrinks to “where is each letter plugged”, and the Bombe is built on exactly this."}
          </li>
        </ol>
        {trace && st && (
          <p className="note">
            {zh ? "本次击键" : "This key press"}: S({trace.input}) = {L(st["plug-in"].output)}, E(
            {L(st["plug-in"].output)}) = {L(st["plug-out"].input)}, S({L(st["plug-out"].input)}) = {trace.output}
            {zh ? "；且 " : "; and "}
            {trace.output} ≠ {trace.input}.
          </p>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h3>{zh ? "5　步进规则" : "5  Stepping"}</h3>
        </div>
        <ol className="derive">
          <li>{zh ? "先步进，后通电：右转子每次都前进一格。" : "Step first, then encipher: the right rotor always advances."}</li>
          <li>
            {zh
              ? "右转子窗口正好在其进位字母（I–V 依次为 Q、E、V、J、Z）时，中转子随之前进。"
              : "When the right window shows its turnover letter (Q, E, V, J, Z for I–V), the middle rotor advances too."}
          </li>
          <li>
            {zh
              ? "中转子窗口在自己的进位字母时，中、左转子一起前进——中转子于是连走两次（双步进）。"
              : "When the middle window shows its own turnover letter, middle and left advance together, so the middle rotor moves on two consecutive keys (double step)."}
          </li>
        </ol>
        <p className="note">
          {zh
            ? "例：I–II–III 从窗口 A D U 开始连按三键：ADU → ADV → AEW → BFX。"
            : "Example: I–II–III from windows A D U, three keys: ADU → ADV → AEW → BFX."}
        </p>
      </div>
    </>
  );
}
