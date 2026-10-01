import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { encryptKey } from "../core/enigma";
import { getRingExperiment } from "../core/ring-experiment";
import type { Language } from "../i18n";
import { createObjectFade } from "../core/scene-fade";
import type { MachineConfig, RotorId } from "../core/enigma";
import type { ComponentInspection } from "../core/inspection";
import { DriveMechanism, type DrivePartId } from "./MechanicalDrive";
import { RotorAnatomy, type RotorAnatomyPart } from "./RotorAnatomy";
import { ReflectorAnatomy } from "./ReflectorAnatomy";
import { HousingAnatomy, KeyAnatomy, PlugAnatomy } from "./HardwareAnatomy";

export const INSPECTION_CENTER = new THREE.Vector3(0, 1.7, 0);

/** Keep one fade controller across React renders and interrupted transitions. */
export function useObjectFade() {
  return useMemo(() => createObjectFade(), []);
}

function assembledOrigin(
  detail: ComponentInspection,
  exploded: boolean,
  boardOffset: number,
): {
  position: THREE.Vector3;
  scale: number;
} {
  switch (detail.assembly) {
    case "reflector":
      return {
        position: new THREE.Vector3(-1.65, 1.79 + (exploded ? 1.58 : 0), -1.53),
        scale: 0.58,
      };
    case "rotor":
      return {
        position: new THREE.Vector3(
          -0.7 + detail.rotorIndex * 0.96,
          1.79 + (exploded ? 1.58 : 0),
          -1.53,
        ),
        scale: 0.62,
      };
    case "drive":
      return {
        position: new THREE.Vector3(0, 1.46 + (exploded ? 1.58 : 0), -1.2),
        scale: 0.66,
      };
    case "plug":
      return {
        position: new THREE.Vector3(0, 0.8, 2.57 + boardOffset),
        scale: 0.23,
      };
    case "key":
      return {
        position: new THREE.Vector3(0, 1.45 + (exploded ? 0.4 : 0), 1.4),
        scale: 0.23,
      };
    case "housing":
      return { position: new THREE.Vector3(0, 1.03, 0), scale: 1 };
  }
}

export interface ComponentInspectionSceneProps {
  detail: ComponentInspection | null;
  blend: { current: number };
  subject: RefObject<THREE.Group | null>;
  config: MachineConfig;
  exploded: boolean;
  boardOffset: number;
  onPartClick?: (id: string) => void;
  language?: Language;
}

/** Detailed parts share the machine's canvas, lighting, and one camera owner. */
export default function ComponentInspectionScene({
  detail,
  blend,
  subject,
  config,
  exploded,
  boardOffset,
  onPartClick,
  language = "zh",
}: ComponentInspectionSceneProps) {
  const transform = useRef<THREE.Group>(null);
  const fade = useObjectFade();
  const retained = useRef<{
    detail: ComponentInspection;
    config: MachineConfig;
  } | null>(null);
  // Retain the outgoing part during its reverse journey into the machine.
  if (detail) retained.current = { detail, config };
  const shown = detail ? { detail, config } : retained.current;
  const demoConfig = useMemo(() => {
    const source = shown?.config ?? config;
    const scenario = shown?.detail.scenario ?? "current";
    if (scenario === "current") return source;
    return {
      ...source,
      rotors: ["I", "II", "III"] as MachineConfig["rotors"],
      positions:
        scenario === "right"
          ? [0, 0, 0]
          : scenario === "carry"
            ? [0, 3, 21]
            : [0, 4, 22],
    } as MachineConfig;
  }, [shown?.config, shown?.detail.scenario, config]);
  const step = useMemo(() => encryptKey(demoConfig, "A"), [demoConfig]);
  const ringExperiment = useMemo(() => {
    if (
      !shown ||
      shown.detail.assembly !== "rotor" ||
      !shown.detail.ringExperiment
    )
      return null;
    const { rotorIndex, trialRing, probeInput } = shown.detail;
    return getRingExperiment(
      shown.config,
      rotorIndex,
      trialRing ?? shown.config.rings[rotorIndex],
      probeInput,
    );
  }, [
    shown?.config,
    shown?.detail.assembly,
    shown?.detail.ringExperiment,
    shown?.detail.rotorIndex,
    shown?.detail.trialRing,
    shown?.detail.probeInput,
  ]);
  const origin = useMemo(
    () =>
      shown
        ? assembledOrigin(shown.detail, exploded, boardOffset)
        : { position: new THREE.Vector3(), scale: 1 },
    [shown?.detail.assembly, shown?.detail.rotorIndex, exploded, boardOffset],
  );
  useFrame(() => {
    if (!transform.current || !shown) return;
    const t = THREE.MathUtils.clamp(blend.current, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    transform.current.position.lerpVectors(
      origin.position,
      INSPECTION_CENTER,
      smooth,
    );
    transform.current.scale.setScalar(
      THREE.MathUtils.lerp(origin.scale, 1, smooth),
    );
    fade(transform.current, smooth, !!detail);
  });
  useEffect(
    () => () => {
      retained.current = null;
    },
    [],
  );
  if (!shown) return null;
  const selected = shown.detail;
  const props = {
    spread: selected.spread,
    isolate: selected.isolate,
    onPartClick,
  };
  return (
    <group ref={transform} position={origin.position} scale={origin.scale}>
      <group ref={subject}>
        {selected.assembly === "drive" && (
          <DriveMechanism
            {...props}
            isolate={selected.isolate as DrivePartId}
            progress={selected.progress}
            stepped={step.stepped}
            positions={step.before}
            rotorIds={demoConfig.rotors}
          />
        )}
        {selected.assembly === "rotor" && (
          <RotorAnatomy
            {...props}
            isolate={selected.isolate as "all" | RotorAnatomyPart}
            rotorId={shown.config.rotors[selected.rotorIndex] as RotorId}
            position={shown.config.positions[selected.rotorIndex]}
            ring={
              ringExperiment?.trialRing ??
              shown.config.rings[selected.rotorIndex]
            }
            probe={ringExperiment?.trial}
            language={language}
            showWiring={selected.showWiring}
            highlightContact={selected.wire >= 0 ? selected.wire : undefined}
          />
        )}
        {selected.assembly === "plug" && <PlugAnatomy {...props} />}
        {selected.assembly === "reflector" && (
          <ReflectorAnatomy
            {...props}
            reflectorId={shown.config.reflector}
            showWiring={selected.showWiring}
            highlightContact={selected.wire >= 0 ? selected.wire : undefined}
          />
        )}
        {selected.assembly === "key" && (
          <KeyAnatomy {...props} progress={selected.progress} />
        )}
        {selected.assembly === "housing" && <HousingAnatomy {...props} />}
      </group>
    </group>
  );
}
