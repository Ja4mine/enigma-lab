import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  cloneConfig,
  encryptKey,
  type RotorId,
} from "./enigma";
import { previewConfig, updateRotorDraft } from "./configuration-preview";

describe("pending machine configuration previews", () => {
  it("swaps an installed rotor without moving slot windows or rings, even with half a plug pair typed", () => {
    const draft = {
      ...cloneConfig(DEFAULT_CONFIG),
      positions: [3, 8, 21] as [number, number, number],
      rings: [1, 11, 6] as [number, number, number],
      plugboard: "A",
    };
    const snapshot = JSON.stringify(draft);
    const updated = updateRotorDraft(draft, "rotors", 2, "I");
    expect(updated).toEqual({ ...draft, rotors: ["III", "II", "I"] });
    expect(updated).not.toBe(draft);
    expect(updated.rotors).not.toBe(draft.rotors);
    expect(updated.positions).not.toBe(draft.positions);
    expect(updated.rings).not.toBe(draft.rings);
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it("replaces an unused rotor model without changing another slot", () => {
    const updated = updateRotorDraft(DEFAULT_CONFIG, "rotors", 1, "V");
    expect(updated.rotors).toEqual(["I", "V", "III"]);
    expect(DEFAULT_CONFIG.rotors).toEqual(["I", "II", "III"]);
  });

  it("previews nonzero window and ring settings without applying them or rewriting the previous trace", () => {
    const applied = { ...cloneConfig(DEFAULT_CONFIG), plugboard: "AZ" };
    const oldTrace = encryptKey(applied, "A");
    const oldTraceSnapshot = JSON.stringify(oldTrace);
    const appliedSnapshot = JSON.stringify(applied);
    const windowDraft = updateRotorDraft(applied, "positions", 2, 12);
    const ringDraft = updateRotorDraft(windowDraft, "rings", 2, 5);
    const preview = previewConfig({ ...ringDraft, reflector: "C" }, applied);
    expect(preview.positions).toEqual([0, 0, 12]);
    expect(preview.rings).toEqual([0, 0, 5]);
    expect(preview.positions[2] - preview.rings[2]).toBe(7);
    expect(preview.reflector).toBe("C");
    expect(preview.plugboard).toBe("AZ");
    expect(JSON.stringify(applied)).toBe(appliedSnapshot);
    expect(JSON.stringify(oldTrace)).toBe(oldTraceSnapshot);
    expect(oldTrace.after).toEqual([0, 0, 1]);

    // A caller may explicitly adopt a clone later; previewing alone neither
    // advances the pending window nor shares mutable tuple arrays with it.
    const explicitlyApplied = cloneConfig(preview);
    preview.positions[2] = 25;
    preview.rings[2] = 9;
    preview.rotors[0] = "IV";
    expect(explicitlyApplied.positions).toEqual([0, 0, 12]);
    expect(explicitlyApplied.rings).toEqual([0, 0, 5]);
    expect(ringDraft.positions).toEqual([0, 0, 12]);
    expect(ringDraft.rings).toEqual([0, 0, 5]);
    expect(ringDraft.rotors).toEqual(["I", "II", "III"]);
    expect(JSON.stringify(applied)).toBe(appliedSnapshot);
    expect(JSON.stringify(oldTrace)).toBe(oldTraceSnapshot);
  });

  it.each(["A", "AB AC"])(
    "retains applied plugs for invalid draft %s while previewing the other settings",
    (plugboard) => {
      const applied = { ...cloneConfig(DEFAULT_CONFIG), plugboard: "AZ" };
      const draft = updateRotorDraft(
        { ...cloneConfig(DEFAULT_CONFIG), plugboard },
        "rings",
        1,
        19,
      );
      const preview = previewConfig(draft, applied);
      expect(preview.plugboard).toBe("AZ");
      expect(preview.rings).toEqual([0, 19, 0]);
      expect(draft.plugboard).toBe(plugboard);
      expect(applied.rings).toEqual([0, 0, 0]);
    },
  );

  it("previews a valid new pair and a cleared board immediately", () => {
    const applied = { ...cloneConfig(DEFAULT_CONFIG), plugboard: "AZ" };
    for (const plugboard of ["by", ""]) {
      expect(previewConfig({ ...applied, plugboard }, applied).plugboard).toBe(
        plugboard,
      );
    }
    expect(applied.plugboard).toBe("AZ");
  });

  it("rejects invalid edit values and indices without mutating the draft", () => {
    const draft = cloneConfig(DEFAULT_CONFIG);
    const snapshot = JSON.stringify(draft);
    expect(() => updateRotorDraft(draft, "rotors", 0, 2)).toThrow();
    expect(() => updateRotorDraft(draft, "positions", 0, "I")).toThrow();
    expect(() => updateRotorDraft(draft, "rings", 1, 26)).toThrow();
    expect(() =>
      updateRotorDraft(draft, "rotors", 0, "VI" as RotorId),
    ).toThrow();
    expect(() => updateRotorDraft(draft, "positions", 3 as 0, 1)).toThrow();
    expect(JSON.stringify(draft)).toBe(snapshot);
  });
});
