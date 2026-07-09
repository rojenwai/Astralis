"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { shared, cosmicUniformsGLSL, cosmicDisplaceGLSL } from "@/lib/uniforms";

const COUNT = 16000;

const vertex = /* glsl */ `
${cosmicUniformsGLSL}
${cosmicDisplaceGLSL}
attribute float aSize;
attribute float aPhase;
attribute float aTint;
attribute float aSpeed;
varying float vTint;
varying float vTwinkle;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 p = cosmicDisplace(wp.xyz);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float tw = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;
  vTwinkle = 0.35 + 0.65 * tw;
  vTint = aTint;
  gl_PointSize = aSize * (170.0 / -mv.z) * (0.8 + 0.4 * tw);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
uniform float uMood;
uniform float uFlash;
varying float vTint;
varying float vTwinkle;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 1.8);
  vec3 cool = vec3(0.72, 0.82, 1.0);
  vec3 warm = vec3(1.0, 0.86, 0.6);
  vec3 col = mix(cool, warm, clamp(vTint * 0.5 + uMood * 0.4, 0.0, 1.0));
  float bright = vTwinkle * (1.0 + uFlash * 1.7);
  gl_FragColor = vec4(col * bright, a * (0.68 + 0.32 * vTwinkle));
}
`;

export default function Starfield() {
  const { geometry, material } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const tint = new Float32Array(COUNT);
    const speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // uniform on sphere, radius biased toward the far shell
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = 280 + Math.pow(Math.random(), 0.65) * 720;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(th);
      size[i] = 0.7 + Math.pow(Math.random(), 3) * 3.2;
      phase[i] = Math.random() * Math.PI * 2;
      tint[i] = Math.random();
      speed[i] = 0.25 + Math.random() * 1.3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute("aTint", new THREE.BufferAttribute(tint, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));

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
