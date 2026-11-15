import Phaser from 'phaser';
import { W, H } from '../data/config';
import { run } from '../data/state';
import { Sound } from '../audio/sound';
import { themeFor, THEMES } from '../data/themes';
import { Squad, type Behavior, type Enemy } from '../objects/entities';
import { t } from '../data/i18n';
import type { GameScene } from '../scenes/GameScene';

const HALF_PI = Math.PI / 2;

// ------------------------------------------------------------ behaviours

export const straight =
  (vx: number, vy: number): Behavior =>
  (e, dt) => {
    e.x += vx * dt;
    e.y += vy * dt;
  };

export const sine =
  (x0: number, amp: number, f: number, vy: number, ph = 0): Behavior =>
  (e, dt) => {
    e.y += vy * dt;
    e.x = x0 + Math.sin(e.t * f + ph) * amp;
    e.rotation = -Math.cos(e.t * f + ph) * amp * f * 0.0025;
  };

/** Fly along a heading that turns at `turn` rad/s between t0 and t1. */
export const heading =
  (h0: number, speed: number, turn: number, t0 = 0, t1 = 99): Behavior =>
  (e, dt) => {
    if (e.data2.h === undefined) e.data2.h = h0;
    if (e.t > t0 && e.t < t1) e.data2.h += turn * dt;
    e.x += Math.cos(e.data2.h) * speed * dt;
    e.y += Math.sin(e.data2.h) * speed * dt;
    e.rotation = e.data2.h - HALF_PI;
  };

export const dive =
  (scene: GameScene, stopY: number, speed: number): Behavior =>
  (e, dt) => {
    if (e.t < 1.0) {
      e.y += (stopY - e.y) * Math.min(1, dt * 3.5) + 20 * dt;
    } else if (e.t < 1.45) {
      const a = Phaser.Math.Angle.Between(e.x, e.y, scene.player.x, scene.player.y);
      e.rotation = Phaser.Math.Angle.RotateTo(e.rotation, a - HALF_PI, dt * 8);
      e.data2.h = e.rotation + HALF_PI;
    } else {
      e.x += Math.cos(e.data2.h) * speed * dt;
      e.y += Math.sin(e.data2.h) * speed * dt;
    }
  };

export const hover =
  (ty: number, hold: number, drift = 60): Behavior =>
  (e, dt) => {
    if (e.data2.x0 === undefined) e.data2.x0 = e.x;
    if (e.t < hold) {
      e.y += (ty - e.y) * Math.min(1, dt * 1.8);
      e.x = e.data2.x0 + Math.sin(e.t * 0.9) * drift;
    } else {
      e.y += 110 * dt;
    }
  };

export const rise =
  (x0: number, vy: number): Behavior =>
  (e, dt) => {
    e.y -= vy * dt;
    e.x = x0 + Math.sin(e.t * 2.2) * 40;
    e.rotation = Math.PI;
  };

export const ground =
  (scene: GameScene, vx = 0, vy = 0): Behavior =>
  (e, dt) => {
    e.x += vx * dt;
    e.y += (scene.scrollSpeed + vy) * dt;
  };

/** Guided missile: accelerates and steers toward the player for `guide` seconds. */
export const homing =
  (scene: GameScene, v0: number, accel: number, vmax: number, turn: number, guide: number): Behavior =>
  (e, dt) => {
    e.data2.v = Math.min(vmax, (e.data2.v ?? v0) + accel * dt);
    if (e.t < guide && scene.player.alive) {
      const want = Phaser.Math.Angle.Between(e.x, e.y, scene.player.x, scene.player.y);
      e.data2.h = Phaser.Math.Angle.RotateTo(e.data2.h, want, turn * dt);
    }
    e.x += Math.cos(e.data2.h) * e.data2.v * dt;
    e.y += Math.sin(e.data2.h) * e.data2.v * dt;
    e.rotation = e.data2.h - HALF_PI;
  };

/** Vertical loop: circles while the sprite swells (climbing toward the camera) then dives on. */
export const loop =
  (dir: number, speed = 270): Behavior =>
  (e, dt) => {
    if (e.data2.h === undefined) e.data2.h = HALF_PI;
    const t0 = 0.6;
    const dur = (Math.PI * 2) / 3.4;
    if (e.t > t0 && e.t < t0 + dur) {
      e.data2.h += 3.4 * dir * dt;
      const p = (e.t - t0) / dur;
      e.setScale(1 + Math.sin(p * Math.PI) * 0.45);
      if (e.shadow) e.shadow.setScale(0.85 * (1 - Math.sin(p * Math.PI) * 0.3));
    } else e.setScale(1);
    e.x += Math.cos(e.data2.h) * speed * dt;
    e.y += Math.sin(e.data2.h) * speed * dt;
    e.rotation = e.data2.h - HALF_PI;
  };

/** Zigzag with a barrel roll on every direction change. */
export const zigzag =
  (x0: number, amp: number, period: number, vy: number): Behavior =>
  (e, dt) => {
    e.y += vy * dt;
    const ph = (e.t / period) % 1;
    const tri = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    e.x = x0 + tri * amp;
    const near = Math.min(Math.abs(ph - 0.5), Math.min(ph, 1 - ph));
    e.scaleX = near < 0.08 ? Math.cos((near / 0.08) * Math.PI) * -1 : 1;
    e.rotation = (ph < 0.5 ? -1 : 1) * 0.35;
  };

/** Orbit a descending centre point, then break away outward. */
export const orbit =
  (cx: number, cy0: number, r: number, a0: number, w: number, hold: number): Behavior =>
  (e, dt) => {
    if (e.t < hold) {
      const a = a0 + e.t * w;
      const cy = cy0 + e.t * 18;
      const rr = Math.min(r, 40 + e.t * 160);
      e.x = cx + Math.cos(a) * rr;
      e.y = cy + Math.sin(a) * rr;
      e.rotation = a + (w > 0 ? Math.PI : 0);
      e.data2.h = a;
    } else {
      e.x += Math.cos(e.data2.h) * 300 * dt;
      e.y += Math.sin(e.data2.h) * 300 * dt;
      e.rotation = e.data2.h - HALF_PI;
    }
  };

/** Spiral in from a wide radius, then peel off downward. */
export const spiral =
  (cx: number, cy: number, a0: number, dir: number): Behavior =>
  (e, dt) => {
    if (e.t < 3.2) {
      const a = a0 + e.t * 1.9 * dir;
      const r = 320 - e.t * 70;
      e.x = cx + Math.cos(a) * r;
      e.y = cy + Math.sin(a) * r * 0.75;
      e.rotation = a + (dir > 0 ? 0 : Math.PI);
    } else {
      e.y += 280 * dt;
      e.rotation = Phaser.Math.Angle.RotateTo(e.rotation, 0, dt * 4);
    }
  };

/** WWII dive bomber: siren dive toward a target point, bombs away, pull up and climb out. */
export const diveBomb =
  (scene: GameScene, tx: number, ty: number): Behavior =>
  (e, dt) => {
    const st = e.data2.st ?? 0;
    if (st === 0) {
      if (e.data2.h === undefined) {
        e.data2.h = Phaser.Math.Angle.Between(e.x, e.y, tx, ty);
        Sound.sfx('siren');
      }
      e.data2.v = Math.min(420, (e.data2.v ?? 160) + 300 * dt);
      e.setScale(Math.max(0.8, e.scaleY - dt * 0.08));
      if (e.y > ty - 140) {
        e.data2.st = 1;
        scene.dropBombs(e.x, e.y + 10, 3);
      }
    } else {
      e.data2.h = Phaser.Math.Angle.RotateTo(e.data2.h, -HALF_PI, dt * 2.6);
      e.setScale(Math.min(1.25, e.scaleY + dt * 0.3));
    }
    e.x += Math.cos(e.data2.h) * e.data2.v * dt;
    e.y += Math.sin(e.data2.h) * e.data2.v * dt;
    e.rotation = e.data2.h - HALF_PI;
  };

/** Attack helicopter: hover in, strafe sideways, then slip away. */
export const heli =
  (ty: number, hold: number): Behavior =>
  (e, dt) => {
    if (e.data2.x0 === undefined) e.data2.x0 = e.x;
    if (e.t < hold) {
      e.y += (ty - e.y) * Math.min(1, dt * 1.5);
      e.x = e.data2.x0 + Math.sin(e.t * 0.8) * 110;
      e.rotation = Math.sin(e.t * 0.8 + HALF_PI) * 0.2;
    } else {
      e.x += (e.data2.x0 < W / 2 ? -1 : 1) * 220 * dt;
      e.y -= 40 * dt;
    }
  };

// ------------------------------------------------------------ director

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

interface Wave {
  id: string;
  min: number;
  weight: number;
  cost: number;
  run: () => void;
}

interface Ev {
  t: number;
  fn: () => void;
}

export class Director {
  t = 0;
  duration: number;
  finished = false;
  private events: Ev[] = [];
  private s: GameScene;

  constructor(scene: GameScene, private stage: number) {
    this.s = scene;
    const theme = themeFor(stage);
    const r = rng(stage * 1013 + 17);
    this.duration = 58 + Math.min(stage, 12) * 3;
    const waves = this.waves();
    const N = THEMES.length;
    const lvl = Math.min(12, ((stage - 1) % N) + 1) + Math.floor((stage - 1) / N) * 6;
    const avail = waves.filter((w) => w.min <= lvl);
    const gap = Math.max(0.9, 3.0 - stage * 0.14);

    let t = 2.5;
    while (t < this.duration) {
      let pool = avail;
      if (theme.fleet && r() < 0.45) pool = avail.filter((w) => w.id === 'gunboats' || w.id === 'destroyer');
      const total = pool.reduce((a, w) => a + w.weight, 0);
      let k = r() * total;
      let w = pool[0];
      for (const c of pool) {
        k -= c.weight;
        if (k <= 0) {
          w = c;
          break;
        }
      }
      this.events.push({ t, fn: w.run });
      // later stages layer a second simultaneous wave
      if (stage >= 5 && r() < Math.min(0.5, (stage - 4) * 0.07)) {
        const w2 = avail[Math.floor(r() * avail.length)];
        this.events.push({ t: t + 0.6, fn: w2.run });
      }
      t += gap * w.cost * (0.75 + r() * 0.5);
    }

    // scripted game events
    const supplyAt = this.duration * (0.28 + r() * 0.1);
    this.events.push({ t: supplyAt, fn: () => this.s.supplyDrop() });
    if (stage >= 2) this.events.push({ t: this.duration * 0.55, fn: () => this.midBoss() });
    if (stage >= 3 && r() < 0.75) this.events.push({ t: this.duration * (0.7 + r() * 0.15), fn: () => this.ambush() });
    if (r() < 0.6) this.events.push({ t: this.duration * (0.15 + r() * 0.1), fn: () => this.goldSquadron() });
    if (stage >= 4 && r() < 0.5) this.events.push({ t: this.duration * (0.42 + r() * 0.1), fn: () => this.kamikazeRush() });
    this.events.sort((a, b) => a.t - b.t);
  }

  update(dt: number) {
    if (this.finished) return;
    this.t += dt;
    while (this.events.length && this.events[0].t <= this.t) this.events.shift()!.fn();
    if (this.t >= this.duration && this.events.length === 0) {
      const airLeft = this.s.enemies.some((e) => e.active && !e.owner && e.air);
      if (!airLeft || this.t > this.duration + 6) {
        this.finished = true;
        this.s.startBossWarning();
      }
    }
  }

  get progress() {
    return Math.min(1, this.t / this.duration);
  }

  // ------------------------------------------------------------ waves
  private waves(): Wave[] {
    const s = this.s;
    const theme = themeFor(this.stage);
    const rx = (m = 60) => Phaser.Math.Between(m, W - m);
    return [
      {
        id: 'line', min: 1, weight: 3, cost: 1,
        run: () => {
          const x = rx();
          for (let i = 0; i < 5; i++) s.spawnEnemy('fighter', x, -30 - i * 48, straight(0, 210));
        },
      },
      {
        id: 'vform', min: 1, weight: 3, cost: 1.1,
        run: () => {
          const x = rx(110);
          s.spawnEnemy('fighter', x, -30, straight(0, 190));
          for (let i = 1; i <= 2; i++) {
            s.spawnEnemy('fighter', x - i * 36, -30 - i * 32, straight(0, 190));
            s.spawnEnemy('fighter', x + i * 36, -30 - i * 32, straight(0, 190));
          }
        },
      },
      {
        id: 'snake', min: 1, weight: 3, cost: 1.2,
        run: () => {
          const x = rx(140);
          for (let i = 0; i < 6; i++) s.spawnEnemy('fighter', x, -30 - i * 42, sine(x, 110, 2.2, 170, -i * 0.5));
        },
      },
      {
        id: 'swoop', min: 1, weight: 2, cost: 1,
        run: () => {
          const left = Math.random() < 0.5;
          for (let i = 0; i < 4; i++) {
            s.spawnEnemy('fighter', left ? 70 : W - 70, -30 - i * 50, heading(HALF_PI, 270, left ? -1.3 : 1.3, 0.5 + i * 0.18, 2.6 + i * 0.18));
          }
        },
      },
      {
        id: 'redSquad', min: 1, weight: 2, cost: 1.3,
        run: () => {
          const x = rx(140);
          const reward = Math.random() < 0.6 ? 'P' : ['V', 'L', 'M'][Phaser.Math.Between(0, 2)];
          const sq = new Squad(5, reward);
          for (let i = 0; i < 5; i++) {
            const e = s.spawnEnemy('red', x, -30 - i * 40, sine(x, 140, 1.6, 150, -i * 0.45));
            e.squad = sq;
          }
        },
      },
      {
        id: 'heavyPair', min: 1, weight: 1.5, cost: 1.6,
        run: () => {
          s.spawnEnemy('heavy', 130, -60, hover(170, 7, 50));
          s.spawnEnemy('heavy', W - 130, -60, hover(200, 7, 50));
        },
      },
      {
        id: 'gunboats', min: 1, weight: 1.5, cost: 1,
        run: () => {
          if (s.world.isLandAt(-80)) return this.landWave(false);
          const n = Phaser.Math.Between(2, 3);
          for (let i = 0; i < n; i++) s.spawnEnemy('gunboat', 70 + Math.random() * (W - 140), -60 - i * 110, ground(s, 0, -20));
        },
      },
      {
        id: 'crossers', min: 2, weight: 2, cost: 1,
        run: () => {
          const fromLeft = Math.random() < 0.5;
          const y = Phaser.Math.Between(90, 240);
          for (let i = 0; i < 4; i++) {
            const x = fromLeft ? -30 - i * 50 : W + 30 + i * 50;
            s.spawnEnemy('fighter', x, y + i * 10, heading(fromLeft ? 0.12 : Math.PI - 0.12, 260, 0));
          }
        },
      },
      {
        id: 'bomberEscort', min: 2, weight: 1.3, cost: 2.2,
        run: () => {
          const x = rx(120);
          const b = s.spawnEnemy('bomber', x, -70, straight(0, 55));
          b.drop = Math.random() < 0.5 ? 'B' : 'P';
          for (const dx of [-80, 80]) s.spawnEnemy('fighter', x + dx, -40, straight(0, 55)).fireEvery = 1.4;
        },
      },
      {
        id: 'aceRaid', min: 3, weight: 1.4, cost: 1.4,
        run: () => {
          for (let i = 0; i < 3; i++) {
            const x = 100 + i * 140;
            s.spawnEnemy('ace', x, -40 - i * 30, heading(HALF_PI, 300, i % 2 ? 4 : -4, 0.8, 0.8 + (Math.PI * 2) / 4));
          }
        },
      },
      {
        id: 'destroyer', min: 3, weight: 1.2, cost: 1.8,
        run: () => {
          if (s.world.isLandAt(-80)) return this.landWave(true);
          const d = s.spawnEnemy('destroyer', rx(90), -110, ground(s, 0, -25));
          d.drop = Math.random() < 0.4 ? 'S' : null;
          s.spawnEnemy('gunboat', rx(), -260, ground(s, 0, -10));
        },
      },
      {
        id: 'kamikaze', min: 4, weight: 1.2, cost: 1,
        run: () => {
          for (let i = 0; i < 4; i++) s.spawnEnemy('kamikaze', 70 + i * 113, -30 - (i % 2) * 40, dive(s, 110 + (i % 2) * 40, 420));
        },
      },
      {
        id: 'landStrike', min: 1, weight: theme.land ? 3 : 0, cost: 1.2,
        run: () => {
          if (s.world.isLandAt(-80)) this.landWave(Math.random() < 0.4);
          else for (let i = 0; i < 5; i++) s.spawnEnemy('fighter', 60 + i * 90, -30 - (i % 2) * 40, straight(0, 200));
        },
      },
      {
        id: 'zigzag', min: 1, weight: 2, cost: 1.1,
        run: () => {
          const x = rx(120);
          for (let i = 0; i < 4; i++) s.spawnEnemy('fighter', x, -30 - i * 55, zigzag(x, 90, 1.6, 170)).fireEvery = 2;
        },
      },
      {
        id: 'pincer', min: 2, weight: 2, cost: 1.3,
        run: () => {
          for (let i = 0; i < 3; i++) {
            s.spawnEnemy('fighter', -30, 60 + i * 50, heading(0.55, 250, 0));
            s.spawnEnemy('fighter', W + 30, 60 + i * 50, heading(Math.PI - 0.55, 250, 0));
          }
        },
      },
      {
        id: 'loopers', min: 2, weight: 1.6, cost: 1.3,
        run: () => {
          for (let i = 0; i < 3; i++) s.spawnEnemy(i === 1 ? 'ace' : 'fighter', 110 + i * 130, -40 - i * 30, loop(i % 2 ? 1 : -1));
        },
      },
      {
        id: 'gunships', min: 2, weight: 1.6, cost: 1.6,
        run: () => {
          if (run.era === 'ww2') {
            for (let i = 0; i < 3; i++) {
              s.time.delayedCall(i * 500, () =>
                s.spawnEnemy('gunship', Phaser.Math.Between(60, W - 60), -40, diveBomb(s, Phaser.Math.Clamp(s.player.x + Phaser.Math.Between(-60, 60), 40, W - 40), s.player.y)),
              );
            }
          } else if (run.era === 'modern') {
            s.spawnEnemy('gunship', 120, -50, heli(150, 7));
            s.spawnEnemy('gunship', W - 120, -80, heli(210, 7.5));
          } else {
            const x = rx(130);
            for (let i = 0; i < 7; i++) s.spawnEnemy('gunship', x, -30 - i * 36, sine(x, 120, 3, 230, -i * 0.6)).setScale(0.6);
          }
        },
      },
      {
        id: 'strafe', min: 3, weight: 1.3, cost: 1.2,
        run: () => {
          const x = Phaser.Math.Clamp(s.player.x, 60, W - 60);
          for (const dx of [-40, 40]) {
            const e = s.spawnEnemy('heavy', x + dx, -60, straight(0, 360));
            e.fire = (en) => s.stream(en, 8, 0.07, 280 * s.diff.bulletSpeed, 'eb_needle');
            e.fireT = 0.3;
            e.fireEvery = 9;
          }
        },
      },
      {
        id: 'circle', min: 4, weight: 1.2, cost: 1.8,
        run: () => {
          const cx = rx(150);
          for (let i = 0; i < 8; i++) {
            const e = s.spawnEnemy('fighter', cx, -40, orbit(cx, 160, 120, (i / 8) * Math.PI * 2, 1.4, 5.5));
            e.fire = (en) => s.eShot(en.x, en.y, en.data2.h, 150 * s.diff.bulletSpeed, 'eb_blue');
            e.fireEvery = 1.2;
          }
        },
      },
      {
        id: 'spiral', min: 5, weight: 1.1, cost: 1.6,
        run: () => {
          const dir = Math.random() < 0.5 ? 1 : -1;
          for (let i = 0; i < 6; i++) s.spawnEnemy('fighter', -100, -100, spiral(W / 2, 220, (i / 6) * Math.PI * 2, dir));
        },
      },
      {
        id: 'groundAssault', min: 1, weight: theme.land ? 2.6 : 0, cost: 1.4,
        run: () => {
          if (!s.world.isLandAt(-80)) return;
          const kind = Phaser.Utils.Array.GetRandom(['sam', 'infantry', 'convoy', 'aanest']) as string;
          if (kind === 'sam') {
            s.spawnEnemy('sam', rx(80), -80, ground(s));
            for (let i = 0; i < 2; i++) s.spawnEnemy('infantry', rx(60), -40 - i * 120, ground(s, 0, -8));
          } else if (kind === 'infantry') {
            for (let i = 0; i < 4; i++) s.spawnEnemy('infantry', 60 + i * 120, -40 - (i % 2) * 70, ground(s, 0, -10));
          } else if (kind === 'convoy') {
            const x = rx(80);
            for (let i = 0; i < 4; i++) s.spawnEnemy('truck', x, -60 - i * 80, ground(s, 0, -40));
            s.spawnEnemy('aagun', x + (x < W / 2 ? 110 : -110), -120, ground(s));
          } else {
            for (let i = 0; i < 3; i++) s.spawnEnemy('aagun', 90 + i * 150, -60 - (i % 2) * 60, ground(s));
          }
        },
      },
      {
        id: 'heavyLine', min: 6, weight: 1, cost: 2,
        run: () => {
          for (let i = 0; i < 3; i++) s.spawnEnemy('heavy', 90 + i * 150, -60 - i * 40, hover(140 + i * 30, 6, 30));
        },
      },
      {
        id: 'aceHunt', min: 7, weight: 1, cost: 1.6,
        run: () => {
          for (let i = 0; i < 2; i++) s.spawnEnemy('ace', i ? W - 60 : 60, -40, dive(s, 160, 460));
        },
      },
    ];
  }

  /** Ground forces over land: tank columns and flak emplacements. */
  private landWave(heavy: boolean) {
    const s = this.s;
    if (Math.random() < 0.35) {
      // SAM site with infantry escort
      s.spawnEnemy('sam', Phaser.Math.Between(70, W - 70), -80, ground(s));
      s.spawnEnemy('infantry', Phaser.Math.Between(60, W - 60), -150, ground(s, 0, -8));
      return;
    }
    if (heavy) {
      for (let i = 0; i < 2; i++) s.spawnEnemy('flak', 90 + Math.random() * (W - 180), -60 - i * 160, ground(s));
      s.spawnEnemy('tank', Phaser.Math.Between(60, W - 60), -80, ground(s, 0, -25));
    } else {
      const x = Phaser.Math.Between(70, W - 70);
      const dir = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const e = s.spawnEnemy('tank', x + i * 26 * dir, -50 - i * 70, ground(s, dir * 18, -30));
        e.rotation = dir * 0.25;
      }
    }
  }

  // ------------------------------------------------------------ events
  private midBoss() {
    const s = this.s;
    s.hud.banner('MID BOSS', t('midBoss'), '#ff7040', 1600);
    const e: Enemy = s.spawnEnemy('bomber', W / 2, -90, hover(170, 13, 90));
    e.hp = e.maxHp = e.hp * 4;
    e.score *= 4;
    e.fireEvery = 1.4;
    e.drop = 'P';
    e.data2.mid = 1;
    for (const dx of [-110, 110]) s.spawnEnemy('heavy', W / 2 + dx, -120, hover(240, 12, 40));
  }

  private ambush() {
    const s = this.s;
    s.hud.banner('AMBUSH!', t('ambush'), '#ff4060', 1400);
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 72;
      const e = s.spawnEnemy('fighter', x, H + 40 + (i % 2) * 60, rise(x, 300));
      e.fireEvery = 9;
    }
  }

  private goldSquadron() {
    const s = this.s;
    s.hud.banner('GOLD SQUADRON', t('gold'), '#ffd040', 1300);
    for (let i = 0; i < 8; i++) {
      const left = i % 2 === 0;
      const e = s.spawnEnemy('red', left ? 80 : W - 80, -30 - Math.floor(i / 2) * 60, heading(HALF_PI, 240, left ? -0.9 : 0.9, 0.4, 2.4));
      e.drop = 'medal';
      e.fire = null;
    }
  }

  private kamikazeRush() {
    const s = this.s;
    s.hud.banner('SUICIDE RUSH', t('rush'), '#ff4060', 1300);
    for (let i = 0; i < 8; i++) {
      s.time.delayedCall(i * 220, () => {
        s.spawnEnemy('kamikaze', Phaser.Math.Between(40, W - 40), -30, dive(s, Phaser.Math.Between(80, 180), 480));
      });
    }
  }
}
