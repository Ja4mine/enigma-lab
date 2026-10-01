import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  cloneConfig,
  encryptKey,
  encryptText,
  letter,
} from "./enigma";

/**
 * Independent values generated with Py-Enigma 1.0.2 (MIT, Brian Neal):
 * EnigmaMachine.from_key_sheet(rotors="I II III", reflector="B",
 *   ring_settings="A A A", plugboard_settings="AZ"), display "AAA".
 * After key_press, its plugboard.signal, rotor.signal_in/signal_out and
 * reflector.signal_in methods were used to capture each stationary contact.
 * These fixtures specifically exercise the A/Z ends of the alphabet, which
 * occupy opposite rows and columns in the 3D plugboard.
 */
describe("A–Z plugboard end-to-end regression", () => {
  it.each([
    {
      input: "A",
      output: "U",
      contacts: ["AZ", "ZA", "AA", "AE", "EQ", "QH", "HL", "LU", "UU"],
    },
    {
      input: "Z",
      output: "B",
      contacts: ["ZA", "AC", "CD", "DF", "FS", "SS", "SE", "EB", "BB"],
    },
    {
      input: "U",
      output: "A",
      contacts: ["UU", "UL", "LH", "HQ", "QE", "EA", "AA", "AZ", "ZA"],
    },
  ])(
    "$input → $output matches the independent complete contact trace with AZ connected",
    ({ input, output, contacts }) => {
      const result = encryptKey(
        { ...cloneConfig(DEFAULT_CONFIG), plugboard: "AZ" },
        input,
      );
      expect(result.output).toBe(output);
      expect(result.after.map(letter).join("")).toBe("AAB");
      expect(
        result.stages.map(
          (stage) => letter(stage.input) + letter(stage.output),
        ),
      ).toEqual(contacts);
    },
  );

  it("changing and clearing plug pairs updates new encryptions without rewriting previous snapshots", () => {
    const config = { ...cloneConfig(DEFAULT_CONFIG), plugboard: "AZ" };
    const withAZ = encryptText(config, "HELLOWORLD");
    const azSnapshot = JSON.stringify(withAZ);
    expect(withAZ.ciphertext).toBe("ILBDZZMTZA");

    config.plugboard = "AB";
    const withAB = encryptText(config, "HELLOWORLD");
    const abSnapshot = JSON.stringify(withAB);
    expect(withAB.ciphertext).toBe("ILADBBMTBZ");

    config.plugboard = "";
    const cleared = encryptText(config, "HELLOWORLD");
    expect(cleared.ciphertext).toBe("ILBDAAMTAZ");
    for (const trace of cleared.steps) {
      expect(trace.stages[0].input).toBe(trace.stages[0].output);
      expect(trace.stages[8].input).toBe(trace.stages[8].output);
    }
    expect(config.positions).toEqual([0, 0, 0]);
    expect(JSON.stringify(withAZ)).toBe(azSnapshot);
    expect(JSON.stringify(withAB)).toBe(abSnapshot);
    expect(withAZ.config.plugboard).toBe("AZ");
    expect(withAB.config.plugboard).toBe("AB");
    expect(cleared.config.plugboard).toBe("");
  });
});
