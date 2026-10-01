import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createSubjectProjector } from "./projected-bounds";

function frontCamera() {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

describe("projected model footprint", () => {
  it("does not count empty corners between separate parts viewed along their diagonal", () => {
    const subject = new THREE.Group();
    for (const coordinate of [-3, 3]) {
      const part = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial(),
      );
      part.position.set(coordinate, 0, coordinate);
      subject.add(part);
    }
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(10, 0, 10);
    camera.lookAt(0, 0, 0);
    const bounds = createSubjectProjector()(subject, camera, 800, 800)!;
    // Both cubes share the same silhouette: a unit cube at 45 degrees is
    // sqrt(2) units wide. Their empty, seven-unit-wide aggregate box is not.
    expect(bounds.right - bounds.left).toBeCloseTo(80 * Math.sqrt(2));
    expect((bounds.left + bounds.right) / 2).toBeCloseTo(400);
    expect(bounds.bottom - bounds.top).toBeCloseTo(80);
  });

  it("ignores hidden components and shadow/helper surfaces while retaining actual mesh labels", () => {
    const subject = new THREE.Group();
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial(),
    );
    subject.add(label);
    const project = createSubjectProjector();
    const camera = frontCamera();
    const baseline = project(subject, camera, 800, 800);
    const largeGeometry = new THREE.PlaneGeometry(100, 100);
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(new THREE.Mesh(largeGeometry, new THREE.MeshBasicMaterial()));
    subject.add(hidden);
    subject.add(new THREE.Mesh(largeGeometry, new THREE.ShadowMaterial()));
    const helper = new THREE.Mesh(largeGeometry, new THREE.MeshBasicMaterial());
    helper.userData.excludeFromFraming = true;
    subject.add(helper);
    subject.add(
      new THREE.Mesh(
        largeGeometry,
        new THREE.MeshBasicMaterial({ visible: false }),
      ),
    );
    subject.add(
      new THREE.Mesh(
        largeGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      ),
    );

    expect(project(subject, camera, 800, 800)).toEqual(baseline);
    label.visible = false;
    expect(project(subject, camera, 800, 800)).toBeNull();
  });

  it("measures the latest camera and parent transforms before the next rendered frame", () => {
    const subject = new THREE.Group();
    subject.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial(),
      ),
    );
    const camera = frontCamera();
    const project = createSubjectProjector();
    const initial = project(subject, camera, 800, 800)!;
    expect(initial.left).toBeCloseTo(360);
    expect(initial.right).toBeCloseTo(440);

    // Simulate OrbitControls and an assembly movement changing transforms
    // immediately before the wheel-event measurement, without a render.
    camera.position.z = 20;
    subject.position.x = 2;
    const moved = project(subject, camera, 800, 800)!;
    expect(moved.left).toBeCloseTo(420);
    expect(moved.right).toBeCloseTo(460);
    expect(moved.top).toBeCloseTo(380);
    expect(moved.bottom).toBeCloseTo(420);
  });
});
