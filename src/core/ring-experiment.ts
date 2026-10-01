import {
  cloneConfig,
  encryptKey,
  letter,
  mod26,
  ROTORS,
  type KeyResult,
  type MachineConfig,
  type RotorId,
} from "./enigma";

/** One forward pass through a stationary rotor, in its current window position. */
export interface RingProbe {
  ring: number;
  input: number;
  shiftedInput: number;
  wiredOutput: number;
  output: number;
}

export interface RingExperiment {
  rotorId: RotorId;
  rotorIndex: 0 | 1 | 2;
  position: number;
  installedRing: number;
  trialRing: number;
  input: number;
  /** These probes do not step, pass the plugboard, or traverse another rotor. */
  baseline: RingProbe;
  trial: RingProbe;
  /** Real full-machine keypresses; both independently step from the same windows. */
  baselineKey: KeyResult;
  trialKey: KeyResult;
}

/**
 * Compare a ring setting without applying it. The stationary rotor experiment
 * and the full-machine keypress answer different questions: only the latter
 * advances the rotors and follows both plugboard passes and the reflector.
 */
export function getRingExperiment(
  config: MachineConfig,
  rotorIndex: 0 | 1 | 2,
  trialRing: number,
  input: number,
): RingExperiment {
  if (!Number.isInteger(rotorIndex) || rotorIndex < 0 || rotorIndex > 2)
    throw new Error("转子槽位必须是 0、1 或 2。");
  if (!Number.isInteger(trialRing) || trialRing < 0 || trialRing > 25)
    throw new Error("实验环设置必须是 0–25 之间的整数。");
  if (!Number.isInteger(input) || input < 0 || input > 25)
    throw new Error("实验输入必须是 0–25 之间的整数。");

  // The real engine validates the complete configuration before we read it.
  const baselineKey = encryptKey(config, letter(input));
  const trialConfig = cloneConfig(config);
  trialConfig.rings[rotorIndex] = trialRing;
  const rotorId = config.rotors[rotorIndex];
  const position = config.positions[rotorIndex];
  const installedRing = config.rings[rotorIndex];
  const probe = (ring: number): RingProbe => {
    const shiftedInput = mod26(input + position - ring);
    const wiredOutput = ROTORS[rotorId].forward[shiftedInput];
    return {
      ring,
      input,
      shiftedInput,
      wiredOutput,
      output: mod26(wiredOutput - position + ring),
    };
  };
  return {
    rotorId,
    rotorIndex,
    position,
    installedRing,
    trialRing,
    input,
    baseline: probe(installedRing),
    trial: probe(trialRing),
    baselineKey,
    trialKey: encryptKey(trialConfig, letter(input)),
  };
}
