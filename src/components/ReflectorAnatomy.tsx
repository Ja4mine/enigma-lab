import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { ALPHABET, REFLECTORS, type ReflectorId } from "../core/enigma";
import { VintageMaterial } from "./VintageMaterials";

export type ReflectorAnatomyPart = "cover" | "core" | "contacts" | "fasteners";
export interface ReflectorAnatomyProps {
  reflectorId: ReflectorId;
  /** Zero assembles the part; one separates cover, winding frame and contacts. */
  spread?: number;
  isolate?: string;
  showWiring?: boolean;
  /** Fixed reflector terminal A=0…Z=25. Both ends of its unique pair light up. */
  highlightContact?: number;
  onPartClick?: (id: string) => void;
}

const STEP = (Math.PI * 2) / 26;
const CONTACT_RADIUS = 0.91;
const BRASS = "#baa16a";
const STEEL = "#aaa993";
const BAKELITE = "#303329";
const SIGNAL = "#f0bd66";
type Point3 = [number, number, number];

function contact(index: number, x: number, radius = CONTACT_RADIUS): Point3 {
  const theta = Math.PI / 2 + index * STEP;
  return [x, Math.sin(theta) * radius, Math.cos(theta) * radius];
}

/** Bevelled annuli keep the window into the wires genuinely open. */
function Annulus({
  x,
  outer,
  inner,
  thickness,
  color = BRASS,
  surface = "brass",
}: {
  x: number;
  outer: number;
  inner: number;
  thickness: number;
  color?: string;
  surface?: "brass" | "bakelite" | "steel";
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const bevel = Math.min(0.009, thickness * 0.18);
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: thickness - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 80,
    });
    result.translate(0, 0, -(thickness - bevel * 2) / 2);
    result.rotateY(Math.PI / 2);
    return result;
  }, [outer, inner, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={[x, 0, 0]} geometry={geometry} castShadow receiveShadow>
      <VintageMaterial
        surface={surface}
        color={color}
        metalness={surface === "bakelite" ? 0.08 : 0.76}
        roughness={surface === "bakelite" ? 0.58 : 0.4}
      />
    </mesh>
  );
}

function AxialPin({
  position,
  radius,
  length,
  color = BRASS,
}: {
  position: Point3;
  radius: number;
  length: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[radius, radius, length, 28]} />
      <VintageMaterial
        surface={color === STEEL ? "steel" : "brass"}
        color={color}
        metalness={0.82}
        roughness={0.32}
      />
    </mesh>
  );
}

function SlottedScrew({
  position,
  radius = 0.046,
}: {
  position: Point3;
  radius?: number;
}) {
  return (
    <group position={position}>
      <AxialPin
        position={[0, 0, 0]}
        radius={radius * 1.33}
        length={0.014}
        color="#7e795e"
      />
      <AxialPin
        position={[0.017, 0, 0]}
        radius={radius}
        length={0.031}
        color={STEEL}
      />
      <mesh position={[0.034, 0, 0]}>
        <boxGeometry args={[0.007, 0.012, radius * 1.4]} />
        <meshStandardMaterial color="#3d4034" roughness={0.7} />
      </mesh>
    </group>
  );
}

function PrintedMark({
  text,
  position,
  width,
  height,
  color = "#e2d6b5",
}: {
  text: string;
  position: Point3;
  width: number;
  height: number;
  color?: string;
}) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '600 75px "Courier New", monospace';
    ctx.fillText(text, 256, 67, 488);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    return result;
  }, [text, color]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={position} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

function letterAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e4d7b4";
  ctx.font = '700 86px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 26; i++)
    ctx.fillText(
      ALPHABET[i],
      (i % 16) * 128 + 64,
      Math.floor(i / 16) * 128 + 66,
    );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function ContactLetter({
  index,
  x,
  atlas,
  active,
}: {
  index: number;
  x: number;
  atlas: THREE.CanvasTexture;
  active: boolean;
}) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(0.137, 0.143),
      uv = plane.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        ((index % 16) + uv.getX(i)) / 16,
        1 - (Math.floor(index / 16) + 1 - uv.getY(i)) / 2,
      );
    return plane;
  }, [index]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      position={contact(index, x, 1.09)}
      rotation={[0, Math.PI / 2, 0]}
      geometry={geometry}
    >
      <meshBasicMaterial
        map={atlas}
        color={active ? "#ffd48c" : "#ffffff"}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        toneMapped={false}
      />
    </mesh>
  );
}

/** These are real electrical pairs; the tidy depth lanes are a teaching layout. */
function PairWire({
  from,
  to,
  rank,
  plateX,
  spread,
  active,
  dim,
}: {
  from: number;
  to: number;
  rank: number;
  plateX: number;
  spread: number;
  active: boolean;
  dim: boolean;
}) {
  const geometry = useMemo(() => {
    const a = Math.PI / 2 + from * STEP,
      b = Math.PI / 2 + to * STEP;
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const laneX = 0.08 - rank * 0.027 - spread * 0.31;
    const radius = 0.46 + (rank % 5) * 0.043;
    const at = (angle: number, x: number, r: number) =>
      new THREE.Vector3(x, Math.sin(angle) * r, Math.cos(angle) * r);
    const points = [
      new THREE.Vector3(...contact(from, plateX - 0.105)),
      at(a, plateX - 0.19, 0.78),
      at(a, laneX, radius),
    ];
    for (let j = 1; j < 9; j++)
      points.push(
        at(
          a + (delta * j) / 9,
          laneX - 0.035 * Math.sin((Math.PI * j) / 9),
          radius,
        ),
      );
    points.push(
      at(a + delta, laneX, radius),
      at(b, plateX - 0.19, 0.78),
      new THREE.Vector3(...contact(to, plateX - 0.105)),
    );
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      92,
      active ? 0.025 : 0.014,
      8,
      false,
    );
  }, [from, to, rank, plateX, spread, active]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow={!active} renderOrder={active ? 2 : 0}>
      <meshStandardMaterial
        key={active ? "highlighted" : dim ? "muted" : "all-wires"}
        color={
          active
            ? SIGNAL
            : rank % 3 === 0
              ? "#a3936c"
              : rank % 3 === 1
                ? "#a4754a"
                : "#727962"
        }
        metalness={active ? 0.3 : 0.54}
        roughness={0.5}
        emissive={active ? SIGNAL : "#000000"}
        emissiveIntensity={active ? 0.68 : 0}
        transparent={dim}
        opacity={dim ? 0.34 : 1}
        depthWrite={!dim}
      />
    </mesh>
  );
}

export function ReflectorAnatomy({
  reflectorId,
  spread = 0.35,
  isolate = "all",
  showWiring = true,
  highlightContact,
  onPartClick,
}: ReflectorAnatomyProps) {
  const separation = THREE.MathUtils.clamp(spread, 0, 1);
  const plateX = 0.46 + separation * 0.73;
  const backX = -0.48 - separation * 0.82 - (showWiring ? 0.15 : 0);
  const rearFrameX = -0.26 - separation * 0.26;
  const definition = REFLECTORS[reflectorId];
  const pairs = useMemo(
    () =>
      definition.contacts.flatMap((to, from) =>
        from < to ? [{ from, to }] : [],
      ),
    [definition],
  );
  const selected =
    Number.isInteger(highlightContact) &&
    highlightContact! >= 0 &&
    highlightContact! < 26
      ? highlightContact
      : undefined;
  const pairEnd =
    selected === undefined ? undefined : definition.contacts[selected];
  const atlas = useMemo(letterAtlas, []);
  useEffect(() => () => atlas.dispose(), [atlas]);
  const shown = (part: ReflectorAnatomyPart) =>
    isolate === "all" || isolate === part;
  const choose =
    (part: ReflectorAnatomyPart) => (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onPartClick?.(part);
    };
  return (
    <group>
      {shown("cover") && (
        <group onClick={choose("cover")}>
          <Annulus
            x={backX}
            outer={1.175}
            inner={0.13}
            thickness={0.095}
            color="#a18c5f"
          />
          <Annulus
            x={backX + 0.039}
            outer={1.205}
            inner={1.154}
            thickness={0.052}
            color="#b8a171"
          />
          {[0.85, 0.88].map((radius) => (
            <mesh
              key={radius}
              position={[backX + 0.051, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <torusGeometry args={[radius, 0.007, 5, 100]} />
              <meshStandardMaterial
                color="#655e46"
                metalness={0.63}
                roughness={0.49}
              />
            </mesh>
          ))}
          <Annulus
            x={backX + 0.073}
            outer={0.22}
            inner={0.13}
            thickness={0.075}
            color={STEEL}
            surface="steel"
          />
          <PrintedMark
            text={`UKW ${reflectorId}`}
            position={[backX + 0.052, 0.35, 0]}
            width={0.59}
            height={0.16}
            color="#423d2e"
          />
          <PrintedMark
            text="UMKEHRWALZE"
            position={[backX + 0.053, -0.32, 0]}
            width={0.86}
            height={0.12}
            color="#544d37"
          />
          <PrintedMark
            text="26 / 13"
            position={[backX + 0.054, -0.48, 0]}
            width={0.46}
            height={0.105}
            color="#5b533e"
          />
        </group>
      )}

      {shown("core") && (
        <group onClick={choose("core")}>
          <Annulus
            x={rearFrameX}
            outer={0.83}
            inner={0.73}
            thickness={0.055}
            color="#777258"
          />
          <Annulus
            x={0.25 + separation * 0.16}
            outer={0.83}
            inner={0.765}
            thickness={0.035}
            color="#9e8e60"
          />
          {[0, 1, 2].map((index) => {
            // Place each support between terminal spokes, clear of the radial
            // lead-in wires even with the cover fully assembled.
            const theta = Math.PI / 2 + [0.5, 9.5, 17.5][index] * STEP;
            const x0 = rearFrameX,
              x1 = 0.25 + separation * 0.16;
            return (
              <group key={index}>
                <AxialPin
                  position={[
                    (x0 + x1) / 2,
                    Math.sin(theta) * 0.8,
                    Math.cos(theta) * 0.8,
                  ]}
                  radius={0.032}
                  length={x1 - x0}
                  color={STEEL}
                />
                <SlottedScrew
                  position={[
                    x1 + 0.029,
                    Math.sin(theta) * 0.8,
                    Math.cos(theta) * 0.8,
                  ]}
                  radius={0.029}
                />
              </group>
            );
          })}
          <AxialPin
            position={[rearFrameX - 0.04, 0, 0]}
            radius={0.086}
            length={0.21}
            color={STEEL}
          />
          {showWiring &&
            pairs.map(({ from, to }, rank) => (
              <PairWire
                key={`${reflectorId}-${from}`}
                from={from}
                to={to}
                rank={rank}
                plateX={plateX}
                spread={separation}
                active={selected === from || selected === to}
                dim={
                  selected !== undefined && selected !== from && selected !== to
                }
              />
            ))}
        </group>
      )}

      {shown("contacts") && (
        <group onClick={choose("contacts")}>
          {/* Open inner diameter shows the wires without a transparent full plate. */}
          <Annulus
            x={plateX}
            outer={1.19}
            inner={showWiring ? 0.815 : 0.13}
            thickness={0.11}
            color={BAKELITE}
            surface="bakelite"
          />
          <Annulus
            x={plateX + 0.015}
            outer={1.225}
            inner={1.188}
            thickness={0.09}
          />
          <Annulus
            x={plateX + 0.059}
            outer={1.008}
            inner={0.991}
            thickness={0.014}
            color="#968355"
          />
          {Array.from({ length: 26 }, (_, index) => {
            const active = index === selected || index === pairEnd;
            return (
              <group key={index}>
                <AxialPin
                  position={contact(index, plateX)}
                  radius={0.064}
                  length={0.146}
                  color="#71674b"
                />
                <mesh
                  position={contact(index, plateX + 0.077)}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.043, 0.048, 0.048, 24]} />
                  <meshStandardMaterial
                    color={active ? SIGNAL : "#d4bc7e"}
                    metalness={0.84}
                    roughness={0.27}
                    emissive={active ? SIGNAL : "#000000"}
                    emissiveIntensity={active ? 0.65 : 0}
                  />
                </mesh>
                <AxialPin
                  position={contact(index, plateX - 0.09)}
                  radius={0.031}
                  length={0.039}
                  color="#b5955d"
                />
                <ContactLetter
                  index={index}
                  x={plateX + 0.061}
                  atlas={atlas}
                  active={active}
                />
              </group>
            );
          })}
          <mesh position={[plateX + 0.077, 1.247, 0]}>
            <boxGeometry args={[0.027, 0.11, 0.48]} />
            <VintageMaterial
              surface="brass"
              color="#bba979"
              metalness={0.64}
              roughness={0.46}
            />
          </mesh>
          <PrintedMark
            text={`UKW ${reflectorId}`}
            position={[plateX + 0.095, 1.25, 0]}
            width={0.39}
            height={0.093}
            color="#3e3d2f"
          />
        </group>
      )}

      {shown("fasteners") && (
        <group onClick={choose("fasteners")}>
          {[0, 1, 2].map((index) => {
            const theta = Math.PI / 2 + [4.5, 13.5, 22.5][index] * STEP;
            const y = Math.sin(theta) * 1.133,
              z = Math.cos(theta) * 1.133;
            const front = plateX + 0.107 + separation * 0.25;
            return (
              <group key={index}>
                <SlottedScrew position={[front, y, z]} />
                <AxialPin
                  position={[front - 0.125, y, z]}
                  radius={0.022}
                  length={0.235}
                  color={STEEL}
                />
                <SlottedScrew position={[backX + 0.068, y, z]} radius={0.039} />
              </group>
            );
          })}
          <AxialPin
            position={[backX - 0.135, 0, 0]}
            radius={0.105}
            length={0.21}
            color={STEEL}
          />
          <Annulus
            x={backX - 0.24}
            outer={0.154}
            inner={0.105}
            thickness={0.028}
            color="#8f8f7c"
            surface="steel"
          />
        </group>
      )}
    </group>
  );
}
