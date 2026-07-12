"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/lib/store";
import { raDecToDir } from "@/lib/celestial";

/** Where events live on the celestial sphere — GRB cores at 380, GW rings at 420. */
const EVENT_RADIUS = 400;
/** Keep re-solving the aim for this long, so the ease lands exactly on the event. */
const FOCUS_TRACK_SECONDS = 5;
/** How far dragging alone may tilt — stops the horizon flipping over the pole. */
const PITCH_LIMIT = 1.4;
/** ~89°: the hard cap on the *composed* gaze. Beyond ±90° the view would invert. */
const MAX_PITCH = 1.5533;

const tmpAim = new THREE.Vector3();

/** The equivalent of `target` nearest `current`, so the camera never spins the long way. */
function nearestTurn(current: number, target: number): number {
  const TAU = Math.PI * 2;
  return target + TAU * Math.round((current - target) / TAU);
}

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
    trackUntil: 0,
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
      r.trackUntil = 0; // the hand overrides the focus
      r.targetYaw += (e.clientX - r.lastX) * 0.0016;
      r.targetPitch = THREE.MathUtils.clamp(
        r.targetPitch + (e.clientY - r.lastY) * 0.0012,
        -PITCH_LIMIT,
        PITCH_LIMIT,
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
      useStore.getState().requestFocus([dir.x, dir.y, dir.z]);
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

    // gentle positional bob (tiny against a 300+ unit sky)
    camera.position.set(
      Math.sin(t * 0.023) * 3.5,
      Math.cos(t * 0.019) * 2.5,
      Math.sin(t * 0.017) * 3.5,
    );

    // perpetual drift — slow enough to be felt, not seen
    const driftYaw = t * 0.0045 + Math.sin(t * 0.017) * 0.05;
    const driftPitch = Math.sin(t * 0.013) * 0.055;
    const px = state.pointer.x * 0.055;
    const py = state.pointer.y * 0.04;

    // Timeline replays, double-click, debug fires. The gaze the viewer actually gets is
    // base + drift + parallax, so the base must be solved backwards from the event —
    // otherwise the ever-growing drift term throws the aim off by tens of degrees.
    // Tracked every frame for a moment, so drift and mouse movement during the ease
    // leave no residue; then the base freezes and the universe drifts onward.
    const focus = useStore.getState().focus;
    if (focus && focus.at !== r.focusAt) {
      r.focusAt = focus.at;
      r.trackUntil = state.clock.elapsedTime + FOCUS_TRACK_SECONDS;
    }
    if (focus && t < r.trackUntil) {
      const aim = tmpAim
        .set(focus.dir[0], focus.dir[1], focus.dir[2])
        .multiplyScalar(EVENT_RADIUS)
        .sub(camera.position)
        .normalize();
      // asin already yields a legal pitch; clamping the target here would put polar
      // events permanently out of reach. The composed gaze is bounded below instead.
      const wantYaw = Math.atan2(-aim.z, aim.x) - driftYaw - px;
      const wantPitch = Math.asin(THREE.MathUtils.clamp(aim.y, -1, 1)) - driftPitch - py;
      r.targetYaw = nearestTurn(r.yaw, wantYaw);
      r.targetPitch = wantPitch;
    }

    const k = Math.min(1, dt * 1.6);
    r.yaw += (r.targetYaw - r.yaw) * k;
    r.pitch += (r.targetPitch - r.pitch) * k;
    r.fov += (r.targetFov - r.fov) * Math.min(1, dt * 2.5);

    const yaw = r.yaw + driftYaw + px;
    const pitch = THREE.MathUtils.clamp(r.pitch + driftPitch + py, -MAX_PITCH, MAX_PITCH);

    const look = new THREE.Vector3(
      Math.cos(pitch) * Math.cos(yaw),
      Math.sin(pitch),
      -Math.cos(pitch) * Math.sin(yaw),
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
