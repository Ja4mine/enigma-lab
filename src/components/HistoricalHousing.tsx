import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  DECK,
  ROTOR_WELL,
  ROTOR_AXIS,
  ROTOR_CENTERS,
  HOOD,
  HOOD_SLOT,
  HOOD_WINDOW,
  HOOD_FRONT,
  hoodHoles,
  deckHoles,
  createHorizontalPanelGeometry,
} from "../core/housing-layout";
import { VintageMaterial, useVintageMaps } from "./VintageMaterials";

export interface HistoricalHousingProps {
  revealInterior: boolean;
  exploded?: boolean;
  onSelect: (part: "machine" | "rotors", rotorIndex?: 0 | 1 | 2) => void;
}
export type HousingPart =
  "wood" | "chassis" | "cover" | "lid" | "hinges" | "fasteners";
export interface HousingAnatomyProps {
  spread: number;
  isolate?: string;
  onPartClick?: (id: string) => void;
}
type Point3 = [number, number, number];
type PanelHoles = Parameters<typeof createHorizontalPanelGeometry>[3];
type Visibility = { value: number };
const ENAMEL = "#30352a",
  BRASS = "#a99059",
  STEEL = "#a0a18e";

function PhysicalMark({
  text,
  position,
  rotation = [0, 0, 0],
  width = 1,
  height = 0.2,
  color = "#d1c29a",
}: {
  text: string;
  position: Point3;
  rotation?: Point3;
  width?: number;
  height?: number;
  color?: string;
}) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = '600 116px "Courier New", monospace';
    ctx.fillText(text, 512, 99, 988);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [text, color]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={position} rotation={rotation}>
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

function HardwareScrew({
  position,
  rotation = [0, 0, 0],
  radius = 0.041,
  raised = 0,
}: {
  position: Point3;
  rotation?: Point3;
  radius?: number;
  raised?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, raised, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.32, radius * 1.32, 0.012, 24]} />
        <VintageMaterial
          surface="brass"
          color="#807654"
          metalness={0.72}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, raised + 0.02, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.034, 24]} />
        <VintageMaterial
          surface="steel"
          color={STEEL}
          metalness={0.79}
          roughness={0.39}
        />
      </mesh>
      <mesh position={[0, raised + 0.038, 0]}>
        <boxGeometry args={[radius * 1.38, 0.005, 0.011]} />
        <meshStandardMaterial color="#3c3d30" roughness={0.7} />
      </mesh>
      {raised > 0 && (
        <mesh position={[0, raised - 0.095, 0]}>
          <cylinderGeometry args={[radius * 0.48, radius * 0.48, 0.19, 16]} />
          <VintageMaterial
            surface="steel"
            color="#8e9080"
            metalness={0.78}
            roughness={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

function CastBox({
  args,
  position,
  color = ENAMEL,
  radius = 0.012,
  rotation = [0, 0, 0],
}: {
  args: Point3;
  position: Point3;
  color?: string;
  radius?: number;
  rotation?: Point3;
}) {
  return (
    <RoundedBox
      args={args}
      radius={radius}
      smoothness={2}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <VintageMaterial
        surface={color === BRASS ? "brass" : "enamel"}
        color={color}
        metalness={color === BRASS ? 0.68 : 0.34}
        roughness={0.61}
      />
    </RoundedBox>
  );
}

function OpenPanel({
  width,
  depth,
  thickness,
  holes,
  position,
  color = ENAMEL,
  visibility,
  onClick,
}: {
  width: number;
  depth: number;
  thickness: number;
  holes: PanelHoles;
  position: Point3;
  color?: string;
  visibility?: Visibility;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const geometry = useMemo(
    () => createHorizontalPanelGeometry(width, depth, thickness, holes),
    [width, depth, thickness, holes],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      castShadow
      receiveShadow
      onClick={onClick}
    >
      {visibility ? (
        <HoodMaterial visibility={visibility} color={color} />
      ) : (
        <VintageMaterial
          surface={color === BRASS ? "brass" : "enamel"}
          color={color}
          metalness={color === BRASS ? 0.68 : 0.36}
          roughness={0.58}
        />
      )}
    </mesh>
  );
}

/** This uniform composes with the whole-scene opacity fade instead of owning it. */
function HoodMaterial({
  visibility,
  color = ENAMEL,
}: {
  visibility: Visibility;
  color?: string;
}) {
  return (
    <VintageMaterial
      surface={color === BRASS ? "brass" : "enamel"}
      color={color}
      metalness={color === BRASS ? 0.66 : 0.36}
      roughness={0.58}
      alphaHash
      onBeforeCompile={(shader) => {
        shader.uniforms.housingExposure = visibility;
        shader.fragmentShader =
          "uniform float housingExposure;\n" +
          shader.fragmentShader.replace(
            "#include <alphahash_fragment>",
            "diffuseColor.a *= housingExposure;\n#include <alphahash_fragment>",
          );
      }}
      customProgramCacheKey={() => "historical-hood-exposure-v1"}
    />
  );
}

function WoodenCase({ spread = 0 }: { spread?: number }) {
  const wood = useVintageMaps("wood");
  return (
    <group>
      <RoundedBox
        args={[6.45, 0.28, 5.24]}
        radius={0.048}
        smoothness={3}
        position={[0, 0.29 - spread * 0.72, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...wood} color="#c1a17b" roughness={0.69} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox
            args={[0.2, 0.92, 5.08]}
            radius={0.025}
            smoothness={3}
            position={[side * (3.135 + spread * 0.42), 0.81, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...wood} color="#bea07b" roughness={0.7} />
          </RoundedBox>
          <RoundedBox
            args={[0.25, 0.78, 0.17]}
            radius={0.021}
            position={[
              side * (2.91 + spread * 0.42),
              0.81,
              2.47 + spread * 0.42,
            ]}
            castShadow
          >
            <meshStandardMaterial {...wood} color="#b99b73" roughness={0.75} />
          </RoundedBox>
          <mesh position={[side * (3.135 + spread * 0.42), 1.278, 0]}>
            <boxGeometry args={[0.2, 0.016, 5.08]} />
            <meshStandardMaterial {...wood} color="#b6976d" roughness={0.8} />
          </mesh>
          {[-1.98, 1.98].map((z) => (
            <RoundedBox
              key={z}
              args={[0.42, 0.14, 0.45]}
              radius={0.048}
              position={[side * 2.73, 0.09 - spread * 0.72, z]}
              castShadow
            >
              <VintageMaterial
                surface="bakelite"
                color="#24291f"
                roughness={0.83}
                metalness={0.06}
              />
            </RoundedBox>
          ))}
          {/* Dark end-grain joints are physical seams, not decorative handles. */}
          {[-2.37, 2.37].map((z) => (
            <mesh key={z} position={[side * (3.238 + spread * 0.42), 0.78, z]}>
              <boxGeometry args={[0.006, 0.69, 0.018]} />
              <meshStandardMaterial color="#554029" roughness={0.92} />
            </mesh>
          ))}
        </group>
      ))}
      <RoundedBox
        args={[6.13, 0.77, 0.17]}
        radius={0.025}
        position={[0, 0.815, -2.43 - spread * 0.42]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...wood} color="#b49670" roughness={0.73} />
      </RoundedBox>
      {/* Low front sill leaves the independent plugboard unobstructed. */}
      <RoundedBox
        args={[6.13, 0.16, 0.16]}
        radius={0.022}
        position={[0, 0.46, 2.47 + spread * 0.42]}
        castShadow
      >
        <meshStandardMaterial {...wood} color="#b99b72" roughness={0.74} />
      </RoundedBox>
    </group>
  );
}

function MetalTray({ spread = 0 }: { spread?: number }) {
  const baseY = spread * 0.22;
  const noHoles = useMemo<PanelHoles>(() => [], []);
  return (
    <group position={[0, baseY, 0]}>
      {/* Formed tray: bottom sheet and narrow vertical returns, no solid block. */}
      <OpenPanel
        width={5.98}
        depth={4.78}
        thickness={0.06}
        holes={noHoles}
        position={[0, 0.47, 0]}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <CastBox
            args={[0.055, 0.66, 4.73]}
            position={[side * 2.98, 0.85, 0]}
          />
          <CastBox
            args={[0.13, 0.035, 4.73]}
            position={[side * 2.925, 1.166, 0]}
            color="#454839"
          />
          <CastBox
            args={[0.15, 0.07, 4.65]}
            position={[side * 2.86, 0.565, 0]}
          />
        </group>
      ))}
      <CastBox args={[5.93, 0.66, 0.055]} position={[0, 0.85, -2.39]} />
      <CastBox
        args={[5.8, 0.045, 0.13]}
        position={[0, 1.16, -2.32]}
        color="#454839"
      />
      {/* The rotor bearing feet land on this raised well floor at exactly Y=.75. */}
      <OpenPanel
        width={ROTOR_WELL.width}
        depth={ROTOR_WELL.depth}
        thickness={0.06}
        holes={noHoles}
        position={[ROTOR_WELL.x, 0.69, ROTOR_WELL.z]}
        color="#414534"
      />
      {[-2.29, 2.03].map((x) => (
        <CastBox
          key={x}
          args={[0.21, 0.17, 1.32]}
          position={[x, 0.605, -1.59]}
          color="#515343"
        />
      ))}
      <CastBox args={[5.91, 0.065, 0.09]} position={[0, 0.6, 2.345]} />
    </group>
  );
}

function DeckPlate({ lift = 0 }: { lift?: number }) {
  return (
    <group position={[0, lift, 0]}>
      <OpenPanel
        width={DECK.width}
        depth={DECK.depth}
        thickness={DECK.thickness}
        holes={deckHoles}
        position={[0, DECK.bottom, 0]}
      />
      {/* Thin underside rails support panels without filling any installation bay. */}
      {[-0.8, 0.54].map((z) => (
        <CastBox
          key={z}
          args={[5.77, 0.058, 0.044]}
          position={[0, DECK.bottom - 0.02, z]}
          color="#545444"
          radius={0.008}
        />
      ))}
      <PhysicalMark
        text="ENIGMA I"
        position={[2.64, DECK.bottom + DECK.thickness + 0.006, -1.42]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        width={0.67}
        height={0.15}
        color="#b7aa88"
      />
    </group>
  );
}

/** Compact retaining hardware on the teaching cover; all parts share its fade. */
function HoodFixings({ visibility }: { visibility: Visibility }) {
  const faceZ = HOOD_FRONT.z + HOOD_FRONT.thickness / 2;
  const topY = HOOD.bottom + HOOD.thickness;
  return (
    <group>
      {/* Quarter-turn-style retaining heads sit on solid roof margins, never over
        a reading window or a thumbwheel slot. Their shanks stay above the roof. */}
      {[-2.3, 2.04].flatMap((x) =>
        [-2.26, -0.8].map((z) => (
          <group key={`${x}-${z}`} position={[x, topY + 0.006, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.062, 0.062, 0.012, 24]} />
              <HoodMaterial visibility={visibility} color="#79785d" />
            </mesh>
            <mesh position={[0, 0.018, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.047, 0.029, 24]} />
              <HoodMaterial visibility={visibility} color={BRASS} />
            </mesh>
            <mesh position={[0, 0.034, 0]}>
              <boxGeometry args={[0.057, 0.004, 0.01]} />
              <HoodMaterial visibility={visibility} color="#454535" />
            </mesh>
          </group>
        )),
      )}
      {/* Paired shallow retaining plates break the front plane without claiming
        a measured replica latch. Everything remains outside the cover face. */}
      {[-1.82, 1.56].map((x) => (
        <group key={x} position={[x, 1.72, faceZ]}>
          <RoundedBox
            args={[0.178, 0.285, 0.015]}
            radius={0.014}
            smoothness={2}
            position={[0, 0, 0.009]}
            castShadow
          >
            <HoodMaterial visibility={visibility} color="#545642" />
          </RoundedBox>
          <RoundedBox
            args={[0.079, 0.145, 0.024]}
            radius={0.014}
            smoothness={2}
            position={[0, -0.023, 0.028]}
            castShadow
          >
            <HoodMaterial visibility={visibility} color={BRASS} />
          </RoundedBox>
          <mesh
            position={[0, -0.09, 0.041]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.021, 0.021, 0.116, 20]} />
            <HoodMaterial visibility={visibility} color="#b7a16d" />
          </mesh>
          <mesh
            position={[0, 0.081, 0.021]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.028, 0.028, 0.017, 20]} />
            <HoodMaterial visibility={visibility} color={BRASS} />
          </mesh>
          <mesh position={[0, 0.081, 0.031]} rotation={[0, 0, 0.25]}>
            <boxGeometry args={[0.036, 0.007, 0.004]} />
            <HoodMaterial visibility={visibility} color="#404232" />
          </mesh>
          <mesh position={[0, -0.125, 0.019]}>
            <boxGeometry args={[0.106, 0.016, 0.014]} />
            <HoodMaterial visibility={visibility} color="#66634b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function HoodGeometry({
  visibility,
  onMachine,
  onRotor,
}: {
  visibility: Visibility;
  onMachine: () => void;
  onRotor?: (index: 0 | 1 | 2) => void;
}) {
  const windowHole = useMemo<PanelHoles>(
    () => [
      {
        x: 0,
        z: 0,
        width: HOOD_WINDOW.width,
        depth: HOOD_WINDOW.depth,
        radius: HOOD_WINDOW.radius,
      },
    ],
    [],
  );
  const slotHole = useMemo<PanelHoles>(
    () => [
      {
        x: 0,
        z: 0,
        width: HOOD_SLOT.width,
        depth: HOOD_SLOT.depth,
        radius: HOOD_SLOT.radius,
      },
    ],
    [],
  );
  const selectMachine = (event: ThreeEvent<MouseEvent>) => {
    if (visibility.value < 0.03) return;
    event.stopPropagation();
    onMachine();
  };
  const frontHeight = HOOD.bottom - HOOD_FRONT.bottom;
  return (
    <group onClick={selectMachine}>
      <OpenPanel
        width={HOOD.width}
        depth={HOOD.depth}
        thickness={HOOD.thickness}
        holes={hoodHoles}
        position={[HOOD.x, HOOD.bottom, HOOD.z]}
        visibility={visibility}
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[HOOD.x + side * (HOOD.width / 2 - 0.023), 1.942, -1.53]}
          castShadow
        >
          <boxGeometry args={[0.045, 1.225, 1.81]} />
          <HoodMaterial visibility={visibility} />
        </mesh>
      ))}
      <mesh position={[HOOD.x, 1.98, -2.456]} castShadow>
        <boxGeometry args={[4.81, 1.15, 0.043]} />
        <HoodMaterial visibility={visibility} />
      </mesh>
      <RoundedBox
        position={[HOOD.x, HOOD_FRONT.bottom + frontHeight / 2, HOOD_FRONT.z]}
        args={[4.8, frontHeight, HOOD_FRONT.thickness]}
        radius={0.012}
        smoothness={2}
        castShadow
      >
        <HoodMaterial visibility={visibility} />
      </RoundedBox>
      <mesh position={[HOOD.x, HOOD_FRONT.lipY, HOOD_FRONT.lipZ]} castShadow>
        <boxGeometry args={[4.82, HOOD_FRONT.lipHeight, HOOD_FRONT.lipDepth]} />
        <HoodMaterial visibility={visibility} />
      </mesh>
      <HoodFixings visibility={visibility} />
      {ROTOR_CENTERS.map((x, index) => (
        <group
          key={x}
          onClick={(event) => {
            if (visibility.value < 0.03) return;
            event.stopPropagation();
            onRotor?.(index as 0 | 1 | 2);
          }}
        >
          <OpenPanel
            width={HOOD_WINDOW.frameWidth}
            depth={HOOD_WINDOW.frameDepth}
            thickness={HOOD_WINDOW.frameThickness}
            holes={windowHole}
            position={[
              x + HOOD_WINDOW.xOffset,
              HOOD_WINDOW.frameBottom,
              ROTOR_AXIS.z + HOOD_WINDOW.zOffset,
            ]}
            visibility={visibility}
            color={BRASS}
          />
          <OpenPanel
            width={HOOD_SLOT.frameWidth}
            depth={HOOD_SLOT.frameDepth}
            thickness={HOOD_SLOT.frameThickness}
            holes={slotHole}
            position={[
              x + HOOD_SLOT.xOffset,
              HOOD_SLOT.frameBottom,
              ROTOR_AXIS.z + HOOD_SLOT.zOffset,
            ]}
            visibility={visibility}
            color="#4b4d3c"
          />
          {/* Paired side ticks identify the fixed reading position on the ring. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                x + side * (HOOD_WINDOW.width / 2 + 0.0075),
                HOOD_WINDOW.frameBottom + HOOD_WINDOW.frameThickness + 0.003,
                ROTOR_AXIS.z + HOOD_WINDOW.zOffset,
              ]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.014, 0.018]} />
              <HoodMaterial visibility={visibility} color="#ded0a7" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function RemovableHood({
  reveal = false,
  extraLift = 0,
  onMachine,
  onRotor,
}: {
  reveal?: boolean;
  extraLift?: number;
  onMachine: () => void;
  onRotor?: (index: 0 | 1 | 2) => void;
}) {
  const group = useRef<THREE.Group>(null),
    visibility = useRef<Visibility>({ value: reveal ? 0 : 1 }),
    amount = useRef(reveal ? 1 : 0);
  useFrame((_, dt) => {
    if (!group.current) return;
    amount.current = THREE.MathUtils.damp(
      amount.current,
      reveal ? 1 : 0,
      7,
      dt,
    );
    if (Math.abs(amount.current - (reveal ? 1 : 0)) < 0.001)
      amount.current = reveal ? 1 : 0;
    group.current.position.y = extraLift + amount.current * 0.35;
    visibility.current.value = 1 - amount.current;
    group.current.visible = amount.current < 0.999;
    group.current.traverse((object) => {
      if (object instanceof THREE.Mesh)
        object.castShadow = amount.current < 0.05;
    });
  });
  return (
    <group ref={group} position={[0, extraLift, 0]} visible={!reveal}>
      <HoodGeometry
        visibility={visibility.current}
        onMachine={onMachine}
        onRotor={onRotor}
      />
    </group>
  );
}

function BackLid({ spread = 0 }: { spread?: number }) {
  const wood = useVintageMaps("wood");
  return (
    <group
      position={[0, 1.24 + spread * 0.48, -2.65 - spread * 0.64]}
      rotation={[-0.15 - spread * 0.1, 0, 0]}
    >
      <RoundedBox
        args={[6.43, 2.22, 0.16]}
        radius={0.048}
        smoothness={3}
        position={[0, 1.11, -0.035]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...wood} color="#b99c77" roughness={0.72} />
      </RoundedBox>
      <RoundedBox
        args={[5.99, 1.87, 0.033]}
        radius={0.018}
        position={[0, 1.115, 0.065]}
      >
        <VintageMaterial
          surface="enamel"
          color="#4b4c3b"
          roughness={0.82}
          metalness={0.08}
        />
      </RoundedBox>
      <mesh position={[0.99, 1.46, 0.089]}>
        <boxGeometry args={[2.24, 0.61, 0.016]} />
        <VintageMaterial
          surface="brass"
          color="#b2a179"
          roughness={0.64}
          metalness={0.32}
        />
      </mesh>
      <PhysicalMark
        text="ENIGMA"
        position={[0.99, 1.57, 0.102]}
        width={1.68}
        height={0.22}
        color="#454331"
      />
      <PhysicalMark
        text="CHIFFRIERMASCHINE"
        position={[0.99, 1.35, 0.102]}
        width={1.95}
        height={0.12}
        color="#595440"
      />
      <mesh position={[-1.38, 1.18, 0.089]}>
        <boxGeometry args={[1.84, 1.31, 0.012]} />
        <meshStandardMaterial color="#cabc97" roughness={0.99} />
      </mesh>
      <PhysicalMark
        text="MERKBLATT"
        position={[-1.38, 1.62, 0.099]}
        width={1.4}
        height={0.16}
        color="#68604a"
      />
      {Array.from({ length: 7 }, (_, index) => (
        <mesh key={index} position={[-1.38, 1.4 - index * 0.125, 0.099]}>
          <planeGeometry args={[index % 3 === 0 ? 1.44 : 1.22, 0.012]} />
          <meshBasicMaterial color="#9a9174" />
        </mesh>
      ))}
      {[-2.79, 2.79].flatMap((x) =>
        [0.3, 1.92].map((y) => (
          <HardwareScrew
            key={`${x}-${y}`}
            position={[x, y, 0.095]}
            rotation={[Math.PI / 2, 0, 0]}
            radius={0.035}
          />
        )),
      )}
    </group>
  );
}

function HingeBarrel({
  position,
  length = 0.106,
}: {
  position: Point3;
  length?: number;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.075, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.039, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: false,
      curveSegments: 32,
    });
    result.translate(0, 0, -length / 2);
    result.rotateY(Math.PI / 2);
    return result;
  }, [length]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} castShadow>
      <VintageMaterial
        surface="brass"
        color={BRASS}
        metalness={0.75}
        roughness={0.43}
      />
    </mesh>
  );
}

function LidHinges({ spread = 0 }: { spread?: number }) {
  return (
    <group>
      {[-2.15, 2.15].map((x) => (
        <group key={x} position={[x, 1.24, -2.61 - spread * 0.64]}>
          <CastBox
            args={[0.6, 0.29, 0.028]}
            position={[0, -0.17, 0.082]}
            color={BRASS}
          />
          <group
            position={[0, spread * 0.48, 0]}
            rotation={[-0.15 - spread * 0.1, 0, 0]}
          >
            <CastBox
              args={[0.6, 0.29, 0.028]}
              position={[0, 0.17, 0]}
              color={BRASS}
            />
            {[-0.232, 0, 0.232].map((dx) => (
              <HingeBarrel key={dx} position={[dx, 0, 0.036]} />
            ))}
            {[-0.19, 0.19].map((dx) => (
              <HardwareScrew
                key={dx}
                position={[dx, 0.205, 0.028]}
                rotation={[Math.PI / 2, 0, 0]}
                radius={0.029}
              />
            ))}
          </group>
          {[-0.116, 0.116].map((dx) => (
            <HingeBarrel key={dx} position={[dx, 0, 0.036]} />
          ))}
          <mesh
            position={[-spread * 0.44, 0, 0.036]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.034, 0.034, 0.71, 24]} />
            <VintageMaterial
              surface="steel"
              color={STEEL}
              metalness={0.82}
              roughness={0.32}
            />
          </mesh>
          {[-0.19, 0.19].map((dx) => (
            <HardwareScrew
              key={dx}
              position={[dx, -0.2, 0.062]}
              rotation={[Math.PI / 2, 0, 0]}
              radius={0.029}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function CaseFasteners({ spread = 0 }: { spread?: number }) {
  return (
    <group>
      {[-2.81, 2.81].flatMap((x) =>
        [-2.19, 2.18].map((z) => (
          <HardwareScrew
            key={`${x}-${z}`}
            position={[x, 1.252 + spread * 0.81, z]}
            raised={spread * 0.13}
          />
        )),
      )}
      {[-2.9, 2.9].map((x) => (
        <group key={x} position={[x, 0.85, 2.577 + spread * 0.48]}>
          <CastBox
            args={[0.25, 0.43, 0.026]}
            position={[0, 0, 0]}
            color={BRASS}
          />
          <group rotation={[spread * 0.42, 0, 0]}>
            <CastBox
              args={[0.15, 0.24, 0.039]}
              position={[0, 0.065, 0.034]}
              color="#b09a61"
              radius={0.015}
            />
            <mesh position={[0, -0.055, 0.06]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.028, 0.028, 0.21, 16]} />
              <VintageMaterial
                surface="brass"
                color={BRASS}
                metalness={0.7}
                roughness={0.44}
              />
            </mesh>
          </group>
          {[-0.145, 0.145].map((y) => (
            <HardwareScrew
              key={y}
              position={[0, y, 0.026]}
              rotation={[Math.PI / 2, 0, 0]}
              radius={0.025}
            />
          ))}
        </group>
      ))}
      <mesh position={[0, 0.337, 2.635 + spread * 0.44]}>
        <boxGeometry args={[1.97, 0.19, 0.022]} />
        <VintageMaterial
          surface="brass"
          color="#a78c58"
          metalness={0.67}
          roughness={0.56}
        />
      </mesh>
      <PhysicalMark
        text="No. 0001 / ENIGMA I"
        position={[0, 0.337, 2.649 + spread * 0.44]}
        width={1.77}
        height={0.13}
        color="#48422f"
      />
    </group>
  );
}

function AnatomyPart({
  id,
  isolate,
  onPartClick,
  children,
}: {
  id: HousingPart;
  isolate: string;
  onPartClick?: (id: string) => void;
  children: ReactNode;
}) {
  if (isolate !== "all" && isolate !== id) return null;
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onPartClick?.(id);
      }}
    >
      {children}
    </group>
  );
}

export function HistoricalHousing({
  revealInterior,
  exploded = false,
  onSelect,
}: HistoricalHousingProps) {
  const machine = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect("machine");
  };
  return (
    <group>
      <group onClick={machine}>
        <WoodenCase />
        <MetalTray />
        <DeckPlate />
        <BackLid />
        <LidHinges />
        <CaseFasteners />
      </group>
      <RemovableHood
        reveal={revealInterior || exploded}
        onMachine={() => onSelect("machine")}
        onRotor={(index) => onSelect("rotors", index)}
      />
    </group>
  );
}

/** Identical assembled surfaces to HistoricalHousing; only separation changes. */
export function HousingAnatomy({
  spread,
  isolate = "all",
  onPartClick,
}: HousingAnatomyProps) {
  const s = THREE.MathUtils.clamp(spread, 0, 1),
    selection = { isolate, onPartClick };
  return (
    <group position={[0, -1.03, 0]}>
      <AnatomyPart id="wood" {...selection}>
        <WoodenCase spread={s} />
      </AnatomyPart>
      <AnatomyPart id="chassis" {...selection}>
        <MetalTray spread={s} />
        <DeckPlate lift={s * 0.85} />
      </AnatomyPart>
      <AnatomyPart id="cover" {...selection}>
        <RemovableHood
          extraLift={s * 1.48}
          onMachine={() => onPartClick?.("cover")}
          onRotor={() => onPartClick?.("cover")}
        />
      </AnatomyPart>
      <AnatomyPart id="lid" {...selection}>
        <BackLid spread={s} />
      </AnatomyPart>
      <AnatomyPart id="hinges" {...selection}>
        <LidHinges spread={s} />
      </AnatomyPart>
      <AnatomyPart id="fasteners" {...selection}>
        <CaseFasteners spread={s} />
      </AnatomyPart>
    </group>
  );
}
