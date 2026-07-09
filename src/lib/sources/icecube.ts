import type { CosmicEvent } from "../types";
import { fetchTextPartial, parseGcnDate, parseRows } from "./html";

const URL = "https://gcn.gsfc.nasa.gov/amon_icecube_gold_bronze_events.html";

/**
 * AMON IceCube gold/bronze table:
 * RunNum_EventNum | Rev | Date | Time UT | NoticeType | RA | Dec | Error90 | Error50 |
 * Energy [TeV] | Signalness | FAR [#/yr] | Comments.
 * Reverse time order; first row per event id is the latest revision.
 */
export async function fetchIceCubeAlerts(): Promise<CosmicEvent[]> {
  const html = await fetchTextPartial(URL, 400_000, 45000);
  const seen = new Set<string>();
  const out: CosmicEvent[] = [];
  for (const cells of parseRows(html)) {
    if (cells.length < 12) continue;
    const [id, , date, time, noticeType, raS, decS, err90, , energyS, signalS, farS] = cells;
    if (!/^\d+_\d+$/.test(id) || seen.has(id)) continue;
    const t = parseGcnDate(date, time);
    const ra = Number(raS);
    const dec = Number(decS);
    if (t === null || !Number.isFinite(ra) || !Number.isFinite(dec)) continue;
    seen.add(id);
    const energyTeV = Number(energyS);
    const signalness = Number(signalS);
    out.push({
      id: `icecube-${id}`,
      kind: "neutrino",
      time: t,
      ra,
      dec,
      intensity: Number.isFinite(signalness) ? Math.min(1, Math.max(0.15, signalness)) : 0.3,
      label: `IceCube ${noticeType.toLowerCase()} alert`,
      source: "IceCube Neutrino Observatory",
      detail: {
        Energy: Number.isFinite(energyTeV)
          ? energyTeV >= 1000
            ? `${(energyTeV / 1000).toFixed(2)} PeV`
            : `${energyTeV.toFixed(0)} TeV`
          : "—",
        Signalness: Number.isFinite(signalness) ? `${(signalness * 100).toFixed(0)}%` : "—",
        "False-alarm rate": farS ? `${farS} / yr` : "—",
        "Position error": err90 ? `${err90}′ (90%)` : "—",
      },
    });
  }
  return out;
}
