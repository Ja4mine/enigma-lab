/**
 * Independent oracle: py-enigma 1.0.2 from PyPI (Brian Neal, MIT).
 * https://pypi.org/project/py-enigma/1.0.2/
 * https://github.com/gremmie/enigma
 *
 * Fixtures were produced by its EnigmaMachine.key_press / get_display calls,
 * never by this application's engine. Package provenance, hash, deterministic
 * seed, index conventions, and coverage are stored alongside the vectors.
 * All 60 distinct orders from I-V are tested with both B/C reflectors and long
 * streams crossing turnover; ring offsets and 0-10 disjoint plugs vary.
 */
import { describe, expect, it } from "vitest";
import { encryptText, type MachineConfig } from "./enigma";
import fixture from "./reference-vectors.json";

interface ReferenceVector {
  id: string;
  config: MachineConfig;
  plaintext: string;
  ciphertext: string;
  finalPositions: MachineConfig["positions"];
  checkpoints: { afterKey: number; positions: MachineConfig["positions"] }[];
}

const vectors = fixture.vectors as ReferenceVector[];

describe("independent Py-Enigma 1.0.2 cross-implementation vectors", () => {
  it("contains the documented complete 60-order, two-reflector reference corpus", () => {
    expect(fixture.provenance.package).toBe("py-enigma");
    expect(fixture.provenance.version).toBe("1.0.2");
    expect(vectors).toHaveLength(120);
    expect(
      new Set(vectors.map((vector) => vector.config.rotors.join("-"))).size,
    ).toBe(60);
    expect(new Set(vectors.map((vector) => vector.config.reflector))).toEqual(
      new Set(["B", "C"]),
    );
    expect(
      new Set(
        vectors.map(
          (vector) =>
            vector.config.plugboard.trim().split(/\s+/).filter(Boolean).length,
        ),
      ),
    ).toEqual(new Set(Array.from({ length: 11 }, (_, index) => index)));
    expect(
      vectors.reduce((total, vector) => total + vector.plaintext.length, 0),
    ).toBe(fixture.coverage.totalCharacters);
    expect(
      Math.min(...vectors.map((vector) => vector.plaintext.length)),
    ).toBeGreaterThanOrEqual(728);
  });

  it.each(vectors)(
    "$id: ciphertext, final windows, and intermediate rotor positions match",
    (vector) => {
      const result = encryptText(vector.config, vector.plaintext);
      expect(result.ciphertext).toBe(vector.ciphertext);
      expect(result.config.positions).toEqual(vector.finalPositions);
      for (const checkpoint of vector.checkpoints) {
        expect(
          result.steps[checkpoint.afterKey - 1].after,
          `windows after key ${checkpoint.afterKey}`,
        ).toEqual(checkpoint.positions);
      }
    },
  );
});
