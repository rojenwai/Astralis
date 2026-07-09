"use client";

import { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { shared } from "@/lib/uniforms";
import { useStore } from "@/lib/store";
import CameraRig from "./scene/CameraRig";
import Starfield from "./scene/Starfield";
import Nebula from "./scene/Nebula";
import Dust from "./scene/Dust";
import Aurora from "./scene/Aurora";
import Performances from "./scene/events/Performances";
import Remnants from "./scene/events/Remnants";
import Effects from "./post/Effects";

/** One imperative write per frame moves the whole universe in lockstep. */
function FrameDriver() {
  useFrame((state, dt) => {
    shared.uTime.value = state.clock.elapsedTime;
    // GRB illumination decays over a few seconds
    shared.uFlash.value *= Math.exp(-dt * 0.55);
    if (shared.uFlash.value < 0.001) shared.uFlash.value = 0;
    // mood eases very slowly toward live solar weather, tinted by long-term memory
    const s = useStore.getState();
    const target = s.solar ? s.solar.mood * 0.8 + s.moodMemory * 0.2 : s.moodMemory;
    shared.uMood.value += (target - shared.uMood.value) * Math.min(1, dt * 0.05);
  });
  return null;
}

export default function Experience() {
  const [degraded, setDegraded] = useState(false);
  const [dpr, setDpr] = useState(1.5);

  return (
    <div className="canvas-root">
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={dpr}
        camera={{ fov: 60, near: 0.1, far: 4000, position: [0, 0, 0.01] }}
      >
        <color attach="background" args={["#000005"]} />
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
            setDegraded(true);
          }}
          onIncline={() => setDpr(1.75)}
        >
          <FrameDriver />
          <CameraRig />
          <Starfield />
          <Nebula />
          <Dust />
          <Aurora />
          <Performances />
          <Remnants />
          <Effects degraded={degraded} />
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}
