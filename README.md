# ASTRALIS — Listening to the Universe

A living digital artwork. Real astronomical events — neutrinos, gamma-ray bursts,
gravitational waves, solar weather — are continuously translated into light, motion
and generative music. Not a dashboard: a museum installation in the browser.

Every visual event and every piano note originates from a real observation.

## The voices

| Phenomenon | Observatory | Appearance |
|---|---|---|
| Neutrinos | IceCube (gold/bronze alerts) | a ghost-thread silently crossing everything, one high piano note |
| Gamma-ray bursts | Fermi GBM · Swift BAT | a white core, golden particle bloom, the whole sky flashes; orchestral swell |
| Gravitational waves | LIGO · Virgo · KAGRA (GraceDB) | space itself ripples — stars bend, the image warps; deep drones |
| Solar activity | NOAA SWPC (Kp · GOES X-ray) | the heartbeat: colors, particle energy, aurora, musical key and density |

The installation performs the last 30 days of real events as a continuous
choreography; genuinely new detections interrupt live. Every performance leaves a
permanent trace (IndexedDB) — after weeks the artwork looks different; after months
your installation is unique.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Click the dark to enter (this also unlocks audio). Then:

- **mouse** — parallax · **drag** — rotate · **scroll** — zoom
- **double-click** — drift toward the latest event
- **hover an event** — a glass panel with its real data (time, energy, source, constellation)
- **bottom edge** — a thin timeline of the last 30 days; click a point to replay it

## Debug

Open `http://localhost:3000/?debug` and use keys **1** (neutrino), **2** (GRB),
**3** (gravitational wave), **0** (cycle solar mood).

## Stack

Next.js · React Three Fiber · custom GLSL · Tone.js · Framer Motion · zustand · idb-keyval.
API routes proxy + normalize the observatory feeds server-side with caching and
stale-on-error fallbacks — no API keys required.
