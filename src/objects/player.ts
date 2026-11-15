import Phaser from 'phaser';
import { D, W, H } from '../data/config';
import { run, maxArmor } from '../data/state';
import { tk } from '../gfx/textures';
import { Sound } from '../audio/sound';
import type { GameScene } from '../scenes/GameScene';

const DEG = Math.PI / 180;
const UP = -Math.PI / 2;

const SPREAD: [number, number][][] = [
  [],
  [[-6, 0], [6, 0]],
  [[-6, 0], [6, 0], [-10, -7], [10, 7]],
  [[-8, 0], [0, 0], [8, 0], [-12, -9], [12, 9]],
  [[-8, 0], [0, 0], [8, 0], [-12, -8], [12, 8], [-14, -17], [14, 17]],
  [[-10, 0], [-3, 0], [3, 0], [10, 0], [-12, -8], [12, 8], [-14, -16], [14, 16], [-16, -25], [16, 25]],
];

const PIERCE: [number, number][][] = [
  [],
  [[0, 0]],
  [[-8, 0], [8, 0]],
  [[0, 0], [-14, -3], [14, 3]],
  [[-6, 0], [6, 0], [-18, -4], [18, 4]],
  [[0, 0], [-10, 0], [10, 0], [-22, -5], [22, 5]],
];

export class Player {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  shieldImg: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image;
  wingmen: { img: Phaser.GameObjects.Image; sh: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  glow: Phaser.FX.Glow | null = null;

  x = W / 2;
  y = H - 140;
  alt = 1;
  control = false;
  alive = true;
  invuln = 0;
  rollT = 0;
  rollCd = 0;
  armor = 3;
  shield = false;
  od = 0;
  odT = 0;
  private fireT = 0;
  private missileT = 0;
  private wingT = 0;
  private bank = 0;
  private side = 1;

  constructor(private scene: GameScene) {
    const add = scene.add;
    this.shadow = add.image(0, 0, tk('player') + '_sh').setDepth(D.shadow);
    this.aura = add.image(0, 0, 'aura').setDepth(D.player - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite = add.image(this.x, this.y, tk('player')).setDepth(D.player);
    this.shieldImg = add.image(0, 0, 'shield').setDepth(D.player + 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.armor = maxArmor();
    this.syncWingmen();
  }

  get speed() {
    return 330 * (1 + 0.07 * run.up.engine);
  }
  get dmgMul() {
    return (1 + 0.12 * run.up.fire) * (this.odT > 0 ? 1.4 : 1);
  }
  get rollCooldown() {
    return 3.6 * (1 - 0.12 * run.up.skill);
  }
  get vulnerable() {
    return this.alive && this.invuln <= 0 && this.rollT <= 0 && this.control;
  }

  syncWingmen() {
    while (this.wingmen.length < run.wingmen) {
      const sh = this.scene.add.image(this.x, this.y, tk('player') + '_sh').setDepth(D.shadow).setScale(0.5);
      const img = this.scene.add.image(this.x, this.y + 60, tk('player')).setDepth(D.player - 1).setScale(0.55);
      this.wingmen.push({ img, sh, x: this.x, y: this.y + 60 });
    }
    while (this.wingmen.length > run.wingmen) {
      const w = this.wingmen.pop()!;
      this.scene.fx.explode(w.img.x, w.img.y, 's');
      w.img.destroy();
      w.sh.destroy();
    }
  }

  setAlt(a: number) {
    this.alt = Phaser.Math.Clamp(a, 0, 1);
  }

  addOd(v: number) {
    if (this.odT > 0) return;
    this.od = Math.min(100, this.od + v * (1 + 0.15 * run.up.skill));
  }

  tryRoll() {
    if (!this.alive || !this.control || this.rollCd > 0 || this.rollT > 0) return;
    this.rollT = 0.75;
    this.rollCd = this.rollCooldown;
    Sound.sfx('roll');
  }

  tryOverdrive() {
    if (!this.alive || !this.control || this.od < 100 || this.odT > 0) return;
    this.odT = 7;
    this.od = 100;
    Sound.sfx('overdrive');
    this.scene.fx.ring(this.x, this.y, 2.5, 500, 0xffd040);
    this.scene.fx.screenFlash(0xffcc40, 0.35, 400);
    this.scene.hud.banner('OVERDRIVE', '', '#ffd040', 900);
    if (this.sprite.preFX && !this.glow) this.glow = this.sprite.preFX.addGlow(0xffc030, 4, 0, false, 0.1, 12);
  }

  update(dt: number, kx: number, ky: number, tdx: number, tdy: number) {
    const s = this.sprite;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.rollCd > 0) this.rollCd -= dt;
    if (this.odT > 0) {
      this.odT -= dt;
      this.od = Math.max(0, (this.odT / 7) * 100);
      if (this.odT <= 0) {
        this.od = 0;
        if (this.glow) {
          s.preFX?.remove(this.glow);
          this.glow = null;
        }
      }
    }

    let vx = 0;
    if (this.alive && this.control) {
      const sp = this.speed * (this.rollT > 0 ? 1.25 : 1);
      const px = this.x;
      this.x += kx * sp * dt + tdx;
      this.y += ky * sp * dt + tdy;
      this.x = Phaser.Math.Clamp(this.x, 22, W - 22);
      this.y = Phaser.Math.Clamp(this.y, 60, H - 34);
      vx = (this.x - px) / Math.max(dt, 0.001);
    }
    this.bank = Phaser.Math.Linear(this.bank, Phaser.Math.Clamp(vx / 300, -1, 1), Math.min(1, dt * 10));

    // visuals
    const base = 0.66 + 0.34 * this.alt;
    let sx = base * (1 - Math.abs(this.bank) * 0.18);
    if (this.rollT > 0) {
      this.rollT -= dt;
      const p = 1 - Math.max(0, this.rollT) / 0.75;
      sx = base * Math.cos(p * Math.PI * 2);
    }
    s.setPosition(this.x, this.y).setScale(sx, base).setVisible(this.alive);
    s.setAlpha(this.invuln > 0 && this.alive ? (Math.floor(this.invuln * 20) % 2 ? 0.35 : 1) : 1);
    this.shadow
      .setPosition(this.x + 8 + 22 * this.alt, this.y + 10 + 36 * this.alt)
      .setScale(sx * (1 - 0.2 * this.alt), base * (1 - 0.2 * this.alt))
      .setVisible(this.alive);
    this.shieldImg.setVisible(this.alive && this.shield).setPosition(this.x, this.y).setRotation(this.shieldImg.rotation + dt * 2);
    this.aura.setVisible(this.alive && this.odT > 0).setPosition(this.x, this.y).setScale(0.9 + Math.sin(this.scene.time.now * 0.02) * 0.1);

    // wingmen follow in formation
    this.wingmen.forEach((w, i) => {
      const tx = this.x + (i === 0 ? -50 : 50);
      const ty = this.y + 26;
      w.x = Phaser.Math.Linear(w.x, tx, Math.min(1, dt * 8));
      w.y = Phaser.Math.Linear(w.y, ty, Math.min(1, dt * 8));
      const sc = 0.55 * base;
      w.img.setPosition(w.x, w.y).setScale(sc * (1 - Math.abs(this.bank) * 0.2), sc).setVisible(this.alive);
      w.sh.setPosition(w.x + 6 + 16 * this.alt, w.y + 8 + 26 * this.alt).setScale(sc * 0.85).setVisible(this.alive);
    });

    if (this.alive && this.control) this.shoot(dt);
  }

  private shoot(dt: number) {
    const sc = this.scene;
    const od = this.odT > 0;
    const rate = od ? 0.55 : 1;
    const dm = this.dmgMul;
    const p = run.power;
    const era = run.era;
    this.fireT -= dt;
    this.missileT -= dt;
    this.wingT -= dt;
    const x = this.x;
    const y = this.y - 26;

    if (this.fireT <= 0) {
      if (run.weapon === 'V') {
        this.fireT = 0.085 * rate;
        for (const [dx, a] of SPREAD[p]) {
          const sh = sc.spawnPShot(tk('pb_main'), x + dx, y, UP + a * DEG, 980, 7, 1 * dm);
          if (era === 'future') sh.setScale(1.1);
        }
        if (od) for (const a of [-34, 34]) sc.spawnPShot(tk('pb_main'), x, y + 10, UP + a * DEG, 900, 7, 1 * dm);
        Sound.sfx(era === 'future' ? 'laser' : 'shot');
      } else if (run.weapon === 'L') {
        this.fireT = 0.11 * rate;
        for (const [dx, a] of PIERCE[p]) {
          const sh = sc.spawnPShot(tk('pb_pierce'), x + dx, y - 10, UP + a * DEG, 1150, 9, 2.1 * dm);
          sh.pierce = true;
          sh.setScale(0.9 + p * 0.12, 1.1);
        }
        Sound.sfx(era === 'ww2' ? 'shotHeavy' : 'laser');
      } else {
        this.fireT = 0.11 * rate;
        for (const dx of [-6, 6]) sc.spawnPShot(tk('pb_main'), x + dx, y, UP, 950, 6, 0.8 * dm).setScale(0.8);
        Sound.sfx('shot');
      }
    }

    if (run.weapon === 'M' && this.missileT <= 0) {
      this.missileT = (0.42 - p * 0.03) * rate;
      const n = Math.min(4, Math.ceil(p / 1.4));
      for (let i = 0; i < n; i++) {
        this.side = -this.side;
        const off = this.side * (14 + i * 8);
        const sh = sc.spawnPShot(tk('pb_homing'), x + off, y + 18, UP + this.side * (25 + i * 15) * DEG, 380, 8, 3.4 * dm);
        sh.homing = true;
        sh.turn = 7;
        sh.accel = 900;
        sh.target = sc.nearestEnemy(sh.x, sh.y);
      }
      Sound.sfx('missile');
    }

    if (this.wingmen.length && this.wingT <= 0) {
      this.wingT = 0.16 * rate;
      for (const w of this.wingmen) {
        if (od) {
          const sh = sc.spawnPShot(tk('pb_homing'), w.x, w.y - 10, UP, 420, 7, 1.6 * dm);
          sh.homing = true;
          sh.turn = 6;
          sh.accel = 700;
          sh.target = sc.nearestEnemy(w.x, w.y);
        } else {
          sc.spawnPShot(tk('pb_wing'), w.x, w.y - 14, UP, 900, 5, 0.8 * dm);
        }
      }
    }
  }

  setTextures() {
    this.sprite.setTexture(tk('player'));
    this.shadow.setTexture(tk('player') + '_sh');
  }
}
