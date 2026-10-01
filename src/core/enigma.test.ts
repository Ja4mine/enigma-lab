import { describe, expect, it } from "vitest";
import {
  ALPHABET,
  DEFAULT_CONFIG,
  REFLECTORS,
  ROTORS,
  cloneConfig,
  encryptKey,
  encryptText,
  letter,
  mod26,
  plugboardMapping,
  rotorMapping,
  validateConfig,
  type MachineConfig,
  type RotorId,
} from "./enigma";

const fresh = (overrides: Partial<MachineConfig> = {}): MachineConfig => ({
  ...cloneConfig(DEFAULT_CONFIG),
  ...overrides,
});
const positionText = (values: number[]) => values.map(letter).join("");

describe("published Enigma I reference vectors", () => {
  it("I II III / reflector B / rings AAA / windows AAA: AAAAA → BDZGO", () => {
    expect(encryptText(fresh(), "AAAAA").ciphertext).toBe("BDZGO");
  });
  it("I II III / reflector B / rings AAA / windows AAA: HELLOWORLD → ILBDAAMTAZ", () => {
    expect(encryptText(fresh(), "HELLOWORLD").ciphertext).toBe("ILBDAAMTAZ");
  });
  it("decrypts the reference vector with the same initial settings", () => {
    expect(encryptText(fresh(), "ILBDAAMTAZ").ciphertext).toBe("HELLOWORLD");
  });
  it("decrypts a historical army message with B/U/L rings and ten plug pairs", () => {
    // Rijmenants simulator manual / Weierud and Sullivan. Independent fixture:
    // https://github.com/gremmie/enigma/blob/master/enigma/tests/test_enigma.py
    // RFUGZ is the unencrypted identification group and is excluded here.
    const daily = fresh({
      rotors: ["II", "IV", "V"],
      reflector: "B",
      rings: [1, 20, 11],
      positions: [22, 23, 2],
      plugboard: "AV BS CG DL FU HZ IN KM OW RX",
    });
    const messageKey = encryptText(daily, "KCH").ciphertext;
    const messageConfig = {
      ...daily,
      positions: [...messageKey].map((char) =>
        ALPHABET.indexOf(char),
      ) as MachineConfig["positions"],
    };
    const ciphertext =
      `EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK
      UBPMM YLKLT TDEIS MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY
      SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK`.replace(
        /\s/g,
        "",
      );
    const expected =
      `AUFKL XABTE ILUNG XVONX KURTI NOWAX KURTI NOWAX NORDW ESTLX SEBEZ XSEBE
      ZXUAF FLIEG ERSTR ASZER IQTUN GXDUB ROWKI XDUBR OWKIX OPOTS CHKAX OPOTS
      CHKAX UMXEI NSAQT DREIN ULLXU HRANG ETRET ENXAN GRIFF XINFX RGTX`.replace(
        /\s/g,
        "",
      );
    expect(encryptText(messageConfig, ciphertext).ciphertext).toBe(expected);
  });
  it("trace of first A follows the complete physical path, after stepping", () => {
    const result = encryptKey(fresh(), "A");
    expect(positionText(result.before)).toBe("AAA");
    expect(positionText(result.after)).toBe("AAB");
    expect(result.stepped).toEqual([false, false, true]);
    expect(result.stages.map((stage) => stage.id)).toEqual([
      "plug-in",
      "right-forward",
      "middle-forward",
      "left-forward",
      "reflector",
      "left-reverse",
      "middle-reverse",
      "right-reverse",
      "plug-out",
    ]);
    // Independently hand-traced from the published wiring tables.
    expect(
      result.stages.map(
        (stage) => `${letter(stage.input)}${letter(stage.output)}`,
      ),
    ).toEqual(["AA", "AC", "CD", "DF", "FS", "SS", "SE", "EB", "BB"]);
    expect(result.stages[1]).toMatchObject({
      position: 1,
      ring: 0,
      shiftedInput: 1,
      wiredOutput: 3,
    });
  });
});

describe("pawl stepping and turnover", () => {
  it("performs the middle double-step: ADU → ADV → AEW → BFX", () => {
    let config = fresh({ positions: [0, 3, 20] });
    const states = [positionText(config.positions)];
    const stepped = [];
    const doubleSteps = [];
    for (let index = 0; index < 3; index++) {
      const result = encryptKey(config, "A");
      states.push(positionText(result.after));
      stepped.push(result.stepped);
      doubleSteps.push(result.doubleStep);
      config = { ...config, positions: result.after };
    }
    expect(states).toEqual(["ADU", "ADV", "AEW", "BFX"]);
    expect(stepped).toEqual([
      [false, false, true],
      [false, true, true],
      [true, true, true],
    ]);
    expect(doubleSteps).toEqual([false, false, true]);
  });
  it.each([
    ["I", 16],
    ["II", 4],
    ["III", 21],
    ["IV", 9],
    ["V", 25],
  ] as [RotorId, number][])(
    "%s turns over at its published notch",
    (rotor, notch) => {
      const other = (Object.keys(ROTORS) as RotorId[]).filter(
        (id) => id !== rotor,
      );
      const config = fresh({
        rotors: [other[0], other[1], rotor],
        positions: [0, 0, notch],
      });
      expect(encryptKey(config, "A").after[1]).toBe(1);
      config.positions[2] = mod26(notch - 1);
      expect(encryptKey(config, "A").after[1]).toBe(0);
    },
  );
  it("turnover follows the alphabet-ring window and is unaffected by Ringstellung", () => {
    for (let ring = 0; ring < 26; ring++) {
      expect(
        encryptKey(
          fresh({ positions: [0, 3, 21], rings: [ring, ring, ring] }),
          "A",
        ).after,
      ).toEqual([0, 4, 22]);
      expect(
        encryptKey(
          fresh({ positions: [0, 4, 22], rings: [ring, ring, ring] }),
          "A",
        ).after,
      ).toEqual([1, 5, 23]);
    }
  });
  it("senses both notches before stepping and never advances a rotor twice in one keypress", () => {
    const result = encryptKey(fresh({ positions: [0, 4, 21] }), "A");
    expect(result.after).toEqual([1, 5, 22]);
    expect(result.stepped).toEqual([true, true, true]);
  });
  it("wraps Z to A and does not use the left rotor notch to advance anything", () => {
    expect(encryptKey(fresh({ positions: [16, 0, 25] }), "A").after).toEqual([
      16, 0, 0,
    ]);
  });
});

describe("wiring and ring settings", () => {
  it.each(Object.keys(ROTORS) as RotorId[])(
    "%s is a 26-contact bijection with the correct inverse",
    (id) => {
      const rotor = ROTORS[id];
      expect([...new Set(rotor.forward)].sort((a, b) => a - b)).toEqual([
        ...Array(26).keys(),
      ]);
      rotor.forward.forEach((output, input) =>
        expect(rotor.reverse[output]).toBe(input),
      );
      for (let position = 0; position < 26; position++) {
        for (let ring = 0; ring < 26; ring++) {
          const forward = rotorMapping(id, position, ring, "forward");
          const reverse = rotorMapping(id, position, ring, "reverse");
          forward.forEach((output, input) =>
            expect(reverse[output]).toBe(input),
          );
        }
      }
    },
  );
  it("ring offset changes the internal mapping in the opposite direction to the window", () => {
    // Rotor I, input A, position A, ring B: Z → J internally, then J + 1 = K.
    expect(rotorMapping("I", 0, 1, "forward")[0]).toBe(10);
    expect(rotorMapping("I", 1, 1, "forward")).toEqual(
      rotorMapping("I", 0, 0, "forward"),
    );
    expect(rotorMapping("I", 0, 1, "forward")).toEqual(
      rotorMapping("I", 25, 0, "forward"),
    );
  });
  it.each(["B", "C"] as const)(
    "reflector %s has 13 reciprocal pairs and no self-connection",
    (id) => {
      const reflector = REFLECTORS[id].contacts;
      reflector.forEach((output, input) => {
        expect(output).not.toBe(input);
        expect(reflector[output]).toBe(input);
      });
    },
  );
  it("all traces remain continuous and expose the same mappings used by encryption", () => {
    const { steps } = encryptText(
      fresh({
        rotors: ["V", "III", "IV"],
        reflector: "C",
        rings: [7, 19, 25],
        positions: [8, 15, 9],
        plugboard: "AV BS CG DL FU HZ IN KM OW RX",
      }),
      ALPHABET.repeat(4),
    );
    for (const step of steps) {
      expect(letter(step.stages[0].input)).toBe(step.input);
      expect(letter(step.stages[8].output)).toBe(step.output);
      step.stages.forEach((stage, index) => {
        expect(stage.output).toBe(stage.activeWiring[stage.input]);
        if (index) expect(stage.input).toBe(step.stages[index - 1].output);
        if (stage.rotorId) {
          expect(stage.shiftedInput).toBe(
            mod26(stage.input + stage.position! - stage.ring!),
          );
          expect(stage.wiredOutput).toBe(
            ROTORS[stage.rotorId][stage.direction!][stage.shiftedInput!],
          );
          expect(stage.output).toBe(
            mod26(stage.wiredOutput! - stage.position! + stage.ring!),
          );
        }
      });
    }
  });
});

describe("reciprocity, plugboard, and deterministic state", () => {
  it.each(["B", "C"] as const)(
    "round-trips long text through %s with nontrivial rings and 10 plug pairs",
    (reflector) => {
      const config = fresh({
        rotors: ["IV", "V", "II"],
        reflector,
        positions: [19, 24, 3],
        rings: [1, 7, 22],
        plugboard: "AV BS CG DL FU HZ IN KM OW RX",
      });
      const input = ALPHABET.repeat(70);
      const encrypted = encryptText(config, input).ciphertext;
      expect(encryptText(config, encrypted).ciphertext).toBe(input);
      [...encrypted].forEach((char, index) =>
        expect(char).not.toBe(input[index]),
      );
    },
  );
  it("plugboard swaps disjoint pairs in both directions and leaves all other letters alone", () => {
    const mapping = plugboardMapping("az BY\n cx");
    expect(mapping[0]).toBe(25);
    expect(mapping[25]).toBe(0);
    expect(mapping[1]).toBe(24);
    expect(mapping[3]).toBe(3);
    mapping.forEach((output, input) => expect(mapping[output]).toBe(input));
  });
  it("never mutates caller configuration and can resume at a returned state", () => {
    const config = fresh();
    const snapshot = JSON.stringify(config);
    const first = encryptText(config, "HELLO");
    expect(JSON.stringify(config)).toBe(snapshot);
    expect(
      first.ciphertext + encryptText(first.config, "WORLD").ciphertext,
    ).toBe("ILBDAAMTAZ");
    first.config.rings[0] = 1;
    first.config.rotors[0] = "IV";
    expect(JSON.stringify(config)).toBe(snapshot);
  });
  it("accepts lowercase letters, preserves nonletters, and steps only for letters", () => {
    const result = encryptText(fresh(), "Hello, world! 123");
    expect(result.ciphertext).toBe("ILBDA, AMTAZ! 123");
    expect(result.steps).toHaveLength(10);
    expect(result.config.positions).toEqual([0, 0, 10]);
  });
});

describe("configuration validation", () => {
  it("accepts all supported components and a complete ordinary plugboard", () => {
    expect(() =>
      validateConfig(
        fresh({
          rotors: ["III", "IV", "V"],
          reflector: "C",
          plugboard: "AB CD EF GH IJ KL MN OP QR ST",
        }),
      ),
    ).not.toThrow();
  });
  it("rejects duplicate or unknown rotors and unknown reflectors", () => {
    expect(() => validateConfig(fresh({ rotors: ["I", "I", "III"] }))).toThrow(
      "同一个实体转子",
    );
    expect(() =>
      validateConfig(fresh({ rotors: ["I", "II", "VI" as RotorId] })),
    ).toThrow("有效转子");
    expect(() => validateConfig(fresh({ reflector: "D" as "B" }))).toThrow(
      "反射器",
    );
  });
  it.each([-1, 26, 0.5, NaN, Infinity])(
    "rejects invalid position or ring %s",
    (value) => {
      expect(() => validateConfig(fresh({ positions: [0, 0, value] }))).toThrow(
        "窗口位置",
      );
      expect(() => validateConfig(fresh({ rings: [0, value, 0] }))).toThrow(
        "环设置",
      );
    },
  );
  it.each([
    "A",
    "ABC",
    "A1",
    "AB,CD",
    "AA",
    "AB AC",
    "AB BA",
    "AB CD EF GH IJ KL MN OP QR ST UV",
  ])("rejects invalid plugboard %s", (plugboard) => {
    expect(() => validateConfig(fresh({ plugboard }))).toThrow();
  });
  it.each(["", "AB", "1", "中", "ß", " "])(
    "rejects non-key input %s",
    (input) => {
      expect(() => encryptKey(fresh(), input)).toThrow("A–Z");
    },
  );
});
