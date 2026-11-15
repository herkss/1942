import Phaser from 'phaser';

export class Pool<T extends Phaser.GameObjects.GameObject> {
  readonly items: T[] = [];
  constructor(private factory: () => T) {}
  get(): T {
    for (const it of this.items) if (!it.active) return it;
    const it = this.factory();
    this.items.push(it);
    return it;
  }
  forActive(fn: (it: T) => void) {
    for (const it of this.items) if (it.active) fn(it);
  }
  count() {
    let n = 0;
    for (const it of this.items) if (it.active) n++;
    return n;
  }
}

export class Shot extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  dmg = 1;
  r = 4;
  pierce = false;
  hitSet: Set<Enemy> = new Set();
  homing = false;
  target: Enemy | null = null;
  turn = 0;
  speed = 0;
  accel = 0;
  life = 0;
  spin = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, -100, -100, 'px');
    scene.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  fire(tex: string, x: number, y: number, angle: number, speed: number, r: number, depth: number) {
    this.setTexture(tex).setPosition(x, y).setActive(true).setVisible(true).setDepth(depth);
    this.setScale(1).setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.speed = speed;
    this.rotation = angle + Math.PI / 2;
    this.r = r;
    this.dmg = 1;
    this.pierce = false;
    this.hitSet.clear();
    this.homing = false;
    this.target = null;
    this.turn = 0;
    this.accel = 0;
    this.life = 0;
    this.spin = 0;
    return this;
  }

  kill() {
    this.setActive(false).setVisible(false);
    this.target = null;
  }
}

export type EnemyKind =
  | 'fighter'
  | 'red'
  | 'kamikaze'
  | 'ace'
  | 'heavy'
  | 'bomber'
  | 'gunboat'
  | 'destroyer'
  | 'part'
  | 'core';

export interface EnemyDef {
  tex: string;
  hp: number;
  hw: number;
  hh: number;
  score: number;
  od: number;
  air: boolean;
  boom: 's' | 'm' | 'l';
}

export const EDEF: Record<Exclude<EnemyKind, 'part' | 'core'>, EnemyDef> = {
  fighter: { tex: 'en_fighter', hp: 3, hw: 18, hh: 16, score: 100, od: 2, air: true, boom: 's' },
  red: { tex: 'en_red', hp: 3, hw: 18, hh: 16, score: 300, od: 3, air: true, boom: 's' },
  kamikaze: { tex: 'en_fighter', hp: 2, hw: 16, hh: 16, score: 150, od: 2, air: true, boom: 's' },
  ace: { tex: 'en_ace', hp: 10, hw: 20, hh: 18, score: 600, od: 6, air: true, boom: 'm' },
  heavy: { tex: 'en_heavy', hp: 24, hw: 34, hh: 26, score: 900, od: 8, air: true, boom: 'm' },
  bomber: { tex: 'en_bomber', hp: 70, hw: 60, hh: 34, score: 3000, od: 16, air: true, boom: 'l' },
  gunboat: { tex: 'en_gunboat', hp: 16, hw: 16, hh: 44, score: 700, od: 5, air: false, boom: 'm' },
  destroyer: { tex: 'en_destroyer', hp: 60, hw: 24, hh: 82, score: 2500, od: 12, air: false, boom: 'l' },
};

export type Behavior = (e: Enemy, dt: number) => void;
export type FireFn = (e: Enemy) => void;

export interface TurretMount {
  img: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
}

export class Enemy extends Phaser.GameObjects.Image {
  kind: EnemyKind = 'fighter';
  hp = 1;
  maxHp = 1;
  hw = 10;
  hh = 10;
  score = 100;
  od = 1;
  air = true;
  boom: 's' | 'm' | 'l' = 's';
  t = 0;
  fireT = 0;
  fireEvery = 2;
  fire: FireFn | null = null;
  behavior: Behavior = () => {};
  shadow: Phaser.GameObjects.Image | null = null;
  turrets: TurretMount[] = [];
  flashT = 0;
  squad: Squad | null = null;
  drop: string | null = null;
  entered = false;
  dead = false;
  invuln = false;
  /** For boss parts: owner reference and local offset */
  owner: { onPartKilled(e: Enemy): void } | null = null;
  ox = 0;
  oy = 0;
  data2: Record<string, number> = {};

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'px');
    scene.add.existing(this);
  }

  hitFlash(big: boolean) {
    this.flashT = 0.05;
    if (big) this.setTint(0xff9a8a);
    else this.setTintFill(0xffffff);
  }
}

export class Squad {
  alive: number;
  killed = 0;
  escaped = false;
  constructor(
    public size: number,
    public reward: string,
  ) {
    this.alive = size;
  }
}

export class Item extends Phaser.GameObjects.Image {
  kind = 'P';
  t = 0;
  vx = 0;
  vy = 0;
  cycle = false;
  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'px');
    scene.add.existing(this);
    this.setActive(false).setVisible(false);
  }
  spawn(kind: string, x: number, y: number) {
    this.kind = kind;
    this.t = 0;
    this.cycle = kind === 'V' || kind === 'L' || kind === 'M';
    this.setTexture(kind === 'medal' ? 'item_medal' : 'item_' + kind)
      .setPosition(x, y)
      .setActive(true)
      .setVisible(true)
      .setScale(1);
    this.vx = Phaser.Math.Between(-50, 50);
    this.vy = -90;
    return this;
  }
  kill() {
    this.setActive(false).setVisible(false);
  }
}
