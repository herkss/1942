import Phaser from 'phaser';
import type { Era } from '../data/config';
import type { Theme, IslandStyle } from '../data/themes';

/**
 * All art is painted procedurally with Canvas2D at boot, so the game ships
 * without external image assets. Era-specific textures are suffixed `_ww2`,
 * `_modern`, `_future`; use `tk()` to resolve them for the current run.
 */

type Ctx = CanvasRenderingContext2D;

let currentEra: Era = 'ww2';
export function setTextureEra(e: Era) {
  currentEra = e;
}
/** Resolve an era-specific texture key. */
export function tk(name: string) {
  return `${name}_${currentEra}`;
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h))!;
  const c = tex.getContext();
  draw(c, w, h);
  tex.refresh();
}

function shadowOf(scene: Phaser.Scene, src: string, alpha = 0.38) {
  const img = scene.textures.get(src).getSourceImage() as HTMLCanvasElement;
  make(scene, src + '_sh', img.width, img.height, (c) => {
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = `rgba(0,10,20,${alpha})`;
    c.fillRect(0, 0, img.width, img.height);
  });
}

export function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const t = p < 0 ? 0 : 255;
  const f = Math.abs(p);
  r = Math.round((t - r) * f + r);
  g = Math.round((t - g) * f + g);
  b = Math.round((t - b) * f + b);
  return `rgb(${r},${g},${b})`;
}

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

function flipV(c: Ctx, w: number, h: number) {
  c.translate(w / 2, h / 2);
  c.rotate(Math.PI);
  c.translate(-w / 2, -h / 2);
}

function glowCircle(c: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

// ---------------------------------------------------------------- emblems

function emblem(c: Ctx, x: number, y: number, r: number, side: 'ally' | 'enemy', era: Era) {
  c.save();
  if (side === 'ally') {
    c.fillStyle = era === 'future' ? '#0b2a4a' : '#16324f';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = era === 'future' ? '#5ff' : '#f2f2f2';
    c.beginPath();
    c.moveTo(x, y - r * 0.7);
    c.lineTo(x + r * 0.7, y + r * 0.45);
    c.lineTo(x, y + r * 0.1);
    c.lineTo(x - r * 0.7, y + r * 0.45);
    c.closePath();
    c.fill();
  } else {
    c.fillStyle = era === 'future' ? '#ff2a6a' : '#b3121b';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#111';
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      c.lineTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
    }
    c.closePath();
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- aircraft

interface PlaneSpec {
  len: number;
  span: number;
  fuseW: number;
  wingY: number;
  chord: number;
  tipChord: number;
  sweep: number;
  tailSpan: number;
  tailChord: number;
  tailSweep?: number;
  body: string;
  wing: string;
  canopy: string;
  accent?: string;
  engines?: number[];
  noseProp?: boolean;
  jet?: number; // number of exhaust nozzles
  glow?: string;
  twinTail?: boolean;
  side: 'ally' | 'enemy';
  era: Era;
  stripe?: string;
  delta?: boolean;
}

function drawPlane(c: Ctx, w: number, h: number, s: PlaneSpec) {
  const cx = w / 2;
  const y0 = (h - s.len) / 2;
  const ly = y0 + s.len * s.wingY;
  const half = s.span / 2;
  const rw = s.fuseW * 0.45;

  // ---- wings
  const wingPath = (dir: number) => {
    c.beginPath();
    if (s.delta) {
      c.moveTo(cx + dir * rw, ly);
      c.lineTo(cx + dir * half, ly + s.sweep);
      c.lineTo(cx + dir * half, ly + s.sweep + s.tipChord);
      c.lineTo(cx + dir * rw, ly + s.chord);
    } else {
      c.moveTo(cx + dir * rw, ly);
      c.lineTo(cx + dir * (half - 4), ly + s.sweep);
      c.quadraticCurveTo(cx + dir * half, ly + s.sweep + 1, cx + dir * half, ly + s.sweep + s.tipChord * 0.5);
      c.lineTo(cx + dir * (half - 3), ly + s.sweep + s.tipChord);
      c.lineTo(cx + dir * rw, ly + s.chord);
    }
    c.closePath();
  };
  for (const dir of [-1, 1]) {
    const g = c.createLinearGradient(cx, ly, cx + dir * half, ly + s.chord);
    g.addColorStop(0, shade(s.wing, 0.12));
    g.addColorStop(1, shade(s.wing, -0.25));
    c.fillStyle = g;
    wingPath(dir);
    c.fill();
    c.strokeStyle = shade(s.wing, -0.5);
    c.lineWidth = 1;
    c.stroke();
    // panel line
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.moveTo(cx + dir * rw, ly + s.chord * 0.55);
    c.lineTo(cx + dir * (half - 4), ly + s.sweep + s.tipChord * 0.55);
    c.stroke();
    // leading edge highlight
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.moveTo(cx + dir * rw, ly + 1);
    c.lineTo(cx + dir * (half - 4), ly + s.sweep + 1);
    c.stroke();
    if (s.glow) {
      c.save();
      c.shadowColor = s.glow;
      c.shadowBlur = 8;
      c.strokeStyle = s.glow;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx + dir * rw, ly + 1);
      c.lineTo(cx + dir * (half - 2), ly + s.sweep + 1);
      c.stroke();
      c.restore();
    }
    if (s.stripe) {
      c.fillStyle = s.stripe;
      const sx = cx + dir * half * 0.78;
      const yy = ly + s.sweep * 0.78;
      c.fillRect(sx - 3, yy + 1, 6, (s.chord + s.tipChord) * 0.42);
    }
    const ex = cx + dir * half * 0.62;
    emblem(c, ex, ly + s.sweep * 0.62 + (s.chord * 0.38 + s.tipChord * 0.62) * 0.5, Math.max(3, s.chord * 0.24), s.side, s.era);
  }

  // ---- tail plane
  const ty = y0 + s.len * 0.84;
  const ts = s.tailSweep ?? 4;
  c.fillStyle = shade(s.wing, -0.1);
  for (const dir of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + dir * 2, ty);
    c.lineTo(cx + dir * s.tailSpan / 2, ty + ts);
    c.lineTo(cx + dir * s.tailSpan / 2, ty + ts + s.tailChord * 0.55);
    c.lineTo(cx + dir * 2, ty + s.tailChord);
    c.closePath();
    c.fill();
    c.strokeStyle = shade(s.wing, -0.5);
    c.stroke();
  }

  // ---- wing engines
  for (const f of s.engines ?? []) {
    for (const dir of [-1, 1]) {
      const ex = cx + dir * half * f;
      const ey = ly + s.sweep * f;
      const nw = Math.max(6, s.fuseW * 0.55);
      const g = c.createLinearGradient(ex - nw / 2, 0, ex + nw / 2, 0);
      g.addColorStop(0, shade(s.body, -0.4));
      g.addColorStop(0.5, shade(s.body, 0.25));
      g.addColorStop(1, shade(s.body, -0.4));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(ex, ey + s.chord * 0.25, nw / 2, s.chord * 0.75, 0, 0, Math.PI * 2);
      c.fill();
      if (!s.jet) {
        // propeller blur
        c.fillStyle = 'rgba(30,30,30,0.9)';
        c.beginPath();
        c.arc(ex, ey - s.chord * 0.45, nw * 0.22, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(210,220,230,0.28)';
        c.beginPath();
        c.ellipse(ex, ey - s.chord * 0.5, nw * 1.5, 2.2, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        glowCircle(c, ex, ey + s.chord, nw * 0.8, [
          [0, s.glow ?? '#fff6c0'],
          [0.4, s.glow ? s.glow + '88' : 'rgba(255,170,60,0.6)'],
          [1, 'rgba(255,100,0,0)'],
        ]);
      }
    }
  }

  // ---- fuselage
  const fw = s.fuseW / 2;
  const fg = c.createLinearGradient(cx - fw, 0, cx + fw, 0);
  fg.addColorStop(0, shade(s.body, -0.45));
  fg.addColorStop(0.45, shade(s.body, 0.3));
  fg.addColorStop(1, shade(s.body, -0.45));
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(cx, y0);
  c.bezierCurveTo(cx + fw * 0.9, y0 + s.len * 0.05, cx + fw, y0 + s.len * 0.18, cx + fw, y0 + s.len * 0.3);
  c.lineTo(cx + fw * 0.85, y0 + s.len * 0.62);
  c.quadraticCurveTo(cx + fw * 0.4, y0 + s.len * 0.92, cx + 1.5, y0 + s.len);
  c.lineTo(cx - 1.5, y0 + s.len);
  c.quadraticCurveTo(cx - fw * 0.4, y0 + s.len * 0.92, cx - fw * 0.85, y0 + s.len * 0.62);
  c.lineTo(cx - fw, y0 + s.len * 0.3);
  c.bezierCurveTo(cx - fw, y0 + s.len * 0.18, cx - fw * 0.9, y0 + s.len * 0.05, cx, y0);
  c.fill();
  c.strokeStyle = shade(s.body, -0.6);
  c.lineWidth = 1;
  c.stroke();

  if (s.accent) {
    c.fillStyle = s.accent;
    c.fillRect(cx - fw * 0.8, y0 + s.len * 0.68, fw * 1.6, 3);
    c.beginPath();
    c.arc(cx, y0 + s.len * 0.06, Math.max(2, fw * 0.5), 0, Math.PI * 2);
    c.fill();
  }

  // twin tails (modern jets)
  if (s.twinTail) {
    c.fillStyle = shade(s.body, -0.25);
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + dir * fw * 0.7, y0 + s.len * 0.7);
      c.lineTo(cx + dir * fw * 1.6, y0 + s.len * 0.92);
      c.lineTo(cx + dir * fw * 1.5, y0 + s.len * 0.98);
      c.lineTo(cx + dir * fw * 0.6, y0 + s.len * 0.9);
      c.closePath();
      c.fill();
    }
  } else if (!s.delta) {
    c.fillStyle = shade(s.body, -0.3);
    c.fillRect(cx - 1.5, y0 + s.len * 0.78, 3, s.len * 0.2);
  }

  // ---- canopy
  const cy = y0 + s.len * (s.jet ? 0.22 : 0.36);
  const cg = c.createLinearGradient(cx - fw, cy - 6, cx + fw, cy + 6);
  cg.addColorStop(0, shade(s.canopy, 0.6));
  cg.addColorStop(0.5, s.canopy);
  cg.addColorStop(1, shade(s.canopy, -0.5));
  c.fillStyle = cg;
  c.beginPath();
  c.ellipse(cx, cy, fw * 0.55, s.len * 0.09, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath();
  c.ellipse(cx - fw * 0.2, cy - s.len * 0.03, fw * 0.15, s.len * 0.03, 0, 0, Math.PI * 2);
  c.fill();

  // ---- nose propeller
  if (s.noseProp) {
    c.fillStyle = s.accent ?? '#333';
    c.beginPath();
    c.arc(cx, y0 + 2, fw * 0.45, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(220,225,235,0.32)';
    c.beginPath();
    c.ellipse(cx, y0, s.span * 0.2, 2.5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(cx, y0, s.span * 0.2, 2.5, 0, 0, Math.PI * 2);
    c.stroke();
  }

  // ---- jet exhaust
  if (s.jet) {
    const n = s.jet;
    for (let i = 0; i < n; i++) {
      const ex = cx + (n === 1 ? 0 : (i - (n - 1) / 2) * fw * 0.9);
      glowCircle(c, ex, y0 + s.len - 1, fw * 0.9, [
        [0, '#ffffff'],
        [0.3, s.glow ?? '#ffd27a'],
        [1, 'rgba(255,120,0,0)'],
      ]);
    }
  }
}

function planeTex(scene: Phaser.Scene, key: string, w: number, h: number, spec: PlaneSpec, down = false) {
  make(scene, key, w, h, (c) => {
    if (down) flipV(c, w, h);
    drawPlane(c, w, h, spec);
  });
  shadowOf(scene, key);
}

// ---------------------------------------------------------------- ships

interface ShipSpec {
  hull: string;
  deck: string;
  sup: string;
  era: Era;
  mounts?: number[];
  glow?: string;
  stacks?: number;
}

function shipPath(c: Ctx, w: number, h: number, inset = 0) {
  const cx = w / 2;
  const hw = w / 2 - 2 - inset;
  c.beginPath();
  c.moveTo(cx, 2 + inset * 2);
  c.bezierCurveTo(cx + hw * 0.7, h * 0.12, cx + hw, h * 0.25, cx + hw, h * 0.4);
  c.lineTo(cx + hw, h * 0.86);
  c.quadraticCurveTo(cx + hw, h - 2 - inset, cx, h - 2 - inset);
  c.quadraticCurveTo(cx - hw, h - 2 - inset, cx - hw, h * 0.86);
  c.lineTo(cx - hw, h * 0.4);
  c.bezierCurveTo(cx - hw, h * 0.25, cx - hw * 0.7, h * 0.12, cx, 2 + inset * 2);
  c.closePath();
}

function drawShip(c: Ctx, w: number, h: number, s: ShipSpec) {
  const cx = w / 2;
  // hull
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, shade(s.hull, -0.45));
  g.addColorStop(0.5, shade(s.hull, 0.15));
  g.addColorStop(1, shade(s.hull, -0.45));
  c.fillStyle = g;
  shipPath(c, w, h);
  c.fill();
  c.strokeStyle = shade(s.hull, -0.6);
  c.lineWidth = 1.5;
  c.stroke();
  // deck
  c.fillStyle = s.deck;
  shipPath(c, w, h, Math.max(3, w * 0.09));
  c.fill();
  c.save();
  shipPath(c, w, h, Math.max(3, w * 0.09));
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.12)';
  c.lineWidth = 1;
  for (let x = 0; x < w; x += 4) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  c.restore();
  // superstructure
  const sw = w * 0.42;
  const sy = h * 0.42;
  const sh = h * 0.2;
  const sg = c.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
  sg.addColorStop(0, shade(s.sup, -0.35));
  sg.addColorStop(0.5, shade(s.sup, 0.2));
  sg.addColorStop(1, shade(s.sup, -0.35));
  c.fillStyle = sg;
  c.fillRect(cx - sw / 2, sy, sw, sh);
  c.fillStyle = shade(s.sup, 0.3);
  c.fillRect(cx - sw * 0.3, sy + sh * 0.1, sw * 0.6, sh * 0.35);
  for (let i = 0; i < (s.stacks ?? 1); i++) {
    c.fillStyle = '#222';
    c.beginPath();
    c.ellipse(cx, sy + sh * (0.6 + i * 0.25), sw * 0.18, sh * 0.1, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (s.glow) {
    c.save();
    c.shadowColor = s.glow;
    c.shadowBlur = 10;
    c.strokeStyle = s.glow;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(cx - w * 0.32, h * 0.3);
    c.lineTo(cx - w * 0.32, h * 0.85);
    c.moveTo(cx + w * 0.32, h * 0.3);
    c.lineTo(cx + w * 0.32, h * 0.85);
    c.stroke();
    c.restore();
  }
  // turret mounts
  for (const m of s.mounts ?? []) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.arc(cx, h * m, w * 0.2, 0, Math.PI * 2);
    c.fill();
  }
}

function turretTex(scene: Phaser.Scene, key: string, size: number, barrels: number, era: Era, big = false) {
  make(scene, key, size, size * 1.5, (c, w, h) => {
    const cx = w / 2;
    const cy = h * 0.62;
    const r = size * 0.36;
    const col = era === 'ww2' ? '#5f6658' : era === 'modern' ? '#6c737c' : '#2a2e3a';
    // barrels (pointing up)
    c.fillStyle = era === 'future' ? '#444a5a' : '#2b2b2b';
    for (let i = 0; i < barrels; i++) {
      const bx = cx + (i - (barrels - 1) / 2) * (big ? 6 : 4.5);
      c.fillRect(bx - (big ? 2 : 1.5), 2, big ? 4 : 3, cy - 2);
    }
    if (era === 'future') {
      glowCircle(c, cx, 4, 5, [
        [0, '#fff'],
        [0.5, '#ff3ad8'],
        [1, 'rgba(255,0,200,0)'],
      ]);
    }
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
    g.addColorStop(0, shade(col, 0.4));
    g.addColorStop(1, shade(col, -0.4));
    c.fillStyle = g;
    c.beginPath();
    if (era === 'modern') {
      c.rect(cx - r, cy - r * 0.9, r * 2, r * 1.9);
    } else {
      c.arc(cx, cy, r, 0, Math.PI * 2);
    }
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.stroke();
    if (era === 'future') {
      glowCircle(c, cx, cy, r * 0.5, [
        [0, '#ffd0ff'],
        [0.6, '#c020ff'],
        [1, 'rgba(120,0,255,0)'],
      ]);
    } else {
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(cx - r * 0.4, cy - r * 0.2, r * 0.8, r * 0.5);
    }
  });
}

// ---------------------------------------------------------------- carrier

function drawCarrier(c: Ctx, w: number, h: number, era: Era) {
  const cx = w / 2;
  const hull = era === 'ww2' ? '#5d6670' : era === 'modern' ? '#6b7178' : '#2c3342';
  // hull
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, shade(hull, -0.5));
  g.addColorStop(0.5, shade(hull, 0.1));
  g.addColorStop(1, shade(hull, -0.5));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(cx, 0);
  c.bezierCurveTo(cx + w * 0.36, h * 0.06, cx + w * 0.4, h * 0.14, cx + w * 0.4, h * 0.26);
  c.lineTo(cx + w * 0.4, h * 0.95);
  c.quadraticCurveTo(cx + w * 0.38, h, cx, h);
  c.quadraticCurveTo(cx - w * 0.38, h, cx - w * 0.4, h * 0.95);
  c.lineTo(cx - w * 0.4, h * 0.26);
  c.bezierCurveTo(cx - w * 0.4, h * 0.14, cx - w * 0.36, h * 0.06, cx, 0);
  c.fill();
  // flight deck
  const deck = era === 'ww2' ? '#8b7352' : era === 'modern' ? '#3c4046' : '#1a1f2c';
  const dl = cx - w * 0.44;
  const dr = cx + w * 0.44;
  c.fillStyle = deck;
  c.beginPath();
  c.moveTo(cx - w * 0.3, h * 0.04);
  c.lineTo(cx + w * 0.3, h * 0.04);
  c.lineTo(dr, h * 0.12);
  c.lineTo(dr, h * 0.97);
  c.lineTo(dl, h * 0.97);
  c.lineTo(dl, h * 0.12);
  c.closePath();
  c.fill();
  if (era === 'modern') {
    // angled deck extension
    c.beginPath();
    c.moveTo(dl, h * 0.45);
    c.lineTo(dl - w * 0.06, h * 0.5);
    c.lineTo(dl - w * 0.06, h * 0.97);
    c.lineTo(dl, h * 0.97);
    c.fill();
  }
  c.save();
  c.beginPath();
  c.rect(dl, h * 0.04, dr - dl, h * 0.93);
  c.clip();
  if (era === 'ww2') {
    c.strokeStyle = 'rgba(40,25,10,0.25)';
    c.lineWidth = 1;
    for (let x = dl; x < dr; x += 3) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < h; y += 24) c.fillRect(dl, y, dr - dl, 12);
  }
  c.restore();
  // edge lines
  c.strokeStyle = era === 'future' ? '#36e0ff' : '#e8e8e8';
  c.lineWidth = 2;
  c.setLineDash([]);
  c.strokeRect(dl + 4, h * 0.08, dr - dl - 8, h * 0.88);
  // centreline
  const rx = cx - 8;
  c.strokeStyle = era === 'ww2' ? '#f0f0f0' : era === 'modern' ? '#ffd23a' : '#36e0ff';
  c.lineWidth = 3;
  c.setLineDash([18, 14]);
  c.beginPath();
  c.moveTo(rx, h * 0.07);
  c.lineTo(rx, h * 0.96);
  c.stroke();
  c.setLineDash([]);
  if (era === 'future') {
    for (let y = h * 0.1; y < h * 0.95; y += 26) {
      glowCircle(c, rx - 30, y, 4, [[0, '#bff'], [1, 'rgba(0,200,255,0)']]);
      glowCircle(c, rx + 30, y, 4, [[0, '#bff'], [1, 'rgba(0,200,255,0)']]);
    }
  }
  // arresting wires
  c.strokeStyle = 'rgba(30,30,30,0.9)';
  c.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const y = h * 0.78 + i * 12;
    c.beginPath();
    c.moveTo(rx - 34, y);
    c.lineTo(rx + 34, y);
    c.stroke();
  }
  // elevators
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.fillRect(rx - 26, h * 0.3, 52, 46);
  c.fillRect(rx - 26, h * 0.6, 52, 46);
  // deck number
  c.fillStyle = era === 'future' ? '#36e0ff' : '#f2f2f2';
  c.font = 'bold 34px "Black Ops One", sans-serif';
  c.textAlign = 'center';
  c.fillText(era === 'ww2' ? '07' : era === 'modern' ? '77' : 'X1', rx, h * 0.93);
  // island (starboard)
  const ix = dr - 22;
  const iy = h * 0.42;
  const ig = c.createLinearGradient(ix - 14, 0, ix + 14, 0);
  ig.addColorStop(0, shade(hull, -0.2));
  ig.addColorStop(1, shade(hull, 0.35));
  c.fillStyle = ig;
  c.fillRect(ix - 13, iy, 26, h * 0.16);
  c.fillStyle = shade(hull, 0.45);
  c.fillRect(ix - 8, iy + 10, 16, h * 0.06);
  c.fillStyle = '#222';
  c.beginPath();
  c.ellipse(ix, iy + h * 0.12, 7, 11, 0, 0, Math.PI * 2);
  c.fill();
  if (era !== 'ww2') {
    c.strokeStyle = '#aaa';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(ix, iy + 6, 9, 0, Math.PI * 2);
    c.stroke();
  }
  // parked aircraft silhouettes near bow
  c.fillStyle = 'rgba(40,50,60,0.75)';
  for (let i = 0; i < 4; i++) {
    const px = dl + 18 + (i % 2) * 22;
    const py = h * 0.12 + Math.floor(i / 2) * 36;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + 12, py + 12);
    c.lineTo(px + 2, py + 12);
    c.lineTo(px + 2, py + 26);
    c.lineTo(px - 2, py + 26);
    c.lineTo(px - 2, py + 12);
    c.lineTo(px - 12, py + 12);
    c.closePath();
    c.fill();
  }
}

// ---------------------------------------------------------------- bosses

function drawFortress(c: Ctx, w: number, h: number, era: Era) {
  const cx = w / 2;
  const cy = h / 2;
  const col = era === 'ww2' ? '#5b5a48' : era === 'modern' ? '#55606b' : '#232838';
  const r = Math.min(w, h) * 0.34;
  // arms to pods
  c.strokeStyle = shade(col, -0.3);
  c.lineWidth = 18;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + dx * w * 0.36, cy + dy * h * 0.32);
    c.stroke();
  }
  // octagon hull
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, shade(col, 0.35));
  g.addColorStop(1, shade(col, -0.45));
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = shade(col, -0.6);
  c.lineWidth = 2;
  c.stroke();
  // armour plates & rivets
  c.strokeStyle = 'rgba(0,0,0,0.3)';
  c.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    c.beginPath();
    c.arc(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, 1.5, 0, Math.PI * 2);
    c.fill();
  }
  // inner ring + core
  c.fillStyle = shade(col, -0.3);
  c.beginPath();
  c.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  c.fill();
  const coreCol = era === 'future' ? '#c43cff' : era === 'modern' ? '#ff3a3a' : '#ff8a2a';
  glowCircle(c, cx, cy, r * 0.42, [
    [0, '#ffffff'],
    [0.25, coreCol],
    [0.8, shade(coreCol, -0.6)],
    [1, 'rgba(0,0,0,0)'],
  ]);
  emblem(c, cx, cy + r * 0.72, 10, 'enemy', era);
}

function podTex(scene: Phaser.Scene, key: string, era: Era) {
  make(scene, key, 96, 96, (c, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const col = era === 'ww2' ? '#6a6a52' : era === 'modern' ? '#5d6873' : '#2d3346';
    if (era === 'future') {
      c.save();
      c.shadowColor = '#40e0ff';
      c.shadowBlur = 12;
      c.strokeStyle = '#7ff';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, cy, 40, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    } else {
      c.fillStyle = 'rgba(210,220,230,0.18)';
      c.beginPath();
      c.arc(cx, cy, 44, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.stroke();
    }
    const g = c.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 22);
    g.addColorStop(0, shade(col, 0.4));
    g.addColorStop(1, shade(col, -0.5));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath();
    c.arc(cx, cy, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2b2b2b';
    c.fillRect(cx - 2, cy + 6, 4, 22);
  });
}

// ---------------------------------------------------------------- per era

export function buildEraTextures(scene: Phaser.Scene, era: Era) {
  const ww2 = era === 'ww2';
  const fut = era === 'future';
  const sfx = (n: string) => `${n}_${era}`;

  // --- player
  const playerSpec: PlaneSpec = ww2
    ? { len: 54, span: 66, fuseW: 11, wingY: 0.34, chord: 15, tipChord: 9, sweep: 3, tailSpan: 24, tailChord: 8, body: '#9fb3c6', wing: '#a9bccd', canopy: '#2e6a9a', accent: '#ffcc33', noseProp: true, side: 'ally', era, stripe: '#e8e8e8' }
    : era === 'modern'
      ? { len: 64, span: 52, fuseW: 12, wingY: 0.4, chord: 26, tipChord: 7, sweep: 20, tailSpan: 30, tailChord: 10, tailSweep: 8, body: '#8a98a8', wing: '#8f9dad', canopy: '#e0b040', jet: 2, twinTail: true, side: 'ally', era }
      : { len: 66, span: 56, fuseW: 13, wingY: 0.3, chord: 34, tipChord: 10, sweep: 26, tailSpan: 0, tailChord: 0, body: '#d8e2f0', wing: '#c0ccdf', canopy: '#2ef0ff', jet: 2, glow: '#38e8ff', delta: true, side: 'ally', era };
  planeTex(scene, sfx('player'), 76, 76, playerSpec);

  // --- enemies
  const eBody = ww2 ? '#5b6e4c' : era === 'modern' ? '#6e6a62' : '#3a3046';
  const eWing = ww2 ? '#647a52' : era === 'modern' ? '#77726a' : '#4a3d5a';
  const eGlow = fut ? '#ff3a9a' : undefined;
  const small = (body: string, wing: string, accent?: string): PlaneSpec =>
    ww2
      ? { len: 40, span: 48, fuseW: 9, wingY: 0.33, chord: 12, tipChord: 7, sweep: 2, tailSpan: 18, tailChord: 6, body, wing, canopy: '#6aa0b0', accent, noseProp: true, side: 'enemy', era }
      : era === 'modern'
        ? { len: 46, span: 38, fuseW: 9, wingY: 0.42, chord: 18, tipChord: 5, sweep: 14, tailSpan: 20, tailChord: 7, tailSweep: 6, body, wing, canopy: '#d0a040', accent, jet: 1, side: 'enemy', era }
        : { len: 46, span: 46, fuseW: 10, wingY: 0.28, chord: 26, tipChord: 6, sweep: 22, tailSpan: 0, tailChord: 0, body, wing, canopy: '#ff70c0', accent, jet: 1, glow: eGlow, delta: true, side: 'enemy', era };
  planeTex(scene, sfx('en_fighter'), 56, 56, small(eBody, eWing), true);
  planeTex(scene, sfx('en_red'), 56, 56, small('#b8322a', '#c43a30', '#ffd040'), true);
  planeTex(scene, sfx('en_ace'), 60, 60, { ...small('#222222', '#2c2c2c', '#e02020'), len: 46, span: 54, stripe: '#e02020' }, true);
  planeTex(
    scene,
    sfx('en_heavy'),
    96,
    80,
    ww2
      ? { len: 62, span: 88, fuseW: 12, wingY: 0.32, chord: 16, tipChord: 9, sweep: 2, tailSpan: 30, tailChord: 9, body: eBody, wing: eWing, canopy: '#6aa0b0', engines: [0.38], side: 'enemy', era }
      : era === 'modern'
        ? { len: 70, span: 64, fuseW: 14, wingY: 0.38, chord: 30, tipChord: 9, sweep: 22, tailSpan: 34, tailChord: 10, tailSweep: 8, body: eBody, wing: eWing, canopy: '#d0a040', jet: 2, twinTail: true, side: 'enemy', era }
        : { len: 70, span: 84, fuseW: 16, wingY: 0.3, chord: 36, tipChord: 12, sweep: 30, tailSpan: 0, tailChord: 0, body: eBody, wing: eWing, canopy: '#ff70c0', engines: [0.5], jet: 2, glow: eGlow, delta: true, side: 'enemy', era },
    true,
  );
  planeTex(
    scene,
    sfx('en_bomber'),
    150,
    110,
    ww2
      ? { len: 92, span: 140, fuseW: 16, wingY: 0.32, chord: 22, tipChord: 12, sweep: 3, tailSpan: 46, tailChord: 12, body: eBody, wing: eWing, canopy: '#6aa0b0', engines: [0.3, 0.58], side: 'enemy', era }
      : era === 'modern'
        ? { len: 100, span: 130, fuseW: 16, wingY: 0.36, chord: 30, tipChord: 10, sweep: 30, tailSpan: 40, tailChord: 12, tailSweep: 10, body: eBody, wing: eWing, canopy: '#d0a040', engines: [0.35, 0.6], jet: 1, side: 'enemy', era }
        : { len: 96, span: 140, fuseW: 22, wingY: 0.25, chord: 50, tipChord: 14, sweep: 44, tailSpan: 0, tailChord: 0, body: eBody, wing: eWing, canopy: '#ff70c0', engines: [0.4], jet: 3, glow: eGlow, delta: true, side: 'enemy', era },
    true,
  );

  // friendly transport / support bomber (flies upward)
  planeTex(
    scene,
    sfx('transport'),
    130,
    100,
    ww2
      ? { len: 80, span: 120, fuseW: 15, wingY: 0.32, chord: 20, tipChord: 11, sweep: 2, tailSpan: 40, tailChord: 11, body: '#8ea0b2', wing: '#9aacbe', canopy: '#2e6a9a', engines: [0.3, 0.58], side: 'ally', era, accent: '#ffcc33' }
      : era === 'modern'
        ? { len: 88, span: 110, fuseW: 15, wingY: 0.36, chord: 26, tipChord: 9, sweep: 24, tailSpan: 36, tailChord: 11, tailSweep: 8, body: '#7f8c99', wing: '#87949f', canopy: '#e0b040', engines: [0.38, 0.62], jet: 1, side: 'ally', era }
        : { len: 90, span: 120, fuseW: 20, wingY: 0.26, chord: 46, tipChord: 12, sweep: 38, tailSpan: 0, tailChord: 0, body: '#cdd8e8', wing: '#b6c3d8', canopy: '#2ef0ff', engines: [0.45], jet: 2, glow: '#38e8ff', delta: true, side: 'ally', era },
  );

  // --- ships
  const shipHull = ww2 ? '#59606a' : era === 'modern' ? '#6d747c' : '#262b3a';
  const shipDeck = ww2 ? '#7d6a50' : era === 'modern' ? '#4a5058' : '#1b2030';
  make(scene, sfx('en_gunboat'), 40, 96, (c, w, h) => {
    flipV(c, w, h);
    drawShip(c, w, h, { hull: shipHull, deck: shipDeck, sup: shade(shipHull, 0.2), era, glow: fut ? '#ff3a9a' : undefined });
  });
  make(scene, sfx('en_destroyer'), 58, 176, (c, w, h) => {
    flipV(c, w, h);
    drawShip(c, w, h, { hull: shipHull, deck: shipDeck, sup: shade(shipHull, 0.25), era, mounts: [0.22, 0.78], stacks: 2, glow: fut ? '#ff3a9a' : undefined });
  });
  turretTex(scene, sfx('turret'), 26, ww2 ? 2 : era === 'modern' ? 1 : 1, era);
  turretTex(scene, sfx('turret_big'), 40, 3, era, true);

  // --- carrier (bow up)
  make(scene, sfx('carrier'), 200, 680, (c, w, h) => drawCarrier(c, w, h, era));

  // --- bosses
  const bb = ww2
    ? { len: 170, span: 360, fuseW: 30, wingY: 0.3, chord: 46, tipChord: 22, sweep: 6, tailSpan: 110, tailChord: 26, body: '#4d5c40', wing: '#55663f', canopy: '#6aa0b0', engines: [0.18, 0.4, 0.62], side: 'enemy' as const, era }
    : era === 'modern'
      ? { len: 150, span: 360, fuseW: 40, wingY: 0.05, chord: 120, tipChord: 22, sweep: 110, tailSpan: 0, tailChord: 0, body: '#2a2d33', wing: '#30343b', canopy: '#d0a040', jet: 4, delta: true, side: 'enemy' as const, era }
      : { len: 170, span: 370, fuseW: 60, wingY: 0.15, chord: 110, tipChord: 40, sweep: 70, tailSpan: 0, tailChord: 0, body: '#3a2850', wing: '#45305e', canopy: '#ff70c0', engines: [0.3, 0.6], jet: 3, glow: '#ff3a9a', delta: true, side: 'enemy' as const, era };
  planeTex(scene, sfx('boss_bomber'), 380, 220, bb, true);
  make(scene, sfx('boss_ship'), 170, 480, (c, w, h) => {
    flipV(c, w, h);
    drawShip(c, w, h, { hull: shipHull, deck: shipDeck, sup: shade(shipHull, 0.25), era, mounts: [0.16, 0.28, 0.72, 0.84], stacks: 2, glow: fut ? '#c43cff' : undefined });
  });
  make(scene, sfx('boss_fortress'), 360, 320, (c, w, h) => drawFortress(c, w, h, era));
  shadowOf(scene, sfx('boss_fortress'));
  podTex(scene, sfx('pod'), era);
  shadowOf(scene, sfx('pod'));

  // --- player projectiles
  const main = ww2 ? '#ffe070' : era === 'modern' ? '#fff3c0' : '#ff5ae0';
  make(scene, sfx('pb_main'), 10, 26, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, main);
    g.addColorStop(1, 'rgba(255,120,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
    c.fill();
  });
  const pierce = ww2 ? '#ff9a3a' : era === 'modern' ? '#6ad0ff' : '#30fff0';
  make(scene, sfx('pb_pierce'), 16, 56, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.3, pierce);
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.7, pierce);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    c.fill();
  });
  make(scene, sfx('pb_homing'), 12, 28, (c, w, h) => {
    if (fut) {
      glowCircle(c, w / 2, h * 0.35, w / 2, [
        [0, '#ffffff'],
        [0.4, '#7dff6a'],
        [1, 'rgba(0,255,0,0)'],
      ]);
      return;
    }
    c.fillStyle = ww2 ? '#8a8a7a' : '#e6e6e6';
    c.fillRect(w / 2 - 2.5, 2, 5, h * 0.62);
    c.fillStyle = '#c03020';
    c.beginPath();
    c.arc(w / 2, 4, 2.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#555';
    c.fillRect(w / 2 - 5, h * 0.5, 10, 3);
    glowCircle(c, w / 2, h * 0.78, 6, [
      [0, '#ffffff'],
      [0.4, '#ffb030'],
      [1, 'rgba(255,60,0,0)'],
    ]);
  });
  make(scene, sfx('pb_wing'), 6, 16, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, fut ? 'rgba(80,240,255,0)' : 'rgba(255,220,100,0)');
    c.fillStyle = g;
    c.fillRect(1, 0, w - 2, h);
  });
}

// ---------------------------------------------------------------- shared

export function buildSharedTextures(scene: Phaser.Scene) {
  // enemy bullets
  const orb = (key: string, size: number, col: string, core = '#ffffff') =>
    make(scene, key, size, size, (c, w) => {
      glowCircle(c, w / 2, w / 2, w / 2, [
        [0, core],
        [0.35, core],
        [0.5, col],
        [0.8, col + '80'],
        [1, col + '00'],
      ]);
    });
  orb('eb_orb', 18, '#ff3a6a');
  orb('eb_big', 30, '#ff8a1a', '#fff4c0');
  orb('eb_blue', 18, '#3aa0ff');
  make(scene, 'eb_needle', 10, 24, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(180,60,255,0)');
    g.addColorStop(0.35, '#c050ff');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.65, '#c050ff');
    g.addColorStop(1, 'rgba(180,60,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    c.fill();
  });

  // fx
  make(scene, 'spark', 16, 16, (c, w) =>
    glowCircle(c, w / 2, w / 2, w / 2, [
      [0, '#ffffff'],
      [0.3, 'rgba(255,255,255,0.9)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  make(scene, 'smoke', 48, 48, (c, w) => {
    const r = rng(7);
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (r() - 0.5) * 18;
      const y = w / 2 + (r() - 0.5) * 18;
      glowCircle(c, x, y, 12 + r() * 10, [
        [0, 'rgba(255,255,255,0.45)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
    }
  });
  make(scene, 'flash', 128, 128, (c, w) =>
    glowCircle(c, w / 2, w / 2, w / 2, [
      [0, 'rgba(255,255,255,1)'],
      [0.2, 'rgba(255,240,200,0.9)'],
      [0.5, 'rgba(255,170,60,0.4)'],
      [1, 'rgba(255,80,0,0)'],
    ]),
  );
  make(scene, 'ring', 128, 128, (c, w) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 6;
    c.shadowColor = '#fff';
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(w / 2, w / 2, w / 2 - 10, 0, Math.PI * 2);
    c.stroke();
  });
  make(scene, 'debris', 8, 6, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 8, 2);
    c.fillRect(2, 2, 4, 4);
  });
  make(scene, 'rain', 3, 30, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(200,220,255,0)');
    g.addColorStop(1, 'rgba(220,235,255,0.8)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  make(scene, 'flake', 8, 8, (c, w) =>
    glowCircle(c, w / 2, w / 2, w / 2, [
      [0, 'rgba(255,255,255,1)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  make(scene, 'shield', 96, 96, (c, w) => {
    glowCircle(c, w / 2, w / 2, w / 2, [
      [0, 'rgba(80,180,255,0)'],
      [0.7, 'rgba(80,180,255,0.15)'],
      [0.92, 'rgba(140,220,255,0.7)'],
      [1, 'rgba(140,220,255,0)'],
    ]);
  });
  make(scene, 'aura', 128, 128, (c, w) =>
    glowCircle(c, w / 2, w / 2, w / 2, [
      [0, 'rgba(255,220,80,0.5)'],
      [0.6, 'rgba(255,160,30,0.2)'],
      [1, 'rgba(255,120,0,0)'],
    ]),
  );
  make(scene, 'px', 4, 4, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 4, 4);
  });

  // items
  const item = (key: string, label: string, col: string, round = false) =>
    make(scene, key, 44, 44, (c, w) => {
      glowCircle(c, w / 2, w / 2, w / 2, [
        [0.5, col + 'aa'],
        [1, col + '00'],
      ]);
      const g = c.createLinearGradient(0, 8, 0, 36);
      g.addColorStop(0, shade(col, 0.5));
      g.addColorStop(0.5, col);
      g.addColorStop(1, shade(col, -0.45));
      c.fillStyle = g;
      c.beginPath();
      if (round) c.arc(w / 2, w / 2, 14, 0, Math.PI * 2);
      else c.roundRect(8, 10, 28, 24, 7);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = `${label.length > 1 ? 11 : 18}px "Black Ops One", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,0.7)';
      c.shadowBlur = 3;
      c.fillText(label, w / 2, w / 2 + 1);
    });
  item('item_P', 'P', '#e8322a');
  item('item_V', 'V', '#f0a020');
  item('item_L', 'L', '#20b8e8');
  item('item_M', 'M', '#38c040');
  item('item_B', 'B', '#9040e0', true);
  item('item_S', 'S', '#3070ff', true);
  item('item_E', 'E', '#a0a8b8', true);
  item('item_R', '+', '#20c080', true);
  item('item_1UP', '1UP', '#ff40a0', true);
  make(scene, 'item_medal', 32, 32, (c, w) => {
    glowCircle(c, w / 2, w / 2, w / 2, [
      [0.5, 'rgba(255,210,60,0.6)'],
      [1, 'rgba(255,210,60,0)'],
    ]);
    c.fillStyle = '#ffcf30';
    c.strokeStyle = '#8a5a00';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 5 : 11;
      c.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
  });

  // clouds
  for (let k = 0; k < 4; k++) {
    make(scene, `cloud_${k}`, 260, 170, (c, w, h) => {
      const r = rng(100 + k * 17);
      for (let i = 0; i < 26; i++) {
        const x = w * 0.2 + r() * w * 0.6;
        const y = h * 0.25 + r() * h * 0.5;
        const rad = 22 + r() * 36;
        glowCircle(c, x, y, rad, [
          [0, 'rgba(255,255,255,0.55)'],
          [0.6, 'rgba(245,248,255,0.3)'],
          [1, 'rgba(240,245,255,0)'],
        ]);
      }
    });
  }

  // islands
  const styles: IslandStyle[] = ['green', 'ice', 'volc'];
  for (const st of styles) for (let k = 0; k < 3; k++) islandTex(scene, `island_${st}_${k}`, st, 31 * k + st.length);
}

function islandTex(scene: Phaser.Scene, key: string, style: IslandStyle, seed: number) {
  const r = rng(seed * 977);
  const w = 200 + Math.floor(r() * 80);
  const h = 160 + Math.floor(r() * 80);
  make(scene, key, w, h, (c) => {
    const cx = w / 2;
    const cy = h / 2;
    const n = 22;
    const radii: number[] = [];
    for (let i = 0; i < n; i++) radii.push(0.62 + r() * 0.3);
    // smooth
    const sm = radii.map((v, i) => (v + radii[(i + 1) % n] + radii[(i + n - 1) % n]) / 3);
    const blob = (scale: number) => {
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = sm[i % n] * scale;
        const x = cx + Math.cos(a) * rr * (w / 2);
        const y = cy + Math.sin(a) * rr * (h / 2);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
    };
    if (style === 'green') {
      c.fillStyle = 'rgba(120,230,220,0.28)';
      blob(1.08);
      c.fill();
      c.fillStyle = '#e8d6a0';
      blob(0.9);
      c.fill();
      const g = c.createRadialGradient(cx - 10, cy - 10, 5, cx, cy, w * 0.4);
      g.addColorStop(0, '#5c9a3a');
      g.addColorStop(1, '#2f6a28');
      c.fillStyle = g;
      blob(0.78);
      c.fill();
      for (let i = 0; i < 30; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * 0.5;
        glowCircle(c, cx + Math.cos(a) * d * w * 0.45, cy + Math.sin(a) * d * h * 0.45, 6 + r() * 10, [
          [0, 'rgba(30,70,20,0.6)'],
          [1, 'rgba(30,70,20,0)'],
        ]);
      }
    } else if (style === 'ice') {
      c.fillStyle = 'rgba(200,240,255,0.25)';
      blob(1.06);
      c.fill();
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#a8d4ee');
      c.fillStyle = g;
      blob(0.88);
      c.fill();
      c.strokeStyle = 'rgba(100,160,200,0.6)';
      c.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(cx + (r() - 0.5) * w * 0.6, cy + (r() - 0.5) * h * 0.6);
        c.lineTo(cx + (r() - 0.5) * w * 0.6, cy + (r() - 0.5) * h * 0.6);
        c.stroke();
      }
    } else {
      c.fillStyle = 'rgba(255,90,30,0.12)';
      blob(1.1);
      c.fill();
      const g = c.createRadialGradient(cx, cy, 5, cx, cy, w * 0.45);
      g.addColorStop(0, '#5a4038');
      g.addColorStop(1, '#241815');
      c.fillStyle = g;
      blob(0.86);
      c.fill();
      glowCircle(c, cx, cy, Math.min(w, h) * 0.18, [
        [0, '#fff0a0'],
        [0.3, '#ff6a20'],
        [1, 'rgba(255,40,0,0)'],
      ]);
      c.strokeStyle = 'rgba(255,90,30,0.7)';
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(cx, cy);
        const a = r() * Math.PI * 2;
        c.quadraticCurveTo(cx + Math.cos(a + 0.4) * w * 0.15, cy + Math.sin(a + 0.4) * h * 0.15, cx + Math.cos(a) * w * 0.32, cy + Math.sin(a) * h * 0.32);
        c.stroke();
      }
    }
  });
}

/** Seamless tileable ocean texture coloured for a theme. */
export function buildWaterTexture(scene: Phaser.Scene, key: string, theme: Theme) {
  if (scene.textures.exists(key)) return;
  const S = 256;
  make(scene, key, S, S, (c) => {
    const [deep, mid, hi] = theme.water;
    c.fillStyle = deep;
    c.fillRect(0, 0, S, S);
    const r = rng(key.length * 131 + 7);
    const wrap = (fn: (ox: number, oy: number) => void) => {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
    };
    for (let i = 0; i < 26; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 30 + r() * 60;
      wrap((ox, oy) =>
        glowCircle(c, x + ox, y + oy, rad, [
          [0, mid + 'aa'],
          [1, mid + '00'],
        ]),
      );
    }
    c.strokeStyle = hi;
    c.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r() * S;
      const y = r() * S;
      const len = 6 + r() * 16;
      const a = 0.08 + r() * 0.25;
      c.globalAlpha = a;
      c.lineWidth = 1 + r() * 1.5;
      wrap((ox, oy) => {
        c.beginPath();
        c.moveTo(x + ox - len / 2, y + oy);
        c.quadraticCurveTo(x + ox, y + oy - 3, x + ox + len / 2, y + oy);
        c.stroke();
      });
    }
    c.globalAlpha = 1;
  });
}
