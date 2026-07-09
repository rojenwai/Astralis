"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { loadRemnants, loadMoodMemory } from "@/lib/persistence";
import { debugFire } from "@/lib/scheduler";
import { audio } from "@/audio/engine";
import EnterOverlay from "./ui/EnterOverlay";
import TitleSequence from "./ui/TitleSequence";
import EventPanel from "./ui/EventPanel";
import Timeline from "./ui/Timeline";

const Experience = dynamic(() => import("./Experience"), { ssr: false });

export default function App() {
  const phase = useStore((s) => s.phase);

  // the universe remembers previous visits
  useEffect(() => {
    void loadRemnants().then((r) => useStore.getState().setRemnants(r));
    void loadMoodMemory().then((m) => useStore.getState().setMoodMemory(m));
  }, []);

  // hidden dev hotkeys: ?debug + 1/2/3 fire events, 0 cycles the solar mood
  useEffect(() => {
    if (!window.location.search.includes("debug")) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") debugFire("neutrino");
      else if (e.key === "2") debugFire("grb");
      else if (e.key === "3") debugFire("gw");
      else if (e.key === "0") {
        const s = useStore.getState();
        const mood = ((s.solar?.mood ?? 0.3) + 0.25) % 1;
        s.setSolar({ kp: mood * 9, xray: 1e-7, mood, updatedAt: Date.now() });
        audio.setMood(mood);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Experience />
      <AnimatePresence>{phase === "enter" && <EnterOverlay key="enter" />}</AnimatePresence>
      <AnimatePresence>{phase === "title" && <TitleSequence key="title" />}</AnimatePresence>
      {phase === "live" && <Timeline />}
      <EventPanel />
    </>
  );
}
