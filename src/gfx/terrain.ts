import Phaser from 'phaser';
import type { Era } from '../data/config';
import { make, glowCircle, rng, shade } from './textures';

/** Land terrain: tileable ground textures, coastline edges, tanks, flak sites, craters. */

export type LandKind = 'jungle' | 'desert' | 'snow' | 'lava' | 'city' | 'waste' | 'mountain';
export const LAND_KINDS: LandKind[] = ['jungle', 'desert', 'snow', 'lava', 'city', 'waste', 'mountain'];

type Ctx = CanvasRenderingContext2D;
const S = 256;

function wrap(fn: (ox: number, oy: number) => void) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
}

const PAL: Record<LandKind, { base: string; dark: string; light: string; beach: string; foam: string }> = {
  jungle: { base: '#2f5a26', dark: '#1d3d18', light: '#4f8a38', beach: '#e2d09a', foam: '#ffffff' },
  desert: { base: '#c9a868', dark: '#a2824a', light: '#e2c88c', beach: '#ead7a4', foam: '#ffffff' },
  snow: { base: '#dfeaf2', dark: '#a9c2d4', light: '#ffffff', beach: '#cfe6f4', foam: '#ffffff' },
  lava: { base: '#2a2220', dark: '#151110', light: '#4a3a34', beach: '#1a1614', foam: '#ffd0a0' },
  city: { base: '#4a4c50', dark: '#2e3034', light: '#6a6c70', beach: '#8a8a86', foam: '#ffffff' },
  waste: { base: '#6a5640', dark: '#4a3a2a', light: '#8a7458', beach: '#9a8664', foam: '#e8e0d0' },
  mountain: { base: '#4a6a3a', dark: '#2a3a26', light: '#d8e0e8', beach: '#a89a7a', foam: '#ffffff' },
};

function blobs(c: Ctx, r: () => number, n: number, col: string, rmin: number, rmax: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = rmin + r() * (rmax - rmin);
    const clear = col.startsWith('#') ? col.slice(0, 7) + '00' : col.replace(/[\d.]+\)$/, '0)');
    wrap((ox, oy) => glowCircle(c, x + ox, y + oy, rad, [[0, col], [1, clear]]));
  }
}

/** Tileable hill-shaded heightmap: valleys, forests, rock and snowy peaks. */
function drawMountains(c: Ctx, night: boolean) {
  const img = c.createImageData(S, S);
  const r = rng(4242);
  const waves: [number, number, number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const big = i < 3;
    const fx = Math.floor(r() * (big ? 3 : 7)) - (big ? 1 : 3);
    const fy = 1 + Math.floor(r() * (big ? 2 : 6));
    waves.push([fx, fy, r() * Math.PI * 2, big ? 1 : 0.45 / (1 + (i - 3) * 0.3)]);
  }
  const TAU = Math.PI * 2;
  const hgt = (x: number, y: number) => {
    let v = 0;
    let n = 0;
    for (const [fx, fy, ph, a] of waves) {
      v += a * Math.cos((TAU * (fx * x + fy * y)) / S + ph);
      n += a;
    }
    v /= n;
    // ridged peaks from the absolute value, blended with smooth valleys
    return 0.55 * (1 - Math.abs(v) * 2.2) + 0.45 * (v * 0.5 + 0.5);
  };
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) H[y * S + x] = hgt(x, y);
  const at = (x: number, y: number) => H[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const h = at(x, y);
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const light = Math.max(0, Math.min(1.4, 0.75 - dx * 6 - dy * 6));
      let col: [number, number, number];
      if (h > 0.86) col = [232, 238, 244];
      else if (h > 0.72) col = [128, 118, 104];
      else if (h > 0.45) col = [58, 92, 50];
      else col = [76, 112, 60];
      const k = light * (night ? 0.45 : 1);
      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, col[0] * k + (night ? 4 : 0));
      img.data[i + 1] = Math.min(255, col[1] * k + (night ? 8 : 0));
      img.data[i + 2] = Math.min(255, col[2] * k + (night ? 22 : 0));
      img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  // pine dots in valleys
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * S);
    const y = Math.floor(r() * S);
    const h = at(x, y);
    if (h > 0.68) continue;
    wrap((ox, oy) => glowCircle(c, x + ox, y + oy, 3, [[0, night ? 'rgba(10,25,15,0.8)' : 'rgba(20,50,25,0.8)'], [1, 'rgba(20,50,25,0)']]));
  }
}

function drawLand(c: Ctx, kind: LandKind, night: boolean) {
  const p = PAL[kind];
  if (kind === 'mountain') {
    drawMountains(c, night);
    return;
  }
  const r = rng(kind.length * 977 + (night ? 5 : 0));
  c.fillStyle = p.base;
  c.fillRect(0, 0, S, S);
  if (kind === 'jungle') {
    blobs(c, r, 20, p.light + 'aa', 20, 50);
    blobs(c, r, 18, p.dark + 'cc', 15, 40);
    // tree canopies
    for (let i = 0; i < 160; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 4 + r() * 7;
      const col = r() < 0.5 ? '#2f6a28' : '#3f7e30';
      wrap((ox, oy) => {
        glowCircle(c, x + ox + 2, y + oy + 3, rad, [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
        glowCircle(c, x + ox, y + oy, rad, [[0, shade(col, 0.25)], [0.7, col], [1, col + '00']]);
      });
    }
    // dirt road
    c.strokeStyle = 'rgba(150,120,70,0.8)';
    c.lineWidth = 6;
    c.beginPath();
    for (let y = -10; y <= S + 10; y += 8) c.lineTo(S * 0.3 + Math.sin((y / S) * Math.PI * 2) * 30, y);
    c.stroke();
  } else if (kind === 'desert') {
    blobs(c, r, 20, p.light + '99', 25, 60);
    blobs(c, r, 14, p.dark + '88', 20, 50);
    c.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const x = r() * S;
      const y = r() * S;
      const len = 20 + r() * 40;
      wrap((ox, oy) => {
        c.strokeStyle = 'rgba(120,90,40,0.35)';
        c.beginPath();
        c.moveTo(x + ox - len / 2, y + oy);
        c.quadraticCurveTo(x + ox, y + oy - 8, x + ox + len / 2, y + oy);
        c.stroke();
        c.strokeStyle = 'rgba(255,240,200,0.3)';
        c.beginPath();
        c.moveTo(x + ox - len / 2, y + oy - 2);
        c.quadraticCurveTo(x + ox, y + oy - 10, x + ox + len / 2, y + oy - 2);
        c.stroke();
      });
    }
    blobs(c, r, 10, 'rgba(90,70,50,0.6)', 3, 7);
  } else if (kind === 'snow') {
    blobs(c, r, 20, p.light + 'cc', 25, 60);
    blobs(c, r, 14, p.dark + '88', 15, 45);
    c.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const x = r() * S;
      const y = r() * S;
      const len = 10 + r() * 25;
      wrap((ox, oy) => {
        c.strokeStyle = 'rgba(140,170,200,0.4)';
        c.beginPath();
        c.moveTo(x + ox, y + oy);
        c.lineTo(x + ox + len, y + oy + len * 0.3);
        c.stroke();
      });
    }
    blobs(c, r, 12, 'rgba(80,90,100,0.7)', 3, 8);
    // pine clusters
    for (let i = 0; i < 40; i++) {
      const x = r() * S;
      const y = r() * S;
      wrap((ox, oy) => glowCircle(c, x + ox, y + oy, 5, [[0, '#2a4a3a'], [1, 'rgba(42,74,58,0)']]));
    }
  } else if (kind === 'lava') {
    blobs(c, r, 20, p.light + 'aa', 20, 50);
    blobs(c, r, 14, p.dark + 'cc', 15, 40);
    // glowing fissures
    for (let i = 0; i < 9; i++) {
      let x = r() * S;
      let y = r() * S;
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < 8; k++) {
        x += (r() - 0.5) * 40;
        y += 8 + r() * 20;
        pts.push([x, y]);
      }
      wrap((ox, oy) => {
        for (const [lw, col] of [
          [9, 'rgba(255,60,0,0.25)'],
          [4, 'rgba(255,120,20,0.8)'],
          [1.5, 'rgba(255,240,160,1)'],
        ] as [number, string][]) {
          c.strokeStyle = col;
          c.lineWidth = lw;
          c.beginPath();
          pts.forEach(([px, py], j) => (j ? c.lineTo(px + ox, py + oy) : c.moveTo(px + ox, py + oy)));
          c.stroke();
        }
      });
    }
  } else if (kind === 'city') {
    // 4x4 blocks per tile, streets between
    const B = 64;
    for (let bx = 0; bx < 4; bx++) {
      for (let by = 0; by < 4; by++) {
        const x0 = bx * B + 8;
        const y0 = by * B + 8;
        const sz = B - 16;
        c.fillStyle = '#3a3c40';
        c.fillRect(x0, y0, sz, sz);
        if (r() < 0.15) {
          // park
          c.fillStyle = '#3a5a32';
          c.fillRect(x0 + 2, y0 + 2, sz - 4, sz - 4);
          for (let i = 0; i < 6; i++) glowCircle(c, x0 + 6 + r() * (sz - 12), y0 + 6 + r() * (sz - 12), 5, [[0, '#4a7a3a'], [1, 'rgba(74,122,58,0)']]);
          continue;
        }
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const w = sz / n - 3;
          const hh = sz * (0.4 + r() * 0.55);
          const bxp = x0 + 1.5 + i * (sz / n);
          const byp = y0 + (sz - hh) / 2;
          const tone = 70 + Math.floor(r() * 60);
          c.fillStyle = `rgb(${tone},${tone + 2},${tone + 6})`;
          c.fillRect(bxp, byp, w, hh);
          c.fillStyle = 'rgba(0,0,0,0.35)';
          c.fillRect(bxp + w - 3, byp + 3, 3, hh - 3);
          c.fillRect(bxp + 3, byp + hh - 3, w - 3, 3);
          c.fillStyle = 'rgba(255,255,255,0.12)';
          c.fillRect(bxp + 3, byp + 3, w - 8, 3);
          if (night) {
            for (let k = 0; k < 6; k++) {
              c.fillStyle = r() < 0.5 ? 'rgba(255,220,120,0.95)' : 'rgba(160,220,255,0.8)';
              c.fillRect(bxp + 2 + r() * (w - 5), byp + 2 + r() * (hh - 5), 2, 2);
            }
          }
        }
      }
    }
    // road markings
    c.strokeStyle = night ? 'rgba(255,210,120,0.5)' : 'rgba(240,220,120,0.5)';
    c.setLineDash([6, 6]);
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(i * B, 0);
      c.lineTo(i * B, S);
      c.moveTo(0, i * B);
      c.lineTo(S, i * B);
      c.stroke();
    }
    c.setLineDash([]);
    if (night) {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 8; j++) glowCircle(c, i * B, j * 32, 5, [[0, 'rgba(255,200,110,0.6)'], [1, 'rgba(255,200,110,0)']]);
    }
  } else {
    blobs(c, r, 20, p.light + '99', 20, 50);
    blobs(c, r, 16, p.dark + 'aa', 15, 40);
    // craters
    for (let i = 0; i < 14; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 5 + r() * 12;
      wrap((ox, oy) => {
        glowCircle(c, x + ox, y + oy, rad * 1.5, [[0, 'rgba(60,45,30,0.5)'], [1, 'rgba(60,45,30,0)']]);
        glowCircle(c, x + ox, y + oy, rad, [[0, 'rgba(20,15,10,0.8)'], [0.7, 'rgba(40,30,20,0.5)'], [1, 'rgba(160,140,110,0.3)']]);
      });
    }
  }
  if (night) {
    c.fillStyle = 'rgba(0,10,30,0.35)';
    c.fillRect(0, 0, S, S);
  }
}

/** Coastline edge, 480 wide: land at top, surf & sea at bottom. */
function drawCoast(c: Ctx, w: number, h: number, kind: LandKind, seed: number) {
  const p = PAL[kind];
  const r = rng(seed);
  const pts: number[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) pts.push(h * 0.45 + Math.sin(i * 0.9 + seed) * 8 + (r() - 0.5) * 10);
  const path = (off: number) => {
    c.beginPath();
    c.moveTo(0, 0);
    for (let i = 0; i <= n; i++) c.lineTo((i / n) * w, pts[i] + off);
    c.lineTo(w, 0);
    c.closePath();
  };
  // surf foam
  c.fillStyle = 'rgba(255,255,255,0.25)';
  path(16);
  c.fill();
  c.fillStyle = p.foam + 'aa';
  path(7);
  c.fill();
  // beach / shore
  const g = c.createLinearGradient(0, 0, 0, h * 0.6);
  g.addColorStop(0, p.base);
  g.addColorStop(0.55, p.beach);
  g.addColorStop(1, p.beach);
  c.fillStyle = g;
  path(0);
  c.fill();
  if (kind === 'city') {
    c.strokeStyle = '#5a5a58';
    c.lineWidth = 4;
    c.beginPath();
    for (let i = 0; i <= n; i++) c.lineTo((i / n) * w, pts[i] - 2);
    c.stroke();
    // piers
    c.fillStyle = '#6a6a66';
    for (let i = 0; i < 3; i++) c.fillRect(60 + i * 160, h * 0.4, 14, h * 0.55);
  }
  if (kind === 'lava') {
    c.strokeStyle = 'rgba(255,120,40,0.4)';
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i <= n; i++) c.lineTo((i / n) * w, pts[i] + 4);
    c.stroke();
  }
}

export function buildTerrainTextures(scene: Phaser.Scene) {
  for (const k of LAND_KINDS) {
    for (const night of [false, true]) make(scene, `land_${k}${night ? '_n' : ''}`, S, S, (c) => drawLand(c, k, night));
    make(scene, `coast_${k}`, 480, 90, (c, w, h) => drawCoast(c, w, h, k, k.length * 3));
  }
  for (let k = 0; k < 3; k++) {
    make(scene, `crater_${k}`, 90, 90, (c, w) => {
      const r = rng(2100 + k);
      glowCircle(c, w / 2, w / 2, w / 2, [[0, 'rgba(30,22,14,0.7)'], [0.6, 'rgba(50,40,30,0.4)'], [1, 'rgba(50,40,30,0)']]);
      glowCircle(c, w / 2, w / 2, w * 0.28, [[0, 'rgba(10,8,6,0.9)'], [0.8, 'rgba(30,24,18,0.7)'], [1, 'rgba(140,120,90,0.4)']]);
      c.fillStyle = 'rgba(40,30,20,0.6)';
      for (let i = 0; i < 10; i++) c.fillRect(r() * w, r() * w, 3, 3);
    });
  }
}

function drawTank(c: Ctx, w: number, h: number, era: Era) {
  const cx = w / 2;
  const hull = era === 'ww2' ? '#5a5e3e' : era === 'modern' ? '#6a6a58' : '#33384a';
  // tracks / hover skirt
  if (era === 'future') {
    glowCircle(c, cx, h / 2, w * 0.55, [[0, 'rgba(255,60,160,0.35)'], [1, 'rgba(255,60,160,0)']]);
  } else {
    c.fillStyle = '#222';
    c.fillRect(cx - w * 0.42, h * 0.08, w * 0.18, h * 0.84);
    c.fillRect(cx + w * 0.24, h * 0.08, w * 0.18, h * 0.84);
    c.fillStyle = '#444';
    for (let y = h * 0.1; y < h * 0.9; y += 5) {
      c.fillRect(cx - w * 0.42, y, w * 0.18, 1.5);
      c.fillRect(cx + w * 0.24, y, w * 0.18, 1.5);
    }
  }
  const g = c.createLinearGradient(cx - w * 0.3, 0, cx + w * 0.3, 0);
  g.addColorStop(0, shade(hull, -0.35));
  g.addColorStop(0.5, shade(hull, 0.15));
  g.addColorStop(1, shade(hull, -0.35));
  c.fillStyle = g;
  c.beginPath();
  if (era === 'future') {
    c.moveTo(cx, h * 0.04);
    c.lineTo(cx + w * 0.38, h * 0.3);
    c.lineTo(cx + w * 0.34, h * 0.92);
    c.lineTo(cx - w * 0.34, h * 0.92);
    c.lineTo(cx - w * 0.38, h * 0.3);
  } else c.rect(cx - w * 0.27, h * 0.12, w * 0.54, h * 0.76);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(cx - w * 0.2, h * 0.2, w * 0.4, 3);
}

export function buildLandUnitTextures(scene: Phaser.Scene, era: Era) {
  const s = (n: string) => `${n}_${era}`;
  make(scene, s('en_tank'), 40, 56, (c, w, h) => {
    c.translate(w / 2, h / 2);
    c.rotate(Math.PI);
    c.translate(-w / 2, -h / 2);
    drawTank(c, w, h, era);
  });
  make(scene, s('en_flak'), 64, 64, (c, w) => {
    const cx = w / 2;
    // sandbag / concrete ring
    const col = era === 'future' ? '#2e3344' : era === 'modern' ? '#7a7a72' : '#8a7a5a';
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.arc(cx + 3, cx + 4, 28, 0, Math.PI * 2);
    c.fill();
    const g = c.createRadialGradient(cx - 8, cx - 8, 4, cx, cx, 30);
    g.addColorStop(0, shade(col, 0.3));
    g.addColorStop(1, shade(col, -0.4));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cx, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = shade(col, -0.5);
    c.beginPath();
    c.arc(cx, cx, 18, 0, Math.PI * 2);
    c.fill();
    if (era !== 'future') {
      c.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath();
        c.ellipse(cx + Math.cos(a) * 23, cx + Math.sin(a) * 23, 4, 3, a, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      c.strokeStyle = '#ff3a9a';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cx, 24, 0, Math.PI * 2);
      c.stroke();
    }
  });
  make(scene, s('wreck_tank'), 40, 56, (c, w, h) => {
    drawTank(c, w, h, era);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(30,20,12,0.6)';
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  });
}
