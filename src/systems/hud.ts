import Phaser from 'phaser';
import { D, W, H, FONT, ERAS } from '../data/config';
import { fontLoc } from '../data/i18n';
import { run, prefs, maxArmor, maxBombs } from '../data/state';
import { tk } from '../gfx/textures';
import type { GameScene } from '../scenes/GameScene';

const txt = (scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color = '#ffffff') =>
  scene.add
    .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 4 })
    .setDepth(D.hud)
    .setScrollFactor(0);

export interface TouchButtons {
  bomb: boolean;
  roll: boolean;
  od: boolean;
}

export class Hud {
  private score: Phaser.GameObjects.Text;
  private hi: Phaser.GameObjects.Text;
  private stage: Phaser.GameObjects.Text;
  private weapon: Phaser.GameObjects.Text;
  private g: Phaser.GameObjects.Graphics;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private bossName: Phaser.GameObjects.Text;
  private bannerMain: Phaser.GameObjects.Text;
  private bannerSub: Phaser.GameObjects.Text;
  private odLabel: Phaser.GameObjects.Text;
  private btns: { c: Phaser.GameObjects.Arc; t: Phaser.GameObjects.Text; key: keyof TouchButtons }[] = [];
  touch: TouchButtons = { bomb: false, roll: false, od: false };
  bossRatio = -1;
  shownScore = 0;

  constructor(private scene: GameScene) {
    this.g = scene.add.graphics().setDepth(D.hud);
    this.score = txt(scene, 12, 8, '0', 20);
    this.hi = txt(scene, W / 2, 8, '', 13, '#ffd860').setOrigin(0.5, 0);
    this.stage = txt(scene, W - 12, 8, '', 15, '#9fd8ff').setOrigin(1, 0);
    this.weapon = txt(scene, W - 12, 34, '', 12, '#ffe080').setOrigin(1, 0);
    this.odLabel = txt(scene, W - 12, 64, 'OD', 10, '#ffd040').setOrigin(1, 0);
    this.bossName = txt(scene, W / 2, 86, '', 13, '#ff8080').setOrigin(0.5, 0).setVisible(false);
    this.bannerMain = txt(scene, W / 2, H * 0.4, '', 40, '#ffffff').setOrigin(0.5).setDepth(D.banner).setAlpha(0);
    this.bannerSub = scene.add
      .text(W / 2, H * 0.4 + 40, '', { fontFamily: fontLoc(), fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(D.banner)
      .setAlpha(0);
    for (let i = 0; i < 8; i++) {
      this.lifeIcons.push(scene.add.image(18 + i * 20, 46, tk('player')).setScale(0.26).setDepth(D.hud).setVisible(false));
    }
    if (scene.sys.game.device.input.touch) this.makeTouchButtons();
  }

  private makeTouchButtons() {
    const defs: { key: keyof TouchButtons; label: string; x: number; y: number; col: number }[] = [
      { key: 'bomb', label: 'BOMB', x: 52, y: H - 60, col: 0xa040ff },
      { key: 'roll', label: 'ROLL', x: W - 52, y: H - 60, col: 0x30a0ff },
      { key: 'od', label: 'OD', x: W - 52, y: H - 150, col: 0xffb020 },
    ];
    for (const d of defs) {
      const c = this.scene.add.circle(d.x, d.y, 36, d.col, 0.25).setStrokeStyle(3, d.col, 0.8).setDepth(D.hud).setInteractive();
      const t = txt(this.scene, d.x, d.y, d.label, 13).setOrigin(0.5);
      c.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.touch[d.key] = true;
        this.scene.claimPointer(p.id);
      });
      this.btns.push({ c, t, key: d.key });
    }
  }

  /** Returns true if (x,y) lands on a touch button. */
  isOnButton(x: number, y: number) {
    return this.btns.some((b) => Phaser.Math.Distance.Between(x, y, b.c.x, b.c.y) < 44);
  }

  banner(main: string, sub = '', color = '#ffffff', dur = 1500) {
    const ts = [this.bannerMain, this.bannerSub];
    this.scene.tweens.killTweensOf(ts);
    this.bannerMain.setText(main).setColor(color).setScale(1.6).setAlpha(0);
    this.bannerSub.setText(sub).setAlpha(0);
    this.scene.tweens.add({ targets: this.bannerMain, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 300, delay: 120 });
    this.scene.tweens.add({ targets: ts, alpha: 0, delay: dur, duration: 400 });
  }

  update() {
    const p = this.scene.player;
    const g = this.g;
    g.clear();
    this.shownScore += Math.ceil((run.score - this.shownScore) * 0.25);
    if (Math.abs(run.score - this.shownScore) < 3) this.shownScore = run.score;
    this.score.setText(this.shownScore.toLocaleString());
    this.hi.setText('HI ' + Math.max(prefs.hi(run.era), run.score).toLocaleString());
    this.stage.setText(`STAGE ${run.stage}`);
    this.weapon.setText(`${ERAS[run.era].weapons[run.weapon]}  Lv${run.power}${run.power >= 5 ? ' MAX' : ''}`);

    // lives
    this.lifeIcons.forEach((ic, i) => ic.setVisible(i < Math.min(run.lives, 8)));
    // armour pips
    const ma = maxArmor();
    for (let i = 0; i < ma; i++) {
      const on = i < p.armor;
      g.fillStyle(on ? (p.armor <= 1 ? 0xff4040 : 0x50e070) : 0x203028, 1);
      g.fillRect(12 + i * 16, 60, 13, 7);
    }
    if (p.shield) {
      g.lineStyle(2, 0x60c0ff, 1);
      g.strokeRect(10, 58, ma * 16, 11);
    }
    // bombs
    const mb = Math.max(maxBombs(), run.bombs);
    for (let i = 0; i < mb; i++) {
      g.fillStyle(i < run.bombs ? 0xb060ff : 0x302040, 1);
      g.fillCircle(18 + i * 15, 80, 5);
    }
    // overdrive gauge
    const gw = 110;
    const gx = W - 12 - gw;
    g.fillStyle(0x000000, 0.5);
    g.fillRect(gx - 2, 50, gw + 4, 10);
    const full = p.od >= 100 && p.odT <= 0;
    const blink = full && Math.floor(this.scene.time.now / 150) % 2 === 0;
    g.fillStyle(p.odT > 0 ? 0xffe060 : blink ? 0xffffff : 0xffa020, 1);
    g.fillRect(gx, 52, (gw * p.od) / 100, 6);
    this.odLabel.setText(full ? 'OVERDRIVE READY [C]' : 'OVERDRIVE').setY(62);
    // roll cooldown
    const rc = p.rollCd > 0 ? 1 - p.rollCd / p.rollCooldown : 1;
    g.fillStyle(0x000000, 0.5);
    g.fillRect(gx - 2, 78, gw + 4, 6);
    g.fillStyle(rc >= 1 ? 0x40b0ff : 0x305070, 1);
    g.fillRect(gx, 79, gw * rc, 4);

    // stage progress (right edge)
    const prog = this.scene.progress;
    if (prog >= 0) {
      g.fillStyle(0xffffff, 0.15);
      g.fillRect(W - 4, 100, 2, H - 200);
      g.fillStyle(0x9fd8ff, 0.8);
      g.fillRect(W - 5, 100 + (H - 200) * (1 - prog) - 4, 4, 8);
    }

    // boss bar
    if (this.bossRatio >= 0) {
      this.bossName.setVisible(true);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(40, 104, W - 80, 10);
      g.fillStyle(this.bossRatio < 0.33 ? 0xff3030 : this.bossRatio < 0.66 ? 0xff9a30 : 0xffe040, 1);
      g.fillRect(42, 106, (W - 84) * this.bossRatio, 6);
    } else this.bossName.setVisible(false);

    // touch button states
    for (const b of this.btns) {
      let ready = true;
      if (b.key === 'bomb') ready = run.bombs > 0;
      if (b.key === 'roll') ready = p.rollCd <= 0;
      if (b.key === 'od') ready = p.od >= 100 && p.odT <= 0;
      b.c.setFillStyle(b.c.fillColor, ready ? 0.35 : 0.08);
      b.t.setAlpha(ready ? 1 : 0.35);
    }
  }

  nowPlaying(title: string) {
    const t = this.scene.add
      .text(12, H - 18, `♪ ${title}`, { fontFamily: FONT, fontSize: '12px', color: '#cfe6ff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0, 1)
      .setDepth(D.hud)
      .setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 0.9, x: 16, duration: 500, yoyo: true, hold: 3200, onComplete: () => t.destroy() });
  }

  setBoss(name: string | null) {
    if (name) {
      this.bossName.setText(name);
      this.bossRatio = 1;
    } else this.bossRatio = -1;
  }

  setVisible(v: boolean) {
    for (const o of [this.score, this.hi, this.stage, this.weapon, this.odLabel, this.g]) o.setVisible(v);
    if (!v) this.lifeIcons.forEach((i) => i.setVisible(false));
  }
}
