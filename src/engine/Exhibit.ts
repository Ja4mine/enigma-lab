import * as THREE from "three";
import type { Text } from "../i18n";
import { layerMaterial, overlay } from "./materials";
import { clamp01, easeInOut } from "./tween";

export interface FeatureMeta {
  id: string;
  label: Text;
  note?: Text;
}

/** Catalogue entry for one inspectable part (a node in the assembly tree). */
export interface PartMeta {
  id: string;
  parent?: string;
  /** Drawing / inventory number shown in the title block. */
  number: string;
  name: Text;
  /** Original German designation where one exists. */
  german?: string;
  summary: Text;
  /** What the part contributes to enciphering or codebreaking. */
  role?: Text;
  material?: Text;
  specs?: { k: Text; v: Text }[];
  /** Numbered callouts drawn on the model when the part is in focus. */
  features?: FeatureMeta[];
  /** Preferred viewing direction when focused (world space). */
  view?: [number, number, number];
}

export interface Move {
  part: string;
  /** Translation in the parent's frame, applied over the step. */
  offset?: [number, number, number];
  /** Euler delta (radians, XYZ) about the part's own origin (its hinge). */
  rotate?: [number, number, number];
}

/** One operation of the disassembly procedure. */
export interface Step {
  id: string;
  title: Text;
  caption: Text;
  moves: Move[];
  /** Parts shown as x-ray from this step on (e.g. a rotor body hiding wires). */
  xray?: string[];
  /** Parts lifted away and then hidden once the step completes. */
  hide?: string[];
  /** Camera suggestion: look along `dir` at `focus` (part id). */
  view?: { dir: [number, number, number]; focus?: string; fill?: number };
  /** Callouts shown while nothing is selected: [part id, feature id]. */
  callouts?: [string, string][];
}

interface Runtime {
  meta: PartMeta;
  object: THREE.Object3D;
  basePos: THREE.Vector3;
  baseQuat: THREE.Quaternion;
  meshes: THREE.Mesh[];
  lines: THREE.LineSegments[];
  children: string[];
}

const edgeCache = new Map<string, THREE.EdgesGeometry>();
const IDENTITY = new THREE.Quaternion();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/**
 * An assembly of parts that can be taken apart step by step, isolated and
 * annotated. The model builder supplies objects, metadata and steps; the
 * exhibit owns posing, ghosting and picking.
 */
export class Exhibit {
  readonly root: THREE.Group;
  readonly steps: Step[];
  readonly parts = new Map<string, Runtime>();
  readonly anchors = new Map<string, Map<string, THREE.Object3D>>();
  readonly pickables: THREE.Object3D[] = [];
  /** Uniform scale hint for camera distances (≈ size of the whole model). */
  readonly size: number;
  progress = 0;
  private focusId: string | null = null;
  private hoverId: string | null = null;
  private forcedXray = new Set<string>();
  private overlayMoves: Move[] = [];
  private overlayAmount = 0;
  private suppressed = new Set<string>();
  onChange: () => void = () => {};

  constructor(opts: {
    root: THREE.Group;
    parts: { meta: PartMeta; object: THREE.Object3D }[];
    steps: Step[];
    anchors?: Record<string, Record<string, THREE.Object3D>>;
  }) {
    this.root = opts.root;
    this.steps = opts.steps;
    const owner = new Map<THREE.Object3D, string>();
    for (const { meta, object } of opts.parts) {
      owner.set(object, meta.id);
      this.parts.set(meta.id, {
        meta,
        object,
        basePos: object.position.clone(),
        baseQuat: object.quaternion.clone(),
        meshes: [],
        lines: [],
        children: [],
      });
    }
    for (const part of this.parts.values()) {
      const parent = part.meta.parent;
      if (parent && this.parts.has(parent)) this.parts.get(parent)!.children.push(part.meta.id);
    }
    // Each mesh belongs to its nearest registered ancestor.
    this.root.updateMatrixWorld(true);
    this.root.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      let cursor: THREE.Object3D | null = mesh;
      while (cursor && !owner.has(cursor)) cursor = cursor.parent;
      if (!cursor) return;
      const id = owner.get(cursor)!;
      const part = this.parts.get(id)!;
      mesh.userData.part = id;
      mesh.userData.material = mesh.material;
      const flat = mesh.geometry.type === "CircleGeometry" || mesh.geometry.type === "PlaneGeometry";
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) layerMaterial(m, flat);
      part.meshes.push(mesh);
      if (mesh.userData.pickable !== false) this.pickables.push(mesh);
      else mesh.raycast = () => {};
      if (!(mesh as THREE.InstancedMesh).isInstancedMesh && !mesh.userData.noEdges) {
        const geo = mesh.geometry;
        const key = geo.uuid + ":" + (mesh.userData.edgeAngle ?? 28);
        if (!edgeCache.has(key)) edgeCache.set(key, new THREE.EdgesGeometry(geo, mesh.userData.edgeAngle ?? 28));
        const lines = new THREE.LineSegments(edgeCache.get(key)!, overlay.edge);
        lines.raycast = () => {};
        lines.userData.part = id;
        mesh.add(lines);
        part.lines.push(lines);
      }
    });
    for (const [part, map] of Object.entries(opts.anchors ?? {}))
      this.anchors.set(part, new Map(Object.entries(map)));
    const box = new THREE.Box3().setFromObject(this.root);
    this.size = box.getSize(new THREE.Vector3()).length();
    this.applyMaterials();
  }

  get focus() {
    return this.focusId;
  }

  meta(id: string) {
    return this.parts.get(id)?.meta;
  }

  /** Ancestors from the root down to `id` (for breadcrumbs). */
  lineage(id: string): PartMeta[] {
    const out: PartMeta[] = [];
    let cursor: string | undefined = id;
    while (cursor && this.parts.has(cursor)) {
      out.unshift(this.parts.get(cursor)!.meta);
      cursor = this.parts.get(cursor)!.meta.parent;
    }
    return out;
  }

  childrenOf(id: string) {
    return (this.parts.get(id)?.children ?? []).map((c) => this.parts.get(c)!.meta);
  }

  subtree(id: string): Set<string> {
    const out = new Set<string>([id]);
    const walk = (p: string) =>
      this.parts.get(p)?.children.forEach((c) => {
        out.add(c);
        walk(c);
      });
    walk(id);
    return out;
  }

  /** Continuous disassembly progress, 0 = assembled, steps.length = fully apart. */
  setProgress(p: number) {
    this.progress = Math.max(0, Math.min(this.steps.length, p));
    const offsets = new Map<string, THREE.Vector3>();
    const rotations = new Map<string, THREE.Quaternion>();
    const sources: { moves: Move[]; e: number }[] = this.steps.map((step, k) => ({
      moves: step.moves,
      e: easeInOut(clamp01(this.progress - k)),
    }));
    if (this.overlayAmount > 0) sources.push({ moves: this.overlayMoves, e: easeInOut(this.overlayAmount) });
    sources.forEach(({ moves, e }) => {
      if (e <= 0) return;
      for (const move of moves) {
        if (move.offset) {
          const v = offsets.get(move.part) ?? new THREE.Vector3();
          v.x += move.offset[0] * e;
          v.y += move.offset[1] * e;
          v.z += move.offset[2] * e;
          offsets.set(move.part, v);
        }
        if (move.rotate) {
          const q = rotations.get(move.part) ?? new THREE.Quaternion();
          tmpQ.setFromEuler(tmpE.set(move.rotate[0], move.rotate[1], move.rotate[2]));
          q.multiply(IDENTITY.clone().slerp(tmpQ, e));
          rotations.set(move.part, q);
        }
      }
    });
    for (const [id, part] of this.parts) {
      part.object.position.copy(part.basePos);
      const offset = offsets.get(id);
      if (offset) part.object.position.add(offset);
      part.object.quaternion.copy(part.baseQuat);
      const rotation = rotations.get(id);
      if (rotation) part.object.quaternion.multiply(rotation);
    }
    this.applyMaterials();
    this.onChange();
  }

  /** Register meshes created after construction (e.g. cables) under a part. */
  adopt(partId: string, meshes: THREE.Mesh[]) {
    const part = this.parts.get(partId);
    if (!part) return;
    part.meshes = part.meshes.filter((m) => m.parent);
    for (const m of meshes) {
      m.userData.part = partId;
      m.userData.material ??= m.material;
      part.meshes.push(m);
      if (m.userData.pickable !== false) this.pickables.push(m);
    }
    const alive = this.pickables.filter((m) => m.parent);
    this.pickables.splice(0, this.pickables.length, ...alive);
    this.applyMaterials();
  }

  /** Extra pose outside the procedure (e.g. an exploded circuit view), 0…1. */
  setOverlayPose(moves: Move[], amount: number) {
    this.overlayMoves = moves;
    this.overlayAmount = amount;
    this.setProgress(this.progress);
  }

  setFocus(id: string | null) {
    this.focusId = id && this.parts.has(id) ? id : null;
    this.applyMaterials();
    this.onChange();
  }

  setHover(id: string | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.applyMaterials();
    this.onChange();
  }

  /** Extra x-ray parts requested by the UI (e.g. "show wiring"). */
  setXray(ids: string[]) {
    this.forcedXray = new Set(ids);
    this.applyMaterials();
    this.onChange();
  }

  /** Parts temporarily hidden by the UI (not by a step). */
  setSuppressed(ids: string[]) {
    this.suppressed = new Set(ids);
    this.applyMaterials();
    this.onChange();
  }

  private stepXray(): { xray: Set<string>; hidden: Set<string>; fading: Set<string> } {
    const xray = new Set<string>(),
      hidden = new Set<string>(),
      fading = new Set<string>();
    this.steps.forEach((step, k) => {
      const local = this.progress - k;
      if (local > 0.35) for (const id of step.xray ?? []) for (const s of this.subtree(id)) xray.add(s);
      for (const id of step.hide ?? [])
        for (const s of this.subtree(id)) {
          if (local >= 0.999) hidden.add(s);
          else if (local > 0.05) fading.add(s);
        }
    });
    return { xray, hidden, fading };
  }

  applyMaterials() {
    const { xray, hidden, fading } = this.stepXray();
    const focusSet = this.focusId ? this.subtree(this.focusId) : null;
    const hoverSet = this.hoverId ? this.subtree(this.hoverId) : null;
    for (const [id, part] of this.parts) {
      const isHidden = hidden.has(id) || this.suppressed.has(id);
      const outside = focusSet !== null && !focusSet.has(id);
      const ghost = fading.has(id) || xray.has(id) || this.forcedXray.has(id) || outside;
      for (const mesh of part.meshes) {
        mesh.visible = !isHidden && mesh.userData.hidden !== true;
        const keep = mesh.userData.alwaysSolid === true && !(focusSet && !focusSet.has(id));
        mesh.material = outside ? overlay.faint : ghost && !keep ? overlay.ghost : mesh.userData.material;
        mesh.castShadow = !ghost && mesh.userData.shadow !== false;
        mesh.receiveShadow = !ghost && mesh.userData.receive !== false;
      }
      // Solid parts carry no outlines: ink lines are what make a render look drawn.
      for (const line of part.lines) {
        const hovered = !!hoverSet?.has(id) && !ghost;
        line.visible = !outside && (hovered || ghost);
        line.material = hovered ? overlay.edgeHover : overlay.edgeGhost;
      }
    }
  }

  /** Part id of a picked mesh; prefers the deepest visible, non-ghost hit. */
  partOf(object: THREE.Object3D | null): string | null {
    return (object?.userData.part as string | undefined) ?? null;
  }

  isGhost(id: string) {
    const { xray } = this.stepXray();
    const focusSet = this.focusId ? this.subtree(this.focusId) : null;
    return xray.has(id) || this.forcedXray.has(id) || (focusSet !== null && !focusSet.has(id));
  }

  bounds(id?: string | null): THREE.Box3 {
    const box = new THREE.Box3();
    const target = id ? this.parts.get(id)?.object : this.root;
    if (!target) return box.setFromObject(this.root);
    target.updateWorldMatrix(true, true);
    const add = (node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh && node.visible && !(node as THREE.Mesh).userData.noBounds) {
        const mesh = node as THREE.Mesh;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
      }
      node.children.forEach(add);
    };
    add(target);
    if (box.isEmpty()) box.setFromObject(target);
    return box;
  }

  featureAnchors(id: string): { feature: FeatureMeta; anchor: THREE.Object3D }[] {
    const meta = this.parts.get(id)?.meta;
    const map = this.anchors.get(id);
    if (!meta?.features || !map) return [];
    return meta.features.flatMap((feature) => {
      const anchor = map.get(feature.id);
      return anchor ? [{ feature, anchor }] : [];
    });
  }
}
