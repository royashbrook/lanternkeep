// our own little synth. nothing is loaded and nothing is recorded: every sound is drawn when it
// is wanted, the audio starts on a touch, and with both switches off no audio is made at all.

export type Cue = "tap" | "step" | "hit" | "big" | "guard" | "heal" | "sing" | "hush" | "poof" | "dizzy" | "coin" | "light" | "win" | "nap" | "join";
export type Mood = "map" | "battle" | "none";

type Wave = OscillatorType;
interface Blip { at: number; wave: Wave; from: number; to?: number; length: number; level: number }

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const bell = (at: number, midi: number, level = 0.16, length = 0.5): Blip[] => [
  { at, wave: "sine", from: hz(midi), length, level },
  { at, wave: "triangle", from: hz(midi + 12), length: length * 0.5, level: level * 0.35 },
];

const CUES: Record<Cue, () => Blip[]> = {
  tap: () => [{ at: 0, wave: "triangle", from: 660, to: 520, length: 0.07, level: 0.09 }],
  step: () => [{ at: 0, wave: "sine", from: 220, to: 150, length: 0.1, level: 0.14 }],
  hit: () => [{ at: 0, wave: "square", from: 190, to: 80, length: 0.11, level: 0.07 }, { at: 0, wave: "triangle", from: 420, to: 180, length: 0.08, level: 0.1 }],
  big: () => [{ at: 0, wave: "square", from: 300, to: 70, length: 0.18, level: 0.09 }, ...bell(0.03, 84, 0.08, 0.2)],
  guard: () => [{ at: 0, wave: "triangle", from: 900, to: 700, length: 0.13, level: 0.1 }, { at: 0.02, wave: "square", from: 140, length: 0.06, level: 0.05 }],
  heal: () => [...bell(0, 72, 0.09, 0.3), ...bell(0.09, 76, 0.09, 0.3), ...bell(0.18, 79, 0.09, 0.4)],
  sing: () => [...bell(0, 79, 0.09, 0.26), ...bell(0.12, 84, 0.09, 0.32)],
  hush: () => [{ at: 0, wave: "sine", from: 620, to: 240, length: 0.45, level: 0.1 }],
  poof: () => [{ at: 0, wave: "sine", from: 300, to: 1300, length: 0.2, level: 0.12 }, ...bell(0.1, 91, 0.06, 0.25)],
  dizzy: () => [{ at: 0, wave: "triangle", from: 520, to: 260, length: 0.4, level: 0.1 }, { at: 0.12, wave: "triangle", from: 460, to: 220, length: 0.4, level: 0.07 }],
  coin: () => [...bell(0, 88, 0.09, 0.14), ...bell(0.07, 93, 0.09, 0.3)],
  light: () => [0, 4, 7, 12, 16, 19, 24].flatMap((step, i) => bell(i * 0.1, 60 + step, 0.13, 0.9)),
  win: () => [0, 4, 7, 12, 7, 12, 16, 19, 24].flatMap((step, i) => bell(i * 0.14, 60 + step, 0.13, 0.8)),
  nap: () => [...bell(0, 67, 0.1, 0.4), ...bell(0.22, 64, 0.1, 0.4), ...bell(0.44, 60, 0.1, 0.7)],
  join: () => [0, 5, 9, 12].flatMap((step, i) => bell(i * 0.11, 65 + step, 0.12, 0.6)),
};

// two small tunes of our own, in steps: a walking one for the map and a bouncy one for battle
const TUNES = {
  map: {
    beat: 60 / 92 / 2,
    lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0, 77, 0, 76, 74, 0, 72, 69, 0, 67, 0, 69, 72, 74, 0, 72, 0],
    bass: [48, 0, 0, 0, 55, 0, 0, 0, 45, 0, 0, 0, 52, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0, 55, 0, 0, 0],
  },
  battle: {
    beat: 60 / 132 / 2,
    lead: [69, 72, 76, 72, 69, 72, 76, 79, 77, 74, 69, 74, 77, 74, 72, 71, 69, 72, 76, 72, 81, 79, 76, 72, 74, 77, 76, 74, 72, 71, 69, 0],
    bass: [45, 0, 57, 0, 45, 0, 57, 0, 41, 0, 53, 0, 41, 0, 53, 0, 45, 0, 57, 0, 48, 0, 60, 0, 43, 0, 55, 0, 40, 0, 52, 0],
  },
};

const AHEAD = 0.35;
const EVERY = 110;

export function createSound(start: { music: boolean; sfx: boolean }) {
  let music = start.music, sfx = start.sfx, hidden = false;
  let mood: Mood = "none";
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let tune: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let step = 0, nextAt = 0;
  const last = new Map<Cue, number>();

  function blip(b: Blip, when: number, bus: AudioNode) {
    if (!ctx) return;
    const end = when + b.length;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(b.level, when + Math.min(0.012, b.length / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(bus);
    const wave = ctx.createOscillator();
    wave.type = b.wave;
    wave.frequency.setValueAtTime(b.from, when);
    if (b.to) wave.frequency.exponentialRampToValueAtTime(b.to, end);
    wave.connect(gain);
    wave.onended = () => gain.disconnect();
    wave.start(when);
    wave.stop(end + 0.02);
  }

  function ensure() {
    if (ctx || !(music || sfx)) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -16;
      limit.ratio.value = 8;
      limit.connect(ctx.destination);
      out = ctx.createGain();
      out.connect(limit);
      tune = ctx.createGain();
      tune.gain.value = 0.42;
      tune.connect(out);
    } catch {
      ctx = null;
    }
  }

  function write() {
    if (!ctx || !tune || !music || hidden || mood === "none" || ctx.state !== "running") return;
    const t = TUNES[mood];
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + AHEAD) {
      const i = step % t.lead.length;
      if (t.lead[i]) blip({ at: 0, wave: "triangle", from: hz(t.lead[i]), length: t.beat * 1.7, level: 0.11 }, nextAt, tune);
      if (t.bass[i]) blip({ at: 0, wave: "sine", from: hz(t.bass[i]), length: t.beat * 2.4, level: 0.17 }, nextAt, tune);
      step += 1;
      nextAt += t.beat;
    }
  }

  function run() {
    const want = !!ctx && music && !hidden && mood !== "none";
    if (want && timer === undefined) timer = setInterval(write, EVERY);
    if (!want && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    if (want) write();
  }

  return {
    /** call from a touch: the browser only lets audio start inside one */
    wake() {
      if (hidden) return;
      ensure();
      if (ctx && ctx.state !== "running") void ctx.resume().then(run).catch(() => {});
      run();
    },
    play(cue: Cue) {
      if (!sfx || hidden) return;
      ensure();
      if (!ctx || !out || ctx.state !== "running") return;
      const now = ctx.currentTime;
      if (now - (last.get(cue) ?? -1) < 0.05) return;
      last.set(cue, now);
      for (const b of CUES[cue]()) blip(b, now + b.at, out);
    },
    setMood(next: Mood) {
      if (next === mood) return;
      mood = next;
      step = 0;
      nextAt = 0;
      run();
    },
    set(on: { music: boolean; sfx: boolean }) {
      music = on.music;
      sfx = on.sfx;
      if (music || sfx) this.wake();
      else if (ctx) void ctx.suspend().catch(() => {});
      run();
    },
    setHidden(value: boolean) {
      hidden = value;
      if (ctx) void (value ? ctx.suspend() : music || sfx ? ctx.resume() : Promise.resolve()).catch(() => {});
      run();
    },
    dispose() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
export type Sound = ReturnType<typeof createSound>;
