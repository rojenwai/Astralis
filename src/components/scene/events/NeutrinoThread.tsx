"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PerformanceItem } from "@/lib/store";
import { raDecToDir } from "@/lib/celestial";
import HoverTarget from "./HoverTarget";

/**
 * A ghost: a nearly invisible thread that silently crosses the entire universe,
 * passing through everything. Long fading trail, a few particles peeling away.
 * Deliberately missable.
 */
const SAMPLES = 150;
const TRAVEL_SECONDS = 24;
const TOTAL_SECONDS = 30;

const ribbonVertex = /* glsl */ `
attribute vec3 aTangent;
attribute float aSide;
attribute float aProgress;
uniform float uHead;
varying float vProgress;

void main() {
  vProgress = aProgress;
  vec3 toCam = normalize(cameraPosition - position);
  vec3 side = normalize(cross(toCam, aTangent));
  float w = 0.7 + 2.4 * exp(-abs(uHead - aProgress) * 42.0);
  vec3 p = position + side * aSide * w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const ribbonFragment = /* glsl */ `
uniform float uHead;
uniform float uFade;
uniform float uIntensity;
varying float vProgress;

void main() {
  float behind = uHead - vProgress;
  float trail = step(0.0, behind) * exp(-behind * 5.5);
  float head = exp(-abs(behind) * 70.0);
  vec3 col = mix(vec3(0.62, 0.76, 1.0), vec3(1.0), head);
  float alpha = (trail * 0.3 + head * 0.85) * uFade * uIntensity;
  gl_FragColor = vec4(col, alpha);
}
`;

const moteVertex = /* glsl */ `
attribute float aProgress;
attribute float aLag;
attribute float aSeed;
uniform float uHead;
varying float vAlpha;

void main() {
  float behind = uHead - aProgress - aLag;
  vAlpha = step(0.0, behind) * exp(-behind * 7.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (1.5 + aSeed * 2.5) * (90.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const moteFragment = /* glsl */ `
uniform float uFade;
uniform float uIntensity;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), a * vAlpha * uFade * uIntensity * 0.5);
}
`;

export default function NeutrinoThread({ perf }: { perf: PerformanceItem }) {
  const ev = perf.event;

  const { ribbon, motes, ribbonMat, moteMat, mid } = useMemo(() => {
    const rng = seeded(ev.id);
    const dir = raDecToDir(ev.ra, ev.dec);
    // a perpendicular frame so the path passes near — never through — the viewer
    const perpA = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    if (perpA.lengthSq() < 0.01) perpA.set(1, 0, 0);
    const perpB = dir.clone().cross(perpA).normalize();
    const off = (r: number) =>
      perpA.clone().multiplyScalar((rng() - 0.5) * r).add(perpB.clone().multiplyScalar((rng() - 0.5) * r));

    const start = dir.clone().multiplyScalar(880).add(off(120));
    const mid = off(1).normalize().multiplyScalar(45 + rng() * 70);
    const end = dir.clone().multiplyScalar(-860).add(off(240));
    const curve = new THREE.CatmullRomCurve3([start, mid, end], false, "catmullrom", 0.4);
    const pts = curve.getPoints(SAMPLES - 1);

    // ribbon: two vertices per sample, expanded in the vertex shader
    const pos = new Float32Array(SAMPLES * 2 * 3);
    const tan = new Float32Array(SAMPLES * 2 * 3);
    const side = new Float32Array(SAMPLES * 2);
    const prog = new Float32Array(SAMPLES * 2);
    const idx: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const p = pts[i];
      const t = curve.getTangent(i / (SAMPLES - 1));
      for (let k = 0; k < 2; k++) {
        const v = i * 2 + k;
        pos.set([p.x, p.y, p.z], v * 3);
        tan.set([t.x, t.y, t.z], v * 3);
        side[v] = k === 0 ? -1 : 1;
        prog[v] = i / (SAMPLES - 1);
      }
      if (i < SAMPLES - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    ribbon.setAttribute("aTangent", new THREE.BufferAttribute(tan, 3));
    ribbon.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    ribbon.setAttribute("aProgress", new THREE.BufferAttribute(prog, 1));
    ribbon.setIndex(idx);

    // motes peeling from the trail
    const M = 90;
    const mpos = new Float32Array(M * 3);
    const mprog = new Float32Array(M);
    const mlag = new Float32Array(M);
    const mseed = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      const f = rng();
      const p = curve.getPoint(f);
      mpos[i * 3] = p.x + (rng() - 0.5) * 9;
      mpos[i * 3 + 1] = p.y + (rng() - 0.5) * 9;
      mpos[i * 3 + 2] = p.z + (rng() - 0.5) * 9;
      mprog[i] = f;
      mlag[i] = rng() * 0.04;
      mseed[i] = rng();
    }
    const motes = new THREE.BufferGeometry();
    motes.setAttribute("position", new THREE.BufferAttribute(mpos, 3));
    motes.setAttribute("aProgress", new THREE.BufferAttribute(mprog, 1));
    motes.setAttribute("aLag", new THREE.BufferAttribute(mlag, 1));
    motes.setAttribute("aSeed", new THREE.BufferAttribute(mseed, 1));

    const common = {
      uHead: { value: 0 },
      uFade: { value: 1 },
      uIntensity: { value: 0.45 + ev.intensity * 0.55 },
    };
    const ribbonMat = new THREE.ShaderMaterial({
      vertexShader: ribbonVertex,
      fragmentShader: ribbonFragment,
      uniforms: common,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const moteMat = new THREE.ShaderMaterial({
      vertexShader: moteVertex,
      fragmentShader: moteFragment,
      uniforms: common,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { ribbon, motes, ribbonMat, moteMat, mid };
  }, [ev]);

  const started = useRef(perf.startedAt);
  useFrame(() => {
    const elapsed = (Date.now() - started.current) / 1000;
    const u = ribbonMat.uniforms;
    u.uHead.value = elapsed / TRAVEL_SECONDS;
    u.uFade.value = 1 - smoothstep(TRAVEL_SECONDS, TOTAL_SECONDS, elapsed);
  });

  return (
    <group>
      <mesh geometry={ribbon} material={ribbonMat} frustumCulled={false} />
      <points geometry={motes} material={moteMat} frustumCulled={false} />
      <HoverTarget position={mid} radius={34} event={ev} />
    </group>
  );
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function seeded(id: string) {
  let h = 1779033703;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
