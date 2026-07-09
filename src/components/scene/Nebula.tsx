"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { shared, cosmicUniformsGLSL, cosmicDisplaceGLSL } from "@/lib/uniforms";

const vertex = /* glsl */ `
${cosmicUniformsGLSL}
${cosmicDisplaceGLSL}
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 p = cosmicDisplace(wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uMood;
uniform float uFlash;
uniform float uSeed;
uniform float uHue;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.3);
    a *= 0.55;
  }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * 3.0 + uSeed;
  float t = uTime * 0.008;
  // domain-warped drift — the clouds never loop
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t * 0.7));
  float n = fbm(p + 1.9 * q);

  float rad = length(vUv - 0.5) * 2.0;
  float edge = smoothstep(1.0, 0.3, rad);

  vec3 deep = vec3(0.03, 0.06, 0.16);
  vec3 violet = vec3(0.14, 0.09, 0.26);
  vec3 teal = vec3(0.04, 0.16, 0.22);
  vec3 gold = vec3(0.42, 0.27, 0.10);

  vec3 col = mix(deep, violet, smoothstep(0.25, 0.85, n));
  col = mix(col, teal, q.x * (0.6 - uHue * 0.3));
  col = mix(col, gold, uMood * smoothstep(0.45, 0.95, n) * (0.55 + uHue * 0.4));
  col *= (1.0 + uFlash * 2.2);

  float alpha = edge * smoothstep(0.3, 0.9, n) * (0.24 + uMood * 0.12);
  gl_FragColor = vec4(col, alpha);
}
`;

interface Cloud {
  position: THREE.Vector3;
  scale: number;
  seed: number;
  hue: number;
  rotation: number;
}

export default function Nebula() {
  const clouds = useMemo<Cloud[]>(() => {
    const rng = mulberry(20260709);
    return Array.from({ length: 6 }, (_, i) => {
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const r = 380 + rng() * 320;
      const s = Math.sqrt(1 - u * u);
      return {
        position: new THREE.Vector3(r * s * Math.cos(th), r * u * 0.7, r * s * Math.sin(th)),
        scale: 550 + rng() * 500,
        seed: i * 13.7 + rng() * 5,
        hue: rng(),
        rotation: rng() * Math.PI * 2,
      };
    });
  }, []);

  return (
    <group>
      {clouds.map((c, i) => (
        <NebulaPlane key={i} cloud={c} />
      ))}
    </group>
  );
}

function NebulaPlane({ cloud }: { cloud: Cloud }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          ...(shared as unknown as Record<string, THREE.IUniform>),
          uSeed: { value: cloud.seed },
          uHue: { value: cloud.hue },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [cloud],
  );

  return (
    <mesh
      position={cloud.position}
      scale={[cloud.scale, cloud.scale, 1]}
      onUpdate={(m) => {
        m.lookAt(0, 0, 0);
        m.rotateZ(cloud.rotation);
      }}
      material={material}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
    </mesh>
  );
}

/** Deterministic RNG so the nebulae are a stable signature of this installation. */
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
