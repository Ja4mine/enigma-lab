import { describe, expect, it } from "vitest";
import {
  ALPHABET,
  cloneConfig,
  DEFAULT_CONFIG,
  encryptKey,
  mod26,
  rotorMapping,
  ROTORS,
  type MachineConfig,
  type RotorId,
} from "./enigma";
import { getRingExperiment } from "./ring-experiment";

describe("ring-setting teaching experiment", () => {
  it.each(Object.keys(ROTORS) as RotorId[])(
    "%s: stationary probes match the engine at every window, ring, and input",
    (rotorId) => {
      const others = (Object.keys(ROTORS) as RotorId[]).filter(
        (id) => id !== rotorId,
      );
      const config: MachineConfig = {
        ...cloneConfig(DEFAULT_CONFIG),
        rotors: [others[0], others[1], rotorId],
      };
      for (let position = 0; position < 26; position++) {
        config.positions[2] = position;
        for (let ring = 0; ring < 26; ring++) {
          config.rings[2] = mod26(ring + 11);
          const baselineOutputs: number[] = [];
          const trialOutputs: number[] = [];
          for (let input = 0; input < 26; input++) {
            const result = getRingExperiment(config, 2, ring, input);
            baselineOutputs.push(result.baseline.output);
            trialOutputs.push(result.trial.output);
          }
          expect(baselineOutputs).toEqual(
            rotorMapping(rotorId, position, config.rings[2], "forward"),
          );
          expect(trialOutputs).toEqual(
            rotorMapping(rotorId, position, ring, "forward"),
          );
        }
      }
    },
  );

  it("shows III / window B / ring 01: external Z → core A → B → external A, without stepping the probe", () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    config.positions[2] = 1;
    const result = getRingExperiment(config, 2, 1, 25);
    expect(result).toMatchObject({
      rotorId: "III",
      rotorIndex: 2,
      position: 1,
      installedRing: 0,
      trialRing: 1,
      input: 25,
      baseline: {
        ring: 0,
        input: 25,
        shiftedInput: 0,
        wiredOutput: 1,
        output: 0,
      },
      trial: {
        ring: 1,
        input: 25,
        shiftedInput: 25,
        wiredOutput: 14,
        output: 14,
      },
    });
    expect(result.baselineKey.before).toEqual([0, 0, 1]);
    expect(result.baselineKey.after).toEqual([0, 0, 2]);
    expect(result.trialKey.after).toEqual([0, 0, 2]);
    expect(config.positions).toEqual([0, 0, 1]);
  });

  it("wraps negative core offsets and output offsets across A/Z without changing the window", () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    const negativeOffset = getRingExperiment(config, 2, 25, 0);
    expect(negativeOffset.trial).toEqual({
      ring: 25,
      input: 0,
      shiftedInput: 1,
      wiredOutput: 3,
      output: 2,
    });
    config.rings[2] = 25;
    const wrappedRing = getRingExperiment(config, 2, 0, 25);
    expect(wrappedRing.baseline).toEqual({
      ring: 25,
      input: 25,
      shiftedInput: 0,
      wiredOutput: 1,
      output: 0,
    });
    expect(wrappedRing.trial).toEqual({
      ring: 0,
      input: 25,
      shiftedInput: 25,
      wiredOutput: 14,
      output: 14,
    });
    expect(wrappedRing.position).toBe(0);
  });

  it("uses actual full-machine encryption and changes only the selected ring in each slot", () => {
    const config: MachineConfig = {
      rotors: ["IV", "V", "II"],
      reflector: "C",
      positions: [3, 16, 21],
      rings: [11, 24, 25],
      plugboard: "AV BS CG DL FU HZ",
    };
    for (const index of [0, 1, 2] as const) {
      const result = getRingExperiment(config, index, 7, 19);
      const expectedTrial = cloneConfig(config);
      expectedTrial.rings[index] = 7;
      expect(result.baselineKey).toEqual(encryptKey(config, "T"));
      expect(result.trialKey).toEqual(encryptKey(expectedTrial, "T"));
      expect(result.rotorId).toBe(config.rotors[index]);
      expect(result.position).toBe(config.positions[index]);
      expect(result.installedRing).toBe(config.rings[index]);
      expect(result.baselineKey.before).toEqual(result.trialKey.before);
      for (const stage of result.trialKey.stages) {
        if (stage.rotorIndex !== undefined)
          expect(stage.ring).toBe(expectedTrial.rings[stage.rotorIndex]);
      }
    }
    const known = getRingExperiment(DEFAULT_CONFIG, 2, 1, 0);
    expect(known.baselineKey.output).toBe("B");
    expect(known.trialKey.output).toBe("U");
    // The isolated trial probes the unstepped right rotor: A → Z → O → P.
    // Its P is not the complete machine's U.
    expect(known.trial).toMatchObject({
      shiftedInput: 25,
      wiredOutput: 14,
      output: 15,
    });
  });

  it("preserves notch turnover and the double-step for every trial ring", () => {
    for (const index of [0, 1, 2] as const) {
      for (let ring = 0; ring < 26; ring++) {
        const carryConfig: MachineConfig = {
          ...cloneConfig(DEFAULT_CONFIG),
          positions: [0, 3, 21],
        };
        const carry = getRingExperiment(carryConfig, index, ring, 0);
        for (const key of [carry.baselineKey, carry.trialKey]) {
          expect(key.after).toEqual([0, 4, 22]);
          expect(key.stepped).toEqual([false, true, true]);
          expect(key.doubleStep).toBe(false);
        }
        const next = getRingExperiment(
          { ...carryConfig, positions: [...carry.baselineKey.after] },
          index,
          ring,
          0,
        );
        for (const key of [next.baselineKey, next.trialKey]) {
          expect(key.after).toEqual([1, 5, 23]);
          expect(key.stepped).toEqual([true, true, true]);
          expect(key.doubleStep).toBe(true);
        }
      }
    }
  });

  it("accepts a frozen configuration and keeps all returned records independently mutable", () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    Object.freeze(config.rotors);
    Object.freeze(config.rings);
    Object.freeze(config.positions);
    Object.freeze(config);
    const result = getRingExperiment(config, 2, 19, 4);
    const baselineSnapshot = JSON.stringify(result.baselineKey);
    result.trialKey.before[0] = 25;
    result.trialKey.after[2] = 25;
    result.trialKey.stages[0].activeWiring[0] = 25;
    result.trial.input = 25;
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(result.baseline.input).toBe(4);
    expect(JSON.stringify(result.baselineKey)).toBe(baselineSnapshot);
  });

  it("matches both results when the trial ring is unchanged", () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    config.rings[1] = 9;
    const result = getRingExperiment(config, 1, 9, ALPHABET.indexOf("R"));
    expect(result.trial).toEqual(result.baseline);
    expect(result.trialKey).toEqual(result.baselineKey);
    expect(result.trialKey).not.toBe(result.baselineKey);
  });

  it("rejects invalid indices and contact/ring values instead of silently wrapping UI mistakes", () => {
    for (const bad of [-1, 26, 0.5, NaN, Infinity]) {
      expect(() => getRingExperiment(DEFAULT_CONFIG, 2, bad, 0)).toThrow();
      expect(() => getRingExperiment(DEFAULT_CONFIG, 2, 0, bad)).toThrow();
    }
    for (const bad of [-1, 3, 1.5, NaN])
      expect(() => getRingExperiment(DEFAULT_CONFIG, bad as 0, 0, 0)).toThrow();
    expect(() =>
      getRingExperiment({ ...DEFAULT_CONFIG, plugboard: "AA" }, 2, 0, 0),
    ).toThrow();
  });
});
