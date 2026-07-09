import { NextResponse } from "next/server";
import type { CosmicEvent, EventsPayload } from "@/lib/types";
import { fetchFermiGrbs, fetchSwiftGrbs } from "@/lib/sources/gcn-grb";
import { fetchIceCubeAlerts } from "@/lib/sources/icecube";
import { fetchGravitationalWaves } from "@/lib/sources/gracedb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 3 * 60 * 1000;
const WINDOW_MS = 30 * 24 * 3600 * 1000;

/** Per-source cache so one flaky observatory never silences the others. */
const sourceCache = new Map<string, { events: CosmicEvent[]; at: number }>();
let merged: EventsPayload | null = null;

async function fromSource(name: string, fn: () => Promise<CosmicEvent[]>): Promise<CosmicEvent[]> {
  const cached = sourceCache.get(name);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.events;
  try {
    const events = await fn();
    sourceCache.set(name, { events, at: Date.now() });
    return events;
  } catch (err) {
    console.warn(`[astralis] source ${name} failed:`, err);
    return cached?.events ?? []; // stale beats silent
  }
}

export async function GET() {
  if (merged && Date.now() - merged.fetchedAt < TTL_MS) {
    return NextResponse.json(merged);
  }

  const [fermi, swift, icecube, gw] = await Promise.all([
    fromSource("fermi", fetchFermiGrbs),
    fromSource("swift", fetchSwiftGrbs),
    fromSource("icecube", fetchIceCubeAlerts),
    fromSource("gracedb", fetchGravitationalWaves),
  ]);

  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const inWindow = (e: CosmicEvent) => e.time >= cutoff && e.time <= now + 3600_000;

  const grbs = [...fermi, ...swift].filter(inWindow).sort(byTimeDesc).slice(0, 60);
  const neutrinos = icecube.filter(inWindow).sort(byTimeDesc).slice(0, 30);

  // GW detections are rare — if the window is empty, carry the most recent real
  // superevents anyway so spacetime still has a voice (their true dates are shown).
  let waves = gw.filter(inWindow).sort(byTimeDesc).slice(0, 12);
  if (waves.length < 2) waves = gw.sort(byTimeDesc).slice(0, 4);

  merged = {
    events: [...grbs, ...neutrinos, ...waves].sort(byTimeDesc),
    fetchedAt: now,
  };
  return NextResponse.json(merged);
}

function byTimeDesc(a: CosmicEvent, b: CosmicEvent) {
  return b.time - a.time;
}
