import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ROTOR_AXIS, ROTOR_THUMBWHEEL } from "../core/housing-layout";
import { VintageMaterial } from "./VintageMaterials";

function annularGeometry(
  outer: number,
  inner: number,
  depth: number,
  teeth = 0,
) {
  const shape = new THREE.Shape();
  if (teeth) {
    for (let i = 0; i <= teeth * 4; i++) {
      const angle = (i / (teeth * 4)) * Math.PI * 2;
      const radius = i % 4 === 1 || i % 4 === 2 ? outer : outer - 0.026;
      const x = Math.cos(angle) * radius,
        y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
  } else shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 40,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

/** The narrow finger wheel is the only rotating rim exposed through the lid. */
export function RotorThumbwheel() {
  const geometry = useMemo(
    () =>
      annularGeometry(
        ROTOR_THUMBWHEEL.radius,
        ROTOR_THUMBWHEEL.innerRadius,
        ROTOR_THUMBWHEEL.thickness,
        52,
      ),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={[ROTOR_THUMBWHEEL.xOffset, 0, 0]}
      castShadow
    >
      <VintageMaterial
        surface="enamel"
        color="#393c32"
        metalness={0.62}
        roughness={0.6}
      />
    </mesh>
  );
}

/** A bored bearing and bolted foot carry the axle down to the well floor. */
export function RotorBearing({ x }: { x: number }) {
  const geometry = useMemo(() => annularGeometry(0.24, 0.087, 0.16), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh position={[x, 0.788, -1.53]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.075, 0.61]} />
        <VintageMaterial
          surface="steel"
          color="#696858"
          metalness={0.64}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[x, 1.193, -1.53]} castShadow>
        <boxGeometry args={[0.14, 0.735, 0.23]} />
        <VintageMaterial
          surface="steel"
          color="#85816d"
          metalness={0.7}
          roughness={0.56}
        />
      </mesh>
      <mesh
        geometry={geometry}
        position={[x, ROTOR_AXIS.y, ROTOR_AXIS.z]}
        castShadow
      >
        <VintageMaterial
          surface="brass"
          color="#a59870"
          metalness={0.7}
          roughness={0.49}
        />
      </mesh>
      {[-0.22, 0.22].map((z) => (
        <group key={z} position={[x, 0.838, -1.53 + z]}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.045, 0.025, 20]} />
            <VintageMaterial
              surface="steel"
              color="#aaa18b"
              metalness={0.72}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, 0.013, 0]}>
            <boxGeometry args={[0.059, 0.002, 0.008]} />
            <meshStandardMaterial color="#312d25" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
