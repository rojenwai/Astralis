"use client";

import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { audio } from "@/audio/engine";
import { startConductor } from "@/lib/scheduler";

/**
 * Complete black. One whispered invitation. The click is also the browser's
 * audio unlock — the moment the visitor touches the dark, the universe
 * begins to sound.
 */
export default function EnterOverlay() {
  const enter = () => {
    void audio.init();
    startConductor();
    useStore.getState().setPhase("title");
  };

  return (
    <motion.div
      className="enter-overlay"
      onClick={enter}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 3, ease: "easeInOut" } }}
    >
      <motion.span
        className="enter-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.25, 0.55] }}
        transition={{ delay: 1.5, duration: 9, repeat: Infinity, ease: "easeInOut" }}
      >
        touch the dark to begin
      </motion.span>
    </motion.div>
  );
}
