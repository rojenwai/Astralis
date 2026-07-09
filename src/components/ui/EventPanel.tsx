"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { constellationOf } from "@/lib/celestial";
import type { EventKind } from "@/lib/types";

const TITLES: Record<EventKind, string> = {
  neutrino: "Neutrino detected",
  grb: "Gamma-ray burst",
  gw: "Gravitational wave",
};

/** A small floating pane of glass. It appears, tells its truth, and dissolves. */
export default function EventPanel() {
  const hover = useStore((s) => s.hover);

  useEffect(() => {
    if (!hover) return;
    const t = window.setTimeout(() => useStore.getState().setHover(null), 6000);
    return () => window.clearTimeout(t);
  }, [hover]);

  const x = hover ? Math.min(hover.x + 18, window.innerWidth - 280) : 0;
  const y = hover ? Math.min(hover.y + 14, window.innerHeight - 240) : 0;

  return (
    <AnimatePresence>
      {hover && (
        <motion.div
          key={hover.event.id + hover.x}
          className="event-panel"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, transition: { duration: 1.4 } }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="event-panel-title">
            {TITLES[hover.event.kind]}
            {hover.event.isLive && <span className="live-badge">live</span>}
          </div>
          <div className="event-panel-row">
            <span>Time</span>
            <span>{formatTime(hover.event.time)}</span>
          </div>
          {Object.entries(hover.event.detail).map(([k, v]) =>
            v && v !== "—" ? (
              <div className="event-panel-row" key={k}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ) : null,
          )}
          <div className="event-panel-row">
            <span>Source</span>
            <span>{hover.event.source}</span>
          </div>
          <div className="event-panel-row">
            <span>Constellation</span>
            <span>{constellationOf(hover.event.ra, hover.event.dec)}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatTime(t: number): string {
  const d = new Date(t);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) +
    " UTC"
  );
}
