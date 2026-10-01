import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VintageMaterial } from "./VintageMaterials";
import {
  RotorReferenceFrame,
  RotorCoreReference,
  RotorReferenceLabel,
  type RotorProbe,
} from "./RotorReferenceFrame";
import { ALPHABET, ROTORS, type RotorId } from "../core/enigma";
import {
  contactPoint,
  rotorWirePoints,
  type Point3,
} from "../core/visual-paths";

export type RotorAnatomyPart =
  "ring" | "core" | "contacts" | "covers" | "ratchet" | "shaft";

export interface RotorAnatomyProps {
  rotorId: RotorId;
  position: number;
  ring: number;
  /** 0 = assembled; 1 = parts separated along the axle for inspection. */
  spread: number;
  showWiring: boolean;
  /** Fixed CORE entry index A=0..Z=25, before position/ring rotation. */
  highlightContact?: number;
  probe?: RotorProbe;
  language?: "zh" | "en";
  isolate?: "all" | RotorAnatomyPart;
  onPartClick?: (part: RotorAnatomyPart) => void;
}

const STEP = (Math.PI * 2) / 26;
const SCALE = 1.45;
const CONTACT_RADIUS = 0.516 * SCALE;
const BRASS = "#bca16a";
const STEEL = "#b4b5a3";
const BAKELITE = "#37382c";
const COPPER = "#b17c50";
const SIGNAL = "#efb458";

/** A bevelled, genuinely hollow washer; its bore leaves the shaft visible. */
function Washer({
  x,
  outer,
  inner,
  thickness,
  color = BRASS,
  opacity = 1,
  notch,
}: {
  x: number;
  outer: number;
  inner: number;
  thickness: number;
  color?: string;
  opacity?: number;
  notch?: number;
}) {
  const geometry = useMemo(() => {
    const outline = new THREE.Shape();
    // Build in XY then rotate onto the axle. The notch uses the same contact
    // convention as the electrical geometry: A is at +Y, then towards −Z.
    const divisions = 312;
    for (let i = 0; i <= divisions; i++) {
      const angle = (i / divisions) * Math.PI * 2;
      const notchAngle = Math.PI / 2 + (notch ?? 0) * STEP;
      const distance = Math.abs(
        Math.atan2(Math.sin(angle - notchAngle), Math.cos(angle - notchAngle)),
      );
      const radius =
        notch !== undefined && distance < STEP * 0.3 ? outer - 0.105 : outer;
      const px = -Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) outline.moveTo(px, py);
      else outline.lineTo(px, py);
    }
    outline.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, inner, 0, Math.PI * 2, true);
    outline.holes.push(bore);
    const result = new THREE.ExtrudeGeometry(outline, {
      depth: Math.max(0.008, thickness - 0.016),
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      curveSegments: 64,
    });
    // Keep the true shaft origin even when the notch makes the bounds uneven.
    result.translate(0, 0, -Math.max(0.008, thickness - 0.016) / 2);
    result.rotateY(Math.PI / 2);
    return result;
  }, [outer, inner, thickness, notch]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={[x, 0, 0]} geometry={geometry} castShadow={opacity === 1}>
      <VintageMaterial
        surface={
          color === BAKELITE ? "bakelite" : color === STEEL ? "steel" : "brass"
        }
        key={`opacity-${opacity}`}
        color={color}
        metalness={color === BAKELITE ? 0.1 : 0.77}
        roughness={color === BAKELITE ? 0.68 : 0.39}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function AxialCylinder({
  x,
  radius,
  length,
  color = STEEL,
}: {
  x: number;
  radius: number;
  length: number;
  color?: string;
}) {
  return (
    <mesh position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[radius, radius, length, 48]} />
      <VintageMaterial
        surface="steel"
        color={color}
        metalness={0.84}
        roughness={0.31}
      />
    </mesh>
  );
}

/** A single machined profile, with a long relief ramp and a steep drive face. */
function DriveRatchet({ x }: { x: number }) {
  const geometry = useMemo(() => {
    const outline = new THREE.Shape();
    for (let tooth = 0; tooth < 26; tooth++) {
      const base = Math.PI / 2 + tooth * STEP;
      const profile = [
        [base, 0.861],
        [base + STEP * 0.73, 0.976],
        [base + STEP * 0.85, 0.979],
        [base + STEP * 0.96, 0.861],
      ];
      profile.forEach(([angle, radius], point) => {
        const px = -Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (tooth === 0 && point === 0) outline.moveTo(px, py);
        else outline.lineTo(px, py);
      });
    }
    outline.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, 0.151, 0, Math.PI * 2, true);
    outline.holes.push(bore);
    const result = new THREE.ExtrudeGeometry(outline, {
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 48,
    });
    result.translate(0, 0, -0.0425);
    result.rotateY(Math.PI / 2);
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={[x, 0, 0]} geometry={geometry} castShadow>
      <VintageMaterial
        surface="brass"
        color="#ac9867"
        metalness={0.75}
        roughness={0.43}
      />
    </mesh>
  );
}

/** One shared atlas for physical printed markings, without DOM annotations. */
function createLetterAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#272920";
  context.font = '700 76px "Courier New", monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let index = 0; index < 26; index++) {
    context.fillText(
      ALPHABET[index],
      (index % 16) * 128 + 64,
      Math.floor(index / 16) * 128 + 67,
    );
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function LetterPrint({
  index,
  x,
  atlas,
}: {
  index: number;
  x: number;
  atlas: THREE.CanvasTexture;
}) {
  const geometry = useMemo(() => {
    const result = new THREE.PlaneGeometry(0.265, 0.19);
    const uv = result.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        ((index % 16) + uv.getX(i)) / 16,
        1 - (Math.floor(index / 16) + 1 - uv.getY(i)) / 2,
      );
    }
    return result;
  }, [index]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const theta = Math.PI / 2 + index * STEP;
  return (
    <mesh
      position={contactPoint(index, x, 1.042)}
      rotation={[-theta, 0, 0]}
      geometry={geometry}
    >
      <meshBasicMaterial
        map={atlas}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        toneMapped={false}
      />
    </mesh>
  );
}

function FixingScrew({ position }: { position: Point3 }) {
  return (
    <group position={position}>
      <AxialCylinder x={0} radius={0.054} length={0.036} color={STEEL} />
      <mesh position={[position[0] < 0 ? -0.021 : 0.021, 0, 0]}>
        <boxGeometry args={[0.006, 0.076, 0.012]} />
        <meshStandardMaterial color="#45463d" roughness={0.8} />
      </mesh>
    </group>
  );
}

function ContactPlate({
  x,
  side,
  highlighted,
  transparent,
}: {
  x: number;
  side: -1 | 1;
  highlighted?: number;
  transparent: boolean;
}) {
  return (
    <group position={[x, 0, 0]}>
      <Washer
        x={0}
        outer={0.909}
        inner={0.16}
        thickness={0.09}
        color={BAKELITE}
        opacity={transparent ? 0.18 : 1}
      />
      <Washer x={side * 0.05} outer={0.91} inner={0.875} thickness={0.025} />
      <Washer x={side * 0.047} outer={0.257} inner={0.132} thickness={0.04} />
      {Array.from({ length: 26 }, (_, index) => (
        <group key={index} position={contactPoint(index, 0, CONTACT_RADIUS)}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.062, 0.062, 0.106, 20]} />
            <meshStandardMaterial
              color="#645c46"
              metalness={0.36}
              roughness={0.66}
            />
          </mesh>
          <mesh position={[side * 0.039, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry
              args={[0.043, 0.043, side > 0 ? 0.15 : 0.037, 20]}
            />
            <meshStandardMaterial
              key={highlighted === index ? "active" : "idle"}
              color={highlighted === index ? SIGNAL : "#d5be7e"}
              metalness={0.83}
              roughness={0.28}
              emissive={highlighted === index ? SIGNAL : "#000000"}
              emissiveIntensity={highlighted === index ? 0.4 : 0}
            />
          </mesh>
          {side > 0 && (
            <mesh position={[0.108, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.033, 0.006, 5, 16]} />
              <meshStandardMaterial
                color="#776944"
                metalness={0.8}
                roughness={0.38}
              />
            </mesh>
          )}
        </group>
      ))}
      {[2, 11, 20].map((index) => (
        <FixingScrew
          key={index}
          position={contactPoint(index, side * 0.063, 0.85)}
        />
      ))}
    </group>
  );
}

function PhysicalWire({
  from,
  to,
  left,
  right,
  active,
}: {
  from: number;
  to: number;
  left: number;
  right: number;
  active: boolean;
}) {
  const geometry = useMemo(() => {
    const core = rotorWirePoints(from, to).map(
      (point) => point.map((coordinate) => coordinate * SCALE) as Point3,
    );
    const points = [
      contactPoint(from, right, CONTACT_RADIUS),
      ...core,
      contactPoint(to, left, CONTACT_RADIUS),
    ];
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      58,
      active ? 0.024 : 0.0105,
      active ? 9 : 5,
      false,
    );
  }, [from, to, left, right, active]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={active ? 3 : 0}>
      <meshStandardMaterial
        key={active ? "active" : "idle"}
        color={active ? SIGNAL : from % 3 === 0 ? "#998b61" : COPPER}
        metalness={0.65}
        roughness={0.43}
        transparent={!active}
        opacity={active ? 1 : 0.47}
        depthWrite={active}
        emissive={active ? SIGNAL : "#000000"}
        emissiveIntensity={active ? 0.5 : 0}
      />
    </mesh>
  );
}

/**
 * Inspection geometry, not manufacturing drawings. The 26 wire endpoints and
 * core/letter-ring offset are exact; shapes, hardware and exploded lead lengths
 * are intentionally enlarged for teaching. No mechanical force model is used.
 */
export function RotorAnatomy({
  rotorId,
  position,
  ring,
  spread,
  showWiring,
  highlightContact,
  probe,
  language = "zh",
  isolate = "all",
  onPartClick,
}: RotorAnatomyProps) {
  const opened = THREE.MathUtils.clamp(spread, 0, 1);
  const definition = ROTORS[rotorId];
  const coreBody = useRef<THREE.Group>(null);
  const ratchetBody = useRef<THREE.Group>(null);
  const initialCoreAngle = useRef((position - ring) * STEP);
  const coreAngle = useRef(initialCoreAngle.current);
  const targetAngle = useRef(initialCoreAngle.current);
  const previousOffset = useRef(position - ring);
  const [settled, setSettled] = useState(true);
  const aligned =
    settled && (previousOffset.current - (position - ring)) % 26 === 0;
  useEffect(() => {
    const next = position - ring;
    const change =
      ((((next - previousOffset.current + 13) % 26) + 26) % 26) - 13;
    targetAngle.current += change * STEP;
    previousOffset.current = next;
    setSettled(Math.abs(coreAngle.current - targetAngle.current) < 0.0001);
  }, [position, ring]);
  useFrame((_, dt) => {
    if (!coreBody.current || !ratchetBody.current) return;
    coreAngle.current = THREE.MathUtils.damp(
      coreAngle.current,
      targetAngle.current,
      11,
      dt,
    );
    if (Math.abs(coreAngle.current - targetAngle.current) < 0.0001) {
      coreAngle.current = targetAngle.current;
      if (!settled) setSettled(true);
    }
    coreBody.current.rotation.x = coreAngle.current;
    ratchetBody.current.rotation.x = coreAngle.current;
  });
  const requestedContact = probe?.shiftedInput ?? highlightContact;
  // While adjusting, a different internal contact is still travelling into
  // alignment. Suppress its signal until it meets the fixed external frame.
  const highlighted =
    probe && !aligned
      ? undefined
      : requestedContact !== undefined &&
          Number.isInteger(requestedContact) &&
          requestedContact >= 0 &&
          requestedContact < 26
        ? requestedContact
        : undefined;
  const atlas = useMemo(createLetterAtlas, []);
  useEffect(() => () => atlas.dispose(), [atlas]);
  const leftPlate = -0.53 - opened * 0.85;
  const rightPlate = 0.53 + opened * 0.85;
  const alphabetX = -opened * 2.0;
  const leftCover = -0.72 - opened * 1.88;
  const rightCover = 0.72 + opened * 1.32;
  const ratchetX = 0.825 + opened * 1.75;
  // Keep the transparency control effective at every separation setting.
  const seeThrough = showWiring;
  // Ring inspection keeps the electrically related parts in view so that
  // adjusting the ring still reveals its relation to the wired core.
  const ringContext = !!probe && isolate === "ring";
  const shown = (part: RotorAnatomyPart) =>
    isolate === "all" ||
    isolate === part ||
    (ringContext && (part === "core" || part === "contacts"));
  const select =
    (part: RotorAnatomyPart) => (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onPartClick?.(part);
    };
  return (
    <group>
      {/* Axle and a keyed end retain a readable common mechanical axis. */}
      <group visible={shown("shaft")} onClick={select("shaft")}>
        <AxialCylinder x={0} radius={0.109} length={2.0 + opened * 3.7} />
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (0.94 + opened * 1.85), 0, 0]}>
            <Washer
              x={0}
              outer={0.154}
              inner={0.111}
              thickness={0.045}
              color={STEEL}
            />
            <RoundedBox
              args={[0.16, 0.055, 0.1]}
              radius={0.015}
              position={[0, 0.1, 0]}
            >
              <meshStandardMaterial
                color="#737669"
                metalness={0.8}
                roughness={0.42}
              />
            </RoundedBox>
          </group>
        ))}
      </group>

      {/* The adjustable alphabet ring carries the turnover notch. Its window
          position stays fixed when Ringstellung changes the core alignment. */}
      <group rotation={[position * STEP, 0, 0]}>
        <group visible={shown("ring")} onClick={select("ring")}>
          <Washer
            x={alphabetX}
            outer={1.035}
            inner={0.918}
            thickness={0.33}
            color="#d2c496"
          />
          {[-0.174, 0.174].map((edge) => (
            <Washer
              key={edge}
              x={alphabetX + edge}
              outer={1.045}
              inner={0.946}
              thickness={0.027}
            />
          ))}
          {Array.from({ length: 26 }, (_, index) => (
            <LetterPrint
              key={index}
              index={index}
              x={alphabetX}
              atlas={atlas}
            />
          ))}
          <Washer
            x={alphabetX - 0.227}
            outer={1.011}
            inner={0.833}
            thickness={0.061}
            notch={definition.notches[0]}
            color="#9e895e"
          />
          <mesh
            position={contactPoint(
              definition.notches[0],
              alphabetX - 0.228,
              0.906,
            )}
          >
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial color="#694b30" roughness={0.77} />
          </mesh>
        </group>
      </group>

      {probe && shown("ring") && (
        <group>
          <mesh position={[alphabetX, 1.115, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.034, 0.087, 3]} />
            <VintageMaterial
              surface="brass"
              color="#d5bd85"
              metalness={0.63}
              roughness={0.44}
            />
          </mesh>
          <RotorReferenceLabel
            text={`${language === "en" ? "WINDOW" : "窗口"} ${ALPHABET[position]}`}
            position={[alphabetX, 1.32, -0.17]}
            small
          />
        </group>
      )}

      {/* The drive ratchet is fixed to the wired rotor body, not the adjustable
          alphabet ring. Its 26-fold symmetry makes integer ring changes look
          identical, but its mechanical frame must still be position − ring. */}
      <group ref={ratchetBody} rotation={[initialCoreAngle.current, 0, 0]}>
        <group visible={shown("ratchet")} onClick={select("ratchet")}>
          <DriveRatchet x={ratchetX} />
          <Washer
            x={ratchetX + 0.052}
            outer={0.35}
            inner={0.135}
            thickness={0.026}
            color={STEEL}
          />
        </group>
      </group>

      {/* The entire fixed wiring frame, including both contact plates, rotates
          position − ring. Both ends therefore retain their electrical indices. */}
      <group ref={coreBody} rotation={[initialCoreAngle.current, 0, 0]}>
        <group visible={shown("core")} onClick={select("core")}>
          <Washer
            x={0}
            outer={0.891}
            inner={0.813}
            thickness={0.79}
            color={BAKELITE}
            opacity={seeThrough ? 0.045 : 1}
          />
          {[-0.405, 0.405].map((x) => (
            <Washer
              key={x}
              x={x}
              outer={0.878}
              inner={0.165}
              thickness={0.044}
              color={BAKELITE}
              opacity={seeThrough ? 0.11 : 1}
            />
          ))}
          <Washer
            x={0}
            outer={0.208}
            inner={0.12}
            thickness={0.8}
            color="#837958"
          />
          {seeThrough &&
            definition.forward.map((to, from) => (
              <PhysicalWire
                key={from}
                from={from}
                to={to}
                left={leftPlate}
                right={rightPlate}
                active={highlighted === from}
              />
            ))}
        </group>
        {probe && (shown("core") || shown("contacts")) && (
          <RotorCoreReference x={rightPlate + 0.15} language={language} />
        )}
        <group visible={shown("contacts")} onClick={select("contacts")}>
          <ContactPlate
            x={leftPlate}
            side={-1}
            highlighted={
              highlighted === undefined
                ? undefined
                : definition.forward[highlighted]
            }
            transparent={seeThrough}
          />
          <ContactPlate
            x={rightPlate}
            side={1}
            highlighted={highlighted}
            transparent={seeThrough}
          />
        </group>
        <group visible={shown("covers")} onClick={select("covers")}>
          {[-1, 1].map((side) => {
            const x = side < 0 ? leftCover : rightCover;
            return (
              <group key={side}>
                <Washer
                  x={x}
                  outer={0.939}
                  inner={0.174}
                  thickness={0.069}
                  color="#82744e"
                  opacity={showWiring && opened < 0.15 ? 0.13 : 1}
                />
                <Washer
                  x={x + side * 0.047}
                  outer={0.423}
                  inner={0.151}
                  thickness={0.028}
                />
                <Washer
                  x={x + side * 0.067}
                  outer={0.259}
                  inner={0.124}
                  thickness={0.027}
                  color={STEEL}
                />
                {[2, 11, 20].map((index) => (
                  <FixingScrew
                    key={index}
                    position={contactPoint(index, x + side * 0.051, 0.837)}
                  />
                ))}
              </group>
            );
          })}
        </group>
        {/* Three locating pins make the registration between core and plates
            legible in the exploded view; they do not encode extra mappings. */}
        <group visible={shown("shaft")} onClick={select("shaft")}>
          {[3, 12, 21].map((index) => (
            <group key={index} position={contactPoint(index, 0, 0.865)}>
              <AxialCylinder
                x={0}
                radius={0.018}
                length={1.09 + opened * 1.61}
                color="#8e907d"
              />
            </group>
          ))}
        </group>
      </group>
      {probe && (shown("core") || shown("contacts") || shown("ring")) && (
        <RotorReferenceFrame
          probe={probe}
          aligned={aligned}
          leftPlate={leftPlate}
          rightPlate={rightPlate}
          leftOuter={leftCover - 0.34}
          rightOuter={Math.max(rightCover, ratchetX) + 0.34}
          language={language}
          showLeads={showWiring && (shown("core") || shown("contacts"))}
        />
      )}
    </group>
  );
}

export default RotorAnatomy;
