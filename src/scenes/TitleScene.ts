import Phaser from 'phaser';
import { W, H, FONT, FONT_KR, ERAS, type Era } from '../data/config';
import { prefs, resetRun } from '../data/state';
import { THEMES } from '../data/themes';
import { buildWaterTexture, setTextureEra, tk } from '../gfx/textures';
import { Sound } from '../audio/sound';

const ORDER: Era[] = ['ww2', 'modern', 'future'];

export class TitleScene extends Phaser.Scene {
  private era: Era = 'ww2';
  private water!: Phaser.GameObjects.TileSprite;
  private hero!: Phaser.GameObjects.Image;
  private heroSh!: Phaser.GameObjects.Image;
  private cards: { bg: Phaser.GameObjects.Rectangle; plane: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
  private hiText!: Phaser.GameObjects.Text;
  private clouds: Phaser.GameObjects.Image[] = [];
  private audioOn = false;
  private starting = false;

  constructor() {
    super('Title');
  }

  create() {
    this.starting = false;
    this.cards = [];
    this.clouds = [];
    this.era = prefs.era;
    Sound.muted = prefs.muted;
    setTextureEra(this.era);
    buildWaterTexture(this, 'water_0', THEMES[0]);
    this.water = this.add.tileSprite(W / 2, H / 2, W, H, 'water_0');
    for (let i = 0; i < 4; i++) {
      const c = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), `cloud_${i}`).setAlpha(0.5).setScale(1.4).setDepth(5);
      this.clouds.push(c);
    }
    this.heroSh = this.add.image(W / 2 + 40, 470, tk('player') + '_sh').setScale(1.6).setDepth(2);
    this.hero = this.add.image(W / 2, 420, tk('player')).setScale(2).setDepth(3);

    const logo = this.add
      .text(W / 2, 110, 'STEEL WINGS', { fontFamily: FONT, fontSize: '56px', color: '#ffffff', stroke: '#0a1a2a', strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(10);
    logo.setShadow(0, 4, '#000', 8, true, true);
    this.add
      .text(W / 2, 162, 'CARRIER STRIKE  ·  강철의 날개', { fontFamily: FONT_KR, fontSize: '18px', color: '#ffd860', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: logo, scale: 1.04, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });

    // era selector
    this.add.text(W / 2, 560, '시대 선택', { fontFamily: FONT_KR, fontSize: '15px', color: '#9fd8ff' }).setOrigin(0.5).setDepth(10);
    ORDER.forEach((id, i) => {
      const x = W / 2 + (i - 1) * 150;
      const y = 630;
      const bg = this.add.rectangle(x, y, 136, 96, 0x0a1a2a, 0.75).setStrokeStyle(2, 0x406080).setDepth(10).setInteractive({ useHandCursor: true });
      const plane = this.add.image(x, y - 14, `player_${id}`).setScale(0.7).setDepth(11);
      const label = this.add.text(x, y + 22, ERAS[id].ko, { fontFamily: FONT_KR, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(11);
      const sub = this.add.text(x, y + 40, ERAS[id].years, { fontFamily: FONT, fontSize: '11px', color: '#9fb8d0' }).setOrigin(0.5).setDepth(11);
      bg.on('pointerdown', () => {
        this.unlockAudio();
        if (this.era === id) this.start();
        else this.selectEra(id);
      });
      this.cards.push({ bg, plane, label, sub });
    });

    const touch = this.sys.game.device.input.touch;
    const startBtn = this.add
      .text(W / 2, 722, touch ? '▶  TAP TO START' : '▶  PRESS ENTER', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    startBtn.on('pointerdown', () => {
      this.unlockAudio();
      this.start();
    });
    this.tweens.add({ targets: startBtn, alpha: 0.35, yoyo: true, repeat: -1, duration: 650 });

    this.hiText = this.add.text(W / 2, 200, '', { fontFamily: FONT, fontSize: '15px', color: '#ffd860', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(10);
    const help = touch
      ? '드래그: 이동   ·   자동 사격   ·   BOMB / ROLL / OD 버튼'
      : '방향키/WASD 이동 · 자동사격 · X/Space 폭탄 · Z/Shift 회피 · C 오버드라이브 · P 일시정지 · M 음소거';
    this.add
      .text(W / 2, 768, help, { fontFamily: FONT_KR, fontSize: '11px', color: '#cfe6ff', align: 'center', wordWrap: { width: W - 30 } })
      .setOrigin(0.5)
      .setDepth(10);

    const kb = this.input.keyboard!;
    kb.on('keydown', () => this.unlockAudio());
    kb.on('keydown-LEFT', () => this.selectEra(ORDER[(ORDER.indexOf(this.era) + 2) % 3]));
    kb.on('keydown-RIGHT', () => this.selectEra(ORDER[(ORDER.indexOf(this.era) + 1) % 3]));
    kb.on('keydown-A', () => this.selectEra(ORDER[(ORDER.indexOf(this.era) + 2) % 3]));
    kb.on('keydown-D', () => this.selectEra(ORDER[(ORDER.indexOf(this.era) + 1) % 3]));
    kb.on('keydown-ENTER', () => this.start());
    kb.on('keydown-SPACE', () => this.start());
    kb.on('keydown-M', () => {
      prefs.muted = !prefs.muted;
      Sound.setMuted(prefs.muted);
    });
    this.input.on('pointerdown', () => this.unlockAudio());

    this.selectEra(this.era, true);
    this.cameras.main.fadeIn(400);
  }

  private unlockAudio() {
    Sound.init();
    if (!this.audioOn) {
      this.audioOn = true;
      Sound.music(1, this.era, 'title');
    }
  }

  private selectEra(id: Era, silent = false) {
    if (this.starting) return;
    this.era = id;
    prefs.era = id;
    setTextureEra(id);
    this.hero.setTexture(tk('player'));
    this.heroSh.setTexture(tk('player') + '_sh');
    this.cards.forEach((c, i) => {
      const on = ORDER[i] === id;
      c.bg.setStrokeStyle(on ? 3 : 2, on ? 0xffd860 : 0x406080).setFillStyle(on ? 0x1a3450 : 0x0a1a2a, on ? 0.9 : 0.7);
      c.plane.setScale(on ? 0.85 : 0.65).setAlpha(on ? 1 : 0.6);
      c.label.setColor(on ? '#ffd860' : '#ffffff');
    });
    const hi = prefs.hi(id);
    this.hiText.setText(`HI-SCORE  ${hi.toLocaleString()}   ·   ${ERAS[id].label} ${ERAS[id].years}`);
    if (!silent) {
      Sound.sfx('select');
      this.hero.setScale(2.3);
      this.tweens.add({ targets: this.hero, scale: 2, duration: 250, ease: 'Back.easeOut' });
      if (this.audioOn) Sound.music(1, id, 'title');
    }
  }

  private start() {
    if (this.starting) return;
    this.unlockAudio();
    this.starting = true;
    Sound.sfx('confirm');
    Sound.stopMusic(0.6);
    resetRun(this.era);
    if (this.sys.game.device.input.touch && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch {
        /* not supported */
      }
    }
    this.tweens.add({ targets: [this.hero, this.heroSh], y: '-=600', duration: 900, ease: 'Cubic.easeIn' });
    this.cameras.main.fadeOut(900);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }

  override update(_t: number, delta: number) {
    const dt = delta / 1000;
    this.water.tilePositionY -= 60 * dt;
    for (const c of this.clouds) {
      c.y += 110 * dt;
      if (c.y > H + 120) {
        c.y = -120;
        c.x = Phaser.Math.Between(0, W);
      }
    }
    const t = this.time.now / 1000;
    this.hero.x = W / 2 + Math.sin(t * 0.8) * 30;
    this.hero.y = 420 + Math.sin(t * 1.3) * 10;
    this.hero.rotation = Math.cos(t * 0.8) * 0.05;
    if (!this.starting) this.heroSh.setPosition(this.hero.x + 40, this.hero.y + 60);
  }
}
