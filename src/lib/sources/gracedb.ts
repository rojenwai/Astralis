import type { CosmicEvent } from "../types";
import { fetchRetry, hash01 } from "./html";

// query=category: production — the unfiltered list is dominated by hourly mock injections
const URL =
  "https://gracedb.ligo.org/apiweb/superevents/?query=category:%20production&format=json&count=30";

interface GraceSuperevent {
  superevent_id: string;
  category: string;
  created: string; // "2026-07-09 14:00:56 UTC"
  far: number | null;
  labels: string[];
}

/**
 * GraceDB superevents. Only `category === "Production"` (ids starting with "S") are real
 * candidate detections — MS/TS-prefixed ids are mock/test injections and must never
 * reach the artwork. Retracted events carry the ADVNO label and are dropped too.
 *
 * GW localizations are sky *regions*, not points, and fetching per-event skymaps is far too
 * heavy — the ripple is a whole-universe distortion anyway, so each event gets a stable
 * pseudo-position derived from its id.
 */
export async function fetchGravitationalWaves(): Promise<CosmicEvent[]> {
  const res = await fetchRetry(URL);
  const data = (await res.json()) as { superevents: GraceSuperevent[] };

  const out: CosmicEvent[] = [];
  for (const ev of data.superevents ?? []) {
    if (ev.category !== "Production") continue;
    if (!ev.superevent_id?.startsWith("S")) continue;
    if (ev.labels?.includes("ADVNO")) continue;
    const time = Date.parse(ev.created.replace(" UTC", "Z").replace(" ", "T"));
    if (!Number.isFinite(time)) continue;

    // FAR in Hz; more negative log10 = more significant. ~1/century ≈ 3e-10 Hz.
    const sig = ev.far && ev.far > 0 ? -Math.log10(ev.far) : 8;
    out.push({
      id: `gw-${ev.superevent_id}`,
      kind: "gw",
      time,
      ra: hash01(ev.superevent_id) * 360,
      dec: (hash01(ev.superevent_id, 7) - 0.5) * 120,
      intensity: Math.min(1, Math.max(0.35, (sig - 4) / 8)),
      label: `Superevent ${ev.superevent_id}`,
      source: "LIGO / Virgo / KAGRA",
      detail: {
        "False-alarm rate":
          ev.far && ev.far > 0 ? `1 per ${formatFarYears(ev.far)}` : "—",
        Significance: ev.labels?.includes("SIGNIF_LOCKED") ? "significant" : "candidate",
      },
    });
  }
  return out;
}

function formatFarYears(farHz: number): string {
  const years = 1 / (farHz * 3.15576e7);
  if (years >= 1000) return `${(years / 1000).toFixed(1)}k years`;
  if (years >= 1) return `${years.toFixed(1)} years`;
  return `${(years * 365.25).toFixed(1)} days`;
}
