import type { SolarState } from "../types";
import { fetchRetry } from "./html";

const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const XRAY_URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json";

interface KpEntry {
  time_tag: string;
  Kp: number;
}
interface XrayEntry {
  time_tag: string;
  flux: number;
  energy: string; // "0.05-0.4nm" | "0.1-0.8nm"
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetchRetry(url, 20000);
  return res.json() as Promise<T>;
}

/**
 * The Sun as the heartbeat: Kp (geomagnetic) + GOES long-band X-ray flux fold into a
 * single mood scalar. Kp 0–2 & A/B-class flux → deep-blue meditative; Kp 5+ or M/X
 * flares → golden, energetic.
 */
export async function fetchSolarState(): Promise<SolarState> {
  const [kpData, xrayData] = await Promise.allSettled([
    getJson<KpEntry[]>(KP_URL),
    getJson<XrayEntry[]>(XRAY_URL),
  ]);

  let kp = 2;
  if (kpData.status === "fulfilled" && kpData.value.length > 0) {
    const last = kpData.value[kpData.value.length - 1];
    if (Number.isFinite(last.Kp)) kp = last.Kp;
  }

  let xray = 1e-7; // quiet-sun B-class baseline
  if (xrayData.status === "fulfilled") {
    const long = xrayData.value.filter((e) => e.energy === "0.1-0.8nm" && e.flux > 0);
    if (long.length > 0) xray = long[long.length - 1].flux;
  }
  if (kpData.status === "rejected" && xrayData.status === "rejected") {
    throw new Error("all solar sources failed");
  }

  // log10 flux: A=1e-8 → 0, C=1e-6 ≈ 0.43, M=1e-5 ≈ 0.71, X=1e-4 → 1
  const xrayNorm = clamp01((Math.log10(xray) + 8) / 4);
  const kpNorm = clamp01(kp / 7);
  const mood = clamp01(0.55 * kpNorm + 0.45 * xrayNorm);

  return { kp, xray, mood, updatedAt: Date.now() };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
