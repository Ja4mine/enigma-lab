import * as THREE from "three";
import type { ScreenRect } from "./stage-framing";

/** Reuse scratch storage and geometry bounds across wheel events. Project
 * individual mesh bounds so empty corners of a large world box cannot make
 * the pane disappear while the actual model is still comfortably clear. */
export function createSubjectProjector() {
  const point = new THREE.Vector3();
  const clip = new THREE.Vector3();
  return (
    subject: THREE.Object3D,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): ScreenRect | null => {
    const rect: ScreenRect = {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    };
    subject.updateWorldMatrix(true, true);
    camera.updateMatrixWorld();
    subject.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.excludeFromFraming)
        return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      if (
        materials.every(
          (m) =>
            !m.visible ||
            m.opacity <= 0.01 ||
            m instanceof THREE.ShadowMaterial,
        )
      )
        return;
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (!bounds || bounds.isEmpty()) return;
      for (let corner = 0; corner < 8; corner++) {
        point
          .set(
            corner & 1 ? bounds.max.x : bounds.min.x,
            corner & 2 ? bounds.max.y : bounds.min.y,
            corner & 4 ? bounds.max.z : bounds.min.z,
          )
          .applyMatrix4(object.matrixWorld);
        clip.copy(point).applyMatrix4(camera.matrixWorldInverse);
        // Objects behind the eye do not contribute to a visible silhouette.
        if (clip.z >= -0.001) continue;
        point.project(camera);
        const x = ((point.x + 1) * width) / 2;
        const y = ((1 - point.y) * height) / 2;
        rect.left = Math.min(rect.left, x);
        rect.right = Math.max(rect.right, x);
        rect.top = Math.min(rect.top, y);
        rect.bottom = Math.max(rect.bottom, y);
      }
    });
    return Number.isFinite(rect.left) ? rect : null;
  };
}
