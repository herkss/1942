import Phaser from 'phaser';
import { D, W, H, FONT } from '../data/config';
import { Sound } from '../audio/sound';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Explosions, sparks, smoke trails, floating text and screen flashes. */
export class Fx {
  private fire: Emitter;
  private sparks: Emitter;
  private smoke: Emitter;
  private debris: Emitter;
  private foam: Emitter;
  private flashes: Phaser.GameObjects.Image[] = [];
  private rings: Phaser.GameObjects.Image[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private screen: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    const add = scene.add;
    this.smoke = add.particles(0, 0, 'smoke', {
      emitting: false,
      speed: { min: 10, max: 70 },
      lifespan: { min: 600, max: 1300 },
      scale: { start: 0.5, end: 1.6 },
      alpha: { start: 0.55, end: 0 },
      tint: [0x3a3a3a, 0x555555, 0x6a6058],
      rotate: { min: 0, max: 360 },
    });
    this.smoke.setDepth(D.fx - 1);
    this.fire = add.particles(0, 0, 'smoke', {
      emitting: false,
      speed: { min: 30, max: 160 },
      lifespan: { min: 250, max: 650 },
      scale: { start: 0.7, end: 0.1 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe080, 0xffa030, 0xff5a20, 0xffffff],
      blendMode: 'ADD',
      rotate: { min: 0, max: 360 },
    });
    this.fire.setDepth(D.fx);
    this.sparks = add.particles(0, 0, 'spark', {
      emitting: false,
      speed: { min: 120, max: 480 },
      lifespan: { min: 200, max: 600 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xfff0a0, 0xffb040],
      blendMode: 'ADD',
    });
    this.sparks.setDepth(D.fx + 1);
    this.debris = add.particles(0, 0, 'debris', {
      emitting: false,
      speed: { min: 60, max: 260 },
      lifespan: { min: 500, max: 1100 },
      scale: { start: 1.2, end: 0.4 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0x222222, 0x444444, 0x333028],
    });
    this.debris.setDepth(D.fx - 1);
    this.foam = add.particles(0, 0, 'smoke', {
      emitting: false,
      speedX: { min: -14, max: 14 },
      lifespan: { min: 900, max: 1600 },
      scale: { start: 0.25, end: 0.9 },
      alpha: { start: 0.45, end: 0 },
      tint: 0xffffff,
      speedY: { min: 60, max: 90 },
    });
    this.foam.setDepth(D.ground - 1);
    this.screen = add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(D.flash);
  }

  setFoamScroll(speed: number) {
    this.foam.speedY = speed;
  }

  wake(x: number, y: number, n = 1) {
    this.foam.explode(n, x, y);
  }

  private flashImg() {
    let f = this.flashes.find((i) => !i.active);
    if (!f) {
      f = this.scene.add.image(0, 0, 'flash').setBlendMode(Phaser.BlendModes.ADD).setDepth(D.fx + 2);
      this.flashes.push(f);
    }
    return f.setActive(true).setVisible(true);
  }

  private ringImg() {
    let r = this.rings.find((i) => !i.active);
    if (!r) {
      r = this.scene.add.image(0, 0, 'ring').setBlendMode(Phaser.BlendModes.ADD).setDepth(D.fx + 2);
      this.rings.push(r);
    }
    return r.setActive(true).setVisible(true);
  }

  flash(x: number, y: number, scale: number, dur = 260, tint = 0xffffff) {
    const f = this.flashImg();
    f.setPosition(x, y).setScale(scale * 0.4).setAlpha(1).setTint(tint);
    this.scene.tweens.add({
      targets: f,
      scale: scale,
      alpha: 0,
      duration: dur,
      ease: 'Cubic.easeOut',
      onComplete: () => f.setActive(false).setVisible(false),
    });
  }

  ring(x: number, y: number, scale: number, dur = 400, tint = 0xffffff) {
    const r = this.ringImg();
    r.setPosition(x, y).setScale(0.1).setAlpha(0.9).setTint(tint);
    this.scene.tweens.add({
      targets: r,
      scale,
      alpha: 0,
      duration: dur,
      ease: 'Cubic.easeOut',
      onComplete: () => r.setActive(false).setVisible(false),
    });
  }

  spark(x: number, y: number, n = 3) {
    this.sparks.explode(n, x, y);
  }

  hit(x: number, y: number) {
    this.sparks.explode(2, x, y);
  }

  explode(x: number, y: number, size: 's' | 'm' | 'l' | 'xl') {
    const k = { s: 1, m: 1.8, l: 3, xl: 4.5 }[size];
    this.flash(x, y, 0.6 * k, 220 + 80 * k);
    this.fire.explode(Math.round(8 * k), x, y);
    this.sparks.explode(Math.round(8 * k), x, y);
    this.smoke.explode(Math.round(4 * k), x, y);
    this.debris.explode(Math.round(4 * k), x, y);
    if (size !== 's') this.ring(x, y, 0.7 * k, 380 + 60 * k);
    if (size === 's') Sound.sfx('boomS');
    else if (size === 'm') {
      Sound.sfx('boomM');
      this.scene.cameras.main.shake(120, 0.004);
    } else {
      Sound.sfx('boomL');
      this.scene.cameras.main.shake(350, size === 'xl' ? 0.016 : 0.009);
    }
    if (size === 'l' || size === 'xl') {
      // secondary bursts
      for (let i = 0; i < (size === 'xl' ? 8 : 4); i++) {
        this.scene.time.delayedCall(80 + i * 90, () => {
          const ox = x + Phaser.Math.Between(-40, 40) * k * 0.5;
          const oy = y + Phaser.Math.Between(-30, 30) * k * 0.5;
          this.flash(ox, oy, 0.5 * k, 300);
          this.fire.explode(10, ox, oy);
          this.smoke.explode(3, ox, oy);
        });
      }
    }
  }

  smokePuff(x: number, y: number, n = 1) {
    this.smoke.explode(n, x, y);
  }

  firePuff(x: number, y: number, n = 1) {
    this.fire.explode(n, x, y);
  }

  screenFlash(color = 0xffffff, alpha = 0.7, dur = 300) {
    this.screen.setFillStyle(color, alpha);
    this.scene.tweens.killTweensOf(this.screen);
    this.screen.alpha = 1;
    this.scene.tweens.add({ targets: this.screen, alpha: 0, duration: dur });
  }

  text(x: number, y: number, msg: string, color = '#ffe680', size = 14) {
    let t = this.texts.find((i) => !i.active);
    if (!t) {
      t = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(D.fx + 5);
      this.texts.push(t);
    }
    t.setActive(true).setVisible(true).setText(msg).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setScale(0.6);
    const tt = t;
    this.scene.tweens.add({ targets: tt, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: tt,
      y: y - 36,
      alpha: 0,
      delay: 450,
      duration: 500,
      onComplete: () => tt.setActive(false).setVisible(false),
    });
  }
}
