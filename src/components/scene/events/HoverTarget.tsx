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
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    useStore.getState().setHover({ event, x: e.clientX, y: e.clientY });
  };
  return (
    <mesh position={position} onPointerOver={onOver}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}
