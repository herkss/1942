import Phaser from 'phaser';
import type { Theme } from '../data/themes';
import { make, glowCircle, rng, shade } from './textures';

/** Future-era deep-space art: starfields, nebulae, planets, asteroids, stations, space "land". */

type Ctx = CanvasRenderingContext2D;
const S = 256;

function wrap(fn: (ox: number, oy: number) => void, size = S) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function stars(c: Ctx, r: () => number, n: number, size: number, maxR: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 0.4 + r() * maxR;
    const tint = r();
    const col = tint < 0.6 ? '255,255,255' : tint < 0.8 ? '180,210,255' : '255,220,180';
    wrap((ox, oy) => glowCircle(c, x + ox, y + oy, rad * 2.2, [[0, `rgba(${col},1)`], [0.3, `rgba(${col},0.6)`], [1, `rgba(${col},0)`]]), size);
  }
}

/** Tileable deep-space background coloured from a theme's palette. */
export function buildSpaceBackground(scene: Phaser.Scene, key: string, theme: Theme) {
  if (scene.textures.exists(key)) return;
  const size = 512;
  make(scene, key, size, size, (c) => {
    const [deep, mid, hi] = theme.water;
    c.fillStyle = shade(deep, -0.75);
    c.fillRect(0, 0, size, size);
    const r = rng(key.length * 733 + 11);
    for (let i = 0; i < 14; i++) {
      const x = r() * size;
      const y = r() * size;
      const rad = 80 + r() * 140;
      const col = r() < 0.5 ? mid : hi;
      wrap((ox, oy) => glowCircle(c, x + ox, y + oy, rad, [[0, hexA(col, 0.22)], [0.6, hexA(col, 0.08)], [1, hexA(col, 0)]]), size);
    }
    stars(c, r, 260, size, 0.9);
    stars(c, r, 12, size, 2.2);
  });
}

export function buildSpaceTextures(scene: Phaser.Scene) {
  // near star layer (parallax)
  make(scene, 'stars_near', S, S, (c) => {
    const r = rng(77);
    stars(c, r, 26, S, 1.4);
  });

  // planets
  const planets: [string, string, string, boolean][] = [
    ['#d08a4a', '#8a4a2a', '#f0c890', true],
    ['#4a7ad0', '#22408a', '#a8d0ff', false],
    ['#9a6ad0', '#4a2a7a', '#e0c0ff', true],
  ];
  planets.forEach(([base, dark, light, ring], k) => {
    make(scene, `planet_${k}`, 360, 360, (c, w) => {
      const cx = w / 2;
      const R = 120;
      if (ring) {
        c.save();
        c.translate(cx, cx);
        c.rotate(-0.4);
        c.strokeStyle = hexA(light, 0.35);
        c.lineWidth = 14;
        c.beginPath();
        c.ellipse(0, 0, R * 1.45, R * 0.38, 0, Math.PI, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      glowCircle(c, cx, cx, R * 1.25, [[0.75, hexA(light, 0.25)], [1, hexA(light, 0)]]);
      const g = c.createRadialGradient(cx - R * 0.4, cx - R * 0.4, R * 0.1, cx, cx, R);
      g.addColorStop(0, light);
      g.addColorStop(0.5, base);
      g.addColorStop(1, dark);
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cx, R, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.beginPath();
      c.arc(cx, cx, R, 0, Math.PI * 2);
      c.clip();
      const r = rng(300 + k);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = hexA(r() < 0.5 ? dark : light, 0.18);
        c.fillRect(cx - R, cx - R + r() * R * 2, R * 2, 4 + r() * 14);
      }
      // terminator shadow
      const sg = c.createLinearGradient(cx - R, cx - R, cx + R, cx + R);
      sg.addColorStop(0.5, 'rgba(0,0,0,0)');
      sg.addColorStop(1, 'rgba(0,0,10,0.75)');
      c.fillStyle = sg;
      c.fillRect(0, 0, w, w);
      c.restore();
      if (ring) {
        c.save();
        c.translate(cx, cx);
        c.rotate(-0.4);
        c.strokeStyle = hexA(light, 0.45);
        c.lineWidth = 14;
        c.beginPath();
        c.ellipse(0, 0, R * 1.45, R * 0.38, 0, 0, Math.PI);
        c.stroke();
        c.restore();
      }
    });
  });

  // asteroids
  for (let k = 0; k < 4; k++) {
    make(scene, `asteroid_${k}`, 150, 130, (c, w, h) => {
      const r = rng(400 + k * 7);
      const cx = w / 2;
      const cy = h / 2;
      const n = 16;
      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k2 = 0.7 + r() * 0.3;
        pts.push([cx + Math.cos(a) * w * 0.44 * k2, cy + Math.sin(a) * h * 0.44 * k2]);
      }
      const g = c.createRadialGradient(cx - 20, cy - 20, 5, cx, cy, w * 0.5);
      g.addColorStop(0, '#9a928a');
      g.addColorStop(0.6, '#5a544e');
      g.addColorStop(1, '#2a2622');
      c.fillStyle = g;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
      c.save();
      c.clip();
      for (let i = 0; i < 8; i++) {
        const x = cx + (r() - 0.5) * w * 0.6;
        const y = cy + (r() - 0.5) * h * 0.6;
        const rad = 4 + r() * 10;
        glowCircle(c, x + 1, y + 1, rad, [[0, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);
        glowCircle(c, x, y, rad, [[0, 'rgba(20,18,16,0.7)'], [0.8, 'rgba(40,36,32,0.4)'], [1, 'rgba(0,0,0,0)']]);
      }
      c.restore();
    });
  }

  // space station module
  for (let k = 0; k < 2; k++) {
    make(scene, `station_${k}`, 240, 200, (c, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      // solar panels
      c.fillStyle = '#1e2a5a';
      for (const dir of [-1, 1]) {
        c.fillRect(cx + dir * 40 - (dir < 0 ? 70 : 0), cy - 22, 70, 44);
        c.strokeStyle = '#6a8ad0';
        c.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const x = cx + dir * 40 - (dir < 0 ? 70 : 0) + i * 12;
          c.beginPath();
          c.moveTo(x, cy - 22);
          c.lineTo(x, cy + 22);
          c.stroke();
        }
      }
      c.fillStyle = '#8a8e98';
      c.fillRect(cx - 44, cy - 3, 88, 6);
      // hub
      const g = c.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 40);
      g.addColorStop(0, '#d0d4dc');
      g.addColorStop(1, '#4a4e58');
      c.fillStyle = g;
      if (k === 0) {
        c.beginPath();
        c.arc(cx, cy, 36, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#2a2e38';
        c.lineWidth = 6;
        c.beginPath();
        c.arc(cx, cy, 24, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.fillRect(cx - 18, cy - h * 0.42, 36, h * 0.84);
        c.fillStyle = '#5a5e68';
        for (let i = 0; i < 5; i++) c.fillRect(cx - 18, cy - h * 0.42 + i * 34, 36, 4);
      }
      for (let i = 0; i < 6; i++) {
        glowCircle(c, cx + (i - 2.5) * 12, cy + (k ? 0 : 30), 3, [[0, '#7ff'], [1, 'rgba(0,255,255,0)']]);
      }
    });
  }

  // satellite beacon
  make(scene, 'satellite', 70, 50, (c, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    c.fillStyle = '#2a3a7a';
    c.fillRect(2, cy - 8, 22, 16);
    c.fillRect(w - 24, cy - 8, 22, 16);
    c.fillStyle = '#b8bcc4';
    c.fillRect(cx - 9, cy - 9, 18, 18);
    c.strokeStyle = '#ddd';
    c.beginPath();
    c.arc(cx, cy - 12, 8, Math.PI, Math.PI * 2);
    c.stroke();
  });

  // metal space debris
  for (let k = 0; k < 3; k++) {
    make(scene, `sdebris_${k}`, 160, 140, (c, w, h) => {
      const r = rng(800 + k);
      for (let i = 0; i < 14; i++) {
        c.save();
        c.translate(15 + r() * (w - 30), 15 + r() * (h - 30));
        c.rotate(r() * Math.PI * 2);
        const tone = 90 + Math.floor(r() * 80);
        c.fillStyle = `rgb(${tone},${tone + 4},${tone + 12})`;
        c.beginPath();
        c.moveTo(-8 - r() * 6, -3);
        c.lineTo(6 + r() * 8, -5);
        c.lineTo(4, 4 + r() * 4);
        c.lineTo(-6, 3);
        c.closePath();
        c.fill();
        if (r() < 0.3) glowCircle(c, 0, 0, 4, [[0, 'rgba(255,150,60,0.9)'], [1, 'rgba(255,100,0,0)']]);
        c.restore();
      }
    });
  }

  // space "land" surfaces + rims
  const surfaces: Record<string, (c: Ctx) => void> = {
    station: (c) => {
      c.fillStyle = '#2a2e38';
      c.fillRect(0, 0, S, S);
      const r = rng(901);
      for (let y = 0; y < S; y += 32) {
        for (let x = 0; x < S; x += 32) {
          const tone = 50 + Math.floor(r() * 30);
          c.fillStyle = `rgb(${tone},${tone + 4},${tone + 12})`;
          c.fillRect(x + 1, y + 1, 30, 30);
          if (r() < 0.25) {
            c.fillStyle = 'rgba(0,0,0,0.4)';
            c.fillRect(x + 6, y + 6, 20, 20);
          }
          if (r() < 0.2) glowCircle(c, x + 16, y + 16, 4, [[0, r() < 0.5 ? '#7ff' : '#f7a'], [1, 'rgba(0,0,0,0)']]);
        }
      }
      c.strokeStyle = 'rgba(80,220,255,0.35)';
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(i * 64 + 16, 0);
        c.lineTo(i * 64 + 16, S);
        c.stroke();
      }
    },
    asteroid: (c) => {
      c.fillStyle = '#3a3632';
      c.fillRect(0, 0, S, S);
      const r = rng(902);
      for (let i = 0; i < 40; i++) {
        const x = r() * S;
        const y = r() * S;
        const rad = 4 + r() * 18;
        wrap((ox, oy) => {
          glowCircle(c, x + ox + 2, y + oy + 2, rad, [[0, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
          glowCircle(c, x + ox, y + oy, rad, [[0, 'rgba(15,12,10,0.8)'], [0.8, 'rgba(30,26,22,0.5)'], [1, 'rgba(0,0,0,0)']]);
        });
      }
    },
    alien: (c) => {
      c.fillStyle = '#2a1a3a';
      c.fillRect(0, 0, S, S);
      const r = rng(903);
      for (let i = 0; i < 60; i++) {
        const x = r() * S;
        const y = r() * S;
        const rad = 6 + r() * 20;
        const col = r() < 0.5 ? 'rgba(160,60,200,0.35)' : 'rgba(60,200,160,0.3)';
        wrap((ox, oy) => glowCircle(c, x + ox, y + oy, rad, [[0, col], [1, 'rgba(0,0,0,0)']]));
      }
      for (let i = 0; i < 30; i++) {
        const x = r() * S;
        const y = r() * S;
        wrap((ox, oy) => glowCircle(c, x + ox, y + oy, 3, [[0, '#9fffd0'], [1, 'rgba(0,255,160,0)']]));
      }
    },
    moon: (c) => {
      c.fillStyle = '#8a8a90';
      c.fillRect(0, 0, S, S);
      const r = rng(904);
      for (let i = 0; i < 50; i++) {
        const x = r() * S;
        const y = r() * S;
        const rad = 3 + r() * 22;
        wrap((ox, oy) => {
          glowCircle(c, x + ox - 2, y + oy - 2, rad, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
          glowCircle(c, x + ox, y + oy, rad, [[0, 'rgba(50,50,56,0.7)'], [0.8, 'rgba(90,90,96,0.4)'], [1, 'rgba(0,0,0,0)']]);
        });
      }
    },
  };
  for (const [k, fn] of Object.entries(surfaces)) {
    make(scene, `land_${k}`, S, S, fn);
    make(scene, `land_${k}_n`, S, S, fn);
    make(scene, `coast_${k}`, 480, 90, (c, w, h) => {
      const r = rng(k.length * 17);
      const pts: number[] = [];
      for (let i = 0; i <= 24; i++) pts.push(h * 0.45 + (k === 'station' ? 0 : (r() - 0.5) * 16));
      // glow rim
      c.save();
      c.shadowColor = k === 'station' ? '#40e0ff' : k === 'alien' ? '#c060ff' : '#9ab0ff';
      c.shadowBlur = 14;
      c.fillStyle = k === 'station' ? '#3a404c' : k === 'alien' ? '#3a2a4a' : k === 'moon' ? '#9a9aa0' : '#4a4640';
      c.beginPath();
      c.moveTo(0, 0);
      pts.forEach((y, i) => c.lineTo((i / 24) * w, y));
      c.lineTo(w, 0);
      c.closePath();
      c.fill();
      c.restore();
      if (k === 'station') {
        for (let x = 10; x < w; x += 30) glowCircle(c, x, h * 0.42, 3, [[0, '#bff'], [1, 'rgba(0,255,255,0)']]);
      }
    });
  }
}

/** Map an ocean-world land kind to its deep-space counterpart. */
export function spaceLand(kind: string) {
  return ({ jungle: 'alien', desert: 'moon', snow: 'moon', lava: 'alien', city: 'station', waste: 'asteroid', mountain: 'asteroid' } as Record<string, string>)[kind] ?? 'asteroid';
}
