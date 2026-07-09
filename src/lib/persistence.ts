import { get, set } from "idb-keyval";
import type { RemnantRecord } from "./store";

const REMNANTS_KEY = "astralis:remnants";
const MOOD_KEY = "astralis:mood-memory";
const CAP = 400;

export async function loadRemnants(): Promise<RemnantRecord[]> {
  try {
    return (await get<RemnantRecord[]>(REMNANTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

/**
 * Nothing disappears completely — but memory is finite. When the store overflows,
 * the oldest neutrino whispers fade first; the great events linger longest.
 */
export async function persistRemnant(r: RemnantRecord): Promise<RemnantRecord[]> {
  let all = await loadRemnants();
  all.push(r);
  if (all.length > CAP) {
    const neutrinos = all.filter((x) => x.kind === "neutrino");
    if (neutrinos.length > CAP / 2) {
      const oldest = neutrinos.sort((a, b) => a.at - b.at)[0];
      all = all.filter((x) => x !== oldest);
    } else {
      all = all.sort((a, b) => a.at - b.at).slice(all.length - CAP);
    }
  }
  try {
    await set(REMNANTS_KEY, all);
  } catch {
    /* private-mode browsers: the universe simply forgets */
  }
  return all;
}

export async function loadMoodMemory(): Promise<number> {
  try {
    return (await get<number>(MOOD_KEY)) ?? 0.3;
  } catch {
    return 0.3;
  }
}

/** Slow exponential color memory: weeks of solar weather tint the installation. */
export async function persistMoodMemory(currentMood: number): Promise<number> {
  const prev = await loadMoodMemory();
  const next = prev * 0.97 + currentMood * 0.03;
  try {
    await set(MOOD_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}
