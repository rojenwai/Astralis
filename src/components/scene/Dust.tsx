"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { shared } from "@/lib/uniforms";

const COUNT = 1100;

const vertex = /* glsl */ `
uniform float uTime;
uniform float uMood;
attribute float aPhase;
attribute float aSize;
varying float vFade;

void main() {
  float t = uTime * (0.5 + uMood * 0.9);
  vec3 p = position;
  p.x += sin(t * 0.11 + aPhase) * 7.0;
  p.y += cos(t * 0.09 + aPhase * 1.7) * 5.0;
  p.z += sin(t * 0.07 + aPhase * 2.3) * 7.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vFade = smoothstep(4.0, 30.0, d) * smoothstep(160.0, 90.0, d);
  gl_PointSize = aSize * (60.0 / d);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
uniform float uMood;
uniform float uFlash;
varying float vFade;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  vec3 col = mix(vec3(0.6, 0.7, 0.9), vec3(0.95, 0.85, 0.65), uMood);
  gl_FragColor = vec4(col * (1.0 + uFlash), a * vFade * 0.22);
}
`;

/** Near-field motes drifting through the void — depth for the camera's parallax. */
export default function Dust() {
  const { geometry, material } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = 10 + Math.pow(Math.random(), 0.5) * 130;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(th);
      phase[i] = Math.random() * Math.PI * 2;
      size[i] = 0.8 + Math.random() * 2.4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: shared as unknown as Record<string, THREE.IUniform>,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, []);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
