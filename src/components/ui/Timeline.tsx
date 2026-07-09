"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { replayEvent } from "@/lib/scheduler";
import type { EventKind } from "@/lib/types";

const COLORS: Record<EventKind, string> = {
  neutrino: "#9fd0ff",
  grb: "#ffce7a",
  gw: "#b9a7ff",
};

const WINDOW_MS = 30 * 24 * 3600 * 1000;

/**
 * A thin glowing line, invisible until sought. Thirty days of the universe;
 * each point one real event. Clicking replays it.
 */
export default function Timeline() {
  const events = useStore((s) => s.events);

  const dots = useMemo(() => {
    const now = Date.now();
    return events.map((e) => ({
      event: e,
      pct: Math.max(0.4, Math.min(99.6, (1 - (now - e.time) / WINDOW_MS) * 100)),
    }));
  }, [events]);

  if (events.length === 0) return null;

  return (
    <motion.div
      className="timeline"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 4, duration: 3 }}
    >
      <div className="timeline-line" />
      <div className="timeline-dots">
        {dots.map(({ event, pct }) => (
          <button
            key={event.id}
            className="timeline-dot"
            style={{ left: `${pct}%`, background: COLORS[event.kind], color: COLORS[event.kind] }}
            title={`${event.label} — ${new Date(event.time).toUTCString()}`}
            onClick={() => replayEvent(event)}
            aria-label={`Replay ${event.label}`}
          />
        ))}
      </div>
    </motion.div>
  );
}
