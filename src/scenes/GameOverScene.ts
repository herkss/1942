import Phaser from 'phaser';
import { W, H, FONT, FONT_KR, ERAS } from '../data/config';
import { run, prefs } from '../data/state';
import { Sound } from '../audio/sound';

export class GameOverScene extends Phaser.Scene {
  private count = 10;
  private done = false;

  constructor() {
    super('GameOver');
  }

  create() {
    this.done = false;
    this.count = 10;
    prefs.setHi(run.era, run.score);
    this.add.rectangle(W / 2, H / 2, W, H, 0x05080c);
    const t = this.add
      .text(W / 2, 200, 'GAME OVER', { fontFamily: FONT, fontSize: '54px', color: '#ff4040', stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 230, duration: 900, ease: 'Cubic.easeOut' });
    this.add
      .text(W / 2, 320, `${ERAS[run.era].ko}  ·  STAGE ${run.stage}`, { fontFamily: FONT_KR, fontSize: '18px', color: '#cfe6ff' })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 360, `SCORE  ${run.score.toLocaleString()}`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 398, `HI-SCORE  ${prefs.hi(run.era).toLocaleString()}`, { fontFamily: FONT, fontSize: '17px', color: '#ffd860' })
      .setOrigin(0.5);

    const cont = this.add
      .text(W / 2, 500, '', { fontFamily: FONT_KR, fontSize: '26px', color: '#ffffff', backgroundColor: '#20603a', padding: { x: 20, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const quit = this.add
      .text(W / 2, 580, '타이틀로  TITLE', { fontFamily: FONT_KR, fontSize: '18px', color: '#cfe6ff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(W / 2, 640, '컨티뉴 시 점수가 초기화되고 현재 스테이지부터 재시작합니다', { fontFamily: FONT_KR, fontSize: '12px', color: '#7f98b0' })
      .setOrigin(0.5);
    const upd = () => cont.setText(`컨티뉴  CONTINUE  ${this.count}`);
    upd();
    this.time.addEvent({
      delay: 1000,
      repeat: 9,
      callback: () => {
        this.count--;
        Sound.sfx('tick');
        upd();
        if (this.count <= 0) this.toTitle();
      },
    });
    cont.on('pointerdown', () => this.cont());
    quit.on('pointerdown', () => this.toTitle());
    this.input.keyboard!.on('keydown-ENTER', () => this.cont());
    this.input.keyboard!.on('keydown-ESC', () => this.toTitle());
    Sound.music(3, run.era, 'gameover');
  }

  private cont() {
    if (this.done) return;
    this.done = true;
    Sound.sfx('confirm');
    Sound.stopMusic(0.4);
    run.score = 0;
    run.lives = 3;
    run.power = Math.max(run.power, 2);
    run.bombs = 3;
    run.continues++;
    this.scene.start('Game');
  }

  private toTitle() {
    if (this.done) return;
    this.done = true;
    Sound.stopMusic(0.4);
    this.scene.start('Title');
  }
}
