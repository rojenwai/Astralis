"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PerformanceItem } from "@/lib/store";
import { raDecToDir } from "@/lib/celestial";
import { triggerRipple, rippleScreen } from "@/lib/uniforms";
import HoverTarget from "./HoverTarget";

/**
 * Space itself bends. No object appears — the whole scene ripples outward from
 * a point, like a stone dropped into perfectly still water: world-space
 * displacement bends every star and cloud (via the shared uniforms), a
 * screen-space pass warps the final image, and one faint silver ring expands.
 */
const DURATION = 24;

const ringVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ringFragment = /* glsl */ `
uniform float uR;      // normalized wavefront radius 0..1
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float band = exp(-pow((d - uR) * 60.0, 2.0));
  vec3 col = mix(vec3(0.42, 0.45, 0.95), vec3(0.82, 0.86, 1.0), band);
  gl_FragColor = vec4(col, band * uAlpha);
}
`;

export default function GravityRipple({ perf }: { perf: PerformanceItem }) {
  const ev = perf.event;
  const center = useMemo(() => raDecToDir(ev.ra, ev.dec).multiplyScalar(420), [ev]);
  const ringRef = useRef<THREE.Mesh>(null);

  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        uniforms: { uR: { value: 0 }, uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useEffect(() => {
    triggerRipple(center, 0.45 + ev.intensity * 0.65);
  }, [center, ev]);

  const ndc = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const t = (Date.now() - perf.startedAt) / 1000;

    // screen-space warp follows the projected wave center
    ndc.copy(center).project(state.camera);
    const behind = ndc.z > 1 || ndc.z < -1;
    rippleScreen.center.set((ndc.x + 1) / 2, (ndc.y + 1) / 2);
    rippleScreen.t = t;
    rippleScreen.amp = behind ? 0 : (0.4 + ev.intensity * 0.6) * (t < DURATION ? 1 : 0);

    ringMat.uniforms.uR.value = Math.min(1, t / (DURATION * 0.8));
    ringMat.uniforms.uAlpha.value = Math.exp(-t * 0.24) * 0.09;
    if (ringRef.current) ringRef.current.lookAt(state.camera.position);
  });

  // silence the screen warp when the performance ends
  useEffect(
    () => () => {
      rippleScreen.amp = 0;
      rippleScreen.t = 1e4;
    },
    [],
  );

  return (
    <group>
      <mesh ref={ringRef} position={center} scale={[1500, 1500, 1]} material={ringMat} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <HoverTarget position={center} radius={60} event={ev} />
    </group>
  );
}
