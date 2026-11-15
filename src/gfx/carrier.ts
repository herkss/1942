import type { Era } from '../data/config';
import { drawPlane, glowCircle, rng, shade, type PlaneSpec } from './textures';

/**
 * Detailed top-down aircraft carriers (bow up). Logical size 200 x 680; the
 * runway centreline sits at x = 92 (cx - 8) and the arresting wires around
 * y = 530-570, which the takeoff / landing choreography relies on.
 */

type Ctx = CanvasRenderingContext2D;

const W = 200;
const H = 680;
const CX = W / 2;
const RX = CX - 8; // runway centreline

function hullPath(c: Ctx, hw: number, bowY: number, sternY: number, sharp: number) {
  c.beginPath();
  c.moveTo(CX, bowY);
  c.bezierCurveTo(CX + hw * 0.55, bowY + sharp * 0.35, CX + hw, bowY + sharp * 0.75, CX + hw, bowY + sharp);
  c.lineTo(CX + hw, sternY - 14);
  c.quadraticCurveTo(CX + hw, sternY, CX + hw - 16, sternY);
  c.lineTo(CX - hw + 16, sternY);
  c.quadraticCurveTo(CX - hw, sternY, CX - hw, sternY - 14);
  c.lineTo(CX - hw, bowY + sharp);
  c.bezierCurveTo(CX - hw, bowY + sharp * 0.75, CX - hw * 0.55, bowY + sharp * 0.35, CX, bowY);
  c.closePath();
}

function hull(c: Ctx, col: string, hw: number, sharp: number) {
  const g = c.createLinearGradient(CX - hw, 0, CX + hw, 0);
  g.addColorStop(0, shade(col, -0.55));
  g.addColorStop(0.18, shade(col, -0.1));
  g.addColorStop(0.5, shade(col, 0.12));
  g.addColorStop(0.82, shade(col, -0.1));
  g.addColorStop(1, shade(col, -0.55));
  c.fillStyle = g;
  hullPath(c, hw, 0, H, sharp);
  c.fill();
  c.strokeStyle = shade(col, -0.7);
  c.lineWidth = 1;
  c.stroke();
}

function parkedPlane(c: Ctx, x: number, y: number, rot: number, spec: PlaneSpec, scale = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(scale, scale);
  c.translate(-20, -20);
  drawPlane(c, 40, 40, spec);
  c.restore();
}

function crew(c: Ctx, r: () => number, x0: number, y0: number, n: number, spread = 18) {
  const cols = ['#ffd23a', '#3a7aff', '#e83a2a', '#3ac850', '#f2f2f2', '#8a4ad8'];
  for (let i = 0; i < n; i++) {
    c.fillStyle = cols[Math.floor(r() * cols.length)];
    c.beginPath();
    c.arc(x0 + (r() - 0.5) * spread, y0 + (r() - 0.5) * spread, 1.3, 0, Math.PI * 2);
    c.fill();
  }
}

function tireMarks(c: Ctx, r: () => number, x: number, y0: number, y1: number, n: number, col = 'rgba(20,20,20,0.18)') {
  c.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    c.lineWidth = 0.6 + r() * 1.4;
    const ox = x + (r() - 0.5) * 22;
    const ya = y0 + r() * (y1 - y0);
    c.beginPath();
    c.moveTo(ox, ya);
    c.quadraticCurveTo(ox + (r() - 0.5) * 8, ya + 20, ox + (r() - 0.5) * 6, ya + 30 + r() * 50);
    c.stroke();
  }
}

function wires(c: Ctx, x0: number, x1: number, ys: number[]) {
  for (const y of ys) {
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(x0, y + 1);
    c.lineTo(x1, y + 1);
    c.stroke();
    c.strokeStyle = '#b8b8b0';
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    c.stroke();
    c.fillStyle = '#555';
    c.fillRect(x0 - 3, y - 2, 4, 4);
    c.fillRect(x1 - 1, y - 2, 4, 4);
  }
}

function gunTub(c: Ctx, x: number, y: number, r: number, barrels: number, dir: number) {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.arc(x + 1, y + 1.5, r + 1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#6a7078';
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#4a5058';
  c.stroke();
  c.fillStyle = '#3a3e44';
  c.beginPath();
  c.arc(x, y, r * 0.5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#222';
  c.lineWidth = 1;
  for (let i = 0; i < barrels; i++) {
    const off = (i - (barrels - 1) / 2) * 1.6;
    c.beginPath();
    c.moveTo(x + off, y);
    c.lineTo(x + off + dir * r * 1.6, y - r * 0.8);
    c.stroke();
  }
}

function hazard(c: Ctx, x: number, y: number, w: number, h: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = '#e8c020';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#1a1a1a';
  for (let i = -h; i < w + h; i += 8) {
    c.beginPath();
    c.moveTo(x + i, y);
    c.lineTo(x + i + 4, y);
    c.lineTo(x + i + 4 - h, y + h);
    c.lineTo(x + i - h, y + h);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** Vertical "www.herks.co.kr" in weathered deck paint. */
function herks(c: Ctx, x: number, y: number, size: number, era: Era) {
  c.save();
  c.translate(x, y);
  c.rotate(-Math.PI / 2);
  c.font = `bold ${size}px "Black Ops One", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (era === 'future') {
    c.shadowColor = '#36e0ff';
    c.shadowBlur = 6;
    c.fillStyle = 'rgba(220,250,255,0.9)';
  } else c.fillStyle = 'rgba(245,245,240,0.88)';
  c.fillText('www.herks.co.kr', 0, 0);
  c.shadowBlur = 0;
  c.globalCompositeOperation = 'source-atop';
  const r = rng(era.length * 101);
  for (let i = 0; i < 170; i++) {
    c.fillStyle = `rgba(${era === 'ww2' ? '120,95,60' : '50,54,60'},${0.3 + r() * 0.5})`;
    c.fillRect((r() - 0.5) * 240, (r() - 0.5) * size, 1 + r() * 3, 1 + r() * 2);
  }
  c.restore();
}

// ============================================================ WWII fleet carrier
function ww2(c: Ctx) {
  const r = rng(1942);
  hull(c, '#5d6670', 74, 120);

  // sponsons, catwalks and quad AA tubs along both sides
  for (const side of [-1, 1]) {
    c.fillStyle = '#4e565e';
    c.fillRect(side < 0 ? CX - 92 : CX + 84, 70, 8, 590);
    c.strokeStyle = 'rgba(220,220,220,0.35)';
    c.lineWidth = 0.6;
    c.setLineDash([2, 2]);
    c.beginPath();
    const rxl = side < 0 ? CX - 92 : CX + 92;
    c.moveTo(rxl, 70);
    c.lineTo(rxl, 660);
    c.stroke();
    c.setLineDash([]);
    for (let y = 95; y < 650; y += 62) {
      if (side > 0 && y > 230 && y < 440) continue; // island side
      gunTub(c, side < 0 ? CX - 92 : CX + 92, y, 6, 4, side);
    }
  }

  // flight deck outline (narrower at the bow)
  const deckPath = () => {
    c.beginPath();
    c.moveTo(CX - 54, 16);
    c.lineTo(CX + 54, 16);
    c.lineTo(CX + 84, 90);
    c.lineTo(CX + 84, 668);
    c.lineTo(CX - 84, 668);
    c.lineTo(CX - 84, 90);
    c.closePath();
  };
  c.fillStyle = '#8b7352';
  deckPath();
  c.fill();
  c.save();
  deckPath();
  c.clip();
  // individual planks with staggered butt joints
  for (let x = CX - 84; x < CX + 84; x += 3) {
    const tone = r() * 0.14 - 0.07;
    c.fillStyle = shade('#8b7352', tone);
    c.fillRect(x, 0, 3, H);
    c.fillStyle = 'rgba(40,25,10,0.35)';
    c.fillRect(x, 0, 0.5, H);
    for (let y = r() * 40; y < H; y += 30 + r() * 30) c.fillRect(x, y, 3, 0.6);
  }
  // steel tie-down strips
  c.fillStyle = 'rgba(70,72,74,0.55)';
  for (let y = 30; y < H; y += 21) c.fillRect(CX - 84, y, 168, 1.2);
  // weathering
  for (let i = 0; i < 40; i++) {
    glowCircle(c, CX + (r() - 0.5) * 160, r() * H, 6 + r() * 16, [
      [0, r() < 0.5 ? 'rgba(40,28,15,0.18)' : 'rgba(255,240,210,0.07)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }
  tireMarks(c, r, RX, 450, 640, 26);
  c.restore();

  // deck edge lines & centreline
  c.strokeStyle = 'rgba(240,240,235,0.85)';
  c.lineWidth = 1.5;
  c.strokeRect(CX - 80, 96, 160, 566);
  c.lineWidth = 2.5;
  c.setLineDash([16, 12]);
  c.beginPath();
  c.moveTo(RX, 30);
  c.lineTo(RX, 660);
  c.stroke();
  c.setLineDash([]);

  // elevators: two centreline, one deck-edge on the port side
  const elev = (x: number, y: number, w: number, h: number) => {
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(20,12,4,0.7)';
    c.lineWidth = 1.2;
    c.strokeRect(x, y, w, h);
  };
  elev(RX - 24, 150, 48, 44);
  elev(RX - 24, 400, 48, 44);
  c.fillStyle = '#6e5a40';
  c.fillRect(CX - 108, 270, 26, 40);
  elev(CX - 108, 270, 26, 40);

  // island: bridge, funnel, mast, twin 5-inch mounts fore and aft
  const ix = CX + 70;
  gunTub(c, ix, 236, 8, 2, 0);
  gunTub(c, ix, 442, 8, 2, 0);
  const ig = c.createLinearGradient(ix - 14, 0, ix + 14, 0);
  ig.addColorStop(0, '#4e565e');
  ig.addColorStop(0.6, '#7c868e');
  ig.addColorStop(1, '#5a626a');
  c.fillStyle = ig;
  c.beginPath();
  c.moveTo(ix - 10, 255);
  c.lineTo(ix + 10, 252);
  c.lineTo(ix + 14, 425);
  c.lineTo(ix - 12, 425);
  c.closePath();
  c.fill();
  c.strokeStyle = '#3a4048';
  c.stroke();
  c.fillStyle = '#9aa4ac';
  c.fillRect(ix - 8, 262, 18, 30); // bridge
  c.fillStyle = '#1e2a34';
  for (let i = 0; i < 6; i++) c.fillRect(ix - 7 + i * 3, 264, 2, 3); // windows
  c.fillStyle = '#2a2e32';
  c.beginPath();
  c.ellipse(ix + 1, 345, 9, 22, 0, 0, Math.PI * 2);
  c.fill(); // funnel
  c.strokeStyle = '#555';
  for (let y = 328; y < 364; y += 4) {
    c.beginPath();
    c.moveTo(ix - 6, y);
    c.lineTo(ix + 8, y);
    c.stroke();
  }
  c.strokeStyle = '#ddd';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(ix - 14, 300);
  c.lineTo(ix + 16, 300);
  c.moveTo(ix + 1, 290);
  c.lineTo(ix + 1, 312);
  c.stroke(); // mast yard
  c.fillStyle = '#b0b8c0';
  c.fillRect(ix - 6, 296, 14, 3); // radar
  // stars-and-bars style roundels are avoided; ship number instead
  c.fillStyle = 'rgba(245,245,240,0.92)';
  c.font = 'bold 30px "Black Ops One", sans-serif';
  c.textAlign = 'center';
  c.fillText('07', RX, 640);
  c.save();
  c.translate(RX, 70);
  c.rotate(Math.PI);
  c.fillText('07', 0, 0);
  c.restore();

  // crash barrier and arresting wires
  c.strokeStyle = 'rgba(30,30,30,0.8)';
  c.lineWidth = 1;
  c.setLineDash([3, 2]);
  c.beginPath();
  c.moveTo(CX - 74, 470);
  c.lineTo(CX + 64, 470);
  c.stroke();
  c.setLineDash([]);
  wires(c, RX - 52, RX + 52, [528, 540, 552, 564, 576]);
  // LSO platform
  c.fillStyle = '#5a626a';
  c.fillRect(CX - 100, 600, 16, 14);
  c.fillStyle = '#ffd23a';
  c.fillRect(CX - 96, 604, 3, 3);

  // deck park: folded-wing aircraft near the bow
  const navy: PlaneSpec = { len: 28, span: 20, fuseW: 6, wingY: 0.34, chord: 8, tipChord: 5, sweep: 1, tailSpan: 11, tailChord: 4, body: '#3a5a7a', wing: '#45678a', canopy: '#9ac0e0', noseProp: true, side: 'ally', era: 'ww2' };
  [
    [CX - 58, 120],
    [CX - 34, 112],
    [CX - 58, 160],
    [CX - 34, 152],
    [CX + 40, 130],
    [CX + 62, 138],
  ].forEach(([x, y]) => parkedPlane(c, x, y, 0, navy));
  herks(c, CX - 62, 368, 26, 'ww2');
  crew(c, r, CX - 46, 190, 8, 30);
  crew(c, r, CX + 50, 170, 6, 24);
  crew(c, r, CX + 55, 460, 4, 14);
}

// ============================================================ modern supercarrier
function modern(c: Ctx) {
  const r = rng(2026);
  hull(c, '#6b7178', 72, 90);
  // flight deck with angled landing area on the port side
  const deckPath = () => {
    c.beginPath();
    c.moveTo(CX - 46, 14);
    c.lineTo(CX + 50, 14);
    c.lineTo(CX + 84, 70);
    c.lineTo(CX + 86, 668);
    c.lineTo(CX - 80, 668);
    c.lineTo(CX - 98, 560);
    c.lineTo(CX - 98, 420);
    c.lineTo(CX - 80, 300);
    c.lineTo(CX - 80, 70);
    c.closePath();
  };
  c.fillStyle = '#3c4046';
  deckPath();
  c.fill();
  c.save();
  deckPath();
  c.clip();
  // non-skid texture & panel seams
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    c.fillRect(r() * W, r() * H, 1.5, 1.5);
  }
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.lineWidth = 0.6;
  for (let y = 0; y < H; y += 34) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y);
    c.stroke();
  }
  tireMarks(c, r, RX - 10, 430, 650, 40, 'rgba(10,10,10,0.3)');
  for (let i = 0; i < 25; i++) glowCircle(c, CX + (r() - 0.5) * 170, r() * H, 5 + r() * 12, [[0, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0)']]);
  c.restore();

  // angled deck: landing centreline, edge lines, red/white foul line
  const a0: [number, number] = [CX - 30, 660];
  const a1: [number, number] = [CX - 92, 300];
  c.strokeStyle = 'rgba(245,245,245,0.85)';
  c.lineWidth = 2;
  c.setLineDash([14, 10]);
  c.beginPath();
  c.moveTo(...a0);
  c.lineTo(...a1);
  c.stroke();
  c.setLineDash([]);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(CX - 6, 668);
  c.lineTo(CX - 64, 300);
  c.moveTo(CX - 54, 668);
  c.lineTo(CX - 98, 420);
  c.stroke();
  c.lineWidth = 3;
  c.setLineDash([5, 5]);
  c.strokeStyle = '#d82a2a';
  c.beginPath();
  c.moveTo(CX - 2, 600);
  c.lineTo(CX - 50, 300);
  c.stroke();
  c.setLineDash([]);

  // bow catapults with shuttle tracks and jet blast deflectors
  for (const cx of [RX, CX + 34]) {
    c.strokeStyle = '#1e2024';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(cx, 22);
    c.lineTo(cx, 230);
    c.stroke();
    c.strokeStyle = 'rgba(200,200,200,0.5)';
    c.lineWidth = 0.6;
    c.setLineDash([2, 6]);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#e8e8e8';
    c.fillRect(cx - 2, 26, 4, 3);
    c.fillStyle = '#585e66';
    c.fillRect(cx - 18, 238, 36, 6);
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(cx - 18, 244, 36, 2);
  }
  // waist catapult along the angled deck
  c.strokeStyle = '#1e2024';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(CX - 70, 330);
  c.lineTo(CX - 52, 470);
  c.stroke();

  // yellow taxi / centre lines
  c.strokeStyle = '#ffd23a';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(RX, 250);
  c.lineTo(RX, 520);
  c.moveTo(CX + 34, 250);
  c.quadraticCurveTo(CX + 34, 330, CX + 10, 380);
  c.stroke();
  c.strokeStyle = 'rgba(245,245,245,0.8)';
  c.lineWidth = 1.2;
  c.setLineDash([10, 8]);
  c.beginPath();
  c.moveTo(CX + 82, 80);
  c.lineTo(CX + 82, 664);
  c.moveTo(CX - 78, 80);
  c.lineTo(CX - 78, 300);
  c.stroke();
  c.setLineDash([]);

  // deck-edge elevators (3 starboard, 1 port)
  c.fillStyle = '#41454b';
  c.strokeStyle = '#ffd23a';
  c.lineWidth = 1;
  for (const [x, y, w, h] of [
    [CX + 84, 190, 18, 40],
    [CX + 84, 250, 18, 40],
    [CX + 84, 470, 18, 40],
    [CX - 100, 470, 18, 40],
  ]) {
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
  }

  // island with phased-array panels and mast
  const ix = CX + 70;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(ix - 10, 334, 26, 96);
  const ig = c.createLinearGradient(ix - 12, 0, ix + 12, 0);
  ig.addColorStop(0, '#5a6068');
  ig.addColorStop(0.6, '#8a929a');
  ig.addColorStop(1, '#646a72');
  c.fillStyle = ig;
  c.fillRect(ix - 12, 330, 24, 94);
  c.fillStyle = '#2a3440';
  c.fillRect(ix - 11, 336, 9, 12);
  c.fillRect(ix + 2, 336, 9, 12);
  c.fillRect(ix - 11, 400, 9, 12);
  c.fillStyle = '#1a2430';
  for (let i = 0; i < 7; i++) c.fillRect(ix - 10 + i * 3, 356, 2, 3);
  c.strokeStyle = '#ddd';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(ix, 368);
  c.lineTo(ix, 396);
  c.moveTo(ix - 10, 378);
  c.lineTo(ix + 10, 378);
  c.stroke();
  c.fillStyle = '#c8ccd0';
  c.beginPath();
  c.arc(ix, 388, 4, 0, Math.PI * 2);
  c.fill();
  // CIWS domes
  for (const [x, y] of [
    [CX - 72, 40],
    [CX + 76, 42],
    [CX + 84, 650],
    [CX - 76, 656],
  ]) {
    c.fillStyle = '#e8e8e8';
    c.beginPath();
    c.arc(x, y, 4.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#555';
    c.fillRect(x - 0.7, y - 9, 1.4, 6);
  }

  // hull numbers
  c.fillStyle = 'rgba(245,245,245,0.92)';
  c.font = 'bold 30px "Black Ops One", sans-serif';
  c.textAlign = 'center';
  c.save();
  c.translate(CX + 50, 120);
  c.rotate(Math.PI);
  c.fillText('77', 0, 0);
  c.restore();
  c.save();
  c.translate(CX - 60, 560);
  c.rotate(-0.17);
  c.fillText('77', 0, 0);
  c.restore();

  wires(c, RX - 48, RX + 40, [530, 544, 558, 572]);

  // parked jets (folded wings) and helicopters
  const jet: PlaneSpec = { len: 30, span: 16, fuseW: 6, wingY: 0.42, chord: 11, tipChord: 3, sweep: 6, tailSpan: 12, tailChord: 4, tailSweep: 3, body: '#8a96a4', wing: '#929eac', canopy: '#d0a040', jet: 2, twinTail: true, side: 'ally', era: 'modern' };
  [
    [CX + 60, 150, 0.6],
    [CX + 60, 182, 0.6],
    [CX + 60, 460, -0.5],
    [CX + 60, 500, -0.5],
    [CX + 58, 540, -0.5],
  ].forEach(([x, y, rot]) => parkedPlane(c, x, y, rot, jet));
  for (const [x, y] of [
    [CX + 58, 600],
    [CX + 58, 636],
  ]) {
    c.fillStyle = '#5a6068';
    c.beginPath();
    c.ellipse(x, y, 5, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#2a2e32';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y - 2);
    c.lineTo(x, y + 18);
    c.moveTo(x - 3, y - 4);
    c.lineTo(x + 3, y + 10);
    c.stroke();
  }
  herks(c, CX - 60, 190, 24, 'modern');
  crew(c, r, CX + 40, 220, 10, 30);
  crew(c, r, RX, 40, 6, 20);
  crew(c, r, CX - 70, 440, 4, 12);
}

// ============================================================ future space carrier
function future(c: Ctx) {
  const r = rng(2199);
  // angular armoured hull
  c.fillStyle = '#1c2230';
  c.beginPath();
  c.moveTo(CX, 0);
  c.lineTo(CX + 52, 60);
  c.lineTo(CX + 86, 120);
  c.lineTo(CX + 92, 560);
  c.lineTo(CX + 78, 640);
  c.lineTo(CX + 50, 680);
  c.lineTo(CX - 50, 680);
  c.lineTo(CX - 78, 640);
  c.lineTo(CX - 92, 560);
  c.lineTo(CX - 86, 120);
  c.lineTo(CX - 52, 60);
  c.closePath();
  c.fill();
  c.strokeStyle = '#36e0ff';
  c.lineWidth = 1;
  c.stroke();
  // side armour facets
  c.fillStyle = '#2a3244';
  for (let y = 130; y < 600; y += 46) {
    c.fillRect(CX - 92, y, 10, 38);
    c.fillRect(CX + 82, y, 10, 38);
  }
  // deck with hexagonal plating
  const deckPath = () => {
    c.beginPath();
    c.moveTo(CX - 36, 40);
    c.lineTo(CX + 36, 40);
    c.lineTo(CX + 76, 120);
    c.lineTo(CX + 78, 630);
    c.lineTo(CX - 78, 630);
    c.lineTo(CX - 76, 120);
    c.closePath();
  };
  c.fillStyle = '#242a38';
  deckPath();
  c.fill();
  c.save();
  deckPath();
  c.clip();
  c.strokeStyle = 'rgba(120,160,200,0.14)';
  c.lineWidth = 0.8;
  const hs = 10;
  for (let row = 0; row < H / (hs * 1.5) + 1; row++) {
    for (let col = 0; col < W / (hs * 1.73) + 1; col++) {
      const x = col * hs * 1.73 + (row % 2) * hs * 0.865;
      const y = row * hs * 1.5;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        c.lineTo(x + Math.cos(a) * hs, y + Math.sin(a) * hs);
      }
      c.closePath();
      c.stroke();
    }
  }
  for (let i = 0; i < 30; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '80,120,160'},0.12)`;
    const y = r() * H;
    c.fillRect(CX - 76, y, 152, 2 + r() * 6);
  }
  c.restore();

  // mag-rail launch tracks (glowing segments)
  for (const x of [RX - 6, RX + 6]) {
    c.strokeStyle = '#0e1a26';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, 46);
    c.lineTo(x, 560);
    c.stroke();
    for (let y = 50; y < 560; y += 14) glowCircle(c, x, y, 3, [[0, '#c8ffff'], [0.5, '#36e0ff'], [1, 'rgba(0,200,255,0)']]);
  }
  // landing chevrons
  c.strokeStyle = 'rgba(255,90,200,0.85)';
  c.lineWidth = 2;
  c.save();
  c.shadowColor = '#ff5ac8';
  c.shadowBlur = 6;
  for (let i = 0; i < 4; i++) {
    const y = 586 - i * 12;
    c.beginPath();
    c.moveTo(RX - 16, y + 6);
    c.lineTo(RX, y);
    c.lineTo(RX + 16, y + 6);
    c.stroke();
  }
  c.restore();
  // hangar doors with hazard trim
  for (const y of [170, 420]) {
    hazard(c, CX - 58, y - 3, 34, 3);
    c.fillStyle = '#1a1f2a';
    c.fillRect(CX - 58, y, 34, 50);
    c.strokeStyle = '#3a4458';
    c.strokeRect(CX - 58, y, 34, 50);
    c.beginPath();
    c.moveTo(CX - 41, y);
    c.lineTo(CX - 41, y + 50);
    c.stroke();
    hazard(c, CX - 58, y + 50, 34, 3);
  }
  // shield emitters along the edges
  for (let y = 100; y < 640; y += 54) {
    for (const x of [CX - 86, CX + 86]) glowCircle(c, x, y, 5, [[0, '#ffffff'], [0.4, '#36e0ff'], [1, 'rgba(0,200,255,0)']]);
  }
  // turret batteries
  for (const [x, y] of [
    [CX - 60, 90],
    [CX + 58, 92],
    [CX - 64, 600],
    [CX + 64, 600],
  ]) {
    c.fillStyle = '#3a4258';
    c.beginPath();
    c.arc(x, y, 7, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ff3ad8';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x - 2, y);
    c.lineTo(x - 2, y - 12);
    c.moveTo(x + 2, y);
    c.lineTo(x + 2, y - 12);
    c.stroke();
  }
  // command tower
  const ix = CX + 62;
  c.fillStyle = '#323a4e';
  c.beginPath();
  c.moveTo(ix - 8, 280);
  c.lineTo(ix + 10, 300);
  c.lineTo(ix + 12, 420);
  c.lineTo(ix - 10, 430);
  c.closePath();
  c.fill();
  c.strokeStyle = '#36e0ff';
  c.lineWidth = 1;
  c.stroke();
  for (let y = 310; y < 420; y += 10) glowCircle(c, ix, y, 2.2, [[0, '#bff'], [1, 'rgba(0,255,255,0)']]);
  glowCircle(c, ix + 1, 296, 6, [[0, '#ffffff'], [0.4, '#ff3ad8'], [1, 'rgba(255,0,200,0)']]);
  // stern thruster blocks
  for (const x of [CX - 40, CX, CX + 40]) {
    c.fillStyle = '#121620';
    c.fillRect(x - 13, 640, 26, 30);
    glowCircle(c, x, 670, 12, [[0, '#ffffff'], [0.35, '#36e0ff'], [1, 'rgba(0,200,255,0)']]);
  }
  // hull marking
  c.fillStyle = 'rgba(200,250,255,0.85)';
  c.font = 'bold 26px "Black Ops One", sans-serif';
  c.textAlign = 'center';
  c.fillText('X1', RX, 620);
  wires(c, RX - 40, RX + 40, [530, 548, 566]);

  // parked fighters
  const fut: PlaneSpec = { len: 30, span: 24, fuseW: 7, wingY: 0.3, chord: 15, tipChord: 4, sweep: 11, tailSpan: 0, tailChord: 0, body: '#d8e2f0', wing: '#c0ccdf', canopy: '#2ef0ff', jet: 2, glow: '#38e8ff', delta: true, side: 'ally', era: 'future' };
  [
    [CX + 46, 140],
    [CX + 46, 176],
    [CX - 40, 300],
    [CX - 40, 336],
    [CX + 40, 470],
  ].forEach(([x, y]) => parkedPlane(c, x, y, 0, fut));
  herks(c, CX - 70, 360, 21, 'future');
  crew(c, r, CX + 30, 230, 6, 20);
}

export function drawCarrierDetailed(c: Ctx, era: Era) {
  if (era === 'ww2') ww2(c);
  else if (era === 'modern') modern(c);
  else future(c);
}

export const CARRIER_RES = 2;
export const CARRIER_SIZE = { w: W, h: H };
