// All audio is synthesized with the Web Audio API, so there are no asset files to load.
export type Sfx = "click" | "correct" | "easy" | "hard" | "wrong" | "send" | "receive" | "fix" | "streak" | "levelUp" | "complete";

interface State {
  sfx: boolean;
  music: boolean;
}

const read = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const write = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
};

let state: State = { sfx: read("sfx", true), music: read("music", false) };
const listeners = new Set<() => void>();
const emit = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master! };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function tone(out: AudioNode, c: AudioContext, midi: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz(midi), at);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(hz(slideTo), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

// [midi, offset seconds, duration, wave, volume, slide-to midi?]
type Note = [number, number, number, OscillatorType, number, number?];
const SFX: Record<Sfx, Note[]> = {
  click: [[84, 0, 0.05, "sine", 0.08]],
  correct: [[76, 0, 0.14, "sine", 0.22], [83, 0.09, 0.32, "sine", 0.22], [88, 0.09, 0.32, "triangle", 0.06]],
  easy: [[76, 0, 0.12, "sine", 0.22], [80, 0.08, 0.12, "sine", 0.22], [83, 0.16, 0.12, "sine", 0.22], [88, 0.24, 0.4, "sine", 0.24]],
  hard: [[72, 0, 0.16, "triangle", 0.18], [71, 0.12, 0.26, "triangle", 0.16]],
  wrong: [[60, 0, 0.18, "triangle", 0.2], [55, 0.13, 0.32, "triangle", 0.2]],
  send: [[72, 0, 0.12, "sine", 0.16, 84]],
  receive: [[79, 0, 0.1, "sine", 0.14], [84, 0.09, 0.2, "sine", 0.14]],
  fix: [[91, 0, 0.1, "sine", 0.1], [96, 0.07, 0.25, "sine", 0.1]],
  streak: [[79, 0, 0.18, "triangle", 0.2], [84, 0.12, 0.18, "triangle", 0.2], [91, 0.24, 0.5, "triangle", 0.22], [96, 0.24, 0.5, "sine", 0.08]],
  levelUp: [
    [72, 0, 0.25, "triangle", 0.2], [76, 0.14, 0.25, "triangle", 0.2], [79, 0.28, 0.25, "triangle", 0.2],
    [84, 0.42, 0.9, "triangle", 0.24], [88, 0.42, 0.9, "sine", 0.12], [91, 0.42, 0.9, "sine", 0.1], [96, 0.6, 0.7, "sine", 0.08],
  ],
  complete: [
    [67, 0, 0.18, "triangle", 0.2], [72, 0.15, 0.18, "triangle", 0.2], [76, 0.3, 0.18, "triangle", 0.2],
    [79, 0.45, 0.18, "triangle", 0.2], [84, 0.6, 0.8, "triangle", 0.24], [88, 0.6, 0.8, "sine", 0.1],
  ],
};

function play(name: Sfx) {
  if (!state.sfx) return;
  try {
    const { ctx: c, master: m } = audio();
    const t0 = c.currentTime + 0.01;
    for (const [midi, off, dur, type, vol, slide] of SFX[name]) tone(m, c, midi, t0 + off, dur, type, vol, slide);
  } catch {
    /* audio blocked or unsupported */
  }
}

// Ambient music: a slow chord pad (Am - F - C - G) plus sparse pentatonic plucks, all quiet and low-passed.
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const PENTATONIC = [69, 72, 74, 76, 79, 81];
const CHORD_SECONDS = 8;
let musicBus: GainNode | null = null;
let musicTimer: number | undefined;
let chordIndex = 0;

function scheduleChord() {
  if (!ctx || !musicBus) return;
  const c = ctx;
  const bus = musicBus;
  const t0 = c.currentTime + 0.05;
  for (const midi of CHORDS[chordIndex % CHORDS.length]) {
    for (const detune of [-6, 6]) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "triangle";
      osc.frequency.value = hz(midi);
      osc.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 2.5);
      g.gain.linearRampToValueAtTime(0.0001, t0 + CHORD_SECONDS + 1.5);
      osc.connect(g).connect(bus);
      osc.start(t0);
      osc.stop(t0 + CHORD_SECONDS + 1.6);
    }
  }
  for (let i = 0; i < 3; i++) {
    const at = t0 + 1 + i * 2.4 + Math.random();
    tone(bus, c, PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] + 12, at, 1.6, "sine", 0.035);
  }
  chordIndex++;
  musicTimer = window.setTimeout(scheduleChord, CHORD_SECONDS * 1000);
}

function startMusic() {
  if (musicBus) return;
  const { ctx: c, master: m } = audio();
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  musicBus = c.createGain();
  musicBus.gain.setValueAtTime(0.0001, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.7, c.currentTime + 2);
  musicBus.connect(filter).connect(m);
  chordIndex = 0;
  scheduleChord();
}

function stopMusic() {
  window.clearTimeout(musicTimer);
  if (ctx && musicBus) {
    const bus = musicBus;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    window.setTimeout(() => bus.disconnect(), 800);
  }
  musicBus = null;
}

export const sound = {
  play,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: () => state,
  setSfx(on: boolean) {
    write("sfx", on);
    emit({ ...state, sfx: on });
    if (on) play("click");
  },
  setMusic(on: boolean) {
    write("music", on);
    emit({ ...state, music: on });
    try {
      if (on) startMusic();
      else stopMusic();
    } catch {
      /* audio blocked or unsupported */
    }
  },
  /** Browsers only allow audio after a gesture: call this from a click to resume saved music. */
  resumeMusicIfEnabled() {
    if (state.music && !musicBus) sound.setMusic(true);
  },
};
