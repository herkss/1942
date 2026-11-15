import type { Era } from '../data/config';
import type { Style } from './styles';

/**
 * Fully synthesized audio: Web Audio SFX + a procedural step-sequencer that
 * composes a different track for each stage / era / mood.
 */

export type Mood = 'title' | 'stage' | 'boss' | 'clear' | 'gameover' | 'hangar';

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
  st: Style;
  bpm: number;
  key: number;
  chords: number[];
  melody: (number | null)[];
  lens: number[];
  loop: boolean;
  bars: number;
  arp: string | undefined;
  delay: number;
  dist: number;
  lead: OscillatorType;
  era: Era;
  pad: OscillatorType | undefined;
  padVol: number;
  swing: number;
}

/** Compose a song from a style; the seed varies progression and melody. */
function makeSong(st: Style, seed: number, era: Era, loop: boolean): Song {
  const r = rng(seed * 7919 + st.bpm * 13 + st.key);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const prog = pick(st.progs);
  const bars = loop ? 8 : 4;
  const chords: number[] = [];
  for (let i = 0; i < bars; i++) chords.push(prog[i % prog.length]);

  const melody: (number | null)[] = [];
  let prev = 7;
  const motif: (number | null)[][] = [];
  for (let b = 0; b < Math.min(4, bars); b++) {
    const rh = pick(st.rhythms);
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
      } else n = prev + Math.round((r() - 0.5) * 4);
      n = Math.max(2, Math.min(13, n));
      bar.push(n);
      prev = n;
    }
    motif.push(bar);
  }
  for (let b = 0; b < bars; b++) {
    const src = motif[b % motif.length].slice();
    if (b === bars - 1) {
      for (let s = 8; s < 16; s++) src[s] = null;
      src[8] = 7;
    } else if (b >= 4 && r() < 0.5) {
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

  // era flavouring:
  //  WWII   -> brass section lead, string pads, march snare fills, timpani, light swing
  //  Modern -> distorted power-chord bass, driving rock kit, gritty saw lead
  //  Future -> synthwave arps, long space echo, pumping pads, gliding lead
  let arp = st.arp;
  let delay = st.delay ?? 0;
  let dist = st.dist ?? 0;
  let lead = st.lead;
  let pad = st.pad;
  let padVol = st.padVol ?? 0.03;
  let swing = st.swing ?? 0;
  if (era === 'ww2') {
    lead = lead === 'sine' || lead === 'triangle' ? lead : 'square';
    arp = undefined;
    dist = 0;
    pad = pad ?? 'sawtooth';
    padVol = Math.max(padVol, 0.035);
    swing = Math.max(swing, 0.05);
  } else if (era === 'modern') {
    dist = Math.max(dist, 5);
    if (lead === 'square') lead = 'sawtooth';
  } else {
    arp = arp ?? '0124012401240124';
    delay = Math.max(delay, 0.32);
    pad = 'sawtooth';
    padVol = Math.max(padVol, 0.04);
    dist = Math.min(dist, 2);
  }
  return { st, bpm: st.bpm + (era === 'future' ? 4 : era === 'ww2' ? -6 : 0), key: st.key + ((seed * 2) % 3) - 1, chords, melody, lens, loop, bars, arp, delay, dist, lead, era, pad, padVol, swing };
}

function distCurve(k: number) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

class Sequencer {
  private step = 0;
  private next = 0;
  private timer = 0;
  private bus: GainNode;
  private send: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private padBus: GainNode;
  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    private song: Song,
    private noise: AudioBuffer,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(out);
    this.padBus = ctx.createGain();
    this.padBus.connect(this.bus);
    const dt16 = 60 / song.bpm / 4;
    if (song.delay > 0) {
      const d = ctx.createDelay(2);
      d.delayTime.value = dt16 * 3;
      const fb = ctx.createGain();
      fb.gain.value = song.delay;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      this.send = ctx.createGain();
      this.send.gain.value = 0.6;
      this.send.connect(d);
      d.connect(lp).connect(fb).connect(d);
      lp.connect(this.bus);
    }
    if (song.dist > 0) {
      this.shaper = ctx.createWaveShaper();
      this.shaper.curve = distCurve(song.dist);
      const post = ctx.createGain();
      post.gain.value = 0.55;
      this.shaper.connect(post).connect(this.bus);
    }
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
      const sw = this.step % 2 === 1 ? s.swing * dt : 0;
      this.play(this.step % total, this.next + sw, dt);
      this.next += dt;
      this.step++;
    }
  }
  private note(deg: number, oct: number) {
    const sc = this.song.st.scale;
    const o = Math.floor(deg / 7);
    const d = ((deg % 7) + 7) % 7;
    return this.song.key + oct * 12 + o * 12 + sc[d];
  }
  private play(step: number, t: number, dt: number) {
    const s = this.song;
    const st = s.st;
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const ch = s.chords[bar];
    if (st.kick[i] === 'x' || (s.era === 'modern' && i === 10 && st.kick[8] === 'x')) {
      this.kick(t);
      if (s.era === 'future') {
        // sidechain pump on pads
        const g = this.padBus.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.25, t);
        g.linearRampToValueAtTime(1, t + dt * 3);
      }
    }
    if (st.snare[i] === 'x') this.snare(t, st.snare.split('x').length > 6 ? 0.22 : 0.35);
    // WWII march fill at the end of each 4-bar phrase
    if (s.era === 'ww2' && bar % 4 === 3 && i >= 12) this.snare(t, 0.12 + (i - 12) * 0.05);
    if (s.era === 'modern' && st.hat[i] !== 'x' && i % 2 === 0) this.hat(t, 0.025);
    if (st.hat[i] === 'x') this.hat(t, i % 4 === 0 ? 0.06 : 0.035);
    if (st.tom && st.tom[i] === 'x') this.tom(t, 110 - (i % 4) * 12);
    if (st.bass[i] === 'x') {
      const oct = i % 8 === 4 && !st.bass.startsWith('xxxx') ? 1 : 0;
      const f = mtof(this.note(ch, -1 + oct));
      this.bassNote(f, t, dt * 0.9);
      if (s.era === 'modern') this.bassNote(f * 1.5, t, dt * 0.9, 0.16);
      if (st.sub > 0 && (i % 4 === 0 || st.bass.startsWith('x.') || oct === 0)) this.subNote(mtof(this.note(ch, -2)), t, dt * (i % 4 === 0 ? 3.6 : 0.95), st.sub);
    }
    if (i === 0 && s.pad) for (const k of [0, 2, 4]) this.pad(mtof(this.note(ch + k, 0)), t, dt * 16);
    if (s.arp && s.arp[i] !== '.') {
      const k = [0, 2, 4, 7, 9][parseInt(s.arp[i], 10) % 5];
      this.arpNote(mtof(this.note(ch + k, 1)), t, dt * 1.5);
    }
    if (st.bell && st.bell[i] === 'x') this.bellNote(mtof(this.note(ch + [0, 2, 4, 7][(i >> 2) % 4], 3)), t);
    const m = s.melody[step];
    if (m != null) {
      const f = mtof(this.note(m, st.leadOct));
      const len = st.pluck ?? dt * s.lens[step] * 0.92;
      this.lead(f, t, len);
      // WWII brass section: a fifth below doubles the melody
      if (s.era === 'ww2' && !st.pluck) this.lead(f * 0.667, t, len, 0.45);
    }
  }
  private env(g: GainNode, t: number, a: number, peak: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.3);
    this.env(g, t, 0.002, 1.0, 0.32);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.34);
    // click transient
    this.noiseHit(t, 0.012, 0.25, 3000);
  }
  private noiseHit(t: number, dur: number, vol: number, hp: number, lpf = 0) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = lpf ? 'lowpass' : 'highpass';
    f.frequency.value = lpf || hp;
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, vol, dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }
  private snare(t: number, vol: number) {
    this.noiseHit(t, 0.16, vol, 1400);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    this.env(g, t, 0.002, vol * 0.7, 0.1);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.12);
  }
  private tom(t: number, f: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.25);
    this.env(g, t, 0.003, 0.55, 0.3);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.32);
    this.noiseHit(t, 0.08, 0.12, 0, 900);
  }
  private hat(t: number, vol: number) {
    this.noiseHit(t, 0.045, vol * 2.2, 7500);
  }
  private bassNote(f: number, t: number, dur: number, vol = 0.3) {
    const o = this.ctx.createOscillator();
    o.type = this.song.era === 'modern' ? 'sawtooth' : this.song.st.bassWave;
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(lp).connect(g);
    g.connect(this.bus);
    if (this.shaper) g.connect(this.shaper);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  /** Deep sine sub-bass an octave under the bassline. */
  private subNote(f: number, t: number, dur: number, vol: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private pad(f: number, t: number, dur: number) {
    const s = this.song;
    const atk = s.era === 'ww2' ? 0.6 : s.era === 'future' ? 0.05 : 0.3;
    for (const det of s.era === 'future' ? [-14, 0, 14] : [-7, 7]) {
      const o = this.ctx.createOscillator();
      o.type = s.pad ?? 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = s.era === 'future' ? 1400 : 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(s.padVol, t + atk);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(this.padBus);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
  private arpNote(f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = this.song.st.arpWave ?? 'square';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = this.ctx.createGain();
    this.env(g, t, 0.003, 0.045, dur);
    o.connect(lp).connect(g).connect(this.bus);
    if (this.send) g.connect(this.send);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private bellNote(f: number, t: number) {
    for (const [mul, v] of [
      [1, 0.06],
      [2.76, 0.02],
    ]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = this.ctx.createGain();
      this.env(g, t, 0.002, v, 0.9);
      o.connect(g).connect(this.bus);
      if (this.send) g.connect(this.send);
      o.start(t);
      o.stop(t + 0.95);
    }
  }
  private lastLead = 0;
  private lead(f: number, t: number, dur: number, volMul = 1) {
    const s = this.song;
    const st = s.st;
    const vol = st.leadVol * volMul;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (s.era === 'ww2' ? 0.035 : 0.012));
    if (!st.pluck) g.gain.setValueAtTime(vol, t + Math.max(0.04, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = st.leadCut;
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = this.ctx.createGain();
    vg.gain.value = st.pluck ? 0 : f * 0.006;
    vib.connect(vg);
    for (const det of [0, s.lead === 'sawtooth' ? 9 : 5]) {
      const o = this.ctx.createOscillator();
      o.type = s.lead;
      if (s.era === 'future' && this.lastLead && volMul === 1) {
        o.frequency.setValueAtTime(this.lastLead, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      } else o.frequency.value = f;
      o.detune.value = det;
      vg.connect(o.frequency);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
    if (volMul === 1) this.lastLead = f;
    lp.connect(g);
    g.connect(this.bus);
    if (this.send) g.connect(this.send);
    if (this.shaper && s.lead === 'sawtooth') g.connect(this.shaper);
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
  private static engine: { nodes: AudioScheduledSourceNode[]; out: GainNode; set: (v: number) => void } | null = null;
  static muted = false;
  static era: Era = 'ww2';
  static setEra(e: Era) {
    this.era = e;
  }

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
    this.sfxBus.gain.value = 0.85;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.32;
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

  /** Play a style-based track. Returns its title. */
  static music(id: string, style: Style, seed: number, era: Era, loop = true) {
    if (!this.ctx) return style.title;
    const key = `${id}|${seed}|${era}`;
    if (key === this.current && this.seq) return style.title;
    this.seq?.stop();
    this.current = key;
    this.seq = new Sequencer(this.ctx, this.musicBus, makeSong(style, seed, era, loop), this.noise);
    return style.title;
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
        if (this.era === 'ww2') {
          // rattling .50 cal
          this.hiss(0.05, 0.12, 'bandpass', 1400, 600, 0, 1.5);
          this.tone('square', 180, 90, 0.04, 0.05);
        } else if (this.era === 'modern') {
          // vulcan buzz
          this.tone('sawtooth', 900, 500, 0.04, 0.04);
          this.hiss(0.035, 0.08, 'highpass', 2600, 1800);
        } else {
          this.tone('square', 1800, 600, 0.06, 0.04);
          this.tone('sine', 2600, 900, 0.05, 0.03);
        }
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
        if (this.era === 'future') {
          this.tone('sine', 400, 1600, 0.25, 0.06);
          this.tone('triangle', 800, 2400, 0.2, 0.03);
        } else this.hiss(0.3, 0.09, 'bandpass', this.era === 'ww2' ? 400 : 700, this.era === 'ww2' ? 1400 : 2800, 0, 2);
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
        if (this.era === 'future') this.tone('sawtooth', 1200, 80, 0.3, 0.05);
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
        if (this.era === 'ww2') {
          // full-throttle prop roar off the deck
          this.hiss(1.2, 0.35, 'lowpass', 400, 1400, 0, 1);
          this.tone('sawtooth', 70, 110, 1.2, 0.08);
        } else if (this.era === 'modern') {
          // steam catapult shot + afterburner light-off
          this.hiss(0.25, 0.6, 'highpass', 1500, 4000);
          this.hiss(1.6, 0.6, 'bandpass', 300, 2600, 0.1, 0.8);
          this.tone('sine', 40, 30, 1.2, 0.3, 0.1);
        } else {
          // mag-rail charge and thruster burn
          this.tone('sine', 200, 2400, 0.7, 0.08);
          this.tone('square', 100, 1200, 0.7, 0.03);
          this.tone('sine', 60, 35, 1.4, 0.35, 0.6);
          this.hiss(1.2, 0.3, 'bandpass', 2000, 600, 0.6, 2);
        }
        break;
      case 'tick':
        this.tone('square', 1500, 1500, 0.03, 0.04);
        break;
    }
  }

  /** Continuous engine drone during takeoff / landing. */
  private static amb: { nodes: AudioScheduledSourceNode[]; g: GainNode } | null = null;
  /** Low wind + distant engine drone bed while flying. */
  static ambience(on: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!on) {
      if (!this.amb) return;
      const { nodes, g } = this.amb;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      nodes.forEach((n) => n.stop(ctx.currentTime + 2));
      this.amb = null;
      return;
    }
    if (this.amb) return;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    g.connect(this.sfxBus);
    const era = this.era;
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    // future: thin high shimmer instead of wind; modern: jet roar band
    wf.type = era === 'future' ? 'highpass' : era === 'modern' ? 'bandpass' : 'lowpass';
    wf.frequency.value = era === 'future' ? 6000 : era === 'modern' ? 900 : 380;
    const wg = ctx.createGain();
    wg.gain.value = era === 'future' ? 0.012 : era === 'modern' ? 0.06 : 0.07;
    wind.connect(wf).connect(wg).connect(g);
    const eng = ctx.createOscillator();
    eng.type = era === 'future' ? 'sine' : 'sawtooth';
    eng.frequency.value = era === 'future' ? 48 : era === 'modern' ? 90 : 62;
    const ef = ctx.createBiquadFilter();
    ef.type = 'lowpass';
    ef.frequency.value = era === 'modern' ? 400 : 180;
    const eg = ctx.createGain();
    eg.gain.value = era === 'future' ? 0.09 : 0.05;
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    if (era === 'ww2') {
      // propeller "chop": amplitude modulation
      lfo.frequency.value = 17;
      lg.gain.value = 0.03;
      lfo.connect(lg).connect(eg.gain);
    } else {
      lfo.frequency.value = era === 'future' ? 0.15 : 0.3;
      lg.gain.value = era === 'future' ? 6 : 3;
      lfo.connect(lg).connect(eng.frequency);
    }
    eng.connect(ef).connect(eg).connect(g);
    const nodes: AudioScheduledSourceNode[] = [wind, eng, lfo];
    if (era === 'future') {
      const o2 = ctx.createOscillator();
      o2.frequency.value = 72.5;
      const g2 = ctx.createGain();
      g2.gain.value = 0.05;
      o2.connect(g2).connect(g);
      o2.start();
      nodes.push(o2);
    } else if (era === 'modern') {
      const wh = ctx.createOscillator();
      wh.frequency.value = 2400;
      const wg2 = ctx.createGain();
      wg2.gain.value = 0.006;
      wh.connect(wg2).connect(g);
      wh.start();
      nodes.push(wh);
    }
    wind.start();
    eng.start();
    lfo.start();
    this.amb = { nodes, g };
  }

  /**
   * Carrier deck engine sound, per era:
   *  WWII   - piston engine + propeller chop (amplitude-modulated sawtooth)
   *  Modern - jet turbine: spooling whine + broadband roar
   *  Future - thruster: deep pulsing hum + plasma hiss + rising resonance
   */
  static engineStart() {
    if (!this.ctx || this.engine) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(1, now + 0.6);
    out.connect(this.sfxBus);
    const nodes: AudioScheduledSourceNode[] = [];
    const params: { set: (v: number, t: number) => void }[] = [];
    const osc = (type: OscillatorType, f: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      nodes.push(o);
      return o;
    };
    const noise = () => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.loop = true;
      nodes.push(n);
      return n;
    };
    if (this.era === 'ww2') {
      // engine body
      const body = osc('sawtooth', 38);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const vca = ctx.createGain();
      vca.gain.value = 0.11;
      body.connect(lp).connect(vca).connect(out);
      // propeller chop: LFO on amplitude, rate follows RPM
      const chop = osc('square', 9);
      const depth = ctx.createGain();
      depth.gain.value = 0.07;
      chop.connect(depth).connect(vca.gain);
      // exhaust crackle
      const nz = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 500;
      const ng = ctx.createGain();
      ng.gain.value = 0.05;
      nz.connect(bp).connect(ng).connect(out);
      params.push({
        set: (v, t) => {
          body.frequency.setTargetAtTime(38 + v * 52, t, 0.15);
          chop.frequency.setTargetAtTime(9 + v * 34, t, 0.15);
          lp.frequency.setTargetAtTime(260 + v * 900, t, 0.15);
          ng.gain.setTargetAtTime(0.04 + v * 0.08, t, 0.15);
        },
      });
    } else if (this.era === 'modern') {
      // turbine whine
      const whine = osc('sine', 900);
      const wg = ctx.createGain();
      wg.gain.value = 0.025;
      whine.connect(wg).connect(out);
      const whine2 = osc('triangle', 1800);
      const wg2 = ctx.createGain();
      wg2.gain.value = 0.01;
      whine2.connect(wg2).connect(out);
      // jet roar
      const nz = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.6;
      bp.frequency.value = 400;
      const ng = ctx.createGain();
      ng.gain.value = 0.08;
      nz.connect(bp).connect(ng).connect(out);
      // low rumble
      const rum = osc('sawtooth', 55);
      const rl = ctx.createBiquadFilter();
      rl.type = 'lowpass';
      rl.frequency.value = 140;
      const rg = ctx.createGain();
      rg.gain.value = 0.07;
      rum.connect(rl).connect(rg).connect(out);
      params.push({
        set: (v, t) => {
          whine.frequency.setTargetAtTime(900 + v * 2600, t, 0.35);
          whine2.frequency.setTargetAtTime(1800 + v * 5000, t, 0.35);
          bp.frequency.setTargetAtTime(400 + v * 2200, t, 0.3);
          ng.gain.setTargetAtTime(0.06 + v * 0.22, t, 0.3);
          rg.gain.setTargetAtTime(0.06 + v * 0.1, t, 0.3);
        },
      });
    } else {
      // thruster hum (two detuned low sines beating)
      const h1 = osc('sine', 46);
      const h2 = osc('sine', 46.7);
      const hg = ctx.createGain();
      hg.gain.value = 0.12;
      h1.connect(hg);
      h2.connect(hg);
      hg.connect(out);
      // pulsing ion drive
      const pulse = osc('square', 92);
      const pl = ctx.createBiquadFilter();
      pl.type = 'lowpass';
      pl.Q.value = 8;
      pl.frequency.value = 300;
      const pg = ctx.createGain();
      pg.gain.value = 0.03;
      pulse.connect(pl).connect(pg).connect(out);
      const lfo = osc('sine', 3);
      const lg = ctx.createGain();
      lg.gain.value = 200;
      lfo.connect(lg).connect(pl.frequency);
      // plasma hiss
      const nz = noise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const ng = ctx.createGain();
      ng.gain.value = 0.015;
      nz.connect(hp).connect(ng).connect(out);
      params.push({
        set: (v, t) => {
          h1.frequency.setTargetAtTime(46 + v * 30, t, 0.3);
          h2.frequency.setTargetAtTime(46.7 + v * 31, t, 0.3);
          pulse.frequency.setTargetAtTime(92 + v * 160, t, 0.3);
          lfo.frequency.setTargetAtTime(3 + v * 14, t, 0.3);
          ng.gain.setTargetAtTime(0.015 + v * 0.07, t, 0.3);
          hp.frequency.setTargetAtTime(3000 - v * 1600, t, 0.3);
        },
      });
    }
    nodes.forEach((n) => n.start());
    this.engine = { nodes, out, set: (v) => params.forEach((p) => p.set(v, ctx.currentTime)) };
  }
  static engineThrottle(v: number) {
    this.engine?.set(Math.max(0, Math.min(1, v)));
  }
  static engineStop() {
    if (!this.engine || !this.ctx) return;
    const { nodes, out } = this.engine;
    const t = this.ctx.currentTime;
    out.gain.setTargetAtTime(0.0001, t, 0.3);
    nodes.forEach((n) => n.stop(t + 1.5));
    this.engine = null;
  }
}
