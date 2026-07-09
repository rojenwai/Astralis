"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector2 } from "three";
import { rippleScreen } from "@/lib/uniforms";

/**
 * Screen-space gravitational ripple: the final image itself bends, with a faint
 * chromatic shiver on the wavefront. Runs before bloom so the distorted light blooms.
 */
const rippleShader = /* glsl */ `
uniform vec2 uCenter;
uniform float uT;
uniform float uAmp;
uniform float uAspect;

void mainUv(inout vec2 uv) {
  vec2 d = uv - uCenter;
  d.x *= uAspect;
  float dist = length(d);
  float R = uT * 0.2;
  float band = exp(-pow((dist - R) * 9.0, 2.0));
  float w = band * exp(-uT * 0.3) * uAmp;
  vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
  dir.x /= uAspect;
  uv -= dir * 0.045 * w * sin((dist - R) * 42.0);
}
`;

class RippleEffectImpl extends Effect {
  constructor() {
    super("AstralisRipple", rippleShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uCenter", new Uniform(new Vector2(0.5, 0.5))],
        ["uT", new Uniform(1e4)],
        ["uAmp", new Uniform(0)],
        ["uAspect", new Uniform(1)],
      ]),
    });
  }
}

export default function Effects({ degraded }: { degraded: boolean }) {
  const { size } = useThree();
  const ripple = useMemo(() => new RippleEffectImpl(), []);

  useFrame(() => {
    const u = ripple.uniforms;
    (u.get("uCenter")!.value as Vector2).copy(rippleScreen.center);
    u.get("uT")!.value = rippleScreen.t;
    u.get("uAmp")!.value = rippleScreen.amp;
    u.get("uAspect")!.value = size.width / size.height;
  });

  return (
    <EffectComposer multisampling={0}>
      <primitive object={ripple} />
      <Bloom
        intensity={1.15}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.75}
      />
      {degraded ? <></> : <Noise premultiply opacity={0.35} blendFunction={BlendFunction.SCREEN} />}
      <Vignette eskil={false} offset={0.18} darkness={0.72} />
    </EffectComposer>
  );
}
