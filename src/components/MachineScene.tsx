import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VintageMaterial } from "./VintageMaterials";
import { SignalAnnotation as SignalLabel } from "./SignalAnnotation";
import { keyPoint, ROTOR_NUMBER_RING } from "../core/housing-layout";
import { RotorBearing, RotorThumbwheel } from "./RotorMounting";
import { HistoricalHousing } from "./HistoricalHousing";
import { LampboardInstrument, KeyboardGuidePanel } from "./InstrumentPanels";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ROTORS, REFLECTORS } from "../core/enigma";
import {
  stageFraming,
  stagePaneBounds,
  rectangleClearance,
  createUserZoomTracker,
} from "../core/stage-framing";
import { createSubjectProjector } from "../core/projected-bounds";
import type { ComponentInspection } from "../core/inspection";
import ComponentInspectionScene, {
  INSPECTION_CENTER,
  useObjectFade,
} from "./ComponentInspectionScene";
import type {
  RotorId,
  ReflectorId,
  KeyResult,
  MachineConfig,
  SignalStage,
} from "../core/enigma";
import {
  contactPoint,
  rotorWirePoints,
  reflectorWirePoints,
  pathPointsForStage,
  rotateXPoint,
} from "../core/visual-paths";
import type { Point3 } from "../core/visual-paths";

export type PartId =
  "machine" | "rotors" | "reflector" | "plugboard" | "keyboard" | "lampboard";

export interface MachineSceneProps {
  presentation?: "full-stage" | "embedded";
  paneCollapsed?: boolean;
  onUserZoom?: (zoomedIn: boolean) => void;
  selected: PartId;
  exploded: boolean;
  rotorCoverRemoved?: boolean;
  lampCoverRemoved?: boolean;
  positions: [number, number, number];
  rings: [number, number, number];
  rotorIds: [string, string, string];
  input: string | null;
  output: string | null;
  phase: number;
  onSelect: (part: PartId, rotorIndex?: 0 | 1 | 2) => void;
  resetView: number;
  plugboard?: string;
  previousPositions?: [number, number, number];
  reflectorId?: string;
  trace?: KeyResult | null;
  inspection?: boolean;
  playing?: boolean;
  stageProgress?: number;
  stageProgressRef?: { current: number };
  transition?: { from: number; to: number } | null;
  transitionProgressRef?: { current: number };
  followSignal?: boolean;
  language?: "zh" | "en";
  detail?: ComponentInspection | null;
  onDetailPart?: (id: string) => void;
  previewFocus?:
    | { field: "rotors" | "positions" | "rings"; rotorIndex: 0 | 1 | 2 }
    | { field: "reflector" }
    | null;
}

const TAU = Math.PI * 2;
const STEP = TAU / 26;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AMBER = "#d88c39";
const TEAL = "#4baba0";
const BRASS = "#a89057";
const textCache = new Map<string, THREE.CanvasTexture>();

function textTexture(text: string, color = "#e6d8b9", size = 128) {
  const key = `${text}|${color}|${size}`;
  const existing = textCache.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `600 ${text.length > 10 ? size * 0.12 : text.length > 3 ? size * 0.2 : size * 0.62}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size * 0.52, size * 0.94);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textCache.set(key, texture);
  return texture;
}

function Marking({
  text,
  position,
  rotation = [-Math.PI / 2, 0, 0],
  width = 0.3,
  height = width,
  color = "#e6d8b9",
}: {
  text: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  color?: string;
}) {
  const map = useMemo(() => textTexture(text, color), [text, color]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Screw({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.018, 12]} />
        <meshStandardMaterial
          color="#aa9a72"
          metalness={0.86}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, 0.0105, 0]}>
        <boxGeometry args={[0.058, 0.006, 0.009]} />
        <meshStandardMaterial color="#3a3b30" />
      </mesh>
    </group>
  );
}

function Cable({
  points,
  color = "#293844",
  radius = 0.035,
  glowing = false,
}: {
  points: [number, number, number][];
  color?: string;
  radius?: number;
  glowing?: boolean;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    return new THREE.TubeGeometry(curve, 36, radius, 8, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow={!glowing}>
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.18}
        emissive={glowing ? color : "#000000"}
        emissiveIntensity={glowing ? 1.5 : 0}
      />
    </mesh>
  );
}

function Lift({
  children,
  height,
}: {
  children: React.ReactNode;
  height: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current)
      group.current.position.y = THREE.MathUtils.damp(
        group.current.position.y,
        height,
        7,
        dt,
      );
  });
  return <group ref={group}>{children}</group>;
}

function InternalWiring({
  rotorId,
  reflectorId,
}: {
  rotorId?: string;
  reflectorId?: string;
}) {
  const geometry = useMemo(() => {
    const mapping = rotorId
      ? ROTORS[rotorId as RotorId]?.forward
      : REFLECTORS[(reflectorId || "B") as ReflectorId]?.contacts;
    if (!mapping) return null;
    const wires = mapping.flatMap((to, from) => {
      if (!rotorId && from > to) return [];
      const points = rotorId
        ? rotorWirePoints(from, to)
        : reflectorWirePoints(from, to);
      return [
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            points.map((p) => new THREE.Vector3(...p)),
          ),
          24,
          0.008,
          5,
          false,
        ),
      ];
    });
    const merged = mergeGeometries(wires);
    wires.forEach((wire) => wire.dispose());
    return merged;
  }, [rotorId, reflectorId]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry ? (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#a39878"
        roughness={0.64}
        metalness={0.35}
        transparent
        opacity={0.25}
        depthWrite={false}
      />
    </mesh>
  ) : null;
}

/** Thin drafting leaders tie floating letters to their physical terminals. */
function ContactLeader({ offset, color }: { offset: Point3; color: string }) {
  const geometry = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(...offset).multiplyScalar(0.7),
      ]),
    [offset[0], offset[1], offset[2]],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} raycast={() => {}}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/** The tracer shares the background wire's control points. It never invents a route. */
function WireTrace({
  points,
  color,
  active,
  stageProgress,
  stageProgressRef,
  labels,
  coreLabels,
  terminalKind = "rotor",
  singleLabel = false,
  language = "zh",
  visible = true,
  radius,
}: {
  points: Point3[];
  color: string;
  active: boolean;
  stageProgress?: number;
  stageProgressRef?: { current: number };
  labels?: [string, string];
  coreLabels?: [string, string];
  terminalKind?: "rotor" | "reflector" | "plugboard";
  singleLabel?: boolean;
  language?: "zh" | "en";
  visible?: boolean;
  radius?: number;
}) {
  const bead = useRef<THREE.Mesh>(null);
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    [points],
  );
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        curve,
        52,
        radius ?? (active ? 0.022 : 0.012),
        8,
        false,
      ),
    [curve, active, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (!active || !bead.current) return;
    const t = THREE.MathUtils.clamp(
      stageProgressRef?.current ?? stageProgress ?? 1,
      0,
      1,
    );
    bead.current.position.copy(curve.getPointAt(t));
  });
  if (!visible) return null;
  const endpoints = [points[0], points[points.length - 1]];
  return (
    <group>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 1 : 0.42}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {active &&
        endpoints.map((p, i) => {
          const radial = Math.max(0.001, Math.hypot(p[1], p[2]));
          // The physical face determines the offset, including on the return
          // path. Input/output order does not determine left/right placement.
          const offset: Point3 =
            terminalKind === "plugboard"
              ? [0, 0.25, 0.09]
              : [
                  (Math.sign(p[0]) || 1) * 0.23,
                  (p[1] / radial) * 0.13,
                  (p[2] / radial) * 0.13,
                ];
          return (
            <group key={i} position={p}>
              <mesh>
                <sphereGeometry args={[0.043, 14, 10]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
              {labels && (!singleLabel || i === 0) && (
                <>
                  <ContactLeader offset={offset} color={color} />
                  <SignalLabel
                    position={offset}
                    text={labels[i]}
                    secondaryText={
                      coreLabels
                        ? `${language === "zh" ? "线芯" : "Core"} ${coreLabels[i]}`
                        : singleLabel
                          ? language === "zh"
                            ? "直通"
                            : "THRU"
                          : undefined
                    }
                    color={color}
                    compact
                    variant="contact"
                    tone="light"
                  />
                </>
              )}
            </group>
          );
        })}
      {active && (
        <mesh ref={bead} position={points[0]} renderOrder={3}>
          <sphereGeometry args={[0.044, 16, 12]} />
          <meshBasicMaterial color="#fff5d8" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function StageWire({
  stage,
  active,
  ...props
}: Pick<
  MachineSceneProps,
  "stageProgress" | "stageProgressRef" | "language"
> & {
  stage: SignalStage;
  active: boolean;
}) {
  const points = useMemo(() => pathPointsForStage(stage), [stage]);
  if (!points) return null;
  // The fixed wire is named in core coordinates, but the large endpoint label
  // names its current external contact, matching the adjacent component.
  const labels: [string, string] = [
    ALPHABET[stage.input],
    ALPHABET[stage.output],
  ];
  const coreLabels: [string, string] | undefined = stage.rotorId
    ? [ALPHABET[stage.shiftedInput!], ALPHABET[stage.wiredOutput!]]
    : undefined;
  return (
    <WireTrace
      points={points}
      active={active}
      color={stage.direction === "reverse" ? TEAL : AMBER}
      labels={labels}
      coreLabels={coreLabels}
      terminalKind={stage.rotorId ? "rotor" : "reflector"}
      {...props}
    />
  );
}

function WheelDetails({ contacts = false }: { contacts?: boolean }) {
  const geometry = useMemo(() => {
    const count = contacts ? 26 : 52;
    const parts: THREE.BufferGeometry[] = [];
    const xPositions = contacts ? [-0.339, 0.339] : [-0.29, 0.29];
    for (const x of xPositions)
      for (let j = 0; j < count; j++) {
        const theta = (contacts ? Math.PI / 2 : 0) + (j * TAU) / count;
        const part = contacts
          ? new THREE.CylinderGeometry(0.026, 0.026, 0.025, 8)
          : new THREE.BoxGeometry(0.077, 0.026, 0.027);
        if (contacts) part.rotateZ(Math.PI / 2);
        else part.rotateX(-theta);
        part.translate(
          x,
          Math.sin(theta) * (contacts ? 0.516 : 0.713),
          Math.cos(theta) * (contacts ? 0.516 : 0.713),
        );
        parts.push(part);
      }
    const result = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    return result;
  }, [contacts]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow={!contacts}>
      <meshStandardMaterial
        color={contacts ? "#c5b578" : "#9f8b5c"}
        metalness={contacts ? 0.87 : 0.75}
        roughness={contacts ? 0.34 : 0.47}
      />
    </mesh>
  );
}

function Rotor({
  index,
  position,
  previousPosition,
  ring,
  rotorId,
  phase,
  selected,
  onSelect,
  trace,
  inspection,
  stageProgress,
  stageProgressRef,
  language = "zh",
  previewFocus,
}: {
  index: number;
  position: number;
  previousPosition?: number;
  ring: number;
  rotorId: string;
  phase: number;
  selected: boolean;
  onSelect: MachineSceneProps["onSelect"];
} & Pick<
  MachineSceneProps,
  | "trace"
  | "inspection"
  | "stageProgress"
  | "stageProgressRef"
  | "language"
  | "previewFocus"
>) {
  const spin = useRef<THREE.Group>(null);
  const coreSpin = useRef<THREE.Group>(null);
  const initialPosition = useRef(position * STEP);
  const initialRing = useRef(-ring * STEP);
  const coreTarget = useRef(-ring * STEP);
  const lastRing = useRef(ring);
  const previewing =
    !!previewFocus &&
    previewFocus.field !== "reflector" &&
    previewFocus.rotorIndex === index;
  const angularTarget = useRef(position * STEP);
  const lastPosition = useRef(position);
  useEffect(() => {
    const change = (position - lastPosition.current + 26) % 26;
    angularTarget.current += (change > 13 ? change - 26 : change) * STEP;
    lastPosition.current = position;
  }, [position]);
  useEffect(() => {
    const change = (ring - lastRing.current + 26) % 26;
    coreTarget.current -= (change > 13 ? change - 26 : change) * STEP;
    lastRing.current = ring;
  }, [ring]);
  useFrame((_, dt) => {
    if (!spin.current || !coreSpin.current) return;
    if (previewFocus) {
      spin.current.rotation.x = THREE.MathUtils.damp(
        spin.current.rotation.x,
        angularTarget.current,
        9,
        dt,
      );
      coreSpin.current.rotation.x = THREE.MathUtils.damp(
        coreSpin.current.rotation.x,
        coreTarget.current,
        9,
        dt,
      );
      return;
    }
    // Returning to encryption lands exactly at the verified electrical state;
    // only the mechanical phase uses the shared playback clock.
    coreSpin.current.rotation.x = coreTarget.current;
    const progress = THREE.MathUtils.clamp(
      stageProgressRef?.current ?? stageProgress ?? 1,
      0,
      1,
    );
    const step =
      previousPosition !== undefined
        ? (position - previousPosition + 26) % 26
        : 0;
    spin.current.rotation.x =
      angularTarget.current -
      (phase === 0 ? Math.min(1, step) * STEP * (1 - progress) : 0);
  });
  const forwardPhase = 4 - index;
  const reversePhase = 6 + index;
  const forward = phase === forwardPhase;
  const reverse = phase === reversePhase;
  const signal = !!trace && (forward || reverse);
  const transparent = previewFocus
    ? previewing
    : !!inspection || selected || signal;
  const color = reverse ? TEAL : AMBER;
  const activeStage = signal ? trace!.stages[phase - 1] : undefined;
  const notch = ROTORS[rotorId as RotorId].notches[0];
  const notchAngle = Math.PI / 2 + notch * STEP;
  const previewExplanation =
    language === "zh"
      ? previewFocus?.field === "rings"
        ? "环设置 · 线芯相对转动"
        : previewFocus?.field === "positions"
          ? "窗口 · 字母环与线芯同步"
          : "型号 · 接线与缺口同步"
      : previewFocus?.field === "rings"
        ? "RING · Core shifts relative to ring"
        : previewFocus?.field === "positions"
          ? "WINDOW · Ring and core turn together"
          : "ROTOR · Wiring and notch follow model";
  return (
    <group
      position={[-0.7 + index * 0.96, 1.79, -1.53]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect("rotors", index as 0 | 1 | 2);
      }}
    >
      <group ref={spin} rotation={[initialPosition.current, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow={!transparent}>
          <cylinderGeometry args={[0.635, 0.635, 0.54, 64]} />
          <VintageMaterial
            surface="bakelite"
            key={transparent ? "ghost" : "solid"}
            color="#3e382b"
            metalness={0.3}
            roughness={0.75}
            transparent={transparent}
            opacity={transparent ? 0.035 : 1}
            depthWrite={!transparent}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow={!transparent}>
          <cylinderGeometry
            args={[
              ROTOR_NUMBER_RING.radius,
              ROTOR_NUMBER_RING.radius,
              0.29,
              64,
            ]}
          />
          <meshStandardMaterial
            key={transparent ? "ghost" : "solid"}
            color="#d3c59f"
            metalness={0.16}
            roughness={0.72}
            transparent={transparent}
            opacity={transparent ? 0.075 : 1}
            depthWrite={!transparent}
          />
        </mesh>
        {[-0.29, 0.29].map((x) => (
          <group key={x}>
            <mesh
              position={[x, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow={!transparent}
            >
              <cylinderGeometry args={[0.71, 0.71, 0.067, 52]} />
              <VintageMaterial
                surface="brass"
                key={transparent ? "ghost" : "solid"}
                color={BRASS}
                metalness={0.69}
                roughness={0.46}
                transparent={transparent}
                opacity={transparent ? 0.11 : 1}
                depthWrite={!transparent}
              />
            </mesh>
            <mesh position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.687, 0.027, 8, 52]} />
              <VintageMaterial
                surface="brass"
                key={transparent ? "ghost" : "solid"}
                color="#8c7750"
                metalness={0.69}
                roughness={0.53}
                transparent={transparent}
                opacity={transparent ? 0.38 : 1}
              />
            </mesh>
          </group>
        ))}
        <WheelDetails />
        {/* Engraved index marks belong to the letter ring, not the wired core. */}
        {Array.from({ length: 26 }, (_, j) => {
          const theta = Math.PI / 2 + j * STEP;
          return (
            <mesh
              key={`index-${j}`}
              position={[
                0.235,
                Math.sin(theta) * 0.724,
                Math.cos(theta) * 0.724,
              ]}
              rotation={[-theta, 0, 0]}
            >
              <boxGeometry args={[j % 5 === 0 ? 0.067 : 0.035, 0.012, 0.014]} />
              <meshStandardMaterial
                color="#d1bd82"
                roughness={0.48}
                metalness={0.62}
              />
            </mesh>
          );
        })}
        {/* Turnover reference is attached to the alphabet ring at the defined
            notch letter. This marks timing; it is not a simulated pawl. */}
        <group
          position={[
            -0.304,
            Math.sin(notchAngle) * 0.7,
            Math.cos(notchAngle) * 0.7,
          ]}
          rotation={[-notchAngle, 0, 0]}
        >
          <mesh>
            <boxGeometry args={[0.082, 0.044, 0.102]} />
            <meshStandardMaterial
              color="#503e26"
              roughness={0.7}
              metalness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.025, 0]}>
            <boxGeometry args={[0.051, 0.011, 0.062]} />
            <meshStandardMaterial
              color="#bb8547"
              roughness={0.43}
              metalness={0.68}
            />
          </mesh>
        </group>
        {previewing && (
          <SignalLabel
            text={`${language === "zh" ? "缺口" : "Notch"} ${ALPHABET[notch]}`}
            position={[
              -0.45,
              Math.sin(notchAngle) * 0.85,
              Math.cos(notchAngle) * 0.85,
            ]}
            color="#a16f38"
            variant="reference"
            compact
          />
        )}
        {ALPHABET.split("").map((_, j) => {
          // In this y=sin(theta), z=cos(theta) convention, positive Rx(phi)
          // gives theta-phi: letter j=position reaches the fixed top window.
          // The notch uses this same positive-angle alphabet-ring convention.
          const theta = Math.PI / 2 + j * STEP;
          return (
            <Marking
              key={j}
              text={String(j + 1).padStart(2, "0")}
              position={[
                0,
                Math.sin(theta) * ROTOR_NUMBER_RING.labelRadius,
                Math.cos(theta) * ROTOR_NUMBER_RING.labelRadius,
              ]}
              rotation={[-theta, 0, 0]}
              width={ROTOR_NUMBER_RING.labelWidth}
              height={ROTOR_NUMBER_RING.labelHeight}
              color="#443e2e"
            />
          );
        })}
        <group ref={coreSpin} rotation={[initialRing.current, 0, 0]}>
          <RotorThumbwheel />
          {transparent && <InternalWiring rotorId={rotorId} />}
          <WheelDetails contacts />
          {[-0.35, 0.35].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.142, 0.142, 0.035, 32]} />
                <VintageMaterial
                  surface="brass"
                  color="#a69565"
                  metalness={0.7}
                  roughness={0.51}
                />
              </mesh>
              <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.185, 0.014, 8, 40]} />
                <meshStandardMaterial
                  color="#8c805e"
                  metalness={0.73}
                  roughness={0.45}
                />
              </mesh>
              {[0, 1, 2].map((j) => {
                const theta = (j * TAU) / 3;
                return (
                  <mesh
                    key={j}
                    position={[
                      x > 0 ? 0.022 : -0.022,
                      Math.sin(theta) * 0.105,
                      Math.cos(theta) * 0.105,
                    ]}
                    rotation={[0, 0, Math.PI / 2]}
                  >
                    <cylinderGeometry args={[0.024, 0.024, 0.018, 12]} />
                    <meshStandardMaterial
                      color="#655f4c"
                      metalness={0.75}
                      roughness={0.5}
                    />
                  </mesh>
                );
              })}
            </group>
          ))}
          {previewing && (
            <group position={contactPoint(0, 0.38)}>
              <mesh>
                <sphereGeometry args={[0.042, 14, 10]} />
                <meshStandardMaterial
                  color="#8c82a5"
                  emissive="#8c82a5"
                  emissiveIntensity={0.2}
                  metalness={0.45}
                  roughness={0.48}
                />
              </mesh>
              <SignalLabel
                text={language === "zh" ? "线芯 A" : "Core A"}
                position={[0.19, 0.13, 0]}
                color="#8c82a5"
                compact
                variant="reference"
              />
            </group>
          )}
          {trace &&
            transparent &&
            [forwardPhase, reversePhase]
              .filter((p) => phase >= p)
              .map((p) => (
                <StageWire
                  key={p}
                  stage={trace.stages[p - 1]}
                  active={phase === p}
                  stageProgress={stageProgress}
                  stageProgressRef={stageProgressRef}
                  language={language}
                />
              ))}
        </group>
      </group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.073, 0.073, 0.89, 20]} />
        <meshStandardMaterial
          color="#8d876d"
          metalness={0.78}
          roughness={0.45}
        />
      </mesh>
      <Marking
        text={rotorId}
        position={[0, -0.554, 0.62]}
        width={0.38}
        height={0.3}
        color="#d8c79e"
      />
      {previewing && (
        <SignalLabel
          position={[0, 1.31, 0]}
          color="#a08a59"
          text={
            language === "zh"
              ? `${rotorId} · 窗口 ${ALPHABET[position]} · 环 ${String(ring + 1).padStart(2, "0")}`
              : `${rotorId} · Window ${ALPHABET[position]} · Ring ${String(ring + 1).padStart(2, "0")}`
          }
          secondaryText={previewExplanation}
        />
      )}
      {activeStage && (
        <SignalLabel
          position={[0, 1.2, 0]}
          text={`${rotorId} · ${ALPHABET[activeStage.input]} → ${ALPHABET[activeStage.output]}`}
          secondaryText={
            language === "zh"
              ? `外部触点 · ${reverse ? "返回" : "正向"}`
              : `External · ${reverse ? "RETURN" : "FORWARD"}`
          }
          color={color}
        />
      )}
    </group>
  );
}

function Reflector(props: MachineSceneProps) {
  const active = !!props.trace && props.phase === 5;
  const transparent = props.previewFocus
    ? props.previewFocus.field === "reflector"
    : !!props.inspection || props.selected === "reflector" || active;
  const stage = props.trace?.stages[4];
  return (
    <group
      position={[-1.65, 1.79, -1.53]}
      onClick={(e) => {
        e.stopPropagation();
        props.onSelect("reflector");
      }}
    >
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow={!transparent}>
        <cylinderGeometry args={[0.695, 0.695, 0.39, 64]} />
        <VintageMaterial
          surface="brass"
          key={transparent ? "ghost" : "solid"}
          color="#87754d"
          metalness={0.68}
          roughness={0.58}
          transparent={transparent}
          opacity={transparent ? 0.055 : 1}
          depthWrite={!transparent}
        />
      </mesh>
      {transparent && <InternalWiring reflectorId={props.reflectorId || "B"} />}
      {transparent && stage && props.phase >= 5 && (
        <StageWire
          stage={stage}
          active={active}
          stageProgress={props.stageProgress}
          stageProgressRef={props.stageProgressRef}
          language={props.language}
        />
      )}
      {[-0.207, 0.207].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.636, 0.025, 8, 64]} />
          <VintageMaterial
            surface="brass"
            color="#b6a275"
            metalness={0.71}
            roughness={0.51}
          />
        </mesh>
      ))}
      {Array.from({ length: 26 }, (_, j) => (
        <mesh
          key={j}
          position={contactPoint(j, 0.205, 0.516)}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.023, 0.023, 0.026, 8]} />
          <meshStandardMaterial
            color="#c7b57c"
            metalness={0.75}
            roughness={0.4}
          />
        </mesh>
      ))}
      <Marking
        text={`UKW ${props.reflectorId || "B"}`}
        position={[0, 0.705, 0]}
        width={0.48}
        height={0.35}
        color="#e9ddba"
      />
      {props.previewFocus?.field === "reflector" && (
        <SignalLabel
          position={[0, 1.26, 0]}
          color="#a08a59"
          text={`UKW ${props.reflectorId || "B"} · ${props.language === "en" ? "Preview" : "预览"}`}
          secondaryText={
            props.language === "en"
              ? "13 fixed pairs · stationary"
              : "13 对固定接线 · 不旋转"
          }
        />
      )}
      {active && stage && (
        <SignalLabel
          position={[0, 1.14, 0]}
          text={`UKW ${props.reflectorId || "B"} · ${ALPHABET[stage.input]} ↔ ${ALPHABET[stage.output]}`}
          color={AMBER}
        />
      )}
    </group>
  );
}

function RotorAssembly(props: MachineSceneProps) {
  const { selected, exploded, phase, onSelect } = props;
  return (
    <Lift height={exploded ? 1.58 : 0}>
      <group>
        <mesh
          position={[-0.17, 1.79, -1.53]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.076, 0.076, 4.6, 24]} />
          <meshStandardMaterial
            color="#a89b77"
            metalness={0.85}
            roughness={0.32}
          />
        </mesh>
        {[-2.31, 2.04].map((x) => (
          <RotorBearing key={x} x={x} />
        ))}
        {[0, 1, 2].map((i) => (
          <Rotor
            key={i}
            index={i}
            position={props.positions[i]}
            previousPosition={props.previousPositions?.[i]}
            ring={props.rings[i]}
            rotorId={props.rotorIds[i]}
            phase={phase}
            selected={selected === "rotors"}
            onSelect={onSelect}
            trace={props.trace}
            inspection={props.inspection}
            stageProgress={props.stageProgress}
            stageProgressRef={props.stageProgressRef}
            language={props.language}
            previewFocus={props.previewFocus}
          />
        ))}
        <Reflector {...props} />
        {exploded &&
          [-2.31, 2.04].map((x) => (
            <mesh key={x} position={[x, 0.58, -1.53]}>
              <cylinderGeometry args={[0.008, 0.008, 1.48, 6]} />
              <meshBasicMaterial color="#9e957b" transparent opacity={0.3} />
            </mesh>
          ))}
      </group>
    </Lift>
  );
}

function keyCoordinate(
  letter: string,
  type: "key" | "lamp",
): [number, number, number] {
  return keyPoint(letter, type);
}

function Keyboard({
  input,
  phase,
  exploded,
  selected,
  onSelect,
}: MachineSceneProps) {
  return (
    <Lift height={exploded ? 0.4 : 0}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect("keyboard");
        }}
      >
        <KeyboardGuidePanel selected={selected === "keyboard"} />
        {ALPHABET.split("").map((letter) => {
          const point = keyCoordinate(letter, "key");
          // Retain the closed-circuit key position throughout playback and its final snapshot.
          const down = input === letter && phase >= 0;
          return (
            <group
              key={letter}
              position={[point[0], point[1] - (down ? 0.083 : 0), point[2]]}
            >
              <mesh position={[0, -0.1, 0]} castShadow>
                <boxGeometry args={[0.13, 0.2, 0.13]} />
                <meshStandardMaterial
                  color="#958c6d"
                  metalness={0.72}
                  roughness={0.36}
                />
              </mesh>
              <mesh position={[0, -0.012, 0]} castShadow>
                <cylinderGeometry args={[0.222, 0.232, 0.074, 32]} />
                <VintageMaterial
                  surface="brass"
                  color="#998459"
                  metalness={0.7}
                  roughness={0.53}
                />
              </mesh>
              <mesh position={[0, 0.035, 0]} castShadow>
                <cylinderGeometry args={[0.196, 0.201, 0.075, 32]} />
                <VintageMaterial
                  surface="bakelite"
                  color={down ? "#5b5031" : "#282922"}
                  emissive={down ? AMBER : "#000000"}
                  emissiveIntensity={down ? 0.1 : 0}
                  roughness={0.48}
                  metalness={0.1}
                />
              </mesh>
              <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.193, 0.009, 5, 32]} />
                <meshStandardMaterial
                  color="#ac9c75"
                  metalness={0.54}
                  roughness={0.54}
                />
              </mesh>
              <Marking
                text={letter}
                position={[0, 0.094, 0]}
                width={0.275}
                color={down ? "#f8d995" : "#ded2b2"}
              />
            </group>
          );
        })}
      </group>
    </Lift>
  );
}

function Lamps({
  output,
  lampCoverRemoved,
  phase,
  exploded,
  selected,
  onSelect,
}: MachineSceneProps) {
  return (
    <Lift height={exploded ? 0.88 : 0}>
      <LampboardInstrument
        output={output}
        coverRemoved={lampCoverRemoved}
        phase={phase}
        selected={selected === "lampboard"}
        onInspect={() => onSelect("lampboard")}
      />
    </Lift>
  );
}

function plugCoordinate(letter: string): [number, number, number] {
  const index = ALPHABET.indexOf(letter);
  return [((index % 13) - 6) * 0.396, index < 13 ? 0.956 : 0.59, 2.454];
}

function plugCablePoints(pair: string, index: number): Point3[] {
  const a = plugCoordinate(pair[0]);
  const b = plugCoordinate(pair[1]);
  return [
    [a[0], a[1] - 0.04, 2.63],
    [a[0] * 0.96, 0.28 + index * 0.01, 2.83 + index * 0.027],
    [(a[0] + b[0]) / 2, 0.16 + index * 0.008, 2.94 + index * 0.024],
    [b[0] * 0.96, 0.28 + index * 0.01, 2.83 + index * 0.027],
    [b[0], b[1] - 0.04, 2.63],
  ];
}

function plugBypassPoints(letter: string): Point3[] {
  const p = plugCoordinate(letter);
  return [
    [p[0], p[1], 2.46],
    [p[0], p[1] - 0.015, 2.34],
    [p[0], p[1] - 0.07, 2.34],
    [p[0], p[1] - 0.085, 2.46],
  ];
}

function configuredPlugPairs(plugboard: string): string[] {
  return plugboard
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((pair) => /^[A-Z]{2}$/.test(pair))
    .slice(0, 10);
}

function plugStagePoints(
  stage: SignalStage,
  pairs: string[],
): Point3[] | undefined {
  const a = ALPHABET[stage.input],
    b = ALPHABET[stage.output];
  if (a === b) return plugBypassPoints(a);
  const index = pairs.findIndex((pair) => pair.includes(a) && pair.includes(b));
  if (index < 0) return undefined;
  const points = plugCablePoints(pairs[index], index);
  return pairs[index][0] === a ? points : points.reverse();
}

function plugboardOffset(props: MachineSceneProps): number {
  // Keep the inspected board in one physical position throughout a followed
  // trace, including the bridges into and out of its two signal stages.
  if (
    (props.followSignal !== false && props.trace) ||
    props.inspection ||
    props.selected === "plugboard"
  )
    return 0.35;
  const phases = [props.phase, props.transition?.from, props.transition?.to];
  const bypass = phases.some((phase) => {
    if (!props.trace || (phase !== 1 && phase !== 9)) return false;
    const stage = props.trace.stages[phase - 1];
    return stage.input === stage.output;
  });
  return bypass ? 0.35 : 0;
}

function Plugboard(props: MachineSceneProps) {
  const {
    onSelect,
    plugboard = "",
    selected,
    phase,
    trace,
    inspection,
    stageProgress,
    stageProgressRef,
  } = props;
  const pairs = useMemo(() => configuredPlugPairs(plugboard), [plugboard]);
  const connected = pairs.join("");
  const activeStage =
    trace && (phase === 1 || phase === 9) ? trace.stages[phase - 1] : undefined;
  const ghost = !!inspection || selected === "plugboard" || !!activeStage;
  const bypass = !!activeStage && activeStage.input === activeStage.output;
  const boardOffset = plugboardOffset(props);
  const stagePaths = useMemo(() => {
    if (!trace) return [];
    return [1, 9]
      .filter((p) => phase >= p)
      .map((p) => {
        const stage = trace.stages[p - 1];
        const points = plugStagePoints(stage, pairs);
        if (!points) return null;
        return { stage, phase: p, points };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [trace, phase, pairs]);
  return (
    <group
      position={[0, 0, boardOffset]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect("plugboard");
      }}
    >
      <RoundedBox
        args={[5.53, 0.85, 0.075]}
        radius={0.035}
        position={[0, 0.801, 2.41]}
        castShadow={!ghost}
      >
        <VintageMaterial
          surface="enamel"
          key={ghost ? "ghost" : "solid"}
          color="#34362b"
          roughness={0.75}
          metalness={0.25}
          transparent={ghost}
          opacity={ghost ? 0.27 : 1}
          depthWrite={!ghost}
        />
      </RoundedBox>
      {ALPHABET.split("").map((letter) => {
        const point = plugCoordinate(letter);
        const plugged = connected.includes(letter);
        const active =
          !!activeStage &&
          (ALPHABET[activeStage.input] === letter ||
            ALPHABET[activeStage.output] === letter);
        const color = phase === 9 ? TEAL : AMBER;
        return (
          <group key={letter} position={point}>
            <Marking
              text={letter}
              position={[0, 0.128, 0.007]}
              rotation={[0, 0, 0]}
              width={0.16}
              color={active ? color : "#ddcfaa"}
            />
            {[0, -0.085].map((y) => (
              <group
                key={y}
                position={[0, y, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <mesh>
                  <cylinderGeometry args={[0.06, 0.06, 0.016, 20]} />
                  <meshStandardMaterial
                    color={active ? color : "#ab9668"}
                    emissive={active ? color : "#000000"}
                    emissiveIntensity={active ? 0.45 : 0}
                    metalness={0.66}
                    roughness={0.52}
                  />
                </mesh>
                <mesh position={[0, -0.01, 0]}>
                  <cylinderGeometry args={[0.033, 0.033, 0.02, 16]} />
                  <meshStandardMaterial
                    color="#171e19"
                    metalness={0.1}
                    roughness={0.86}
                  />
                </mesh>
              </group>
            ))}
            {plugged && (
              <RoundedBox
                args={[0.13, 0.21, 0.15]}
                radius={0.032}
                position={[0, -0.044, 0.1]}
                castShadow
              >
                <VintageMaterial
                  surface="bakelite"
                  color={active ? "#746442" : "#36352a"}
                  roughness={0.73}
                  metalness={0.12}
                />
              </RoundedBox>
            )}
          </group>
        );
      })}
      {pairs.map((pair, index) => (
        <Cable
          key={pair}
          points={plugCablePoints(pair, index)}
          color={index % 3 === 0 ? "#504936" : "#2f3027"}
          radius={0.034}
        />
      ))}
      {ghost &&
        ALPHABET.split("")
          .filter((letter) => !connected.includes(letter))
          .map((letter) => (
            <Cable
              key={letter}
              points={plugBypassPoints(letter)}
              color="#807554"
              radius={0.009}
            />
          ))}
      {stagePaths.map(({ stage, phase: p, points }) => (
        <WireTrace
          key={p}
          points={points}
          active={phase === p}
          radius={phase === p ? 0.046 : 0.038}
          color={p === 9 ? TEAL : AMBER}
          labels={[ALPHABET[stage.input], ALPHABET[stage.output]]}
          terminalKind="plugboard"
          singleLabel={stage.input === stage.output}
          language={props.language}
          stageProgress={stageProgress}
          stageProgressRef={stageProgressRef}
        />
      ))}
      {activeStage && (
        <SignalLabel
          position={[0, 1.44, 2.5]}
          tone="light"
          text={
            bypass
              ? `${ALPHABET[activeStage.input]} · ${props.language === "en" ? "THRU" : "直通"}`
              : `${ALPHABET[activeStage.input]} ↔ ${ALPHABET[activeStage.output]}`
          }
          secondaryText={
            props.language === "en"
              ? `STECKER · ${phase === 9 ? "RETURN" : "IN"}`
              : `插线板 · ${phase === 9 ? "返回" : "进入"}`
          }
          color={phase === 9 ? TEAL : AMBER}
        />
      )}
      {[-2.62, 2.62].map((x) => (
        <Screw
          key={x}
          position={[x, 0.76, 2.459]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}
    </group>
  );
}

function worldStageEndpoint(
  stage: SignalStage,
  end: boolean,
  lift: number,
): Point3 | undefined {
  const points = pathPointsForStage(stage);
  if (!points) return undefined;
  let point = points[end ? points.length - 1 : 0];
  const rotor = stage.rotorIndex !== undefined;
  if (rotor)
    point = rotateXPoint(point, (stage.position ?? 0) - (stage.ring ?? 0));
  return [
    point[0] + (rotor ? -0.7 + stage.rotorIndex! * 0.96 : -1.65),
    point[1] + 1.79 + lift,
    point[2] - 1.53,
  ];
}

/** Fixed neighboring contacts meet across the gaps, so the actual contact index stays continuous. */
function ContactBridges({
  trace,
  phase,
  exploded,
  inspection,
  selected,
}: MachineSceneProps) {
  const routes = useMemo(() => {
    if (!trace || phase < 3) return [];
    const lift = exploded ? 1.58 : 0;
    return [3, 4, 5, 6, 7, 8]
      .filter((p) => phase >= p)
      .flatMap((p) => {
        const from = worldStageEndpoint(trace.stages[p - 2], true, lift);
        const to = worldStageEndpoint(trace.stages[p - 1], false, lift);
        return from && to ? [{ phase: p, points: [from, to] }] : [];
      });
  }, [trace, phase, exploded]);
  if (
    !inspection &&
    selected !== "rotors" &&
    selected !== "reflector" &&
    phase >= 9
  )
    return null;
  return (
    <group>
      {routes.map((route) => (
        <Cable
          key={route.phase}
          points={route.points}
          color={route.phase >= 6 ? TEAL : AMBER}
          radius={route.phase === phase ? 0.018 : 0.009}
          glowing={route.phase === phase}
        />
      ))}
    </group>
  );
}

interface ConnectionRoute {
  points: Point3[];
  schematic: boolean;
  color: string;
}

/** Real contact bridges stay straight; longer loom connections are explicitly schematic. */
function transitionRoute(
  props: MachineSceneProps,
): ConnectionRoute | undefined {
  const { transition, trace, exploded } = props;
  if (!transition || !trace || transition.to !== transition.from + 1)
    return undefined;
  const { from, to } = transition;
  const lift = exploded ? 1.58 : 0;
  const color = to >= 6 ? TEAL : AMBER;
  const pairs = configuredPlugPairs(props.plugboard || "");
  const boardZ = plugboardOffset(props);
  const plugEndpoint = (
    stage: SignalStage,
    end: boolean,
  ): Point3 | undefined => {
    const points = plugStagePoints(stage, pairs);
    if (!points) return undefined;
    const p = points[end ? points.length - 1 : 0];
    return [p[0], p[1], p[2] + boardZ];
  };
  if (from >= 2 && to <= 8) {
    const start = worldStageEndpoint(trace.stages[from - 1], true, lift);
    const end = worldStageEndpoint(trace.stages[to - 1], false, lift);
    if (!start || !end) return undefined;
    return { points: [start, end], schematic: false, color };
  }
  if (from === 0 && to === 1) {
    const key = keyCoordinate(trace.input, "key");
    const start: Point3 = [
      key[0],
      key[1] + 0.08 + (exploded ? 0.4 : 0),
      key[2],
    ];
    const end = plugEndpoint(trace.stages[0], false);
    if (!end) return undefined;
    return {
      points: [
        start,
        [start[0], 2.12 + (exploded ? 0.4 : 0), 1.7],
        [end[0], 1.66, 2.84 + boardZ],
        end,
      ],
      schematic: true,
      color,
    };
  }
  if (from === 1 && to === 2) {
    const start = plugEndpoint(trace.stages[0], true);
    const end = worldStageEndpoint(trace.stages[1], false, lift);
    if (!start || !end) return undefined;
    return {
      points: [
        start,
        [2.9, 1.62, 2.72 + boardZ],
        [3, 2.2 + lift, 0.2],
        [2.42, end[1], end[2]],
        end,
      ],
      schematic: true,
      color,
    };
  }
  if (from === 8 && to === 9) {
    const start = worldStageEndpoint(trace.stages[7], true, lift);
    const end = plugEndpoint(trace.stages[8], false);
    if (!start || !end) return undefined;
    return {
      points: [
        start,
        [2.42, start[1], start[2]],
        [3, 2.2 + lift, 0.2],
        [2.9, 1.62, 2.72 + boardZ],
        end,
      ],
      schematic: true,
      color,
    };
  }
  if (from === 9 && to === 10) {
    const start = plugEndpoint(trace.stages[8], true);
    const lamp = keyCoordinate(trace.output, "lamp");
    const end: Point3 = [
      lamp[0],
      lamp[1] + 0.08 + (exploded ? 0.88 : 0),
      lamp[2],
    ];
    if (!start) return undefined;
    return {
      points: [
        start,
        [start[0], 1.72, 2.8 + boardZ],
        [end[0], 2.36 + (exploded ? 0.88 : 0), 0.66],
        end,
      ],
      schematic: true,
      color,
    };
  }
  return undefined;
}

function TransitionSignal(props: MachineSceneProps) {
  const bead = useRef<THREE.Mesh>(null);
  const route = useMemo(
    () => transitionRoute(props),
    [
      props.transition?.from,
      props.transition?.to,
      props.trace,
      props.exploded,
      props.plugboard,
      props.inspection,
      props.followSignal,
      props.selected,
      props.phase,
    ],
  );
  const curve = useMemo(
    () =>
      route
        ? new THREE.CatmullRomCurve3(
            route.points.map((p) => new THREE.Vector3(...p)),
          )
        : undefined,
    [route],
  );
  const line = useMemo(() => {
    if (!route || !curve) return undefined;
    const geometry = new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(100),
    );
    const material = route.schematic
      ? new THREE.LineDashedMaterial({
          color: route.color,
          dashSize: 0.11,
          gapSize: 0.075,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        })
      : new THREE.LineBasicMaterial({
          color: route.color,
          transparent: true,
          opacity: 0.85,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
    const result = new THREE.Line(geometry, material);
    result.computeLineDistances();
    result.renderOrder = 8;
    return result;
  }, [route, curve]);
  useEffect(
    () => () => {
      line?.geometry.dispose();
      line?.material.dispose();
    },
    [line],
  );
  useFrame(() => {
    if (!bead.current || !curve) return;
    const t = THREE.MathUtils.clamp(
      props.transitionProgressRef?.current ?? 1,
      0,
      1,
    );
    bead.current.position.copy(curve.getPointAt(t));
  });
  if (!route || !curve || !line) return null;
  return (
    <group>
      <primitive object={line} />
      <mesh ref={bead} position={route.points[0]} renderOrder={9}>
        <sphereGeometry args={[0.063, 18, 14]} />
        <meshBasicMaterial
          color="#fff5d8"
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {route.points
        .filter((_, index) => index === 0 || index === route.points.length - 1)
        .map((point, index) => (
          <mesh key={index} position={point} renderOrder={8}>
            <sphereGeometry args={[0.037, 12, 10]} />
            <meshBasicMaterial
              color={route.color}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
    </group>
  );
}

type CameraPose = { position: THREE.Vector3; target: THREE.Vector3 };

function cameraPose(
  selected: PartId,
  phase: number | undefined,
  exploded: boolean,
  aspect: number,
  previewFocus?: MachineSceneProps["previewFocus"],
  distanceScale = 1,
): CameraPose {
  const views: Record<PartId, [Point3, Point3]> = {
    machine: [
      [7, 8.6, 8.8],
      [0, 0.85, 0],
    ],
    rotors: [
      [4, 4.2, 2.6],
      [0, 1.85, -1.22],
    ],
    reflector: [
      [-4.2, 3.6, 2.3],
      [-1.3, 1.85, -1.4],
    ],
    plugboard: [
      [2.2, 2.1, 6.9],
      [0, 0.72, 1.9],
    ],
    keyboard: [
      [4.5, 6.7, 6.5],
      [0, 1.15, 1],
    ],
    lampboard: [
      [3.1, 6.3, 4.5],
      [0, 1.27, -0.23],
    ],
  };
  let part = selected;
  let view = views[part];
  if (phase !== undefined && phase >= 0) {
    if (phase === 0) part = "keyboard";
    else if (phase === 1 || phase === 9) part = "plugboard";
    else if (phase === 5) part = "reflector";
    else if (phase === 10) part = "lampboard";
    else part = "rotors";
    view = views[part];
    if (phase >= 2 && phase <= 8 && phase !== 5) {
      const index = phase <= 4 ? 4 - phase : phase - 6;
      const x = -0.7 + index * 0.96;
      const side = phase <= 4 ? 1 : -1;
      view = [
        [x + side * 2.9, 4.05, 2.2],
        [x, 1.88, -1.5],
      ];
    }
  }
  if (previewFocus) {
    if (previewFocus.field === "reflector") {
      part = "reflector";
      view = views.reflector;
    } else {
      part = "rotors";
      const x = -0.7 + previewFocus.rotorIndex * 0.96;
      view = [
        [x + 2.9, 4.05, 2.2],
        [x, 1.95, -1.5],
      ];
    }
  }
  const lift = exploded
    ? part === "rotors" || part === "reflector"
      ? 1.58
      : part === "keyboard"
        ? 0.4
        : part === "lampboard"
          ? 0.88
          : part === "machine"
            ? 0.8
            : 0
    : 0;
  const position = new THREE.Vector3(...view[0]).add(
    new THREE.Vector3(0, lift, 0),
  );
  const target = new THREE.Vector3(...view[1]).add(
    new THREE.Vector3(0, lift, 0),
  );
  const fit = Math.max(1, Math.min(2.2, 1.12 / aspect));
  position
    .sub(target)
    .multiplyScalar(fit * distanceScale)
    .add(target);
  return { position, target };
}

function CameraRig(
  props: MachineSceneProps & {
    detailSubject: React.RefObject<THREE.Group | null>;
    wholeMachine: React.RefObject<THREE.Group | null>;
  },
) {
  const {
    selected,
    exploded,
    resetView,
    phase,
    transition,
    transitionProgressRef,
    followSignal = true,
    trace,
    previewFocus,
    detail,
    detailSubject,
  } = props;
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const easing = useRef(true);
  const targetPosition = useRef(new THREE.Vector3(7, 8.6, 8.8));
  const targetLookAt = useRef(new THREE.Vector3(0, 0.85, 0));
  const journey = useRef<{
    start: CameraPose;
    end: CameraPose;
    to: number;
  } | null>(null);
  // Keep the expanded-pane projection throughout a zoom gesture. The paper
  // moves out of the model's way without nudging the model across the screen.
  const framing = stageFraming(
    size.width,
    size.height,
    props.presentation === "full-stage",
  );
  const aspect = framing.aspect;
  const distanceScale = framing.distanceScale;
  const projectionOffset = useRef(new THREE.Vector2());
  const zoomTracker = useMemo(() => createUserZoomTracker(), []);
  const projectSubject = useMemo(() => createSubjectProjector(), []);
  const userOrbitActive = useRef(false);
  const userZoomCallback = useRef(props.onUserZoom);
  userZoomCallback.current = props.onUserZoom;
  useEffect(() => {
    zoomTracker.reset();
    userOrbitActive.current = false;
    // A new automatic camera destination invalidates the old zoom anchor.
    // The parent only restores panes that were collapsed by zoom, preserving
    // a deliberate manual collapse.
    userZoomCallback.current?.(false);
  }, [
    selected,
    exploded,
    detail?.assembly,
    detail?.rotorIndex,
    detail?.isolate,
    detail?.ringExperiment,
    detail?.spread,
    resetView,
    aspect,
    distanceScale,
    previewFocus?.field,
    previewFocus && "rotorIndex" in previewFocus
      ? previewFocus.rotorIndex
      : undefined,
    followSignal,
    followSignal ? phase : undefined,
    followSignal ? transition?.to : undefined,
    zoomTracker,
  ]);
  const homeView = useRef<CameraPose | null>(null);
  const wasDetailed = useRef(false);
  useEffect(() => {
    if (detail || (transition && followSignal)) return;
    const pose = cameraPose(
      selected,
      followSignal && trace ? phase : undefined,
      exploded,
      aspect,
      previewFocus,
      distanceScale,
    );
    targetPosition.current.copy(pose.position);
    targetLookAt.current.copy(pose.target);
    // The timeline may finish between rendered frames. Commit its exact final
    // camera pose before clearing the journey instead of leaving a damped tail
    // that would keep drifting after a paused step change.
    const completedJourney = journey.current;
    if (followSignal && completedJourney?.to === phase) {
      camera.position.copy(completedJourney.end.position);
      controls.current?.target.copy(completedJourney.end.target);
      controls.current?.update();
      easing.current = false;
    } else {
      easing.current = true;
    }
    journey.current = null;
  }, [
    selected,
    exploded,
    resetView,
    aspect,
    distanceScale,
    followSignal,
    trace,
    phase,
    transition,
    detail?.assembly,
    previewFocus?.field,
    previewFocus && "rotorIndex" in previewFocus
      ? previewFocus.rotorIndex
      : undefined,
  ]);
  useEffect(() => {
    if (detail || !transition || !followSignal) {
      journey.current = null;
      return;
    }
    easing.current = false;
    journey.current = {
      to: transition.to,
      start: {
        position: camera.position.clone(),
        target:
          controls.current?.target.clone() ?? targetLookAt.current.clone(),
      },
      end: cameraPose(
        selected,
        transition.to,
        exploded,
        aspect,
        undefined,
        distanceScale,
      ),
    };
  }, [
    transition?.from,
    transition?.to,
    followSignal,
    exploded,
    aspect,
    distanceScale,
    camera,
    detail?.assembly,
  ]);
  useEffect(() => {
    if (!detail) {
      if (
        wasDetailed.current &&
        homeView.current &&
        selected === "machine" &&
        !followSignal &&
        !previewFocus
      ) {
        targetPosition.current.copy(homeView.current.position);
        targetLookAt.current.copy(homeView.current.target);
        easing.current = true;
      }
      wasDetailed.current = false;
      return;
    }
    if (!wasDetailed.current) {
      homeView.current = {
        position: camera.position.clone(),
        target:
          controls.current?.target.clone() ?? targetLookAt.current.clone(),
      };
      wasDetailed.current = true;
    }
    journey.current = null;
    const viewDirections = {
      rotor: [4.8, 2.8, 5.8],
      reflector: [6, 2.4, 4.6],
      drive: [6, 4.4, 7.8],
      plug: [4.5, 3, 6],
      key: [3.8, 3.2, 5.3],
      housing: [8.8, 6.8, 10.5],
    };
    const direction = new THREE.Vector3(
      ...viewDirections[detail.assembly],
    ).normalize();
    const bounds = new THREE.Box3();
    if (detailSubject.current) {
      detailSubject.current.updateWorldMatrix(true, true);
      const inverse = detailSubject.current.matrixWorld.clone().invert();
      detailSubject.current.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh) || !object.geometry) return;
        const geometry = object.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (geometry.boundingBox)
          bounds.union(
            geometry.boundingBox
              .clone()
              .applyMatrix4(inverse.clone().multiply(object.matrixWorld)),
          );
      });
    }
    const center = bounds.isEmpty()
      ? new THREE.Vector3()
      : bounds.getCenter(new THREE.Vector3());
    const radius = bounds.isEmpty()
      ? 2.5
      : bounds.getSize(new THREE.Vector3()).length() / 2;
    const verticalFov =
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(37) / 2) / distanceScale);
    const limitFov = Math.min(
      verticalFov,
      2 * Math.atan(Math.tan(verticalFov / 2) * aspect),
    );
    targetLookAt.current.copy(center).add(INSPECTION_CENTER);
    targetPosition.current
      .copy(targetLookAt.current)
      .addScaledVector(
        direction,
        Math.max(1.7, (radius / Math.sin(limitFov / 2)) * 1.08),
      );
    easing.current = true;
  }, [
    detail?.assembly,
    detail?.rotorIndex,
    detail?.isolate,
    detail?.ringExperiment,
    detail?.spread,
    resetView,
    aspect,
    distanceScale,
    camera,
    detailSubject,
    selected,
    followSignal,
    previewFocus,
  ]);
  useFrame((_, dt) => {
    if (camera instanceof THREE.PerspectiveCamera) {
      projectionOffset.current.lerp(
        new THREE.Vector2(framing.offsetX, framing.offsetY),
        1 - Math.exp(-dt * 8),
      );
      if (props.presentation === "full-stage") {
        camera.setViewOffset(
          size.width,
          size.height,
          projectionOffset.current.x,
          projectionOffset.current.y,
          size.width,
          size.height,
        );
      } else if (camera.view?.enabled) camera.clearViewOffset();
    }
    if (!controls.current) return;
    if (!detail && transition && followSignal && journey.current) {
      const t = THREE.MathUtils.clamp(
        transitionProgressRef?.current ?? 1,
        0,
        1,
      );
      const smooth = t * t * (3 - 2 * t);
      camera.position.lerpVectors(
        journey.current.start.position,
        journey.current.end.position,
        smooth,
      );
      controls.current.target.lerpVectors(
        journey.current.start.target,
        journey.current.end.target,
        smooth,
      );
      controls.current.update();
      return;
    }
    if (!easing.current) return;
    const amount = 1 - Math.exp(-dt * 5);
    camera.position.lerp(targetPosition.current, amount);
    controls.current.target.lerp(targetLookAt.current, amount);
    controls.current.update();
    if (camera.position.distanceToSquared(targetPosition.current) < 0.0001)
      easing.current = false;
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!!detail || !(transition && followSignal)}
      enableDamping={!!detail || !(transition && followSignal)}
      dampingFactor={0.075}
      minDistance={detail ? 1.1 : 3.7}
      maxDistance={(detail ? 32 : 19) * distanceScale}
      maxPolarAngle={Math.PI * (detail ? 0.97 : 0.475)}
      minPolarAngle={0.13}
      onStart={() => {
        easing.current = false;
        userOrbitActive.current = true;
        if (controls.current)
          zoomTracker.start(
            camera.position.distanceTo(controls.current.target),
          );
      }}
      onEnd={() => {
        userOrbitActive.current = false;
        zoomTracker.end();
      }}
      onChange={() => {
        if (
          !controls.current ||
          !userOrbitActive.current ||
          props.presentation !== "full-stage"
        )
          return;
        const subject = detail
          ? detailSubject.current
          : props.wholeMachine.current;
        const bounds =
          subject && projectSubject(subject, camera, size.width, size.height);
        const intent = zoomTracker.change(
          camera.position.distanceTo(controls.current.target),
          bounds
            ? rectangleClearance(
                bounds,
                stagePaneBounds(size.width, size.height),
              )
            : Infinity,
        );
        if (intent !== undefined) userZoomCallback.current?.(intent);
      }}
    />
  );
}

function LabScene(props: MachineSceneProps & { lowPower: boolean }) {
  const wholeMachine = useRef<THREE.Group>(null);
  const studioFloor = useRef<THREE.Mesh>(null);
  const detailSubject = useRef<THREE.Group>(null);
  const detailBlend = useRef(0);
  const blendJourney = useRef({ from: 0, to: 0, elapsed: 0 });
  const fade = useObjectFade();
  const config = useMemo<MachineConfig>(
    () => ({
      rotors: props.rotorIds as MachineConfig["rotors"],
      reflector: (props.reflectorId || "B") as MachineConfig["reflector"],
      positions: props.positions,
      rings: props.rings,
      plugboard: props.plugboard || "",
    }),
    [
      props.rotorIds,
      props.reflectorId,
      props.positions,
      props.rings,
      props.plugboard,
    ],
  );
  const machineProps = props.detail ? { ...props, onSelect: () => {} } : props;
  useFrame((_, dt) => {
    const target = props.detail ? 1 : 0;
    const journey = blendJourney.current;
    if (journey.to !== target) {
      journey.from = detailBlend.current;
      journey.to = target;
      journey.elapsed = 0;
    }
    journey.elapsed = Math.min(0.55, journey.elapsed + dt);
    const t = journey.elapsed / 0.55;
    const eased = 1 - Math.pow(1 - t, 3);
    detailBlend.current = THREE.MathUtils.lerp(journey.from, journey.to, eased);
    if (wholeMachine.current)
      fade(wholeMachine.current, 1 - detailBlend.current, !props.detail);
    if (studioFloor.current)
      fade(studioFloor.current, 1 - detailBlend.current, false);
  });
  return (
    <>
      <color attach="background" args={["#d6ccbb"]} />
      <fog attach="fog" args={["#d6ccbb", 70, 150]} />
      <ambientLight intensity={1.1} color="#fff0d3" />
      <hemisphereLight args={["#fff6e1", "#807661", 1.1]} />
      <directionalLight
        position={[-4, 9, 6]}
        intensity={2.6}
        castShadow
        shadow-mapSize={props.lowPower ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={7}
        shadow-camera-bottom={-6}
        shadow-bias={-0.00035}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[5, 6, -4]} intensity={1.8} color="#fff0d4" />
      <directionalLight position={[0, 3, 7]} intensity={0.7} color="#eee3ca" />
      <group ref={wholeMachine}>
        <HistoricalHousing
          onSelect={machineProps.onSelect}
          exploded={props.exploded}
          revealInterior={
            !!props.rotorCoverRemoved ||
            !!props.inspection ||
            !!props.previewFocus ||
            props.selected === "rotors" ||
            props.selected === "reflector" ||
            (!!props.trace && !!props.followSignal && props.phase >= 0)
          }
        />
        <RotorAssembly {...machineProps} />
        <Lamps {...machineProps} />
        <Keyboard {...machineProps} />
        <Plugboard {...machineProps} />
        <ContactBridges {...machineProps} />
        <TransitionSignal {...machineProps} />
      </group>
      <ComponentInspectionScene
        detail={props.detail || null}
        blend={detailBlend}
        subject={detailSubject}
        config={config}
        exploded={props.exploded}
        boardOffset={plugboardOffset(props)}
        onPartClick={props.onDetailPart}
        language={props.language}
      />

      <mesh
        ref={studioFloor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.006, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#d6ccbb"
          roughness={0.94}
          transparent
          depthWrite={false}
        />
      </mesh>
      <CameraRig
        {...props}
        detailSubject={detailSubject}
        wholeMachine={wholeMachine}
      />
    </>
  );
}

function SceneFallback() {
  return (
    <div
      role="status"
      style={{
        display: "grid",
        placeContent: "center",
        gap: 12,
        height: "100%",
        color: "#655d4b",
        padding: 30,
        textAlign: "center",
      }}
    >
      <b>3D VIEW UNAVAILABLE / 三维视图暂不可用</b>
      <span>请切换至电路剖面；加密与机器设置仍可使用。</span>
      <small>Open the circuit view to continue exploring this machine.</small>
    </div>
  );
}

class SceneBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <SceneFallback /> : this.props.children;
  }
}

export default function MachineScene(props: MachineSceneProps) {
  const lowPower = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        window.innerWidth < 640),
    [],
  );
  return (
    <SceneBoundary>
      <Canvas
        shadows
        camera={{ position: [7.0, 8.6, 8.8], fov: 37, near: 0.1, far: 160 }}
        dpr={lowPower ? [1, 1.15] : [1, 1.75]}
        gl={{
          antialias: !lowPower,
          powerPreference: lowPower ? "default" : "high-performance",
        }}
        fallback={<SceneFallback />}
        style={{ touchAction: "none" }}
      >
        <Suspense fallback={null}>
          <LabScene {...props} lowPower={lowPower} />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
