"use client";

import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { CosmicEvent } from "@/lib/types";
import { useStore } from "@/lib/store";

/** Invisible raycast sphere — hovering an event summons its glass panel. */
export default function HoverTarget({
  position,
  radius,
  event,
}: {
  position: THREE.Vector3;
  radius: number;
  event: CosmicEvent;
}) {
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    useStore.getState().setHover({ event, x: e.clientX, y: e.clientY });
  };
  const onOut = () => {
    useStore.getState().setHover(null);
  };
  return (
    <mesh position={position} onPointerMove={onMove} onPointerOut={onOut} frustumCulled={false}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.0001} depthWrite={false} depthTest={false} />
    </mesh>
  );
}
