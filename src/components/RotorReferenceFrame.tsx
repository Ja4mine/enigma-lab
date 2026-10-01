import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ALPHABET } from "../core/enigma";
import { SignalAnnotation } from "./SignalAnnotation";
import { contactPoint, type Point3 } from "../core/visual-paths";

export interface RotorProbe {
  input: number;
  shiftedInput: number;
  wiredOutput: number;
  output: number;
}

const GOLD = "#c4a56a";
const INPUT = "#e2a74d";
const OUTPUT = "#65a89a";
const REFERENCE_RADIUS = 1.195;
const CONTACT_RADIUS = 0.516 * 1.45;

/** Quiet, frameless reference text rendered in the same style as playback. */
export function RotorReferenceLabel({
  text,
  secondary,
  position,
  color = GOLD,
  small = false,
  tone = "ink",
}: {
  text: string;
  secondary?: string;
  position: Point3;
  color?: string;
  small?: boolean;
  tone?: "ink" | "light";
}) {
  return (
    <SignalAnnotation
      text={text}
      secondaryText={secondary}
      position={position}
      color={color}
      compact={small}
      variant="reference"
      tone={tone}
    />
  );
}

function LabelLeader({
  from,
  to,
  color,
}: {
  from: Point3;
  to: Point3;
  color: string;
}) {
  const geometry = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...from),
        new THREE.Vector3(...to),
      ]),
    [...from, ...to],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} raycast={() => {}}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function ReferenceLead({
  letter,
  externalX,
  plateX,
  color,
}: {
  letter: number;
  externalX: number;
  plateX: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const direction = externalX > 0 ? 1 : -1;
    const points = [
      contactPoint(letter, externalX, REFERENCE_RADIUS),
      contactPoint(letter, plateX + direction * 0.18, REFERENCE_RADIUS),
      contactPoint(
        letter,
        plateX + (direction > 0 ? 0.114 : -0.0575),
        CONTACT_RADIUS,
      ),
    ];
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
      ),
      42,
      0.013,
      7,
      false,
    );
  }, [letter, externalX, plateX]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function ReferenceRing({
  x,
  active,
  color,
}: {
  x: number;
  active?: number;
  color: string;
}) {
  // A broken drafting circle reads as a teaching overlay, not a metal handle.
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < 26; index++) {
      for (let segment = 0; segment < 4; segment++) {
        points.push(
          new THREE.Vector3(
            ...contactPoint(index + 0.13 + segment * 0.17, x, REFERENCE_RADIUS),
          ),
          new THREE.Vector3(
            ...contactPoint(
              index + 0.13 + (segment + 1) * 0.17,
              x,
              REFERENCE_RADIUS,
            ),
          ),
        );
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [x]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <lineSegments geometry={geometry} raycast={() => {}}>
        <lineBasicMaterial
          color="#918467"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </lineSegments>
      {Array.from({ length: 26 }, (_, index) => (
        <mesh key={index} position={contactPoint(index, x, REFERENCE_RADIUS)}>
          <sphereGeometry args={[active === index ? 0.035 : 0.014, 10, 7]} />
          <meshBasicMaterial
            key={active === index ? "active" : "idle"}
            color={active === index ? color : "#998f71"}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* External A is fixed at the top of this educational reference ring. */}
      <mesh
        position={[x, REFERENCE_RADIUS + 0.052, 0]}
        rotation={[0, 0, Math.PI]}
      >
        <coneGeometry args={[0.025, 0.063, 3]} />
        <meshStandardMaterial color="#b7a679" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Non-historical electrical reference frames, fixed while the wired body turns. */
export function RotorReferenceFrame({
  probe,
  aligned,
  leftPlate,
  rightPlate,
  leftOuter,
  rightOuter,
  language = "zh",
  showLeads = true,
}: {
  probe: RotorProbe;
  aligned: boolean;
  leftPlate: number;
  rightPlate: number;
  leftOuter: number;
  rightOuter: number;
  language?: "zh" | "en";
  showLeads?: boolean;
}) {
  const en = language === "en";
  const inputPoint = contactPoint(probe.input, rightOuter, REFERENCE_RADIUS);
  const outputPoint = contactPoint(probe.output, leftOuter, REFERENCE_RADIUS);
  // Keep contact labels outside the assembly. Thin leaders attach each quiet
  // caption to its own fixed terminal without crossing the winding display.
  const inputLabel: Point3 = [
    rightOuter + 0.34,
    inputPoint[1] + (probe.input === 0 ? 0.31 : 0.11),
    inputPoint[2] + 0.04,
  ];
  const outputLabel: Point3 = [
    leftOuter - 0.34,
    outputPoint[1] + (probe.output === 0 ? 0.31 : 0.11),
    outputPoint[2] + 0.04,
  ];
  return (
    <group>
      <ReferenceRing
        x={rightOuter}
        active={aligned ? probe.input : undefined}
        color={INPUT}
      />
      <ReferenceRing
        x={leftOuter}
        active={aligned ? probe.output : undefined}
        color={OUTPUT}
      />
      {(!aligned || probe.input !== 0) && (
        <RotorReferenceLabel
          text={en ? "External A" : "外部 A"}
          position={[rightOuter + 0.1, 1.39, 0]}
          small
        />
      )}
      {(!aligned || probe.output !== 0) && (
        <RotorReferenceLabel
          text={en ? "External A" : "外部 A"}
          position={[leftOuter - 0.1, 1.39, 0]}
          small
        />
      )}
      {aligned && (
        <>
          <RotorReferenceLabel
            text={`${en ? "External IN" : "外部输入"} ${ALPHABET[probe.input]}`}
            secondary={`${en ? "Core" : "线芯"} ${ALPHABET[probe.shiftedInput]}`}
            position={inputLabel}
            color={INPUT}
            small
          />
          <RotorReferenceLabel
            text={`${en ? "External OUT" : "外部输出"} ${ALPHABET[probe.output]}`}
            secondary={`${en ? "Core" : "线芯"} ${ALPHABET[probe.wiredOutput]}`}
            position={outputLabel}
            color={OUTPUT}
            small
          />
          <LabelLeader
            from={inputPoint}
            to={[inputLabel[0] - 0.1, inputLabel[1] - 0.08, inputLabel[2]]}
            color={INPUT}
          />
          <LabelLeader
            from={outputPoint}
            to={[outputLabel[0] + 0.1, outputLabel[1] - 0.08, outputLabel[2]]}
            color={OUTPUT}
          />
          {showLeads && (
            <>
              <ReferenceLead
                letter={probe.input}
                externalX={rightOuter}
                plateX={rightPlate}
                color={INPUT}
              />
              <ReferenceLead
                letter={probe.output}
                externalX={leftOuter}
                plateX={leftPlate}
                color={OUTPUT}
              />
            </>
          )}
        </>
      )}
      {!aligned && (
        <RotorReferenceLabel
          text={en ? "Aligning…" : "对位中…"}
          position={[0, -1.43, 0]}
          small
        />
      )}
    </group>
  );
}

export function RotorCoreReference({
  x,
  language = "zh",
}: {
  x: number;
  language?: "zh" | "en";
}) {
  return (
    <group position={contactPoint(0, x, CONTACT_RADIUS)}>
      <mesh>
        <sphereGeometry args={[0.035, 14, 10]} />
        <meshBasicMaterial color="#a99ac9" toneMapped={false} />
      </mesh>
      <RotorReferenceLabel
        text={language === "en" ? "CORE A" : "线芯 A"}
        position={[0.11, 0.19, 0.06]}
        color="#a99ac9"
        tone="light"
        small
      />
    </group>
  );
}
