import * as THREE from "three";
import { overlay } from "../../engine/materials";

/**
 * Glowing current path through the rotor set. Each direction is drawn twice:
 * once depth-tested, once faintly through solid parts, so the wire stays
 * readable inside a rotor without pretending it is on the surface.
 */
export class SignalOverlay {
  readonly group = new THREE.Group();
  private parts: { solid: THREE.Mesh; ghost: THREE.Mesh; segments: number }[] = [];
  private heads: THREE.Mesh[] = [];
  private ghostMats: THREE.MeshBasicMaterial[] = [];
  private links: THREE.Line[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = "signal";
    this.group.renderOrder = 10;
    scene.add(this.group);
    for (const base of [overlay.forward, overlay.back]) {
      const ghost = base.clone();
      ghost.transparent = true;
      ghost.opacity = 0.32;
      ghost.depthTest = false;
      ghost.depthWrite = false;
      this.ghostMats.push(ghost);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), base);
      head.visible = false;
      this.heads.push(head);
      this.group.add(head);
    }
  }

  clear() {
    for (const l of this.links) {
      this.group.remove(l);
      l.geometry.dispose();
    }
    this.links = [];
    for (const p of this.parts) {
      this.group.remove(p.solid, p.ghost);
      p.solid.geometry.dispose();
    }
    this.parts = [];
    this.heads.forEach((h) => (h.visible = false));
  }

  show(
    paths: { forward: THREE.Vector3[][]; back: THREE.Vector3[][] },
    ends?: { key: THREE.Vector3; entry: THREE.Vector3; exit: THREE.Vector3; lamp: THREE.Vector3 },
  ) {
    this.clear();
    if (ends) {
      // Schematic leads: key → entry wheel and entry wheel → lamp (via the plugboard).
      const lead = (a: THREE.Vector3, b: THREE.Vector3, color: THREE.Color) => {
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 2.5, 0));
        const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(40);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineDashedMaterial({ color, dashSize: 0.45, gapSize: 0.3, toneMapped: false }),
        );
        line.computeLineDistances();
        line.visible = false;
        this.group.add(line);
        this.links.push(line);
      };
      lead(ends.key, ends.entry, overlay.forward.color);
      lead(ends.exit, ends.lamp, overlay.back.color);
    }
    // Keep the ghost colours in step with the theme.
    this.ghostMats[0].color.copy(overlay.forward.color);
    this.ghostMats[1].color.copy(overlay.back.color);
    [paths.forward, paths.back].forEach((segments, dir) => {
      const points: THREE.Vector3[] = [];
      for (const seg of segments)
        for (const p of seg) if (!points.length || points[points.length - 1].distanceTo(p) > 1e-3) points.push(p);
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 0; i + 1 < points.length; i++) curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
      const segmentsCount = Math.max(60, points.length * 6);
      const geometry = new THREE.TubeGeometry(curve, segmentsCount, 0.13, 6, false);
      const solid = new THREE.Mesh(geometry, dir === 0 ? overlay.forward : overlay.back);
      const ghost = new THREE.Mesh(geometry, this.ghostMats[dir]);
      ghost.renderOrder = 20;
      solid.userData.curve = curve;
      this.group.add(solid, ghost);
      this.parts.push({ solid, ghost, segments: segmentsCount });
    });
    this.setProgress(0);
  }

  /** 0…1 forward half, 1…2 return half. */
  setProgress(t: number) {
    if (this.links[0]) this.links[0].visible = t > 0;
    if (this.links[1]) this.links[1].visible = t >= 1.98;
    this.parts.forEach((part, dir) => {
      const local = Math.max(0, Math.min(1, t - dir));
      const count = Math.floor(local * part.segments) * 6 * 6;
      part.solid.geometry.setDrawRange(0, count);
      part.solid.visible = part.ghost.visible = local > 0;
      const head = this.heads[dir];
      head.visible = local > 0 && local < 1;
      if (head.visible) head.position.copy((part.solid.userData.curve as THREE.CurvePath<THREE.Vector3>).getPointAt(local));
    });
  }
}
