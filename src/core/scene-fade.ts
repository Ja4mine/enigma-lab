import * as THREE from "three";

type FadeMaterial = THREE.Material;
type MaterialState = {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  alphaHash: boolean;
};

/**
 * Fade opaque assemblies with depth-tested sample coverage, not alpha blending.
 * Blending nested cylinders without depth writes makes rear faces and the deck
 * paint over the rotor until the last frame. Alpha hashing keeps those parts in
 * the opaque render pass, so the whole assembly restores together. Materials
 * that intentionally reveal wiring retain their native transparent behavior.
 */
export function createObjectFade() {
  const originals = new WeakMap<FadeMaterial, MaterialState>();
  const raycasts = new WeakMap<THREE.Object3D, THREE.Object3D["raycast"]>();
  const skipRaycast: THREE.Object3D["raycast"] = () => {};

  return (object: THREE.Object3D, amount: number, interactive = true) => {
    const alpha = THREE.MathUtils.clamp(amount, 0, 1);
    object.visible = alpha > 0.001;
    const visited = new Set<FadeMaterial>();
    object.traverse((child) => {
      if (!interactive || !object.visible) {
        if (!raycasts.has(child)) raycasts.set(child, child.raycast);
        child.raycast = skipRaycast;
      } else {
        const raycast = raycasts.get(child);
        if (raycast) {
          child.raycast = raycast;
          raycasts.delete(child);
        }
      }
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials as FadeMaterial[]) {
        if (visited.has(material)) continue;
        visited.add(material);
        let original = originals.get(material);
        if (alpha >= 0.999) {
          // Relinquish ownership at the endpoint; React may subsequently change
          // wiring highlights and casing opacity without a fade fighting it.
          if (original) {
            const recompile =
              material.transparent !== original.transparent ||
              material.alphaHash !== original.alphaHash;
            Object.assign(material, original);
            if (recompile) material.needsUpdate = true;
            originals.delete(material);
          }
          continue;
        }
        if (!original) {
          original = {
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
            alphaHash: material.alphaHash,
          };
          originals.set(material, original);
        }
        const alphaHash = original.transparent ? original.alphaHash : true;
        const recompile =
          material.transparent !== original.transparent ||
          material.alphaHash !== alphaHash;
        material.transparent = original.transparent;
        material.depthWrite = original.depthWrite;
        material.alphaHash = alphaHash;
        material.opacity = original.opacity * alpha;
        if (recompile) material.needsUpdate = true;
      }
    });
  };
}
