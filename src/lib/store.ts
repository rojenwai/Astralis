import { create } from "zustand";
import type { CosmicEvent, EventKind, SolarState } from "./types";

export type Phase = "enter" | "title" | "live";

export interface PerformanceItem {
  perfId: number;
  event: CosmicEvent;
  /** Date.now() when the performance began */
  startedAt: number;
}

export interface RemnantRecord {
  kind: EventKind;
  ra: number;
  dec: number;
  intensity: number;
  /** when this trace was performed (epoch ms) */
  at: number;
}

export interface HoverInfo {
  event: CosmicEvent;
  x: number;
  y: number;
}

interface AstralisState {
  phase: Phase;
  solar: SolarState | null;
  /** slowly-accumulated color memory of past solar moods, 0..1 */
  moodMemory: number;
  events: CosmicEvent[];
  performances: PerformanceItem[];
  latest: PerformanceItem | null;
  hover: HoverInfo | null;
  remnants: RemnantRecord[];
  /** unit direction the camera should drift toward (double-click / replay focus) */
  focus: { dir: [number, number, number]; at: number } | null;

  setPhase: (p: Phase) => void;
  setSolar: (s: SolarState) => void;
  setMoodMemory: (m: number) => void;
  setEvents: (e: CosmicEvent[]) => void;
  perform: (event: CosmicEvent) => number;
  endPerformance: (perfId: number) => void;
  setHover: (h: HoverInfo | null) => void;
  setRemnants: (r: RemnantRecord[]) => void;
  addRemnant: (r: RemnantRecord) => void;
  requestFocus: (dir: [number, number, number]) => void;
}

let perfCounter = 0;

export const useStore = create<AstralisState>((set) => ({
  phase: "enter",
  solar: null,
  moodMemory: 0.3,
  events: [],
  performances: [],
  latest: null,
  hover: null,
  remnants: [],
  focus: null,

  setPhase: (phase) => set({ phase }),
  setSolar: (solar) => set({ solar }),
  setMoodMemory: (moodMemory) => set({ moodMemory }),
  setEvents: (events) => set({ events }),
  perform: (event) => {
    const item: PerformanceItem = { perfId: ++perfCounter, event, startedAt: Date.now() };
    set((s) => ({ performances: [...s.performances, item], latest: item }));
    return item.perfId;
  },
  endPerformance: (perfId) =>
    set((s) => ({ performances: s.performances.filter((p) => p.perfId !== perfId) })),
  setHover: (hover) => set({ hover }),
  setRemnants: (remnants) => set({ remnants }),
  addRemnant: (r) => set((s) => ({ remnants: [...s.remnants, r].slice(-400) })),
  requestFocus: (dir) => set({ focus: { dir, at: Date.now() } }),
}));
