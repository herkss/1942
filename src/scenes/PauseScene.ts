import Phaser from 'phaser';
import { W, H, FONT, FONT_KR, D } from '../data/config';
import { Sound } from '../audio/sound';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(D.banner);
    this.add.text(W / 2, H / 2 - 90, 'PAUSED', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    const resume = this.add
      .text(W / 2, H / 2 + 10, '계속하기  RESUME', { fontFamily: FONT_KR, fontSize: '24px', color: '#ffffff', backgroundColor: '#20603a', padding: { x: 18, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const quit = this.add
      .text(W / 2, H / 2 + 90, '타이틀로  QUIT', { fontFamily: FONT_KR, fontSize: '18px', color: '#ffb0b0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, H / 2 + 150, 'P / ESC: 계속   ·   Q: 타이틀', { fontFamily: FONT_KR, fontSize: '12px', color: '#9fb8d0' }).setOrigin(0.5);
    resume.on('pointerdown', () => this.resume());
    quit.on('pointerdown', () => this.quit());
    const kb = this.input.keyboard!;
    kb.on('keydown-P', () => this.resume());
    kb.on('keydown-ESC', () => this.resume());
    kb.on('keydown-ENTER', () => this.resume());
    kb.on('keydown-Q', () => this.quit());
  }

  private resume() {
    Sound.sfx('select');
    this.scene.resume('Game');
    this.scene.stop();
  }

  private quit() {
    Sound.stopMusic(0.3);
    Sound.engineStop();
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
