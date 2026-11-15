import Phaser from 'phaser';
import { buildEraTextures, buildSharedTextures } from '../gfx/textures';
import { buildDecorTextures, buildWreckTextures } from '../gfx/decor';
import { buildTerrainTextures, buildLandUnitTextures } from '../gfx/terrain';
import { buildSpaceTextures } from '../gfx/space';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildSharedTextures(this);
    buildTerrainTextures(this);
    for (const era of ['ww2', 'modern', 'future'] as const) {
      buildEraTextures(this, era);
      buildWreckTextures(this, era);
      buildLandUnitTextures(this, era);
    }
    buildDecorTextures(this);
    buildSpaceTextures(this);
    document.getElementById('loading')?.remove();
    this.scene.start('Title');
  }
}
