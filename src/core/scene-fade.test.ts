import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createObjectFade } from "./scene-fade";

function materialState(material: THREE.Material) {
  return {
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    alphaHash: material.alphaHash,
  };
}

describe("component inspection fade preserves machine depth and material state", () => {
  it("restores the body and nested rotor together without moving opaque parts into the transparent queue", () => {
    const root = new THREE.Group();
    const body = new THREE.MeshStandardMaterial();
    const drum = new THREE.MeshStandardMaterial();
    const sidePlate = new THREE.MeshStandardMaterial();
    const rotor = new THREE.Group();
    rotor.add(new THREE.Mesh(undefined, [drum, sidePlate]));
    root.add(new THREE.Mesh(undefined, body), rotor);
    const fade = createObjectFade();

    for (const alpha of [0.08, 0.5, 0.95, 0.998]) {
      fade(root, alpha);
      expect(root.visible).toBe(true);
      for (const material of [body, drum, sidePlate]) {
        expect(material.opacity).toBeCloseTo(alpha, 12);
        expect(material.transparent).toBe(false);
        expect(material.depthWrite).toBe(true);
        expect(material.alphaHash).toBe(true);
      }
    }
    fade(root, 1);
    for (const material of [body, drum, sidePlate]) {
      expect(materialState(material)).toEqual({
        opacity: 1,
        transparent: false,
        depthWrite: true,
        alphaHash: false,
      });
    }
  });

  it("preserves native ghost-shell transparency and each material's original depth policy", () => {
    const ghost = new THREE.MeshStandardMaterial({
      opacity: 0.035,
      transparent: true,
      depthWrite: false,
    });
    const transparentDepthWriter = new THREE.MeshStandardMaterial({
      opacity: 0.42,
      transparent: true,
      depthWrite: true,
      alphaHash: true,
    });
    const opaqueNoDepth = new THREE.MeshStandardMaterial({
      opacity: 0.9,
      depthWrite: false,
    });
    const materials = [ghost, transparentDepthWriter, opaqueNoDepth];
    const snapshots = materials.map(materialState);
    const root = new THREE.Mesh(undefined, materials);
    const fade = createObjectFade();

    fade(root, 0.5);
    materials.forEach((material, index) => {
      expect(material.opacity).toBeCloseTo(snapshots[index].opacity * 0.5, 12);
      expect(material.transparent).toBe(snapshots[index].transparent);
      expect(material.depthWrite).toBe(snapshots[index].depthWrite);
    });
    expect(ghost.alphaHash).toBe(false);
    expect(transparentDepthWriter.alphaHash).toBe(true);
    expect(opaqueNoDepth.alphaHash).toBe(true);
    fade(root, 1);
    expect(materials.map(materialState)).toEqual(snapshots);
  });

  it("fades a newly mounted solid rotor at the body's current alpha after its ghost material is replaced", () => {
    const body = new THREE.MeshStandardMaterial();
    const ghost = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
    });
    const rotor = new THREE.Mesh(undefined, ghost);
    const root = new THREE.Group();
    root.add(new THREE.Mesh(undefined, body), rotor);
    const fade = createObjectFade();
    fade(root, 0.2);

    const solid = new THREE.MeshStandardMaterial();
    rotor.material = solid;
    fade(root, 0.63);
    expect(materialState(solid)).toEqual(materialState(body));
    expect(solid.opacity).toBeCloseTo(0.63, 12);
    expect(solid.transparent).toBe(false);
    expect(solid.depthWrite).toBe(true);
    fade(root, 1);
    expect(materialState(solid)).toEqual({
      opacity: 1,
      transparent: false,
      depthWrite: true,
      alphaHash: false,
    });
  });

  it("scales a shared material once per frame instead of compounding alpha per mesh", () => {
    const shared = new THREE.MeshStandardMaterial({ opacity: 0.8 });
    const root = new THREE.Group();
    root.add(
      new THREE.Mesh(undefined, shared),
      new THREE.Mesh(undefined, shared),
      new THREE.Mesh(undefined, [shared, shared]),
    );
    const fade = createObjectFade();
    fade(root, 0.5);
    expect(shared.opacity).toBeCloseTo(0.4, 12);
    fade(root, 0.5);
    expect(shared.opacity).toBeCloseTo(0.4, 12);
    fade(root, 0.25);
    expect(shared.opacity).toBeCloseTo(0.2, 12);
    fade(root, 1);
    expect(shared.opacity).toBe(0.8);
  });

  it("suppresses clicks while hidden and restores the exact raycast methods when the machine returns", () => {
    let calls = 0;
    const nested = new THREE.Group();
    const mesh = new THREE.Mesh();
    const customRaycast: THREE.Object3D["raycast"] = () => {
      calls++;
    };
    mesh.raycast = customRaycast;
    nested.add(mesh);
    const root = new THREE.Group();
    root.add(nested);
    const rootRaycast = root.raycast;
    const nestedRaycast = nested.raycast;
    const fade = createObjectFade();

    fade(root, 0, false);
    expect(root.visible).toBe(false);
    mesh.raycast(new THREE.Raycaster(), []);
    expect(calls).toBe(0);
    fade(root, 0.6, false);
    expect(root.visible).toBe(true);
    mesh.raycast(new THREE.Raycaster(), []);
    expect(calls).toBe(0);

    fade(root, 1, true);
    expect(root.visible).toBe(true);
    expect(root.raycast).toBe(rootRaycast);
    expect(nested.raycast).toBe(nestedRaycast);
    expect(mesh.raycast).toBe(customRaycast);
    mesh.raycast(new THREE.Raycaster(), []);
    expect(calls).toBe(1);
  });

  it("leaves no opacity, depth, alphaHash or interaction residue over repeated inspections", () => {
    const material = new THREE.MeshStandardMaterial();
    const root = new THREE.Mesh(undefined, material);
    const raycast = root.raycast;
    const fade = createObjectFade();

    for (const baseOpacity of [1, 0.8, 0.65, 1]) {
      // A completed fade must release its snapshot so normal application
      // changes between inspections become the next cycle's native state.
      material.opacity = baseOpacity;
      const original = materialState(material);
      fade(root, 0.7, false);
      fade(root, 0.1, false);
      fade(root, 0, false);
      fade(root, 0.4, true);
      expect(material.opacity).toBeCloseTo(baseOpacity * 0.4, 12);
      fade(root, 1, true);
      expect(materialState(material)).toEqual(original);
      expect(root.visible).toBe(true);
      expect(root.raycast).toBe(raycast);
    }
  });
});
