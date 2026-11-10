import * as THREE from "three";
import { Exhibit } from "../../engine/Exhibit";
import { materials } from "../../engine/materials";
import { fasteners, seamRings } from "../../engine/fittings";
import {
  STEP,
  annulusX,
  anchor,
  boxGeo,
  cylX,
  cylY,
  cylZ,
  gearX,
  group,
  instanced,
  mesh,
  onCircle,
  roundedBox,
  tubes,
} from "../../engine/shapes";
import { glyphTexture, plateTexture, ringLabelTexture, LETTER_FONT } from "../../engine/textures";
import { REFLECTORS, ROTORS, type KeyResult, type MachineConfig, type ReflectorId, type RotorId } from "../../core/enigma";
import { ENIGMA_PARTS, SLOTS, enigmaSteps, type Slot } from "./catalog";

export const ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
const A = (ch: string) => ch.charCodeAt(0) - 65;

/** Contact circle radius shared by every wheel face. */
const RC = 2.35;
const AXIS_Y = 8.4;
const AXIS_Z = -8.8;
/** Rotor centres along x inside the rotor set; ETW is fixed to the chassis. */
const SLOT_X: Record<Slot, number> = { l: -5.25, m: -2.2, r: 0.85 };
const UKW_X = -7.95;
const ETW_X = 3.25;
/** Angle where the notch meets its pawl (only affects where the notch is drawn). */
const PAWL_PHI = Math.PI * 0.82;

function layout(row: number, i: number, pitch: number) {
  const n = ROWS[row].length;
  return (i - (n - 1) / 2) * pitch;
}

/* ------------------------------------------------------------------ */
/* Rotor                                                               */
/* ------------------------------------------------------------------ */

const wiringCache = new Map<string, THREE.BufferGeometry>();
function rotorWiring(type: RotorId) {
  if (!wiringCache.has(type)) {
    const W = ROTORS[type].forward;
    const curves = Array.from({ length: 26 }, (_, j) => {
      const a = j * STEP,
        b = W[j] * STEP;
      return new THREE.CubicBezierCurve3(
        onCircle(1.15, RC, a),
        onCircle(0.35, RC * 0.5, a),
        onCircle(-0.65, RC * 0.5, b),
        onCircle(-1.38, RC, b),
      );
    });
    wiringCache.set(type, tubes(curves, 0.045, 20, 5));
  }
  return wiringCache.get(type)!;
}

function reflectorWiring(id: ReflectorId) {
  const key = "ukw-" + id;
  if (!wiringCache.has(key)) {
    const U = REFLECTORS[id].contacts;
    const curves: THREE.Curve<THREE.Vector3>[] = [];
    for (let a = 0; a < 26; a++) {
      const b = U[a];
      if (b < a) continue;
      curves.push(
        new THREE.CubicBezierCurve3(
          onCircle(0.72, RC, a * STEP),
          onCircle(-0.55, RC * 0.78, a * STEP),
          onCircle(-0.55, RC * 0.78, b * STEP),
          onCircle(0.72, RC, b * STEP),
        ),
      );
    }
    wiringCache.set(key, tubes(curves, 0.05, 20, 5));
  }
  return wiringCache.get(key)!;
}

interface RotorRig {
  part: THREE.Group;
  spin: THREE.Group;
  coreFrame: THREE.Group;
  wiring: THREE.Mesh;
  notch: THREE.Group;
  anchors: Record<string, THREE.Object3D>;
  sub: Record<"thumb" | "ring" | "core" | "ratchet" | "hub", THREE.Group>;
}

function buildRotor(slot: Slot, type: RotorId): RotorRig {
  const M = materials();
  const part = group(`rotor-${slot}`, [SLOT_X[slot], 0, 0]);
  const spin = group("spin");
  const coreFrame = group("core-frame");
  part.add(spin);
  spin.add(coreFrame);

  // Index ring: numbered aluminium band, rides on `spin` directly.
  const ring = group(`rotor-${slot}-ring`);
  spin.add(ring);
  const numbers = Array.from({ length: 26 }, (_, i) => String(i + 1).padStart(2, "0"));
  const band = new THREE.MeshStandardMaterial({
    map: ringLabelTexture("ring-numbers", numbers, (i) => i * STEP, {
      bg: "#d9d2bf",
      fg: "#1b1d20",
      size: 52,
      ticks: true,
      tickColor: "#55595e",
    }),
    roughness: 0.6,
    metalness: 0.35,
  });
  ring.add(mesh(cylX(4.45, 1.36, 104, true), band, { pos: [-0.15, 0, 0], edgeAngle: 40 }));
  ring.add(mesh(annulusX(4.45, 3.38, 0.04), M.aluminium, { pos: [-0.85, 0, 0] }));
  ring.add(mesh(annulusX(4.45, 3.38, 0.04), M.aluminium, { pos: [0.55, 0, 0] }));
  // Notch: a cut in the ring's left edge, drawn as a dark recess.
  const notch = group("notch");
  const notchMesh = mesh(boxGeo(0.62, 0.42, 0.95), M.darkSteel, { pos: [-0.58, 4.32, 0] });
  notch.add(notchMesh);
  ring.add(notch);
  // Ring clip: spring catch on the band with a tiny knob.
  const clip = group("clip");
  clip.rotation.x = Math.PI + STEP / 2;
  clip.add(mesh(roundedBox(0.95, 0.22, 0.62, 0.08), M.nickel, { pos: [0.05, 4.5, 0] }));
  clip.add(mesh(cylY(0.17, 0.32, 16), M.nickel, { pos: [0.35, 4.7, 0] }));
  ring.add(clip);

  // Wiring core with both contact faces, the wires, thumbwheel, ratchet, hub.
  const core = group(`rotor-${slot}-core`);
  coreFrame.add(core);
  core.add(mesh(cylX(3.35, 2.6, 64), M.bakelite, { pos: [-0.15, 0, 0], edgeAngle: 40 }));
  const plateMat = M.brass;
  core.add(
    instanced(cylX(0.24, 0.06, 18), plateMat, 26, (i, d) => {
      d.position.copy(onCircle(-1.48, RC, i * STEP));
    }),
  );
  core.add(
    instanced(cylX(0.11, 0.32, 10), plateMat, 26, (i, d) => {
      d.position.copy(onCircle(1.3, RC, i * STEP));
    }),
  );
  const wiring = mesh(rotorWiring(type), M.copper, { edges: false });
  wiring.userData.hidden = true;
  wiring.userData.alwaysSolid = true;
  core.add(wiring);

  const thumb = group(`rotor-${slot}-thumb`);
  coreFrame.add(thumb);
  thumb.add(mesh(gearX(44, 5.05, 4.78, 3.36, 0.58, false), M.darkSteel, { pos: [-1.22, 0, 0], edgeAngle: 50 }));

  const ratchet = group(`rotor-${slot}-ratchet`);
  coreFrame.add(ratchet);
  ratchet.add(mesh(gearX(26, 4.02, 3.62, 3.36, 0.3, true), M.steel, { pos: [0.86, 0, 0], edgeAngle: 50 }));

  const hub = group(`rotor-${slot}-hub`);
  coreFrame.add(hub);
  hub.add(mesh(annulusX(0.72, 0.4, 3.05, 32), M.brass, {}));

  // Turned shoulder, retaining screws and contact insulators stay with their
  // own assembly during teardown. No decorative part covers a contact.
  seamRings(
    hub,
    [
      [-1.48, 0, 0],
      [1.48, 0, 0],
    ],
    0.72,
    0.045,
    M.nickel,
    "x",
  );
  for (const face of [-1, 1] as const) {
    const x = face < 0 ? -1.46 : 1.16;
    fasteners(
      core,
      [0, 1, 2].map((i) => {
        const p = onCircle(x, 1.3, (i * Math.PI * 2) / 3 + Math.PI / 6);
        return [p.x, p.y, p.z];
      }),
      M.brass,
      M.darkSteel,
      0.15,
      [face, 0, 0],
    );
  }
  core.add(
    instanced(annulusX(0.19, 0.115, 0.05, 20), M.bakeliteBrown, 26, (i, d) => {
      d.position.copy(onCircle(1.175, RC, i * STEP));
    }),);

  const anchors = {
    thumb: anchor(thumb, [-1.2, 4.6, 1.6]),
    ring: anchor(ring, [-0.1, 3.6, 2.6]),
    clip: anchor(clip, [0.35, 4.75, 0]),
    notch: anchor(notch, [-0.58, 4.4, 0]),
    pins: anchor(core, onCircle(1.42, RC, 0.4)),
    plates: anchor(core, onCircle(-1.5, RC, 2.6)),
    ratchet: anchor(ratchet, [0.86, 2.6, 3.0]),
    wires: anchor(core, [0, 1.0, 0.4]),
    label: anchor(ring, [-0.15, 4.5, 0]),
  };
  return {
    part,
    spin,
    coreFrame,
    wiring,
    notch,
    anchors,
    sub: { thumb, ring, core, ratchet, hub },
  };
}

/* ------------------------------------------------------------------ */
/* Machine                                                             */
/* ------------------------------------------------------------------ */

export interface EnigmaModel {
  exhibit: Exhibit;
  setConfig(config: MachineConfig, animate?: boolean): void;
  setDetailRotor(slot: Slot): void;
  detailRotor: Slot;
  pressKey(letter: string | null): void;
  lightLamp(letter: string | null): void;
  /** World-space contact on a wheel face for an external letter. */
  contact(part: "etw" | "ukw" | Slot, face: "left" | "right", letter: number): THREE.Vector3;
  /** Polyline nodes for the current path through the rotor set. */
  signalPath(trace: KeyResult): { forward: THREE.Vector3[][]; back: THREE.Vector3[][] };
  setWiringVisible(visible: boolean): void;
  setLoomVisible(visible: boolean): void;
  keyPosition(letter: string): THREE.Vector3;
  lampPosition(letter: string): THREE.Vector3;
  socketPosition(letter: string): THREE.Vector3;
  update(dt: number): boolean;
}

export function buildEnigma(initial: MachineConfig): EnigmaModel {
  const M = materials();
  const root = group("enigma-root");
  const enigma = group("enigma");
  root.add(enigma);
  const parts: { id: string; object: THREE.Object3D }[] = [{ id: "enigma", object: enigma }];
  const anchors: Record<string, Record<string, THREE.Object3D>> = {};
  const reg = (id: string, object: THREE.Object3D) => {
    parts.push({ id, object });
    return object;
  };

  /* ---------------- case ---------------- */
  // Profile: low keyboard deck (y 9) in front, raised lamp/rotor deck (y 13)
  // behind it, the rotor well sunk into the raised deck.
  const caseGroup = group("case");
  enigma.add(reg("case", caseGroup) as THREE.Group);
  const caseBody = group("case-body");
  caseGroup.add(caseBody);
  const wall = (w: number, h: number, d: number, x: number, y: number, z: number, mat = M.oak) =>
    caseBody.add(mesh(roundedBox(w, h, d, 0.18, 2), mat, { pos: [x, y, z] }));
  wall(34, 1, 28, 0, 0.5, 0); // floor
  wall(34, 13.3, 1, 0, 6.65, -13.5); // back
  wall(1, 13.3, 26, -16.5, 6.65, 0); // left
  wall(1, 13.3, 26, 16.5, 6.65, 0); // right
  wall(32, 1.4, 1, 0, 0.7, 13.5); // front, below the flap
  wall(32, 1.5, 1, 0, 9.85, 13.5); // front, above the flap
  for (const x of [-15.3, 15.3]) caseBody.add(mesh(cylY(0.42, 0.3, 20), M.red, { pos: [x, 13.38, -12.6] }));

  // Construction inventory: four base fixings, four corner shoes, two hinge
  // leaves, ten hinge knuckles, a carry handle with two bolted saddles.
  fasteners(
    caseBody,
    [
      [-14.9, 1.02, -11.8],
      [14.9, 1.02, -11.8],
      [-14.9, 1.02, 11.8],
      [14.9, 1.02, 11.8],
    ],
    M.brass,
    M.darkSteel,
    0.34,
  );
  for (const side of [-1, 1]) {
    for (const z of [-12.8, 12.8]) {
      caseBody.add(
        mesh(roundedBox(0.12, 2.0, 1.7, 0.05), M.darkSteel, {
          pos: [side * 17.04, 1.3, z],
        }),
      );
      fasteners(
        caseBody,
        [[side * 17.11, 1.3, z]],
        M.brass,
        M.darkSteel,
        0.15,
        [side, 0, 0],
      );
    }
  }
  const handle = group("leather-carry-handle", [-17.08, 7.3, 0]);
  for (const z of [-5.1, 5.1]) {
    handle.add(
      mesh(roundedBox(0.18, 2.0, 2.4, 0.16), M.darkSteel, {
        pos: [-0.04, 0, z],
      }),
    );
    handle.add(mesh(cylZ(0.24, 1.8, 18), M.nickel, { pos: [-0.55, 0, z] }));
  }
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.55, 0, -5.1),
    new THREE.Vector3(-1.45, 0, -3.8),
    new THREE.Vector3(-1.65, 0, 0),
    new THREE.Vector3(-1.45, 0, 3.8),
    new THREE.Vector3(-0.55, 0, 5.1),
  ]);
  handle.add(
    mesh(
      new THREE.TubeGeometry(handleCurve, 28, 0.5, 8, false),
      M.bakeliteBrown,
      { edges: false },
    ),
  );
  fasteners(
    handle,
    [
      [-0.15, -0.6, -5.1],
      [-0.15, 0.6, -5.1],
      [-0.15, -0.6, 5.1],
      [-0.15, 0.6, 5.1],
    ],
    M.brass,
    M.darkSteel,
    0.14,
    [-1, 0, 0],
  );
  caseBody.add(handle);

  const lid = group("lid", [0, 13.3, -14]);
  caseGroup.add(reg("lid", lid) as THREE.Group);
  lid.rotation.x = -2.02;
  const lidBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat = M.oak) =>
    lid.add(mesh(roundedBox(w, h, d, 0.18, 2), mat, { pos: [x, y, z] }));
  lidBox(34, 0.9, 28, 0, 3.95, 14);
  lidBox(34, 4.4, 1, 0, 2.2, 0.5);
  lidBox(34, 4.4, 1, 0, 2.2, 27.5);
  lidBox(1, 4.4, 26, -16.5, 2.2, 14);
  lidBox(1, 4.4, 26, 16.5, 2.2, 14);
  const lidLining = mesh(boxGeo(32, 0.12, 26), M.felt, { pos: [0, 3.45, 14] });
  // This lining is almost flush with the case: AO supplies contact shading,
  // avoiding a biased shadow triangle on its thin backing.
  lidLining.userData.receive = false;
  lid.add(lidLining);
  lid.add(mesh(boxGeo(30, 0.1, 0.6), M.oakEnd, { pos: [0, 3.36, 15.5] })); // cable rail
  for (const x of [-10.3, 10.3]) {
    // Hinge leaves are fixed to their own half, so the original hinge motion
    // still carries all its attached hardware correctly.
    caseBody.add(
      mesh(roundedBox(4.5, 2.3, 0.12, 0.08), M.brass, {
        pos: [x, 12.1, -14.04],
      }),
    );
    lid.add(
      mesh(roundedBox(4.5, 2.2, 0.12, 0.08), M.brass, { pos: [x, 1.1, -0.05] }),
    );
    for (let k = 0; k < 5; k++) {
      const host = k % 2 ? lid : caseBody;
      host.add(
        mesh(cylX(0.26, 0.84, 20), M.brass, {
          pos: [x - 1.76 + k * 0.88, k % 2 ? 0 : 13.3, k % 2 ? 0 : -14],
        }),
      );
    }
    fasteners(
      caseBody,
      [
        [x - 1.45, 11.5, -14.11],
        [x + 1.45, 11.5, -14.11],
      ],
      M.nickel,
      M.darkSteel,
      0.16,
      [0, 0, -1],
    );
    fasteners(
      lid,
      [
        [x - 1.45, 1.5, -0.12],
        [x + 1.45, 1.5, -0.12],
      ],
      M.nickel,
      M.darkSteel,
      0.16,
      [0, 0, -1],
    );
  }
  // Felt frame and plate fixings remain legible even when the lid fills the view.
  for (const x of [-15.5, 15.5])
    lid.add(mesh(boxGeo(0.25, 0.12, 24), M.oakEnd, { pos: [x, 3.32, 14] }));
  for (const z of [2, 26])
    lid.add(mesh(boxGeo(31.2, 0.12, 0.25), M.oakEnd, { pos: [0, 3.32, z] }));
  // Instruction plate, spare bulbs at 45°, two spare cables.
  const notes = new THREE.MeshStandardMaterial({
    map: plateTexture("lid-notes", "Gebrauchsanleitung", { w: 512, h: 160, bg: "#e7dfcc", fg: "#3b3226", size: 46 }),
    roughness: 0.9,
  });
  lid.add(mesh(boxGeo(11, 0.06, 4.4), M.paper, { pos: [-5, 3.38, 8.5] }));
  // Printed paper uses its own 0…1 UV plane. The case's centimetre-scaled
  // box UVs would clamp the lettering into a tiny unreadable mark.
  const instructionFace = mesh(new THREE.PlaneGeometry(10.7, 4.1), notes, {
    pos: [-5, 3.345, 8.5],
    edges: false,
  });
  instructionFace.rotation.x = Math.PI / 2;
  lid.add(instructionFace);
  fasteners(
    lid,
    [
      [-10, 3.34, 6.7],
      [0, 3.34, 6.7],
      [-10, 3.34, 10.3],
      [0, 3.34, 10.3],
    ],
    M.brass,
    M.darkSteel,
    0.12,
    [0, -1, 0],);
  for (let i = 0; i < 5; i++) {
    const b = mesh(cylY(0.45, 1.3, 16), M.bulb, { pos: [6 + i * 1.6, 3.0, 8.5] });
    b.rotation.x = Math.PI / 4;
    lid.add(b);
    const socket = group("spare-bulb-socket", [6 + i * 1.6, 3.0, 8.5]);
    socket.rotation.x = Math.PI / 4;
    socket.add(mesh(cylY(0.5, 0.35, 24), M.brass, { pos: [0, 0.48, 0] }));
    lid.add(socket);
  }
  for (const z of [17.6, 18.6]) lid.add(mesh(roundedBox(9, 0.36, 0.42, 0.15), M.cable, { pos: [-6, 3.2, z] }));
  anchors.lid = {
    notes: anchor(lid, [-5, 3.3, 8.5]),
    bulbs: anchor(lid, [9.2, 3.0, 8.5]),
    cables: anchor(lid, [-6, 3.1, 18.1]),
  };

  const flap = group("flap", [0, 1.4, 14]);
  caseGroup.add(reg("flap", flap) as THREE.Group);
  flap.add(mesh(roundedBox(32, 7.7, 1, 0.18, 2), M.oak, { pos: [0, 3.85, -0.5] }));
  flap.add(mesh(roundedBox(3.2, 0.5, 0.35, 0.12), M.nickel, { pos: [0, 6.9, 0.1] }));
  flap.add(
    mesh(roundedBox(2.2, 2.3, 0.12, 0.18), M.darkSteel, {
      pos: [0, 6.1, 0.08],
    }),
  );
  flap.add(
    mesh(roundedBox(0.7, 1.25, 0.16, 0.12), M.brass, { pos: [0, 6.25, 0.23] }),
  );
  fasteners(
    flap,
    [
      [-0.76, 5.45, 0.15],
      [0.76, 5.45, 0.15],
    ],
    M.brass,
    M.darkSteel,
    0.15,
    [0, 0, 1],
  );
  for (const x of [-11, 11]) {
    flap.add(
      mesh(roundedBox(3, 1.7, 0.1, 0.08), M.brass, { pos: [x, 0.85, 0.05] }),
    );
    flap.add(mesh(cylX(0.2, 3.2, 20), M.brass, { pos: [x, 0, 0] }));
    fasteners(
      flap,
      [
        [x - 0.9, 1, 0.11],
        [x + 0.9, 1, 0.11],
      ],
      M.nickel,
      M.darkSteel,
      0.14,
      [0, 0, 1],
    );
  }
  anchors.case = {
    lid: anchor(lid, [10, 4.4, 26]),
    flap: anchor(flap, [-8, 4, 0.1]),
    body: anchor(caseBody, [-16.9, 6, 6]),
  };

  /* ---------------- chassis ---------------- */
  const chassis = group("chassis");
  enigma.add(reg("chassis", chassis) as THREE.Group);
  // Keyboard deck.
  chassis.add(mesh(boxGeo(32, 0.35, 8.8), M.crackle, { pos: [0, 8.83, 8.8], edgeAngle: 20 }));
  // Raised deck: one plate with the lamp field and the rotor well cut out.
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-16, -13);
  deckShape.lineTo(16, -13);
  deckShape.lineTo(16, 4.4);
  deckShape.lineTo(-16, 4.4);
  deckShape.closePath();
  const hole = (x0: number, x1: number, z0: number, z1: number) => {
    const h = new THREE.Path();
    h.moveTo(x0, z0);
    h.lineTo(x0, z1);
    h.lineTo(x1, z1);
    h.lineTo(x1, z0);
    h.closePath();
    deckShape.holes.push(h);
  };
  hole(-12.95, 12.95, -3.95, 3.95);
  hole(-9.9, 4.5, -12.7, -4.65);
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.3, bevelEnabled: false });
  deckGeo.rotateX(Math.PI / 2);
  deckGeo.translate(0, 13.0, 0);
  chassis.add(mesh(deckGeo, M.crackle, { edgeAngle: 20 }));
  chassis.add(mesh(boxGeo(32, 4.0, 0.3), M.crackle, { pos: [0, 10.85, 4.25] })); // step face
  // Lamp tray under the lamp cover.
  chassis.add(mesh(boxGeo(25.9, 0.25, 7.9), M.castGrey, { pos: [0, 11.75, 0] }));
  // Rotor well.
  chassis.add(mesh(boxGeo(14.4, 0.3, 8.05), M.castGrey, { pos: [-2.7, 3.0, -8.68] }));
  chassis.add(mesh(boxGeo(14.4, 10, 0.3), M.castGrey, { pos: [-2.7, 8.0, -4.5] }));
  chassis.add(mesh(boxGeo(14.4, 10, 0.3), M.castGrey, { pos: [-2.7, 8.0, -12.85] }));
  chassis.add(mesh(boxGeo(0.3, 10, 8.05), M.castGrey, { pos: [-10.05, 8.0, -8.68] }));
  chassis.add(mesh(boxGeo(31, 0.4, 25), M.castGrey, { pos: [0, 1.3, 0] }));
  // Battery box lid (rear right) with a small lock; the battery beneath.
  chassis.add(mesh(roundedBox(6.6, 0.3, 6, 0.12), M.crackle, { pos: [11.2, 13.15, -8.6] }));
  chassis.add(mesh(cylY(0.25, 0.2, 16), M.nickel, { pos: [11.2, 13.35, -6.0] }));
  chassis.add(mesh(roundedBox(5.6, 4, 5, 0.2), M.castGrey, { pos: [11.2, 10.4, -8.6] }));
  // Rotary power switch to the right of the rotors.
  chassis.add(mesh(cylY(1.5, 0.15, 32), M.nickel, { pos: [6.7, 13.08, -8.6] }));
  chassis.add(mesh(roundedBox(0.8, 1.1, 2.6, 0.3), M.bakelite, { pos: [6.7, 13.7, -8.6] }));
  // Reflector release lever on the left of the well.
  const lever = mesh(roundedBox(0.7, 0.5, 3.2, 0.2), M.nickel, { pos: [-11.4, 13.3, -7.8] });
  lever.rotation.y = 0.35;
  chassis.add(lever);
  fasteners(
    chassis,
    [
      [-14.9, 9.01, 5.3],
      [14.9, 9.01, 5.3],
      [-14.9, 9.01, 12.3],
      [14.9, 9.01, 12.3],
      [-14.9, 13.01, -11.8],
      [14.9, 13.01, -11.8],
      [-14.9, 13.01, 2.8],
      [14.9, 13.01, 2.8],
    ],
    M.nickel,
    M.darkSteel,
    0.2,
  );
  fasteners(
    chassis,
    [
      [8.5, 13.31, -10.9],
      [13.9, 13.31, -10.9],
    ],
    M.nickel,
    M.darkSteel,
    0.15,
  );
  const makerPlate = mesh(
    new THREE.PlaneGeometry(5.6, 1.0),
    new THREE.MeshStandardMaterial({
      map: plateTexture("enigma-maker", "ENIGMA", {
        w: 640,
        h: 120,
        bg: "#b29b65",
        fg: "#2c271b",
        size: 64,
      }),
      roughness: 0.64,
      metalness: 0.4,
    }),
    { pos: [0, 10.7, 4.41], edges: false },
  );
  chassis.add(makerPlate);
  fasteners(
    chassis,
    [
      [-2.55, 10.7, 4.42],
      [2.55, 10.7, 4.42],
    ],
    M.brass,
    M.darkSteel,
    0.1,
    [0, 0, 1],);
  anchors.chassis = {
    well: anchor(chassis, [-2.7, 12.9, -4.7]),
    battery: anchor(chassis, [12.6, 13.3, -6.8]),
    switch: anchor(chassis, [6.7, 14.2, -8.6]),
  };

  /* ---------------- rotor cover ---------------- */
  const coverX = -2.7;
  const cover = group("rotor-cover", [coverX, 13.25, -12.9]);
  enigma.add(reg("rotor-cover", cover) as THREE.Group);
  cover.add(mesh(roundedBox(14.6, 0.25, 8.5, 0.1), M.crackle, { pos: [0, -0.125, 4.25], edgeAngle: 20 }));
  cover.add(mesh(cylX(0.22, 14.2, 16), M.steel, { pos: [0, -0.05, 0] })); // hinge pin
  fasteners(
    cover,
    [
      [-6.7, 0.01, 1.0],
      [6.7, 0.01, 1.0],
      [-6.7, 0.01, 7.8],
      [6.7, 0.01, 7.8],
    ],
    M.nickel,
    M.darkSteel,
    0.14,
  );
  const windowTextures: Record<Slot, { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D }> = {} as never;
  anchors["rotor-cover"] = {};
  const coverZ = AXIS_Z + 12.9;
  for (const slot of SLOTS) {
    const x = SLOT_X[slot] - coverX;
    cover.add(mesh(boxGeo(1.6, 0.08, 1.25), M.nickel, { pos: [x - 0.15, 0.02, coverZ] }));
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 96;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    windowTextures[slot] = { tex, ctx: c.getContext("2d")! };
    const win = mesh(
      new THREE.PlaneGeometry(1.18, 0.86),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.2 }),
      { edges: false },
    );
    win.rotation.x = -Math.PI / 2;
    win.position.set(x - 0.15, 0.07, coverZ);
    cover.add(win);
    fasteners(
      cover,
      [
        [x - 0.77, 0.065, coverZ],
        [x + 0.47, 0.065, coverZ],
      ],
      M.brass,
      M.darkSteel,
      0.075);
    // Thumbwheel slot.
    cover.add(mesh(boxGeo(0.8, 0.06, 4.2), M.rubber, { pos: [x - 1.18, 0.03, coverZ] }));
    anchors["rotor-cover"][`window-${slot}`] = anchor(cover, [x - 0.15, 0.1, coverZ]);
  }
  const drawWindow = (slot: Slot, n: number) => {
    const { ctx, tex } = windowTextures[slot];
    ctx.fillStyle = "#c9ccce";
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = "#16181b";
    ctx.font = `600 64px ${LETTER_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n + 1).padStart(2, "0"), 64, 52);
    tex.needsUpdate = true;
  };

  /* ---------------- rotor set ---------------- */
  const rotorSet = group("rotor-set", [0, AXIS_Y, AXIS_Z]);
  enigma.add(reg("rotor-set", rotorSet) as THREE.Group);
  const ukw = group("ukw", [UKW_X, 0, 0]);
  rotorSet.add(reg("ukw", ukw) as THREE.Group);
  ukw.add(mesh(cylX(3.9, 1.55, 64), M.bakelite, { edgeAngle: 40 }));
  ukw.add(mesh(cylX(3.97, 0.42, 64), M.darkSteel, { pos: [-0.62, 0, 0], edgeAngle: 40 })); // proud of the body face
  ukw.add(
    instanced(cylX(0.11, 0.3, 10), M.brass, 26, (i, d) => {
      d.position.copy(onCircle(0.92, RC, i * STEP));
    }),
  );
  const ukwWiring = mesh(reflectorWiring(initial.reflector), M.copper, { edges: false });
  ukwWiring.userData.hidden = true;
  ukwWiring.userData.alwaysSolid = true;
  ukw.add(ukwWiring);
  const ukwMarkMat = new THREE.MeshStandardMaterial({
    map: glyphTexture("ukw-B", "B", { bg: "#16110d", fg: "#b9a98a", size: 92 }),
    roughness: 0.7,
  });
  const ukwMark = mesh(new THREE.CircleGeometry(1.5, 40), ukwMarkMat, { edges: false });
  ukwMark.rotation.y = -Math.PI / 2;
  ukwMark.position.set(-0.86, 0, 0);
  ukw.add(ukwMark);
  anchors.ukw = {
    contacts: anchor(ukw, onCircle(1.05, RC, 0.5)),
    pairs: anchor(ukw, [0, 1.2, 1.8]),
    mark: anchor(ukw, [-0.85, 0.6, 0.6]),
  };

  const rigs = {} as Record<Slot, RotorRig>;
  for (const [i, slot] of SLOTS.entries()) {
    const rig = buildRotor(slot, initial.rotors[i]);
    rigs[slot] = rig;
    rotorSet.add(reg(`rotor-${slot}`, rig.part) as THREE.Group);
    for (const key of ["thumb", "ring", "core", "ratchet", "hub"] as const)
      reg(`rotor-${slot}-${key}`, rig.sub[key]);
    anchors[`rotor-${slot}`] = rig.anchors;
    anchors[`rotor-${slot}-ring`] = { clip: rig.anchors.clip, notch: rig.anchors.notch, label: rig.anchors.label };
    anchors[`rotor-${slot}-core`] = { pins: rig.anchors.pins, plates: rig.anchors.plates, wires: rig.anchors.wires };
  }
  const spindle = group("spindle");
  rotorSet.add(reg("spindle", spindle) as THREE.Group);
  spindle.add(mesh(cylX(0.38, 12.6, 24), M.steel, { pos: [-3.2, 0, 0] }));
  spindle.add(mesh(cylX(0.62, 0.5, 24), M.steel, { pos: [-9.35, 0, 0] }));
  anchors["rotor-set"] = {
    ukw: anchor(ukw, [0, 3.2, 2.4]),
    l: anchor(rigs.l.part, [-0.2, 4.5, 1.2]),
    m: anchor(rigs.m.part, [-0.2, 4.5, 1.2]),
    r: anchor(rigs.r.part, [-0.2, 4.5, 1.2]),
    spindle: anchor(spindle, [-9.5, 0, 0.3]),
  };

  /* ---------------- entry wheel ---------------- */
  const etw = group("etw", [ETW_X, AXIS_Y, AXIS_Z]);
  enigma.add(reg("etw", etw) as THREE.Group);
  etw.add(mesh(cylX(3.9, 1.3, 64), M.bakelite, { edgeAngle: 40 }));
  etw.add(mesh(cylX(3.96, 0.3, 64), M.darkSteel, { pos: [0.56, 0, 0], edgeAngle: 40 })); // proud of the body face
  etw.add(
    instanced(cylX(0.24, 0.06, 18), M.brass, 26, (i, d) => {
      d.position.copy(onCircle(-0.68, RC, i * STEP));
    }),
  );
  const loom = tubes(
    [0, 1, 2, 3, 4].map(
      (k) =>
        new THREE.CubicBezierCurve3(
          new THREE.Vector3(0.7, -1.2 + k * 0.5, 0.4 - k * 0.2),
          new THREE.Vector3(2.4, -2.5 + k * 0.3, 1),
          new THREE.Vector3(1.5, -5.5, 6 + k),
          new THREE.Vector3(-4 + k * 3, -6.6, 13 + k * 0.6),
        ),
    ),
    0.28,
    28,
    8,
  );
  const loomMesh = mesh(loom, M.cable, { edges: false });
  etw.add(loomMesh);
  anchors.etw = { contacts: anchor(etw, onCircle(-0.75, RC, 0.4)) };

  /* ---------------- stepping pawls ---------------- */
  const stepping = group("stepping");
  enigma.add(reg("stepping", stepping) as THREE.Group);
  for (const slot of SLOTS) {
    const pawl = mesh(roundedBox(0.28, 3.2, 0.9, 0.1), M.steel, { pos: [SLOT_X[slot] + 0.86, 4.6, -5.4] });
    pawl.rotation.x = -0.45;
    stepping.add(pawl);
    stepping.add(mesh(roundedBox(0.3, 0.5, 1.2, 0.1), M.steel, { pos: [SLOT_X[slot] + 0.86, 6.1, -6.0] }));
  }
  stepping.add(mesh(cylX(0.3, 13, 16), M.steel, { pos: [-2.7, 3.5, -5.0] }));
  anchors.stepping = {
    pawls: anchor(stepping, [SLOT_X.m + 0.86, 5.6, -5.6]),
    bar: anchor(stepping, [-8.5, 3.5, -5.0]),
  };
  stepping.add(mesh(boxGeo(0.6, 0.6, 10), M.steel, { pos: [-2.7, 3.4, 0.5] }));

  /* ---------------- lampboard ---------------- */
  const lampboard = group("lampboard");
  enigma.add(reg("lampboard", lampboard) as THREE.Group);
  const lampCover = group("lamp-cover");
  lampboard.add(reg("lamp-cover", lampCover) as THREE.Group);
  const bulbs = group("bulbs");
  lampboard.add(reg("bulbs", bulbs) as THREE.Group);
  lampCover.add(mesh(roundedBox(26.2, 0.2, 8.3, 0.08), M.crackle, { pos: [0, 13.1, 0], edgeAngle: 20 }));
  fasteners(
    lampCover,
    [
      [-12.6, 13.21, -3.6],
      [12.6, 13.21, -3.6],
      [-12.6, 13.21, 3.6],
      [12.6, 13.21, 3.6],
    ],
    M.nickel,
    M.darkSteel,
    0.16,);
  const lampWindows = new Map<string, { mat: THREE.MeshStandardMaterial; bulb: THREE.MeshPhysicalMaterial }>();
  const lampPos = new Map<string, THREE.Vector3>();
  ROWS.forEach((row, r) => {
    [...row].forEach((ch, i) => {
      const x = layout(r, i, 2.6),
        z = -2.35 + r * 2.35;
      lampPos.set(ch, new THREE.Vector3(x, 13.3, z));
      const mat = new THREE.MeshStandardMaterial({
        map: glyphTexture(`lamp-${ch}`, ch, { bg: "#2a2723", fg: "#e9e0c8", size: 70 }),
        emissiveMap: glyphTexture(`lamp-glow-${ch}`, ch, { bg: "#000", fg: "#ffd27a", size: 70, glowOnly: true }),
        emissive: "#000000",
        roughness: 0.5,
      });
      const win = mesh(new THREE.CircleGeometry(0.74, 36), mat, { edges: false });
      win.rotation.x = -Math.PI / 2;
      win.position.set(x, 13.225, z);
      lampCover.add(win);
      lampCover.add(mesh(annulusX(0.84, 0.72, 0.06, 36), M.nickel, { pos: [x, 13.23, z] }).rotateZ(Math.PI / 2));
      const bulbMat = M.bulb.clone();
      const bulb = mesh(new THREE.SphereGeometry(0.55, 20, 12), bulbMat, { pos: [x, 12.4, z], edges: false });
      bulb.scale.set(1, 0.55, 1);
      bulbs.add(bulb);
      bulbs.add(mesh(cylY(0.36, 0.7, 16), M.brass, { pos: [x, 12.0, z] }));
      lampWindows.set(ch, { mat, bulb: bulbMat });
    });
  });
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext("2d")!;
  const grad = gctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,226,140,1)");
  grad.addColorStop(0.35, "rgba(255,190,70,0.55)");
  grad.addColorStop(1, "rgba(255,170,40,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glow.scale.set(4.2, 4.2, 1);
  glow.visible = false;
  glow.userData.pickable = false;
  lampboard.add(glow);
  anchors.lampboard = {
    window: anchor(lampCover, [layout(0, 2, 2.6), 13.3, -2.35]),
    bulb: anchor(bulbs, [layout(1, 5, 2.6), 12.6, 0]),
  };

  /* ---------------- keyboard ---------------- */
  const keyboard = group("keyboard");
  enigma.add(reg("keyboard", keyboard) as THREE.Group);
  const keys = new Map<string, THREE.Group>();
  const keyPos = new Map<string, THREE.Vector3>();
  ROWS.forEach((row, r) => {
    [...row].forEach((ch, i) => {
      const x = layout(r, i, 2.75),
        z = 6.1 + r * 2.5;
      const key = group(`key-${ch}`, [x, 0, z]);
      // Bakelite cap with the letter printed on a disc under its clear top.
      const cap = mesh(cylY(0.94, 0.34, 36), M.bakelite, { pos: [0, 10.85, 0], edges: false });
      const face = mesh(
        new THREE.CircleGeometry(0.8, 36),
        new THREE.MeshPhysicalMaterial({
          map: glyphTexture(`key-${ch}`, ch, { bg: "#15120f", fg: "#e4dcc8", size: 76 }),
          roughness: 0.6,
          specularIntensity: 0.4,
          clearcoat: 0.12,
          clearcoatRoughness: 0.4,
        }),
        { pos: [0, 11.05, 0], edges: false },
      );
      face.rotation.x = -Math.PI / 2;
      key.add(cap, face);
      key.add(mesh(annulusX(0.99, 0.9, 0.2, 36), M.nickel, { pos: [0, 10.82, 0] }).rotateZ(Math.PI / 2));
      key.add(mesh(cylY(0.17, 2.1, 12), M.steel, { pos: [0, 9.65, 0] }));
      keyboard.add(key);
      keys.set(ch, key);
      keyPos.set(ch, new THREE.Vector3(x, 11.05, z));
      // Lever and contact below the deck.
      keyboard.add(mesh(boxGeo(0.34, 0.34, 5.2), M.steel, { pos: [x, 6.4, z - 2.2] }));
      keyboard.add(mesh(boxGeo(0.6, 0.3, 0.6), M.brass, { pos: [x, 5.9, z + 0.2] }));
      keyboard.add(mesh(cylY(0.17, 2.4, 10), M.steel, { pos: [x, 7.5, z] }));
    });
  });
  anchors.keyboard = {
    cap: anchor(keyboard, [layout(0, 0, 2.75), 11.1, 6.1]),
    lever: anchor(keyboard, [layout(2, 8, 2.75), 6.5, 11.1 - 2.6]),
    contact: anchor(keyboard, [layout(2, 7, 2.75), 5.9, 11.3]),
  };
  const keyCentres: [number, number, number][] = ROWS.flatMap((row, r) =>
    [...row].map((_, i): [number, number, number] => [
      layout(r, i, 2.75),
      9.08,
      6.1 + r * 2.5,
    ]),
  );
  // The guide collars sit on the keyboard deck; stems pass through their bore.
  seamRings(keyboard, keyCentres, 0.3, 0.075, M.darkSteel, "y");

  /* ---------------- plugboard ---------------- */
  const plugboard = group("plugboard");
  enigma.add(reg("plugboard", plugboard) as THREE.Group);
  plugboard.add(mesh(roundedBox(29.4, 6.9, 0.32, 0.1), M.crackle, { pos: [0, 5.1, 12.75], edgeAngle: 20 }));
  fasteners(
    plugboard,
    [
      [-14, 2.1, 12.92],
      [14, 2.1, 12.92],
      [-14, 8.1, 12.92],
      [14, 8.1, 12.92],
    ],
    M.nickel,
    M.darkSteel,
    0.19,
    [0, 0, 1]);
  const socketPos = new Map<string, THREE.Vector3>();
  const holeMat = new THREE.MeshBasicMaterial({ color: "#060606" });
  ROWS.forEach((row, r) => {
    [...row].forEach((ch, i) => {
      const x = layout(r, i, 3.0),
        y = 7.3 - r * 2.15;
      socketPos.set(ch, new THREE.Vector3(x, y, 12.95));
      const bezel = mesh(cylZ(0.56, 0.12, 28), M.nickel, { pos: [x, y, 12.95] });
      plugboard.add(bezel);
      plugboard.add(mesh(cylZ(0.43, 0.14, 24), M.bakelite, { pos: [x, y, 12.98] }));
      for (const [dx, rr] of [
        [-0.2, 0.12],
        [0.2, 0.09],
      ] as const)
        plugboard.add(mesh(cylZ(rr, 0.02, 12), holeMat, { pos: [x + dx, y, 13.06], edges: false, pick: false }));
      const label = mesh(
        new THREE.PlaneGeometry(0.62, 0.62),
        new THREE.MeshBasicMaterial({
          map: glyphTexture(`plug-${ch}`, ch, { bg: "#202224", fg: "#d8d3c6", size: 84 }),
        }),
        { edges: false },
      );
      label.position.set(x, y + 0.88, 12.93);
      plugboard.add(label);
    });
  });
  const cables = group("cables");
  plugboard.add(cables);
  anchors.plugboard = {
    socket: anchor(plugboard, [layout(0, 8, 3.0), 7.3, 13.1]),
    cable: anchor(cables, [0, 1.2, 13.6]),
  };

  function rebuildCables(pairs: string) {
    for (const child of [...cables.children]) cables.remove(child);
    const list = pairs.trim() ? pairs.trim().toUpperCase().split(/\s+/) : [];
    list.forEach((pair, k) => {
      const a = socketPos.get(pair[0]),
        b = socketPos.get(pair[1]);
      if (!a || !b) return;
      for (const p of [a, b]) {
        const plug = mesh(roundedBox(0.95, 1.35, 1.0, 0.18), M.bakelite, { pos: [p.x, p.y - 0.05, p.z + 0.55] });
        plug.userData.cable = pair;
        cables.add(plug);
      }
      const sag = Math.min(a.y, b.y) - 2.2 - (k % 3) * 0.55;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a.x, a.y - 0.75, a.z + 0.6),
        new THREE.Vector3(a.x, a.y - 1.6, a.z + 0.9),
        new THREE.Vector3((a.x + b.x) / 2, sag, a.z + 1.25 + (k % 2) * 0.35),
        new THREE.Vector3(b.x, b.y - 1.6, b.z + 0.9),
        new THREE.Vector3(b.x, b.y - 0.75, b.z + 0.6),
      ]);
      const cable = mesh(new THREE.TubeGeometry(curve, 48, 0.17, 8, false), M.cable, { edges: false });
      cable.userData.cable = pair;
      cables.add(cable);
    });
    exhibit?.adopt("plugboard", cables.children as THREE.Mesh[]);
  }

  /* ---------------- exhibit ---------------- */
  let detail: Slot = "m";
  const metas = new Map(ENIGMA_PARTS.map((m) => [m.id, m]));
  anchors.enigma = {
    rotors: anchor(cover, [0, 0.2, coverZ]),
    lamps: anchor(lampboard, [layout(0, 7, 2.6), 13.35, -2.35]),
    keys: anchor(keyboard, [layout(2, 2, 2.75), 11.2, 11.1]),
    plugs: anchor(flap, [10, 6, 0.1]),
    lid: anchor(lid, [-10, 4.4, 26]),
  };
  let exhibit: Exhibit | null = null;
  exhibit = new Exhibit({
    root,
    parts: parts.map(({ id, object }) => ({ meta: metas.get(id)!, object })),
    steps: enigmaSteps(detail),
    anchors,
  });
  const ex = exhibit;

  /* ---------------- state & animation ---------------- */
  let config = initial;
  const spinTarget: Record<Slot, number> = { l: 0, m: 0, r: 0 };
  const spinNow: Record<Slot, number> = { l: 0, m: 0, r: 0 };
  let pressed: string | null = null;
  let keyDepth = 0;
  let lit: string | null = null;

  function setConfig(next: MachineConfig, animate = false) {
    const prev = config;
    config = next;
    SLOTS.forEach((slot, i) => {
      const rig = rigs[slot];
      const type = next.rotors[i];
      if (prev.rotors[i] !== type || !rig.wiring.userData.type) {
        rig.wiring.geometry = rotorWiring(type);
        rig.wiring.userData.type = type;
        const T = ROTORS[type].notches[0];
        rig.notch.rotation.x = PAWL_PHI + T * STEP;
      }
      rig.coreFrame.rotation.x = next.rings[i] * STEP;
      // Unwrap so a step from Z to A turns forward rather than spinning back.
      let target = -next.positions[i] * STEP;
      const current = spinTarget[slot];
      while (target - current > Math.PI) target -= Math.PI * 2;
      while (target - current < -Math.PI) target += Math.PI * 2;
      spinTarget[slot] = target;
      if (!animate) spinNow[slot] = target;
      drawWindow(slot, next.positions[i]);
    });
    if (prev.reflector !== next.reflector || !ukwWiring.userData.type) {
      ukwWiring.geometry = reflectorWiring(next.reflector);
      ukwWiring.userData.type = next.reflector;
      ukwMarkMat.map = glyphTexture(`ukw-${next.reflector}`, next.reflector, { bg: "#16110d", fg: "#c0392b", size: 92 });
      ukwMarkMat.needsUpdate = true;
    }
    if (prev.plugboard !== next.plugboard || !cables.children.length) rebuildCables(next.plugboard);
    applySpin();
    ex.onChange();
  }

  function applySpin() {
    for (const slot of SLOTS) rigs[slot].spin.rotation.x = spinNow[slot];
  }

  function update(dt: number): boolean {
    let busy = false;
    for (const slot of SLOTS) {
      const d = spinTarget[slot] - spinNow[slot];
      if (Math.abs(d) > 1e-4) {
        spinNow[slot] += d * Math.min(1, dt * 14);
        if (Math.abs(spinTarget[slot] - spinNow[slot]) < 1e-3) spinNow[slot] = spinTarget[slot];
        busy = true;
      }
    }
    if (busy) applySpin();
    const depthTarget = pressed ? 0.45 : 0;
    if (Math.abs(depthTarget - keyDepth) > 1e-3) {
      keyDepth += (depthTarget - keyDepth) * Math.min(1, dt * 22);
      busy = true;
    }
    for (const [ch, key] of keys) key.position.y = ch === pressed ? -keyDepth : 0;
    return busy;
  }

  function lightLamp(letter: string | null) {
    if (lit && lampWindows.has(lit)) {
      const l = lampWindows.get(lit)!;
      l.mat.emissive.set("#000000");
      l.bulb.emissive.set("#000000");
    }
    lit = letter;
    glow.visible = false;
    if (letter && lampWindows.has(letter)) {
      const l = lampWindows.get(letter)!;
      glow.position.copy(lampPos.get(letter)!).add(new THREE.Vector3(0, 0.25, 0));
      glow.visible = true;
      l.mat.emissive.set("#ffcf6a");
      l.mat.emissiveIntensity = 2.2;
      l.bulb.emissive.set("#ffc35a");
      l.bulb.emissiveIntensity = 1.5;
    }
    ex.onChange();
  }

  const facesX = {
    etw: { left: -0.7, right: 0.65 },
    ukw: { left: -0.78, right: 1.08 },
    rotor: { left: -1.5, right: 1.46 },
  };
  function contact(which: "etw" | "ukw" | Slot, face: "left" | "right", letter: number) {
    const obj = which === "etw" ? etw : which === "ukw" ? ukw : rigs[which].part;
    const x = which === "etw" ? facesX.etw[face] : which === "ukw" ? facesX.ukw[face] : facesX.rotor[face];
    obj.updateWorldMatrix(true, false);
    return obj.localToWorld(onCircle(x, RC, letter * STEP));
  }

  /** Internal wire of a wheel, drawn between two external letters. */
  function wireCurve(which: Slot | "ukw", from: number, to: number, reverse: boolean): THREE.Vector3[] {
    const obj = which === "ukw" ? ukw : rigs[which].part;
    obj.updateWorldMatrix(true, false);
    const pts: THREE.Vector3[] = [];
    let curve: THREE.CubicBezierCurve3;
    if (which === "ukw") {
      curve = new THREE.CubicBezierCurve3(
        onCircle(1.08, RC, from * STEP),
        onCircle(-0.55, RC * 0.78, from * STEP),
        onCircle(-0.55, RC * 0.78, to * STEP),
        onCircle(1.08, RC, to * STEP),
      );
    } else {
      // Right face → left face for the forward pass, the same wire backwards on return.
      const right = reverse ? to : from,
        left = reverse ? from : to;
      curve = new THREE.CubicBezierCurve3(
        onCircle(1.46, RC, right * STEP),
        onCircle(0.35, RC * 0.5, right * STEP),
        onCircle(-0.65, RC * 0.5, left * STEP),
        onCircle(-1.5, RC, left * STEP),
      );
    }
    for (let i = 0; i <= 20; i++) pts.push(obj.localToWorld(curve.getPoint(i / 20)));
    if (reverse && which !== "ukw") pts.reverse();
    return pts;
  }

  function signalPath(trace: KeyResult) {
    const st = Object.fromEntries(trace.stages.map((s) => [s.id, s]));
    const forward: THREE.Vector3[][] = [];
    const back: THREE.Vector3[][] = [];
    const s0 = st["right-forward"].input;
    forward.push([contact("etw", "left", s0), contact("r", "right", s0)]);
    forward.push(wireCurve("r", s0, st["right-forward"].output, false));
    const s1 = st["middle-forward"].input;
    forward.push([contact("r", "left", s1), contact("m", "right", s1)]);
    forward.push(wireCurve("m", s1, st["middle-forward"].output, false));
    const s2 = st["left-forward"].input;
    forward.push([contact("m", "left", s2), contact("l", "right", s2)]);
    forward.push(wireCurve("l", s2, st["left-forward"].output, false));
    const s3 = st.reflector.input;
    forward.push([contact("l", "left", s3), contact("ukw", "right", s3)]);
    forward.push(wireCurve("ukw", s3, st.reflector.output, false));
    const s4 = st["left-reverse"].input;
    back.push([contact("ukw", "right", s4), contact("l", "left", s4)]);
    back.push(wireCurve("l", s4, st["left-reverse"].output, true));
    const s5 = st["middle-reverse"].input;
    back.push([contact("l", "right", s5), contact("m", "left", s5)]);
    back.push(wireCurve("m", s5, st["middle-reverse"].output, true));
    const s6 = st["right-reverse"].input;
    back.push([contact("m", "right", s6), contact("r", "left", s6)]);
    back.push(wireCurve("r", s6, st["right-reverse"].output, true));
    const s7 = st["right-reverse"].output;
    back.push([contact("r", "right", s7), contact("etw", "left", s7)]);
    return { forward, back };
  }

  function setDetailRotor(slot: Slot) {
    if (slot === detail) return;
    detail = slot;
    const fresh = enigmaSteps(slot);
    ex.steps.splice(0, ex.steps.length, ...fresh);
    ex.setProgress(ex.progress);
  }

  function setWiringVisible(visible: boolean) {
    for (const slot of SLOTS) rigs[slot].wiring.userData.hidden = !visible;
    ukwWiring.userData.hidden = !visible;
    ex.applyMaterials();
    ex.onChange();
  }

  setConfig(initial, false);
  // The core x-ray step must show wires even when the global toggle is off.
  const baseApply = ex.applyMaterials.bind(ex);
  ex.applyMaterials = () => {
    baseApply();
    for (const slot of SLOTS) {
      const showDetail = ex.progress > 5.35 && slot === detail;
      if (showDetail) rigs[slot].wiring.visible = true;
    }
  };
  ex.applyMaterials();

  return {
    exhibit: ex,
    setConfig,
    setDetailRotor,
    get detailRotor() {
      return detail;
    },
    pressKey: (letter) => {
      pressed = letter;
      ex.onChange();
    },
    lightLamp,
    contact,
    signalPath,
    setWiringVisible,
    setLoomVisible: (visible) => {
      loomMesh.userData.hidden = !visible;
      ex.applyMaterials();
      ex.onChange();
    },
    keyPosition: (letter) => keyPos.get(letter)!.clone().applyMatrix4(keyboard.matrixWorld),
    lampPosition: (letter) => lampPos.get(letter)!.clone().applyMatrix4(lampboard.matrixWorld),
    socketPosition: (letter) => socketPos.get(letter)!.clone().applyMatrix4(plugboard.matrixWorld),
    update,
  };
}

export { A as letterIndex };
