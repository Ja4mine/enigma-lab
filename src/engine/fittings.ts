import * as THREE from "three";
import { boxGeo, cylY, group, instanced } from "./shapes";

/** Small physical fittings, batched so close inspection does not cost a draw call per screw. */
export function fasteners(
  parent: THREE.Object3D,
  points: [number, number, number][],
  metal: THREE.Material,
  recess: THREE.Material,
  radius = 0.2,
  normal: [number, number, number] = [0, 1, 0],
) {
  const fitting = group("slotted-fasteners");
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(...normal),
  );
  const offset = new THREE.Vector3(...normal);
  const place = (height: number) => (i: number, dummy: THREE.Object3D) => {
    dummy.position.set(...points[i]).addScaledVector(offset, height);
    dummy.quaternion.copy(rotation);
    // The slots are deliberately set at different, deterministic angles.
    dummy.rotateY(i * 1.73 + 0.35);
  };
  fitting.add(
    instanced(
      cylY(radius * 1.26, radius * 0.16, 24),
      metal,
      points.length,
      place(radius * 0.08),
    ),
  );
  fitting.add(
    instanced(
      cylY(radius, radius * 0.38, 24),
      metal,
      points.length,
      place(radius * 0.35),
    ),
  );
  fitting.add(
    instanced(
      boxGeo(radius * 1.5, radius * 0.025, radius * 0.18),
      recess,
      points.length,
      place(radius * 0.546),
    ),
  );
  parent.add(fitting);
  return fitting;
}

/** Thin rolled seams and retaining rings, their hollow centre leaves the host visible. */
export function seamRings(
  parent: THREE.Object3D,
  points: [number, number, number][],
  radius: number,
  tube: number,
  material: THREE.Material,
  axis: "x" | "y" | "z" = "z",
) {
  const geometry = new THREE.TorusGeometry(radius, tube, 6, 64);
  if (axis === "x") geometry.rotateY(Math.PI / 2);
  if (axis === "y") geometry.rotateX(Math.PI / 2);
  const rings = instanced(geometry, material, points.length, (i, dummy) =>
    dummy.position.set(...points[i]),
  );
  parent.add(rings);
  return rings;
}
