import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ALPHABET } from "./enigma";
import {
  createHorizontalPanelGeometry,
  DECK,
  deckHoles,
  HOOD,
  HOOD_FRONT,
  HOOD_SLOT,
  HOOD_WINDOW,
  hoodHoles,
  KEY_BAY,
  KEY_PANEL,
  KEY_ROWS,
  keyHoles,
  keyPoint,
  LAMP_BAY,
  LAMP_PANEL,
  lampHoles,
  ROTOR_AXIS,
  ROTOR_CENTERS,
  ROTOR_NUMBER_RING,
  ROTOR_THUMBWHEEL,
  ROTOR_WELL,
} from "./housing-layout";

function panelMesh(
  geometry: THREE.BufferGeometry,
  position: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.position.set(...position);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function verticalHits(
  mesh: THREE.Mesh,
  x: number,
  z: number,
  fromBelow = false,
) {
  return new THREE.Raycaster(
    new THREE.Vector3(x, fromBelow ? -5 : 5, z),
    new THREE.Vector3(0, fromBelow ? 1 : -1, 0),
  ).intersectObject(mesh, false);
}

function disposePanel(
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
) {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

describe("shared housing and instrument assembly", () => {
  it("places each letter exactly once in the historical 9/8/9 staggered rows", () => {
    expect(KEY_ROWS.map((row) => row.length)).toEqual([9, 8, 9]);
    expect([...KEY_ROWS.join("")].sort().join("")).toBe(ALPHABET);
    expect(lampHoles).toHaveLength(26);
    expect(keyHoles).toHaveLength(26);
    expect(new Set(lampHoles.map(({ x, z }) => `${x},${z}`)).size).toBe(26);
    expect(new Set(keyHoles.map(({ x, z }) => `${x},${z}`)).size).toBe(26);
    expect(keyPoint("Q", "key")).toEqual([-2.24, 1.45, 0.83]);
    const middleLamp = keyPoint("K", "lamp");
    expect(middleLamp[0]).toBeCloseTo(1.96);
    expect(middleLamp[1]).toBe(1.3);
    expect(middleLamp[2]).toBeCloseTo(0);
    expect(keyPoint("L", "lamp")).toEqual([2.24, 1.3, 0.33]);
    expect(keyPoint("q", "key")).toEqual(keyPoint("Q", "key"));
  });

  it("leaves true through-holes for all 26 lamp lenses and key stems, including their outer clearance", () => {
    for (const type of ["key", "lamp"] as const) {
      const panel = type === "key" ? KEY_PANEL : LAMP_PANEL;
      const holes = type === "key" ? keyHoles : lampHoles;
      const mesh = panelMesh(
        createHorizontalPanelGeometry(
          panel.width,
          panel.depth,
          panel.thickness,
          holes,
        ),
        [panel.x, panel.bottom, panel.z],
      );
      for (const letter of ALPHABET) {
        const [x, , z] = keyPoint(letter, type);
        const offsets =
          type === "key"
            ? [
                [0, 0],
                [-0.065, -0.065],
                [-0.065, 0.065],
                [0.065, -0.065],
                [0.065, 0.065],
              ]
            : Array.from({ length: 12 }, (_, i) => [
                0.166 * Math.cos((i * Math.PI) / 6),
                0.166 * Math.sin((i * Math.PI) / 6),
              ]);
        for (const [dx, dz] of offsets) {
          expect(verticalHits(mesh, x + dx, z + dz)).toHaveLength(0);
          expect(verticalHits(mesh, x + dx, z + dz, true)).toHaveLength(0);
        }
      }
      // Halfway between neighboring terminals is still solid panel material.
      const [x, , z] = keyPoint("Q", type);
      expect(verticalHits(mesh, x + 0.28, z).length).toBeGreaterThan(0);
      expect(verticalHits(mesh, 2.69, panel.z).length).toBeGreaterThan(0);
      disposePanel(mesh);
    }
  });

  it("keeps all three deck apertures open and preserves the bridges and perimeter between them", () => {
    const mesh = panelMesh(
      createHorizontalPanelGeometry(
        DECK.width,
        DECK.depth,
        DECK.thickness,
        deckHoles,
      ),
      [0, DECK.bottom, 0],
    );
    for (const bay of [ROTOR_WELL, LAMP_BAY, KEY_BAY]) {
      expect(verticalHits(mesh, bay.x, bay.z)).toHaveLength(0);
      expect(verticalHits(mesh, bay.x, bay.z, true)).toHaveLength(0);
    }
    for (const z of [-0.8, 0.54])
      for (const x of [-2.0, 0, 2.0])
        expect(verticalHits(mesh, x, z).length).toBeGreaterThan(0);
    expect(verticalHits(mesh, 2.87, 0).length).toBeGreaterThan(0);
    expect(verticalHits(mesh, -2.87, -2.2).length).toBeGreaterThan(0);
    // A real rounded aperture retains material inside its omitted square corner.
    const cornerX = ROTOR_WELL.x - ROTOR_WELL.width / 2;
    const cornerZ = ROTOR_WELL.z - ROTOR_WELL.depth / 2;
    expect(
      verticalHits(mesh, cornerX + 0.005, cornerZ + 0.005).length,
    ).toBeGreaterThan(0);
    expect(verticalHits(mesh, cornerX + 0.08, cornerZ + 0.08)).toHaveLength(0);
    disposePanel(mesh);
  });

  it("clears the complete lamp sleeves through the deck and keeps the staggered lamp rims apart", () => {
    const deck = panelMesh(
      createHorizontalPanelGeometry(
        DECK.width,
        DECK.depth,
        DECK.thickness,
        deckHoles,
      ),
      [0, DECK.bottom, 0],
    );
    const lamps = [...ALPHABET].map((letter) => keyPoint(letter, "lamp"));
    for (const [x, , z] of lamps) {
      // The sleeves start below deck top, so every point on their .173 outer
      // radius needs the actual bay opening through the entire deck thickness.
      for (let sample = 0; sample < 32; sample++) {
        const angle = (sample * Math.PI * 2) / 32;
        const sleeveX = x + 0.173 * Math.cos(angle);
        const sleeveZ = z + 0.173 * Math.sin(angle);
        expect(verticalHits(deck, sleeveX, sleeveZ)).toHaveLength(0);
        expect(verticalHits(deck, sleeveX, sleeveZ, true)).toHaveLength(0);
      }
      // The complete outer lamp rim is ahead of the hood's front return lip.
      expect(
        z - 0.178 - (HOOD_FRONT.lipZ + HOOD_FRONT.lipDepth / 2),
      ).toBeGreaterThanOrEqual(0.025 - 1e-10);
    }
    for (let a = 0; a < lamps.length; a++)
      for (let b = a + 1; b < lamps.length; b++)
        expect(
          Math.hypot(lamps[a][0] - lamps[b][0], lamps[a][2] - lamps[b][2]),
        ).toBeGreaterThan(0.356);
    disposePanel(deck);
  });

  it("clears the new 0.86-radius thumbwheels through the complete deck thickness", () => {
    const mesh = panelMesh(
      createHorizontalPanelGeometry(
        DECK.width,
        DECK.depth,
        DECK.thickness,
        deckHoles,
      ),
      [0, DECK.bottom, 0],
    );
    for (const center of ROTOR_CENTERS) {
      for (const y of [DECK.bottom, DECK.bottom + DECK.thickness]) {
        const halfSpan = Math.sqrt(
          ROTOR_THUMBWHEEL.radius ** 2 - (y - ROTOR_AXIS.y) ** 2,
        );
        expect(ROTOR_AXIS.z + halfSpan).toBeLessThan(
          ROTOR_WELL.z + ROTOR_WELL.depth / 2,
        );
        expect(ROTOR_AXIS.z - halfSpan).toBeGreaterThan(
          ROTOR_WELL.z - ROTOR_WELL.depth / 2,
        );
        for (const side of [-1, 1])
          for (const z of [ROTOR_AXIS.z - halfSpan, ROTOR_AXIS.z + halfSpan]) {
            const x =
              center +
              ROTOR_THUMBWHEEL.xOffset +
              (side * ROTOR_THUMBWHEEL.thickness) / 2;
            expect(verticalHits(mesh, x, z)).toHaveLength(0);
          }
      }
    }
    disposePanel(mesh);
  });

  it("uses a bottom-origin thickness and keeps both removable panels above the deck", () => {
    for (const panel of [LAMP_PANEL, KEY_PANEL]) {
      const geometry = createHorizontalPanelGeometry(
        panel.width,
        panel.depth,
        panel.thickness,
        [],
      );
      expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 8);
      expect(geometry.boundingBox!.max.y).toBeCloseTo(panel.thickness, 8);
      expect(panel.bottom - (DECK.bottom + DECK.thickness)).toBeGreaterThan(
        0.01,
      );
      expect(KEY_PANEL.bottom + KEY_PANEL.thickness).toBeLessThan(1.318);
      geometry.dispose();
    }
    expect(LAMP_PANEL.z + LAMP_PANEL.depth / 2).toBeLessThan(
      KEY_PANEL.z - KEY_PANEL.depth / 2,
    );
  });
});

function hoodMeshes() {
  return [
    panelMesh(
      createHorizontalPanelGeometry(
        HOOD.width,
        HOOD.depth,
        HOOD.thickness,
        hoodHoles,
      ),
      [HOOD.x, HOOD.bottom, HOOD.z],
    ),
    ...ROTOR_CENTERS.flatMap((center) =>
      [HOOD_WINDOW, HOOD_SLOT].map((opening) =>
        panelMesh(
          createHorizontalPanelGeometry(
            opening.frameWidth,
            opening.frameDepth,
            opening.frameThickness,
            [
              {
                x: 0,
                z: 0,
                width: opening.width,
                depth: opening.depth,
                radius: opening.radius,
              },
            ],
          ),
          [
            center + opening.xOffset,
            opening.frameBottom,
            ROTOR_AXIS.z + opening.zOffset,
          ],
        ),
      ),
    ),
  ];
}

function hoodBodyMeshes() {
  const frontHeight = HOOD.bottom - HOOD_FRONT.bottom;
  const boxes: {
    size: [number, number, number];
    position: [number, number, number];
  }[] = [
    { size: [4.81, 1.15, 0.043], position: [HOOD.x, 1.98, -2.456] },
    {
      size: [4.8, frontHeight, HOOD_FRONT.thickness],
      position: [HOOD.x, HOOD_FRONT.bottom + frontHeight / 2, HOOD_FRONT.z],
    },
    {
      size: [4.82, HOOD_FRONT.lipHeight, HOOD_FRONT.lipDepth],
      position: [HOOD.x, HOOD_FRONT.lipY, HOOD_FRONT.lipZ],
    },
    ...[-1, 1].map((side) => ({
      size: [0.045, 1.225, 1.81] as [number, number, number],
      position: [HOOD.x + side * (HOOD.width / 2 - 0.023), 1.942, -1.53] as [
        number,
        number,
        number,
      ],
    })),
    // Conservative envelopes include the protruding retaining plates and levers.
    ...[-1.82, 1.56].map((x) => ({
      size: [0.178, 0.285, 0.062] as [number, number, number],
      position: [x, 1.72, HOOD_FRONT.z + HOOD_FRONT.thickness / 2 + 0.031] as [
        number,
        number,
        number,
      ],
    })),
  ];
  return boxes.map(({ size, position }) =>
    panelMesh(new THREE.BoxGeometry(...size), position),
  );
}

describe("rotor hood clearance", () => {
  it("leaves all 26 complete lamp letter faces visible past the hood in the default and lamp inspection views", () => {
    const hood = [...hoodMeshes(), ...hoodBodyMeshes()];
    for (const letter of ALPHABET) {
      const [x, , z] = keyPoint(letter, "lamp");
      // Sample each lettering plane's center, corners and edge midpoints.
      // The real letter film is .263 square at Y=1.307.
      for (const dx of [-0.1315, 0, 0.1315])
        for (const dz of [-0.1315, 0, 0.1315]) {
          const glyphPoint = new THREE.Vector3(x + dx, 1.307, z + dz);
          for (const eye of [
            new THREE.Vector3(7, 8.6, 8.8),
            new THREE.Vector3(3.1, 6.3, 4.5),
          ]) {
            const ray = new THREE.Raycaster(
              glyphPoint,
              eye.clone().sub(glyphPoint).normalize(),
              0,
              eye.distanceTo(glyphPoint),
            );
            expect(ray.intersectObjects(hood, false)).toHaveLength(0);
          }
        }
    }
    hood.forEach(disposePanel);
  });

  it("keeps roof and aperture frames outside the complete thumbwheel sweep at every rotor", () => {
    const panels = hoodMeshes();
    const frameBounds = panels
      .slice(1)
      .map((frame) => new THREE.Box3().setFromObject(frame));
    for (let i = 0; i < frameBounds.length; i++)
      for (let j = i + 1; j < frameBounds.length; j++)
        expect(frameBounds[i].intersectsBox(frameBounds[j])).toBe(false);
    for (const center of ROTOR_CENTERS) {
      for (const side of [-1, -0.5, 0, 0.5, 1]) {
        const x =
          center +
          ROTOR_THUMBWHEEL.xOffset +
          (side * ROTOR_THUMBWHEEL.thickness) / 2;
        // Sample the swept disk, not one convenient resting tooth angle. The
        // old 0.72-deep slot clips its front/back arc at the roof's bottom face.
        for (let step = -100; step <= 100; step++) {
          const z = ROTOR_AXIS.z + (step * ROTOR_THUMBWHEEL.radius) / 100;
          for (const panel of panels) {
            for (const hit of verticalHits(panel, x, z))
              expect(
                Math.hypot(
                  hit.point.y - ROTOR_AXIS.y,
                  hit.point.z - ROTOR_AXIS.z,
                ),
              ).toBeGreaterThan(ROTOR_THUMBWHEEL.radius + 0.005);
          }
        }
      }
    }
    panels.forEach(disposePanel);
  });

  it("keeps both the vertical front skirt and its return lip clear of all rotating teeth", () => {
    const front = new THREE.Box3(
      new THREE.Vector3(
        HOOD.x - 2.4,
        HOOD_FRONT.bottom,
        HOOD_FRONT.z - HOOD_FRONT.thickness / 2,
      ),
      new THREE.Vector3(
        HOOD.x + 2.4,
        HOOD.bottom,
        HOOD_FRONT.z + HOOD_FRONT.thickness / 2,
      ),
    );
    const lip = new THREE.Box3(
      new THREE.Vector3(
        HOOD.x - 2.41,
        HOOD_FRONT.lipY - HOOD_FRONT.lipHeight / 2,
        HOOD_FRONT.lipZ - HOOD_FRONT.lipDepth / 2,
      ),
      new THREE.Vector3(
        HOOD.x + 2.41,
        HOOD_FRONT.lipY + HOOD_FRONT.lipHeight / 2,
        HOOD_FRONT.lipZ + HOOD_FRONT.lipDepth / 2,
      ),
    );
    for (const center of ROTOR_CENTERS) {
      for (let step = 0; step < 720; step++) {
        const angle = (step * Math.PI) / 360;
        const tooth = new THREE.Vector3(
          center + ROTOR_THUMBWHEEL.xOffset,
          ROTOR_AXIS.y + Math.sin(angle) * ROTOR_THUMBWHEEL.radius,
          ROTOR_AXIS.z + Math.cos(angle) * ROTOR_THUMBWHEEL.radius,
        );
        expect(front.distanceToPoint(tooth)).toBeGreaterThan(0.025);
        expect(lip.distanceToPoint(tooth)).toBeGreaterThan(0.025);
      }
    }
  });

  it("shows the current numeral center through the assembled window from above, the inspection view, and the default camera", () => {
    const panels = hoodMeshes();
    // Read the physical ring. The last direction approximates the default
    // camera; its forward parallax almost reaches the aperture's front edge.
    for (const center of ROTOR_CENTERS) {
      for (const direction of [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0.1, 1, 0.7).normalize(),
        new THREE.Vector3(1.15, 1, 1.7).normalize(),
      ]) {
        const numeral = new THREE.Vector3(
          center,
          ROTOR_AXIS.y + ROTOR_NUMBER_RING.labelRadius,
          ROTOR_AXIS.z,
        );
        const ray = new THREE.Raycaster(numeral, direction, 0, 2);
        expect(ray.intersectObjects(panels, false)).toHaveLength(0);
      }
    }
    // The cover still closes the area between neighboring viewing windows.
    expect(verticalHits(panels[0], -0.22, ROTOR_AXIS.z).length).toBeGreaterThan(
      0,
    );
    panels.forEach(disposePanel);
  });

  it("occludes both adjacent numeral centers from directly above", () => {
    const panels = hoodMeshes();
    const pitch = (Math.PI * 2) / 26;
    for (const center of ROTOR_CENTERS) {
      for (const sign of [-1, 1]) {
        const numeral = new THREE.Vector3(
          center,
          ROTOR_AXIS.y + ROTOR_NUMBER_RING.labelRadius * Math.cos(pitch),
          ROTOR_AXIS.z + sign * ROTOR_NUMBER_RING.labelRadius * Math.sin(pitch),
        );
        const ray = new THREE.Raycaster(
          numeral,
          new THREE.Vector3(0, 1, 0),
          0,
          2,
        );
        expect(ray.intersectObjects(panels, false).length).toBeGreaterThan(0);
      }
    }
    panels.forEach(disposePanel);
  });

  it("keeps the physical number ring and all rotating label corners below the roof", () => {
    expect(ROTOR_NUMBER_RING.radius).toBeLessThan(
      ROTOR_NUMBER_RING.labelRadius,
    );
    // The labels are tangent planes, so their corners sweep farther than their
    // center radius. Checking that envelope covers every intermediate rotation.
    const sweptRadius = Math.hypot(
      ROTOR_NUMBER_RING.labelRadius,
      ROTOR_NUMBER_RING.labelHeight / 2,
    );
    expect(HOOD.bottom - ROTOR_AXIS.y - sweptRadius).toBeGreaterThan(0.01);
    for (let step = 0; step < 720; step++) {
      const angle = (step * Math.PI) / 360;
      for (const tangent of [-1, 1]) {
        const y =
          ROTOR_AXIS.y +
          ROTOR_NUMBER_RING.labelRadius * Math.cos(angle) +
          tangent * (ROTOR_NUMBER_RING.labelHeight / 2) * Math.sin(angle);
        expect(HOOD.bottom - y).toBeGreaterThan(0.01);
      }
    }
  });
});
