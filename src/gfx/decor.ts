import Phaser from 'phaser';
import type { Era } from '../data/config';
import { make, glowCircle, rng } from './textures';

/**
 * Scenery textures: sunken / burning wrecks (derived from each era's own
 * ship and aircraft art), oil slicks, debris, reefs, rocks, mines, buoys,
 * military-base islands and lighthouses.
 */

type Ctx = CanvasRenderingContext2D;

function jaggedBand(c: Ctx, w: number, h: number, y0: number, y1: number, seed: number) {
  const r = rng(seed);
  c.beginPath();
  const n = 10;
  for (let i = 0; i <= n; i++) c.lineTo((i / n) * w, y0 * h + (r() - 0.5) * h * 0.05);
  for (let i = n; i >= 0; i--) c.lineTo((i / n) * w, y1 * h + (r() - 0.5) * h * 0.05);
  c.closePath();
  c.fill();
}

function jaggedBlob(c: Ctx, x: number, y: number, rx: number, ry: number, seed: number) {
  const r = rng(seed);
  c.beginPath();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.55 + r() * 0.6;
    c.lineTo(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
  }
  c.closePath();
  c.fill();
}

interface BreakOpts {
  /** horizontal bands to erase, in 0..1 of height */
  bands?: [number, number][];
  /** blobs to erase: x,y (0..1), rx, ry (0..1) */
  holes?: [number, number, number, number][];
  sunk: boolean;
  seed: number;
}

/** Make a wrecked copy of an existing texture: rusted, charred, broken apart. */
function breakTex(scene: Phaser.Scene, src: string, key: string, o: BreakOpts) {
  const img = scene.textures.get(src).getSourceImage() as HTMLCanvasElement;
  const w = img.width;
  const h = img.height;
  make(scene, key, w, h, (c) => {
    if (o.sunk) c.filter = 'blur(1.6px)';
    c.drawImage(img, 0, 0);
    c.filter = 'none';
    c.globalCompositeOperation = 'source-atop';
    // charring and rust patches
    c.fillStyle = 'rgba(40,28,18,0.45)';
    c.fillRect(0, 0, w, h);
    const r = rng(o.seed);
    for (let i = 0; i < 14; i++) {
      glowCircle(c, r() * w, r() * h, 6 + r() * Math.min(w, h) * 0.25, [
        [0, r() < 0.5 ? 'rgba(20,12,8,0.75)' : 'rgba(120,60,25,0.55)'],
        [1, 'rgba(0,0,0,0)'],
      ]);
    }
    if (o.sunk) {
      c.fillStyle = 'rgba(8,48,72,0.62)';
      c.fillRect(0, 0, w, h);
    }
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    (o.bands ?? []).forEach(([a, b], i) => jaggedBand(c, w, h, a, b, o.seed + i * 7));
    (o.holes ?? []).forEach(([x, y, rx, ry], i) => jaggedBlob(c, x * w, y * h, rx * w, ry * h, o.seed + 31 + i));
    c.globalCompositeOperation = 'source-over';
  });
}

export function buildWreckTextures(scene: Phaser.Scene, era: Era) {
  const s = (n: string) => `${n}_${era}`;
  for (const sunk of [true, false]) {
    const suf = sunk ? '_sunk' : '';
    breakTex(scene, s('en_destroyer'), s('wreck_ship' + suf), { bands: [[0.46, 0.55]], holes: [[0.5, 0.2, 0.25, 0.05]], sunk, seed: 11 });
    breakTex(scene, s('boss_ship'), s('wreck_bigship' + suf), { bands: [[0.58, 0.66]], holes: [[0.3, 0.3, 0.2, 0.06], [0.7, 0.8, 0.18, 0.05]], sunk, seed: 23 });
    breakTex(scene, s('en_bomber'), s('wreck_bomber' + suf), { holes: [[0.92, 0.45, 0.16, 0.3], [0.5, 0.15, 0.08, 0.12], [0.2, 0.55, 0.06, 0.08]], sunk, seed: 37 });
    breakTex(scene, s('transport'), s('wreck_transport' + suf), { holes: [[0.08, 0.4, 0.14, 0.25], [0.5, 0.9, 0.12, 0.1]], sunk, seed: 41 });
    breakTex(scene, s('en_heavy'), s('wreck_heavy' + suf), { holes: [[0.85, 0.4, 0.18, 0.25]], sunk, seed: 53 });
  }
}

export function buildDecorTextures(scene: Phaser.Scene) {
  // oil slicks
  for (let k = 0; k < 2; k++) {
    make(scene, `oil_${k}`, 220, 160, (c, w, h) => {
      const r = rng(500 + k);
      for (let i = 0; i < 9; i++) {
        const x = w * (0.25 + r() * 0.5);
        const y = h * (0.25 + r() * 0.5);
        const rad = 30 + r() * 40;
        glowCircle(c, x, y, rad, [
          [0, 'rgba(12,12,18,0.7)'],
          [0.7, 'rgba(20,18,30,0.45)'],
          [1, 'rgba(20,20,30,0)'],
        ]);
      }
      const cols = ['rgba(255,80,200,0.18)', 'rgba(80,220,255,0.18)', 'rgba(255,230,90,0.16)', 'rgba(120,255,140,0.14)'];
      c.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        c.strokeStyle = cols[i % cols.length];
        c.beginPath();
        c.ellipse(w / 2 + (r() - 0.5) * 50, h / 2 + (r() - 0.5) * 30, 40 + r() * 40, 20 + r() * 30, r() * 3, 0, Math.PI * 1.4);
        c.stroke();
      }
    });
  }

  // floating debris fields
  for (let k = 0; k < 3; k++) {
    make(scene, `debris_${k}`, 160, 140, (c, w, h) => {
      const r = rng(700 + k * 13);
      for (let i = 0; i < 16; i++) {
        const x = 15 + r() * (w - 30);
        const y = 15 + r() * (h - 30);
        c.save();
        c.translate(x, y);
        c.rotate(r() * Math.PI);
        const t = r();
        // foam ring
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath();
        c.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        c.fill();
        if (t < 0.4) {
          c.fillStyle = r() < 0.5 ? '#6b4a2a' : '#7d5a34';
          c.fillRect(-12, -2.5, 24, 5);
          c.strokeStyle = 'rgba(0,0,0,0.4)';
          c.strokeRect(-12, -2.5, 24, 5);
        } else if (t < 0.65) {
          c.fillStyle = '#8a6a3a';
          c.fillRect(-6, -6, 12, 12);
          c.strokeStyle = '#3a2a14';
          c.strokeRect(-6, -6, 12, 12);
          c.beginPath();
          c.moveTo(-6, -6);
          c.lineTo(6, 6);
          c.stroke();
        } else if (t < 0.85) {
          c.fillStyle = r() < 0.5 ? '#7a2a20' : '#3a4a3a';
          c.beginPath();
          c.arc(0, 0, 5, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.3)';
          c.stroke();
        } else {
          // life raft
          c.fillStyle = '#e07a20';
          c.beginPath();
          c.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#5a3010';
          c.beginPath();
          c.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      }
    });
  }

  // coral reefs (shallow water)
  for (let k = 0; k < 3; k++) {
    make(scene, `reef_${k}`, 240, 180, (c, w, h) => {
      const r = rng(900 + k * 17);
      glowCircle(c, w / 2, h / 2, Math.min(w, h) * 0.55, [
        [0, 'rgba(140,240,220,0.45)'],
        [0.7, 'rgba(90,210,210,0.25)'],
        [1, 'rgba(80,200,200,0)'],
      ]);
      const cols = ['#ff7a8a', '#ffb060', '#c070ff', '#ff5ab0', '#f0e080', '#60d0a0'];
      for (let i = 0; i < 40; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * 0.42;
        const x = w / 2 + Math.cos(a) * d * w;
        const y = h / 2 + Math.sin(a) * d * h;
        glowCircle(c, x, y, 4 + r() * 9, [
          [0, cols[Math.floor(r() * cols.length)] + 'cc'],
          [1, '#00000000'],
        ]);
      }
      c.fillStyle = 'rgba(60,70,60,0.5)';
      for (let i = 0; i < 6; i++) jaggedBlob(c, w / 2 + (r() - 0.5) * w * 0.6, h / 2 + (r() - 0.5) * h * 0.6, 8 + r() * 10, 6 + r() * 8, 950 + i + k);
    });
  }

  // sea rocks with surf
  for (let k = 0; k < 2; k++) {
    make(scene, `rock_${k}`, 120, 100, (c, w, h) => {
      const r = rng(1100 + k);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      jaggedBlob(c, w / 2, h / 2, w * 0.46, h * 0.46, 1200 + k);
      for (let i = 0; i < 4; i++) {
        const x = w / 2 + (r() - 0.5) * w * 0.4;
        const y = h / 2 + (r() - 0.5) * h * 0.35;
        const g = c.createRadialGradient(x - 6, y - 6, 2, x, y, 22);
        g.addColorStop(0, '#8a8478');
        g.addColorStop(1, '#2e2a26');
        c.fillStyle = g;
        jaggedBlob(c, x, y, 14 + r() * 12, 12 + r() * 10, 1300 + i + k * 9);
      }
    });
  }

  // naval mine
  make(scene, 'mine', 34, 34, (c, w) => {
    const cx = w / 2;
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.arc(cx, cx, 16, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#222';
    c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, cx);
      c.lineTo(cx + Math.cos(a) * 14, cx + Math.sin(a) * 14);
      c.stroke();
    }
    const g = c.createRadialGradient(cx - 3, cx - 3, 1, cx, cx, 10);
    g.addColorStop(0, '#6a6a6a');
    g.addColorStop(1, '#141414');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cx, 10, 0, Math.PI * 2);
    c.fill();
  });

  // buoy
  make(scene, 'buoy', 26, 26, (c, w) => {
    const cx = w / 2;
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath();
    c.arc(cx, cx, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d02a20';
    c.beginPath();
    c.arc(cx, cx, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f2f2f2';
    c.fillRect(cx - 8, cx - 2, 16, 4);
    c.fillStyle = '#333';
    c.beginPath();
    c.arc(cx, cx, 2.5, 0, Math.PI * 2);
    c.fill();
  });

  // lighthouse beam (pointing right from origin)
  make(scene, 'beam', 360, 90, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,250,200,0.55)');
    g.addColorStop(1, 'rgba(255,250,200,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, h / 2 - 3);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h / 2 + 3);
    c.closePath();
    c.fill();
  });

  // lighthouse islet
  make(scene, 'lighthouse', 150, 130, (c, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    c.fillStyle = 'rgba(255,255,255,0.3)';
    jaggedBlob(c, cx, cy, w * 0.48, h * 0.48, 1500);
    const g = c.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 55);
    g.addColorStop(0, '#9a9080');
    g.addColorStop(1, '#3a342c');
    c.fillStyle = g;
    jaggedBlob(c, cx, cy, w * 0.38, h * 0.36, 1501);
    c.fillStyle = '#6a8a4a';
    jaggedBlob(c, cx + 8, cy + 6, 22, 16, 1502);
    // tower (top view)
    c.fillStyle = '#f2f2f2';
    c.beginPath();
    c.arc(cx, cy, 13, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#c02020';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(cx, cy, 9, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#ffe680';
    c.beginPath();
    c.arc(cx, cy, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#7a5a3a';
    c.fillRect(cx + 16, cy - 5, 18, 12);
  });

  // military base islands (runway, hangars, bunkers, AA pits)
  for (let k = 0; k < 2; k++) {
    const src = scene.textures.get(`island_green_${k}`).getSourceImage() as HTMLCanvasElement;
    const w = src.width;
    const h = src.height;
    make(scene, `island_base_${k}`, w, h, (c) => {
      c.drawImage(src, 0, 0);
      const r = rng(1700 + k);
      const cx = w / 2;
      const cy = h / 2;
      c.save();
      c.translate(cx, cy);
      c.rotate((r() - 0.5) * 0.6);
      // runway
      c.fillStyle = '#5a5a52';
      c.fillRect(-w * 0.3, -9, w * 0.6, 18);
      c.strokeStyle = '#e8e8e0';
      c.setLineDash([8, 6]);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-w * 0.28, 0);
      c.lineTo(w * 0.28, 0);
      c.stroke();
      c.setLineDash([]);
      // hangars
      for (let i = 0; i < 3; i++) {
        c.fillStyle = '#7a7466';
        c.fillRect(-w * 0.22 + i * 26, 16, 20, 14);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.fillRect(-w * 0.22 + i * 26, 26, 20, 4);
      }
      // bunkers + AA pits
      for (let i = 0; i < 4; i++) {
        const x = (r() - 0.5) * w * 0.45;
        const y = -18 - r() * h * 0.18;
        c.fillStyle = '#8a8070';
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2a2a24';
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fill();
      }
      // scorch craters
      for (let i = 0; i < 5; i++) {
        glowCircle(c, (r() - 0.5) * w * 0.5, (r() - 0.5) * h * 0.4, 6 + r() * 8, [
          [0, 'rgba(20,15,10,0.8)'],
          [1, 'rgba(20,15,10,0)'],
        ]);
      }
      c.restore();
    });
  }

  // sea life seen from above, slightly blurred as if under water (head points up)
  make(scene, 'whale', 120, 300, (c, w, h) => {
    c.filter = 'blur(2px)';
    const cx = w / 2;
    const g = c.createLinearGradient(cx - 40, 0, cx + 40, 0);
    g.addColorStop(0, 'rgba(20,40,60,0.9)');
    g.addColorStop(0.5, 'rgba(45,70,95,0.95)');
    g.addColorStop(1, 'rgba(20,40,60,0.9)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx, 10);
    c.bezierCurveTo(cx + 42, 20, cx + 40, 120, cx + 26, 190);
    c.quadraticCurveTo(cx + 10, 240, cx + 5, 250);
    c.lineTo(cx - 5, 250);
    c.quadraticCurveTo(cx - 10, 240, cx - 26, 190);
    c.bezierCurveTo(cx - 40, 120, cx - 42, 20, cx, 10);
    c.fill();
    // pectoral fins
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + dir * 30, 80);
      c.quadraticCurveTo(cx + dir * 62, 110, cx + dir * 56, 140);
      c.quadraticCurveTo(cx + dir * 40, 115, cx + dir * 28, 100);
      c.fill();
    }
    // flukes
    c.beginPath();
    c.moveTo(cx, 246);
    c.quadraticCurveTo(cx + 30, 262, cx + 50, 290);
    c.quadraticCurveTo(cx + 20, 280, cx, 268);
    c.quadraticCurveTo(cx - 20, 280, cx - 50, 290);
    c.quadraticCurveTo(cx - 30, 262, cx, 246);
    c.fill();
    c.filter = 'none';
    // pale throat grooves / barnacle specks
    c.fillStyle = 'rgba(160,190,210,0.18)';
    for (let i = 0; i < 18; i++) c.fillRect(cx - 18 + ((i * 7) % 36), 30 + ((i * 13) % 120), 2, 6);
  });
  make(scene, 'shark', 50, 130, (c, w, h) => {
    c.filter = 'blur(1.2px)';
    const cx = w / 2;
    c.fillStyle = 'rgba(55,70,85,0.95)';
    c.beginPath();
    c.moveTo(cx, 4);
    c.bezierCurveTo(cx + 11, 14, cx + 11, 50, cx + 5, 92);
    c.lineTo(cx + 2, 104);
    c.lineTo(cx - 2, 104);
    c.lineTo(cx - 5, 92);
    c.bezierCurveTo(cx - 11, 50, cx - 11, 14, cx, 4);
    c.fill();
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + dir * 8, 36);
      c.lineTo(cx + dir * 24, 60);
      c.lineTo(cx + dir * 7, 52);
      c.fill();
    }
    c.beginPath();
    c.moveTo(cx, 100);
    c.lineTo(cx + 12, 126);
    c.lineTo(cx, 116);
    c.lineTo(cx - 9, 124);
    c.closePath();
    c.fill();
    c.filter = 'none';
    // dorsal fin breaking the surface
    c.fillStyle = 'rgba(40,50,60,1)';
    c.beginPath();
    c.moveTo(cx, 40);
    c.lineTo(cx + 2, 58);
    c.lineTo(cx - 2, 58);
    c.fill();
  });
}
