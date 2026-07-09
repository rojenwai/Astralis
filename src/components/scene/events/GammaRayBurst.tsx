"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PerformanceItem } from "@/lib/store";
import { raDecToDir } from "@/lib/celestial";
import { shared } from "@/lib/uniforms";
import HoverTarget from "./HoverTarget";

/**
 * The brightest explosions in the universe. A brilliant white core, an expanding
 * sphere of light, thousands of golden particles, and a whole-sky flash that
 * briefly illuminates every star and nebula. Then darkness returns.
 */
const DURATION = 16;
const PARTICLES = 2400;

const coreFragment = /* glsl */ `
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = exp(-d * 5.0);
  float halo = exp(-d * 2.2) * 0.45;
  float edge = smoothstep(1.0, 0.72, d); // the billboard must vanish before its corners
  vec3 col = mix(vec3(1.0, 0.85, 0.55), vec3(1.0), core);
  gl_FragColor = vec4(col, (core + halo) * edge * uAlpha);
}
`;

const billboardVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const shellVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const shellFragment = /* glsl */ `
uniform float uAlpha;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 6.0);
  vec3 col = mix(vec3(1.0, 0.66, 0.32), vec3(1.0, 0.93, 0.75), rim) * 1.4;
  gl_FragColor = vec4(col, rim * uAlpha);
}
`;

const particleVertex = /* glsl */ `
attribute vec3 aDir;
attribute float aSpeed;
attribute float aSeed;
uniform float uT;
varying float vSeed;
void main() {
  vSeed = aSeed;
  vec3 p = position + aDir * aSpeed * pow(uT, 0.6) * 150.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.8 + aSeed * 3.4) * (150.0 / -mv.z) * (1.0 - uT * 0.55);
  gl_Position = projectionMatrix * mv;
}
`;

const particleFragment = /* glsl */ `
uniform float uT;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.03, d);
  vec3 col = mix(vec3(1.0), vec3(1.0, 0.7, 0.32), clamp(uT * 2.4, 0.0, 1.0));
  col = mix(col, vec3(0.85, 0.24, 0.1), clamp((uT - 0.3) * 1.7, 0.0, 1.0) * vSeed);
  float fade = (1.0 - uT) * (1.0 - uT);
  gl_FragColor = vec4(col, a * fade * 0.9);
}
`;

export default function GammaRayBurst({ perf }: { perf: PerformanceItem }) {
  const ev = perf.event;
  const center = useMemo(() => raDecToDir(ev.ra, ev.dec).multiplyScalar(380), [ev]);
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);

  const { particles, coreMat, shellMat, particleMat } = useMemo(() => {
    const pos = new Float32Array(PARTICLES * 3); // all start at the core
    const dir = new Float32Array(PARTICLES * 3);
    const speed = new Float32Array(PARTICLES);
    const seed = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      // slight anisotropy: filaments form where speeds cluster
      const sp = 0.15 + Math.pow(Math.random(), 1.8) * 0.85;
      dir[i * 3] = s * Math.cos(th);
      dir[i * 3 + 1] = u;
      dir[i * 3 + 2] = s * Math.sin(th);
      speed[i] = sp;
      seed[i] = Math.random();
    }
    const particles = new THREE.BufferGeometry();
    particles.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    particles.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    particles.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    particles.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));

    const opts = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: billboardVertex,
      fragmentShader: coreFragment,
      uniforms: { uAlpha: { value: 0 } },
      ...opts,
      side: THREE.DoubleSide,
    });
    const shellMat = new THREE.ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: shellFragment,
      uniforms: { uAlpha: { value: 0 } },
      ...opts,
      side: THREE.BackSide,
    });
    const particleMat = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: { uT: { value: 0 } },
      ...opts,
    });
    return { particles, coreMat, shellMat, particleMat };
  }, []);

  // the whole universe feels it
  useEffect(() => {
    shared.uFlash.value = Math.min(1, 0.5 + ev.intensity * 0.5);
  }, [ev]);

  useFrame((state) => {
    const t = (Date.now() - perf.startedAt) / 1000;
    const uT = Math.min(1, t / DURATION);
    particleMat.uniforms.uT.value = uT;
    coreMat.uniforms.uAlpha.value = Math.min(1, t * 3) * Math.exp(-t * 0.55) * (0.7 + ev.intensity * 0.3);
    shellMat.uniforms.uAlpha.value = Math.min(1, t * 2) * Math.exp(-t * 0.55) * 0.22;
    if (coreRef.current) {
      const s = 30 + 130 * (1 - Math.exp(-t * 1.8));
      coreRef.current.scale.setScalar(s);
      coreRef.current.lookAt(state.camera.position);
    }
    if (shellRef.current) {
      shellRef.current.scale.setScalar(8 + t * 85);
    }
  });

  return (
    <group position={center}>
      <mesh ref={coreRef} material={coreMat} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={shellRef} material={shellMat} frustumCulled={false}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
      <points geometry={particles} material={particleMat} frustumCulled={false} />
      <HoverTarget position={new THREE.Vector3(0, 0, 0)} radius={55} event={ev} />
    </group>
  );
}
