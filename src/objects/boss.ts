import Phaser from 'phaser';
import { D, W, ERAS } from '../data/config';
import { run } from '../data/state';
import { difficulty, type BossKind } from '../data/themes';
import { tk } from '../gfx/textures';
import type { Enemy } from './entities';
import type { GameScene } from '../scenes/GameScene';

interface PartSpec {
  tex: string;
  ox: number;
  oy: number;
  hp: number;
  role: 'turret' | 'big' | 'aa' | 'pod';
}

export class Boss {
  core: Enemy;
  parts: Enemy[] = [];
  shadow: Phaser.GameObjects.Image | null = null;
  name: string;
  x = W / 2;
  y = -200;
  t = 0;
  rot = 0;
  dead = false;
  private timers: Record<string, number> = {};
  private spin = 0;
  private homeY: number;
  private bs: number;
  private fr: number;
  private extra: number;

  constructor(
    private scene: GameScene,
    public kind: BossKind,
    stage: number,
  ) {
    const d = difficulty(stage);
    this.bs = d.bulletSpeed;
    this.fr = d.fireRate;
    this.extra = d.extraBullets;
    const finalBoost = stage % 12 === 0 ? 1.35 : 1;
    const hpMul = d.bossHp * finalBoost;
    this.name = ERAS[run.era].bossNames[kind];

    let coreTex = '';
    let coreHp = 0;
    let hw = 0;
    let hh = 0;
    let parts: PartSpec[] = [];
    let air = true;
    if (kind === 'bomber') {
      coreTex = tk('boss_bomber');
      coreHp = 520;
      hw = 150;
      hh = 40;
      this.y = -140;
      this.homeY = 165;
      parts = [
        { tex: tk('turret'), ox: -62, oy: 14, hp: 60, role: 'turret' },
        { tex: tk('turret'), ox: 62, oy: 14, hp: 60, role: 'turret' },
        { tex: tk('turret'), ox: -128, oy: 8, hp: 60, role: 'turret' },
        { tex: tk('turret'), ox: 128, oy: 8, hp: 60, role: 'turret' },
        { tex: tk('turret_big'), ox: 0, oy: 50, hp: 90, role: 'big' },
      ];
    } else if (kind === 'ship') {
      coreTex = tk('boss_ship');
      coreHp = 600;
      hw = 64;
      hh = 210;
      air = false;
      this.y = -260;
      this.homeY = 250;
      parts = [
        { tex: tk('turret_big'), ox: 0, oy: 163, hp: 90, role: 'big' },
        { tex: tk('turret_big'), ox: 0, oy: 106, hp: 90, role: 'big' },
        { tex: tk('turret_big'), ox: 0, oy: -106, hp: 90, role: 'big' },
        { tex: tk('turret_big'), ox: 0, oy: -163, hp: 90, role: 'big' },
        { tex: tk('turret'), ox: -52, oy: -40, hp: 50, role: 'aa' },
        { tex: tk('turret'), ox: 52, oy: -40, hp: 50, role: 'aa' },
        { tex: tk('turret'), ox: -52, oy: 40, hp: 50, role: 'aa' },
        { tex: tk('turret'), ox: 52, oy: 40, hp: 50, role: 'aa' },
      ];
    } else {
      coreTex = tk('boss_fortress');
      coreHp = 700;
      hw = 90;
      hh = 90;
      this.y = -180;
      this.homeY = 210;
      parts = [
        { tex: tk('pod'), ox: -128, oy: -110, hp: 110, role: 'pod' },
        { tex: tk('pod'), ox: 128, oy: -110, hp: 110, role: 'pod' },
        { tex: tk('pod'), ox: -128, oy: 110, hp: 110, role: 'pod' },
        { tex: tk('pod'), ox: 128, oy: 110, hp: 110, role: 'pod' },
      ];
    }

    if (air) {
      this.shadow = scene.add.image(this.x, this.y, coreTex + '_sh').setDepth(D.shadow).setScale(0.85);
    }
    const core = scene.spawnBossPiece(coreTex, coreHp * hpMul, hw, hh, air ? D.enemyAir : D.ground);
    core.kind = 'core';
    core.owner = this;
    core.score = 30000 * Math.ceil(stage / 3);
    this.core = core;
    for (const p of parts) {
      const e = scene.spawnBossPiece(p.tex, p.hp * hpMul, p.role === 'pod' ? 34 : p.role === 'big' ? 18 : 13, p.role === 'pod' ? 34 : p.role === 'big' ? 18 : 13, (air ? D.enemyAir : D.ground) + 1);
      e.kind = 'part';
      e.owner = this;
      e.ox = p.ox;
      e.oy = p.oy;
      e.data2.role = ['turret', 'big', 'aa', 'pod'].indexOf(p.role);
      e.score = 2000;
      this.parts.push(e);
    }
    this.place();
  }

  get hpRatio() {
    return Math.max(0, this.core.hp / this.core.maxHp);
  }

  get phase() {
    const r = this.hpRatio;
    return r > 0.66 ? 0 : r > 0.33 ? 1 : 2;
  }

  get entering() {
    return this.t < 3.2;
  }

  onPartKilled(e: Enemy) {
    if (e === this.core) {
      this.dead = true;
      this.scene.bossDefeated(this);
      return;
    }
    this.parts = this.parts.filter((p) => p !== e);
  }

  private place() {
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    this.core.setPosition(this.x, this.y);
    if (this.kind === 'fortress') this.core.setRotation(this.rot);
    this.shadow?.setPosition(this.x + 40, this.y + 70).setRotation(this.core.rotation);
    for (const p of this.parts) {
      const ox = p.ox * c - p.oy * s;
      const oy = p.ox * s + p.oy * c;
      p.setPosition(this.x + ox, this.y + oy);
    }
  }

  private every(key: string, sec: number, dt: number) {
    this.timers[key] = (this.timers[key] ?? Math.random() * sec) - dt * this.fr;
    if (this.timers[key] <= 0) {
      this.timers[key] += sec;
      return true;
    }
    return false;
  }

  update(dt: number) {
    if (this.dead) return;
    this.t += dt;
    const sc = this.scene;
    const pl = sc.player;
    if (this.entering) {
      const p = Phaser.Math.Easing.Cubic.Out(Math.min(1, this.t / 3.2));
      this.y = Phaser.Math.Linear(this.kind === 'ship' ? -260 : -180, this.homeY, p);
      this.core.invuln = true;
    } else {
      this.core.invuln = false;
      const tt = this.t - 3.2;
      if (this.kind === 'bomber') {
        this.x = W / 2 + Math.sin(tt * 0.45) * 90;
        this.y = this.homeY + Math.sin(tt * 0.9) * 22;
      } else if (this.kind === 'ship') {
        this.x = W / 2 + Math.sin(tt * 0.3) * 60;
        this.y = this.homeY + Math.sin(tt * 0.5) * 24;
        if (Math.random() < 0.3) sc.fx.wake(this.x + Phaser.Math.Between(-70, 70), this.y - 230, 1);
      } else {
        this.x = W / 2 + Math.sin(tt * 0.5) * 80;
        this.y = this.homeY + Math.sin(tt * 1.0) * 40;
        this.rot += dt * (0.25 + this.phase * 0.15);
      }
    }
    this.place();
    for (const p of this.parts) {
      const role = p.data2.role;
      if (role === 3) p.rotation += dt * 6;
      else p.rotation = Phaser.Math.Angle.Between(p.x, p.y, pl.x, pl.y) + Math.PI / 2;
    }
    if (this.entering || !pl.alive) return;
    this.attack(dt);
  }

  private attack(dt: number) {
    const sc = this.scene;
    const ph = this.phase;
    const bs = this.bs;
    const ex = this.extra;
    const x = this.x;
    const y = this.y;

    for (const p of this.parts) {
      const role = p.data2.role;
      if (role === 0 && this.every('t' + p.ox, 1.6, dt)) sc.burst(p.x, p.y, 3, 0.1, 190 * bs, 'eb_orb');
      if (role === 1 && this.every('b' + p.oy, this.kind === 'ship' ? 2.4 : 2.0, dt)) sc.fan(p.x, p.y, 3 + (ph > 0 ? 2 : 0), 24, 150 * bs, 'eb_big');
      if (role === 2 && this.every('a' + p.ox + p.oy, 1.0, dt)) sc.fan(p.x, p.y, 1, 0, 260 * bs, 'eb_needle');
      if (role === 3 && this.every('p' + p.ox + p.oy, 2.2 - ph * 0.4, dt)) sc.ring(p.x, p.y, 8 + ex, 140 * bs, this.t, 'eb_blue');
    }

    if (this.kind === 'bomber') {
      if (this.every('fan', 1.8, dt)) sc.fan(x, y + 40, 5 + ex, 60, 170 * bs, 'eb_orb');
      if (ph >= 1 && this.every('ring', 1.5, dt)) sc.ring(x, y, 18 + ex * 2, 150 * bs, this.t * 0.7, 'eb_blue');
      if (ph >= 2 && this.every('spiral', 0.09, dt)) {
        this.spin += 0.31;
        for (let k = 0; k < 2; k++) sc.eShot(x, y + 20, this.spin + k * Math.PI, 160 * bs, 'eb_needle');
      }
    } else if (this.kind === 'ship') {
      if (ph >= 1 && this.every('ring', 2.0, dt)) sc.ring(x, y, 20 + ex * 2, 140 * bs, this.t, 'eb_orb');
      if (ph >= 1 && this.every('needle', 0.8, dt)) sc.fan(x, y + 200, 3, 18, 240 * bs, 'eb_needle');
      if (ph >= 2 && this.every('spiral', 0.08, dt)) {
        this.spin += 0.27;
        sc.eShot(x, y, this.spin, 150 * bs, 'eb_blue');
        sc.eShot(x, y, -this.spin, 150 * bs, 'eb_blue');
      }
    } else {
      if (this.every('flower', 0.75 - ph * 0.12, dt)) {
        this.spin += 0.22;
        sc.ring(x, y, 10 + ex, 140 * bs, this.spin, 'eb_orb');
      }
      if (ph >= 1 && this.every('fan', 1.5, dt)) sc.fan(x, y, 7 + ex, 70, 210 * bs, 'eb_needle');
      if (ph >= 2 && this.every('spiral', 0.11, dt)) {
        this.spin += 0.19;
        for (let k = 0; k < 3; k++) sc.eShot(x, y, this.spin * 1.6 + (k * Math.PI * 2) / 3, 175 * bs, 'eb_blue');
      }
      if (ph >= 2 && this.every('big', 2.4, dt)) sc.fan(x, y, 3, 30, 120 * bs, 'eb_big');
    }
  }

  destroyVisuals() {
    this.shadow?.destroy();
  }
}
