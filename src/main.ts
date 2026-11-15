import Phaser from 'phaser';
import { W, H } from './data/config';
import { run } from './data/state';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { HangarScene } from './scenes/HangarScene';
import { GameOverScene } from './scenes/GameOverScene';
import { PauseScene } from './scenes/PauseScene';

function boot() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#05101c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4, gamepad: true },
    render: { antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [BootScene, TitleScene, GameScene, HangarScene, GameOverScene, PauseScene],
  });
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __run: run });
}

// Wait (briefly) for web fonts so canvas text and procedural item labels use them.
const fonts = document.fonts
  ? Promise.all([document.fonts.load('20px "Black Ops One"'), document.fonts.load('20px "Black Han Sans"')])
  : Promise.resolve();
Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))])
  .catch(() => undefined)
  .finally(boot);
