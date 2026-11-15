import Phaser from 'phaser';
import { W, H, FONT, ERAS, type Era } from '../data/config';
import { prefs, resetRun } from '../data/state';
import { THEMES } from '../data/themes';
import { LANGS, getLang, setLang, t, eraName, fontLoc, FONT_ANY, type Lang } from '../data/i18n';
import { fetchTop, type ScoreRow } from '../net/leaderboard';
import { buildWaterTexture, setTextureEra, tk } from '../gfx/textures';
import { buildSpaceBackground } from '../gfx/space';
import { Sound } from '../audio/sound';
import { MISC_STYLES } from '../audio/styles';

const ORDER: Era[] = ['ww2', 'modern', 'future'];

export class TitleScene extends Phaser.Scene {
  private era: Era = 'ww2';
  private water!: Phaser.GameObjects.TileSprite;
  private hero!: Phaser.GameObjects.Image;
  private heroSh!: Phaser.GameObjects.Image;
  private cards: { bg: Phaser.GameObjects.Rectangle; plane: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];
  private langBtns: { id: Lang; txt: Phaser.GameObjects.Text }[] = [];
  private hiText!: Phaser.GameObjects.Text;
  private clouds: Phaser.GameObjects.Image[] = [];
  private stars!: Phaser.GameObjects.TileSprite;
  private planet!: Phaser.GameObjects.Image;
  private tint!: Phaser.GameObjects.Rectangle;
  private audioOn = false;
  private boardObjs: Phaser.GameObjects.GameObject[] = [];
  private boardOn = true;
  private cycleT = 0;
  private boardReq = 0;
  private starting = false;

  constructor() {
    super('Title');
  }

  create() {
    this.starting = false;
    this.boardObjs = [];
    this.boardOn = true;
    this.cycleT = 0;
    this.cards = [];
    this.langBtns = [];
    this.clouds = [];
    this.era = prefs.era;
    Sound.muted = prefs.muted;
    setTextureEra(this.era);
    buildWaterTexture(this, 'water_0', THEMES[0]);
    buildSpaceBackground(this, 'space_title', THEMES[THEMES.length - 1]);
    this.water = this.add.tileSprite(W / 2, H / 2, W, H, 'water_0');
    this.stars = this.add.tileSprite(W / 2, H / 2, W, H, 'stars_near').setDepth(0.5);
    this.planet = this.add.image(W - 90, 300, 'planet_2').setScale(0.8).setDepth(0.6);
    this.tint = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(1);
    for (let i = 0; i < 4; i++) {
      this.clouds.push(this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), `cloud_${i}`).setAlpha(0.5).setScale(1.4).setDepth(5));
    }
    this.heroSh = this.add.image(W / 2 + 40, 470, tk('player') + '_sh').setScale(1.6).setDepth(2);
    this.hero = this.add.image(W / 2, 420, tk('player')).setScale(2).setDepth(3);

    const logo = this.add
      .text(W / 2, 100, 'STEEL WINGS', { fontFamily: FONT, fontSize: '56px', color: '#ffffff', stroke: '#0a1a2a', strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(10);
    logo.setShadow(0, 4, '#000', 8, true, true);
    this.add
      .text(W / 2, 152, t('subtitle'), { fontFamily: fontLoc(), fontSize: '18px', color: '#ffd860', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: logo, scale: 1.04, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    this.hiText = this.add.text(W / 2, 188, '', { fontFamily: FONT, fontSize: '14px', color: '#ffd860', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(10);

    // language selector
    LANGS.forEach((l, i) => {
      const txt = this.add
        .text(W / 2 + (i - 1) * 92, 228, l.label, { fontFamily: fontLoc(), fontSize: '15px', color: '#ffffff', backgroundColor: '#0a1a2acc', padding: { x: 10, y: 5 } })
        .setOrigin(0.5)
        .setDepth(10)
        .setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => {
        this.unlockAudio();
        this.selectLang(l.id);
      });
      this.langBtns.push({ id: l.id, txt });
    });
    this.refreshLang();

    // era selector
    this.add.text(W / 2, 560, t('selectEra'), { fontFamily: fontLoc(), fontSize: '15px', color: '#9fd8ff' }).setOrigin(0.5).setDepth(10);
    ORDER.forEach((id, i) => {
      const x = W / 2 + (i - 1) * 150;
      const y = 630;
      const bg = this.add.rectangle(x, y, 136, 96, 0x0a1a2a, 0.75).setStrokeStyle(2, 0x406080).setDepth(10).setInteractive({ useHandCursor: true });
      const plane = this.add.image(x, y - 14, `player_${id}`).setScale(0.7).setDepth(11);
      const label = this.add.text(x, y + 22, eraName(id), { fontFamily: fontLoc(), fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setDepth(11);
      this.add.text(x, y + 40, ERAS[id].years, { fontFamily: FONT, fontSize: '11px', color: '#9fb8d0' }).setOrigin(0.5).setDepth(11);
      bg.on('pointerdown', () => {
        this.unlockAudio();
        if (this.era === id) this.start();
        else this.selectEra(id);
      });
      this.cards.push({ bg, plane, label });
    });

    const touch = this.sys.game.device.input.touch;
    const startBtn = this.add
      .text(W / 2, 722, touch ? t('tapStart') : t('pressStart'), { fontFamily: fontLoc(), fontSize: '24px', color: '#ffffff', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    startBtn.on('pointerdown', () => {
      this.unlockAudio();
      this.start();
    });
    this.tweens.add({ targets: startBtn, alpha: 0.35, yoyo: true, repeat: -1, duration: 650 });

    this.add
      .text(W / 2, 768, touch ? t('helpTouch') : t('helpKeys'), { fontFamily: fontLoc(), fontSize: '11px', color: '#cfe6ff', align: 'center', wordWrap: { width: W - 30 } })
      .setOrigin(0.5)
      .setDepth(10);

    const kb = this.input.keyboard!;
    kb.on('keydown', () => this.unlockAudio());
    const prev = () => this.selectEra(ORDER[(ORDER.indexOf(this.era) + 2) % 3]);
    const next = () => this.selectEra(ORDER[(ORDER.indexOf(this.era) + 1) % 3]);
    kb.on('keydown-LEFT', prev);
    kb.on('keydown-A', prev);
    kb.on('keydown-RIGHT', next);
    kb.on('keydown-D', next);
    kb.on('keydown-L', () => {
      const i = LANGS.findIndex((l) => l.id === getLang());
      this.selectLang(LANGS[(i + 1) % LANGS.length].id);
    });
    kb.on('keydown-ENTER', () => this.start());
    kb.on('keydown-SPACE', () => this.start());
    kb.on('keydown-M', () => {
      prefs.muted = !prefs.muted;
      Sound.setMuted(prefs.muted);
    });
    this.input.on('pointerdown', () => this.unlockAudio());

    this.selectEra(this.era, true);
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length && !this.boardOn) this.toggleBoard();
    });
    this.cameras.main.fadeIn(400);
  }

  // ------------------------------------------------------------ ranking board
  private async loadBoard() {
    const req = ++this.boardReq;
    const era = this.era;
    this.drawBoard(era, null, true);
    const { rows, online } = await fetchTop(era, 10);
    if (req !== this.boardReq || !this.scene.isActive()) return;
    this.drawBoard(era, rows, online);
  }

  private drawBoard(era: Era, rows: ScoreRow[] | null, online: boolean) {
    this.boardObjs.forEach((o) => o.destroy());
    this.boardObjs = [];
    const cy = 396;
    const panel = this.add
      .rectangle(W / 2, cy, W - 36, 288, 0x05101c, 0.8)
      .setStrokeStyle(2, 0xffd860, 0.6)
      .setDepth(8)
      .setInteractive({ useHandCursor: true });
    panel.on('pointerdown', () => this.toggleBoard());
    const head = this.add
      .text(W / 2, cy - 128, `🏆 ${t('ranking')} · ${eraName(era)}${online ? '' : `  (${t('offline')})`}`, { fontFamily: fontLoc(), fontSize: '15px', color: '#ffd860' })
      .setOrigin(0.5)
      .setDepth(9);
    this.boardObjs.push(panel, head);
    if (!rows || !rows.length) {
      this.boardObjs.push(
        this.add
          .text(W / 2, cy, rows ? t('noScores') : t('loading'), { fontFamily: fontLoc(), fontSize: '14px', color: '#9fb8d0', align: 'center', wordWrap: { width: W - 80 } })
          .setOrigin(0.5)
          .setDepth(9),
      );
    } else {
      rows.forEach((r, i) => {
        const y = cy - 104 + i * 24;
        const col = i === 0 ? '#ffd860' : i === 1 ? '#e0e8f0' : i === 2 ? '#e0a070' : '#ffffff';
        const msg = r.message ? (r.message.length > 14 ? r.message.slice(0, 13) + '…' : r.message) : '';
        this.boardObjs.push(
          this.add.text(32, y, `${i + 1}`, { fontFamily: FONT, fontSize: '14px', color: col }).setDepth(9),
          this.add.text(58, y, r.name, { fontFamily: FONT_ANY, fontSize: '14px', color: col }).setDepth(9),
          this.add.text(176, y + 2, msg, { fontFamily: FONT_ANY, fontSize: '11px', color: '#8fa8c0' }).setDepth(9),
          this.add.text(W - 32, y, `${r.score.toLocaleString()}  S${r.stage}`, { fontFamily: FONT, fontSize: '14px', color: col }).setOrigin(1, 0).setDepth(9),
        );
      });
    }
    this.applyBoardVisibility();
  }

  private toggleBoard() {
    this.boardOn = !this.boardOn;
    this.cycleT = 0;
    this.applyBoardVisibility();
  }

  private applyBoardVisibility() {
    for (const o of this.boardObjs) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(this.boardOn);
    this.hero.setAlpha(this.boardOn ? 0.18 : 1);
    this.heroSh.setAlpha(this.boardOn ? 0.1 : 1);
  }

  private refreshLang() {
    for (const b of this.langBtns) {
      const on = b.id === getLang();
      b.txt.setColor(on ? '#0a1a2a' : '#ffffff').setBackgroundColor(on ? '#ffd860' : '#0a1a2acc');
    }
  }

  private async selectLang(l: Lang) {
    if (this.starting || l === getLang()) return;
    setLang(l);
    Sound.sfx('select');
    if (l === 'ja' && document.fonts) {
      try {
        await Promise.race([document.fonts.load('20px "Dela Gothic One"', 'あ日本'), new Promise((r) => setTimeout(r, 2000))]);
      } catch {
        /* fall back to system font */
      }
    }
    this.scene.restart();
  }

  private unlockAudio() {
    Sound.init();
    if (!this.audioOn) {
      this.audioOn = true;
      Sound.music('title', MISC_STYLES.title, 1, this.era);
    }
  }

  private selectEra(id: Era, silent = false) {
    if (this.starting) return;
    this.era = id;
    prefs.era = id;
    setTextureEra(id);
    Sound.setEra(id);
    this.applyBackground(id);
    this.hero.setTexture(tk('player'));
    this.heroSh.setTexture(tk('player') + '_sh');
    this.cards.forEach((c, i) => {
      const on = ORDER[i] === id;
      c.bg.setStrokeStyle(on ? 3 : 2, on ? 0xffd860 : 0x406080).setFillStyle(on ? 0x1a3450 : 0x0a1a2a, on ? 0.9 : 0.7);
      c.plane.setScale(on ? 0.85 : 0.65).setAlpha(on ? 1 : 0.6);
      c.label.setColor(on ? '#ffd860' : '#ffffff');
    });
    this.hiText.setText(`HI-SCORE  ${prefs.hi(id).toLocaleString()}   ·   ${ERAS[id].label} ${ERAS[id].years}`);
    void this.loadBoard();
    if (!silent) {
      Sound.sfx('select');
      this.hero.setScale(2.3);
      this.tweens.add({ targets: this.hero, scale: 2, duration: 250, ease: 'Back.easeOut' });
      if (this.audioOn) Sound.music('title', MISC_STYLES.title, 1, id);
    }
  }

  /** Each era gets its own title backdrop: WWII ocean, modern desert front, future deep space. */
  private applyBackground(id: Era) {
    const space = id === 'future';
    this.water.setTexture(id === 'ww2' ? 'water_0' : id === 'modern' ? 'land_desert' : 'space_title');
    this.stars.setVisible(space);
    this.planet.setVisible(space);
    this.tint.setFillStyle(id === 'ww2' ? 0x8a5a20 : 0x401808, id === 'ww2' ? 0.14 : id === 'modern' ? 0.18 : 0);
    for (const c of this.clouds) {
      if (space) c.setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a60ff).setAlpha(0.22).setScale(2.2);
      else c.setBlendMode(Phaser.BlendModes.NORMAL).setTint(id === 'modern' ? 0xd8c8b0 : 0xffffff).setAlpha(id === 'modern' ? 0.3 : 0.5).setScale(1.4);
    }
  }

  private start() {
    if (this.starting) return;
    this.unlockAudio();
    this.starting = true;
    this.boardOn = false;
    this.applyBoardVisibility();
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
    this.water.tilePositionY -= (this.era === 'future' ? 20 : 60) * dt;
    this.stars.tilePositionY -= 50 * dt;
    this.planet.rotation += dt * 0.01;
    for (const c of this.clouds) {
      c.y += 110 * dt;
      if (c.y > H + 120) {
        c.y = -120;
        c.x = Phaser.Math.Between(0, W);
      }
    }
    // attract mode: alternate ranking board and hero plane
    this.cycleT += dt;
    if (!this.starting && this.cycleT > (this.boardOn ? 9 : 5)) this.toggleBoard();
    const tt = this.time.now / 1000;
    this.hero.x = W / 2 + Math.sin(tt * 0.8) * 30;
    this.hero.y = 420 + Math.sin(tt * 1.3) * 10;
    this.hero.rotation = Math.cos(tt * 0.8) * 0.05;
    if (!this.starting) this.heroSh.setPosition(this.hero.x + 40, this.hero.y + 60);
  }
}
