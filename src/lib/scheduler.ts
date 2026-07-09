/**
 * The conductor. Fetches the recent real universe, then choreographs it:
 * replays of the last 30 days keep the artwork alive every few minutes, while
 * live polling lets a genuinely new detection interrupt immediately.
 */
import type { CosmicEvent, EventKind, EventsPayload, SolarState } from "./types";
import { useStore } from "./store";
import { audio } from "@/audio/engine";
import { persistRemnant, persistMoodMemory } from "./persistence";
import { raDecToDir } from "./celestial";

export const DURATIONS: Record<EventKind, number> = {
  neutrino: 30_000,
  grb: 16_000,
  gw: 24_000,
};

/** ms between replays, per kind: [min, max] — silence is part of the piece */
const CADENCE: Record<EventKind, [number, number]> = {
  neutrino: [60_000, 170_000],
  grb: [300_000, 680_000],
  gw: [620_000, 1_150_000],
};

/** first appearance of each voice after entering */
const OVERTURE: Record<EventKind, number> = {
  neutrino: 16_000,
  grb: 70_000,
  gw: 140_000,
};

const queues: Record<EventKind, CosmicEvent[]> = { neutrino: [], grb: [], gw: [] };
const cursors: Record<EventKind, number> = { neutrino: 0, grb: 0, gw: 0 };
let started = false;
let maxSeen = 0;
let lastMajorAt = 0;

export function startConductor(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshEvents(true);
  void refreshSolar();
  window.setInterval(() => void refreshEvents(false), 180_000);
  window.setInterval(() => void refreshSolar(), 300_000);
  (Object.keys(OVERTURE) as EventKind[]).forEach((kind) => {
    scheduleKind(kind, OVERTURE[kind] + Math.random() * 20_000);
  });
}

function scheduleKind(kind: EventKind, delay: number): void {
  window.setTimeout(() => {
    fireNext(kind);
    const [min, max] = CADENCE[kind];
    scheduleKind(kind, min + Math.random() * (max - min));
  }, delay);
}

function fireNext(kind: EventKind): void {
  const q = queues[kind];
  if (q.length === 0) {
    // feed not in yet (first load can take ~30s) — try again shortly
    window.setTimeout(() => fireNext(kind), 20_000);
    return;
  }
  // big events never collide — enforced quiet between eruptions
  if (kind !== "neutrino" && Date.now() - lastMajorAt < 60_000) {
    window.setTimeout(() => fireNext(kind), 45_000);
    return;
  }
  const ev = q[cursors[kind] % q.length];
  cursors[kind]++;
  perform({ ...ev, isLive: false });
}

export function perform(ev: CosmicEvent): void {
  const store = useStore.getState();
  if (store.phase === "enter") return;
  if (ev.kind !== "neutrino") lastMajorAt = Date.now();

  const perfId = store.perform(ev);
  if (ev.kind === "neutrino") audio.neutrino(ev.intensity);
  else if (ev.kind === "grb") audio.grb(ev.intensity);
  else audio.gw(ev.intensity);

  window.setTimeout(() => {
    useStore.getState().endPerformance(perfId);
    void persistRemnant({
      kind: ev.kind,
      ra: ev.ra,
      dec: ev.dec,
      intensity: ev.intensity,
      at: Date.now(),
    }).then((all) => useStore.getState().setRemnants(all));
  }, DURATIONS[ev.kind]);
}

/** Timeline click: replay a specific real event and drift the gaze toward it. */
export function replayEvent(ev: CosmicEvent): void {
  const dir = raDecToDir(ev.ra, ev.dec);
  useStore.getState().requestFocus([dir.x, dir.y, dir.z]);
  perform({ ...ev, isLive: false });
}

async function refreshEvents(first: boolean): Promise<void> {
  try {
    const res = await fetch("/api/events");
    if (!res.ok) throw new Error(String(res.status));
    const payload = (await res.json()) as EventsPayload;
    const events = payload.events ?? [];
    useStore.getState().setEvents(events);

    (Object.keys(queues) as EventKind[]).forEach((kind) => {
      queues[kind] = shuffle(events.filter((e) => e.kind === kind));
    });

    const newest = events.reduce((m, e) => Math.max(m, e.time), 0);
    if (!first && maxSeen > 0) {
      // the universe interrupts: genuinely new detections fire now
      events
        .filter((e) => e.time > maxSeen)
        .forEach((e, i) => {
          window.setTimeout(() => perform({ ...e, isLive: true }), i * 12_000);
        });
    }
    maxSeen = Math.max(maxSeen, newest);
  } catch (err) {
    console.warn("[astralis] event refresh failed:", err);
  }
}

async function refreshSolar(): Promise<void> {
  try {
    const res = await fetch("/api/solar");
    if (!res.ok) throw new Error(String(res.status));
    const solar = (await res.json()) as SolarState;
    useStore.getState().setSolar(solar);
    audio.setMood(solar.mood);
    const memory = await persistMoodMemory(solar.mood);
    useStore.getState().setMoodMemory(memory);
  } catch (err) {
    console.warn("[astralis] solar refresh failed:", err);
  }
}

/** Debug (?debug + keys 1/2/3): fire a performance without waiting for the queue. */
export function debugFire(kind: EventKind): void {
  const q = queues[kind];
  if (q.length > 0) {
    const ev = q[Math.floor(Math.random() * q.length)];
    const dir = raDecToDir(ev.ra, ev.dec);
    useStore.getState().requestFocus([dir.x, dir.y, dir.z]);
    perform({ ...ev, isLive: false });
    return;
  }
  perform({
    id: `debug-${kind}-${Date.now()}`,
    kind,
    time: Date.now(),
    ra: Math.random() * 360,
    dec: (Math.random() - 0.5) * 120,
    intensity: 0.8,
    label: "Debug event",
    source: "console",
    detail: {},
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
