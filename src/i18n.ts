import { useCallback, useEffect, useState } from "react";
import type { StageId } from "./core/enigma";

export type Language = "zh" | "en";

const EN: Record<string, string> = {
  "请先应用或取消转子预览。":
    "Apply or cancel the configuration preview first.",
  设置实时预览: "Live configuration preview",
  "设置实时预览 · 尚未应用": "LIVE CONFIGURATION PREVIEW · NOT APPLIED",
  "模型显示草稿设置；已有记录保留，应用后才用于新的加密。":
    "The model previews your draft. Existing records are preserved; apply to encrypt with these settings.",
  取消预览: "Cancel preview",
  "调整即预览：型号、窗口、环与反射器会同步到模型。":
    "Live preview: rotor types, windows, rings, and reflector update the model as you edit.",
  "窗口保持不变，线芯相对字母环转动；紫色标记标出线芯 A。":
    "The window stays fixed while the wired core turns relative to the alphabet ring. The colored marker identifies core A.",
  "字母环与线芯一起转动，窗口位置随之改变。":
    "The alphabet ring and wired core turn together as the window position changes.",
  "型号改变会替换内部接线与缺口；已安装的型号会交换位置。":
    "Changing the type replaces its wiring and notch. Selecting an installed rotor swaps its slot.",
  "反射器配对与内部接线已随型号更新。":
    "Reflector pairs and internal wires now follow the selected type.",
  外部: "External",
  快速插线配对: "Quick plugboard pairs",
  连接并复位: "Connect & reset",
  "空格分隔，最多 10 对；留空可拔除全部插线。":
    "Space-separated, up to 10 pairs. Leave empty to unplug all.",
  "连接后复位窗口并清空记录。":
    "Connecting resets windows and clears the record.",
  当前连接: "Connected",
  无插线: "No cables",
  待应用: "Not applied",
  跟随电流: "Follow current",
  步骤衔接: "Transition",
  "虚线：部件间教学示意连接": "Dashed: schematic links between components",
  "应用后停止当前回放、恢复初始窗口并清空记录。":
    "Applying stops playback, restores initial windows, and clears the record.",
  "顶部 · 机器设置": "Top bar · Machine settings",
  内部接线: "Internal wiring",
  电流检视: "CURRENT INSPECTION",
  "一次击键，一段旅程": "One keypress. One journey.",
  三维播放控制: "3D playback control",
  三维上一步: "Previous 3D stage",
  三维下一步: "Next 3D stage",
  三维播放速度: "3D playback speed",
  三维阶段进度: "3D stage progress",
  回放: "Play",
  线芯: "Core",
  载入接线演示: "Load wiring demonstration",
  "木与黄铜 / 三转子密码机": "WOOD & BRASS / THREE-ROTOR MACHINE",
  历史结构教学模型: "Historical study model",
  "木箱、胶木与黄铜，封存一段机械密码的历史。按下字母，沿着真实接线，追踪电流往返的旅程。":
    "Wood, bakelite, and brass preserve a chapter of mechanical cryptography. Press a letter and follow the current along its actual electrical connections.",
  "以米黄色旧纸、木箱与黄铜呈现历史密码机。参考 OHM TAPE 的器物陈列与档案界面，模型用于教学检视，电气连接遵循 Enigma I。":
    "An archival study in aged ivory, wood, and brass, inspired by the object presentation and archive interface of OHM TAPE. The model is for educational inspection; its electrical connections follow Enigma I.",
  "三维高亮逐段对应真实接线：插线板配对、转子线芯触点、反射器回路与返回路径。导线的空间弯曲形状及棘爪等机械细节为教学示意，不代表实物测绘。":
    "The 3D highlights follow actual connections: plugboard pairs, rotor core contacts, reflector pairs, and the return path. Wire curvature and mechanical details such as pawls are educational geometry rather than measured reconstruction.",
  "打开顶部“机器设置”，选定转子、初始窗口、环设置和插线配对，再点击“应用设置并复位”。使用屏幕按键或键盘 A–Z；开启“内部接线”观察三维导线。":
    "Open Machine settings above, choose rotors, starting windows, rings, and plugboard pairs, then apply and reset. Use the on-screen keys or A–Z, and enable Internal wiring to examine the 3D conductors.",

  "现代实验仪器 / Enigma I 逻辑": "Modern instrument / Enigma I logic",
  现代工业设计演绎: "Modern industrial interpretation",
  "以现代实验仪器重新呈现经典密码机。开放式结构让每一次转动、每一段电路都清晰可见。":
    "A classic cipher machine reimagined as a modern laboratory instrument. An open structure reveals each rotation and every electrical path.",
  "以现代实验仪器呈现 Enigma I：石墨色金属、透明观察板与模块化结构。外观是原创设计演绎，内部加密规则遵循历史机器，并非历史实物外观复刻。":
    "Enigma I reimagined as a modern laboratory instrument: graphite metal, transparent observation panels, and modular construction. The exterior is an original design interpretation; its cipher logic follows the historical machine, rather than recreating its period appearance.",
  "Enigma Lab 首页": "Enigma Lab home",
  检视终端: "Inspection terminal",
  工作原理: "How it works",
  项目说明: "About the project",
  密码机械档案: "Cryptographic machinery archive",
  恩尼格玛: "Enigma",
  "探索机械，追踪电流，理解密码。":
    "Explore the mechanism. Follow the current. Understand the cipher.",
  部件索引: "Component index",
  "恩尼格玛 I 型": "Enigma I",
  转子组: "Rotor assembly",
  反射器: "Reflector",
  插线板: "Plugboard",
  按键机构: "Keyboard",
  灯板: "Lamp panel",
  "一台把字母变成秘密的机器。机械步进与电路置换，在每一次击键中形成新的密码。":
    "A machine that turns letters into secrets. Mechanical stepping changes the electrical substitution with every keypress.",
  "三枚转子，每枚藏着 26 条固定走线。窗口位置控制转动，环设置改变字母环与内部线芯的偏移。":
    "Three rotors, each with 26 fixed wires. Window positions track rotation; ring settings shift the alphabet ring relative to the wired core.",
  "将电流送回转子组的另一条路径。13 对固定连接让同一设置既能加密，也能解密。":
    "The reflector sends current back through the rotors along a different route. Its 13 fixed pairs make the same settings work for encryption and decryption.",
  "两两交换字母。电流在进入转子之前、离开转子之后，都会经过同一组插线。":
    "Cables swap letters in pairs. Current passes through the same connections both before entering the rotors and after returning from them.",
  "按下按键时，棘爪先推动转子，再闭合电路。可以使用实体键盘，也可以点击下方按键。":
    "A keypress first moves the rotors, then closes the circuit. Type on your keyboard or click a key below.",
  "完成往返旅程的电流，点亮一个输出字母。保存好初始设置，再输入密文，就能还原明文。":
    "The returning current lights one output letter. Restore the original settings and type the ciphertext to recover the message.",
  制式: "Model",
  "陆军 · 三转子": "Army · three rotors",
  字母系统: "Alphabet",
  "26 个拉丁字母": "26 Latin letters",
  运作方式: "Operation",
  机电式置换: "Electromechanical",
  结构模型: "Model type",
  程序化检视模型: "Procedural study model",
  可选转子: "Rotor options",
  触点数量: "Contacts",
  "每侧 26 个": "26 per side",
  步进顺序: "Sequence",
  "先步进，再通电": "Step, then energize",
  进位机制: "Turnover",
  "缺口触发 · 双步进": "Notches · double-step",
  可选型号: "Options",
  连接数量: "Connections",
  "13 对": "13 pairs",
  运动状态: "Movement",
  固定不旋转: "Fixed; does not turn",
  密码特征: "Cipher property",
  字母不加密为自身: "No self-encryption",
  常规配置: "Standard setup",
  "最多 10 对插线": "Up to 10 cable pairs",
  连接规则: "Pairing rule",
  一个字母只用一次: "Each letter used once",
  未连接字母: "Unpaired letters",
  保持原样: "Pass through",
  配置位置: "Configure in",
  "右侧 · 机器设置": "Machine settings panel",
  键盘布局: "Key layout",
  "德式 QWERTZ": "German QWERTZ",
  输入范围: "Input",
  机械动作: "Mechanical action",
  "步进 → 触点闭合": "Step → close contact",
  重复输入: "Repeated input",
  每次击键独立推进: "One step per keypress",
  灯泡数量: "Lamps",
  "26 盏": "26 lamps",
  输出方式: "Output",
  单灯指示: "One lamp at a time",
  显示内容: "Indicates",
  当前加密字母: "Current output letter",
  复原条件: "To decrypt",
  相同初始机器设置: "Same starting settings",
  "真实置换 · 可复核路径": "Real wiring · traceable paths",
  三维检视: "3D inspection",
  电路剖面: "Circuit diagram",
  "三转子密码机 / 结构研究模型":
    "Three-rotor cipher machine / structural study",
  "拖动旋转 · 滚轮缩放 · 点击部件":
    "Drag to orbit · Scroll to zoom · Click a component",
  合拢整机: "Assemble",
  拆解视图: "Explode",
  重置机位: "Reset camera",
  机器设置: "Machine settings",
  密钥配置: "Key configuration",
  "左 · SLOW": "LEFT · SLOW",
  "中 · MIDDLE": "CENTER · MIDDLE",
  "右 · FAST": "RIGHT · FAST",
  转子排列: "Rotor order",
  初始窗口: "Starting windows",
  环设置: "Ring settings",
  左转子型号: "Left rotor type",
  中转子型号: "Middle rotor type",
  右转子型号: "Right rotor type",
  左转子初始窗口: "Left rotor starting window",
  中转子初始窗口: "Middle rotor starting window",
  右转子初始窗口: "Right rotor starting window",
  左转子环设置: "Left rotor ring setting",
  中转子环设置: "Middle rotor ring setting",
  右转子环设置: "Right rotor ring setting",
  反射器型号: "Reflector type",
  插线配对: "Plugboard pairs",
  "例如 AB CD EF": "e.g. AB CD EF",
  "空格分隔 · 常规作战配置最多 10 对":
    "Space-separated · Up to 10 wartime pairs",
  应用设置并复位: "Apply settings & reset",
  "更改设置将开始一段新的加密记录。":
    "Applying settings starts a new encryption record.",
  信号追踪: "Signal trace",
  按键: "Key",
  步进: "Step",
  展开电路: "Open circuit",
  操作台: "Keyboard",
  实验记录: "Experiment log",
  复位至初始设置: "Reset to starting settings",
  灯板输出: "Lamp output",
  "正在追踪 · 可暂停或逐步前进": "Tracing · Pause or step through",
  "点击按键或使用键盘 A–Z": "Click a key or type A–Z",
  "第一封密文，从一次击键开始。": "Every secret starts with a keypress.",
  "输入字母后，这里会保留每次步进和字母置换。":
    "Each keypress records the rotor movement and letter substitution here.",
  序号: "No.",
  "输入 → 输出": "Input → Output",
  窗口变化: "Window positions",
  中轮双步进: "Middle double-step",
  缺口进位: "Notch turnover",
  右轮步进: "Right rotor steps",
  过程回放: "Process playback",
  动画速度: "Playback speed",
  等待第一次击键: "Ready for the first keypress",
  "试试按下 A，观察每一段电流路径。":
    "Press A to follow each part of the electrical path.",
  中间转子触发双步进: "Middle rotor triggers the double-step",
  "转子先步进，随后电路闭合": "Rotors step before the circuit closes",
  完整电路闭合: "Circuit complete",
  过程进度: "Playback position",
  反射: "Reflect",
  点灯: "Light",
  "按下 A 体验": "Try pressing A",
  暂停: "Pause",
  再次回放: "Replay",
  继续播放: "Continue",
  单步: "Step",
  回放与拖动进度不会再次推进机器:
    "Playback and scrubbing do not advance the machine",
  电文实验: "Message lab",
  连续输入: "Message input",
  "A–Z / 忽略空格": "A–Z / spaces ignored",
  加密: "Encrypt",
  输出记录: "Output record",
  复制密文: "Copy ciphertext",
  输入: "Input",
  "初始 I–II–III / AAA / 01–01–01 / UKW B 时，HELLOWORLD → ILBDAAMTAZ":
    "At I–II–III / AAA / 01–01–01 / UKW B: HELLOWORLD → ILBDAAMTAZ",
  关闭提示: "Dismiss message",
  "交互研究原型 0.1": "Interactive research prototype 0.1",
  "机械的秩序，秘密的起点。": "Mechanical order. The beginning of a secret.",
  模型说明与验证依据: "Model notes & verification",
  关闭说明: "Close notes",
  "一次击键，十一段旅程。": "One keypress. Eleven stages.",
  "从机械档案，到可验证的实验。":
    "From mechanical archive to a verifiable experiment.",
  "先在右侧选定转子、初始窗口、环设置和插线配对，点击“应用设置并复位”。然后点击按键或直接使用键盘 A–Z。":
    "Choose your rotors, starting windows, ring settings, and plugboard pairs in Machine settings, then select “Apply settings & reset.” Click a key or type A–Z.",
  "机械先行：": "Mechanics first: ",
  "右转子每次前进一步；缺口决定中间转子与左转子的进位。中间转子可能在连续两次击键中步进，这就是“双步进”。":
    "The right rotor advances on every keypress. Notches determine when the middle and left rotors advance. The middle rotor can move on two consecutive keypresses: the double-step.",
  "正向通电：": "Forward path: ",
  "按键 → 插线板 → 输入轮 ETW → 右、中、左转子。":
    "Key → plugboard → entry wheel (ETW) → right, middle, and left rotors.",
  "折返回路：": "Return path: ",
  "反射器 → 左、中、右转子的逆向走线 → ETW → 插线板 → 输出灯。":
    "Reflector → reverse wiring of the left, middle, and right rotors → ETW → plugboard → output lamp.",
  "环设置 ≠ 窗口位置。": "Ring setting ≠ window position. ",
  "环设置改变线芯相对字母环的偏移；Enigma I 的缺口固定在字母环上，因此窗口进位字母不随环设置改变。":
    "Ring settings shift the wired core relative to the alphabet ring. On the Enigma I, the notch is attached to that ring, so changing a ring setting does not change the window letter that triggers turnover.",
  双步进实验: "Double-step experiment",
  "初始 I–II–III、窗口 A–D–U，连续按三次任意字母，窗口依次变成 A–D–V、A–E–W、B–F–X。":
    "Select I–II–III and set the windows to A–D–U. Press any letter three times: the windows become A–D–V, A–E–W, then B–F–X.",
  载入双步进示例: "Load the double-step example",
  "解密时，先恢复到加密前相同的初始设置，再输入密文。连续输入会从机器当前窗口继续运行。":
    "To decrypt, restore the exact starting settings used for encryption, then enter the ciphertext. Message input continues from the machine’s current windows.",
  "以工业档案终端与磁带检视网页为视觉参考，独立编写界面、三维几何与加密核心。三维模型用于结构观察，尚未达到依据实物测绘的博物馆级复原精度。":
    "Inspired visually by industrial archive terminals and the cassette inspection website, this project has an independently written interface, 3D geometry, and cipher engine. The procedural model supports structural exploration; it is not a measured museum reconstruction.",
  "这版支持：": "Supported in this version: ",
  "Enigma I，五选三转子（I–V），反射器 B / C，26 档环设置，常规 10 对插线，双步进，26 触点完整电路和逐步回放。":
    "Enigma I; any three of rotors I–V; reflectors B/C; 26 ring settings; up to 10 plugboard pairs; double-stepping; complete 26-contact wiring; and step-by-step playback.",
  "精度边界：": "Model fidelity: ",
  "电路图使用真实转子接线表；三维电流高亮表达经过的部件。三维棘爪、弹片和插头结构为示意，后续可替换成有独立部件的精细 glTF 模型。":
    "The circuit diagram uses the historical rotor wiring tables. The 3D highlight identifies the components carrying current. Pawls, spring contacts, and plugs are schematic; detailed glTF parts can replace them in a later version.",
  "验证：": "Verification: ",
  "公开标准向量 AAAAA → BDZGO、HELLOWORLD → ILBDAAMTAZ；另测双步进、非默认环设置、插线板和加解密互逆。":
    "Reference vectors AAAAA → BDZGO and HELLOWORLD → ILBDAAMTAZ, a historical army message, double-stepping, non-default ring settings, plugboard behavior, and encryption/decryption reciprocity are covered by automated tests.",
  "Crypto Museum · 工作原理 ↗": "Crypto Museum · How Enigma works ↗",
  "Cassette · 视觉参考 ↗": "Cassette · Visual reference ↗",
  "全部加密与检视在本地浏览器完成，无账号、无后端。":
    "Encryption and inspection run locally in your browser. No account or backend is required.",
  机械步进: "Mechanical stepping",
  "插线板 · 进入": "Plugboard · Inbound",
  "右转子 · 正向": "Right rotor · Forward",
  "中转子 · 正向": "Middle rotor · Forward",
  "左转子 · 正向": "Left rotor · Forward",
  "左转子 · 返回": "Left rotor · Return",
  "中转子 · 返回": "Middle rotor · Return",
  "右转子 · 返回": "Right rotor · Return",
  "插线板 · 返回": "Plugboard · Return",
  输出灯点亮: "Output lamp lights",
  电路展开图: "Electrical schematic",
  全部走线: "All wiring",
  当前路径: "Active path",
  "Enigma 26触点走线图，琥珀色为正向电流，绿色为返回电流":
    "Enigma 26-contact wiring diagram. Amber traces the forward current; green traces the return current.",
  左转子: "Left rotor",
  中转子: "Middle rotor",
  右转子: "Right rotor",
  环: "Ring",
  正向: "Forward",
  返回: "Return",
  "字母为机架触点坐标；走线已计入当前窗口位置与环设置。固定输入轮 ETW 按字母顺序直通。":
    "Letters identify stationary contacts. Wiring includes the current window positions and ring offsets. The fixed entry wheel (ETW) passes letters straight through.",
  "按下一个字母，追踪真实电路。": "Press a letter to trace the actual circuit.",
  "请输入 A–Z 字母；空格与换行会被忽略。":
    "Enter A–Z letters. Spaces and line breaks are ignored.",
  "请先输入至少一个字母。": "Enter at least one letter first.",
  "单次最多处理 500 个字母。": "You can process up to 500 letters at a time.",
  "浏览器未允许复制，请在输出区域选择文字复制。":
    "Clipboard access was unavailable. Select and copy the text in the output area.",
  "插线板设置必须是字母配对文本。":
    "Enter plugboard settings as pairs of letters.",
  "常规作战配置最多允许 10 组插线。":
    "A standard wartime configuration allows up to 10 plugboard pairs.",
  "机器设置不能为空。": "Machine settings are required.",
  "请选择三个有效转子：I、II、III、IV 或 V。":
    "Choose three valid rotors from I, II, III, IV, and V.",
  "同一个实体转子不能同时安装在两个位置。":
    "The same physical rotor cannot be installed in two positions.",
  "请选择反射器 B 或 C。": "Choose reflector B or C.",
  "窗口位置必须包含三个 0–25 之间的整数。":
    "Window positions must contain three whole numbers between 0 and 25.",
  "环设置必须包含三个 0–25 之间的整数。":
    "Ring settings must contain three whole numbers between 0 and 25.",
  "请按下一个 A–Z 字母键。": "Press one letter key from A–Z.",
  放大电路: "Expand circuit",
  收起电路: "Close expanded view",
  从触点到线芯: "From contact to wired core",
  上一步: "Previous stage",
  下一步: "Next stage",
  窗口: "Window",
  线芯入口: "Core input",
  线芯出口: "Core output",
  "计算使用 A=0…Z=25；环 01 以 0 参与计算。入口加“位置−环”，通过固定接线后，出口减去相同偏移。":
    "Calculations use A=0…Z=25; ring 01 counts as 0. Add “position − ring” on entry, follow the fixed wire, then subtract the same offset on exit.",
  "回程使用同一组固定接线的逆向映射。":
    "The return path uses the inverse of those same fixed connections.",
  反射器的固定配对: "Fixed reflector pair",
  "反射器不旋转；它把信号送回转子的逆向走线。":
    "The reflector does not turn. It sends the signal back through the rotors’ inverse wiring.",
  "插线板交换已连接的字母，未连接的字母直通。":
    "The plugboard swaps connected letters; unpaired letters pass through.",
  "拖动回放进度，查看每一步的触点与计算。":
    "Scrub the playback to inspect the contacts and calculations at each stage.",
  "按下字母后暂停，再用单步或进度条观察偏移、固定接线与回程。":
    "Press a letter, pause, then use Step or the playback slider to inspect the offsets, fixed wiring, and return path.",
};

export function translate(text: string, language: Language): string {
  if (language === "zh") return text;
  if (EN[text]) return EN[text];
  const invalidPair = text.match(
    /^插线“(.+)”格式无效，请输入 AB CD 这样的两字母配对。$/,
  );
  if (invalidPair)
    return `“${invalidPair[1]}” is not a valid pair. Use two-letter pairs such as AB CD.`;
  const selfPair = text.match(/^插线“(.+)”不能将字母连接到自身。$/);
  if (selfPair) return `“${selfPair[1]}” cannot connect a letter to itself.`;
  const reusedPair = text.match(/^插线“(.+)”重复使用了已连接的字母。$/);
  if (reusedPair)
    return `“${reusedPair[1]}” reuses a letter that is already connected.`;
  return text;
}

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("enigma-lab-language") === "en" ? "en" : "zh";
    } catch {
      return "zh";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title =
      language === "zh"
        ? "ENIGMA LAB · 恩尼格玛检视终端"
        : "ENIGMA LAB · Enigma Inspection Terminal";
    try {
      localStorage.setItem("enigma-lab-language", language);
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [language]);
  const t = useCallback(
    (text: string) => translate(text, language),
    [language],
  );
  return { language, setLanguage, t };
}

export function stageLabel(
  id: StageId,
  language: Language,
  rotorId?: string,
  reflector?: string,
): string {
  const names: Record<StageId, string> = {
    "plug-in": "插线板 · 进入",
    "right-forward": "右转子 · 正向",
    "middle-forward": "中转子 · 正向",
    "left-forward": "左转子 · 正向",
    reflector: "反射器",
    "left-reverse": "左转子 · 返回",
    "middle-reverse": "中转子 · 返回",
    "right-reverse": "右转子 · 返回",
    "plug-out": "插线板 · 返回",
  };
  return `${translate(names[id], language)}${rotorId ? ` ${rotorId}` : id === "reflector" && reflector ? ` ${reflector}` : ""}`;
}
