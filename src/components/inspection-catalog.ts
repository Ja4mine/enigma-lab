import type { Assembly } from "../core/inspection";

export const INSPECTION_PARTS: Record<Assembly, [string, string, string][]> = {
  drive: [
    ["ratchets", "26 齿棘轮", "26-tooth ratchets"],
    ["pawls", "推进棘爪", "Drive pawls"],
    ["springs", "回位弹簧", "Return springs"],
    ["linkage", "连杆与公共摆架", "Linkage & common cradle"],
    ["frame", "轴承与支架", "Bearings & frame"],
  ],
  rotor: [
    ["ring", "字母环与缺口", "Alphabet ring & notch"],
    ["core", "线芯与 26 根导线", "Core & 26 wires"],
    ["contacts", "两侧触点板", "Contact plates"],
    ["covers", "端盖与固定件", "End covers"],
    ["ratchet", "棘轮", "Ratchet"],
    ["shaft", "轴心与固定销", "Shaft & retaining pin"],
  ],
  reflector: [
    ["contacts", "26 位触点盘", "26-contact plate"],
    ["core", "绝缘接线体与 13 对导线", "Insulator & 13 wire pairs"],
    ["cover", "黄铜背盖", "Brass back cover"],
    ["fasteners", "定位轴套与紧固件", "Locator sleeve & fasteners"],
  ],
  plug: [
    ["body", "胶木握柄", "Bakelite grip"],
    ["pins", "双金属插针", "Twin metal pins"],
    ["sockets", "插孔与绝缘衬套", "Sockets & bushings"],
    ["leaves", "后侧弹性触片", "Rear spring contacts"],
    ["cable", "线尾与应力释放套", "Cable & strain relief"],
  ],
  key: [
    ["cap", "字母键帽", "Letter keycap"],
    ["stem", "推杆与导套", "Stem & guide"],
    ["spring", "螺旋回位弹簧", "Coil spring"],
    ["lever", "摇臂与连杆", "Rocker & linkage"],
    ["contacts", "动静触点", "Moving & fixed contacts"],
  ],
  housing: [
    ["wood", "木底座与侧板", "Wooden base & sides"],
    ["chassis", "金属底盘与顶盖", "Metal chassis & deck"],
    ["cover", "转子护罩与观察窗", "Rotor hood & readout windows"],
    ["lid", "箱盖与内衬", "Lid & lining"],
    ["hinges", "合页与轴销", "Hinges & pins"],
    ["fasteners", "锁扣与紧固件", "Latches & fasteners"],
  ],
};
export const INSPECTION_ASSEMBLIES: {
  id: Assembly;
  zh: string;
  en: string;
  description: [string, string];
  scale: string;
}[] = [
  {
    id: "reflector",
    zh: "反射器解剖",
    en: "Reflector anatomy",
    description: [
      "从触点面观察固定的反射器。26 个触点由 13 根导线两两相连，使电流从同一侧进入并返回；拆开背盖，逐对查看真实的 B / C 型接线。",
      "Inspect the contact face of the stationary reflector. Thirteen wires pair its 26 contacts, returning current through the same face. Separate the cover and examine the actual B / C wiring pair by pair.",
    ],
    scale: "M—06",
  },
  {
    id: "drive",
    zh: "步进机构",
    en: "Stepping mechanism",
    description: [
      "看清棘爪如何带动棘轮。哪些转子前进一步来自同一套真实步进规则；连杆与弹簧的运动是结构教学演示。",
      "Inspect how pawls drive ratchets. Rotor advancement follows the verified stepping rules; linkage and spring motion illustrates the mechanism.",
    ],
    scale: "M—01",
  },
  {
    id: "rotor",
    zh: "转子解剖",
    en: "Rotor anatomy",
    description: [
      "沿轴向拆开字母环、端盖、触点板与线芯。内部 26 根导线使用真实型号接线，环设置决定线芯与字母环的相对角度。",
      "Separate the alphabet ring, covers, contact plates, and core along the shaft. All 26 wires use the selected historical wiring; the ring setting controls their relative angle.",
    ],
    scale: "M—02",
  },
  {
    id: "plug",
    zh: "双针插头",
    en: "Two-pin plug",
    description: [
      "分离握柄、金属插针、绝缘衬套与后侧弹性触片。这里放大单个双针插头，便于观察插接结构。",
      "Separate the grip, metal pins, insulated bushings, and rear spring contacts. One enlarged two-pin plug reveals the connection structure.",
    ],
    scale: "M—03",
  },
  {
    id: "key",
    zh: "按键与回位",
    en: "Key & return assembly",
    description: [
      "从字母键帽一直看到推杆、导套、螺旋弹簧、摇臂和接点。播放一次按下与释放，或拖动进度观察中间姿态。",
      "Inspect the keycap, stem, guide, coil spring, rocker, and contacts. Play one press-and-release cycle or scrub to examine an intermediate pose.",
    ],
    scale: "M—04",
  },
  {
    id: "housing",
    zh: "外壳与五金",
    en: "Housing & hardware",
    description: [
      "分层检视木箱、空心机架和带真实开孔的盖板。查看转子读数窗、拨轮槽、翻边、铰链轴销、锁扣与固定螺钉。",
      "Inspect the wooden case, hollow chassis and perforated panels. Explore the rotor windows, thumbwheel slots, folded edges, hinge pins, latches and fasteners.",
    ],
    scale: "M—05",
  },
];
