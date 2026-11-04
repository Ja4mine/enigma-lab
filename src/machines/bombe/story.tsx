import type { Menu } from "../../core/bombe";
import { ALPHABET } from "../../core/enigma";
import type { Scenario } from "../../core/scenario";
import { Beat, Tex, TexBlock } from "../../ui/Explain";

const L = (n: number) => ALPHABET[n];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function walkCaption(walk: number, zh: boolean) {
  return [
    { title: zh ? "一份截获的电文" : "One intercepted message", text: zh ? "你手上只有这串字母。右边从这里出发，一步步想。" : "All you hold is this string of letters. Start reasoning on the right." },
    { title: zh ? "猜词，并把它拖到合适的位置" : "A crib, dragged into place", text: zh ? "同字母相对的位置一定是错的。" : "Any position with a letter over itself must be wrong." },
    { title: zh ? "沿着字母对往下推" : "Reason along the letter pairs", text: zh ? "选一个位置和一个猜测，看它会不会自己撞车。" : "Choose a position and a guess, and see whether it clashes with itself." },
    { title: zh ? "闭环：插线板从等式里消失" : "Loops: the plugboard leaves the equation", text: zh ? "绕一圈回到起点，方程里只剩一个字母未知。" : "Go round and back to the start: only one unknown letter is left." },
    { title: zh ? "把推理接成电路" : "Wire the reasoning", text: zh ? "背门上的电缆就是菜单：每条边一台三联滚筒，每个字母一束 26 根线。" : "The cables on the rear gate are the menu: an edge is a drum triple, a letter a bundle of 26 wires." },
    { title: zh ? "一次通电，测完 26 个假设" : "One pulse tests all 26 guesses", text: zh ? "每一格是一条假设：第 a 行第 b 列 = S(a) = b。" : "Each cell is a hypothesis: row a, column b means S(a) = b." },
    { title: zh ? "还有一条信息没用上" : "One fact still unused", text: zh ? "S(a) = b 和 S(b) = a 同真同假。" : "S(a) = b and S(b) = a are true together." },
    { title: zh ? "运行与停机" : "Run and stops", text: zh ? "每个停机的位置都值得人工核对。" : "Every position where it stops is worth checking by hand." },
    { title: zh ? "核对与解密" : "Check and read", text: zh ? "从停机读出插线，再把全文译出来。" : "Read the steckers from the stop, then decipher the whole message." },
  ][walk];
}

/** Reasoning for each step, in the order the argument actually forces. */
export function BombeStory({
  step,
  zh,
  scenario,
  menu,
  crashFree,
  noDiagonalStops,
}: {
  step: number;
  zh: boolean;
  scenario: Scenario;
  menu: Menu;
  crashFree: number;
  noDiagonalStops: { total: number; oneDead: number } | null;
}) {
  const n = scenario.crib.length;
  const candidates = scenario.ciphertext.length - n + 1;
  const noCrash = (25 / 26) ** n;
  const e = L(menu.input);
  if (step === 0)
    return (
      <>
        <Beat kind="ask">
          {zh ? "你截获了一份电文，不知道当天的密钥。怎么读出它？" : "You have intercepted a message and do not know the day's key. How do you read it?"}
        </Beat>
        <Beat kind="try">
          {zh ? "把每一把钥匙都试一遍。钥匙总数是" : "Try every key. The number of keys is"}
          <TexBlock>{"\\underbrace{60}_{\\text{排列}}\\times\\underbrace{26^3}_{\\text{位置}}\\times\\underbrace{26^2}_{\\text{环}}\\times\\underbrace{1.5\\times10^{14}}_{\\text{插线}}\\approx 1.07\\times10^{23}".replace("排列", zh ? "排列" : "orders").replace("位置", zh ? "位置" : "starts").replace("环", zh ? "环" : "rings").replace("插线", zh ? "插线" : "plugs")}</TexBlock>
        </Beat>
        <Beat kind="wall">
          {zh ? "就算每秒试一百万把，也要约 34 亿年。枚举整个密钥是不可能的。" : "Even at a million keys a second that takes about 3.4 billion years. Enumerating whole keys is hopeless."}
        </Beat>
        <Beat kind="idea">
          {zh ? (
            <>
              看这个积的结构。环设置只通过差 <Tex>{"k=p-r"}</Tex> 起作用，所以转子这边真正要区分的只有 <Tex>{"60\\times 26^3\\approx 10^6"}</Tex> 种状态。其余的 <Tex>{"1.5\\times10^{14}"}</Tex> 几乎全来自插线板。
            </>
          ) : (
            <>
              Look at the shape of that product. Rings act only through the difference <Tex>{"k=p-r"}</Tex>, so the rotors really have just <Tex>{"60\\times 26^3\\approx 10^6"}</Tex> distinct states. The remaining <Tex>{"1.5\\times10^{14}"}</Tex> comes almost entirely from the plugboard.
            </>
          )}
        </Beat>
        <Beat kind="so">
          {zh
            ? "目标变得很具体：能不能找到一个判据，不知道插线板也能判断某个转子状态对不对？如果有，10⁶ 种状态一台机器就能跑完。"
            : "The goal is now precise: find a test that judges a rotor state without knowing the plugboard. With one, a machine can get through 10⁶ states."}
        </Beat>
        <Beat kind="wall" tag={zh ? "还差什么" : "What's missing"}>
          {zh
            ? "只看密文做不到。任何转子状态解出来都是一串乱码，没有可比较的东西。我们需要一点明文。"
            : "Ciphertext alone cannot do it. Every rotor state just gives gibberish, with nothing to compare against. We need some plaintext."}
        </Beat>
      </>
    );
  if (step === 1)
    return (
      <>
        <Beat kind="ask">{zh ? "明文从哪里来？" : "Where can plaintext come from?"}</Beat>
        <Beat kind="idea">
          {zh
            ? `从德军的习惯来。气象站每天发格式固定的报告，几乎一定含有 ${scenario.crib}（天气预报）。这种猜出来的明文叫“猜词”（crib）。`
            : `From German habit. Weather stations sent rigidly formatted reports each day, almost certain to contain ${scenario.crib} (weather forecast). A guessed piece of plaintext is called a crib.`}
        </Beat>
        <Beat kind="wall">
          {zh
            ? `可是不知道它在第几位。这份电文有 ${candidates} 个可能的位置，每个位置都要搜 10⁶ 种转子状态，代价又变回来了。`
            : `But we don't know where it sits. This message has ${candidates} possible places, each needing 10⁶ rotor states, so the cost is back.`}
        </Beat>
        <Beat kind="idea">
          {zh ? (
            <>
              恩尼格玛自己帮了忙。反射器让它有一条硬规则：字母永远不会加密成自己，<Tex>{"C_i(x)\\neq x"}</Tex>。所以把猜词放在密文下面，只要某一列上下字母相同，这个位置就一定错。
            </>
          ) : (
            <>
              Enigma itself helps. Its reflector imposes a hard rule: no letter ever enciphers to itself, <Tex>{"C_i(x)\\neq x"}</Tex>. Lay the crib under the ciphertext: any column with a letter over itself proves that position wrong.
            </>
          )}
        </Beat>
        <Beat kind="work">
          {zh ? (
            <>
              错误位置上，每一列约有 <Tex>{"1/26"}</Tex> 的机会撞上同字母。{n} 个字母都躲开的概率是 <Tex>{`(25/26)^{${n}}\\approx ${noCrash.toFixed(2)}`}</Tex>，也就是说大约 {pct(1 - noCrash)} 的错误位置会被排除。这份电文里，{candidates} 个位置还剩 {crashFree} 个。
            </>
          ) : (
            <>
              At a wrong position each column has about a <Tex>{"1/26"}</Tex> chance of a match. All {n} letters avoid it with probability <Tex>{`(25/26)^{${n}}\\approx ${noCrash.toFixed(2)}`}</Tex>, so about {pct(1 - noCrash)} of wrong positions fall away. In this message {crashFree} of {candidates} positions remain.
            </>
          )}
        </Beat>
        <Beat kind="so">
          {zh
            ? "拖动只能排除，不能确认，剩下的位置要靠报告格式再筛。但只要位置选定，我们就得到了一批确定的字母对。接下来问：这些字母对怎么用？"
            : "Dragging only rules out, it never confirms; the report format narrows the rest. But once a position is chosen we hold a set of certain letter pairs. Next: how do we use them?"}
        </Beat>
      </>
    );
  if (step === 2)
    return (
      <>
        <Beat kind="ask">
          {zh ? `现在有 ${n} 对字母 (pᵢ, cᵢ)。怎么用它们检验一个转子状态？` : `We now hold ${n} letter pairs (pᵢ, cᵢ). How do they test a rotor state?`}
        </Beat>
        <Beat kind="try">
          {zh ? "最直接的写法是" : "The direct statement is"}
          <TexBlock>{"c_i = S\\,E_i\\,S\\,(p_i)"}</TexBlock>
          {zh ? (
            <>
              其中 <Tex>{"E_i"}</Tex> 是第 <Tex>{"i"}</Tex> 个字母时的转子组，选定转子状态就能算；<Tex>{"S"}</Tex> 是插线板。
            </>
          ) : (
            <>
              Here <Tex>{"E_i"}</Tex> is the scrambler at letter <Tex>{"i"}</Tex>, computable once a rotor state is chosen; <Tex>{"S"}</Tex> is the plugboard.
            </>
          )}
        </Beat>
        <Beat kind="wall">
          {zh
            ? "S 出现了两次，而且未知。一对字母单独看什么也判断不了：无论转子在哪，总有插线板能让这一个等式成立。"
            : "S appears twice and is unknown. One pair alone proves nothing: whatever the rotors do, some plugboard can satisfy a single equation."}
        </Beat>
        <Beat kind="idea">
          {zh ? (
            <>
              插线是成对互换的，所以 <Tex>{"S\\circ S=1"}</Tex>。两边各作用一次 <Tex>{"S"}</Tex>，等式变成
            </>
          ) : (
            <>
              Plugs swap letters in pairs, so <Tex>{"S\\circ S=1"}</Tex>. Apply <Tex>{"S"}</Tex> to both sides and the equation becomes
            </>
          )}
          <TexBlock>{"S(c_i) = E_i\\big(S(p_i)\\big)"}</TexBlock>
          {zh
            ? "读法变了：知道 p 插到哪，就能算出 c 插到哪。一个猜测能生出下一个结论。"
            : "It now reads differently: know where p is plugged and you can compute where c is plugged. One guess produces the next fact."}
        </Beat>
        <Beat kind="work">
          {zh
            ? `结论只有在字母再次出现时才有用：算出 S(c) 后，要找到另一对也含 c 的字母，才能继续。于是字母之间怎么相连决定了推理能走多远。把字母画成点、把每对字母画成边，这张路线图就是菜单。它有 ${menu.links.length} 条边、${menu.letters.length} 个字母。`
            : `A result is only useful if its letter appears again: after S(c) you need another pair containing c to go on. How letters connect decides how far reasoning reaches. Draw letters as points and pairs as edges: that road map is the menu, with ${menu.links.length} edges and ${menu.letters.length} letters.`}
        </Beat>
        <Beat kind="try" tag={zh ? "动手" : "Try it"}>
          {zh
            ? `在左边猜一个 S(${e})，点“推下一步”。在错误位置上，你很快会看到同一个字母被推出两个不同的值。`
            : `On the left, guess S(${e}) and press “Next deduction”. At a wrong position one letter soon gets forced to two different values.`}
        </Beat>
        <Beat kind="so">
          {zh
            ? "撞车说明假设错了，而我们全程没有用到插线板的任何信息。这就是要找的判据。下一步看撞车究竟发生在哪里。"
            : "A clash proves the guess wrong, and we never used anything about the plugboard. That is the test we wanted. Next: where exactly do clashes happen?"}
        </Beat>
      </>
    );
  if (step === 3)
    return (
      <>
        <Beat kind="ask">
          {zh ? "刚才的撞车都发生在什么地方？" : "Where did those clashes happen?"}
        </Beat>
        <Beat kind="idea">
          {zh
            ? "都发生在推理绕回一个已经有值的字母时。没有回路的路线只会不断产生新结论，永远不会自相矛盾。只有回路才能检验。所以菜单里最重要的东西是闭环。"
            : "Always where the reasoning came back to a letter that already had a value. A route without a cycle only yields new facts and can never contradict itself. Only cycles can test. So loops are what matters in a menu."}
        </Beat>
        <Beat kind="work">
          {zh ? "沿左边的闭环把等式连起来，就得到" : "Chain the equations round the loop on the left to get"}
          <TexBlock>{"x = \\Pi(x),\\qquad x=S(a),\\quad \\Pi = E_{i_k}\\cdots E_{i_2}E_{i_1}"}</TexBlock>
          {zh ? (
            <>
              <Tex>{"\\Pi"}</Tex> 完全由转子决定。方程里只剩一个未知字母 <Tex>{"x"}</Tex>，而且它必须是 <Tex>{"\\Pi"}</Tex> 的不动点。
            </>
          ) : (
            <>
              <Tex>{"\\Pi"}</Tex> depends only on the rotors. One unknown letter <Tex>{"x"}</Tex> remains, and it must be a fixed point of <Tex>{"\\Pi"}</Tex>.
            </>
          )}
        </Beat>
        <Beat kind="so" tag={zh ? "这就是“消掉插线板”" : "That is “eliminating the plugboard”"}>
          {zh ? (
            <>
              我们不再需要枚举 <Tex>{"1.5\\times10^{14}"}</Tex> 种插线，只需问 26 个字母里有哪个绕一圈不变。其余 9 根线是什么样，对这个方程毫无影响。
            </>
          ) : (
            <>
              No need to enumerate <Tex>{"1.5\\times10^{14}"}</Tex> plugboards: just ask which of 26 letters survives the trip. The other nine cables have no effect on this equation at all.
            </>
          )}
        </Beat>
        <Beat kind="work" tag={zh ? "能筛掉多少" : "How much it filters"}>
          {zh ? (
            <>
              错误位置上 <Tex>{"\\Pi"}</Tex> 像一个随机置换，平均只有 1 个不动点，所以一个闭环把 26 个假设大约砍到 1 个，相当于砍掉 <Tex>{"25/26"}</Tex>。<Tex>{"L"}</Tex> 个闭环同时要求时，整轮幸存的（位置，假设）大约是
            </>
          ) : (
            <>
              At a wrong position <Tex>{"\\Pi"}</Tex> behaves like a random permutation, with one fixed point on average, so one loop cuts the 26 guesses to about one. With <Tex>{"L"}</Tex> loops at once the surviving (position, guess) pairs per run number about
            </>
          )}
          <TexBlock>{`26^3\\cdot 26\\cdot 26^{-L} = 26^{4-L}`}</TexBlock>
          {zh
            ? `这个菜单有 ${menu.closures} 个闭环。闭环越多，幸存越少。这就是为什么要特意挑闭环多的猜词。`
            : `This menu has ${menu.closures} loops. More loops, fewer survivors, which is why cribs were chosen for their loops.`}
        </Beat>
        <Beat kind="wall" tag={zh ? "下一个问题" : "Next problem"}>
          {zh ? "原理通了，但这是手工算不完的。" : "The principle works, but nobody can do this by hand."}
        </Beat>
      </>
    );
  if (step === 4)
    return (
      <>
        <Beat kind="ask">{zh ? "这个工作量有多大？" : "How much work is this?"}</Beat>
        <Beat kind="work">
          {zh ? `一种转子排列：每个位置 26 个假设，每个假设最多沿 ${menu.links.length} 条边查表。` : `One wheel order: 26 guesses at each position, each following up to ${menu.links.length} edges.`}
          <TexBlock>{`26^3\\times 26\\times ${menu.links.length}\\times 60 \\approx ${(26 ** 4 * menu.links.length * 60 / 1e8).toFixed(1)}\\times10^{8}`}</TexBlock>
        </Beat>
        <Beat kind="wall">
          {zh ? "每次查表算 10 秒，一个人要做一百多年，而密钥每天都换。" : "At ten seconds a lookup that is over a century for one person, and the key changes daily."}
        </Beat>
        <Beat kind="idea">
          {zh ? (
            <>
              Turing 的关键想法：别模拟推理，让电流来做推理。转子组本来就是一张 26 进 26 出的电路，<Tex>{"E_i"}</Tex> 不需要算，接上线就行。
            </>
          ) : (
            <>
              Turing's key idea: don't simulate the reasoning, let electric current do it. A scrambler is already a circuit with 26 wires in and out, so <Tex>{"E_i"}</Tex> needn't be computed, only wired in.
            </>
          )}
        </Beat>
        <Beat kind="work" tag={zh ? "逐项对应" : "Term by term"}>
          <dl className="corr">
            <dt>{zh ? "“S(a) = b”这句话" : "The statement S(a) = b"}</dt>
            <dd>{zh ? "a 组 26 根线里的第 b 根带电" : "wire b of a's 26-wire bundle is live"}</dd>
            <dt>{zh ? "推论 S(c) = Eᵢ(S(p))" : "The deduction S(c) = Eᵢ(S(p))"}</dt>
            <dd>{zh ? "一台三联滚筒接在 p 组和 c 组之间" : "a drum triple between bundles p and c"}</dd>
            <dt>{zh ? "第 i 列的偏移" : "The offset of column i"}</dt>
            <dd>{zh ? "这台滚筒的下层多转 i 格" : "that triple's bottom drum set i places on"}</dd>
            <dt>{zh ? "菜单的边" : "A menu edge"}</dt>
            <dd>{zh ? "背门上的一根电缆连接" : "a cable connection on the rear gate"}</dd>
          </dl>
        </Beat>
        <Beat kind="so">
          {zh
            ? "菜单不再是一张纸，它就是接线图。电流以近乎瞬时的速度走完所有推论，机器只需要把滚筒转到下一个位置。"
            : "The menu stops being paper and becomes a wiring diagram. Current runs through every deduction almost instantly; the machine only has to turn the drums on."}
        </Beat>
      </>
    );
  if (step === 5)
    return (
      <>
        <Beat kind="ask">{zh ? "通上电之后，看到什么才算“撞车”？" : "Once powered, what does a clash look like?"}</Beat>
        <Beat kind="try">
          {zh
            ? `给 ${e} 组的一根线加电，相当于假设 S(${e}) 等于它。电流沿滚筒传开，亮起的每根线都是这个假设推出的结论。`
            : `Put voltage on one wire of bundle ${e}: that is the guess for S(${e}). Current spreads through the drums, and every wire it lights is something the guess forces.`}
        </Beat>
        <Beat kind="idea">
          {zh
            ? `如果 ${e} 组又亮了别的线，就等于 ${e} 同时插在两处，这不可能。而且由错误假设推出的新结论同样是错的，它们继续传播。一错到底：错误位置上 26 根线通常全部被点亮。`
            : `If another wire of bundle ${e} lights, ${e} would be plugged in two places at once, which is impossible. Facts forced by a false guess are false too, and they spread further. In a wrong position all 26 wires usually end up live.`}
        </Beat>
        <Beat kind="work" tag={zh ? "最漂亮的一点" : "The elegant part"}>
          {zh
            ? "真实位置上，真插线那根线和其余导线是分开的：错误假设的电流进不去。于是全亮以外的结果都有含义，只测一次就同时查完了 26 个假设。"
            : "At the true position the true stecker's wire is cut off from the rest, so current from a false guess can't reach it. Any result other than all-live therefore means something, and one test checks all 26 guesses at once."}
        </Beat>
        <Beat kind="so">
          {zh
            ? "判据变成一句话：只要测试寄存器不是 26 根全亮，机器就停下来。下面这组对照可以切换着看。"
            : "The test becomes one sentence: stop whenever the register is not fully live. Switch between the two cases below."}
        </Beat>
      </>
    );
  if (step === 6)
    return (
      <>
        <Beat kind="ask">{zh ? "这个判据够好吗？" : "Is that test good enough?"}</Beat>
        <Beat kind="wall">
          {zh
            ? `不够。在当前转子排列上完整跑一遍，不开对角板有 ${noDiagonalStops?.total ?? "…"} 次停机，其中 ${noDiagonalStops?.oneDead ?? "…"} 次是“只有 1 根没亮”。绝大多数都是错误位置上恰好有一根线电流到不了。每次停机都要人工核对，这样的量吃不消。`
            : `No. A full run of this wheel order without the diagonal board gives ${noDiagonalStops?.total ?? "…"} stops, ${noDiagonalStops?.oneDead ?? "…"} of them with exactly one dead wire. Nearly all are wrong positions where one wire merely wasn't reached. Each stop needs checking by hand, which is too many.`}
        </Beat>
        <Beat kind="ask" tag={zh ? "换个问法" : "Ask it differently"}>
          {zh ? "电路为什么漏掉那根线？是不是还有信息没用上？" : "Why did the circuit miss that wire? Is some information still unused?"}
        </Beat>
        <Beat kind="idea">
          {zh ? (
            <>
              有。插线是成对的：<Tex>{"S(a)=b \\iff S(b)=a"}</Tex>。这是我们消去 <Tex>{"S"}</Tex> 时用过的性质，但电路本身并不知道它。Gordon Welchman 想到把这条推理也接进去。
            </>
          ) : (
            <>
              Yes. Plugs come in pairs: <Tex>{"S(a)=b \\iff S(b)=a"}</Tex>. We used that to eliminate <Tex>{"S"}</Tex>, yet the circuit itself doesn't know it. Gordon Welchman's idea was to wire this inference in as well.
            </>
          )}
        </Beat>
        <Beat kind="work">
          {zh
            ? "做法极其简单：a 组第 b 根线和 b 组第 a 根线焊在一起。这块板就是对角板。这样电流可以从一个字母跳到另一个字母，走到本来走不到的线上。"
            : "The hardware is almost trivially simple: solder wire b of bundle a to wire a of bundle b. That panel is the diagonal board. Current can now hop between letters and reach wires it could not reach before."}
        </Beat>
        <Beat kind="so">
          {zh
            ? "左边同一次运行开关对角板，假停机几乎全部消失。第一台 Bombe“Victory”没有对角板；有了它，闭环较少的菜单也能用了。"
            : "On the left, the same run with the board on and off: the false stops almost all vanish. The first Bombe, “Victory”, had no diagonal board; with it, menus with fewer loops became usable."}
        </Beat>
      </>
    );
  if (step === 7)
    return (
      <>
        <Beat kind="ask">{zh ? "剩下的就是跑。要跑多少？" : "All that's left is to run it. How much running?"}</Beat>
        <Beat kind="work">
          {zh ? (
            <>
              一种转子排列要走完 <Tex>{"26^3=17{,}576"}</Tex> 个位置，原机约 10 分钟。60 种排列就是约 10 小时。这解释了 Bletchley Park 为什么需要很多台机器：密钥每天换，当天破出来才有价值。
            </>
          ) : (
            <>
              One wheel order means <Tex>{"26^3=17{,}576"}</Tex> positions, about 10 minutes on the original. Sixty orders is around 10 hours. That is why Bletchley Park needed many machines: keys changed daily, and a break only mattered that same day.
            </>
          )}
        </Beat>
        <Beat kind="work" tag={zh ? "一个假设" : "One assumption"}>
          {zh
            ? "机器假设猜词范围内中转子没有进位，否则第 i 列的状态就不再是右转子多走 i 格。真实菜单也接受这个风险。"
            : "The machine assumes the middle rotor doesn't step within the crib; otherwise column i is no longer just i places on the right rotor. Real menus accepted this risk too."}
        </Beat>
        <Beat kind="try" tag={zh ? "动手" : "Try it"}>
          {zh ? "按“运行”看滚筒转动，停机时指示器和测试寄存器会亮。" : "Press Run and watch the drums. At a stop the indicators and test register light up."}
        </Beat>
      </>
    );
  return (
    <>
      <Beat kind="ask">{zh ? "停机就是答案吗？" : "Is a stop the answer?"}</Beat>
      <Beat kind="wall">
        {zh ? "还不是。停机只说明这个位置通过了菜单的检验，可能只是巧合。" : "Not yet. A stop only says this position passed the menu's test, which may be coincidence."}
      </Beat>
      <Beat kind="idea">
        {zh
          ? "用停机给出的插线候选，沿菜单推出所有字母的插线，就像第 3 步那样手工推。任何字母被推出两个值，就是假停机。"
          : "Take the stecker candidate from the stop and follow the menu for every letter, by hand as in step 3. If any letter is forced to two values, the stop was false."}
      </Beat>
      <Beat kind="work" tag={zh ? "最后一块拼图" : "The last piece"}>
        {zh ? (
          <>
            Bombe 只找到了 <Tex>{"k=p-r"}</Tex>，分不清窗口和环。这在搜索时帮了大忙，现在要补回来：试不同的环设置，直到全文读得通。没被菜单覆盖的插线也在这时补齐。
          </>
        ) : (
          <>
            The Bombe found only <Tex>{"k=p-r"}</Tex> and cannot separate window from ring. That helped the search; now it must be repaid. Try ring settings until the whole text reads. Plugs not covered by the menu are filled in at this stage.
          </>
        )}
      </Beat>
      <Beat kind="so">
        {zh ? "第一个读得通的德文就是证明。全部推理到这里闭环了。" : "German that reads is the proof. The whole argument closes here."}
      </Beat>
    </>
  );
}
