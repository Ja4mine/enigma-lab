import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Exhibit } from "./Exhibit";
import { applyTheme, type Theme } from "./materials";
import { easeInOut, prefersReducedMotion, type Animation } from "./tween";

export interface Projected {
  x: number;
  y: number;
  /** In front of the camera and inside the viewport. */
  visible: boolean;
}

/**
 * One WebGL canvas shared by every machine. Renders on demand: only when the
 * camera moves, an animation runs, or something calls `invalidate()`.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  readonly controls: OrbitControls;
  exhibit: Exhibit | null = null;
  onHover: (part: string | null) => void = () => {};
  onPick: (part: string | null, event: PointerEvent) => void = () => {};
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver;
  private dirty = true;
  private shadowsDirty = true;
  private animations: Animation[] = [];
  private frameListeners = new Set<(dt: number) => void>();
  private renderListeners = new Set<() => void>();
  private raycaster = new THREE.Raycaster();
  private ground: THREE.Mesh;
  private key: THREE.DirectionalLight;
  private last = performance.now();
  private raf = 0;
  private down: { x: number; y: number; t: number } | null = null;
  private hoverFrame = 0;
  private userMoved = false;
  width = 1;
  height = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Shadows only change when parts move, not when the camera orbits.
    this.renderer.shadowMap.autoUpdate = false;
    const canvas = this.renderer.domElement;
    canvas.className = "stage-canvas";
    canvas.setAttribute("aria-hidden", "true");

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#b8b2a6", 0.55));
    this.key = new THREE.DirectionalLight("#fff6ea", 1.7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 4;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight("#e6eef5", 0.45);
    fill.position.set(60, 40, -30);
    this.scene.add(fill);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.13, color: "#2a2014" }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.pickable = false;
    this.scene.add(this.ground);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.9;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.addEventListener("start", () => {
      this.userMoved = true;
      this.cancelCameraFlight();
    });
    this.controls.addEventListener("change", () => this.invalidate());

    canvas.addEventListener("pointerdown", (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener("pointerup", (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      this.onPick(this.pickPart(e.clientX, e.clientY), e);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      cancelAnimationFrame(this.hoverFrame);
      this.hoverFrame = requestAnimationFrame(() => {
        const part = this.pickPart(e.clientX, e.clientY);
        canvas.style.cursor = part ? "pointer" : "";
        this.onHover(part);
      });
    });
    canvas.addEventListener("pointerleave", () => {
      canvas.style.cursor = "";
      this.onHover(null);
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  mount(host: HTMLElement) {
    if (this.host === host) return;
    if (this.host) this.resizeObserver.unobserve(this.host);
    this.host = host;
    host.prepend(this.renderer.domElement);
    this.resizeObserver.observe(host);
    this.resize();
  }

  resize() {
    if (!this.host) return;
    const w = Math.max(1, this.host.clientWidth),
      h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  setTheme(theme: Theme) {
    applyTheme(theme);
    (this.ground.material as THREE.ShadowMaterial).opacity = theme === "dark" ? 0.4 : 0.13;
    this.renderer.toneMappingExposure = theme === "dark" ? 1.15 : 1.05;
    this.invalidate();
  }

  setExhibit(exhibit: Exhibit | null) {
    if (this.exhibit === exhibit) return;
    if (this.exhibit) this.scene.remove(this.exhibit.root);
    this.exhibit = exhibit;
    if (!exhibit) return this.invalidate();
    this.scene.add(exhibit.root);
    this.shadowsDirty = true;
    exhibit.onChange = () => this.invalidate(true);
    const s = exhibit.size;
    this.ground.scale.set(s * 6, s * 6, 1);
    const cam = this.key.shadow.camera;
    cam.left = cam.bottom = -s * 0.75;
    cam.right = cam.top = s * 0.75;
    cam.near = 1;
    cam.far = s * 4;
    cam.updateProjectionMatrix();
    this.key.position.set(-s * 0.35, s * 1.6, s * 0.55);
    this.key.target.position.set(0, 0, 0);
    this.camera.near = Math.max(0.5, s / 400);
    this.camera.far = s * 20;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = s * 0.12;
    this.controls.maxDistance = s * 4;
    this.invalidate();
  }

  /** Request a frame; pass `true` when geometry moved so shadows refresh. */
  invalidate(shadows = false) {
    this.dirty = true;
    if (shadows) this.shadowsDirty = true;
  }

  onFrame(cb: (dt: number) => void) {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  /** Called after every rendered frame (callout layers reproject here). */
  onRender(cb: () => void) {
    this.renderListeners.add(cb);
    return () => this.renderListeners.delete(cb);
  }

  animate(anim: Omit<Animation, "elapsed">): () => void {
    const entry: Animation = { ...anim, elapsed: 0 };
    if (prefersReducedMotion()) entry.duration = Math.min(entry.duration, 0.12);
    this.animations.push(entry);
    this.invalidate();
    return () => {
      this.animations = this.animations.filter((a) => a !== entry);
    };
  }

  private flight: (() => void) | null = null;
  cancelCameraFlight() {
    this.flight?.();
    this.flight = null;
  }

  flyTo(target: THREE.Vector3, position: THREE.Vector3, duration = 0.9) {
    this.cancelCameraFlight();
    const fromT = this.controls.target.clone(),
      fromP = this.camera.position.clone();
    this.flight = this.animate({
      duration,
      update: (t) => {
        const e = easeInOut(t);
        this.controls.target.lerpVectors(fromT, target, e);
        this.camera.position.lerpVectors(fromP, position, e);
      },
      done: () => (this.flight = null),
    });
  }

  /** Frame a box from a direction; `fill` < 1 leaves room around it. */
  frame(box: THREE.Box3, dir?: THREE.Vector3, opts: { fill?: number; duration?: number; offset?: THREE.Vector2 } = {}) {
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const direction = (dir?.clone() ?? this.camera.position.clone().sub(this.controls.target)).normalize();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fov = Math.min(vFov, hFov);
    const fill = opts.fill ?? 0.82;
    const distance = sphere.radius / Math.sin(fov / 2) / fill;
    const target = sphere.center.clone();
    if (opts.offset) {
      // Shift the framed object within the view (fractions of view size).
      const right = new THREE.Vector3().crossVectors(direction, this.camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, direction).normalize();
      const halfH = Math.tan(vFov / 2) * distance;
      target.addScaledVector(right, opts.offset.x * halfH * this.camera.aspect);
      target.addScaledVector(up, opts.offset.y * halfH);
    }
    this.flyTo(target, target.clone().addScaledVector(direction, distance), opts.duration ?? 0.9);
    this.userMoved = false;
  }

  get hasUserMoved() {
    return this.userMoved;
  }

  project(world: THREE.Vector3): Projected {
    const v = world.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      visible: v.z < 1 && v.z > -1,
    };
  }

  pickPart(clientX: number, clientY: number): string | null {
    if (!this.exhibit) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.exhibit.pickables, false);
    // Prefer solid parts; ghosted context is only picked if nothing else is hit.
    let fallback: string | null = null;
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const id = this.exhibit.partOf(hit.object);
      if (!id) continue;
      if (!this.exhibit.isGhost(id)) return id;
      fallback ??= id;
    }
    return fallback;
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (const cb of this.frameListeners) cb(dt);
    if (this.animations.length) {
      for (const anim of [...this.animations]) {
        anim.elapsed += dt;
        const t = anim.duration > 0 ? Math.min(1, anim.elapsed / anim.duration) : 1;
        anim.update(t);
        if (t >= 1) {
          this.animations = this.animations.filter((a) => a !== anim);
          anim.done?.();
        }
      }
      this.dirty = true;
    }
    if (this.controls.update(dt)) this.dirty = true;
    if (!this.dirty || !this.host) return;
    this.dirty = false;
    if (this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
    for (const cb of this.renderListeners) cb();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
