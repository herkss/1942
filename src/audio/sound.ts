import type { Era } from '../data/config';

/**
 * Fully synthesized audio: Web Audio SFX + a procedural step-sequencer that
 * composes a different track for each stage / era / mood.
 */

export type Mood = 'title' | 'stage' | 'boss' | 'clear' | 'gameover';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Song {
  bpm: number;
  key: number;
  scale: number[];
  chords: number[]; // scale degree per bar
  melody: (number | null)[]; // scale index per 16th step
  lens: number[];
  bass: string;
  kick: string;
  snare: string;
  hat: string;
  arp: boolean;
  lead: OscillatorType;
  loop: boolean;
  bars: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

function makeSong(seed: number, era: Era, mood: Mood): Song {
  const r = rng(seed * 7919 + era.length * 31 + mood.length);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const major = mood === 'clear';
  const scale = major ? MAJOR : MINOR;
  const progs = major
    ? [[0, 3, 4, 0]]
    : mood === 'boss'
      ? [[0, 5, 0, 4], [0, 1, 0, 6], [0, 5, 6, 4]]
      : [[0, 5, 6, 0], [0, 3, 5, 4], [0, 5, 3, 4], [0, 6, 5, 6], [0, 2, 5, 4]];
  const prog = pick(progs);
  const bars = mood === 'clear' || mood === 'gameover' ? 4 : 8;
  const chords: number[] = [];
  for (let i = 0; i < bars; i++) chords.push(prog[i % prog.length]);
  if (mood === 'gameover') chords.splice(0, 4, 0, 5, 3, 0);

  const rhythms =
    mood === 'boss'
      ? ['x.xx.xx.x.xx.x.x', 'x..x..x.x..x.xx.', 'xxx.xxx.x.x.xxx.']
      : ['x..x..x.x.x.x...', 'x.x.x...x..xx...', 'x...x.x.x...x.x.', 'x..x..x...x.x.x.', 'x.x.x.x.x..x....'];
  const melody: (number | null)[] = [];
  let prev = 7;
  const motif: (number | null)[][] = [];
  for (let b = 0; b < Math.min(4, bars); b++) {
    const rh = pick(rhythms);
    const bar: (number | null)[] = [];
    const ch = chords[b];
    for (let s = 0; s < 16; s++) {
      if (rh[s] !== 'x') {
        bar.push(null);
        continue;
      }
      let n: number;
      if (s % 4 === 0) {
        const tones = [ch, ch + 2, ch + 4, ch + 7].filter((t) => t >= 2 && t <= 13);
        n = tones.reduce((best, t) => (Math.abs(t - prev) < Math.abs(best - prev) ? t : best), tones[0] ?? ch + 7);
        if (r() < 0.3) n = pick(tones.length ? tones : [ch + 7]);
      } else {
        n = prev + Math.round((r() - 0.5) * 4);
      }
      n = Math.max(2, Math.min(13, n));
      bar.push(n);
      prev = n;
    }
    motif.push(bar);
  }
  for (let b = 0; b < bars; b++) {
    const src = motif[b % motif.length].slice();
    if (b === bars - 1) {
      // cadence back to tonic
      for (let s = 8; s < 16; s++) src[s] = null;
      src[8] = 7;
    } else if (b >= 4 && r() < 0.5) {
      // variation: transpose a phrase up a third
      for (let s = 0; s < 16; s++) if (src[s] != null) src[s] = Math.min(14, (src[s] as number) + 2);
    }
    melody.push(...src);
  }
  const lens = melody.map((n, i) => {
    if (n == null) return 0;
    let l = 1;
    while (l < 4 && melody[i + l] == null && i + l < melody.length) l++;
    return l;
  });

  const baseBpm = { title: 112, stage: 138, boss: 156, clear: 132, gameover: 84 }[mood];
  const bpm = baseBpm + (mood === 'stage' ? Math.min(24, seed * 2) : 0) + (era === 'future' ? 6 : 0);
  const key = 45 + ((seed * 5) % 7);

  let kick = 'x.......x.......';
  let snare = '....x.......x...';
  let hat = 'x.x.x.x.x.x.x.x.';
  let bass = 'x.x.x.x.x.x.x.x.';
  if (era === 'ww2') {
    snare = '....x..x....x.xx';
    hat = 'x...x...x...x...';
    bass = 'x...x.x.x...x.x.';
  }
  if (era === 'modern') {
    kick = 'x.....x.x.......';
    bass = 'xxx.xxx.xxx.xxx.';
  }
  if (era === 'future') {
    kick = 'x...x...x...x...';
    hat = '..x...x...x...x.';
    bass = 'x.xxx.xxx.xxx.xx';
  }
  if (mood === 'boss') {
    kick = 'x..x..x.x..x..x.';
    snare = '....x.......x..x';
    hat = 'xxxxxxxxxxxxxxxx';
    bass = 'xxxxxxxxxxxxxxxx';
  }
  if (mood === 'title') {
    kick = 'x.........x.....';
    hat = '..x...x...x...x.';
  }
  if (mood === 'gameover') {
    kick = 'x...............';
    snare = '................';
    hat = '................';
    bass = 'x.......x.......';
  }
  return {
    bpm,
    key,
    scale,
    chords,
    melody,
    lens,
    bass,
    kick,
    snare,
    hat,
    arp: era === 'future' || mood === 'boss' || (era === 'modern' && mood === 'stage'),
    lead: era === 'ww2' ? 'square' : era === 'modern' ? 'sawtooth' : 'square',
    loop: mood !== 'clear' && mood !== 'gameover',
    bars,
  };
}

class Sequencer {
  private step = 0;
  private next = 0;
  private timer = 0;
  private bus: GainNode;
  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    private song: Song,
    private noise: AudioBuffer,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(out);
    this.next = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }
  stop(fade = 0.4) {
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => this.bus.disconnect(), fade * 1000 + 100);
  }
  private tick() {
    const s = this.song;
    const dt = 60 / s.bpm / 4;
    const total = s.bars * 16;
    while (this.next < this.ctx.currentTime + 0.15) {
      if (!s.loop && this.step >= total) {
        clearInterval(this.timer);
        return;
      }
      this.play(this.step % total, this.next, dt);
      this.next += dt;
      this.step++;
    }
  }
  private note(deg: number, oct: number) {
    const s = this.song;
    const o = Math.floor(deg / 7);
    const d = ((deg % 7) + 7) % 7;
    return s.key + oct * 12 + o * 12 + s.scale[d];
  }
  private play(step: number, t: number, dt: number) {
    const s = this.song;
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const ch = s.chords[bar];
    if (s.kick[i] === 'x') this.kick(t);
    if (s.snare[i] === 'x') this.snare(t);
    if (s.hat[i] === 'x') this.hat(t, i % 4 === 0 ? 0.06 : 0.035);
    if (s.bass[i] === 'x') {
      const oct = i % 8 === 4 && s.bass !== 'xxxxxxxxxxxxxxxx' ? 1 : 0;
      this.bassNote(mtof(this.note(ch, -1 + oct)), t, dt * 0.9);
    }
    if (i === 0) {
      for (const k of [0, 2, 4]) this.pad(mtof(this.note(ch + k, 0)), t, dt * 16);
    }
    if (s.arp && i % 2 === 0) {
      const k = [0, 2, 4, 7][(i / 2) % 4];
      this.arpNote(mtof(this.note(ch + k, 1)), t, dt * 1.5);
    }
    const m = s.melody[step];
    if (m != null) this.lead(mtof(this.note(m, 1)), t, dt * s.lens[step] * 0.92);
  }
  private env(g: GainNode, t: number, a: number, peak: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    this.env(g, t, 0.003, 0.9, 0.22);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.25);
  }
  private noiseHit(t: number, dur: number, vol: number, hp: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, vol, dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }
  private snare(t: number) {
    this.noiseHit(t, 0.16, 0.35, 1400);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    this.env(g, t, 0.002, 0.25, 0.1);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.12);
  }
  private hat(t: number, vol: number) {
    this.noiseHit(t, 0.045, vol * 2.2, 7500);
  }
  private bassNote(f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, 0.32, dur);
    o.connect(lp).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private pad(f: number, t: number, dur: number) {
    for (const det of [-7, 7]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.028, t + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
  private arpNote(f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = this.ctx.createGain();
    this.env(g, t, 0.003, 0.05, dur);
    o.connect(lp).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private lead(f: number, t: number, dur: number) {
    const s = this.song;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
    g.gain.setValueAtTime(0.11, t + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = s.lead === 'sawtooth' ? 2600 : 3400;
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = this.ctx.createGain();
    vg.gain.value = f * 0.006;
    vib.connect(vg);
    for (const det of [0, s.lead === 'sawtooth' ? 9 : 5]) {
      const o = this.ctx.createOscillator();
      o.type = s.lead;
      o.frequency.value = f;
      o.detune.value = det;
      vg.connect(o.frequency);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
    lp.connect(g).connect(this.bus);
    vib.start(t);
    vib.stop(t + dur + 0.03);
  }
}

export class Sound {
  private static ctx: AudioContext | null = null;
  private static master: GainNode;
  private static sfxBus: GainNode;
  private static musicBus: GainNode;
  private static noise: AudioBuffer;
  private static last: Record<string, number> = {};
  private static seq: Sequencer | null = null;
  private static current = '';
  private static engine: { o: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;
  static muted = false;

  static init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.42;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  static setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  static music(seed: number, era: Era, mood: Mood) {
    if (!this.ctx) return;
    const id = `${seed}|${era}|${mood}`;
    if (id === this.current && this.seq) return;
    this.seq?.stop();
    this.current = id;
    this.seq = new Sequencer(this.ctx, this.musicBus, makeSong(seed, era, mood), this.noise);
  }

  static stopMusic(fade = 0.6) {
    this.seq?.stop(fade);
    this.seq = null;
    this.current = '';
  }

  // ------------------------------------------------------------ primitives
  private static throttle(name: string, ms: number) {
    const now = performance.now();
    if (now - (this.last[name] ?? 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  private static tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private static hiss(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, delay = 0, q = 1) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 1.2);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ effects
  static sfx(name: string) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shot':
        if (!this.throttle(name, 70)) return;
        this.tone('square', 1100, 380, 0.05, 0.05);
        this.hiss(0.04, 0.05, 'highpass', 3000, 2000);
        break;
      case 'shotHeavy':
        if (!this.throttle(name, 90)) return;
        this.tone('sawtooth', 520, 90, 0.09, 0.07);
        this.hiss(0.06, 0.08, 'bandpass', 1800, 500);
        break;
      case 'laser':
        if (!this.throttle(name, 90)) return;
        this.tone('sawtooth', 1800, 300, 0.12, 0.05);
        this.tone('sine', 2400, 600, 0.1, 0.04);
        break;
      case 'missile':
        if (!this.throttle(name, 120)) return;
        this.hiss(0.3, 0.09, 'bandpass', 600, 2400, 0, 2);
        break;
      case 'hit':
        if (!this.throttle(name, 40)) return;
        this.hiss(0.05, 0.12, 'highpass', 2500, 1200);
        this.tone('square', 300, 200, 0.04, 0.04);
        break;
      case 'armor':
        if (!this.throttle(name, 60)) return;
        this.tone('triangle', 1600, 1500, 0.05, 0.05);
        break;
      case 'boomS':
        if (!this.throttle(name, 45)) return;
        this.hiss(0.35, 0.35, 'lowpass', 2400, 120);
        this.tone('sine', 160, 40, 0.25, 0.3);
        break;
      case 'boomM':
        if (!this.throttle(name, 60)) return;
        this.hiss(0.7, 0.5, 'lowpass', 1800, 70);
        this.tone('sine', 120, 30, 0.5, 0.45);
        break;
      case 'boomL':
        this.hiss(1.6, 0.7, 'lowpass', 1600, 40);
        this.tone('sine', 90, 22, 1.2, 0.6);
        this.hiss(0.6, 0.4, 'bandpass', 900, 200, 0.15, 1.5);
        break;
      case 'power':
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone('square', mtof(72 + n), mtof(72 + n), 0.09, 0.08, i * 0.05));
        break;
      case 'item':
        this.tone('sine', 1320, 1760, 0.12, 0.12);
        this.tone('square', 1760, 1760, 0.08, 0.05, 0.06);
        break;
      case 'medal':
        if (!this.throttle(name, 50)) return;
        this.tone('sine', 2093, 2093, 0.1, 0.09);
        this.tone('sine', 2637, 2637, 0.12, 0.08, 0.05);
        break;
      case 'oneup':
        [0, 4, 7, 12, 7, 12, 19].forEach((n, i) => this.tone('square', mtof(76 + n), mtof(76 + n), 0.1, 0.08, i * 0.07));
        break;
      case 'bomb':
        this.hiss(0.9, 0.5, 'bandpass', 300, 3000, 0, 1.2);
        this.hiss(2.2, 0.8, 'lowpass', 1500, 35, 0.35);
        this.tone('sine', 70, 25, 1.8, 0.7, 0.35);
        break;
      case 'roll':
        this.hiss(0.45, 0.22, 'bandpass', 500, 3000, 0, 3);
        break;
      case 'overdrive':
        this.tone('sawtooth', 110, 880, 0.6, 0.12);
        this.tone('square', 220, 1760, 0.6, 0.06);
        [0, 7, 12, 19, 24].forEach((n, i) => this.tone('square', mtof(64 + n), mtof(64 + n), 0.12, 0.06, 0.3 + i * 0.05));
        break;
      case 'playerHit':
        this.hiss(0.4, 0.6, 'lowpass', 3000, 200);
        this.tone('sawtooth', 300, 60, 0.4, 0.2);
        break;
      case 'shieldBreak':
        this.tone('sine', 1800, 200, 0.4, 0.15);
        this.hiss(0.3, 0.2, 'highpass', 4000, 1000);
        break;
      case 'warning':
        for (let i = 0; i < 4; i++) {
          this.tone('sawtooth', 440, 660, 0.35, 0.12, i * 0.7);
          this.tone('sawtooth', 660, 440, 0.35, 0.12, i * 0.7 + 0.35);
        }
        break;
      case 'select':
        this.tone('square', 880, 880, 0.06, 0.08);
        break;
      case 'confirm':
        this.tone('square', 660, 660, 0.07, 0.08);
        this.tone('square', 1320, 1320, 0.12, 0.08, 0.07);
        break;
      case 'deny':
        this.tone('square', 200, 150, 0.15, 0.1);
        break;
      case 'thunder':
        this.hiss(2.5, 0.6, 'lowpass', 700, 40);
        break;
      case 'touchdown':
        this.hiss(0.5, 0.4, 'lowpass', 900, 100);
        this.tone('sine', 90, 50, 0.3, 0.4);
        this.hiss(0.9, 0.12, 'bandpass', 2400, 1200, 0.1, 6);
        break;
      case 'launch':
        this.hiss(1.4, 0.5, 'bandpass', 200, 2200, 0, 1);
        this.tone('sawtooth', 60, 220, 1.4, 0.1);
        break;
      case 'tick':
        this.tone('square', 1500, 1500, 0.03, 0.04);
        break;
    }
  }

  /** Continuous engine drone during takeoff / landing. */
  static engineStart() {
    if (!this.ctx || this.engine) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 45;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.5);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start();
    this.engine = { o, g, f };
  }
  static engineThrottle(v: number) {
    if (!this.engine || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine.o.frequency.setTargetAtTime(45 + v * 80, t, 0.1);
    this.engine.f.frequency.setTargetAtTime(300 + v * 1400, t, 0.1);
  }
  static engineStop() {
    if (!this.engine || !this.ctx) return;
    const { o, g } = this.engine;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.25);
    o.stop(t + 1.2);
    this.engine = null;
  }
}
