import { tx } from "../../i18n";
import type { PartMeta, Step } from "../../engine/Exhibit";

export type Slot = "l" | "m" | "r";
export const SLOTS: Slot[] = ["l", "m", "r"];
export const SLOT_INDEX: Record<Slot, 0 | 1 | 2> = { l: 0, m: 1, r: 2 };
const SLOT_NAME = {
  l: tx("左转子", "Left rotor"),
  m: tx("中转子", "Middle rotor"),
  r: tx("右转子", "Right rotor"),
};

/** Rotor parts are generated per slot so each can be inspected on its own. */
function rotorParts(slot: Slot, n: number): PartMeta[] {
  const id = `rotor-${slot}`;
  const role = {
    l: tx(
      "每当中转子走到缺口位置才前进一格，在一份电文里常常一动不动。",
      "Advances only when the middle rotor reaches its notch; it often stays put for a whole message.",
    ),
    m: tx(
      "被右转子的缺口带动，并会在自己的缺口处“双步进”：连同左转子一起再走一格。",
      "Carried by the right rotor's notch, and double-steps at its own notch, taking the left rotor with it.",
    ),
    r: tx(
      "每按一个键都先前进一格，然后电流才通过——所以同一个字母连按两次，得到的是两个不同的置换。",
      "Steps on every key press before current flows, so pressing the same letter twice uses two different permutations.",
    ),
  }[slot];
  return [
    {
      id,
      parent: "rotor-set",
      number: `E-04.${n}`,
      name: SLOT_NAME[slot],
      german: "Walze",
      summary: tx(
        "一个可转动的置换器：两侧各 26 个触点，内部 26 根导线把它们一一接通。转子的型号决定接线，转到的位置决定此刻哪两个触点相对。",
        "A rotating permutation: 26 contacts on each face joined one-to-one by 26 internal wires. The rotor type fixes the wiring; its turning position decides which contacts meet right now.",
      ),
      role,
      material: tx("胶木线芯、铝制数字环、钢制棘轮、黄铜触点", "Bakelite core, aluminium index ring, steel ratchet, brass contacts"),
      features: [
        { id: "thumb", label: tx("拇指轮", "Thumbwheel"), note: tx("从护盖槽口伸出，用手拨到当天的起始位置。", "Protrudes through the cover slot so the start position can be set by hand.") },
        { id: "ring", label: tx("数字环 01–26", "Index ring 01–26"), note: tx("读数窗显示的数字，就是这一圈上的刻字。", "The number seen in the window is engraved on this tyre.") },
        { id: "clip", label: tx("环设置卡销", "Ring clip"), note: tx("拔起卡销即可让数字环相对线芯转动——这就是环设置。", "Lift it and the ring turns relative to the core: the ring setting.") },
        { id: "notch", label: tx("进位缺口", "Turnover notch"), note: tx("缺口固定在数字环上，所以进位时窗口显示的字母与环设置无关。", "Fixed to the ring, so the window letter at turnover does not depend on the ring setting.") },
        { id: "pins", label: tx("弹簧触针 ×26", "Spring pins ×26") },
        { id: "plates", label: tx("平面触点 ×26", "Flat contacts ×26") },
        { id: "ratchet", label: tx("棘轮 26 齿", "26-tooth ratchet") },
      ],
      view: [0.55, 0.35, 1],
    },
    {
      id: `${id}-thumb`,
      parent: id,
      number: `E-04.${n}.1`,
      name: tx("拇指轮", "Thumbwheel"),
      german: "Griffrad",
      summary: tx("带滚花的拨轮，与线芯连成一体。合上转子盖后仍从槽口露出一点，操作员靠它拨出当天的起始位置。", "Knurled finger wheel fixed to the core. It still shows through the slot when the cover is shut, so the operator can dial the start position."),
      role: tx("只用于手动设置，不参与电路。", "Manual setting only; not part of the circuit."),
      material: tx("钢", "Steel"),
    },
    {
      id: `${id}-ring`,
      parent: id,
      number: `E-04.${n}.2`,
      name: tx("数字环（环设置）", "Index ring (Ringstellung)"),
      german: "Ziffernring",
      summary: tx("刻有 01–26 的外圈。它能相对线芯转动并用卡销锁定，进位缺口也装在它上面。", "Outer tyre engraved 01–26. It can turn relative to the core and lock with a clip; the turnover notch is mounted on it."),
      role: tx(
        "环设置 r 改变的是“窗口读数 p”与“线芯实际偏转 p − r”之间的差。导线只认 p − r，所以 Bombe 搜索时可以完全不管环设置。",
        "The ring setting r separates the window reading p from the core's real offset p − r. The wiring only sees p − r, which is why the Bombe could ignore ring settings entirely.",
      ),
      material: tx("铝，刻字后填黑", "Aluminium, engraved and blackened"),
      features: [
        { id: "clip", label: tx("环设置卡销", "Ring clip") },
        { id: "notch", label: tx("进位缺口", "Turnover notch") },
        { id: "label", label: tx("窗口读数", "Window reading") },
      ],
    },
    {
      id: `${id}-core`,
      parent: id,
      number: `E-04.${n}.3`,
      name: tx("线芯", "Wiring core"),
      german: "Walzenkörper",
      summary: tx("胶木圆盘，一面是 26 根弹簧触针，另一面是 26 个平面触点，内部 26 根导线把它们交叉相连。转子的“秘密”就是这组接线。", "Bakelite disc with 26 spring pins on one face and 26 flat contacts on the other, cross-connected by 26 internal wires. That wiring is the rotor's secret."),
      role: tx("实现固定置换 W；转到偏转 k 时，整个转子相当于 ρ⁻ᵏ·W·ρᵏ。", "Implements the fixed permutation W; at offset k the rotor acts as ρ⁻ᵏ·W·ρᵏ."),
      material: tx("胶木、黄铜触点、漆包铜线", "Bakelite, brass contacts, enamelled copper wire"),
      features: [
        { id: "pins", label: tx("弹簧触针", "Spring pins") },
        { id: "plates", label: tx("平面触点", "Flat contacts") },
        { id: "wires", label: tx("内部导线 ×26", "Internal wires ×26") },
      ],
    },
    {
      id: `${id}-ratchet`,
      parent: id,
      number: `E-04.${n}.4`,
      name: tx("棘轮", "Ratchet wheel"),
      german: "Schaltrad",
      summary: tx("26 齿的不对称齿轮，与线芯固定。按键时棘爪推动它，转子正好前进一格。", "Asymmetric 26-tooth wheel fixed to the core. On each key press a pawl pushes it exactly one tooth."),
      material: tx("钢", "Steel"),
    },
    {
      id: `${id}-hub`,
      parent: id,
      number: `E-04.${n}.5`,
      name: tx("轴套", "Hub bush"),
      summary: tx("套在转子轴上的黄铜衬套。", "Brass bush that rides on the spindle."),
      material: tx("黄铜", "Brass"),
    },
  ];
}

export const ENIGMA_PARTS: PartMeta[] = [
  {
    id: "enigma",
    number: "E-00",
    name: tx("恩尼格玛 I 型", "Enigma I"),
    german: "Chiffriermaschine Enigma I",
    summary: tx(
      "德国陆军与空军在二战中使用的机电转子密码机。按下一个键：转子先步进，然后电路闭合，电流经插线板、三枚转子、反射器再原路折返，点亮一盏灯。",
      "Electromechanical rotor cipher machine of the German Army and Air Force. Press a key: the rotors step, then a circuit closes through plugboard, three rotors and reflector and back, lighting one lamp.",
    ),
    role: tx(
      "第 i 次击键实现置换 Cᵢ = S·Eᵢ·S。S 是插线板，Eᵢ 是随每次击键变化的转子组置换。",
      "Keystroke i applies the permutation Cᵢ = S·Eᵢ·S, where S is the plugboard and Eᵢ the rotor scrambler that changes with every keystroke.",
    ),
    material: tx("橡木运输箱、压铸轻合金机架", "Oak transport case, die-cast light-alloy chassis"),
    specs: [
      { k: tx("外形", "Size"), v: tx("约 34 × 28 × 15 cm", "≈ 34 × 28 × 15 cm") },
      { k: tx("电源", "Power"), v: tx("4.5 V 电池", "4.5 V battery") },
      { k: tx("转子", "Rotors"), v: tx("I–V 中选 3 枚，共 60 种排列", "3 of I–V, 60 orders") },
      { k: tx("反射器", "Reflector"), v: tx("UKW-B（亦有 C）", "UKW-B (also C)") },
      { k: tx("插线", "Plug cables"), v: tx("战时常用 10 根（最多 13）", "10 in wartime use (13 max)") },
    ],
    features: [
      { id: "rotors", label: tx("转子盖与读数窗", "Rotor cover & windows") },
      { id: "lamps", label: tx("灯板", "Lampboard") },
      { id: "keys", label: tx("键盘", "Keyboard") },
      { id: "plugs", label: tx("插线板（前翻板后）", "Plugboard (behind flap)") },
      { id: "lid", label: tx("箱盖", "Lid") },
    ],
    view: [0.35, 0.75, 1],
  },
  {
    id: "case",
    parent: "enigma",
    number: "E-01",
    name: tx("运输木箱", "Transport case"),
    german: "Holzkasten",
    summary: tx("橡木箱体，机器用四颗螺栓固定在箱底。箱盖向后打开，前翻板向下打开即可接近插线板。", "Oak case; the machine is bolted to its floor with four bolts. The lid opens backwards and the front flap folds down to reach the plugboard."),
    role: tx("前翻板必须合上才能使用：它压住插头，防止插头松脱让短路片误触、同时点亮几盏灯。", "The front flap must be shut in use: it keeps the plugs seated, otherwise a loose plug lets the shorting bar touch and several lamps light at once."),
    material: tx("橡木，表面贴皮", "Oak, veneered faces"),
    features: [
      { id: "lid", label: tx("箱盖", "Lid") },
      { id: "flap", label: tx("前翻板", "Front flap") },
      { id: "body", label: tx("箱体", "Case body") },
    ],
  },
  {
    id: "lid",
    parent: "case",
    number: "E-01.1",
    name: tx("箱盖", "Lid"),
    german: "Deckel",
    summary: tx("内侧收纳备用灯泡（45° 斜插）、两根备用插线、绿色滤光片和使用说明。", "Holds spare bulbs (set at 45°), two spare plug cables, the green contrast filter and the operating notes."),
    material: tx("橡木、毡衬", "Oak, felt lining"),
    features: [
      { id: "bulbs", label: tx("备用灯泡", "Spare bulbs") },
      { id: "cables", label: tx("备用插线", "Spare cables") },
      { id: "notes", label: tx("说明牌", "Instruction plate") },
    ],
  },
  {
    id: "flap",
    parent: "case",
    number: "E-01.2",
    name: tx("前翻板", "Front flap"),
    german: "Klappe",
    summary: tx("铰接在箱体前下沿，盖住插线板。", "Hinged at the lower front edge; covers the plugboard."),
    material: tx("橡木", "Oak"),
  },
  {
    id: "chassis",
    parent: "enigma",
    number: "E-02",
    name: tx("机架与面板", "Chassis & top plate"),
    german: "Grundplatte",
    summary: tx("压铸轻合金机架，顶面板开有转子井、灯孔和键孔。键杆、触点、电池都装在面板之下。", "Die-cast light-alloy frame; the top plate is cut for the rotor well, lamps and keys. Key levers, contacts and battery live underneath."),
    material: tx("轻合金，黑色皱纹漆", "Light alloy, black wrinkle paint"),
    features: [
      { id: "well", label: tx("转子井", "Rotor well") },
      { id: "battery", label: tx("电池盒", "Battery box") },
      { id: "switch", label: tx("电源开关", "Power switch") },
    ],
  },
  {
    id: "rotor-cover",
    parent: "enigma",
    number: "E-03",
    name: tx("转子盖", "Rotor cover"),
    german: "Walzendeckel",
    summary: tx("铰接的金属盖。三个小窗显示各转子数字环的当前读数，三条槽口露出拇指轮。", "Hinged metal cover. Three windows show each rotor's current ring number; three slots expose the thumbwheels."),
    role: tx("窗口读数 p 加上环设置 r，才确定导线的实际偏转 p − r。", "The window reading p, together with the ring setting r, fixes the wiring's real offset p − r."),
    material: tx("轻合金", "Light alloy"),
    features: [
      { id: "window-l", label: tx("左窗口", "Left window") },
      { id: "window-m", label: tx("中窗口", "Middle window") },
      { id: "window-r", label: tx("右窗口", "Right window") },
    ],
  },
  {
    id: "rotor-set",
    parent: "enigma",
    number: "E-04",
    name: tx("转子组", "Rotor set"),
    german: "Walzensatz",
    summary: tx("反射器、三枚转子与转子轴作为一个整体取出：松开反射器拨杆、把转子并拢，就能整组提起。", "Reflector, three rotors and spindle come out as one unit: release the reflector lever, press the rotors together and lift."),
    role: tx(
      "电流先从右向左穿过三枚转子，在反射器折返，再从左向右穿回。整组置换 Eᵢ = R⁻¹M⁻¹L⁻¹·U·LMR 是对合且没有不动点。",
      "Current crosses the rotors right to left, turns in the reflector, and crosses back. The scrambler Eᵢ = R⁻¹M⁻¹L⁻¹·U·LMR is an involution with no fixed point.",
    ),
    specs: [
      { k: tx("转子排列", "Wheel order"), v: tx("每日更换（Walzenlage）", "Changed daily (Walzenlage)") },
      { k: tx("位置组合", "Positions"), v: tx("26³ = 17,576", "26³ = 17,576") },
    ],
    features: [
      { id: "ukw", label: tx("反射器 UKW", "Reflector (UKW)") },
      { id: "l", label: tx("左转子（慢）", "Left rotor (slow)") },
      { id: "m", label: tx("中转子", "Middle rotor") },
      { id: "r", label: tx("右转子（快）", "Right rotor (fast)") },
      { id: "spindle", label: tx("转子轴", "Spindle") },
    ],
    view: [0.45, 0.35, 1],
  },
  {
    id: "ukw",
    parent: "rotor-set",
    number: "E-04.1",
    name: tx("反射器 UKW", "Reflector (UKW)"),
    german: "Umkehrwalze",
    summary: tx("只有一面触点的固定转子，内部 13 根导线把 26 个触点两两相连，把电流送回转子组。", "A fixed wheel with contacts on one face only; 13 internal wires join its 26 contacts in pairs and send the current back."),
    role: tx(
      "它让加密等于解密（同一设置下 C = C⁻¹），代价是任何字母都不会被加密成自己。Bletchley Park 正是用这一点拖动明文猜词、排除位置。",
      "It makes enciphering equal deciphering (C = C⁻¹ at one setting), at the price that no letter ever enciphers to itself. Bletchley Park used exactly this to slide cribs and rule out positions.",
    ),
    material: tx("胶木、黄铜", "Bakelite, brass"),
    features: [
      { id: "contacts", label: tx("26 个触点", "26 contacts") },
      { id: "pairs", label: tx("13 对固定接线", "13 fixed pairs") },
      { id: "mark", label: tx("型号标记", "Type mark") },
    ],
  },
  ...rotorParts("l", 2),
  ...rotorParts("m", 3),
  ...rotorParts("r", 4),
  {
    id: "spindle",
    parent: "rotor-set",
    number: "E-04.5",
    name: tx("转子轴", "Spindle"),
    german: "Achse",
    summary: tx("贯穿反射器与三枚转子的钢轴。", "Steel axle through the reflector and the three rotors."),
    material: tx("钢", "Steel"),
  },
  {
    id: "etw",
    parent: "enigma",
    number: "E-05",
    name: tx("输入轮", "Entry wheel"),
    german: "Eintrittswalze (ETW)",
    summary: tx("固定在转子井右侧的触点盘，把键盘、灯板、插线板的 26 根导线接到转子上。", "Fixed contact disc on the right of the rotor well; connects the 26 wires from keyboard, lamps and plugboard to the rotors."),
    role: tx("Enigma I 的输入轮按字母顺序接线（A→A），在数学上是恒等置换。", "On Enigma I it is wired in alphabetical order (A→A): the identity permutation."),
    material: tx("胶木、黄铜", "Bakelite, brass"),
    features: [{ id: "contacts", label: tx("26 个平面触点", "26 flat contacts") }],
  },
  {
    id: "lampboard",
    parent: "enigma",
    number: "E-06",
    name: tx("灯板", "Lampboard"),
    german: "Lampenfeld",
    summary: tx("26 盏小灯按键盘的 QWERTZ 顺序排成三行。被点亮的那盏灯就是密文字母，另一名操作员负责抄录。", "26 lamps in the keyboard's QWERTZ order, three rows. The lit lamp is the cipher letter; a second operator wrote it down."),
    material: tx("轻合金面板、字母胶片", "Light-alloy plate, letter film"),
    features: [
      { id: "window", label: tx("字母窗", "Letter window") },
      { id: "bulb", label: tx("扁平灯泡（E10）", "Flat bulb (E10)") },
    ],
  },
  {
    id: "lamp-cover",
    parent: "lampboard",
    number: "E-06.1",
    name: tx("灯板盖", "Lamp cover"),
    summary: tx("开有 26 个圆窗的面板，窗内是印着字母的胶片。", "Plate with 26 round windows, each behind a printed letter film."),
    material: tx("轻合金、胶片", "Light alloy, film"),
  },
  {
    id: "bulbs",
    parent: "lampboard",
    number: "E-06.2",
    name: tx("灯泡与灯座", "Bulbs & holders"),
    summary: tx("3.5 V 扁平玻壳灯泡，E10 螺口。圆形灯泡会顶到字母胶片。", "3.5 V bulbs with flattened glass and E10 base; round bulbs would press on the letter film."),
    material: tx("玻璃、黄铜", "Glass, brass"),
  },
  {
    id: "keyboard",
    parent: "enigma",
    number: "E-07",
    name: tx("键盘", "Keyboard"),
    german: "Tastatur",
    summary: tx("26 个键，QWERTZ 排列。按键行程的前半段推动棘爪让转子步进，行程末端才闭合触点。", "26 keys in QWERTZ order. The first part of the stroke drives the pawls and steps the rotors; only at the end of travel does the contact close."),
    role: tx("“先步进、后通电”就是由这段机械行程保证的。", "“Step first, then encipher” is guaranteed by this mechanical stroke."),
    material: tx("胶木键帽、钢键杆", "Bakelite caps, steel levers"),
    features: [
      { id: "cap", label: tx("键帽", "Key cap") },
      { id: "lever", label: tx("键杆", "Key lever") },
      { id: "contact", label: tx("按键触点", "Key contact") },
    ],
  },
  {
    id: "plugboard",
    parent: "enigma",
    number: "E-08",
    name: tx("插线板", "Plugboard"),
    german: "Steckerbrett",
    summary: tx(
      "26 个双孔插座。一根双芯插线把两个字母互换；没插线的插座内部有弹簧短路片，字母保持原样。",
      "26 two-hole sockets. A twin-wire cable swaps two letters; an empty socket is closed by a spring shorting bar, so the letter passes unchanged.",
    ),
    role: tx(
      "电流进出转子组都要经过它，所以每次加密都是 S·E·S。10 根插线有 150,738,274,937,250 种接法——却恰好能被 Bombe 的推理绕开。",
      "Current passes it on the way in and on the way out, so every encipherment is S·E·S. Ten cables allow 150,738,274,937,250 settings, which the Bombe's reasoning sidesteps.",
    ),
    material: tx("胶木插头、双芯线", "Bakelite plugs, twin-core cable"),
    specs: [
      { k: tx("插头", "Plug"), v: tx("一粗（4 mm）一细（3 mm）两针，防插反", "One 4 mm and one 3 mm pin, cannot be reversed") },
      { k: tx("插线", "Cables"), v: tx("配 12 根：10 根使用、2 根备用", "12 supplied: 10 in use, 2 spare") },
    ],
    features: [
      { id: "socket", label: tx("双孔插座", "Two-hole socket") },
      { id: "cable", label: tx("插线（交换一对字母）", "Cable (swaps a pair)") },
    ],
  },
  {
    id: "stepping",
    parent: "enigma",
    number: "E-09",
    name: tx("步进机构", "Stepping mechanism"),
    german: "Fortschaltung",
    summary: tx("三个棘爪由按键共同驱动。右棘爪每次都推动右转子；中、左棘爪只有落进缺口时才能抓住各自的转子。", "Three pawls driven by every key. The right pawl always pushes the right rotor; the middle and left pawls only catch when they drop into a notch."),
    role: tx("中棘爪落进中转子缺口时会同时推中、左两枚转子，这就是“双步进”。", "When the middle pawl drops into the middle rotor's notch it pushes both middle and left rotors: the double step."),
    material: tx("钢", "Steel"),
    features: [
      { id: "pawls", label: tx("棘爪 ×3", "Pawls ×3") },
      { id: "bar", label: tx("驱动杆", "Drive bar") },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Disassembly procedure                                               */
/* ------------------------------------------------------------------ */

export function enigmaSteps(detail: Slot): Step[] {
  const spread: Record<Slot, number> = { l: -2.2, m: 0, r: 2.2 };
  // Bring the rotor forward over the keyboard, axis kept left–right so the
  // exploded parts spread across the screen.
  const out: [number, number, number] =
    detail === "m" ? [0, -1.5, 19] : detail === "l" ? [3.05, -1.5, 19] : [-3.05, -1.5, 19];
  const rid = `rotor-${detail}`;
  return [
    {
      id: "flap",
      title: tx("放下前翻板", "Lower the front flap"),
      caption: tx("插线板藏在箱体正面。每根插线交换一对字母，进出转子组都要经过它。", "The plugboard sits behind the case front. Each cable swaps a pair of letters, on the way in and on the way out."),
      moves: [{ part: "flap", rotate: [1.62, 0, 0] }],
      view: { dir: [0.22, 0.32, 1], focus: "plugboard", fill: 0.62 },
    },
    {
      id: "cover",
      title: tx("掀起转子盖", "Lift the rotor cover"),
      caption: tx("盖上的三个小窗只显示数字环读数；打开后才看得到转子本体和拇指轮。", "The cover's three windows only show the ring numbers; open it to see the rotors and thumbwheels."),
      moves: [{ part: "rotor-cover", rotate: [-1.45, 0, 0] }],
      view: { dir: [0.35, 0.8, 0.85], focus: "rotor-set", fill: 0.42 },
    },
    {
      id: "lift",
      title: tx("取出转子组", "Lift out the rotor set"),
      caption: tx("松开反射器、把转子并拢，反射器、三枚转子和转子轴整组提起。输入轮留在机内。", "Release the reflector, press the rotors together and lift reflector, rotors and spindle out as one. The entry wheel stays put."),
      moves: [{ part: "rotor-set", offset: [0, 13.5, 2] }],
      view: { dir: [0.3, 0.45, 1], focus: "rotor-set", fill: 0.5 },
    },
    {
      id: "spread",
      title: tx("沿轴分开", "Slide apart on the spindle"),
      caption: tx("分开后能看到相邻两面：一面是弹簧触针，另一面是平面触点，电流就在这些触点之间逐级传递。", "Apart, each pair of faces shows spring pins meeting flat contacts: the current hops from wheel to wheel here."),
      moves: [
        { part: "ukw", offset: [-4.6, 0, 0] },
        { part: "rotor-l", offset: [spread.l, 0, 0] },
        { part: "rotor-m", offset: [spread.m, 0, 0] },
        { part: "rotor-r", offset: [spread.r, 0, 0] },
      ],
      view: { dir: [0.38, 0.32, 1], focus: "rotor-set", fill: 0.6 },
    },
    {
      id: "take",
      title: tx("取下一枚转子", "Take one rotor off"),
      caption: tx("把要检视的转子从轴上取下，放到工作台前方。可以在面板里切换左、中、右转子。", "Take the rotor to inspect off the spindle and bring it forward. Switch between left, middle and right in the panel."),
      moves: [{ part: rid, offset: out }],
      view: { dir: [0.28, 0.42, 1], focus: rid, fill: 0.4 },
    },
    {
      id: "explode",
      title: tx("分解转子", "Take the rotor apart"),
      caption: tx("拇指轮、数字环、线芯、棘轮依次分开；线芯改为透视，露出 26 根交叉接线。", "Thumbwheel, index ring, core and ratchet come apart; the core turns transparent to show its 26 crossed wires."),
      moves: [
        { part: `${rid}-thumb`, offset: [-5.6, 0, 0] },
        { part: `${rid}-ring`, offset: [-3.0, 0, 0] },
        { part: `${rid}-ratchet`, offset: [3.0, 0, 0] },
        { part: `${rid}-hub`, offset: [5.8, 0, 0] },
      ],
      xray: [`${rid}-core`],
      view: { dir: [0.3, 0.38, 1], focus: rid, fill: 0.62 },
    },
    {
      id: "lamps",
      title: tx("拆下灯板盖", "Remove the lamp cover"),
      caption: tx("盖板下是 26 只扁平灯泡。输出字母只是“哪一盏灯亮”，机器本身不记录任何东西。", "Under the plate sit 26 flat bulbs. The output is simply which lamp is lit; the machine records nothing."),
      moves: [{ part: "lamp-cover", offset: [0, 6, -3] }],
      hide: ["lamp-cover"],
      view: { dir: [0.2, 1, 0.65], focus: "lampboard", fill: 0.6 },
    },
    {
      id: "inside",
      title: tx("透视机体内部", "See inside the chassis"),
      caption: tx("面板与木箱改为透视：键杆、按键触点、步进棘爪和接往输入轮的线束都在面板下面。", "Top plate and case turn transparent: key levers, key contacts, stepping pawls and the loom to the entry wheel all live underneath."),
      moves: [],
      xray: ["chassis", "case", "rotor-cover"],
      view: { dir: [0.75, 0.42, 0.85], focus: "enigma", fill: 0.74 },
      callouts: [
        ["keyboard", "lever"],
        ["keyboard", "contact"],
        ["stepping", "pawls"],
        ["stepping", "bar"],
        ["chassis", "battery"],
        ["etw", "contacts"],
      ],
    },
  ];
}
