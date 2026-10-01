import { describe, expect, it } from "vitest";
import {
  cloneConfig,
  DEFAULT_CONFIG,
  encryptKey,
  mod26,
  type Triple,
} from "./enigma";
import { mechanicalStrokePose, RATCHET_TOOTH_ANGLE } from "./mechanical-motion";

function keyAt(windows: string) {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.positions = [...windows].map(
    (letter) => letter.charCodeAt(0) - 65,
  ) as Triple<number>;
  return encryptKey(config, "A");
}

const cases = [
  {
    name: "ordinary key",
    before: "ADU",
    after: "ADV",
    stepped: [false, false, true],
  },
  {
    name: "right rotor turnover",
    before: "ADV",
    after: "AEW",
    stepped: [false, true, true],
  },
  {
    name: "middle rotor double step",
    before: "AEW",
    after: "BFX",
    stepped: [true, true, true],
  },
  {
    name: "nonzero windows crossing Z to A",
    before: "MDZ",
    after: "MDA",
    stepped: [false, false, true],
  },
] as const;

function windowText(angles: number[]) {
  return angles
    .map((angle) =>
      String.fromCharCode(65 + mod26(Math.round(angle / RATCHET_TOOTH_ANGLE))),
    )
    .join("");
}

describe("the mechanical teaching stroke follows actual encryption decisions", () => {
  for (const fixture of cases) {
    it(`${fixture.name}: ${fixture.before} → ${fixture.after}`, () => {
      const key = keyAt(fixture.before);
      const actualAfter = key.after
        .map((position) => String.fromCharCode(65 + position))
        .join("");
      expect(actualAfter).toBe(fixture.after);
      expect(key.stepped).toEqual(fixture.stepped);
      expect(
        windowText(
          mechanicalStrokePose(key.before, key.stepped, 0).rotorAngles,
        ),
      ).toBe(fixture.before);
      expect(
        windowText(
          mechanicalStrokePose(key.before, key.stepped, 1).rotorAngles,
        ),
      ).toBe(actualAfter);
      let previous = mechanicalStrokePose(key.before, key.stepped, 0);
      for (let frame = 1; frame <= 240; frame++) {
        const current = mechanicalStrokePose(
          key.before,
          key.stepped,
          frame / 240,
        );
        for (let index = 0; index < 3; index++) {
          // No rotor may run backwards, even while its pawl returns.
          expect(current.rotorAngles[index]).toBeGreaterThanOrEqual(
            previous.rotorAngles[index],
          );
          // A disengaged pawl must never create motion at any point in the cycle.
          if (!key.stepped[index])
            expect(current.rotorAngles[index]).toBe(
              key.before[index] * RATCHET_TOOTH_ANGLE,
            );
          // A visible one-frame jump would indicate a discontinuous Z→A wrap.
          expect(
            current.rotorAngles[index] - previous.rotorAngles[index],
          ).toBeLessThan(RATCHET_TOOTH_ANGLE / 20);
        }
        previous = current;
      }
      for (let index = 0; index < 3; index++) {
        const displacement =
          previous.rotorAngles[index] - key.before[index] * RATCHET_TOOTH_ANGLE;
        expect(displacement).toBeCloseTo(
          key.stepped[index] ? RATCHET_TOOTH_ANGLE : 0,
          12,
        );
      }
      const duringReturn = mechanicalStrokePose(key.before, key.stepped, 0.83);
      expect(duringReturn.recovery).toBeGreaterThan(0);
      expect(duringReturn.recovery).toBeLessThan(1);
      expect(duringReturn.rotorAngles).toEqual(previous.rotorAngles);
      expect(previous.rocker).toBe(0);
      expect(previous.recovery).toBe(1);
    });
  }

  it("clamps seeking to the actual stroke's first and last positions", () => {
    const key = keyAt("MDZ");
    expect(mechanicalStrokePose(key.before, key.stepped, -0.5)).toEqual(
      mechanicalStrokePose(key.before, key.stepped, 0),
    );
    expect(mechanicalStrokePose(key.before, key.stepped, 1.5)).toEqual(
      mechanicalStrokePose(key.before, key.stepped, 1),
    );
    expect(
      mechanicalStrokePose(key.before, key.stepped, 1).rotorAngles[2],
    ).toBeCloseTo(Math.PI * 2, 12);
  });
});
