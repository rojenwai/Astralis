"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { shared } from "@/lib/uniforms";
import { useStore } from "@/lib/store";

const vertex = /* glsl */ `
uniform float uTime;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 p = position;
  // the curtain sways
  p.z += sin(position.x * 0.012 + uTime * 0.16) * 16.0;
  p.x += sin(position.y * 0.02 + uTime * 0.1) * 8.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uMood;
uniform float uStrength;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float streaks = noise(vec2(vUv.x * 9.0 + uTime * 0.05, vUv.y * 1.2));
  streaks = pow(streaks, 1.6);
  float vertical = pow(1.0 - vUv.y, 2.4);
  vec3 green = vec3(0.08, 0.42, 0.26);
  vec3 violet = vec3(0.22, 0.10, 0.38);
  vec3 warm = vec3(0.45, 0.28, 0.10);
  vec3 col = mix(green, violet, vUv.y * 1.2);
  col = mix(col, warm, uMood * 0.45);
  float a = vertical * (0.35 + 0.65 * streaks) * uStrength;
  gl_FragColor = vec4(col, a);
}
`;

/**
 * Aurora curtains — invisible in quiet weather, unfurling as Kp climbs.
 * Strength eases toward the live geomagnetic index.
 */
export default function Aurora() {
  const strength = useRef({ value: 0 });

  const curtains = useMemo(() => {
    const rng = [0.3, 2.4, 4.4];
    return rng.map((angle, i) => {
      const r = 520;
      return {
        position: new THREE.Vector3(Math.cos(angle) * r, -160 - i * 40, Math.sin(angle) * r),
        rotationY: -angle + Math.PI / 2,
        width: 780 + i * 160,
        height: 300 + i * 60,
        material: new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: {
            uTime: shared.uTime,
            uMood: shared.uMood,
            uStrength: strength.current,
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      };
    });
  }, []);

  useFrame((_, dt) => {
    const solar = useStore.getState().solar;
    const kp = solar?.kp ?? 2;
    const target = THREE.MathUtils.clamp((kp - 2.5) / 5.5, 0, 1) * 0.5;
    strength.current.value += (target - strength.current.value) * Math.min(1, dt * 0.1);
  });

  return (
    <group>
      {curtains.map((c, i) => (
        <mesh
          key={i}
          position={c.position}
          rotation={[0, c.rotationY, 0]}
          material={c.material}
          frustumCulled={false}
        >
          <planeGeometry args={[c.width, c.height, 48, 6]} />
        </mesh>
      ))}
    </group>
  );
}
