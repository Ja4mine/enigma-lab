import { describe, expect, it } from "vitest";
import { ALPHABET, encryptKey, encryptText, mod26, type MachineConfig } from "./enigma";
import {
  BombeEvaluator,
  BombeRun,
  POSITIONS,
  WHEEL_ORDERS,
  analyseStop,
  buildMenu,
  chase,
  coreAt,
  coreOf,
  crashes,
  cribOffsets,
  fastEnigma,
  indexOf,
  propagate,
  recoverKey,
  scrambler,
  steckerText,
  turnoverInside,
  type BombeSpec,
} from "./bombe";
import { DEFAULT_SCENARIO, randomScenario } from "./scenario";
import fixture from "./reference-vectors.json";

const L = (ch: string) => ALPHABET.indexOf(ch);
const scenario = DEFAULT_SCENARIO;
const segment = scenario.ciphertext.slice(
  scenario.cribOffset,
  scenario.cribOffset + scenario.crib.length,
);
const menu = buildMenu(scenario.crib, segment);
const spec = (overrides: Partial<BombeSpec> = {}): BombeSpec => ({
  rotors: scenario.key.rotors,
  reflector: scenario.key.reflector,
  menu,
  diagonal: true,
  inputWire: 0,
  ...overrides,
});
const trueCore = coreOf({
  positions: encryptText(scenario.key, scenario.plaintext).steps[scenario.cribOffset].after,
  rings: scenario.key.rings,
});

describe("scrambler", () => {
  it("is 60 distinct wheel orders", () => {
    expect(WHEEL_ORDERS).toHaveLength(60);
    expect(new Set(WHEEL_ORDERS.map((o) => o.join("-"))).size).toBe(60);
  });

  it("equals the traced engine without plugboard, using core = window − ring", () => {
    let seed = 5;
    const rand = () => ((seed = (seed * 69069 + 1) >>> 0), seed / 2 ** 32);
    for (let n = 0; n < 200; n++) {
      const config: MachineConfig = {
        rotors: [...WHEEL_ORDERS[Math.floor(rand() * 60)]] as MachineConfig["rotors"],
        reflector: rand() < 0.5 ? "B" : "C",
        positions: [0, 0, 0].map(() => Math.floor(rand() * 26)) as MachineConfig["positions"],
        rings: [0, 0, 0].map(() => Math.floor(rand() * 26)) as MachineConfig["rings"],
        plugboard: "",
      };
      const input = ALPHABET[Math.floor(rand() * 26)];
      const traced = encryptKey(config, input);
      const core = coreOf({ positions: traced.after, rings: config.rings });
      expect(ALPHABET[scrambler(config.rotors, config.reflector, core)[L(input)]]).toBe(
        traced.output,
      );
    }
  });

  it("is a fixed-point-free involution at every sampled position", () => {
    for (let index = 0; index < POSITIONS; index += 97) {
      const e = scrambler(["II", "IV", "I"], "B", coreAt(index));
      for (let x = 0; x < 26; x++) {
        expect(e[e[x]]).toBe(x);
        expect(e[x]).not.toBe(x);
      }
    }
  });

  it("fast engine matches the independent Py-Enigma corpus", () => {
    for (const vector of fixture.vectors.slice(0, 24)) {
      expect(fastEnigma(vector.config as MachineConfig, vector.plaintext)).toBe(vector.ciphertext);
    }
  });

  it("run index walks the top (left-rotor) drum fastest", () => {
    expect(coreAt(0)).toEqual([0, 0, 0]);
    expect(coreAt(1)).toEqual([1, 0, 0]);
    expect(coreAt(26)).toEqual([0, 1, 0]);
    expect(coreAt(676)).toEqual([0, 0, 1]);
    for (const i of [0, 17, 4321, POSITIONS - 1]) expect(indexOf(coreAt(i))).toBe(i);
  });
});

describe("crib and menu", () => {
  it("never shows a crash where the crib really is (no letter enciphers to itself)", () => {
    expect(crashes(scenario.ciphertext, scenario.crib, scenario.cribOffset)).toEqual([]);
    const offsets = cribOffsets(scenario.ciphertext, scenario.crib);
    expect(offsets.some((o) => o.crashes.length > 0)).toBe(true);
  });

  it("keeps the Bombe's no-turnover assumption for the default key", () => {
    expect(turnoverInside(scenario.key, scenario.cribOffset, scenario.crib.length)).toBe(false);
  });

  it("finds the shortest independent loops of the default menu", () => {
    expect(menu.links).toHaveLength(16);
    expect(menu.closures).toBe(menu.links.length - menu.letters.length + menu.components.length);
    expect(menu.loops).toHaveLength(3);
    const loops = menu.loops.map((loop) => loop.letters.map((l) => ALPHABET[l]).join(""));
    expect(loops).toEqual(["BE", "CWR", "ETV"]);
    for (const loop of menu.loops) {
      // Walking the loop's links really returns to the starting letter.
      let at = loop.letters[0];
      for (const i of loop.links) {
        const link = menu.links[i];
        expect(link.plain === at || link.cipher === at).toBe(true);
        at = link.plain === at ? link.cipher : link.plain;
      }
      expect(at).toBe(loop.letters[0]);
    }
    expect(ALPHABET[menu.input]).toBe("E");
  });

  it("counts closures on a hand-made menu", () => {
    // A–B at 0, B–C at 1, C–A at 2 form one triangle; D–E is a tail.
    const m = buildMenu("ABCD", "BCAE");
    expect(m.closures).toBe(1);
    expect(m.loops[0].letters.map((l) => ALPHABET[l]).join("")).toBe("ABC");
    expect(m.components).toHaveLength(2);
  });

  it("rejects a crib placed on a crash", () => {
    expect(() => buildMenu("AB", "AC")).toThrow("crash");
  });
});

describe("bombe", () => {
  it("stops at the true core; the dead test-register wire is S(E)", () => {
    const stops = new BombeRun(spec()).runToEnd();
    const hit = stops.find((s) => s.index === indexOf(trueCore));
    expect(hit).toBeTruthy();
    expect(hit!.count).toBe(25);
    const dead = [...ALPHABET].filter((_, i) => !(hit!.live & (1 << i)));
    expect(dead).toEqual(["P"]);
  });

  it("lights exactly one wire when the voltage enters on the true stecker", () => {
    const { count, live } = new BombeEvaluator(spec({ inputWire: L("P") })).evaluate(trueCore);
    expect(count).toBe(1);
    expect(live).toBe(1 << L("P"));
  });

  it("diagonal board cuts the stops from hundreds to a few", () => {
    const withBoard = new BombeRun(spec()).runToEnd().length;
    const without = new BombeRun(spec({ diagonal: false })).runToEnd().length;
    expect(withBoard).toBe(3);
    expect(without).toBe(787);
  });

  it("breadth-first current matches the union–find test register", () => {
    for (const diagonal of [true, false]) {
      const evaluator = new BombeEvaluator(spec({ diagonal }));
      for (const index of [0, 1234, 9999, indexOf(trueCore), 17000]) {
        const core = coreAt(index);
        const { live } = evaluator.evaluate(core);
        expect(propagate(spec({ diagonal }), core).masks[menu.input]).toBe(live);
      }
    }
  });

  it("current spreads symmetrically across the diagonal board", () => {
    const { masks } = propagate(spec(), coreAt(4321));
    for (let a = 0; a < 26; a++)
      for (let b = 0; b < 26; b++)
        expect(Boolean(masks[a] & (1 << b))).toBe(Boolean(masks[b] & (1 << a)));
  });

  it("checking leaves one consistent hypothesis that reproduces the plugboard", () => {
    const hypotheses = analyseStop(spec(), trueCore).filter((h) => h.consistent);
    expect(hypotheses).toHaveLength(1);
    expect(ALPHABET[hypotheses[0].wire]).toBe("P");
    expect(steckerText(hypotheses[0].steckers)).toBe(scenario.key.plugboard);
  });

  it("false stops of the true wheel order fail the consistency check", () => {
    const stops = new BombeRun(spec()).runToEnd();
    const consistent = stops.filter((s) => analyseStop(spec(), s.core).some((h) => h.consistent));
    expect(consistent.map((s) => s.index)).toEqual([indexOf(trueCore)]);
  });

  it("recovers ring settings, start windows, and the full plaintext", () => {
    const hypothesis = analyseStop(spec(), trueCore).find((h) => h.consistent)!;
    const key = recoverKey(
      scenario.ciphertext,
      scenario.cribOffset,
      scenario.key.rotors,
      scenario.key.reflector,
      trueCore,
      hypothesis.steckers,
    );
    expect(key.plaintext).toBe(scenario.plaintext);
    expect(key.config.plugboard).toBe(scenario.key.plugboard);
    // The right ring decides where the middle rotor turns; it must be exact.
    expect(key.config.rings[2]).toBe(scenario.key.rings[2]);
    expect(key.determinedRings[2]).toBe(true);
    // Core offsets (window − ring) are what the wiring sees.
    expect(mod26(key.config.positions[2] - key.config.rings[2])).toBe(
      mod26(scenario.key.positions[2] - scenario.key.rings[2]),
    );
  });

  it("random scenarios keep the crib clear of turnovers and decrypt back", () => {
    for (const seed of [1, 2, 3]) {
      const s = randomScenario(seed);
      expect(turnoverInside(s.key, s.cribOffset, s.crib.length)).toBe(false);
      expect(fastEnigma(s.key, s.ciphertext)).toBe(s.plaintext);
      expect(crashes(s.ciphertext, s.crib, s.cribOffset)).toEqual([]);
    }
  });

  it("hand-following the menu: true guess never clashes, wrong guesses do", () => {
    const menu = buildMenu(scenario.crib, segment);
    const spec: BombeSpec = { rotors: scenario.key.rotors, reflector: "B", menu, diagonal: false, inputWire: 0 };
    const core = coreOf({
      positions: encryptText(scenario.key, scenario.plaintext).steps[scenario.cribOffset].after,
      rings: scenario.key.rings,
    });
    const truth = chase(spec, core, L("E"), L("P"));
    expect(truth.failed).toBe(false);
    expect(truth.steps.some((s) => s.closesLoop)).toBe(true);
    const plug = new Map(scenario.key.plugboard.split(" ").flatMap((p) => [[p[0], p[1]], [p[1], p[0]]] as [string, string][]));
    for (const [letter, value] of truth.known) {
      const ch = ALPHABET[letter];
      expect(ALPHABET[value]).toBe(plug.get(ch) ?? ch);
    }
    const failures = Array.from({ length: 26 }, (_, v) => chase(spec, core, L("E"), v)).filter((r) => r.failed).length;
    expect(failures).toBe(25);
  });
});
