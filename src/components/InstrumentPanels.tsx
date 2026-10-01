import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ALPHABET } from "../core/enigma";
import {
  createHorizontalPanelGeometry,
  DECK,
  KEY_PANEL,
  keyHoles,
  keyPoint,
  LAMP_PANEL,
  lampHoles,
} from "../core/housing-layout";
import { VintageMaterial } from "./VintageMaterials";

/** An annular solid with an open bore, extending upward from local Y = 0. */
function sleeveGeometry(inner: number, outer: number, height: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(opening);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function useLetterFilms() {
  const films = useMemo(
    () =>
      [...ALPHABET].map((letter) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const context = canvas.getContext("2d")!;
        context.clearRect(0, 0, 128, 128);
        context.fillStyle = "#ffffff";
        context.font = '600 91px "Helvetica Neue", Arial, sans-serif';
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(letter, 64, 68);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        return { letter, texture };
      }),
    [],
  );
  useEffect(
    () => () => films.forEach(({ texture }) => texture.dispose()),
    [films],
  );
  return films;
}

type CoverVisibility = { value: number };

/** Independent coverage composes with the assembly fade without owning opacity. */
function coverShader(visibility?: CoverVisibility) {
  if (!visibility) return {};
  return {
    alphaHash: true,
    onBeforeCompile: (
      shader: Parameters<THREE.Material["onBeforeCompile"]>[0],
    ) => {
      shader.uniforms.lampCoverVisibility = visibility;
      shader.fragmentShader =
        "uniform float lampCoverVisibility;\n" +
        shader.fragmentShader.replace(
          "#include <alphahash_fragment>",
          "diffuseColor.a *= lampCoverVisibility;\n#include <alphahash_fragment>",
        );
    },
    customProgramCacheKey: () => "lamp-cover-visibility-v1",
  };
}

function PanelScrew({
  x,
  y,
  z,
  visibility,
}: {
  x: number;
  y: number;
  z: number;
  visibility?: CoverVisibility;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.044, 0.012, 20]} />
        <VintageMaterial
          {...coverShader(visibility)}
          surface="steel"
          color="#6b695e"
          metalness={0.72}
          roughness={0.64}
        />
      </mesh>
      <mesh position={[0, 0.0065, 0]} rotation={[0, 0.38, 0]}>
        <boxGeometry args={[0.055, 0.0015, 0.008]} />
        <meshStandardMaterial
          {...coverShader(visibility)}
          color="#171915"
          roughness={0.95}
        />
      </mesh>
    </group>
  );
}

/** Independent lamp feeds terminate on an insulated strip. Routing is illustrative. */
function LampWiring({
  output,
  phase,
}: {
  output: string | null;
  phase: number;
}) {
  const wiring = useMemo(
    () =>
      [...ALPHABET].map((letter, index) => {
        const [x, , z] = keyPoint(letter, "lamp");
        const terminalZ = -0.57 + index * 0.04;
        const laneY = 1.018 - index * 0.006;
        const curve = new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(x, 1.078, z),
            new THREE.Vector3(x, laneY, z),
            new THREE.Vector3(x - 0.14, laneY - 0.018, z),
            new THREE.Vector3(-2.35, laneY - 0.018, terminalZ),
            new THREE.Vector3(-2.53, 0.965, terminalZ),
          ],
          false,
          "centripetal",
        );
        return {
          letter,
          terminalZ,
          geometry: new THREE.TubeGeometry(curve, 38, 0.009, 6, false),
        };
      }),
    [],
  );
  useEffect(
    () => () => wiring.forEach((wire) => wire.geometry.dispose()),
    [wiring],
  );
  return (
    <group>
      <mesh position={[-2.53, 0.94, -0.07]} castShadow>
        <boxGeometry args={[0.19, 0.034, 1.17]} />
        <VintageMaterial surface="bakelite" color="#48402e" roughness={0.85} />
      </mesh>
      {wiring.map(({ letter, terminalZ, geometry }) => {
        const lit = output === letter && phase >= 10;
        return (
          <group key={letter}>
            <mesh geometry={geometry}>
              <meshStandardMaterial
                color={lit ? "#dc9c46" : "#6a5037"}
                emissive={lit ? "#c17a24" : "#000000"}
                emissiveIntensity={lit ? 0.6 : 0}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[-2.53, 0.964, terminalZ]}>
              <cylinderGeometry args={[0.014, 0.014, 0.019, 12]} />
              <VintageMaterial
                surface="brass"
                color="#b39a68"
                metalness={0.64}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** A removable letter-film cover above the stationary bulbs and wiring. */
export function LampboardInstrument({
  output,
  phase,
  selected,
  onInspect,
  coverRemoved = false,
}: {
  output: string | null;
  phase: number;
  selected: boolean;
  onInspect: () => void;
  coverRemoved?: boolean;
}) {
  const films = useLetterFilms();
  const coverGroup = useRef<THREE.Group>(null);
  const removedAmount = useRef(coverRemoved ? 1 : 0);
  const visibility = useRef<CoverVisibility>({ value: coverRemoved ? 0 : 1 });
  const coverMaterial = useMemo(() => coverShader(visibility.current), []);
  const panelTop = LAMP_PANEL.bottom + LAMP_PANEL.thickness;
  const deckTop = DECK.bottom + DECK.thickness;
  const standoffHeight = LAMP_PANEL.bottom - deckTop;
  const geometry = useMemo(
    () => ({
      panel: createHorizontalPanelGeometry(
        LAMP_PANEL.width,
        LAMP_PANEL.depth,
        LAMP_PANEL.thickness,
        lampHoles,
      ),
      aperture: sleeveGeometry(0.161, 0.173, 0.071),
      lip: sleeveGeometry(0.161, 0.178, 0.006),
      film: new THREE.CylinderGeometry(0.16, 0.16, 0.007, 40),
      lettering: new THREE.PlaneGeometry(0.263, 0.263),
      bulb: new THREE.SphereGeometry(1, 20, 12),
      neck: new THREE.CylinderGeometry(0.043, 0.047, 0.035, 16),
      socket: sleeveGeometry(0.041, 0.069, 0.072),
      socketThread: new THREE.TorusGeometry(0.067, 0.004, 5, 20),
      insulator: new THREE.CylinderGeometry(0.089, 0.095, 0.034, 20),
      standoff: new THREE.CylinderGeometry(0.045, 0.045, standoffHeight, 16),
    }),
    [standoffHeight],
  );
  useEffect(
    () => () => Object.values(geometry).forEach((item) => item.dispose()),
    [geometry],
  );
  useEffect(() => {
    const guarded: Array<{
      mesh: THREE.Mesh;
      original: THREE.Mesh["raycast"];
      guard: THREE.Mesh["raycast"];
    }> = [];
    coverGroup.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.raycast;
      const guard: THREE.Mesh["raycast"] = function (
        this: THREE.Mesh,
        raycaster,
        intersections,
      ) {
        if (visibility.current.value > 0.03)
          original.call(this, raycaster, intersections);
      };
      guarded.push({ mesh: object, original, guard });
      object.raycast = guard;
    });
    return () =>
      guarded.forEach(({ mesh, original, guard }) => {
        if (mesh.raycast === guard) mesh.raycast = original;
      });
  }, []);
  useFrame((_, dt) => {
    if (!coverGroup.current) return;
    const target = coverRemoved ? 1 : 0;
    removedAmount.current = THREE.MathUtils.damp(
      removedAmount.current,
      target,
      7,
      dt,
    );
    if (Math.abs(removedAmount.current - target) < 0.001)
      removedAmount.current = target;
    const amount = removedAmount.current;
    coverGroup.current.position.set(0, amount * 0.26, amount * 0.1);
    visibility.current.value = 1 - amount;
    coverGroup.current.visible = amount < 0.999;
    coverGroup.current.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = amount < 0.025;
    });
  });
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onInspect();
      }}
    >
      <group ref={coverGroup}>
        <mesh
          geometry={geometry.panel}
          position={[LAMP_PANEL.x, LAMP_PANEL.bottom, LAMP_PANEL.z]}
          castShadow
          receiveShadow
        >
          <VintageMaterial
            {...coverMaterial}
            surface="enamel"
            color={selected ? "#30332b" : "#22261f"}
            metalness={0.3}
            roughness={0.76}
          />
        </mesh>
        {films.map(({ letter, texture }) => {
          const [x, , z] = keyPoint(letter, "lamp");
          const lit = output === letter && phase >= 10;
          return (
            <group key={letter} position={[x, 0, z]}>
              <mesh geometry={geometry.aperture} position={[0, 1.23, 0]}>
                <VintageMaterial
                  {...coverMaterial}
                  surface="steel"
                  color="#34382f"
                  metalness={0.58}
                  roughness={0.72}
                />
              </mesh>
              <mesh geometry={geometry.lip} position={[0, panelTop, 0]}>
                <VintageMaterial
                  {...coverMaterial}
                  surface="steel"
                  color="#656456"
                  metalness={0.64}
                  roughness={0.65}
                />
              </mesh>
              <mesh
                geometry={geometry.film}
                position={[0, panelTop + 0.0005, 0]}
              >
                <meshStandardMaterial
                  {...coverMaterial}
                  color={lit ? "#554326" : "#11140f"}
                  emissive={lit ? "#a96117" : "#000000"}
                  emissiveIntensity={lit ? 0.3 : 0}
                  metalness={0.03}
                  roughness={0.62}
                />
              </mesh>
              <mesh
                geometry={geometry.lettering}
                position={[0, panelTop + 0.005, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <meshBasicMaterial
                  {...coverMaterial}
                  map={texture}
                  color={lit ? "#ffd17e" : "#c0b9a2"}
                  toneMapped={false}
                  transparent
                  alphaTest={0.035}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                />
              </mesh>
            </group>
          );
        })}
        {[-2.69, 2.69].flatMap((x) =>
          [-0.63, 0.38].map((z) => (
            <group key={`${x}:${z}`}>
              <mesh
                geometry={geometry.standoff}
                position={[x, deckTop + standoffHeight / 2, z]}
              >
                <VintageMaterial
                  {...coverMaterial}
                  surface="steel"
                  color="#5b5c4e"
                  metalness={0.7}
                  roughness={0.7}
                />
              </mesh>
              <PanelScrew
                x={x}
                y={panelTop + 0.007}
                z={z}
                visibility={visibility.current}
              />
            </group>
          )),
        )}
      </group>
      {films.map(({ letter }) => {
        const [x, , z] = keyPoint(letter, "lamp");
        const lit = output === letter && phase >= 10;
        return (
          <group key={letter} position={[x, 0, z]}>
            <mesh
              geometry={geometry.bulb}
              position={[0, 1.224, 0]}
              scale={[0.089, 0.024, 0.089]}
            >
              <meshStandardMaterial
                color={lit ? "#c88b25" : "#767466"}
                emissive={lit ? "#ff991c" : "#000000"}
                emissiveIntensity={lit ? 0.65 : 0}
                transparent
                opacity={0.88}
                roughness={0.24}
                metalness={0.06}
                depthWrite={false}
              />
            </mesh>
            <mesh geometry={geometry.neck} position={[0, 1.189, 0]}>
              <meshStandardMaterial
                color="#b9b9a6"
                roughness={0.35}
                metalness={0.16}
              />
            </mesh>
            <mesh geometry={geometry.socket} position={[0, 1.103, 0]}>
              <VintageMaterial
                surface="steel"
                color="#767267"
                metalness={0.72}
                roughness={0.63}
              />
            </mesh>
            {[1.116, 1.132, 1.148, 1.164].map((y) => (
              <mesh
                key={y}
                geometry={geometry.socketThread}
                position={[0, y, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <meshStandardMaterial
                  color="#8a8470"
                  metalness={0.72}
                  roughness={0.62}
                />
              </mesh>
            ))}
            <mesh geometry={geometry.insulator} position={[0, 1.087, 0]}>
              <VintageMaterial
                surface="bakelite"
                color="#373127"
                roughness={0.82}
                metalness={0.02}
              />
            </mesh>
          </group>
        );
      })}
      <LampWiring output={output} phase={phase} />
    </group>
  );
}

/** The key stems travel through genuine open bores, clear of the moving caps. */
export function KeyboardGuidePanel({ selected }: { selected: boolean }) {
  const geometry = useMemo(
    () => ({
      panel: createHorizontalPanelGeometry(
        KEY_PANEL.width,
        KEY_PANEL.depth,
        KEY_PANEL.thickness,
        keyHoles,
      ),
      // The guide ends meet either face of the plate; its bore bridges them.
      // No cylinder cap closes the hole, and the upper lip ends at Y = 1.297.
      guide: sleeveGeometry(0.105, 0.132, 0.045),
      lip: sleeveGeometry(0.105, 0.132, 0.007),
    }),
    [],
  );
  useEffect(
    () => () => Object.values(geometry).forEach((item) => item.dispose()),
    [geometry],
  );
  return (
    <group>
      <mesh
        geometry={geometry.panel}
        position={[KEY_PANEL.x, KEY_PANEL.bottom, KEY_PANEL.z]}
        castShadow
        receiveShadow
      >
        <VintageMaterial
          surface="enamel"
          color={selected ? "#30332b" : "#22261f"}
          metalness={0.26}
          roughness={0.8}
        />
      </mesh>
      {[...ALPHABET].map((letter) => {
        const [x, , z] = keyPoint(letter, "key");
        return (
          <group key={letter} position={[x, 0, z]}>
            <mesh geometry={geometry.guide} position={[0, 1.21, 0]}>
              <VintageMaterial
                surface="steel"
                color="#3b4035"
                metalness={0.52}
                roughness={0.74}
              />
            </mesh>
            <mesh geometry={geometry.lip} position={[0, 1.29, 0]}>
              <VintageMaterial
                surface="bakelite"
                color="#39372b"
                metalness={0.08}
                roughness={0.74}
              />
            </mesh>
          </group>
        );
      })}
      {[-2.62, 2.62].flatMap((x) =>
        [0.64, 2.18].map((z) => (
          <PanelScrew key={`${x}:${z}`} x={x} y={1.297} z={z} />
        )),
      )}
    </group>
  );
}
