import * as THREE from "three";
import { Exhibit } from "../../engine/Exhibit";
import { DRUM_COLORS, materials } from "../../engine/materials";
import { STEP, anchor, boxGeo, cylZ, group, instanced, mesh, roundedBox, tubes } from "../../engine/shapes";
import { drumFaceTexture, glyphTexture, plateTexture } from "../../engine/textures";
import { ALPHABET, ROTORS, mod26, type RotorId, type Triple } from "../../core/enigma";
import type { Menu } from "../../core/bombe";
import { BOMBE_PARTS, BOMBE_STEPS } from "./catalog";

/** Units are centimetres. Front face of the cabinet at z = FRONT. */
const W = 210,
  H = 198,
  D = 61;
const FRONT = D / 2;
const DRUM_R = 6.0;
const DRUM_T = 4.6;
const COLS = 12;
export const colX = (c: number) => -84 + c * 12.6;
/** bank 0–2 from the top; row 0 top (left rotor), 1 middle, 2 bottom (right rotor). */
export const rowY = (bank: number, row: number) => 176 - bank * 51 - row * 15;
const RING_R = [5.2, 4.3, 3.4, 2.5];

export interface BombeModel {
  exhibit: Exhibit;
  setWheelOrder(rotors: Triple<RotorId>): void;
  /** Positions of the common drums plus per-Enigma right-rotor offsets. */
  setPosition(core: Triple<number>): void;
  setMenu(menu: Menu | null): void;
  setRegister(liveMask: number | null): void;
  /** World position of the indicator / test register for callouts. */
  update(dt: number): boolean;
}

export function buildBombe(initialOrder: Triple<RotorId>): BombeModel {
  const M = materials();
  const root = group("bombe-root");
  const bombe = group("bombe");
  root.add(bombe);
  const parts: { id: string; object: THREE.Object3D }[] = [{ id: "bombe", object: bombe }];
  const reg = <T extends THREE.Object3D>(id: string, object: T) => {
    parts.push({ id, object });
    return object;
  };
  const anchors: Record<string, Record<string, THREE.Object3D>> = {};
  const paint = new THREE.MeshStandardMaterial({ color: "#3d3327", roughness: 0.7, metalness: 0.15, bumpMap: M.crackle.bumpMap, bumpScale: 0.4 });
  const trim = M.aluminium;

  /* ---------------- cabinet ---------------- */
  const cab = group("cabinet");
  bombe.add(cab);
  // Open-backed shell: the rear is closed only by the hinged gate.
  const bodyH = H - 12;
  cab.add(mesh(roundedBox(W, bodyH, 3, 0.6, 2), paint, { pos: [0, 6 + bodyH / 2, FRONT - 1.5], edgeAngle: 20 }));
  cab.add(mesh(roundedBox(3, bodyH, D - 3, 0.6, 2), paint, { pos: [-W / 2 + 1.5, 6 + bodyH / 2, -1.5], edgeAngle: 20 }));
  cab.add(mesh(roundedBox(3, bodyH, D - 3, 0.6, 2), paint, { pos: [W / 2 - 1.5, 6 + bodyH / 2, -1.5], edgeAngle: 20 }));
  cab.add(mesh(boxGeo(W - 6, 3, D - 3), paint, { pos: [0, 7.5, -1.5] }));
  cab.add(mesh(boxGeo(W - 6, 3, D - 3), paint, { pos: [0, H - 7.5, -1.5] }));
  cab.add(mesh(roundedBox(W - 6, 6, D - 8, 0.6, 2), M.rubber, { pos: [0, 3, -1.5] })); // plinth
  cab.add(mesh(roundedBox(W + 2, 4, D + 1, 0.8, 2), paint, { pos: [0, H - 2, -1] })); // cornice
  // Front face plate and bank separators.
  cab.add(mesh(boxGeo(160, 156, 0.6), M.castGrey, { pos: [-14.7, 110, FRONT - 0.6] }));
  for (const y of [135.5, 84.5, 189.5, 30.5])
    cab.add(mesh(boxGeo(162, 1.2, 1.2), trim, { pos: [-14.7, y, FRONT - 0.1] }));
  // Lower panels with louvres.
  for (const x of [-60, 0, 60]) {
    cab.add(mesh(roundedBox(56, 20, 0.8, 0.3), M.castGrey, { pos: [x, 17, FRONT - 0.4] }));
    for (let i = 0; i < 4; i++) cab.add(mesh(boxGeo(40, 1.4, 0.5), M.rubber, { pos: [x, 11.5 + i * 3.6, FRONT + 0.05], edges: false }));
  }

  /* ---------------- drums ---------------- */
  // 107 ordinary drums as instanced bodies + faces; drum 0 is a detailed part.
  const drums = group("drums");
  bombe.add(reg("drums", drums));
  const slots: { bank: number; col: number; row: number; enigma: number }[] = [];
  for (let bank = 0; bank < 3; bank++)
    for (let col = 0; col < COLS; col++)
      for (let row = 0; row < 3; row++) slots.push({ bank, col, row, enigma: bank * 12 + col });
  const ordinary = slots.filter((s) => !(s.bank === 0 && s.col === 0 && s.row === 0));
  const plateMesh = instanced(cylZ(DRUM_R + 0.7, 0.4, 32), M.darkSteel, slots.length, (i, d) => {
    const s = slots[i];
    d.position.set(colX(s.col), rowY(s.bank, s.row), FRONT + 0.1);
  });
  cab.add(plateMesh);
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.42, metalness: 0.08 });
  const bodies = new THREE.InstancedMesh(cylZ(DRUM_R, DRUM_T, 48), bodyMat, ordinary.length);
  const faceMat = new THREE.MeshStandardMaterial({
    map: drumFaceTexture("drum-face-clear", null, "#f4efe3"),
    transparent: true,
    alphaTest: 0.35,
    roughness: 0.5,
  });
  const faces = new THREE.InstancedMesh(new THREE.CircleGeometry(DRUM_R * 0.98, 48), faceMat, ordinary.length);
  const knobs = instanced(cylZ(1.25, 1.4, 24), M.nickel, ordinary.length, (i, d) => {
    const s = ordinary[i];
    d.position.set(colX(s.col), rowY(s.bank, s.row), FRONT + DRUM_T + 0.9);
  });
  for (const m of [bodies, faces]) {
    m.castShadow = true;
    m.userData.noEdges = true;
  }
  drums.add(bodies, faces, knobs);

  /* The detailed drum (bank 0, column 0, top row). */
  const drumX = colX(0),
    drumY = rowY(0, 0);
  const drum = group("drum", [drumX, drumY, FRONT + 0.3]);
  drums.add(reg("drum", drum));
  const drumSpin = group("drum-spin");
  drum.add(drumSpin);
  const drumBody = reg("drum-body", group("drum-body"));
  const drumCap = reg("drum-cap", group("drum-cap"));
  const drumBrushes = reg("drum-brushes", group("drum-brushes"));
  const drumHub = reg("drum-hub", group("drum-hub"));
  drumSpin.add(drumBody, drumCap, drumBrushes, drumHub);
  const bodyColorMat = new THREE.MeshStandardMaterial({ color: DRUM_COLORS[initialOrder[0]], roughness: 0.42 });
  drumBody.add(mesh(cylZ(DRUM_R, DRUM_T - 0.6, 48), bodyColorMat, { pos: [0, 0, DRUM_T / 2], edgeAngle: 40 }));
  const capMat = new THREE.MeshStandardMaterial({
    map: drumFaceTexture("drum-face-clear", null, "#f4efe3"),
    transparent: true,
    alphaTest: 0.35,
  });
  const capPlate = mesh(cylZ(DRUM_R, 0.35, 48), bodyColorMat.clone(), { pos: [0, 0, DRUM_T + 0.2], edgeAngle: 40 });
  drumCap.add(capPlate);
  const capFace = mesh(new THREE.CircleGeometry(DRUM_R * 0.98, 48), capMat, { pos: [0, 0, DRUM_T + 0.42], edges: false });
  drumCap.add(capFace);
  drumHub.add(mesh(cylZ(1.25, 1.4, 24), M.nickel, { pos: [0, 0, DRUM_T + 1.1] }));
  const clip = mesh(new THREE.TorusGeometry(1.7, 0.16, 8, 24, Math.PI * 1.3), M.steel, {
    pos: [0, 0, DRUM_T + 1.6],
  });
  drumHub.add(clip);
  drumBrushes.add(mesh(cylZ(DRUM_R - 0.2, 0.25, 48), M.bakelite, { pos: [0, 0, 0.2] }));
  const brushGeo = boxGeo(0.14, 0.14, 0.9);
  drumBrushes.add(
    instanced(brushGeo, M.steel, 104, (i, d) => {
      const ring = Math.floor(i / 26),
        k = i % 26;
      const a = k * STEP;
      d.position.set(Math.sin(a) * RING_R[ring], Math.cos(a) * RING_R[ring], -0.3);
      d.rotation.set(0.35, 0, -a);
    }),
  );
  // Two wiring sets inside the body (x-ray in the teardown).
  const wiringFor = (type: RotorId) => {
    const W = ROTORS[type].forward,
      Rv = ROTORS[type].reverse;
    const pt = (r: number, k: number, z: number) => new THREE.Vector3(Math.sin(k * STEP) * r, Math.cos(k * STEP) * r, z);
    const outward = Array.from(
      { length: 26 },
      (_, j) => new THREE.CubicBezierCurve3(pt(RING_R[0], j, 0.4), pt(RING_R[0] * 0.9, j, 3.4), pt(RING_R[2] * 1.05, W[j], 3.4), pt(RING_R[2], W[j], 0.4)),
    );
    const back = Array.from(
      { length: 26 },
      (_, j) => new THREE.CubicBezierCurve3(pt(RING_R[3], j, 0.4), pt(RING_R[3], j, 2.6), pt(RING_R[1], Rv[j], 2.6), pt(RING_R[1], Rv[j], 0.4)),
    );
    return { outward: tubes(outward, 0.05, 20, 4), back: tubes(back, 0.05, 20, 4) };
  };
  const wiring0 = wiringFor(initialOrder[0]);
  const wireOut = mesh(wiring0.outward, M.copper, { edges: false });
  const wireBack = mesh(wiring0.back, new THREE.MeshStandardMaterial({ color: "#d7b46a", metalness: 0.9, roughness: 0.35 }), {
    edges: false,
  });
  for (const w of [wireOut, wireBack]) {
    w.userData.alwaysSolid = true;
    drumBody.add(w);
  }
  anchors.drum = {
    face: anchor(drumCap, [DRUM_R * 0.5, DRUM_R * 0.65, DRUM_T + 0.5]),
    outer: anchor(drumBody, [RING_R[0] * 0.7, -RING_R[0] * 0.7, 2.6]),
    inner: anchor(drumBody, [-RING_R[3] * 0.7, -RING_R[3] * 0.6, 2.0]),
    brushes: anchor(drumBrushes, [-RING_R[0] * 0.75, RING_R[0] * 0.6, -0.4]),
    clip: anchor(drumHub, [1.3, 1.1, DRUM_T + 1.7]),
  };

  /* Commutator studs behind the detailed drum. */
  const commutator = group("commutator", [drumX, drumY, FRONT + 0.35]);
  bombe.add(reg("commutator", commutator));
  commutator.add(
    instanced(cylZ(0.24, 0.3, 10), M.brass, 104, (i, d) => {
      const ring = Math.floor(i / 26),
        k = i % 26;
      d.position.set(Math.sin(k * STEP) * RING_R[ring], Math.cos(k * STEP) * RING_R[ring], 0);
    }),
  );
  commutator.add(mesh(cylZ(0.45, 7, 16), M.steel, { pos: [0, 0, 3.4] })); // spindle
  anchors.commutator = {};

  /* ---------------- indicator & switches (right panel) ---------------- */
  const indicator = group("indicator");
  bombe.add(reg("indicator", indicator));
  indicator.add(mesh(roundedBox(30, 74, 1.2, 0.5), M.castGrey, { pos: [84, 140, FRONT - 0.2] }));
  indicator.add(mesh(boxGeo(30.5, 0.8, 1.4), trim, { pos: [84, 177.5, FRONT] }));
  const indicatorDrums: THREE.Group[] = [];
  const indicatorFace = new THREE.MeshStandardMaterial({
    map: drumFaceTexture("indicator-face", "#e9e3d4", "#1b1c1e"),
    roughness: 0.6,
  });
  for (let r = 0; r < 3; r++) {
    const g = group(`ind-${r}`, [84, 166 - r * 12.5, FRONT + 0.4]);
    g.add(mesh(cylZ(4.6, 2.2, 40), M.darkSteel, { pos: [0, 0, 1.1] }));
    const face = mesh(new THREE.CircleGeometry(4.5, 40), indicatorFace, { pos: [0, 0, 2.25], edges: false });
    g.add(face);
    indicator.add(g);
    indicatorDrums.push(g);
    // Fixed pointer above each indicator drum.
    indicator.add(mesh(boxGeo(0.6, 1.4, 0.5), M.red, { pos: [84, 166 - r * 12.5 + 5.3, FRONT + 2.6] }));
  }
  // Test register: 26 lamps in two rows with letters.
  const lampMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, emissive: "#000000" });
  const registerLamps = new THREE.InstancedMesh(cylZ(0.75, 0.6, 16), lampMat, 26);
  const lampOff = new THREE.Color("#3a3c3f"),
    lampOn = new THREE.Color("#ffb72e");
  const lampPos = (i: number) => new THREE.Vector3(73.2 + (i % 13) * 1.8, 112 - Math.floor(i / 13) * 6.5, FRONT + 0.6);
  {
    const d = new THREE.Object3D();
    for (let i = 0; i < 26; i++) {
      d.position.copy(lampPos(i));
      d.updateMatrix();
      registerLamps.setMatrixAt(i, d.matrix);
      registerLamps.setColorAt(i, lampOff);
    }
    registerLamps.userData.noEdges = true;
    indicator.add(registerLamps);
  }
  for (let row = 0; row < 2; row++) {
    const label = mesh(
      new THREE.PlaneGeometry(23.4, 1.6),
      new THREE.MeshBasicMaterial({
        map: plateTexture(`register-${row}`, ALPHABET.slice(row * 13, row * 13 + 13).split("").join("   "), {
          w: 1024,
          h: 70,
          bg: "#5d6266",
          fg: "#f0ece2",
          size: 44,
          font: '"Lab Mono", monospace',
        }),
      }),
      { edges: false },
    );
    label.position.set(84, 109.6 - row * 6.5, FRONT + 0.45);
    indicator.add(label);
  }
  const registerTitle = mesh(
    new THREE.PlaneGeometry(22, 2.4),
    new THREE.MeshBasicMaterial({ map: plateTexture("register-title", "TEST REGISTER", { w: 512, h: 56, bg: "#5d6266", fg: "#f0ece2", size: 34 }) }),
    { edges: false },
  );
  registerTitle.position.set(84, 117, FRONT + 0.45);
  indicator.add(registerTitle);
  // Switch panel (bottom right).
  const switches = group("switches");
  indicator.add(switches);
  switches.add(mesh(roundedBox(30, 22, 1.2, 0.5), M.castGrey, { pos: [84, 52, FRONT - 0.2] }));
  for (let i = 0; i < 3; i++) {
    switches.add(mesh(cylZ(1.6, 0.8, 24), M.nickel, { pos: [75 + i * 9, 56, FRONT + 0.6] }));
    const lever = mesh(roundedBox(0.7, 3.4, 0.7, 0.2), M.nickel, { pos: [75 + i * 9, 57.4, FRONT + 1.6] });
    lever.rotation.x = -0.5;
    switches.add(lever);
  }
  switches.add(mesh(cylZ(1.8, 1.4, 24), M.red, { pos: [78, 46, FRONT + 0.8] }));
  switches.add(mesh(cylZ(1.8, 1.4, 24), new THREE.MeshStandardMaterial({ color: "#2e6a47", roughness: 0.5 }), { pos: [90, 46, FRONT + 0.8] }));
  anchors.indicator = {
    drums: anchor(indicator, [88.6, 166, FRONT + 2.6]),
    register: anchor(indicator, [96.5, 106, FRONT + 1]),
  };

  /* ---------------- reflector boards (left end) ---------------- */
  const reflectors = group("reflectors");
  bombe.add(reflectors);
  for (let b = 0; b < 3; b++) {
    const y = 160 - b * 51;
    reflectors.add(mesh(roundedBox(1.2, 26, 34, 0.4), M.castGrey, { pos: [-W / 2 - 0.4, y, 4] }));
    reflectors.add(
      instanced(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12).rotateZ(Math.PI / 2), M.brass, 26, (i, d) => {
        d.position.set(-W / 2 - 1.1, y + 8 - Math.floor(i / 9) * 7, -8 + (i % 9) * 3.2);
      }),
    );
  }

  /* ---------------- rear gate, diagonal board, relays, cables ---------------- */
  const gateHingeX = -96;
  const gate = group("gate", [gateHingeX, 0, -D / 2 - 1.2]);
  bombe.add(reg("gate", gate));
  gate.add(mesh(boxGeo(192, 4, 2.4), trim, { pos: [96, 190, 0] }));
  gate.add(mesh(boxGeo(192, 4, 2.4), trim, { pos: [96, 18, 0] }));
  gate.add(mesh(boxGeo(4, 176, 2.4), trim, { pos: [2, 104, 0] }));
  gate.add(mesh(boxGeo(4, 176, 2.4), trim, { pos: [190, 104, 0] }));
  const stripX = (k: number) => 22 + k * 19.5;
  const diagonal = group("diagonal-board");
  gate.add(reg("diagonal-board", diagonal));
  const jackGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.8, 16).rotateX(Math.PI / 2);
  const jackMat = new THREE.MeshStandardMaterial({ color: "#121314", roughness: 0.6 });
  const stripMat = M.castGrey;
  const jacksOf = (k: number) => {
    const kind = k % 3; // 0 diagonal, 1 commons, 2 drums
    const n = kind === 0 ? 26 : kind === 1 ? 25 : 24;
    return Array.from({ length: n }, (_, i) => {
      const y = 180 - i * (150 / n) - (kind === 1 ? Math.floor(i / 5) * 1.2 : 0);
      return new THREE.Vector3(stripX(k), y, -1.6);
    });
  };
  for (let k = 0; k < 9; k++) {
    const kind = k % 3;
    const target = kind === 0 ? diagonal : gate;
    target.add(mesh(boxGeo(8.5, 160, 1.4), stripMat, { pos: [stripX(k), 105, -0.6] }));
    const jacks = jacksOf(k);
    target.add(
      instanced(jackGeo, kind === 0 ? new THREE.MeshStandardMaterial({ color: "#3a2416", roughness: 0.5 }) : jackMat, jacks.length, (i, d) => {
        d.position.copy(jacks[i]);
      }),
    );
  }
  anchors.gate = {
    diagonal: anchor(diagonal, [stripX(3), 120, -2.4]),
    commons: anchor(gate, [stripX(4), 150, -2.4]),
    enigmas: anchor(gate, [stripX(5), 90, -2.4]),
  };
  const relays = group("relays");
  bombe.add(reg("relays", relays));
  relays.add(mesh(boxGeo(186, 168, 1), M.castGrey, { pos: [0, 104, -18] }));
  relays.add(
    instanced(roundedBox(5.2, 7.4, 6, 0.4), new THREE.MeshStandardMaterial({ color: "#4a3f35", roughness: 0.5 }), 104, (i, d) => {
      d.position.set(-78 + (i % 13) * 13, 168 - Math.floor(i / 13) * 17, -22.5);
    }),
  );
  relays.add(
    instanced(roundedBox(4.6, 2.2, 6.2, 0.3), M.nickel, 104, (i, d) => {
      d.position.set(-78 + (i % 13) * 13, 168 - Math.floor(i / 13) * 17 + 4.4, -22.5);
    }),
  );
  const cables = group("cables");
  gate.add(reg("cables", cables));
  anchors.relays = {};
  anchors.bombe = {
    drums: anchor(drums, [colX(6), rowY(0, 0) + 7, FRONT + DRUM_T]),
    indicator: anchor(indicator, [88.6, 166, FRONT + 2.6]),
    switches: anchor(indicator, [90, 46, FRONT + 1.5]),
    reflectors: anchor(reflectors, [-W / 2 - 1.2, 160, 4]),
  };
  anchors.drums = {
    top: anchor(drums, [colX(3) + DRUM_R * 0.7, rowY(1, 0) + 4, FRONT + DRUM_T]),
    middle: anchor(drums, [colX(3) + DRUM_R * 0.7, rowY(1, 1) + 4, FRONT + DRUM_T]),
    bottom: anchor(drums, [colX(3) + DRUM_R * 0.7, rowY(1, 2) + 4, FRONT + DRUM_T]),
  };

  /* ---------------- exhibit ---------------- */
  const metas = new Map(BOMBE_PARTS.map((m) => [m.id, m]));
  const exhibit = new Exhibit({
    root,
    parts: parts.map(({ id, object }) => ({ meta: metas.get(id)!, object })),
    steps: BOMBE_STEPS,
    anchors,
  });

  /* ---------------- state ---------------- */
  let order = initialOrder;
  let core: Triple<number> = [0, 0, 0];
  let offsets = new Array<number>(36).fill(0);
  const shown: number[] = new Array(slots.length).fill(-1);
  const target: number[] = new Array(slots.length).fill(0);
  const dummy = new THREE.Object3D();
  let dirtyInstances = true;
  let menuShown: Menu | null = null;

  const letterOf = (s: (typeof slots)[number]) =>
    s.row === 0 ? core[0] : s.row === 1 ? core[1] : mod26(core[2] + offsets[s.enigma]);

  function setWheelOrder(next: Triple<RotorId>) {
    order = next;
    const c = new THREE.Color();
    ordinary.forEach((s, i) => {
      c.set(DRUM_COLORS[order[s.row]]);
      bodies.setColorAt(i, c);
    });
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    bodyColorMat.color.set(DRUM_COLORS[order[0]]);
    (capPlate.material as THREE.MeshStandardMaterial).color.set(DRUM_COLORS[order[0]]);
    const w = wiringFor(order[0]);
    wireOut.geometry = w.outward;
    wireBack.geometry = w.back;
    exhibit.onChange();
  }

  function setPosition(next: Triple<number>) {
    core = next;
    slots.forEach((s, i) => (target[i] = letterOf(s)));
    dirtyInstances = true;
    exhibit.onChange();
  }

  function applyInstances() {
    ordinary.forEach((s, i) => {
      const k = slots.indexOf(s);
      const angle = shown[k] * STEP;
      dummy.position.set(colX(s.col), rowY(s.bank, s.row), FRONT + 0.3 + DRUM_T / 2);
      dummy.rotation.set(0, 0, angle);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.z = FRONT + 0.3 + DRUM_T + 0.08;
      dummy.updateMatrix();
      faces.setMatrixAt(i, dummy.matrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
    faces.instanceMatrix.needsUpdate = true;
    drumSpin.rotation.z = shown[0] * STEP;
    indicatorDrums.forEach((g, r) => (g.rotation.z = core[r] * STEP));
  }

  function update(): boolean {
    let moved = dirtyInstances;
    for (let i = 0; i < slots.length; i++) {
      if (shown[i] !== target[i]) {
        shown[i] = target[i];
        moved = true;
      }
    }
    if (moved) applyInstances();
    dirtyInstances = false;
    return moved;
  }

  function setRegister(mask: number | null) {
    for (let i = 0; i < 26; i++) registerLamps.setColorAt(i, mask !== null && mask & (1 << i) ? lampOn : lampOff);
    if (registerLamps.instanceColor) registerLamps.instanceColor.needsUpdate = true;
    lampMat.emissive.set(mask !== null ? "#3a2400" : "#000000");
    exhibit.onChange();
  }

  /** Menu cables on the rear gate: each link's Enigma joins the commons of its two letters. */
  function setMenu(menu: Menu | null) {
    menuShown = menu;
    offsets = new Array<number>(36).fill(0);
    for (const child of [...cables.children]) {
      cables.remove(child);
      (child as THREE.Mesh).geometry?.dispose();
    }
    if (!menu) {
      setPosition(core);
      return;
    }
    menu.links.forEach((link, k) => (offsets[k] = link.index));
    const commonsJacks = [...jacksOf(1), ...jacksOf(4), ...jacksOf(7).slice(0, 10)];
    const drumJacks = [...jacksOf(2), ...jacksOf(5), ...jacksOf(8)];
    const diagJacks = jacksOf(0);
    const commonOf = new Map(menu.letters.map((l, i) => [l, i]));
    const commonPos = (letter: number) => {
      const i = commonOf.get(letter)!;
      const group5 = Math.min(commonsJacks.length - 1, i * 2);
      return commonsJacks[group5].clone().setZ(-2.2);
    };
    const curves: THREE.Curve<THREE.Vector3>[] = [];
    const hang = (a: THREE.Vector3, b: THREE.Vector3, sag: number) =>
      new THREE.CatmullRomCurve3([
        a,
        a.clone().add(new THREE.Vector3(0, -2, -2.5)),
        a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -sag, -5.5)),
        b.clone().add(new THREE.Vector3(0, -2, -2.5)),
        b,
      ]);
    menu.links.forEach((link, k) => {
      const inJack = drumJacks[(k * 2) % drumJacks.length].clone().setZ(-2.2);
      const outJack = drumJacks[(k * 2 + 1) % drumJacks.length].clone().setZ(-2.2);
      curves.push(hang(inJack, commonPos(link.plain), 6 + (k % 4) * 2));
      curves.push(hang(outJack, commonPos(link.cipher), 8 + (k % 3) * 2));
    });
    // Each common also goes to its letter's jack on the diagonal board.
    for (const letter of menu.letters) curves.push(hang(commonPos(letter), diagJacks[letter].clone().setZ(-2.2), 4));
    const geo = tubes(curves, 0.55, 40, 8);
    const cableMesh = mesh(geo, new THREE.MeshStandardMaterial({ color: "#b9ad97", roughness: 0.85 }), { edges: false });
    cables.add(cableMesh);
    exhibit.adopt("cables", [cableMesh]);
    setPosition(core);
  }

  setWheelOrder(initialOrder);
  setPosition([0, 0, 0]);
  setRegister(null);
  update();
  void menuShown;

  return { exhibit, setWheelOrder, setPosition, setMenu, setRegister, update };
}

/** Plain letter for a drum glyph, used in captions. */
export const glyph = (n: number) => ALPHABET[mod26(n)];
export { glyphTexture };
