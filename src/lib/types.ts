export type EventKind = "neutrino" | "grb" | "gw";

export interface CosmicEvent {
  id: string;
  kind: EventKind;
  /** unix epoch ms (UTC) of the real detection */
  time: number;
  /** J2000 right ascension, degrees 0..360 */
  ra: number;
  /** J2000 declination, degrees -90..90 */
  dec: number;
  /** normalized artistic intensity 0..1 */
  intensity: number;
  /** short display name, e.g. "Fermi trigger 805256703" */
  label: string;
  /** observatory, e.g. "IceCube", "Fermi GBM", "LIGO / Virgo / KAGRA" */
  source: string;
  /** extra key→value pairs for the hover panel (already formatted) */
  detail: Record<string, string>;
  /** true when detected during this session (not a replay) */
  isLive?: boolean;
}

export interface SolarState {
  /** planetary K index 0..9 */
  kp: number;
  /** GOES long-band X-ray flux, W/m² */
  xray: number;
  /** derived emotional mood of the installation, 0 calm .. 1 energetic */
  mood: number;
  updatedAt: number;
}

export interface EventsPayload {
  events: CosmicEvent[];
  fetchedAt: number;
}
