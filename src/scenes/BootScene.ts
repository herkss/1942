import Phaser from 'phaser';
import { buildEraTextures, buildSharedTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildSharedTextures(this);
    for (const era of ['ww2', 'modern', 'future'] as const) buildEraTextures(this, era);
    document.getElementById('loading')?.remove();
    this.scene.start('Title');
  }
}
