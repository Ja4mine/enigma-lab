import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { Canvas, invalidate as requestFrame, useFrame, useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, ContactShadows, Environment } from "@react-three/drei";
import { EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import studioHdri from "@pmndrs/assets/hdri/studio.exr.js";
import type CameraControlsImpl from "camera-controls";
import { animate, cancelFrame, frame as motionFrame } from "motion";
import type { Exhibit } from "./Exhibit";
import { applyTheme, type Theme } from "./materials";
import { prefersReducedMotion } from "./tween";

export interface Projected {
  x: number;
  y: number;
  /** In front of the camera and inside the viewport. */
  visible: boolean;
}

/** Shadow map side in texels; the frustum is fitted to each exhibit. */
const SHADOW_MAP = 4096;

/**
 * Imperative handle on the one shared canvas, so machine code can stay outside
 * React. Rendering, cameras, picking and the environment live in `StageCanvas`
 * (react-three-fiber + drei); frames are requested on demand.
 */
export class Stage {
  /** Stable element that hosts the canvas and moves between workbenches. */
  readonly element = document.createElement("div");
  exhibit: Exhibit | null = null;
  onHover: (part: string | null) => void = () => {};
  onPick: (part: string | null, event: Event) => void = () => {};
  /** Set once the canvas exists. */
  three!: RootState;
  controls: CameraControlsImpl | null = null;
  /** Frames still owed a shadow refresh; more than one survives passes that consume the flag. */
  shadowsDirty = 3;
  theme: Theme = "light";
  readonly renderListeners = new Set<() => void>();
  private userMoved = false;
  private hoverListeners = new Set<(part: string | null, x: number, y: number) => void>();
  pendingFrame: (() => void) | null = null;
  private exhibitListeners = new Set<() => void>();

  constructor() {
    // Parked full-size until a workbench adopts it, so the canvas can measure itself.
    this.element.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none";
    document.body.append(this.element);
  }

  get scene() {
    return this.three.scene;
  }
  get camera() {
    return this.three.camera as THREE.PerspectiveCamera;
  }
  get width() {
    return Math.max(1, this.element.clientWidth);
  }
  get height() {
    return Math.max(1, this.element.clientHeight);
  }
  get hasUserMoved() {
    return this.userMoved;
  }

  mount(host: HTMLElement) {
    this.element.removeAttribute("style");
    this.element.className = "stage-canvas";
    host.prepend(this.element);
    this.invalidate();
  }

  subscribeExhibit = (cb: () => void) => {
    this.exhibitListeners.add(cb);
    return () => void this.exhibitListeners.delete(cb);
  };

  setExhibit(exhibit: Exhibit | null) {
    if (this.exhibit === exhibit) return;
    this.exhibit = exhibit;
    if (exhibit) exhibit.onChange = () => this.invalidate(true);
    this.exhibitListeners.forEach((cb) => cb());
    this.invalidate(true);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    applyTheme(theme);
    this.exhibitListeners.forEach((cb) => cb());
    this.invalidate();
  }

  /** Request a frame; pass `true` when geometry moved so shadows refresh. */
  invalidate(shadows = false) {
    if (shadows) this.shadowsDirty = 3;
    requestFrame();
  }

  /** Runs every animation frame, whether or not the canvas redraws. */
  onFrame(cb: (dt: number) => void) {
    const step = ({ delta }: { delta: number }) => cb(Math.min(0.1, delta / 1000));
    motionFrame.update(step, true);
    return () => cancelFrame(step);
  }

  /** Pointer position over a part, in stage pixels. */
  onPointerHover(cb: (part: string | null, x: number, y: number) => void) {
    this.hoverListeners.add(cb);
    return () => void this.hoverListeners.delete(cb);
  }
  notifyHover(part: string | null, x: number, y: number) {
    for (const cb of this.hoverListeners) cb(part, x, y);
  }

  /** Width covered by the floating panel; the view is centred in what remains. */
  get coveredRight() {
    return parseFloat(getComputedStyle(this.element).getPropertyValue("--stage-right")) || 0;
  }

  /** Called after each drawn frame (callout layers reproject here). */
  onRender(cb: () => void) {
    this.renderListeners.add(cb);
    return () => void this.renderListeners.delete(cb);
  }

  /** Linear 0…1 tween; returns a cancel function. */
  animate(anim: { duration: number; update: (t: number) => void; done?: () => void }): () => void {
    const duration = prefersReducedMotion() ? Math.min(anim.duration, 0.12) : anim.duration;
    const controls = animate(0, 1, {
      duration,
      ease: "linear",
      onUpdate: (t) => {
        anim.update(t);
        this.invalidate();
      },
      onComplete: () => anim.done?.(),
    });
    return () => controls.stop();
  }

  /** Frame a box from a direction; `fill` < 1 leaves room around it. */
  frame(box: THREE.Box3, dir?: THREE.Vector3, opts: { fill?: number; duration?: number; offset?: THREE.Vector2 } = {}) {
    const controls = this.controls;
    if (box.isEmpty()) return;
    if (!controls) {
      // The rig mounts a moment after the workbench; apply this once it exists.
      this.pendingFrame = () => this.frame(box, dir, { ...opts, duration: 0 });
      return;
    }
    const camera = this.camera;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const current = controls.getTarget(new THREE.Vector3());
    const direction = (dir?.clone() ?? camera.position.clone().sub(current)).normalize();
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = (this.width - this.coveredRight) / this.height; // the camera may not have seen a resize yet
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fov = Math.min(vFov, hFov);
    const distance = sphere.radius / Math.sin(fov / 2) / (opts.fill ?? 0.82);
    const target = sphere.center.clone();
    if (opts.offset) {
      // Shift the framed object within the view (fractions of view size).
      const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, direction).normalize();
      const halfH = Math.tan(vFov / 2) * distance;
      target.addScaledVector(right, opts.offset.x * halfH * aspect);
      target.addScaledVector(up, opts.offset.y * halfH);
    }
    const eye = target.clone().addScaledVector(direction, distance);
    void controls.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, opts.duration !== 0 && !prefersReducedMotion());
    this.userMoved = false;
    this.invalidate();
  }

  noteUserMoved() {
    this.userMoved = true;
  }

  project(world: THREE.Vector3): Projected {
    const v = world.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      visible: v.z < 1 && v.z > -1,
    };
  }

  /** First solid part among pointer hits; ghosted context only as a fallback. */
  pick(hits: { object: THREE.Object3D }[]): string | null {
    const exhibit = this.exhibit;
    if (!exhibit) return null;
    let fallback: string | null = null;
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const id = exhibit.partOf(hit.object);
      if (!id) continue;
      if (!exhibit.isGhost(id)) return id;
      fallback ??= id;
    }
    return fallback;
  }
}

/** Backdrop colours match the paper of the interface, like a photographer's sweep. */
const BACKDROP = { light: "#ded3bf", dark: "#241c13" } as const;

function Rig({ stage }: { stage: Stage }) {
  const exhibit = useSyncExternalStore(stage.subscribeExhibit, () => stage.exhibit);
  const theme = useSyncExternalStore(stage.subscribeExhibit, () => stage.theme);
  const gl = useThree((s) => s.gl);
  const controls = useRef<CameraControlsImpl>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const size = exhibit?.size ?? 100;
  const reach = size * 0.62;
  // World size of one shadow texel. Biases must follow it: a fixed offset leaves
  // large models covered in acne on faces that run nearly parallel to the light.
  const texel = (2 * reach) / SHADOW_MAP;
  const dark = theme === "dark";

  useEffect(() => {
    stage.controls = controls.current;
    gl.shadowMap.autoUpdate = false;
    stage.pendingFrame?.();
    stage.pendingFrame = null;
    const onStart = () => stage.noteUserMoved();
    const c = controls.current;
    c?.addEventListener("controlstart", onStart);
    return () => c?.removeEventListener("controlstart", onStart);
  }, [stage, gl]);

  useEffect(() => {
    if (!controls.current) return;
    controls.current.minDistance = size * 0.1;
    controls.current.maxDistance = size * 4;
  }, [gl, dark, size]);

  useEffect(() => {
    const light = key.current;
    if (!light) return;
    light.position.set(-size * 0.55, size * 1.25, size * 0.8);
    const cam = light.shadow.camera;
    cam.left = cam.bottom = -reach;
    cam.right = cam.top = reach;
    cam.near = size * 0.2;
    cam.far = size * 3.4;
    cam.updateProjectionMatrix();
    light.shadow.normalBias = texel * 3;
    light.shadow.bias = -0.00025;
    stage.invalidate(true);
  }, [stage, size, reach, texel]);

  useFrame((state) => {
    // Keep the depth range tight around what is on screen, wherever the user zooms.
    const camera = state.camera as THREE.PerspectiveCamera;
    const distance = controls.current?.distance ?? size;
    const near = Math.max(distance * 0.03, size * 0.002);
    const far = distance + size * 3;
    if (camera.near !== near || camera.far !== far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    if (stage.shadowsDirty > 0) {
      gl.shadowMap.needsUpdate = true;
      stage.shadowsDirty--;
      requestFrame();
    }
    // Keep the subject centred in the part of the stage the panel leaves free.
    const w = stage.width,
      h = stage.height,
      shift = stage.coveredRight / 2;
    if (camera.view?.offsetX !== shift || camera.view?.fullWidth !== w || camera.view?.fullHeight !== h) {
      camera.setViewOffset(w, h, shift, 0, w, h);
    }
    camera.updateMatrixWorld();
    for (const cb of stage.renderListeners) cb();
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return;
    e.stopPropagation();
    stage.onPick(stage.pick(e.intersections), e.nativeEvent);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    e.stopPropagation();
    const part = stage.pick(e.intersections);
    gl.domElement.style.cursor = part ? "pointer" : "";
    stage.onHover(part);
    stage.notifyHover(part, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    if (e.intersections.length) return;
    gl.domElement.style.cursor = "";
    stage.onHover(null);
    stage.notifyHover(null, 0, 0);
  };

  return (
    <>
      <CameraControls
        ref={controls}
        makeDefault
        smoothTime={0.32}
        draggingSmoothTime={0.08}
        azimuthRotateSpeed={0.7}
        polarRotateSpeed={0.7}
        dollySpeed={0.9}
        maxPolarAngle={Math.PI * 0.62}
      />
      <color attach="background" args={[BACKDROP[theme]]} />
      <Suspense fallback={null}>
        <Environment files={studioHdri} environmentIntensity={dark ? 0.8 : 1.05} environmentRotation={[0, 1.1, 0]} />
      </Suspense>
      <hemisphereLight args={["#fff0d8", "#8d785c", dark ? 0.35 : 0.5]} />
      <directionalLight
        ref={key}
        color="#ffe8c8"
        intensity={dark ? 1.3 : 1.55}
        castShadow
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-radius={5}
      />
      <directionalLight color="#e9e4da" intensity={0.8} position={[size * 0.6, size * 0.3, -size * 0.4]} />
      <directionalLight color="#fff0dc" intensity={dark ? 0.45 : 0.7} position={[size * 0.15, size * 0.22, size]} />
      <mesh rotation-x={-Math.PI / 2} scale={[size * 8, size * 8, 1]} receiveShadow>
        <planeGeometry />
        <shadowMaterial color="#2b1c0c" opacity={dark ? 0.4 : 0.16} />
      </mesh>
      <ContactShadows position={[0, 0.02, 0]} scale={size * 1.7} far={size * 0.12} blur={2.6} opacity={dark ? 0.7 : 0.42} resolution={1024} color="#2b1c0c" />
      {exhibit && (
        <primitive
          key={exhibit.root.uuid}
          object={exhibit.root}
          dispose={null}
          onClick={onClick}
          onPointerMove={onMove}
          onPointerOut={onOut}
        />
      )}
      <EffectComposer multisampling={4}>
        <N8AO halfRes aoRadius={size * 0.018} distanceFalloff={0.5} intensity={1.5} quality="medium" color="#1c120a" />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.32} darkness={dark ? 0.5 : 0.32} />
      </EffectComposer>
    </>
  );
}

export function StageCanvas({ stage, onReady }: { stage: Stage; onReady: () => void }) {
  const [created, setCreated] = useState(false);
  return (
    <Canvas
      frameloop="demand"
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: false }}
      camera={{ fov: 26, position: [60, 50, 90], near: 1, far: 5000 }}
      resize={{ scroll: false }}
      onCreated={(state) => {
        stage.three = state;
        setCreated(true);
        onReady();
      }}
      onPointerMissed={(e) => stage.onPick(null, e)}
    >
      {created && <Rig stage={stage} />}
    </Canvas>
  );
}
