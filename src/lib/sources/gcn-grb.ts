import type { CosmicEvent } from "../types";
import { fetchTextPartial, hash01, parseGcnDate, parseRows } from "./html";

const FERMI_URL = "https://gcn.gsfc.nasa.gov/fermi_grbs.html";
const SWIFT_URL = "https://gcn.gsfc.nasa.gov/swift_grbs.html";

/** Comments that mark a Fermi trigger as something other than a GRB. */
const NOT_GRB = /solar flare|particles|terrestrial|tgf|sgr\b|galactic|noise event|below the horizon/i;

/**
 * Fermi table: TrigNum | Date yy/mm/dd | Time UT | MesgType | RA | Dec | Error | Comments.
 * Several notice rows exist per trigger (Flight/Ground/Final position); the page is in
 * reverse time order so the first row seen per trigger is the most refined one.
 */
export async function fetchFermiGrbs(): Promise<CosmicEvent[]> {
  // page is ~8 MB reverse-chronological; the first 500 KB covers months
  const html = await fetchTextPartial(FERMI_URL, 500_000);
  const seen = new Set<string>();
  const out: CosmicEvent[] = [];
  for (const cells of parseRows(html)) {
    if (cells.length < 8) continue;
    const [trig, date, time, mesgType, raS, decS, errS, comments] = cells;
    if (!/position/i.test(mesgType)) continue;
    if (seen.has(trig)) continue;
    const t = parseGcnDate(date, time);
    const ra = Number(raS);
    const dec = Number(decS);
    if (t === null || !Number.isFinite(ra) || !Number.isFinite(dec)) continue;
    seen.add(trig);
    if (NOT_GRB.test(comments)) continue;
    const short = /short grb/i.test(comments);
    out.push({
      id: `fermi-${trig}`,
      kind: "grb",
      time: t,
      ra,
      dec,
      intensity: 0.55 + (short ? 0.25 : 0.1) + hash01(trig) * 0.2,
      label: `Fermi trigger ${trig}`,
      source: "Fermi GBM",
      detail: {
        Notice: mesgType,
        "Position error": `${errS}°`,
        Duration: short ? "short burst" : /long grb/i.test(comments) ? "long burst" : "—",
      },
    });
  }
  return out;
}

/**
 * Swift table: Trig | Date | Time | BAT RA | BAT Dec | BAT Error | … (18 more columns).
 * Only rows with a numeric BAT position are real localized triggers.
 */
export async function fetchSwiftGrbs(): Promise<CosmicEvent[]> {
  const html = await fetchTextPartial(SWIFT_URL, 500_000);
  const seen = new Set<string>();
  const out: CosmicEvent[] = [];
  for (const cells of parseRows(html)) {
    if (cells.length < 6) continue;
    const [trig, date, time, raS, decS, errS] = cells;
    if (!/^\d+$/.test(trig) || seen.has(trig)) continue;
    const t = parseGcnDate(date, time);
    const ra = Number(raS);
    const dec = Number(decS);
    if (t === null || !Number.isFinite(ra) || !Number.isFinite(dec) || raS === "" || decS === "") continue;
    seen.add(trig);
    out.push({
      id: `swift-${trig}`,
      kind: "grb",
      time: t,
      ra,
      dec,
      intensity: 0.6 + hash01(trig) * 0.3,
      label: `Swift trigger ${trig}`,
      source: "Swift BAT",
      detail: {
        Notice: "BAT Position",
        "Position error": `${errS}′`,
      },
    });
  }
  return out;
}
