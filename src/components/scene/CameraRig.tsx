"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { raDecToDir } from "@/lib/celestial";

/**
 * The camera never rests: a slow Lissajous drift, damped mouse parallax,
 * scroll = gentle fov zoom, drag = orbit, double-click = drift toward the
 * latest event. All motion is critically damped — nothing snaps.
 */
export default function CameraRig() {
  const { camera, gl } = useThree();
  const rig = useRef({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    fov: 60,
    targetFov: 60,
    dragging: false,
    lastX: 0,
    lastY: 0,
    focusAt: 0,
  });

  useEffect(() => {
    const el = gl.domElement;
    const r = rig.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      r.targetFov = THREE.MathUtils.clamp(r.targetFov + e.deltaY * 0.012, 38, 78);
    };
    const onDown = (e: PointerEvent) => {
      r.dragging = true;
      r.lastX = e.clientX;
      r.lastY = e.clientY;
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!r.dragging) return;
      r.targetYaw += (e.clientX - r.lastX) * 0.0016;
      r.targetPitch = THREE.MathUtils.clamp(
        r.targetPitch + (e.clientY - r.lastY) * 0.0012,
        -1.1,
        1.1,
      );
      r.lastX = e.clientX;
      r.lastY = e.clientY;
    };
    const onUp = () => {
      r.dragging = false;
      el.style.cursor = "grab";
    };
    const onDblClick = () => {
      const latest = useStore.getState().latest;
      if (!latest) return;
      const dir = raDecToDir(latest.event.ra, latest.event.dec);
      r.targetYaw = Math.atan2(-dir.z, dir.x);
      r.targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    };

    el.style.cursor = "grab";
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, [gl]);

  useFrame((state, dt) => {
    const r = rig.current;
    const t = state.clock.elapsedTime;

    // timeline replays / focus requests steer the gaze too
    const focus = useStore.getState().focus;
    if (focus && focus.at !== r.focusAt) {
      r.focusAt = focus.at;
      const dir = new THREE.Vector3(...focus.dir);
      r.targetYaw = Math.atan2(-dir.z, dir.x);
      r.targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    }

    const k = Math.min(1, dt * 1.6);
    r.yaw += (r.targetYaw - r.yaw) * k;
    r.pitch += (r.targetPitch - r.pitch) * k;
    r.fov += (r.targetFov - r.fov) * Math.min(1, dt * 2.5);

    // perpetual drift — slow enough to be felt, not seen
    const yaw = r.yaw + t * 0.0045 + Math.sin(t * 0.017) * 0.05;
    const pitch = r.pitch + Math.sin(t * 0.013) * 0.055;

    // gentle positional bob (tiny against a 300+ unit sky)
    camera.position.set(
      Math.sin(t * 0.023) * 3.5,
      Math.cos(t * 0.019) * 2.5,
      Math.sin(t * 0.017) * 3.5,
    );

    const px = state.pointer.x * 0.055;
    const py = state.pointer.y * 0.04;
    const look = new THREE.Vector3(
      Math.cos(pitch + py) * Math.cos(yaw + px),
      Math.sin(pitch + py),
      -Math.cos(pitch + py) * Math.sin(yaw + px),
    );
    camera.lookAt(camera.position.clone().add(look.multiplyScalar(100)));

    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - r.fov) > 0.01) {
      persp.fov = r.fov;
      persp.updateProjectionMatrix();
    }
  });

  return null;
}
