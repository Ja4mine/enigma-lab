import { tx } from "../../i18n";
import type { PartMeta, Step } from "../../engine/Exhibit";

export const BOMBE_PARTS: PartMeta[] = [
  {
    id: "bombe",
    number: "B-00",
    name: tx("Turing–Welchman Bombe", "Turing–Welchman Bombe"),
    german: "British Tabulating Machine Co., 1940–45",
    summary: tx(
      "英国在 Bletchley Park 用来恢复恩尼格玛每日密钥的机电装置。正面 108 个滚筒组成 36 台“没有插线板的恩尼格玛”，按猜词得到的菜单用电缆连起来，自动转过全部 17,576 个位置，寻找不会产生矛盾的那一个。",
      "The electromechanical machine Bletchley Park used to recover Enigma daily keys. Its 108 front drums form 36 Enigmas without plugboards; cabled together after a crib's menu, they turn through all 17,576 positions looking for the one that does not lead to a contradiction.",
    ),
    role: tx(
      "它不去猜插线板。它测试“插线板必须满足什么”：S(c) = Eᵢ(S(p))。矛盾就是电流流遍全部 26 根线。",
      "It does not guess the plugboard. It tests what the plugboard must satisfy, S(c) = Eᵢ(S(p)); a contradiction shows up as current reaching all 26 wires.",
    ),
    material: tx("钢架、胶木与黄铜滚筒、继电器", "Steel frame, bakelite and brass drums, relays"),
    specs: [
      { k: tx("外形", "Size"), v: tx("约 2.1 × 2.0 × 0.6 m，约 1 吨", "≈ 2.1 × 2.0 × 0.6 m, about a ton") },
      { k: tx("滚筒", "Drums"), v: tx("108 个 = 3 组 × 12 列 × 3 层", "108 = 3 banks × 12 columns × 3 rows") },
      { k: tx("一次运行", "One run"), v: tx("一种转子排列的 17,576 个位置", "17,576 positions of one wheel order") },
      { k: tx("耗时", "Time"), v: tx("约 10–20 分钟／次", "≈ 10–20 minutes per run") },
      { k: tx("建造数量", "Built"), v: tx("战争结束时约 200 台", "about 200 by the end of the war") },
    ],
    features: [
      { id: "drums", label: tx("滚筒组（36 台恩尼格玛）", "Drum banks (36 Enigmas)") },
      { id: "indicator", label: tx("指示器与测试寄存器", "Indicator & test register") },
      { id: "switches", label: tx("启停开关", "Start / stop") },
      { id: "reflectors", label: tx("反射器接线板", "Reflector boards") },
    ],
    view: [0.3, 0.18, 1],
  },
  {
    id: "drums",
    parent: "bombe",
    number: "B-01",
    name: tx("滚筒组", "Drum banks"),
    summary: tx(
      "三组，每组 12 个竖排的三联滚筒。每个三联就是一台恩尼格玛：上层对应左转子，中层对应中转子，下层对应右转子。",
      "Three banks of 12 vertical drum triples. Each triple is one Enigma: the top drum stands for the left rotor, the middle for the middle, the bottom for the right.",
    ),
    role: tx(
      "菜单的第 i 条连线对应一台恩尼格玛，它的下层滚筒比基准位置多转 i 格——这就是 Eᵢ。",
      "Menu link i gets its own Enigma whose bottom drum is set i places ahead of the common position: that is Eᵢ.",
    ),
    specs: [
      { k: tx("颜色", "Colours"), v: tx("I 红 · II 栗 · III 绿 · IV 黄 · V 棕", "I red · II maroon · III green · IV yellow · V brown") },
      { k: tx("转速", "Speed"), v: tx("上层最快（早期约 50 rpm，后期 120 rpm）", "Top fastest (≈ 50 rpm early, 120 rpm later)") },
    ],
    features: [
      { id: "top", label: tx("上层 = 左转子（最快）", "Top = left rotor (fastest)") },
      { id: "middle", label: tx("中层 = 中转子", "Middle = middle rotor") },
      { id: "bottom", label: tx("下层 = 右转子（偏移 i）", "Bottom = right rotor (offset i)") },
    ],
  },
  {
    id: "drum",
    parent: "drums",
    number: "B-01.1",
    name: tx("滚筒", "Drum"),
    summary: tx(
      "一个滚筒复制一枚恩尼格玛转子的接线，而且复制了两遍：一套给去程，一套给回程。背面 104 根钢丝刷分成 4 圈，压在机器正面的固定触点上。",
      "A drum copies one Enigma rotor's wiring twice: once for the outward path and once for the return. 104 wire brushes in four rings on its back press on fixed studs in the machine face.",
    ),
    role: tx(
      "两套接线让三联滚筒成为“双端”扰频器：电流可以从任一端进、另一端出，正好对应 Eᵢ 是对合。",
      "The double wiring makes a triple a double-ended scrambler: current may enter either end and leave the other, matching the fact that Eᵢ is an involution.",
    ),
    material: tx("胶木、黄铜、钢丝刷", "Bakelite, brass, steel brushes"),
    features: [
      { id: "face", label: tx("字母面 A–Z", "Letter face A–Z") },
      { id: "outer", label: tx("外圈 ↔ 第三圈：去程接线", "Outer ↔ third ring: outward wiring") },
      { id: "inner", label: tx("内圈 ↔ 第二圈：回程接线", "Inner ↔ second ring: return wiring") },
      { id: "brushes", label: tx("钢丝刷 4 × 26", "Brushes 4 × 26") },
      { id: "clip", label: tx("弹簧卡扣", "Spring clip") },
    ],
    view: [0.55, 0.25, 1],
  },
  {
    id: "drum-cap",
    parent: "drum",
    number: "B-01.1.1",
    name: tx("字母面盖", "Letter face"),
    summary: tx("刻 A–Z 的面盖；顶端读数就是这个滚筒此刻的位置。", "Face lettered A–Z; the letter at the top is the drum's current position."),
  },
  {
    id: "drum-body",
    parent: "drum",
    number: "B-01.1.2",
    name: tx("滚筒体与接线", "Drum body & wiring"),
    summary: tx("颜色标示所模拟的转子型号；内部是两套各 26 根的接线。", "Its colour names the rotor it imitates; inside are two sets of 26 wires."),
  },
  {
    id: "drum-brushes",
    parent: "drum",
    number: "B-01.1.3",
    name: tx("钢丝刷", "Wire brushes"),
    summary: tx("4 圈 × 26 根，滚筒转动时依次扫过机器面上的触点。", "Four rings of 26; as the drum turns they sweep over the studs in the machine face."),
  },
  {
    id: "drum-hub",
    parent: "drum",
    number: "B-01.1.4",
    name: tx("轴套与弹簧卡扣", "Hub & spring clip"),
    summary: tx("把滚筒卡在驱动轴上；换转子排列时整批取下、换装。", "Locks the drum on its driven spindle; a change of wheel order means swapping drums by hand."),
  },
  {
    id: "commutator",
    parent: "bombe",
    number: "B-02",
    name: tx("换向器触点", "Commutator studs"),
    summary: tx("每个滚筒位置后面有 104 个固定触点，分 4 圈；它们把滚筒连到背面的接线插孔。", "Behind every drum position sit 104 fixed studs in four rings, connecting the drum to the jacks at the back."),
    material: tx("黄铜", "Brass"),
  },
  {
    id: "indicator",
    parent: "bombe",
    number: "B-03",
    name: tx("指示器与测试寄存器", "Indicator & test register"),
    summary: tx(
      "停机时，指示滚筒显示三层滚筒的位置，测试寄存器显示输入字母那一组 26 根线哪些带电。",
      "At a stop the indicator drums show the three drum positions, and the test register shows which of the input letter's 26 wires carry current.",
    ),
    role: tx(
      "只有 1 根带电：所注入的假设成立；25 根带电：没电的那一根就是插线；26 根全带电：矛盾，不停机。",
      "One live wire: the injected hypothesis holds. 25 live: the dead wire is the stecker. All 26 live: contradiction, no stop.",
    ),
    features: [
      { id: "drums", label: tx("指示滚筒（上 · 中 · 下）", "Indicator drums (top · middle · bottom)") },
      { id: "register", label: tx("测试寄存器 26 线", "Test register, 26 wires") },
    ],
  },
  {
    id: "gate",
    parent: "bombe",
    number: "B-04",
    name: tx("背面接线门", "Rear gate"),
    summary: tx(
      "铰接在背面的大门，排着 9 列插孔：每 3 列一组，依次是对角板、公共接点（commons）和滚筒接口。菜单就用 26 芯电缆插在这里。",
      "A hinged frame at the back carrying nine columns of jacks in groups of three: diagonal board, commons, and drum connections. The menu is plugged here with 26-way cables.",
    ),
    features: [
      { id: "diagonal", label: tx("对角板插孔", "Diagonal board jacks") },
      { id: "commons", label: tx("公共接点", "Commons") },
      { id: "enigmas", label: tx("滚筒接口 1–36", "Drum connections 1–36") },
    ],
    view: [0.25, 0.2, -1],
  },
  {
    id: "diagonal-board",
    parent: "gate",
    number: "B-04.1",
    name: tx("对角板", "Diagonal board"),
    german: "Gordon Welchman, 1940",
    summary: tx(
      "26 个插孔、每孔 26 个触点，永久地把“字母 a 组的第 b 根线”和“字母 b 组的第 a 根线”接在一起。",
      "26 jacks of 26 contacts, permanently joining wire b of letter a's bundle to wire a of letter b's bundle.",
    ),
    role: tx(
      "它利用插线板的对称性：若 S(a) = b，则 S(b) = a。一个假设的推论因此能跳到菜单之外的字母，再跳回来，矛盾来得快得多。",
      "It encodes the plugboard's symmetry, S(a) = b ⇒ S(b) = a. Consequences of a hypothesis can leave the menu and come back, so contradictions arrive far sooner.",
    ),
  },
  {
    id: "relays",
    parent: "bombe",
    number: "B-05",
    name: tx("感应继电器", "Sense relays"),
    summary: tx(
      "104 个继电器监视测试寄存器的 26 根线。只要有一根线没电（不是全部 26 根都通），机器就停下来。",
      "104 relays watch the test register's 26 wires. If any wire stays dead — anything short of all 26 — the machine stops.",
    ),
  },
  {
    id: "cables",
    parent: "bombe",
    number: "B-06",
    name: tx("菜单电缆", "Menu cables"),
    summary: tx("26 芯电缆。每根把一台恩尼格玛的一端接到某个字母的公共接点上：菜单图的边在这里变成真实的导线。", "26-way cables. Each joins one end of an Enigma to a letter's common: the menu's edges become real wires here."),
  },
];

export const BOMBE_STEPS: Step[] = [
  {
    id: "drum-off",
    title: tx("取下一个滚筒", "Take a drum off"),
    caption: tx("滚筒只是卡在驱动轴上。取下后，机器正面露出 4 圈 × 26 个触点。", "A drum is simply clipped to its spindle. Off it comes, revealing four rings of 26 studs in the machine face."),
    moves: [{ part: "drum", offset: [0, -6, 34] }],
    view: { dir: [0.55, 0.15, 1], focus: "drum", fill: 0.3 },
  },
  {
    id: "drum-apart",
    title: tx("分解滚筒", "Take the drum apart"),
    caption: tx("两套接线：外圈↔第三圈是去程，内圈↔第二圈是回程。所以电流可以从三联的任一端进出。", "Two wirings: outer↔third ring for the way out, inner↔second ring for the way back, so current can enter a triple from either end."),
    moves: [
      { part: "drum-cap", offset: [0, 0, 9] },
      { part: "drum-hub", offset: [0, 0, 17] },
      { part: "drum-brushes", offset: [0, 0, -8] },
    ],
    xray: ["drum-body"],
    view: { dir: [0.75, 0.3, 0.8], focus: "drum", fill: 0.55 },
  },
  {
    id: "rear",
    title: tx("转到背面", "Walk round to the back"),
    caption: tx("背面的大门上是 9 列插孔：对角板、公共接点、滚筒接口，各三列。", "The rear gate carries nine columns of jacks: diagonal board, commons and drum connections, three of each."),
    moves: [],
    view: { dir: [0.35, 0.2, -1], focus: "gate", fill: 0.72 },
  },
  {
    id: "gate-open",
    title: tx("打开背门", "Open the gate"),
    caption: tx("门后是感应继电器架：它们只关心一件事——测试寄存器的 26 根线是否全都带电。", "Behind it stand the sense relays. They watch one thing: whether all 26 wires of the test register are live."),
    moves: [{ part: "gate", rotate: [0, 1.75, 0] }],
    view: { dir: [-0.15, 0.25, -1], focus: "relays", fill: 0.6 },
  },
  {
    id: "indicator",
    title: tx("看指示器", "Read the indicator"),
    caption: tx("停机时读三个指示滚筒和测试寄存器，记下一次“停机”，再按启动继续。", "At a stop, read the three indicator drums and the test register, write the stop down, and press start again."),
    moves: [],
    view: { dir: [0.45, 0.1, 1], focus: "indicator", fill: 0.6 },
  },
];
