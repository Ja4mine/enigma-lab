import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VintageMaterial } from "./VintageMaterials";
export { HousingAnatomy } from "./HistoricalHousing";

type Point = [number, number, number];
interface PartProps {
  spread: number;
  isolate?: string;
  onPartClick?: (id: string) => void;
}
const BRASS = "#b49b63",
  STEEL = "#a8aa9e",
  BAKELITE = "#2b2d23",
  ENAMEL = "#464b3b",
  IVORY = "#e8dcc0";
const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1);

function Part({
  id,
  isolate = "all",
  onPartClick,
  children,
}: {
  id: string;
  isolate?: string;
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
function Metal({
  color = BRASS,
  roughness = 0.36,
}: {
  color?: string;
  roughness?: number;
}) {
  return (
    <VintageMaterial
      surface={
        color === BAKELITE
          ? "bakelite"
          : color === STEEL
            ? "steel"
            : color === ENAMEL
              ? "enamel"
              : "brass"
      }
      color={color}
      roughness={roughness}
      metalness={color === BAKELITE ? 0.08 : color === ENAMEL ? 0.3 : 0.74}
    />
  );
}
function Box({
  size,
  position,
  color = BRASS,
  radius = 0.04,
  rotation = [0, 0, 0],
}: {
  size: Point;
  position: Point;
  color?: string;
  radius?: number;
  rotation?: Point;
}) {
  return (
    <RoundedBox
      args={size}
      position={position}
      radius={radius}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <Metal color={color} />
    </RoundedBox>
  );
}

function Label({
  text,
  position,
  rotation = [0, 0, 0],
  size = 0.3,
  color = IVORY,
}: {
  text: string;
  position: Point;
  rotation?: Point;
  size?: number;
  color?: string;
}) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const c = canvas.getContext("2d")!;
    c.fillStyle = color;
    c.font = `600 ${text.length < 3 ? 106 : 67}px "Courier New", monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 256, 68, 490);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [text, color]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size * 4, size]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
/** Ring axis is Z, with a real central opening. */
function Ring({
  inner,
  outer,
  length,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = BRASS,
}: {
  inner: number;
  outer: number;
  length: number;
  position?: Point;
  rotation?: Point;
  color?: string;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: true,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      bevelSegments: 2,
      curveSegments: 28,
    });
    g.translate(0, 0, -length / 2);
    return g;
  }, [inner, outer, length]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      castShadow
    >
      <Metal color={color} />
    </mesh>
  );
}
function Rod({
  from,
  to,
  radius = 0.04,
  color = STEEL,
}: {
  from: Point;
  to: Point;
  radius?: number;
  color?: string;
}) {
  const data = useMemo(() => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    return {
      center: a.clone().add(b).multiplyScalar(0.5),
      length: a.distanceTo(b),
      q: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      ),
    };
  }, [from, to]);
  return (
    <mesh position={data.center} quaternion={data.q} castShadow>
      <cylinderGeometry args={[radius, radius, data.length, 24]} />
      <Metal color={color} />
    </mesh>
  );
}
function Cable({
  points,
  radius = 0.04,
  color = STEEL,
}: {
  points: Point[];
  radius?: number;
  color?: string;
}) {
  const key = points.map((p) => p.join(",")).join(";");
  const geometry = useMemo(() => {
    const vertices = key
      .split(";")
      .map((p) => new THREE.Vector3(...(p.split(",").map(Number) as Point)));
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(vertices),
      64,
      radius,
      10,
      false,
    );
  }, [key, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <Metal color={color} roughness={0.5} />
    </mesh>
  );
}
/** Flat spring strip: unlike a wire, its cross section has a wide face. */
function Leaf({
  points,
  width = 0.15,
  thickness = 0.025,
}: {
  points: Point[];
  width?: number;
  thickness?: number;
}) {
  const key = points.map((p) => p.join(",")).join(";");
  const geometry = useMemo(() => {
    const vertices = key
      .split(";")
      .map((p) => new THREE.Vector3(...(p.split(",").map(Number) as Point)));
    const curve = new THREE.CatmullRomCurve3(vertices);
    const positions: number[] = [],
      indices: number[] = [],
      count = 40;
    for (let i = 0; i <= count; i++) {
      const p = curve.getPoint(i / count),
        t = curve.getTangent(i / count);
      const normal = new THREE.Vector3(0, -t.z, t.y).normalize();
      for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const v = p.clone().addScaledVector(normal, (b * thickness) / 2);
        v.x += (a * width) / 2;
        positions.push(v.x, v.y, v.z);
      }
      if (i < count)
        for (let k = 0; k < 4; k++) {
          const a = i * 4 + k,
            b = i * 4 + ((k + 1) % 4);
          indices.push(a, b, a + 4, b, b + 4, a + 4);
        }
    }
    indices.push(
      0,
      2,
      1,
      0,
      3,
      2,
      count * 4,
      count * 4 + 1,
      count * 4 + 2,
      count * 4,
      count * 4 + 2,
      count * 4 + 3,
    );
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [key, width, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <Metal color="#cab27e" />
    </mesh>
  );
}

function Screw({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  gap = 0,
}: {
  position: Point;
  rotation?: Point;
  scale?: number;
  gap?: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, -0.13, 0]} castShadow>
        <cylinderGeometry args={[0.034, 0.034, 0.29, 16]} />
        <Metal />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          position={[0, -0.058 - i * 0.034, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.038, 0.008, 5, 18]} />
          <Metal />
        </mesh>
      ))}
      <Ring
        inner={0.037}
        outer={0.105}
        length={0.02}
        position={[0, -0.039 - gap, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        color={STEEL}
      />
      <mesh castShadow>
        <cylinderGeometry args={[0.078, 0.078, 0.036, 28]} />
        <Metal />
      </mesh>
      <mesh position={[0, 0.019, 0]}>
        <boxGeometry args={[0.105, 0.003, 0.016]} />
        <meshStandardMaterial color="#3c3525" />
      </mesh>
    </group>
  );
}
interface Hole {
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
}
function Plate({
  width,
  height,
  depth,
  holes,
  position,
  rotation = [0, 0, 0],
  color = ENAMEL,
}: {
  width: number;
  height: number;
  depth: number;
  holes: Hole[];
  position: Point;
  rotation?: Point;
  color?: string;
}) {
  const key = JSON.stringify(holes);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const w = width / 2,
      h = height / 2,
      r = 0.06;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    for (const item of JSON.parse(key) as Hole[]) {
      const hole = new THREE.Path();
      if (item.radius)
        hole.absarc(item.x, item.y, item.radius, 0, Math.PI * 2, true);
      else {
        const a = item.width! / 2,
          b = item.height! / 2;
        hole.moveTo(item.x - a, item.y - b);
        hole.lineTo(item.x - a, item.y + b);
        hole.lineTo(item.x + a, item.y + b);
        hole.lineTo(item.x + a, item.y - b);
        hole.closePath();
      }
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
      curveSegments: 24,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [width, height, depth, key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <Metal color={color} roughness={0.53} />
    </mesh>
  );
}

/** Two-pin plug, double socket and schematic normal-through spring contacts. */
export function PlugAnatomy({
  spread,
  isolate = "all",
  onPartClick,
}: PartProps) {
  const s = clamp(spread),
    selection = { isolate, onPartClick };
  const holes = useMemo(
    () => [-0.4, 0.4].map((x) => ({ x, y: 0, radius: 0.17 })),
    [],
  );
  return (
    <group position={[0, 0, -0.5]}>
      <Part id="sockets" {...selection}>
        <Plate
          width={2.25}
          height={1.83}
          depth={0.14}
          holes={holes}
          position={[0, 0, -0.14]}
          color="#30382e"
        />
        <Label text="A" position={[0, 0.64, -0.057]} size={0.31} />
        {[-0.94, 0.94].flatMap((x) =>
          [-0.73, 0.73].map((y) => (
            <Screw
              key={`${x}-${y}`}
              position={[x, y, -0.037 + s * 0.15]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={0.8}
              gap={s * 0.12}
            />
          )),
        )}
        {[-0.4, 0.4].map((x) => (
          <group key={x}>
            <Ring
              inner={0.122}
              outer={0.17}
              length={0.23}
              position={[x, 0, -0.11]}
              color="#514737"
            />
            <Ring
              inner={0.123}
              outer={0.23}
              length={0.042}
              position={[x, 0, 0.042 + s * 0.13]}
            />
            <Ring
              inner={0.123}
              outer={0.205}
              length={0.051}
              position={[x, 0, -0.32 - s * 0.21]}
            />
          </group>
        ))}
      </Part>
      <Part id="pins" {...selection}>
        <group position={[0, 0, s * 0.55]}>
          {[-0.4, 0.4].map((x) => (
            <group key={x}>
              <mesh
                position={[x, 0, 0.267]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.098, 0.098, 1.15, 32]} />
                <Metal color="#c3b584" />
              </mesh>
              <mesh
                position={[x, 0, -0.335]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.07, 0.098, 0.055, 32]} />
                <Metal color="#c3b584" />
              </mesh>
              <Ring
                inner={0.1}
                outer={0.155}
                length={0.04}
                position={[x, 0, 0.789]}
              />
            </group>
          ))}
        </group>
      </Part>
      <Part id="body" {...selection}>
        <group position={[0, 0, s * 1.12]}>
          <RoundedBox
            args={[1.42, 0.68, 0.92]}
            radius={0.15}
            position={[0, 0, 1.14]}
            castShadow
          >
            <VintageMaterial
              surface="bakelite"
              color={BAKELITE}
              roughness={0.35}
              metalness={0.08}
            />
          </RoundedBox>
          <RoundedBox
            args={[1.57, 0.79, 0.14]}
            radius={0.07}
            position={[0, 0, 0.72]}
            castShadow
          >
            <VintageMaterial
              surface="bakelite"
              color="#3b3b2e"
              roughness={0.39}
            />
          </RoundedBox>
          {[-0.71, 0.71].flatMap((x) =>
            Array.from({ length: 5 }, (_, i) => (
              <Box
                key={`${x}-${i}`}
                size={[0.022, 0.42, 0.04]}
                position={[x, 0, 0.86 + i * 0.12]}
                radius={0.011}
                color="#494b3b"
              />
            )),
          )}
          <Label
            text="A"
            position={[0, 0.346, 1.12]}
            rotation={[-Math.PI / 2, 0, 0]}
            size={0.25}
            color="#afa98c"
          />
        </group>
      </Part>
      <Part id="cable" {...selection}>
        <group position={[0, 0, s * 1.12]}>
          <Ring
            inner={0.1}
            outer={0.24}
            length={0.24}
            position={[0, 0, 1.68]}
            color="#302f25"
          />
          {Array.from({ length: 5 }, (_, i) => (
            <mesh
              key={i}
              position={[0, 0, 1.8 + i * 0.081]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry
                args={[0.23 - i * 0.024, 0.23 - i * 0.024, 0.068, 24]}
              />
              <VintageMaterial
                surface="bakelite"
                color="#34352b"
                roughness={0.65}
              />
            </mesh>
          ))}
          <Cable
            points={[
              [0, 0, 2.1],
              [0.05, -0.01, 2.32],
              [0.24, -0.17, 2.58],
              [0.55, -0.26, 2.8],
            ]}
            radius={0.095}
            color="#414236"
          />
        </group>
      </Part>
      <Part id="leaves" {...selection}>
        <group position={[0, 0, -s * 0.9]}>
          <Box
            size={[1.87, 0.19, 0.42]}
            position={[0, -0.64, -0.89]}
            radius={0.05}
            color="#6b6243"
          />
          {[-0.4, 0.4].map((x) => (
            <group key={x}>
              <Box
                size={[0.16, 0.74, 0.06]}
                position={[x, -0.29, -0.98]}
                radius={0.017}
                color="#c0aa71"
              />
              <Leaf
                points={[
                  [x, -0.61, -0.8],
                  [x, -0.26, -0.69],
                  [x, 0.018, -0.42],
                  [x, 0.045, -0.18],
                ]}
                width={0.15}
                thickness={0.025}
              />
              <mesh position={[x, 0.019, -0.46]}>
                <sphereGeometry args={[0.068, 16, 12]} />
                <Metal color="#dedbcc" />
              </mesh>
              <Screw
                position={[x, -0.53, -0.668]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={1.05}
                gap={s * 0.06}
              />
              <Cable
                points={[
                  [x, -0.64, -1.02],
                  [x, -0.82, -1.2],
                  [x * 1.8, -0.84, -1.47],
                ]}
                radius={0.035}
                color={x < 0 ? "#9b7b4a" : "#647469"}
              />
            </group>
          ))}
          <Box
            size={[0.87, 0.045, 0.083]}
            position={[0, 0.013, -1.018]}
            radius={0.017}
            color="#bcab77"
          />
        </group>
      </Part>
    </group>
  );
}

function Spring({ length, position }: { length: number; position: Point }) {
  // A unit coil is generated once. Y scaling gives elastic compression without
  // generating a new high-resolution tube during the animation.
  const geometry = useMemo(() => {
    const points = Array.from({ length: 193 }, (_, i) => {
      const t = i / 192,
        a = t * Math.PI * 16;
      return new THREE.Vector3(Math.cos(a) * 0.225, t, Math.sin(a) * 0.225);
    });
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      200,
      0.029,
      8,
      false,
    );
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      scale={[1, length, 1]}
      castShadow
    >
      <Metal color="#aaa58d" roughness={0.31} />
    </mesh>
  );
}

/** Enlarged pushrod, return coil, lever and electrical switch. */
export function KeyAnatomy({
  spread,
  progress,
  isolate = "all",
  onPartClick,
}: PartProps & { progress: number }) {
  const s = clamp(spread),
    p = clamp(progress),
    selection = { isolate, onPartClick };
  const depression =
    p < 0.36
      ? THREE.MathUtils.smoothstep(p, 0, 0.36)
      : p < 0.62
        ? 1
        : 1 - THREE.MathUtils.smoothstep(p, 0.62, 1);
  const travel = depression * 0.24,
    keyY = 1.01 + s * 0.84 - travel;
  // The input arm is long and the switch arm short: 0.24 key travel becomes
  // roughly 0.055 roller lift. Solve the same rigid linkage for every part.
  const linkagePose = (stroke: number) => {
    const angle =
      Math.atan2(0.2, 1.32) - Math.asin((0.2 - stroke) / Math.hypot(1.32, 0.2));
    const rollerX = 1.32 + 0.3 * Math.cos(angle) + 0.02 * Math.sin(angle);
    const rollerY = -0.81 + 0.3 * Math.sin(angle) - 0.02 * Math.cos(angle);
    // Tangency to the underside of a 0.035-thick leaf, anchored at (2.07,-0.74).
    // A narrow-angle binary solve avoids mismatched independent animations.
    let low = -0.35,
      high = 0;
    for (let i = 0; i < 24; i++) {
      const leaf = (low + high) / 2;
      const gap =
        -(rollerX - 2.07) * Math.sin(leaf) +
        (rollerY + 0.74) * Math.cos(leaf) +
        0.0725 +
        0.0175;
      if (gap > 0) high = leaf;
      else low = leaf;
    }
    return { angle, leaf: (low + high) / 2 };
  };
  const pose = linkagePose(travel);
  const closedPose = linkagePose(0.24);
  const fixedContactX =
    0.42 -
    0.58 * Math.cos(closedPose.leaf) -
    0.0395 * Math.sin(closedPose.leaf);
  const fixedContactY =
    -0.04 -
    0.58 * Math.sin(closedPose.leaf) +
    0.0395 * Math.cos(closedPose.leaf) +
    0.044;
  return (
    <group position={[-0.6, -0.08, 0]}>
      <Part id="cap" {...selection}>
        <group position={[0, keyY, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.62, 0.6, 0.18, 64]} />
            <VintageMaterial
              surface="bakelite"
              color={BAKELITE}
              metalness={0.1}
              roughness={0.32}
            />
          </mesh>
          <Ring
            inner={0.513}
            outer={0.64}
            length={0.045}
            position={[0, 0.218, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            color={STEEL}
          />
          <mesh position={[0, 0.224, 0]}>
            <cylinderGeometry args={[0.513, 0.513, 0.035, 64]} />
            <VintageMaterial
              surface="bakelite"
              color="#24291f"
              roughness={0.42}
            />
          </mesh>
          <Label
            text="A"
            position={[0, 0.245, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            size={0.66}
          />
          <mesh position={[0, -0.024, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.18, 0.13, 32]} />
            <Metal color={STEEL} />
          </mesh>
        </group>
      </Part>
      <Part id="stem" {...selection}>
        <Box
          size={[3.36, 0.14, 2.24]}
          position={[0.5, -1.13 - s * 0.38, 0]}
          radius={0.06}
          color="#515644"
        />
        <mesh
          position={[0, 0.204 - travel + s * 0.355, 0]}
          scale={[1, 1 + s * 0.153, 1]}
          castShadow
        >
          <cylinderGeometry args={[0.098, 0.098, 1.628, 24]} />
          <Metal color={STEEL} />
        </mesh>
        <Ring
          inner={0.116}
          outer={0.195}
          length={0.52}
          position={[0, -0.328 + s * 0.11, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          color={STEEL}
        />
        <Plate
          width={1.7}
          height={1.38}
          depth={0.09}
          holes={[{ x: 0, y: 0, radius: 0.202 }]}
          position={[0, -0.315 + s * 0.09, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {[-0.68, 0.68].map((x) => (
          <group key={x}>
            <Box
              size={[0.1, 0.75, 0.74]}
              position={[x, -0.74, 0]}
              radius={0.025}
              color="#686f5d"
            />
            <Screw
              position={[x, -0.246 + s * 0.21, 0]}
              scale={0.85}
              gap={s * 0.11}
            />
          </group>
        ))}
        {[-0.9, 1.9].flatMap((x) =>
          [-0.83, 0.83].map((z) => (
            <Screw
              key={`${x}-${z}`}
              position={[x, -1.041 - s * 0.29, z]}
              scale={0.9}
              gap={s * 0.08}
            />
          )),
        )}
      </Part>
      <Part id="spring" {...selection}>
        <mesh position={[0, 0.69 + s * 0.5 - travel, 0]} castShadow>
          <cylinderGeometry args={[0.29, 0.29, 0.055, 36]} />
          <Metal />
        </mesh>
        <Spring
          length={0.69 - travel + s * 0.19}
          position={[0, -0.027 + s * 0.31, 0]}
        />
        <Ring
          inner={0.115}
          outer={0.29}
          length={0.1}
          position={[0, -0.032 + s * 0.31, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </Part>
      <Part id="lever" {...selection}>
        <group position={[1.32, -0.81, 0]} rotation={[0, 0, pose.angle]}>
          <Box
            size={[1.8, 0.11, 0.19]}
            position={[-0.5, 0, 0]}
            radius={0.032}
            color="#afa689"
          />
          <Ring inner={0.07} outer={0.17} length={0.23} color={BRASS} />
          <Rod from={[-1.32, 0, 0]} to={[-1.32, 0.2, 0]} radius={0.075} />
          {/* The crosswise insulated roller supports both spring leaves. */}
          <mesh
            position={[0.3, -0.02, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.0725, 0.0725, 0.64, 28]} />
            <meshStandardMaterial color="#62553d" roughness={0.48} />
          </mesh>
        </group>
        <Rod
          from={[1.32, -0.81, -0.48]}
          to={[1.32, -0.81, 0.48]}
          radius={0.065}
        />
        {[-0.4, 0.4].map((z) => (
          <Box
            key={z}
            size={[0.16, 0.28, 0.12]}
            position={[1.32, -0.95, z]}
            radius={0.027}
            color="#5e6858"
          />
        ))}
      </Part>
      <Part id="contacts" {...selection}>
        <group position={[1.65 + s * 0.56, -0.7, 0]}>
          <Box
            size={[0.38, 0.47, 0.92]}
            position={[0.42, -0.16, 0]}
            radius={0.037}
            color="#63583b"
          />
          {[-0.24, 0.24].map((z) => (
            <group key={z}>
              <group position={[0.42, -0.04, 0]} rotation={[0, 0, pose.leaf]}>
                <Box
                  size={[0.87, 0.035, 0.115]}
                  position={[-0.39, 0, z]}
                  radius={0.012}
                  color="#c9b17a"
                />
                <mesh position={[-0.58, 0.0395, z]}>
                  <sphereGeometry args={[0.022, 18, 12]} />
                  <Metal color="#c8cbc3" />
                </mesh>
              </group>
              <Box
                size={[0.63, 0.048, 0.115]}
                position={[0.11, fixedContactY + 0.046, z]}
                radius={0.014}
                color="#bcaa7b"
              />
              <mesh position={[fixedContactX, fixedContactY, z]}>
                <sphereGeometry args={[0.022, 18, 12]} />
                <Metal color="#e1ddc8" />
              </mesh>
              <Screw position={[0.42, 0.117, z]} scale={0.65} />
              <Cable
                points={[
                  [0.49, -0.28, z],
                  [0.7, -0.3, z],
                  [0.85, -0.45, z * 1.6],
                ]}
                radius={0.034}
                color={z < 0 ? "#907344" : "#647967"}
              />
            </group>
          ))}
        </group>
      </Part>
    </group>
  );
}
