/**
 * The voice of the installation. No melody, no rhythm — an evolving atmosphere:
 * a warm drone bed, sparse generative piano, and one voice per cosmic event.
 * Tone.js is imported dynamically inside init() so it only ever loads in the
 * browser, after the user's entry gesture (autoplay policy).
 */

type ToneModule = typeof import("tone");

interface ScaleTier {
  notes: string[];
  high: string[];
  droneHz: [number, number, number];
}

// calm deep-blue → awake → golden energetic
const TIERS: ScaleTier[] = [
  {
    notes: ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4", "C5", "D5", "F5"],
    high: ["A5", "C6", "D6", "F6", "A6"],
    droneHz: [73.42, 110.0, 146.83], // D minor pentatonic
  },
  {
    notes: ["G3", "A3", "B3", "D4", "E4", "G4", "A4", "B4", "D5", "E5", "G5"],
    high: ["B5", "D6", "E6", "G6", "B6"],
    droneHz: [98.0, 146.83, 196.0], // G major pentatonic
  },
  {
    notes: ["D3", "E3", "F#3", "A3", "B3", "D4", "E4", "F#4", "A4", "B4", "D5", "E5"],
    high: ["B5", "D6", "E6", "F#6", "A6"],
    droneHz: [73.42, 110.0, 185.0], // D lydian colour
  },
];

class AudioEngine {
  ready = false;
  private T!: ToneModule;
  private mood = 0.3;
  private tier = 0;
  private pianoLoaded = false;
  private disposed = false;

  private piano!: import("tone").Sampler;
  private pianoFallback!: import("tone").PolySynth;
  private glass!: import("tone").PolySynth;
  private pad!: import("tone").PolySynth;
  private sub!: import("tone").MembraneSynth;
  private drones: import("tone").Oscillator[] = [];
  private droneGain!: import("tone").Gain;
  private droneFilter!: import("tone").Filter;
  private noiseGain!: import("tone").Gain;
  private gwOsc!: import("tone").Oscillator;
  private gwGain!: import("tone").Gain;
  private pianoGain!: import("tone").Gain;

  async init(): Promise<void> {
    if (this.ready) return;
    const T = await import("tone");
    this.T = T;
    await T.start();

    const master = new T.Gain(0.85);
    const reverb = new T.Reverb({ decay: 9, preDelay: 0.04, wet: 0.5 });
    const limiter = new T.Limiter(-3);
    master.chain(reverb, limiter, T.getDestination());

    // ambient drone bed — three breathing oscillators through a slow filter
    this.droneFilter = new T.Filter(340, "lowpass");
    this.droneGain = new T.Gain(0.0);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(master);
    const tier = TIERS[0];
    const types: ("sine" | "triangle")[] = ["sine", "sine", "triangle"];
    tier.droneHz.forEach((hz, i) => {
      const osc = new T.Oscillator(hz, types[i]);
      const g = new T.Gain(i === 2 ? 0.12 : 0.3);
      osc.connect(g);
      g.connect(this.droneFilter);
      const breath = new T.LFO(0.015 + i * 0.008, i === 2 ? 0.04 : 0.14, i === 2 ? 0.16 : 0.38);
      breath.connect(g.gain);
      breath.start();
      osc.start();
      this.drones.push(osc);
    });
    const filterDrift = new T.LFO(0.008, 220, 620);
    filterDrift.connect(this.droneFilter.frequency);
    filterDrift.start();

    // piano — Salamander grand, with a soft synth stand-in until samples arrive
    this.pianoGain = new T.Gain(0.55);
    this.pianoGain.connect(master);
    this.pianoFallback = new T.PolySynth(T.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 1.6, sustain: 0.0, release: 4 },
      volume: -14,
    });
    this.pianoFallback.connect(this.pianoGain);
    this.piano = new T.Sampler({
      urls: salamanderUrls(),
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      release: 4,
      onload: () => {
        this.pianoLoaded = true;
      },
    });
    this.piano.connect(this.pianoGain);

    // glass harmonics — near-silent sine partials, very long release
    this.glass = new T.PolySynth(T.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.6, sustain: 0.06, release: 9 },
      volume: -22,
    });
    this.glass.connect(master);

    // pad for orchestral blooms and gravitational chords
    this.pad = new T.PolySynth(T.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 18 },
      envelope: { attack: 2.2, decay: 2, sustain: 0.5, release: 10 },
      volume: -18,
    });
    this.pad.maxPolyphony = 16;
    this.pad.connect(master);

    // GRB swell — brown noise crescendo
    const noise = new T.Noise("brown").start();
    const noiseFilter = new T.Filter(300, "bandpass");
    this.noiseGain = new T.Gain(0.0);
    noise.chain(noiseFilter, this.noiseGain);
    this.noiseGain.connect(master);

    // sub impacts
    this.sub = new T.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 5,
      envelope: { attack: 0.002, decay: 1.4, sustain: 0.01, release: 2.2 },
      volume: -10,
    });
    this.sub.connect(master);

    // gravitational-wave glissando voice
    this.gwOsc = new T.Oscillator(55, "sine");
    this.gwGain = new T.Gain(0.0);
    this.gwOsc.connect(this.gwGain);
    this.gwGain.connect(master);
    this.gwOsc.start();

    this.ready = true;
    this.droneGain.gain.rampTo(0.5, 6);
    this.generativeStep();
  }

  /** Solar activity conducts: scale, drone brightness, piano density. */
  setMood(m: number): void {
    this.mood = Math.min(1, Math.max(0, m));
    if (!this.ready) return;
    const tier = this.mood < 0.34 ? 0 : this.mood < 0.67 ? 1 : 2;
    if (tier !== this.tier) {
      this.tier = tier;
      TIERS[tier].droneHz.forEach((hz, i) => this.drones[i]?.frequency.rampTo(hz, 12));
    }
    this.droneGain.gain.rampTo(0.4 + 0.35 * this.mood, 8);
  }

  /** One isolated note, almost missed — the invisible passing through. */
  neutrino(intensity: number): void {
    if (!this.ready) return;
    const t = TIERS[this.tier];
    const note = pick(t.high);
    this.playPiano(note, 0.08 + intensity * 0.14);
    this.glass.triggerAttackRelease(note, 5, undefined, 0.04 + intensity * 0.05);
  }

  /** Creation. Power. A cinematic bloom with a long warm decay. */
  grb(intensity: number): void {
    if (!this.ready) return;
    const T = this.T;
    const now = T.now();
    const peak = 0.16 + intensity * 0.3;
    this.noiseGain.gain.cancelScheduledValues(now);
    this.noiseGain.gain.rampTo(peak, 1.15);
    setTimeout(() => this.noiseGain.gain.rampTo(0.0001, 5.5), 1250);
    this.sub.triggerAttackRelease("C1", "2n", now + 1.15, 0.55 + intensity * 0.35);
    const cluster = ["D2", "A2", "E3", "D4", "A4"];
    cluster.forEach((n, i) => this.playPiano(n, 0.5 + intensity * 0.3 - i * 0.06, now + 1.15 + i * 0.05));
    this.pad.triggerAttackRelease(["D3", "A3", "E4", "F#4"], 9, now + 1.2, 0.3 + intensity * 0.2);
  }

  /** The fabric of reality moving — a deep glissando beneath everything. */
  gw(intensity: number): void {
    if (!this.ready) return;
    const T = this.T;
    const now = T.now();
    this.gwOsc.frequency.setValueAtTime(58, now);
    this.gwOsc.frequency.rampTo(36, 9);
    this.gwGain.gain.cancelScheduledValues(now);
    this.gwGain.gain.rampTo(0.1 + intensity * 0.12, 2.5);
    setTimeout(() => this.gwGain.gain.rampTo(0.0001, 11), 2600);
    this.sub.triggerAttackRelease("A0", "1n", now + 0.4, 0.35 + intensity * 0.25);
    this.pad.triggerAttackRelease(["D2", "A2", "F3"], 13, now + 0.6, 0.26);
    const chord = ["D3", "F3", "A3", "E4"];
    chord.forEach((n, i) => this.playPiano(n, 0.2, now + 1 + i * 0.75));
  }

  private playPiano(note: string, velocity: number, time?: number): void {
    const v = Math.min(1, velocity);
    if (this.pianoLoaded) this.piano.triggerAttackRelease(note, 6, time, v);
    else this.pianoFallback.triggerAttackRelease(note, 4, time, v);
  }

  /** Poisson-timed generative piano; density follows the Sun. */
  private generativeStep(): void {
    if (this.disposed) return;
    const meanSec = 10 - this.mood * 6;
    const wait = Math.max(1.6, -Math.log(1 - Math.random()) * meanSec);
    setTimeout(() => {
      if (this.disposed) return;
      if (this.ready) {
        const t = TIERS[this.tier];
        const note = pick(t.notes);
        this.playPiano(note, 0.06 + Math.random() * 0.16);
        if (Math.random() < 0.12) {
          const other = pick(t.notes);
          this.playPiano(other, 0.05 + Math.random() * 0.08, this.T.now() + 0.3 + Math.random() * 0.5);
        }
      }
      this.generativeStep();
    }, wait * 1000);
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function salamanderUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (let oct = 1; oct <= 7; oct++) {
    urls[`A${oct}`] = `A${oct}.mp3`;
    urls[`C${oct}`] = `C${oct}.mp3`;
    urls[`D#${oct}`] = `Ds${oct}.mp3`;
    urls[`F#${oct}`] = `Fs${oct}.mp3`;
  }
  return urls;
}

export const audio = new AudioEngine();
