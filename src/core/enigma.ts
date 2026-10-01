/**
 * Enigma I, three moving rotors and a fixed wide B/C reflector.
 * All tuples are ordered LEFT → MIDDLE → RIGHT; numbers are zero-based A=0.
 * The identity entry wheel (ETW) is omitted from the trace because it does not
 * change the signal. Positions describe the letter visible in each window.
 *
 * References:
 * https://www.cryptomuseum.com/crypto/enigma/working.htm
 * https://www.cryptomuseum.com/crypto/enigma/wiring.htm
 */

export type RotorId = "I" | "II" | "III" | "IV" | "V";
export type ReflectorId = "B" | "C";
export type Triple<T> = [T, T, T];

export interface MachineConfig {
  rotors: Triple<RotorId>;
  reflector: ReflectorId;
  positions: Triple<number>;
  /** Ringstellung, zero-based: 0 is the UI's 01 / A. */
  rings: Triple<number>;
  /** Whitespace-separated letter pairs, for example "AV BS CG DL FU HZ". */
  plugboard: string;
}

export interface RotorDefinition {
  id: RotorId;
  wiring: string;
  /** Window letter immediately BEFORE the turnover step. */
  notch: string;
  notches: readonly number[];
  forward: readonly number[];
  reverse: readonly number[];
}

export interface ReflectorDefinition {
  id: ReflectorId;
  wiring: string;
  contacts: readonly number[];
}

export type StageId =
  | "plug-in"
  | "right-forward"
  | "middle-forward"
  | "left-forward"
  | "reflector"
  | "left-reverse"
  | "middle-reverse"
  | "right-reverse"
  | "plug-out";

export interface SignalStage {
  id: StageId;
  label: string;
  /** Stationary external contact indices. */
  input: number;
  output: number;
  /** Entire external mapping at this moment, useful for a wiring diagram. */
  activeWiring: number[];
  rotorId?: RotorId;
  rotorIndex?: 0 | 1 | 2;
  direction?: "forward" | "reverse";
  position?: number;
  ring?: number;
  /** Contact on the rotating wired core, after applying position − ring. */
  shiftedInput?: number;
  /** Contact on the wired core, before undoing position − ring. */
  wiredOutput?: number;
}

export interface KeyResult {
  input: string;
  output: string;
  before: Triple<number>;
  after: Triple<number>;
  stepped: Triple<boolean>;
  /** Middle rotor's own notch engages: middle and left advance together. */
  doubleStep: boolean;
  stages: SignalStage[];
}

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const mod26 = (value: number): number => ((value % 26) + 26) % 26;
export const letter = (index: number): string => ALPHABET[mod26(index)];
const contacts = (wiring: string): number[] =>
  [...wiring].map((char) => ALPHABET.indexOf(char));

function defineRotor(
  id: RotorId,
  wiring: string,
  notch: string,
): RotorDefinition {
  const forward = contacts(wiring);
  const reverse = new Array<number>(26);
  forward.forEach((output, input) => {
    reverse[output] = input;
  });
  return Object.freeze({
    id,
    wiring,
    notch,
    notches: Object.freeze(contacts(notch)),
    forward: Object.freeze(forward),
    reverse: Object.freeze(reverse),
  });
}

export const ROTORS: Record<RotorId, RotorDefinition> = Object.freeze({
  I: defineRotor("I", "EKMFLGDQVZNTOWYHXUSPAIBRCJ", "Q"),
  II: defineRotor("II", "AJDKSIRUXBLHWTMCQGZNPYFVOE", "E"),
  III: defineRotor("III", "BDFHJLCPRTXVZNYEIWGAKMUSQO", "V"),
  IV: defineRotor("IV", "ESOVPZJAYQUIRHXLNFTGKDCMWB", "J"),
  V: defineRotor("V", "VZBRGITYUPSDNHLXAWMJQOFECK", "Z"),
});

export const REFLECTORS: Record<ReflectorId, ReflectorDefinition> =
  Object.freeze({
    B: Object.freeze({
      id: "B",
      wiring: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
      contacts: Object.freeze(contacts("YRUHQSLDPXNGOKMIEBFZCWVJAT")),
    }),
    C: Object.freeze({
      id: "C",
      wiring: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
      contacts: Object.freeze(contacts("FVPJIAOYEDRZXWGCTKUQSBNMHL")),
    }),
  });

export const DEFAULT_CONFIG: MachineConfig = {
  rotors: ["I", "II", "III"],
  reflector: "B",
  positions: [0, 0, 0],
  rings: [0, 0, 0],
  plugboard: "",
};

/** Max 10 reflects the ordinary wartime configuration; 13 is physically possible. */
export function plugboardMapping(plugboard: string): number[] {
  if (typeof plugboard !== "string")
    throw new Error("插线板设置必须是字母配对文本。");
  const normalized = plugboard.trim().toUpperCase();
  const pairs = normalized ? normalized.split(/\s+/) : [];
  if (pairs.length > 10) throw new Error("常规作战配置最多允许 10 组插线。");
  const mapping = Array.from({ length: 26 }, (_, index) => index);
  const used = new Set<string>();
  for (const pair of pairs) {
    if (!/^[A-Z]{2}$/.test(pair))
      throw new Error(`插线“${pair}”格式无效，请输入 AB CD 这样的两字母配对。`);
    const [a, b] = pair;
    if (a === b) throw new Error(`插线“${pair}”不能将字母连接到自身。`);
    if (used.has(a) || used.has(b))
      throw new Error(`插线“${pair}”重复使用了已连接的字母。`);
    used.add(a);
    used.add(b);
    const i = ALPHABET.indexOf(a);
    const j = ALPHABET.indexOf(b);
    mapping[i] = j;
    mapping[j] = i;
  }
  return mapping;
}

export function validateConfig(config: MachineConfig): void {
  if (!config || typeof config !== "object")
    throw new Error("机器设置不能为空。");
  if (
    !Array.isArray(config.rotors) ||
    config.rotors.length !== 3 ||
    config.rotors.some((rotor) => !Object.hasOwn(ROTORS, rotor))
  ) {
    throw new Error("请选择三个有效转子：I、II、III、IV 或 V。");
  }
  if (new Set(config.rotors).size !== 3)
    throw new Error("同一个实体转子不能同时安装在两个位置。");
  if (!Object.hasOwn(REFLECTORS, config.reflector))
    throw new Error("请选择反射器 B 或 C。");
  for (const [name, values] of [
    ["窗口位置", config.positions],
    ["环设置", config.rings],
  ] as const) {
    if (
      !Array.isArray(values) ||
      values.length !== 3 ||
      values.some(
        (value) => !Number.isInteger(value) || value < 0 || value > 25,
      )
    ) {
      throw new Error(`${name}必须包含三个 0–25 之间的整数。`);
    }
  }
  plugboardMapping(config.plugboard);
}

export function cloneConfig(config: MachineConfig): MachineConfig {
  return {
    ...config,
    rotors: [...config.rotors],
    positions: [...config.positions],
    rings: [...config.rings],
  };
}

/** Core mapping with the ring offset on both sides of the internal wiring. */
export function rotorMapping(
  rotorId: RotorId,
  position: number,
  ring: number,
  direction: "forward" | "reverse",
): number[] {
  const wiring = ROTORS[rotorId][direction];
  return Array.from({ length: 26 }, (_, input) =>
    mod26(wiring[mod26(input + position - ring)] - position + ring),
  );
}

export function encryptKey(config: MachineConfig, input: string): KeyResult {
  validateConfig(config);
  if (typeof input !== "string" || !/^[A-Za-z]$/.test(input)) {
    throw new Error("请按下一个 A–Z 字母键。");
  }
  const normalized = input.toUpperCase();
  const before: Triple<number> = [...config.positions];

  // Pawls sense BOTH notch positions before any rotor moves. Notches are fixed
  // to the alphabet ring, so Ringstellung does not alter these window letters.
  const middleAtNotch = ROTORS[config.rotors[1]].notches.includes(before[1]);
  const rightAtNotch = ROTORS[config.rotors[2]].notches.includes(before[2]);
  const stepped: Triple<boolean> = [
    middleAtNotch,
    middleAtNotch || rightAtNotch,
    true,
  ];
  const after = before.map((position, index) =>
    mod26(position + Number(stepped[index])),
  ) as Triple<number>;
  const stages: SignalStage[] = [];
  let signal = ALPHABET.indexOf(normalized);
  const plugboard = plugboardMapping(config.plugboard);

  const pass = (stage: Omit<SignalStage, "input" | "output">): void => {
    const output = stage.activeWiring[signal];
    stages.push({ ...stage, input: signal, output });
    signal = output;
  };

  pass({ id: "plug-in", label: "插线板 · 输入", activeWiring: [...plugboard] });

  const passRotor = (
    index: 0 | 1 | 2,
    direction: "forward" | "reverse",
  ): void => {
    const rotorId = config.rotors[index];
    const position = after[index];
    const ring = config.rings[index];
    const shiftedInput = mod26(signal + position - ring);
    const wiredOutput = ROTORS[rotorId][direction][shiftedInput];
    const side = ["left", "middle", "right"][index];
    pass({
      id: `${side}-${direction}` as StageId,
      label: `${["左", "中", "右"][index]}转子 ${rotorId} · ${direction === "forward" ? "正向" : "回程"}`,
      activeWiring: rotorMapping(rotorId, position, ring, direction),
      rotorId,
      rotorIndex: index,
      direction,
      position,
      ring,
      shiftedInput,
      wiredOutput,
    });
  };

  passRotor(2, "forward");
  passRotor(1, "forward");
  passRotor(0, "forward");
  pass({
    id: "reflector",
    label: `反射器 ${config.reflector}`,
    activeWiring: [...REFLECTORS[config.reflector].contacts],
  });
  passRotor(0, "reverse");
  passRotor(1, "reverse");
  passRotor(2, "reverse");
  pass({
    id: "plug-out",
    label: "插线板 · 输出",
    activeWiring: [...plugboard],
  });

  return {
    input: normalized,
    output: letter(signal),
    before,
    after,
    stepped,
    doubleStep: middleAtNotch,
    stages,
  };
}

/** Non A–Z characters are preserved and never advance the machine. */
export function encryptText(
  config: MachineConfig,
  text: string,
): {
  ciphertext: string;
  config: MachineConfig;
  steps: KeyResult[];
} {
  validateConfig(config);
  let current = cloneConfig(config);
  const steps: KeyResult[] = [];
  let ciphertext = "";
  for (const char of text) {
    if (/^[A-Za-z]$/.test(char)) {
      const result = encryptKey(current, char);
      steps.push(result);
      ciphertext += result.output;
      current = { ...current, positions: [...result.after] };
    } else {
      ciphertext += char;
    }
  }
  return { ciphertext, config: current, steps };
}
