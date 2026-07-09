"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { raDecToDir } from "@/lib/celestial";
import { setLensMemory, shared } from "@/lib/uniforms";

/**
 * Nothing disappears completely. Every past performance leaves a trace:
 * neutrinos a hair-thin chord of light, GRBs a slowly cooling ember,
 * gravitational waves a permanent lens in the starfield. After weeks the
 * artwork looks different; after months it is unique.
 */
export default function Remnants() {
  const remnants = useStore((s) => s.remnants);

  // --- neutrino chords -----------------------------------------------------
  const lines = useMemo(() => {
    const neutrinos = remnants.filter((r) => r.kind === "neutrino").slice(-80);
    if (neutrinos.length === 0) return null;
    const pos = new Float32Array(neutrinos.length * 6);
    neutrinos.forEach((r, i) => {
      const dir = raDecToDir(r.ra, r.dec);
      const jitter = seededVec(r.at).multiplyScalar(90);
      const a = dir.clone().multiplyScalar(870);
      const b = dir.clone().multiplyScalar(-850).add(jitter);
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [remnants]);

  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(0.55, 0.68, 0.95),
        transparent: true,
        opacity: 0.03,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  // --- GRB embers ----------------------------------------------------------
  const embers = useMemo(() => {
    const grbs = remnants.filter((r) => r.kind === "grb").slice(-60);
    if (grbs.length === 0) return null;
    const now = Date.now();
    const pos = new Float32Array(grbs.length * 3);
    const age = new Float32Array(grbs.length);
    const size = new Float32Array(grbs.length);
    grbs.forEach((r, i) => {
      const p = raDecToDir(r.ra, r.dec).multiplyScalar(600);
      pos.set([p.x, p.y, p.z], i * 3);
      age[i] = Math.min(1, (now - r.at) / (45 * 86400e3)); // cools over ~45 days
      size[i] = 18 + r.intensity * 26;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aAge", new THREE.BufferAttribute(age, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [remnants]);

  const emberMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aAge;
          attribute float aSize;
          varying float vAge;
          void main() {
            vAge = aAge;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (170.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uFlash;
          varying float vAge;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = exp(-d * 3.4);
            vec3 young = vec3(0.9, 0.55, 0.22);
            vec3 old = vec3(0.35, 0.08, 0.10);
            vec3 col = mix(young, old, vAge) * (1.0 + uFlash * 0.8);
            gl_FragColor = vec4(col, a * mix(0.10, 0.035, vAge));
          }
        `,
        uniforms: { uFlash: shared.uFlash },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  // --- gravitational lens memory -------------------------------------------
  useEffect(() => {
    const waves = remnants
      .filter((r) => r.kind === "gw")
      .slice(-8)
      .map((r) => ({ dir: raDecToDir(r.ra, r.dec), amp: 0.25 + r.intensity * 0.35 }));
    setLensMemory(waves);
  }, [remnants]);

  return (
    <group>
      {lines && <lineSegments geometry={lines} material={lineMat} frustumCulled={false} />}
      {embers && <points geometry={embers} material={emberMat} frustumCulled={false} />}
    </group>
  );
}

function seededVec(seed: number): THREE.Vector3 {
  const f = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };
  return new THREE.Vector3(f(1), f(2), f(3));
}
