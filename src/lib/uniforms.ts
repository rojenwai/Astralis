import * as THREE from "three";

/**
 * Shared shader uniforms — single source of truth for the whole scene.
 * Every scene material imports these object references, so one frame-loop write
 * (Experience.tsx) moves the entire universe in lockstep.
 */
export const MEMORY_SLOTS = 8;

export const shared = {
  /** scene clock, seconds */
  uTime: { value: 0 },
  /** solar mood 0 calm .. 1 energetic (already blended with color memory) */
  uMood: { value: 0.3 },
  /** GRB global illumination flash 0..1, decays in the frame loop */
  uFlash: { value: 0 },
  /** gravitational-wave ripple */
  uRippleCenter: { value: new THREE.Vector3(0, 0, 400) },
  uRippleStart: { value: -1e4 },
  uRippleAmp: { value: 0 },
  /** permanent GW lens memory — directions + amplitudes */
  uMemoryDirs: { value: Array.from({ length: MEMORY_SLOTS }, () => new THREE.Vector3(0, 1, 0)) },
  uMemoryAmps: { value: new Float32Array(MEMORY_SLOTS) },
};

/** Uniform declarations matching `shared`, to prepend to vertex shaders. */
export const cosmicUniformsGLSL = /* glsl */ `
uniform float uTime;
uniform float uMood;
uniform float uFlash;
uniform vec3 uRippleCenter;
uniform float uRippleStart;
uniform float uRippleAmp;
uniform vec3 uMemoryDirs[${MEMORY_SLOTS}];
uniform float uMemoryAmps[${MEMORY_SLOTS}];
`;

/**
 * World-space displacement applied to everything that lives on the sky:
 * an expanding gravitational-wave band plus faint permanent swirls where
 * past waves passed (the universe remembers).
 */
export const cosmicDisplaceGLSL = /* glsl */ `
vec3 cosmicDisplace(vec3 p) {
  vec3 q = p;
  float t = uTime - uRippleStart;
  if (t > 0.0 && t < 45.0 && uRippleAmp > 0.001) {
    float R = t * 90.0;
    float d = distance(p, uRippleCenter);
    float band = exp(-pow((d - R) / 70.0, 2.0));
    float decay = exp(-t * 0.16);
    vec3 dir = normalize(p - uRippleCenter + vec3(0.0001));
    float wave = sin((d - R) * 0.045);
    q += dir * band * decay * uRippleAmp * 30.0 * wave;
  }
  vec3 nd = normalize(p + vec3(0.0001));
  for (int i = 0; i < ${MEMORY_SLOTS}; i++) {
    float amp = uMemoryAmps[i];
    if (amp < 0.001) continue;
    vec3 md = uMemoryDirs[i];
    float ang = acos(clamp(dot(nd, md), -1.0, 1.0));
    float w = exp(-pow(ang / 0.22, 2.0)) * amp;
    vec3 tangent = normalize(cross(md, nd) + vec3(0.0001));
    q += tangent * w * 9.0;
  }
  return q;
}
`;

/**
 * Screen-space state for the post-processing ripple pass. The active
 * GravityRipple performance writes it each frame; Effects.tsx reads it.
 */
export const rippleScreen = {
  center: new THREE.Vector2(0.5, 0.5),
  /** seconds since the wave began (large = inactive) */
  t: 1e4,
  amp: 0,
};

/** Fire the shared GW ripple from a world position. */
export function triggerRipple(center: THREE.Vector3, amplitude: number) {
  shared.uRippleCenter.value.copy(center);
  shared.uRippleStart.value = shared.uTime.value;
  shared.uRippleAmp.value = amplitude;
}

/** Write the permanent lens-memory slots (latest N gravitational waves). */
export function setLensMemory(entries: { dir: THREE.Vector3; amp: number }[]) {
  for (let i = 0; i < MEMORY_SLOTS; i++) {
    const e = entries[i];
    if (e) {
      shared.uMemoryDirs.value[i].copy(e.dir);
      shared.uMemoryAmps.value[i] = e.amp;
    } else {
      shared.uMemoryAmps.value[i] = 0;
    }
  }
}
