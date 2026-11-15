import Phaser from 'phaser';
import { W, H, FONT } from '../data/config';
import { t, themeName, fontLoc, type StrKey } from '../data/i18n';
import { MISC_STYLES } from '../audio/styles';
import { run, UPGRADE_DEFS, upgradeCost, maxBombs, prefs } from '../data/state';
import { themeFor, loopOf } from '../data/themes';
import { tk } from '../gfx/textures';
import { Sound } from '../audio/sound';

interface Row {
  label: string;
  sub: () => string;
  cost: () => number | null;
  buy: () => void;
  y: number;
  bg?: Phaser.GameObjects.Rectangle;
  t1?: Phaser.GameObjects.Text;
  t2?: Phaser.GameObjects.Text;
  t3?: Phaser.GameObjects.Text;
}

export class HangarScene extends Phaser.Scene {
  private rows: Row[] = [];
  private sel = 0;
  private credits!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super('Hangar');
  }

  create() {
    this.leaving = false;
    this.sel = 0;
    const next = run.stage + 1;
    const th = themeFor(next);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1622);
    // deck stripes
    const g = this.add.graphics();
    g.fillStyle(0x13222f, 1);
    for (let y = 0; y < H; y += 40) g.fillRect(0, y, W, 20);
    g.lineStyle(3, 0xffd23a, 0.25);
    g.lineBetween(W / 2, 0, W / 2, H);
    this.add.image(W / 2, 150, tk('player')).setScale(1.6);
    this.add.text(W / 2, 34, 'HANGAR', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(W / 2, 70, t('hangarSub'), { fontFamily: fontLoc(), fontSize: '15px', color: '#9fd8ff' }).setOrigin(0.5);
    this.credits = this.add.text(W / 2, 222, '', { fontFamily: FONT, fontSize: '22px', color: '#ffd040', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    this.rows = [];
    let y = 270;
    for (const d of UPGRADE_DEFS) {
      const nk = ('up' + d.id[0].toUpperCase() + d.id.slice(1)) as StrKey;
      this.rows.push({
        label: `${t(nk)}  ${d.name}`,
        sub: () => `${t((nk + 'D') as StrKey)}   ${'■'.repeat(run.up[d.id])}${'□'.repeat(d.max - run.up[d.id])}`,
        cost: () => (run.up[d.id] >= d.max ? null : upgradeCost(d.id, run.up[d.id])),
        buy: () => run.up[d.id]++,
        y,
      });
      y += 58;
    }
    this.rows.push({
      label: `${t('buyBomb')}  BOMB`,
      sub: () => t('owned', run.bombs, maxBombs()),
      cost: () => (run.bombs >= maxBombs() ? null : 300),
      buy: () => run.bombs++,
      y,
    });
    y += 58;
    this.rows.push({
      label: `${t('buyWing')}  WINGMAN`,
      sub: () => t('owned', run.wingmen, 2),
      cost: () => (run.wingmen >= 2 ? null : 900),
      buy: () => run.wingmen++,
      y,
    });

    for (const r of this.rows) {
      r.bg = this.add.rectangle(W / 2, r.y, W - 30, 52, 0x0f2436, 0.95).setStrokeStyle(2, 0x2a4a66).setInteractive({ useHandCursor: true });
      r.t1 = this.add.text(28, r.y - 18, r.label, { fontFamily: fontLoc(), fontSize: '16px', color: '#ffffff' });
      r.t2 = this.add.text(28, r.y + 4, '', { fontFamily: fontLoc(), fontSize: '12px', color: '#9fb8d0' });
      r.t3 = this.add.text(W - 28, r.y, '', { fontFamily: FONT, fontSize: '16px', color: '#ffd040' }).setOrigin(1, 0.5);
      const idx = this.rows.indexOf(r);
      r.bg.on('pointerdown', () => {
        Sound.init();
        if (this.sel === idx) this.purchase();
        else {
          this.sel = idx;
          Sound.sfx('select');
          this.refresh();
        }
      });
    }

    const touch = this.sys.game.device.input.touch;
    const loop = loopOf(next);
    this.add
      .text(W / 2, H - 112, `${t('next', next, themeName(th))}${loop > 1 ? ` (${t('loop', loop)})` : ''}`, { fontFamily: fontLoc(), fontSize: '16px', color: '#cfe6ff' })
      .setOrigin(0.5);
    const go = this.add
      .text(W / 2, H - 70, t('sortie'), { fontFamily: fontLoc(), fontSize: '26px', color: '#ffffff', backgroundColor: '#b03020', padding: { x: 22, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    go.on('pointerdown', () => this.sortie());
    this.tweens.add({ targets: go, scale: 1.05, yoyo: true, repeat: -1, duration: 600 });
    this.add
      .text(W / 2, H - 24, touch ? t('hangarTouch') : t('hangarKeys'), { fontFamily: fontLoc(), fontSize: '12px', color: '#7f98b0' })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-W', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-ENTER', () => this.purchase());
    kb.on('keydown-S', () => this.sortie());
    kb.on('keydown-SPACE', () => this.sortie());
    kb.on('keydown-M', () => {
      prefs.muted = !prefs.muted;
      Sound.setMuted(prefs.muted);
    });

    Sound.music('hangar', MISC_STYLES.hangar, 7, run.era);
    this.refresh();
    this.cameras.main.fadeIn(400);
  }

  private move(d: number) {
    this.sel = (this.sel + d + this.rows.length) % this.rows.length;
    Sound.sfx('select');
    this.refresh();
  }

  private purchase() {
    const r = this.rows[this.sel];
    const c = r.cost();
    if (c === null || run.credits < c) {
      Sound.sfx('deny');
      this.cameras.main.shake(120, 0.004);
      return;
    }
    run.credits -= c;
    r.buy();
    Sound.sfx('power');
    this.tweens.add({ targets: r.bg, scaleX: 1.04, yoyo: true, duration: 90 });
    this.refresh();
  }

  private refresh() {
    this.credits.setText(`CREDITS  ${run.credits.toLocaleString()} CR`);
    this.rows.forEach((r, i) => {
      const c = r.cost();
      const on = i === this.sel;
      r.bg!.setStrokeStyle(on ? 3 : 2, on ? 0xffd860 : 0x2a4a66).setFillStyle(on ? 0x1a3a56 : 0x0f2436, 0.95);
      r.t2!.setText(r.sub());
      r.t3!.setText(c === null ? 'MAX' : `${c.toLocaleString()} CR`).setColor(c === null ? '#60ff90' : run.credits >= c ? '#ffd040' : '#7a6a50');
    });
  }

  private sortie() {
    if (this.leaving) return;
    this.leaving = true;
    Sound.sfx('confirm');
    Sound.stopMusic(0.5);
    run.stage++;
    this.cameras.main.fadeOut(500);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }
}
