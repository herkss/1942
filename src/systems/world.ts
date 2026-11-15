import Phaser from 'phaser';
import { D, W, H } from '../data/config';
import { THEMES, type Theme, type DecoKind } from '../data/themes';
import { buildWaterTexture, tk } from '../gfx/textures';
import { buildSpaceBackground, spaceLand } from '../gfx/space';
import { Sound } from '../audio/sound';
import type { Fx } from './fx';

interface Deco {
  imgs: Phaser.GameObjects.Image[];
  k: number;
  burn?: [number, number][];
  beam?: { img: Phaser.GameObjects.Image; base: number; sp: number };
  blink?: Phaser.GameObjects.Image;
  t: number;
  /** own motion (sea creatures) */
  vx?: number;
  vy?: number;
  wiggle?: number;
}

type LandDeco = 'crater' | 'tankWreck' | 'wreck' | 'searchlight' | 'burning';

const SUNK_DEPTH = 0.5;
const SURFACE_DEPTH = D.decoLow + 0.2;

/**
 * Scrolling battlefield: ocean, optional land segment with coastlines,
 * scenery (islands, wrecks, reefs…), clouds, weather and ground-war ambience.
 *
 * World distance `d` maps to screen y as `y = H - (d - traveled)`.
 */
export class World {
  traveled = 0;
  private water: Phaser.GameObjects.TileSprite;
  private land: Phaser.GameObjects.TileSprite | null = null;
  private landMask: Phaser.GameObjects.Graphics | null = null;
  private coastLow: Phaser.GameObjects.Image | null = null;
  private coastHigh: Phaser.GameObjects.Image | null = null;
  private seg: { start: number; end: number; kind: string } | null = null;
  private stars: Phaser.GameObjects.TileSprite | null = null;
  private decos: Deco[] = [];
  private decoAcc = 0;
  private cloudAcc = 0;
  private ambT = 0;
  private lightningT = 6;
  private creatureT = 8 + Math.random() * 10;
  private announced = { land: false, sea: false };

  constructor(
    private scene: Phaser.Scene,
    private theme: Theme,
    private fx: Fx,
    private onBanner: (which: 'land' | 'sea') => void,
    readonly space = false,
  ) {
    const tIdx = THEMES.indexOf(theme);
    if (space) {
      buildSpaceBackground(scene, `space_${tIdx}`, theme);
      this.water = scene.add.tileSprite(W / 2, H / 2, W, H, `space_${tIdx}`).setDepth(D.water);
      this.stars = scene.add.tileSprite(W / 2, H / 2, W, H, 'stars_near').setDepth(D.water + 0.05);
      fx.noWake = true;
      const p = scene.add
        .image(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(80, 400), `planet_${tIdx % 3}`)
        .setDepth(D.water + 0.1)
        .setScale(0.5 + Math.random() * 0.7)
        .setRotation((Math.random() - 0.5) * 0.6);
      this.decos.push({ imgs: [p], k: 0.12, t: 0 });
    } else {
      buildWaterTexture(scene, `water_${tIdx}`, theme);
      this.water = scene.add.tileSprite(W / 2, H / 2, W, H, `water_${tIdx}`).setDepth(D.water);
      if (theme.night) scene.add.rectangle(W / 2, H / 2, W, H, 0x000814, 0.38).setDepth(D.nightOverlay);
    }
    if (theme.overlay) scene.add.rectangle(W / 2, H / 2, W, H, theme.overlay[0], theme.overlay[1] * (space ? 0.5 : 1)).setDepth(D.weather - 1);
    for (let i = 0; i < 3; i++) this.spawnSeaDeco(Phaser.Math.Between(-100, H - 200));
    this.setupWeather();
  }

  /** Schedule the land segment given the expected combat duration. */
  scheduleLand(combatSec: number, speed: number) {
    if (!this.theme.land) return;
    const kind = this.space ? spaceLand(this.theme.land) : this.theme.land;
    const [a, b] = this.theme.landSpan ?? [0.2, 0.8];
    const start = this.traveled + H + combatSec * speed * a;
    const end = this.traveled + H + combatSec * speed * b;
    this.seg = { start, end, kind };
    const sc = this.scene;
    const key = `land_${kind}${this.theme.night && !this.space ? '_n' : ''}`;
    this.land = sc.add.tileSprite(W / 2, H / 2, W, H, key).setDepth(D.water + 0.2).setVisible(false);
    this.landMask = sc.make.graphics({}, false);
    this.land.setMask(this.landMask.createGeometryMask());
    this.coastLow = sc.add.image(W / 2, -500, `coast_${kind}`).setOrigin(0.5, 0.45).setDepth(D.water + 0.3).setVisible(false);
    this.coastHigh = sc.add.image(W / 2, -500, `coast_${kind}`).setOrigin(0.5, 0.55).setFlipY(true).setDepth(D.water + 0.3).setVisible(false);
    if (this.theme.night && !this.space) {
      this.coastLow.setTint(0x6a7a9a);
      this.coastHigh.setTint(0x6a7a9a);
    }
  }

  /** Is screen-y over land right now? */
  isLandAt(y: number) {
    if (!this.seg) return false;
    const d = this.traveled + (H - y);
    return d >= this.seg.start && d <= this.seg.end;
  }

  get landKind() {
    return this.seg?.kind ?? null;
  }

  update(dt: number, sp: number) {
    this.traveled += sp * dt;
    this.water.tilePositionY -= sp * dt * (this.space ? 0.35 : 1);
    if (this.stars) this.stars.tilePositionY -= sp * dt * 0.8;
    this.fx.setFoamScroll(sp);
    this.updateLand(sp, dt);

    this.decoAcc += sp * dt;
    this.cloudAcc += sp * dt;
    if (this.decoAcc > 230) {
      this.decoAcc = 0;
      if (this.isLandAt(-160)) this.spawnLandDeco(-160);
      else this.spawnSeaDeco(-200);
    }
    const th = this.theme;
    const cloudGap = th.lowClouds ? 110 : 420 / Math.max(0.2, th.cloudRate);
    if (this.cloudAcc > cloudGap) {
      this.cloudAcc = 0;
      if (Math.random() < th.cloudRate) this.spawnCloud();
    }

    for (let i = this.decos.length - 1; i >= 0; i--) {
      const d = this.decos[i];
      d.t += dt;
      const dy = sp * d.k * dt + (d.vy ?? 0) * dt;
      const dx = (d.vx ?? 0) * dt;
      for (const im of d.imgs) {
        im.y += dy;
        im.x += dx;
      }
      const m = d.imgs[0];
      if (d.wiggle) {
        // face the swimming direction relative to the water, with a tail sway
        const base = Math.atan2(d.vy!, d.vx!) + Math.PI / 2;
        m.rotation = base + Math.sin(d.t * d.wiggle) * 0.06;
        m.scaleX = m.scaleY * (1 + Math.sin(d.t * d.wiggle * 2) * 0.04);
      }
      if (d.burn && m.y > -60 && m.y < H + 40) {
        for (const [ox, oy] of d.burn) if (Math.random() < 0.35) this.fx.burn(m.x + ox, m.y + oy, d.burn.length < 2);
      }
      if (d.beam) d.beam.img.rotation = d.beam.base + Math.sin(d.t * d.beam.sp) * 0.7;
      if (d.blink) d.blink.setAlpha(Math.sin(d.t * 4) > 0.3 ? 1 : 0.1);
      if (m.y > H + 300 || m.y < -700 || m.x < -400 || m.x > W + 400) {
        d.imgs.forEach((im) => im.destroy());
        this.decos.splice(i, 1);
      }
    }

    // sea life swimming under the surface
    if (!this.space) {
      this.creatureT -= dt;
      if (this.creatureT <= 0) {
        this.creatureT = 14 + Math.random() * 22;
        if (!this.isLandAt(-150) && !this.isLandAt(H + 150)) this.spawnCreature();
      }
    }

    // storms
    if (th.weather === 'storm') {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 4 + Math.random() * 6;
        const col = this.space ? 0xb080ff : 0xdde8ff;
        this.fx.screenFlash(col, 0.5, 180);
        this.scene.time.delayedCall(140, () => this.fx.screenFlash(col, 0.3, 260));
        this.scene.time.delayedCall(400, () => Sound.sfx('thunder'));
      }
    }
    this.groundWar(dt);
  }

  // ------------------------------------------------------------- land
  private updateLand(sp: number, dt: number) {
    if (!this.seg || !this.land) return;
    const yTop = H - (this.seg.end - this.traveled);
    const yBot = H - (this.seg.start - this.traveled);
    const visible = yBot > -60 && yTop < H + 60;
    this.land.setVisible(visible);
    this.land.tilePositionY -= sp * dt;
    this.landMask!.clear();
    if (visible) {
      const a = Math.max(0, yTop);
      const b = Math.min(H, yBot);
      this.landMask!.fillStyle(0xffffff).fillRect(0, a, W, Math.max(0, b - a));
    }
    this.coastLow!.setY(yBot).setVisible(yBot > -60 && yBot < H + 60);
    this.coastHigh!.setY(yTop).setVisible(yTop > -60 && yTop < H + 60);
    if (!this.announced.land && yBot > 120) {
      this.announced.land = true;
      this.onBanner('land');
    }
    if (!this.announced.sea && yTop > 160) {
      this.announced.sea = true;
      this.onBanner('sea');
    }
  }

  /** Ground-war ambience while land is on screen: distant blasts and AA tracers. */
  private groundWar(dt: number) {
    if (!this.seg) return;
    const yTop = Math.max(0, H - (this.seg.end - this.traveled));
    const yBot = Math.min(H, H - (this.seg.start - this.traveled));
    if (yBot - yTop < 120) return;
    this.ambT -= dt;
    if (this.ambT > 0) return;
    const night = !!this.theme.night;
    this.ambT = (night ? 0.18 : 0.45) + Math.random() * 0.5;
    const x = Phaser.Math.Between(20, W - 20);
    const y = Phaser.Math.Between(yTop + 30, yBot - 30);
    if (Math.random() < (night ? 0.65 : 0.4)) {
      const n = Phaser.Math.Between(2, 5);
      for (let i = 0; i < n; i++) this.scene.time.delayedCall(i * 70, () => this.fx.tracer(x + Phaser.Math.Between(-6, 6), y));
    } else this.fx.groundBlast(x, y);
  }

  private pickDeco<T extends string>(weights: Partial<Record<T, number>>): T | null {
    const entries = Object.entries(weights) as [T, number][];
    const total = entries.reduce((a, [, w]) => a + w, 0);
    if (total <= 0) return null;
    let k = Math.random() * total;
    for (const [id, w] of entries) {
      k -= w;
      if (k <= 0) return id;
    }
    return entries[0][0];
  }

  private img(key: string, x: number, y: number, depth: number) {
    return this.scene.add.image(x, y, key).setDepth(depth);
  }

  private tintNight(imgs: Phaser.GameObjects.Image[]) {
    if (this.theme.night) imgs.forEach((i) => i.setTint(0x6a78a0));
  }

  private spawnLandDeco(y: number) {
    const night = !!this.theme.night;
    const kind = this.pickDeco<LandDeco>({ crater: 3, tankWreck: 1.5, wreck: 0.6, burning: 1.4, searchlight: night ? 1.6 : 0 });
    if (!kind || Math.random() < 0.15) return;
    const x = Phaser.Math.Between(30, W - 30);
    const rot = Math.random() * Math.PI * 2;
    const d: Deco = { imgs: [], k: 1, t: Math.random() * 10 };
    switch (kind) {
      case 'crater':
        for (let i = 0; i < Phaser.Math.Between(1, 3); i++) {
          d.imgs.push(this.img(`crater_${Phaser.Math.Between(0, 2)}`, x + Phaser.Math.Between(-40, 40), y + Phaser.Math.Between(-30, 30), SURFACE_DEPTH).setScale(0.6 + Math.random() * 0.8));
        }
        break;
      case 'tankWreck':
        d.imgs.push(this.img(tk('wreck_tank'), x, y, SURFACE_DEPTH).setRotation(rot));
        d.burn = [[0, 0]];
        break;
      case 'wreck':
        d.imgs.push(this.img(tk(Math.random() < 0.5 ? 'wreck_heavy' : 'wreck_bomber'), x, y, SURFACE_DEPTH).setRotation(rot).setScale(0.7));
        d.burn = [[0, 0]];
        break;
      case 'burning':
        d.imgs.push(this.img(`crater_${Phaser.Math.Between(0, 2)}`, x, y, SURFACE_DEPTH));
        d.burn = [[0, 0], [12, 6]];
        break;
      case 'searchlight': {
        const base = this.img(tk('en_flak'), x, y, SURFACE_DEPTH).setScale(0.6);
        const beam = this.img('beam', x, y, D.decoLow + 0.95).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
        d.imgs.push(base, beam);
        d.beam = { img: beam, base: -Math.PI / 2 + (Math.random() - 0.5) * 0.6, sp: 0.5 + Math.random() * 0.6 };
        break;
      }
    }
    if (kind !== 'searchlight') this.tintNight(d.imgs);
    this.decos.push(d);
  }

  private spawnSpaceDeco(y: number) {
    const th = this.theme;
    if (Math.random() > 0.7) return;
    const kind = this.pickDeco<DecoKind>(th.deco);
    if (!kind) return;
    const x = Phaser.Math.Between(-20, W + 20);
    const rot = Math.random() * Math.PI * 2;
    const d: Deco = { imgs: [], k: 1, t: Math.random() * 10 };
    const derelict = (key: string, big: boolean) => {
      d.imgs.push(this.img(tk(key), x, y - (big ? 100 : 0), SUNK_DEPTH).setRotation(rot).setTint(0x8a9ab8).setAlpha(0.85));
      this.scene.tweens.add({ targets: d.imgs[0], rotation: rot + (Math.random() < 0.5 ? -0.3 : 0.3), duration: 20000 });
    };
    switch (kind) {
      case 'island':
      case 'rock':
      case 'reef':
        for (let i = 0; i < (kind === 'reef' ? 4 : 1); i++) {
          const a = this.img(`asteroid_${Phaser.Math.Between(0, 3)}`, x + (i ? Phaser.Math.Between(-80, 80) : 0), y + (i ? Phaser.Math.Between(-60, 60) : 0), D.decoLow)
            .setRotation(rot)
            .setScale(kind === 'island' ? 0.9 + Math.random() * 0.8 : 0.35 + Math.random() * 0.4);
          d.imgs.push(a);
          this.scene.tweens.add({ targets: a, rotation: rot + Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1), duration: 30000 + Math.random() * 30000, repeat: -1 });
        }
        break;
      case 'baseIsland':
        d.imgs.push(this.img(`station_${Phaser.Math.Between(0, 1)}`, x, y, D.decoLow).setRotation(rot));
        break;
      case 'lighthouse':
      case 'buoy': {
        const b = this.img('satellite', x, y, SURFACE_DEPTH).setRotation(rot);
        const l = this.img('spark', x, y, SURFACE_DEPTH + 0.1).setBlendMode(Phaser.BlendModes.ADD).setTint(0x40e0ff).setScale(1.4);
        d.imgs.push(b, l);
        d.blink = l;
        break;
      }
      case 'sunkShip':
        derelict('wreck_ship', false);
        break;
      case 'sunkBigShip':
        derelict('wreck_bigship', true);
        break;
      case 'sunkPlane':
        derelict(Math.random() < 0.5 ? 'wreck_bomber' : 'wreck_transport', false);
        break;
      case 'burning':
      case 'floatWreck':
        derelict(Math.random() < 0.5 ? 'wreck_ship' : 'wreck_heavy', false);
        d.burn = [[0, 0]];
        break;
      case 'oil': {
        const n = this.img(`cloud_${Phaser.Math.Between(0, 3)}`, x, y, D.cloudLow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(1.5).setTint(Phaser.Display.Color.HexStringToColor(th.water[2]).color);
        d.imgs.push(n);
        break;
      }
      case 'debris':
        d.imgs.push(this.img(`sdebris_${Phaser.Math.Between(0, 2)}`, x, y, SURFACE_DEPTH).setRotation(rot));
        break;
      case 'mine':
        for (let i = 0; i < Phaser.Math.Between(2, 4); i++) d.imgs.push(this.img('mine', x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(-50, 50), SURFACE_DEPTH).setTint(0xb0a0ff));
        break;
    }
    this.decos.push(d);
  }

  private spawnSeaDeco(y: number) {
    if (this.space) return this.spawnSpaceDeco(y);
    const th = this.theme;
    if (Math.random() > (th.lowClouds ? 0.35 : 0.72)) return;
    const kind = this.pickDeco<DecoKind>(th.deco);
    if (!kind) return;
    const x = Phaser.Math.Between(-20, W + 20);
    const rot = Math.random() * Math.PI * 2;
    const d: Deco = { imgs: [], k: 1, t: Math.random() * 10 };
    const islandStyle = th.island === 'none' ? 'green' : th.island;
    switch (kind) {
      case 'island':
        d.imgs.push(this.img(`island_${islandStyle}_${Phaser.Math.Between(0, 2)}`, x, y, D.decoLow).setRotation(rot).setScale(0.7 + Math.random() * 0.7));
        break;
      case 'baseIsland':
        d.imgs.push(this.img(`island_base_${Phaser.Math.Between(0, 1)}`, x, y, D.decoLow).setRotation((Math.random() - 0.5) * 0.6).setScale(0.9 + Math.random() * 0.3));
        if (Math.random() < 0.5) d.burn = [[Phaser.Math.Between(-40, 40), Phaser.Math.Between(-20, 20)]];
        break;
      case 'lighthouse': {
        const lx = Phaser.Math.Between(40, W - 40);
        d.imgs.push(this.img('lighthouse', lx, y, D.decoLow));
        if (th.night) {
          const beam = this.img('beam', lx, y, D.decoLow + 0.95).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
          d.imgs.push(beam);
          this.scene.tweens.add({ targets: beam, rotation: Math.PI * 2, duration: 5000, repeat: -1 });
        }
        break;
      }
      case 'sunkShip':
        d.imgs.push(this.img(tk('wreck_ship_sunk'), x, y, SUNK_DEPTH).setRotation(rot).setAlpha(0.55));
        break;
      case 'sunkBigShip':
        d.imgs.push(this.img(tk('wreck_bigship_sunk'), x, y - 120, SUNK_DEPTH).setRotation(rot).setAlpha(0.5));
        break;
      case 'sunkPlane':
        d.imgs.push(
          this.img(tk(Math.random() < 0.5 ? 'wreck_bomber_sunk' : 'wreck_transport_sunk'), x, y, SUNK_DEPTH)
            .setRotation(rot)
            .setAlpha(th.deco.reef ? 0.7 : 0.5),
        );
        break;
      case 'burning': {
        const big = Math.random() < 0.35;
        d.imgs.push(this.img(tk(big ? 'wreck_bigship' : 'wreck_ship'), x, y - (big ? 100 : 0), SURFACE_DEPTH).setRotation(rot).setScale(big ? 0.7 : 1));
        const n = big ? 3 : 2;
        d.burn = [];
        for (let i = 0; i < n; i++) {
          const along = (i / (n - 1 || 1) - 0.5) * (big ? 200 : 110);
          d.burn.push([Math.cos(rot + Math.PI / 2) * along, Math.sin(rot + Math.PI / 2) * along]);
        }
        break;
      }
      case 'floatWreck':
        d.imgs.push(this.img(tk(Math.random() < 0.5 ? 'wreck_heavy' : 'wreck_transport'), x, y, SURFACE_DEPTH).setRotation(rot).setScale(0.8).setAlpha(0.9));
        d.burn = [[0, 0]];
        break;
      case 'oil':
        d.imgs.push(this.img(`oil_${Phaser.Math.Between(0, 1)}`, x, y, SUNK_DEPTH + 0.1).setRotation(rot).setScale(0.8 + Math.random() * 0.8));
        break;
      case 'debris':
        d.imgs.push(this.img(`debris_${Phaser.Math.Between(0, 2)}`, x, y, SURFACE_DEPTH).setRotation(rot));
        break;
      case 'reef':
        d.imgs.push(this.img(`reef_${Phaser.Math.Between(0, 2)}`, x, y, SUNK_DEPTH + 0.1).setRotation(rot).setScale(0.8 + Math.random() * 0.6).setAlpha(0.85));
        break;
      case 'rock':
        d.imgs.push(this.img(`rock_${Phaser.Math.Between(0, 1)}`, x, y, D.decoLow).setRotation(rot).setScale(0.7 + Math.random() * 0.8));
        break;
      case 'mine':
        for (let i = 0; i < Phaser.Math.Between(2, 4); i++) d.imgs.push(this.img('mine', x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(-50, 50), SURFACE_DEPTH));
        break;
      case 'buoy': {
        const b = this.img('buoy', x, y, SURFACE_DEPTH);
        const l = this.img('spark', x, y - 2, SURFACE_DEPTH + 0.1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff4030).setScale(th.night ? 1.6 : 0.9);
        d.imgs.push(b, l);
        d.blink = l;
        break;
      }
    }
    this.tintNight(d.imgs.filter((i) => i.blendMode !== Phaser.BlendModes.ADD));
    if (th.island === 'ice' && (kind === 'sunkShip' || kind === 'sunkPlane')) d.imgs.forEach((i) => i.setTint(0xb8e0ff));
    this.decos.push(d);
  }

  /** A whale or a small pack of sharks crossing beneath the waves. */
  private spawnCreature() {
    const whale = Math.random() < 0.45;
    const fromTop = Math.random() < 0.5;
    const n = whale ? 1 : Phaser.Math.Between(2, 3);
    const x0 = Phaser.Math.Between(60, W - 60);
    const dir = x0 < W / 2 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const img = this.img(whale ? 'whale' : 'shark', x0 + i * 40 * dir, fromTop ? -260 - i * 70 : H + 260 + i * 70, SUNK_DEPTH + 0.05)
        .setAlpha(whale ? 0.5 : 0.6)
        .setScale(whale ? 0.75 + Math.random() * 0.3 : 0.7 + Math.random() * 0.3);
      if (this.theme.night) img.setAlpha(img.alpha * 0.6);
      // swims against or along the scroll; screen motion = scroll + own velocity
      const sp = whale ? 60 : 150;
      const vy = fromTop ? -this.scrollRef - sp * 0.2 + 80 : -this.scrollRef - sp;
      this.decos.push({ imgs: [img], k: 1, t: Math.random() * 3, vx: dir * (whale ? 12 : 40), vy, wiggle: whale ? 1.3 : 3.5 });
    }
  }

  private get scrollRef() {
    return 140;
  }

  private spawnCloud() {
    const th = this.theme;
    if (this.space) {
      const img = this.scene.add
        .image(Phaser.Math.Between(-60, W + 60), -160, `cloud_${Phaser.Math.Between(0, 3)}`)
        .setDepth(Math.random() < 0.3 ? D.cloudHigh : D.cloudLow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.8 + Math.random() * 1.5)
        .setAlpha(0.18 + Math.random() * 0.15)
        .setTint(Phaser.Display.Color.HexStringToColor(Math.random() < 0.5 ? th.water[1] : th.water[2]).color);
      this.decos.push({ imgs: [img], k: 0.9 + Math.random() * 0.8, t: 0 });
      return;
    }
    const high = !th.lowClouds && Math.random() < 0.45;
    const img = this.scene.add
      .image(Phaser.Math.Between(-60, W + 60), -120, `cloud_${Phaser.Math.Between(0, 3)}`)
      .setDepth(high ? D.cloudHigh : D.cloudLow)
      .setScale(high ? 1.6 + Math.random() : th.lowClouds ? 1.6 + Math.random() * 1.2 : 1 + Math.random() * 0.8)
      .setAlpha(high ? 0.35 : th.lowClouds ? 0.85 : 0.55)
      .setFlipX(Math.random() < 0.5);
    if (th.night) img.setTint(0x6070a0);
    if (th.weather === 'storm') img.setTint(0x8090a0);
    this.decos.push({ imgs: [img], k: high ? 2.1 : th.lowClouds ? 1.25 : 1.35, t: 0 });
  }

  private setupWeather() {
    const sc = this.scene;
    const w = this.theme.weather;
    if (this.space && (w === 'rain' || w === 'storm')) {
      // hyperspace / ion streaks
      sc.add
        .particles(0, 0, 'rain', {
          x: { min: -20, max: W + 20 },
          y: -40,
          speedY: { min: 1300, max: 1700 },
          lifespan: 800,
          frequency: w === 'storm' ? 20 : 40,
          alpha: { start: 0.6, end: 0.1 },
          tint: [0x9fd8ff, 0xc0a0ff],
          blendMode: 'ADD',
          scaleY: { min: 1, max: 2 },
        })
        .setDepth(D.weather);
    } else if (w === 'rain' || w === 'storm') {
      sc.add
        .particles(0, 0, 'rain', {
          x: { min: -60, max: W + 60 },
          y: -40,
          speedY: { min: 900, max: 1150 },
          speedX: { min: -140, max: -110 },
          rotate: 7,
          lifespan: 1000,
          frequency: w === 'storm' ? 8 : 16,
          quantity: 2,
          alpha: { start: 0.55, end: 0.25 },
          scaleY: { min: 0.6, max: 1.2 },
        })
        .setDepth(D.weather);
    } else if (w === 'snow') {
      sc.add
        .particles(0, 0, 'flake', {
          x: { min: -20, max: W + 20 },
          y: -20,
          speedY: { min: 110, max: 220 },
          speedX: { min: -40, max: 40 },
          lifespan: 6000,
          frequency: 40,
          scale: { min: 0.3, max: 1 },
          alpha: { min: 0.4, max: 0.9 },
        })
        .setDepth(D.weather);
    } else if (w === 'ash') {
      sc.add
        .particles(0, 0, 'flake', {
          x: { min: -20, max: W + 20 },
          y: -20,
          speedY: { min: 90, max: 180 },
          speedX: { min: -30, max: 30 },
          lifespan: 6000,
          frequency: 60,
          scale: { min: 0.2, max: 0.6 },
          alpha: { start: 0.9, end: 0.2 },
          tint: [0xff7a30, 0xffb040, 0x777777],
          blendMode: 'ADD',
        })
        .setDepth(D.weather);
    }
  }
}
