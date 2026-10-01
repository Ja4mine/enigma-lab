import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { VintageMaterial } from "./VintageMaterials";
import { mechanicalStrokePose } from "../core/mechanical-motion";

export type DrivePartId =
  "all" | "ratchets" | "pawls" | "springs" | "linkage" | "frame";

export interface DriveMechanismProps {
  /** 0 = assembled, 1 = the shaft, drive layers and frame separated. */
  spread: number;
  /** One deterministic teaching stroke. No local animation clock is used. */
  progress: number;
  stepped: [boolean, boolean, boolean];
  /** Window positions at the beginning of the demonstrated stroke. */
  positions: [number, number, number];
  rotorIds: [string, string, string];
  isolate?: DrivePartId;
  onPartClick?: (id: DrivePartId) => void;
}

const STEP = (Math.PI * 2) / 26;
const GOLD = "#b09a5d";
const STEEL = "#899086";
const DARK = "#303c32";
const COPPER = "#8c6842";

type Point3 = [number, number, number];

function Fastener({
  position,
  rotation = [0, 0, Math.PI / 2],
  radius = 0.055,
}: {
  position: Point3;
  rotation?: Point3;
  radius?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[radius * 1.35, radius * 1.35, 0.016, 24]} />
        <meshStandardMaterial
          color="#5f655c"
          metalness={0.78}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 0.019, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.036, 6]} />
        <meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[radius * 1.4, 0.006, 0.015]} />
        <meshStandardMaterial color="#363b32" roughness={0.65} />
      </mesh>
    </group>
  );
}

function AxialDisc({
  x,
  radius,
  thickness,
  color = GOLD,
  hole = 0,
}: {
  x: number;
  radius: number;
  thickness: number;
  color?: string;
  hole?: number;
}) {
  if (hole)
    return (
      <mesh position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <ringGeometry args={[hole, radius, 48]} />
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          metalness={0.77}
          roughness={0.45}
        />
      </mesh>
    );
  return (
    <mesh position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[radius, radius, thickness, 48]} />
      <meshStandardMaterial color={color} metalness={0.77} roughness={0.45} />
    </mesh>
  );
}

function Link({
  start,
  end,
  radius = 0.04,
  color = STEEL,
}: {
  start: Point3;
  end: Point3;
  radius?: number;
  color?: string;
}) {
  const a = new THREE.Vector3(...start),
    b = new THREE.Vector3(...end);
  const delta = b.clone().sub(a);
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  return (
    <mesh
      position={a.add(b).multiplyScalar(0.5)}
      quaternion={rotation}
      scale={[1, delta.length(), 1]}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, 1, 16]} />
      <meshStandardMaterial color={color} metalness={0.79} roughness={0.36} />
    </mesh>
  );
}

function ReturnSpring({ start, end }: { start: Point3; end: Point3 }) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
    for (let i = 0; i <= 180; i++) {
      const t = i / 180,
        angle = t * 10 * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(angle) * 0.075,
          0.1 + 0.8 * t,
          Math.cos(angle) * 0.075,
        ),
      );
    }
    points.push(new THREE.Vector3(0, 1, 0));
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      230,
      0.012,
      6,
      false,
    );
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const delta = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  return (
    <mesh
      geometry={geometry}
      position={start}
      quaternion={rotation}
      scale={[1, delta.length(), 1]}
      castShadow
    >
      <meshStandardMaterial color="#b8b5a1" metalness={0.91} roughness={0.28} />
    </mesh>
  );
}

/** Asymmetric 26-tooth profile: a shallow ramp and a steep driving face. */
function Ratchet({
  angle,
  x,
  rotorId,
}: {
  angle: number;
  x: number;
  rotorId: string;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let tooth = 0; tooth < 26; tooth++) {
      const base = tooth * STEP;
      const samples = [
        [base, 0.575],
        [base + STEP * 0.76, 0.66],
        [base + STEP * 0.86, 0.662],
        [base + STEP * 0.96, 0.575],
      ];
      for (const [theta, r] of samples) {
        const y = Math.cos(theta) * r,
          z = Math.sin(theta) * r;
        if (tooth === 0 && theta === base) shape.moveTo(y, z);
        else shape.lineTo(y, z);
      }
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.108, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 48,
    });
    result.translate(0, 0, -0.0425);
    result.rotateY(Math.PI / 2);
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#d4c293";
    ctx.font = 'bold 62px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rotorId, 128, 64);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [rotorId]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[x, 1.46, -0.27]} rotation={[angle, 0, 0]}>
      <mesh geometry={geometry} castShadow>
        <VintageMaterial
          surface="brass"
          color={GOLD}
          metalness={0.74}
          roughness={0.42}
        />
      </mesh>
      <AxialDisc x={-0.065} radius={0.5} thickness={0.022} color="#7b805f" />
      <AxialDisc x={0.072} radius={0.153} thickness={0.072} />
      <AxialDisc x={-0.098} radius={0.145} thickness={0.028} color={STEEL} />
      {[0, 1, 2].map((i) => {
        const a = (i * Math.PI * 2) / 3;
        return (
          <Fastener
            key={i}
            position={[0.063, Math.cos(a) * 0.335, Math.sin(a) * 0.335]}
            radius={0.035}
          />
        );
      })}
      <mesh position={[0.071, 0.32, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.29, 0.145]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0.051, 0.542, 0]}>
        <boxGeometry args={[0.017, 0.083, 0.035]} />
        <meshStandardMaterial
          color="#dfd3aa"
          metalness={0.36}
          roughness={0.65}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return (
          <mesh
            key={i}
            position={[0.049, Math.cos(a) * 0.24, Math.sin(a) * 0.24]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.027, 0.027, 0.013, 12]} />
            <meshStandardMaterial
              color="#5d604a"
              roughness={0.66}
              metalness={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Pawl({
  x,
  lift,
  enabled,
  stroke,
  showArm,
  showSpring,
  onPartClick,
}: {
  x: number;
  lift: number;
  enabled: boolean;
  stroke: number;
  showArm: boolean;
  showSpring: boolean;
  onPartClick?: (id: DrivePartId) => void;
}) {
  // The pawl is an instructional articulated arm, not a rigid-body simulation.
  const angle = -0.11 - stroke * 0.095 + (enabled ? 0 : 0.2);
  const springAnchor: Point3 = [x, 0.44, 1.08];
  const springEnd: Point3 = [
    x,
    0.75 + lift + Math.sin(angle) * 0.42,
    0.55 + Math.cos(angle) * 0.3,
  ];
  return (
    <group>
      {showArm && (
        <group
          position={[x, 0.75 + lift, 0.55]}
          rotation={[angle, 0, 0]}
          onClick={(event) => {
            event.stopPropagation();
            onPartClick?.("pawls");
          }}
        >
          <mesh position={[0, 0.31, -0.15]} rotation={[-0.49, 0, 0]} castShadow>
            <boxGeometry args={[0.082, 0.75, 0.095]} />
            <VintageMaterial
              surface="brass"
              color={enabled ? GOLD : STEEL}
              metalness={0.76}
              roughness={0.43}
            />
          </mesh>
          <mesh position={[0, 0.66, -0.073]} rotation={[0.17, 0, 0]} castShadow>
            <boxGeometry args={[0.1, 0.115, 0.19]} />
            <VintageMaterial
              surface="brass"
              color="#d0b873"
              metalness={0.83}
              roughness={0.37}
            />
          </mesh>
          <mesh
            position={[0, 0.67, -0.1]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.063, 0.063, 0.105, 3]} />
            <meshStandardMaterial
              color="#82724a"
              metalness={0.78}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.115, 0.115, 0.12, 28]} />
            <meshStandardMaterial
              color={STEEL}
              metalness={0.79}
              roughness={0.36}
            />
          </mesh>
          <Fastener position={[0.077, 0, 0]} />
          <Link start={[0, -0.02, 0]} end={[0, -0.14, 0.28]} radius={0.028} />
        </group>
      )}
      {showSpring && (
        <group
          onClick={(event) => {
            event.stopPropagation();
            onPartClick?.("springs");
          }}
        >
          <ReturnSpring start={springAnchor} end={springEnd} />
          <mesh
            position={springAnchor}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <torusGeometry args={[0.049, 0.014, 8, 18]} />
            <meshStandardMaterial
              color={STEEL}
              metalness={0.84}
              roughness={0.35}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** A precise 1/26-turn teaching linkage; progress alone defines its pose. */
export function DriveMechanism({
  spread,
  progress,
  stepped,
  positions,
  rotorIds,
  isolate = "all",
  onPartClick,
}: DriveMechanismProps) {
  const show = (id: DrivePartId) => isolate === "all" || isolate === id;
  const select = (id: DrivePartId) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onPartClick?.(id);
  };
  const open = THREE.MathUtils.clamp(spread, 0, 1);
  const pose = mechanicalStrokePose(positions, stepped, progress);
  const drive = pose.advance;
  const recovery = pose.recovery;
  const stroke = pose.rocker;
  const lift = open * 0.8;
  const shaftY = 1.46 + open * 0.98;
  const wheelXs = [-1.25, 0, 1.25].map((x, i) => x + (i - 1) * open * 0.44);
  const lever: Point3 = [-2.35, 0.58 + stroke * 0.16, 1.12 - stroke * 0.16];
  const crossbar: Point3 = [-2.1, 0.75 + lift, 0.55];
  return (
    <group position={[0, -1.22, 0]}>
      {show("frame") && (
        <group onClick={select("frame")}>
          <mesh position={[0, 0.23, 0.27]} castShadow receiveShadow>
            <boxGeometry args={[5.42, 0.22, 2.08]} />
            <VintageMaterial
              surface="enamel"
              color={DARK}
              metalness={0.48}
              roughness={0.64}
            />
          </mesh>
          <mesh position={[0, 0.105, 0.27]} castShadow>
            <boxGeometry args={[5.6, 0.09, 2.2]} />
            <VintageMaterial
              surface="brass"
              color="#796546"
              metalness={0.57}
              roughness={0.61}
            />
          </mesh>
          {[-2.43, 2.43].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.75, -0.27]} castShadow>
                <boxGeometry args={[0.15, 1.03, 0.53]} />
                <meshStandardMaterial
                  color="#68715a"
                  metalness={0.56}
                  roughness={0.57}
                />
              </mesh>
              <mesh
                position={[x, 1.4, -0.27]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[0.252, 0.252, 0.23, 40]} />
                <VintageMaterial
                  surface="brass"
                  color={GOLD}
                  metalness={0.74}
                  roughness={0.42}
                />
              </mesh>
              <mesh position={[x, 1.4, -0.27]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.183, 0.04, 10, 36]} />
                <meshStandardMaterial
                  color="#41483c"
                  metalness={0.62}
                  roughness={0.55}
                />
              </mesh>
              <Fastener
                position={[x, 0.385, 0.87]}
                rotation={[0, 0, 0]}
                radius={0.069}
              />
              <Fastener
                position={[x, 0.385, -0.42]}
                rotation={[0, 0, 0]}
                radius={0.069}
              />
            </group>
          ))}
        </group>
      )}
      {show("ratchets") && (
        <group position={[0, open * 0.98, 0]} onClick={select("ratchets")}>
          <mesh
            position={[0, 1.46, -0.27]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.091, 0.091, 5.49, 32]} />
            <meshStandardMaterial
              color="#adb09b"
              metalness={0.86}
              roughness={0.29}
            />
          </mesh>
          {wheelXs.map((x, i) => (
            <Ratchet
              key={i}
              x={x}
              angle={pose.rotorAngles[i]}
              rotorId={rotorIds[i]}
            />
          ))}
          {[-2.63, 2.63].map((x) => (
            <group key={x} position={[0, 1.46, -0.27]}>
              <AxialDisc x={x} radius={0.153} thickness={0.045} />
              <Fastener
                position={[x + (x > 0 ? 0.04 : -0.04), 0, 0]}
                radius={0.075}
              />
            </group>
          ))}
        </group>
      )}
      <group rotation={[stroke * 0.08, 0, 0]}>
        {show("linkage") && (
          <mesh
            onClick={select("linkage")}
            position={[0, 0.75 + lift, 0.55]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.075, 0.075, 4.45 + open * 0.8, 32]} />
            <meshStandardMaterial
              color="#a1a894"
              metalness={0.83}
              roughness={0.33}
            />
          </mesh>
        )}
        {wheelXs.map((x, i) => (
          <Pawl
            key={i}
            x={x}
            lift={lift}
            enabled={stepped[i]}
            stroke={drive - recovery}
            showArm={show("pawls")}
            showSpring={show("springs")}
            onPartClick={onPartClick}
          />
        ))}
      </group>
      {show("linkage") && (
        <group onClick={select("linkage")}>
          <Link start={lever} end={crossbar} radius={0.048} color={GOLD} />
          <Link start={[-2.35, 0.48, 1.25]} end={lever} radius={0.065} />
          <mesh
            position={[-2.35, 0.48, 1.27]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.13, 0.13, 0.27, 28]} />
            <VintageMaterial
              surface="bakelite"
              color="#242f27"
              roughness={0.45}
              metalness={0.1}
            />
          </mesh>
          <Fastener position={[-2.18, 0.48, 1.27]} radius={0.065} />
        </group>
      )}
      {show("frame") && (
        <group onClick={select("frame")}>
          <mesh position={[0, 0.425, -0.66]} castShadow>
            <boxGeometry args={[4.67, 0.13, 0.12]} />
            <VintageMaterial
              surface="brass"
              color={COPPER}
              metalness={0.68}
              roughness={0.54}
            />
          </mesh>
          {open > 0.04 &&
            [-2.43, 2.43].map((x) => (
              <mesh
                key={`guide-${x}`}
                position={[x, (1.46 + shaftY) / 2, -0.27]}
              >
                <cylinderGeometry args={[0.009, 0.009, open * 0.98, 6]} />
                <meshBasicMaterial color="#b5a579" transparent opacity={0.35} />
              </mesh>
            ))}
        </group>
      )}
    </group>
  );
}

export const DRIVE_PARTS = {
  zh: [
    "26 齿非对称棘轮",
    "三枚可选择接合的棘爪",
    "公共摆架与输入连杆",
    "螺旋回位弹簧",
    "轴承、垫圈与六角紧固件",
  ],
  en: [
    "26-tooth asymmetric ratchets",
    "Three selectively engaged pawls",
    "Common rocking frame and input linkage",
    "Helical return springs",
    "Bearings, washers and hex fasteners",
  ],
};
