import { describe, expect, it } from "vitest";
import { CatmullRomCurve3, Vector3 } from "three";
import {
  ALPHABET,
  DEFAULT_CONFIG,
  REFLECTORS,
  ROTORS,
  encryptKey,
  mod26,
  type RotorId,
} from "./enigma";
import {
  contactPoint,
  describeStage,
  pathPointsForStage,
  reflectorWirePoints,
  rotateXPoint,
  rotorWirePoints,
  type Point3,
} from "./visual-paths";

function expectSamePoint(actual: Point3, expected: Point3): void {
  actual.forEach((coordinate, axis) => {
    expect(coordinate).toBeCloseTo(expected[axis], 10);
  });
}

describe("3D signal paths derived from the electrical trace", () => {
  it("puts contact A at the top and aligns positive core rotation correctly", () => {
    expectSamePoint(contactPoint(0, 0.33), [0.33, 0.516, 0]);
    expectSamePoint(contactPoint(13, -0.33), [-0.33, -0.516, 0]);
    expectSamePoint(rotateXPoint(contactPoint(1, 0.33), 1), [0.33, 0.516, 0]);
  });

  it.each(Object.keys(ROTORS) as RotorId[])(
    "%s: active physical wires meet the correct stationary contacts at every window/ring setting",
    (rotorId) => {
      const others = (Object.keys(ROTORS) as RotorId[]).filter(
        (id) => id !== rotorId,
      );
      for (let position = 0; position < 26; position++) {
        for (let ring = 0; ring < 26; ring++) {
          const result = encryptKey(
            {
              ...DEFAULT_CONFIG,
              rotors: [others[0], others[1], rotorId],
              positions: [mod26(position + 7), mod26(position + 15), position],
              rings: [mod26(ring + 11), mod26(ring + 19), ring],
            },
            ALPHABET[mod26(position * 7 + ring * 11)],
          );
          for (const stage of result.stages) {
            const description = describeStage(stage);
            if (description.kind !== "rotor") continue;
            const points = pathPointsForStage(stage)!;
            const wire = ROTORS[stage.rotorId!].forward;
            expect(wire[description.wireFrom]).toBe(description.wireTo);
            expect(description.position).toBe(
              result.after[description.rotorIndex],
            );
            const offset = description.position - description.ring;
            const inputFace = description.reverse ? -0.33 : 0.33;
            const outputFace = -inputFace;
            expectSamePoint(
              rotateXPoint(points[0], offset),
              contactPoint(stage.input, inputFace),
            );
            expectSamePoint(
              rotateXPoint(points[points.length - 1], offset),
              contactPoint(stage.output, outputFace),
            );
          }
        }
      }
    },
  );

  it("traverses the existing forward wire backwards on the return leg", () => {
    const result = encryptKey(DEFAULT_CONFIG, "A");
    const stage = result.stages.find((item) => item.id === "right-reverse")!;
    // AAA → AAB: return E enters core F; III's C → F wire leads back to B.
    expect(describeStage(stage)).toEqual({
      kind: "rotor",
      input: 4,
      output: 1,
      wireFrom: 2,
      wireTo: 5,
      reverse: true,
      rotorIndex: 2,
      position: 1,
      ring: 0,
    });
    expect(pathPointsForStage(stage)).toEqual(rotorWirePoints(2, 5).reverse());
  });

  it.each([
    {
      key: "A",
      output: "U",
      stageId: "right-forward",
      external: [25, 0],
      core: [0, 1],
      reverse: false,
    },
    {
      key: "U",
      output: "A",
      stageId: "right-reverse",
      external: [0, 25],
      core: [1, 0],
      reverse: true,
    },
  ])(
    "AZ plugboard / key $key: $stageId distinguishes stationary Z↔A from the III core's A↔B wire",
    ({ key, output, stageId, external, core, reverse }) => {
      // Independently checked with Py-Enigma 1.0.2, I II III / B / AAA,
      // ring AAA / plugs AZ. Every keypress first advances the window to AAB.
      // III's published fixed wiring starts BDF..., hence its A→B wire.
      // Forward: external Z + 1 = core A → B; core B − 1 = external A.
      // Return: external A + 1 = core B → A; core A − 1 = external Z.
      const result = encryptKey({ ...DEFAULT_CONFIG, plugboard: "AZ" }, key);
      const stage = result.stages.find((item) => item.id === stageId)!;
      expect(result.output).toBe(output);
      expect(result.after).toEqual([0, 0, 1]);
      expect(stage).toMatchObject({
        rotorId: "III",
        position: 1,
        ring: 0,
        input: external[0],
        output: external[1],
        shiftedInput: core[0],
        wiredOutput: core[1],
      });
      expect(ROTORS.III.forward[0]).toBe(1);
      expect(describeStage(stage)).toMatchObject({
        kind: "rotor",
        wireFrom: 0,
        wireTo: 1,
        reverse,
      });
      const points = pathPointsForStage(stage)!;
      const physicalWire = rotorWirePoints(0, 1);
      expect(points).toEqual(reverse ? physicalWire.reverse() : physicalWire);

      // Independent world coordinates: with the wired core turned one notch,
      // its right-side A contact sits at fixed Z, and left-side B sits at A.
      const step = (Math.PI * 2) / 26;
      const fixedZ: Point3 = [
        0.33,
        0.516 * Math.cos(step),
        0.516 * Math.sin(step),
      ];
      const fixedA: Point3 = [-0.33, 0.516, 0];
      expectSamePoint(rotateXPoint(points[0], 1), reverse ? fixedA : fixedZ);
      expectSamePoint(
        rotateXPoint(points[points.length - 1], 1),
        reverse ? fixedZ : fixedA,
      );
    },
  );

  it.each(["B", "C"] as const)(
    "reflector %s uses its actual reciprocal wire on one face",
    (reflector) => {
      for (const input of ALPHABET) {
        const result = encryptKey({ ...DEFAULT_CONFIG, reflector }, input);
        const stage = result.stages.find((item) => item.id === "reflector")!;
        const description = describeStage(stage);
        expect(description.kind).toBe("reflector");
        expect(REFLECTORS[reflector].contacts[description.wireFrom]).toBe(
          description.wireTo,
        );
        const points = pathPointsForStage(stage)!;
        expectSamePoint(points[0], contactPoint(stage.input, 0.21));
        expectSamePoint(points.at(-1)!, contactPoint(stage.output, 0.21));
        expect(points).toEqual(
          reflectorWirePoints(stage.output, stage.input).reverse(),
        );
      }
    },
  );

  it.each(["B", "C"] as const)(
    "reflector %s keeps all 13 smoothed wires and their current markers clear of the central shaft",
    (reflector) => {
      const pairs = REFLECTORS[reflector].contacts.flatMap((to, from) =>
        from < to ? [[from, to] as const] : [],
      );
      expect(pairs).toHaveLength(13);
      for (const [from, to] of pairs) {
        const curve = new CatmullRomCurve3(
          reflectorWirePoints(from, to).map((point) => new Vector3(...point)),
        );
        // Check the rendered interpolant, including the A→Y wraparound and
        // diametric F↔S / C↔P paths that a straight chord sent through the axle.
        for (const point of curve.getPoints(512)) {
          const radialDistance = Math.hypot(point.y, point.z);
          expect(radialDistance - 0.044).toBeGreaterThan(0.1);
          expect(radialDistance + 0.044).toBeLessThan(0.695);
          expect(point.x).toBeGreaterThan(-0.195);
          expect(point.x).toBeLessThanOrEqual(0.21 + 1e-10);
        }
      }
    },
  );

  it.each(["B", "C"] as const)(
    "reflector %s preserves every contact and follows the identical physical wire in either direction",
    (reflector) => {
      REFLECTORS[reflector].contacts.forEach((to, from) => {
        const points = reflectorWirePoints(from, to);
        expectSamePoint(points[0], contactPoint(from, 0.21));
        expectSamePoint(points.at(-1)!, contactPoint(to, 0.21));
        expect(points).toEqual(reflectorWirePoints(to, from).reverse());
        const outward = new CatmullRomCurve3(
          points.map((point) => new Vector3(...point)),
        );
        const returning = new CatmullRomCurve3(
          reflectorWirePoints(to, from).map((point) => new Vector3(...point)),
        );
        for (const progress of [0.07, 0.31, 0.5, 0.82, 0.96])
          expect(
            outward
              .getPoint(progress)
              .distanceTo(returning.getPoint(1 - progress)),
          ).toBeLessThan(1e-10);
      });
    },
  );

  it("exposes the actual plugboard swap on both passes, including an unplugged contact", () => {
    const fromA = encryptKey({ ...DEFAULT_CONFIG, plugboard: "AB" }, "A");
    expect(describeStage(fromA.stages[0])).toMatchObject({
      kind: "plugboard",
      input: 0,
      output: 1,
      wireFrom: 0,
      wireTo: 1,
      reverse: false,
    });
    const fromD = encryptKey({ ...DEFAULT_CONFIG, plugboard: "AB" }, "D");
    const outputStage = fromA.stages.at(-1)!;
    expect(describeStage(outputStage)).toMatchObject({
      kind: "plugboard",
      input: 0,
      output: 1,
      wireFrom: 0,
      wireTo: 1,
      reverse: true,
    });
    expect(describeStage(fromD.stages[0])).toMatchObject({
      input: 3,
      output: 3,
      wireFrom: 3,
      wireTo: 3,
    });
    expect(pathPointsForStage(fromA.stages[0])).toBeUndefined();
  });

  it("rejects an incomplete rotor trace instead of drawing a guessed connection", () => {
    const stage = encryptKey(DEFAULT_CONFIG, "A").stages[1];
    expect(() => describeStage({ ...stage, wiredOutput: undefined })).toThrow(
      "Incomplete rotor trace",
    );
  });
});
