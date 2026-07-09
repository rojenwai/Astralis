"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";

/**
 * The quiet universe appears first; only then, a title — and then it leaves,
 * returning the room to the artwork.
 */
export default function TitleSequence() {
  useEffect(() => {
    const t = window.setTimeout(() => useStore.getState().setPhase("live"), 14_000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div className="title-sequence" exit={{ opacity: 0 }}>
      <motion.h1
        className="title-main"
        initial={{ opacity: 0, letterSpacing: "0.42em" }}
        animate={{
          opacity: [0, 0, 1, 1, 0],
          letterSpacing: ["0.42em", "0.42em", "0.5em", "0.54em", "0.58em"],
        }}
        transition={{ duration: 13, times: [0, 0.22, 0.42, 0.75, 1], ease: "easeInOut" }}
      >
        ASTRALIS
      </motion.h1>
      <motion.p
        className="title-sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.6, 0.6, 0] }}
        transition={{ duration: 13, times: [0, 0.32, 0.5, 0.75, 1], ease: "easeInOut" }}
      >
        Listening to the Universe
      </motion.p>
    </motion.div>
  );
}
