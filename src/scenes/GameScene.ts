import Phaser from 'phaser';
import { D, W, H, FONT, ERAS } from '../data/config';
import { t, themeName, fontLoc } from '../data/i18n';
import { run, prefs, maxArmor, maxBombs } from '../data/state';
import { themeFor, difficulty, loopOf, type Theme } from '../data/themes';
import { tk, setTextureEra } from '../gfx/textures';
import { Sound } from '../audio/sound';
import { Pool, Shot, Enemy, Item, EDEF, type EnemyKind, type Behavior, type FireFn } from '../objects/entities';
import { Player } from '../objects/player';
import { Boss } from '../objects/boss';
import { Fx } from '../systems/fx';
import { Hud } from '../systems/hud';
import { Director, homing } from '../systems/director';
import { World } from '../systems/world';
import { STAGE_STYLES, BOSS_STYLES, MISC_STYLES } from '../audio/styles';

type Phase = 'takeoff' | 'combat' | 'warning' | 'boss' | 'clear' | 'landing' | 'result' | 'over';

const DEG = Math.PI / 180;
const SHOT_R: Record<string, number> = { eb_orb: 5, eb_blue: 5, eb_big: 9, eb_needle: 4 };

interface Flyover {
  img: Phaser.GameObjects.Image;
  sh: Phaser.GameObjects.Image;
  vy: number;
  mid?: () => void;
}

export class GameScene extends Phaser.Scene {
  player!: Player;
  fx!: Fx;
  hud!: Hud;
  director: Director | null = null;
  boss: Boss | null = null;
  scrollSpeed = 40;
  theme!: Theme;
  diff!: ReturnType<typeof difficulty>;

  pShots!: Pool<Shot>;
  eShots!: Pool<Shot>;
  items!: Pool<Item>;
  enemyPool!: Pool<Enemy>;

  world!: World;
  private flyovers: Flyover[] = [];
  private carrier: Phaser.GameObjects.Image | null = null;
  private carrierVel = 0;
  private phase: Phase = 'takeoff';
  private phaseT = 0;
  private sub = '';
  private subT = 0;
  private hitStop = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private movePtr: number | null = null;
  private ignorePtr = new Set<number>();
  private tdx = 0;
  private tdy = 0;
  private padPrev: Record<string, boolean> = {};
  private resultReady = false;

  constructor() {
    super('Game');
  }

  get enemies() {
    return this.enemyPool.items;
  }

  get progress() {
    if (this.phase === 'combat' && this.director) return this.director.progress;
    if (this.phase === 'warning' || this.phase === 'boss') return 1;
    return -1;
  }

  create() {
    setTextureEra(run.era);
    this.theme = themeFor(run.stage);
    this.diff = difficulty(run.stage);
    this.flyovers = [];
    this.carrierGlow = [];
    this.boss = null;
    this.director = null;
    this.hitStop = 0;
    this.resultReady = false;
    this.ignorePtr.clear();
    this.movePtr = null;
    run.stageScore = 0;
    run.stageKills = 0;
    run.stageHits = 0;

    this.fx = new Fx(this);
    const space = run.era === 'future';
    this.world = new World(
      this,
      this.theme,
      this.fx,
      (w) =>
        w === 'land'
          ? this.hud.banner(space ? 'ORBITAL ZONE' : 'LANDFALL', t('landfall'), '#ffd080', 1400)
          : this.hud.banner(space ? 'DEEP SPACE' : 'OPEN SEA', t('backToSea'), '#80d0ff', 1200),
      space,
    );
    Sound.setEra(run.era);
    this.pShots = new Pool(() => new Shot(this));
    this.eShots = new Pool(() => new Shot(this));
    this.items = new Pool(() => new Item(this).setDepth(D.item));
    this.enemyPool = new Pool(() => new Enemy(this));
    this.player = new Player(this);
    this.hud = new Hud(this);

    this.setupInput();
    if (this.renderer.type === Phaser.WEBGL) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.32);
    this.cameras.main.fadeIn(500);

    const title = Sound.music('stage', STAGE_STYLES[this.theme.music], run.stage, run.era);
    this.time.delayedCall(2600, () => this.hud.nowPlaying(title));
    this.events.once('shutdown', () => {
      Sound.engineStop();
      Sound.ambience(false);
    });
    this.startTakeoff();
  }

  // ================================================================ input
  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Z,X,C,V,SHIFT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-X', () => this.useBomb());
    kb.on('keydown-SPACE', () => this.useBomb());
    kb.on('keydown-Z', () => this.player.tryRoll());
    kb.on('keydown-SHIFT', () => this.player.tryRoll());
    kb.on('keydown-C', () => this.player.tryOverdrive());
    kb.on('keydown-V', () => this.player.tryOverdrive());
    kb.on('keydown-P', () => this.pause());
    kb.on('keydown-ESC', () => this.pause());
    kb.on('keydown-M', () => {
      prefs.muted = !prefs.muted;
      Sound.setMuted(prefs.muted);
    });
    kb.on('keydown-ENTER', () => this.advanceResult());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      Sound.init();
      if (this.phase === 'result') {
        this.advanceResult();
        return;
      }
      if (this.ignorePtr.has(p.id) || this.hud.isOnButton(p.x, p.y)) return;
      if (this.movePtr === null) this.movePtr = p.id;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.movePtr || !p.isDown) return;
      this.tdx += (p.x - p.prevPosition.x) * 1.35;
      this.tdy += (p.y - p.prevPosition.y) * 1.35;
    });
    const up = (p: Phaser.Input.Pointer) => {
      this.ignorePtr.delete(p.id);
      if (p.id === this.movePtr) this.movePtr = null;
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);

    if (this.sys.game.device.input.touch) {
      const pb = this.add
        .text(W / 2, 30, '❚❚', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setDepth(D.hud)
        .setInteractive({ useHandCursor: true });
      pb.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.claimPointer(p.id);
        this.pause();
      });
    }
    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.events.once('shutdown', () => this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this));
  }

  private autoPause() {
    if (this.scene.isActive()) this.pause();
  }

  claimPointer(id: number) {
    this.ignorePtr.add(id);
  }

  private pause() {
    if (this.phase === 'result' || this.phase === 'over' || !this.scene.isActive()) return;
    this.scene.launch('Pause');
    this.scene.pause();
  }

  private readMove(): [number, number] {
    const k = this.keys;
    let kx = (k.LEFT.isDown || k.A.isDown ? -1 : 0) + (k.RIGHT.isDown || k.D.isDown ? 1 : 0);
    let ky = (k.UP.isDown || k.W.isDown ? -1 : 0) + (k.DOWN.isDown || k.S.isDown ? 1 : 0);
    const pad = this.input.gamepad?.pad1;
    if (pad) {
      const ax = pad.leftStick.x;
      const ay = pad.leftStick.y;
      if (Math.abs(ax) > 0.2) kx = ax;
      if (Math.abs(ay) > 0.2) ky = ay;
      if (pad.left) kx = -1;
      if (pad.right) kx = 1;
      if (pad.up) ky = -1;
      if (pad.down) ky = 1;
      const edge = (name: string, v: boolean, fn: () => void) => {
        if (v && !this.padPrev[name]) fn();
        this.padPrev[name] = v;
      };
      edge('A', pad.A, () => this.player.tryRoll());
      edge('B', pad.B, () => this.useBomb());
      edge('X', pad.X || pad.Y, () => this.player.tryOverdrive());
      edge('S', pad.buttons[9]?.pressed ?? false, () => this.pause());
    }
    const len = Math.hypot(kx, ky);
    if (len > 1) {
      kx /= len;
      ky /= len;
    }
    return [kx, ky];
  }

  // ================================================================ main loop
  override update(_t: number, delta: number) {
    let dt = Math.min(delta, 50) / 1000;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.2;
    }
    this.phaseT += dt;

    this.world.update(dt, this.scrollSpeed);
    this.updatePhase(dt);

    const [kx, ky] = this.readMove();
    const tb = this.hud.touch;
    if (tb.bomb) this.useBomb();
    if (tb.roll) this.player.tryRoll();
    if (tb.od) this.player.tryOverdrive();
    tb.bomb = tb.roll = tb.od = false;
    this.player.update(dt, kx, ky, this.tdx, this.tdy);
    this.tdx = this.tdy = 0;

    this.updateShots(dt);
    this.updateEnemies(dt);
    this.boss?.update(dt);
    if (this.boss && !this.boss.dead) this.hud.bossRatio = this.boss.hpRatio;
    this.updateItems(dt);
    this.updateFlyovers(dt);
    this.collide();
    this.hud.update();

  }

  // ================================================================ scenery
  // ================================================================ phases
  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.sub = '';
    this.subT = 0;
  }

  private startTakeoff() {
    this.setPhase('takeoff');
    this.scrollSpeed = 40;
    this.carrier = this.add.image(W / 2, 440, tk('carrier')).setDepth(D.carrier);
    const pl = this.player;
    pl.control = false;
    pl.x = W / 2 - 8;
    pl.y = 640;
    pl.setAlt(0);
    const loop = loopOf(run.stage);
    this.hud.banner(`STAGE ${run.stage}`, `${themeName(this.theme)}${loop > 1 ? `  (${t('loop', loop)})` : ''}`, '#9fd8ff', 2200);
    Sound.engineStart();
  }

  private updatePhase(dt: number) {
    const pl = this.player;
    switch (this.phase) {
      case 'takeoff': {
        const c = this.carrier!;
        const T0 = 2.2;
        const T1 = 2.6;
        const pt = this.phaseT;
        this.carrierWake(c);
        if (pt < T0) {
          Sound.engineThrottle((pt / T0) * 0.45);
          pl.x = W / 2 - 8 + Math.sin(pt * 60) * 0.4;
          if (Math.random() < 0.3) this.fx.smokePuff(pl.x + Phaser.Math.Between(-12, 12), pl.y + 26, 1);
        } else if (pt < T0 + T1) {
          if (this.sub === '') {
            this.sub = 'roll';
            Sound.sfx('launch');
            this.fx.smokePuff(pl.x, pl.y + 20, 6);
          }
          const p = (pt - T0) / T1;
          const e = p * p;
          const prev = c.y;
          pl.x = W / 2 - 8;
          pl.y = 640 - 140 * e;
          c.y = 440 + 380 * e;
          this.carrierVel = (c.y - prev) / Math.max(dt, 0.001);
          this.scrollSpeed = Math.max(40, this.carrierVel + 40);
          pl.setAlt(Math.max(0, (p - 0.6) / 0.4) * 0.35);
          Sound.engineThrottle(0.45 + 0.55 * p);
          if (Math.random() < 0.5) this.fx.smokePuff(pl.x, pl.y + 30, 1);
        } else {
          this.carrierVel = Phaser.Math.Linear(this.carrierVel, 120, dt * 1.5);
          c.y += this.carrierVel * dt;
          this.scrollSpeed = Phaser.Math.Linear(this.scrollSpeed, 140, dt * 2);
          pl.setAlt(pl.alt + dt * 0.6);
          pl.y = Phaser.Math.Linear(pl.y, H - 160, dt * 1.6);
          if (c.y - 340 > H) {
            c.destroy();
            this.carrier = null;
            this.carrierGlow.forEach((g) => g.destroy());
            this.carrierGlow = [];
            Sound.engineStop();
            pl.setAlt(1);
            pl.control = true;
            this.director = new Director(this, run.stage);
            this.world.scheduleLand(this.director.duration, 140);
            this.setPhase('combat');
            Sound.ambience(true);
            this.hud.banner('ENGAGE!', t('engage'), '#ffe060', 1000);
          }
        }
        break;
      }
      case 'combat':
        this.scrollSpeed = Phaser.Math.Linear(this.scrollSpeed, 140, dt);
        this.director?.update(dt);
        break;
      case 'warning':
        if (this.phaseT > 3.2) this.spawnBoss();
        break;
      case 'boss':
        // the ship boss sits on the water: slow the scroll so it reads as sailing
        if (this.boss?.kind === 'ship') this.scrollSpeed = Phaser.Math.Linear(this.scrollSpeed, 60, dt);
        break;
      case 'landing':
        this.updateLanding(dt);
        break;
      default:
        break;
    }
  }

  private carrierGlow: Phaser.GameObjects.Image[] = [];

  private carrierWake(c: Phaser.GameObjects.Image) {
    if (this.world.space) {
      // space carrier: main engine plumes at the stern
      if (!this.carrierGlow.length || !this.carrierGlow[0].active) {
        this.carrierGlow = [-40, 0, 40].map((dx) =>
          this.add.image(c.x + dx, c.y + 350, 'flash').setDepth(D.carrier - 0.1).setBlendMode(Phaser.BlendModes.ADD).setTint(0x40c8ff).setData('dx', dx),
        );
      }
      for (const g of this.carrierGlow) g.setPosition(c.x + (g.getData('dx') as number), c.y + 352).setScale(0.55 + Math.random() * 0.12, 0.9 + Math.random() * 0.25);
      if (Math.random() < 0.5) this.fx.spark(c.x + Phaser.Math.Between(-50, 50), c.y + 360, 1);
      return;
    }
    if (Math.random() < 0.7) this.fx.wake(c.x + Phaser.Math.Between(-80, 80), c.y + 330, 1);
    if (Math.random() < 0.4) this.fx.wake(c.x + (Math.random() < 0.5 ? -82 : 82), c.y + Phaser.Math.Between(-300, 300), 1);
  }

  startBossWarning() {
    if (this.phase !== 'combat') return;
    this.setPhase('warning');
    Sound.stopMusic(0.5);
    Sound.sfx('warning');
    this.hud.banner('WARNING', t('approaching', ERAS[run.era].bossNames[this.theme.boss]), '#ff3030', 2600);
    const bars = [80, H - 80].map((y) =>
      this.add.rectangle(W / 2, y, W, 26, 0xff2020, 0.35).setDepth(D.banner - 1),
    );
    this.tweens.add({ targets: bars, alpha: 0.05, yoyo: true, repeat: 5, duration: 260, onComplete: () => bars.forEach((b) => b.destroy()) });
  }

  private spawnBoss() {
    this.setPhase('boss');
    this.boss = new Boss(this, this.theme.boss, run.stage);
    this.hud.setBoss(this.boss.name);
    this.hud.nowPlaying(Sound.music('boss', BOSS_STYLES[this.boss.kind], run.stage, run.era));
  }

  bossDefeated(boss: Boss) {
    this.setPhase('clear');
    this.hitStop = 0.7;
    this.hud.setBoss(null);
    Sound.stopMusic(0.3);
    this.clearEnemyShots(true);
    const core = boss.core;
    for (const p of [...boss.parts]) this.killEnemy(p, true);
    for (const e of this.enemies) if (e.active && !e.dead && e !== core) this.killEnemy(e, true);
    this.fx.screenFlash(0xffffff, 0.9, 700);
    this.fx.explode(core.x, core.y, 'xl');
    for (let i = 0; i < 14; i++) {
      this.time.delayedCall(150 + i * 140, () => {
        this.fx.explode(core.x + Phaser.Math.Between(-core.hw, core.hw), core.y + Phaser.Math.Between(-core.hh, core.hh), i % 4 === 0 ? 'l' : 'm');
      });
    }
    this.time.delayedCall(2300, () => {
      this.fx.explode(core.x, core.y, 'xl');
      this.fx.screenFlash(0xfff0c0, 1, 900);
      this.removeEnemy(core);
      boss.destroyVisuals();
      this.boss = null;
      for (let i = 0; i < 10; i++) this.spawnItem('medal', core.x + Phaser.Math.Between(-80, 80), core.y + Phaser.Math.Between(-50, 50));
    });
    this.time.delayedCall(3300, () => {
      Sound.music('clear', MISC_STYLES.clear, run.stage, run.era, false);
      this.hud.banner('MISSION COMPLETE', t('missionSub'), '#60ff90', 2400);
    });
    this.time.delayedCall(5600, () => this.startLanding());
  }

  private startLanding() {
    Sound.ambience(false);
    this.setPhase('landing');
    this.sub = 'approach';
    this.player.control = false;
    this.clearEnemyShots(false);
    this.carrier = this.add.image(W / 2, -360, tk('carrier')).setDepth(D.carrier);
    this.carrierVel = 170;
    Sound.engineStart();
    Sound.engineThrottle(0.7);
  }

  private updateLanding(dt: number) {
    const pl = this.player;
    const c = this.carrier!;
    this.subT += dt;
    this.carrierWake(c);
    const deckX = W / 2 - 8;
    const landY = 560;
    if (this.sub === 'approach') {
      // auto-pull nearby items in so nothing is lost
      this.items.forActive((it) => {
        it.x = Phaser.Math.Linear(it.x, pl.x, dt * 4);
        it.y = Phaser.Math.Linear(it.y, pl.y, dt * 4);
      });
      pl.x = Phaser.Math.Linear(pl.x, deckX, Math.min(1, dt * 2.2));
      pl.y = Phaser.Math.Linear(pl.y, landY, Math.min(1, dt * 2.2));
      c.y += this.carrierVel * dt;
      this.scrollSpeed = this.carrierVel + 30;
      const wires = c.y + 200;
      const dist = pl.y - wires;
      pl.setAlt(Phaser.Math.Clamp(dist / 320, 0, 1));
      Sound.engineThrottle(0.3 + 0.4 * pl.alt);
      if (dist <= 0) {
        pl.x = deckX;
        pl.y = landY;
        pl.setAlt(0);
        this.sub = 'brake';
        this.subT = 0;
        Sound.sfx('touchdown');
        this.cameras.main.shake(200, 0.006);
        for (const dx of [-14, 14]) this.fx.smokePuff(pl.x + dx, pl.y + 10, 4);
      }
    } else if (this.sub === 'brake') {
      const p = Math.min(1, this.subT / 1.5);
      this.carrierVel = 170 * (1 - Phaser.Math.Easing.Quadratic.Out(p));
      c.y += this.carrierVel * dt;
      this.scrollSpeed = this.carrierVel + 30;
      pl.x = deckX;
      pl.y = landY + Math.sin(this.subT * 30) * (1 - p) * 1.2;
      Sound.engineThrottle(0.3 * (1 - p));
      if (Math.random() < 0.4 * (1 - p)) this.fx.smokePuff(pl.x, pl.y + 18, 1);
      if (p >= 1) {
        this.sub = 'stopped';
        this.subT = 0;
        Sound.engineStop();
        this.hud.banner('LANDED', t('landedSub'), '#9fd8ff', 1200);
      }
    } else if (this.sub === 'stopped') {
      this.scrollSpeed = 30;
      if (this.subT > 1.6) this.showResult();
    }
  }

  // ================================================================ result
  private resultPanel: Phaser.GameObjects.GameObject[] = [];

  private showResult() {
    this.setPhase('result');
    const clearBonus = 10000 * run.stage;
    const perfect = run.stageHits === 0 ? 50000 * Math.ceil(run.stage / 2) : 0;
    const kills = run.stageKills;
    run.score += clearBonus + perfect;
    run.stageScore += clearBonus + perfect;
    const credits = Math.floor(run.stageScore / 40) + 250 * run.stage;
    run.credits += credits;
    prefs.setHi(run.era, run.score);
    // stage-clear reward: two power attacks (SPACE / X), allowed beyond the bay limit
    run.bombs += 2;
    if (run.stage % 10 === 0) {
      run.lives++;
      this.time.delayedCall(2400, () => {
        Sound.sfx('oneup');
        this.hud.banner('EXTEND!', t('extend'), '#ff60c0', 1600);
      });
    }

    const add = this.add;
    const bg = add.rectangle(W / 2, H / 2 + 10, W - 40, 420, 0x05101c, 0.86).setStrokeStyle(2, 0x6ab0ff, 0.8).setDepth(D.banner);
    this.resultPanel.push(bg);
    const lines: [string, string][] = [
      [t('rKills'), `${kills}`],
      [t('rStage'), run.stageScore.toLocaleString()],
      [t('rClear'), `+${clearBonus.toLocaleString()}`],
      [t('rPerfect'), perfect ? `+${perfect.toLocaleString()}` : '—'],
      [t('rCredits'), `+${credits.toLocaleString()} CR`],
      [t('rBomb'), `+2  (${run.bombs})`],
      [t('rTotal'), run.score.toLocaleString()],
    ];
    const title = add
      .text(W / 2, H / 2 - 160, `STAGE ${run.stage} CLEAR`, { fontFamily: FONT, fontSize: '30px', color: '#60ff90', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(D.banner);
    this.resultPanel.push(title);
    lines.forEach(([k, v], i) => {
      this.time.delayedCall(300 + i * 280, () => {
        Sound.sfx('tick');
        const y = H / 2 - 100 + i * 42;
        const a = add.text(50, y, k, { fontFamily: fontLoc(), fontSize: '19px', color: '#cfe6ff' }).setDepth(D.banner);
        const b = add
          .text(W - 50, y, v, { fontFamily: FONT, fontSize: '20px', color: i === 4 ? '#ffd040' : '#ffffff' })
          .setOrigin(1, 0)
          .setDepth(D.banner);
        this.resultPanel.push(a, b);
      });
    });
    this.time.delayedCall(300 + lines.length * 280 + 300, () => {
      this.resultReady = true;
      const tip = add
        .text(W / 2, H / 2 + 185, this.sys.game.device.input.touch ? t('rTapHangar') : t('rEnterHangar'), { fontFamily: fontLoc(), fontSize: '17px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(D.banner);
      this.tweens.add({ targets: tip, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
    });
  }

  private advanceResult() {
    if (this.phase !== 'result' || !this.resultReady) return;
    this.resultReady = false;
    Sound.sfx('confirm');
    this.cameras.main.fadeOut(400);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Hangar'));
  }

  // ================================================================ spawning
  spawnEnemy(kind: Exclude<EnemyKind, 'part' | 'core'>, x: number, y: number, behavior: Behavior): Enemy {
    const def = EDEF[kind];
    const e = this.enemyPool.get();
    this.resetEnemy(e, tk(def.tex), def.air ? D.enemyAir : D.ground);
    e.kind = kind;
    e.hp = e.maxHp = def.hp * this.diff.hp;
    e.hw = def.hw;
    e.hh = def.hh;
    e.score = def.score;
    e.od = def.od;
    e.air = def.air;
    e.boom = def.boom;
    e.behavior = behavior;
    e.setPosition(x, y);
    const fire = this.fireFor(kind);
    e.fire = fire[0];
    e.fireEvery = fire[1];
    e.fireT = 0.6 + Math.random() * 1.2;
    if (kind === 'kamikaze') e.setTint(0xffb0a0);
    if (def.air) {
      if (!e.shadow) e.shadow = this.add.image(0, 0, 'px');
      e.shadow.setTexture(tk(def.tex) + '_sh').setDepth(D.shadow).setVisible(true).setScale(0.85);
    } else e.shadow?.setVisible(false);
    const mounts = kind === 'gunboat' || kind === 'tank' ? [-6] : kind === 'destroyer' ? [-49, 49] : kind === 'flak' || kind === 'aagun' ? [0] : kind === 'sam' ? [6] : [];
    while (e.turrets.length < mounts.length) e.turrets.push({ img: this.add.image(0, 0, tk('turret')), ox: 0, oy: 0 });
    e.turrets.forEach((tm, i) => {
      const on = i < mounts.length;
      tm.img.setVisible(on).setActive(on).setTexture(tk(kind === 'flak' ? 'turret_big' : kind === 'sam' ? 'sam_rack' : 'turret')).setDepth(D.ground + 1);
      tm.oy = on ? mounts[i] : 0;
    });
    return e;
  }

  spawnBossPiece(tex: string, hp: number, hw: number, hh: number, depth: number): Enemy {
    const e = this.enemyPool.get();
    this.resetEnemy(e, tex, depth);
    e.hp = e.maxHp = hp;
    e.hw = hw;
    e.hh = hh;
    e.air = depth >= D.enemyAir;
    e.boom = 'm';
    e.od = 6;
    e.shadow?.setVisible(false);
    e.turrets.forEach((t) => t.img.setVisible(false).setActive(false));
    return e;
  }

  private resetEnemy(e: Enemy, tex: string, depth: number) {
    e.setTexture(tex).setActive(true).setVisible(true).setRotation(0).setScale(1).setAlpha(1).clearTint().setDepth(depth);
    e.t = 0;
    e.flashT = -1;
    e.squad = null;
    e.drop = null;
    e.entered = false;
    e.dead = false;
    e.invuln = false;
    e.owner = null;
    e.ox = e.oy = 0;
    e.data2 = {};
    e.fire = null;
    e.behavior = () => {};
  }

  private fireFor(kind: EnemyKind): [FireFn | null, number] {
    const bs = this.diff.bulletSpeed;
    const ex = this.diff.extraBullets;
    switch (kind) {
      case 'fighter':
        return [(e) => this.fan(e.x, e.y + 10, 1, 0, 185 * bs, 'eb_orb'), run.stage < 2 ? 3.2 : 2.6];
      case 'ace':
        return [(e) => this.fan(e.x, e.y + 10, 3, 22, 230 * bs, 'eb_needle'), 1.4];
      case 'heavy':
        return [(e) => this.fan(e.x, e.y + 20, 5 + ex, 50, 170 * bs, 'eb_orb'), 2.0];
      case 'bomber':
        return [
          (e) => {
            this.ring(e.x, e.y, 12 + ex * 2, 130 * bs, e.t, 'eb_blue');
            this.fan(e.x, e.y + 30, 3, 20, 200 * bs, 'eb_orb');
          },
          2.4,
        ];
      case 'gunboat':
        return [(e) => e.turrets[0] && this.fan(e.turrets[0].img.x, e.turrets[0].img.y, 1, 0, 200 * bs, 'eb_orb'), 1.9];
      case 'tank':
        return [(e) => e.turrets[0] && this.fan(e.turrets[0].img.x, e.turrets[0].img.y, 1, 0, 190 * bs, 'eb_orb'), 2.2];
      case 'flak':
        return [(e) => this.fan(e.x, e.y, 3 + ex, 26, 230 * bs, 'eb_needle'), 1.7];
      case 'sam':
        return [(e) => this.launchMissile(e.turrets[0]?.img.x ?? e.x, e.turrets[0]?.img.y ?? e.y), 3.4];
      case 'infantry':
        return [
          (e) => {
            for (let i = 0; i < 3; i++) this.fan(e.x + Phaser.Math.Between(-18, 18), e.y + Phaser.Math.Between(-12, 12), 1, 0, 165 * bs, 'eb_orb');
          },
          1.7,
        ];
      case 'aagun':
        return [(e) => this.stream(e, 5 + ex, 0.08, 250 * bs, 'eb_needle'), 2.3];
      case 'gunship':
        if (run.era === 'modern') return [(e) => this.stream(e, 6 + ex, 0.09, 230 * bs, 'eb_orb'), 2.2];
        if (run.era === 'future') return [(e) => this.ring(e.x, e.y, 6 + ex, 150 * bs, e.t, 'eb_blue'), 1.8];
        return [(e) => this.fan(e.x, e.y, 1, 0, 200 * bs, 'eb_orb'), 2.4];
      case 'destroyer':
        return [
          (e) => {
            for (const tm of e.turrets) if (tm.img.active) this.burst(tm.img.x, tm.img.y, 3, 0.12, 210 * bs, 'eb_orb');
          },
          2.0,
        ];
      default:
        return [null, 99];
    }
  }

  // ---------------------------------------------------------------- bullet patterns
  aim(x: number, y: number) {
    return Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
  }

  eShot(x: number, y: number, angle: number, speed: number, tex = 'eb_orb') {
    return this.eShots.get().fire(tex, x, y, angle, speed, SHOT_R[tex] ?? 5, D.eShot);
  }

  fan(x: number, y: number, n: number, spreadDeg: number, speed: number, tex = 'eb_orb') {
    const base = this.aim(x, y);
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : base + (i / (n - 1) - 0.5) * spreadDeg * DEG;
      this.eShot(x, y, a, speed, tex);
    }
  }

  ring(x: number, y: number, n: number, speed: number, offset: number, tex = 'eb_orb') {
    for (let i = 0; i < n; i++) this.eShot(x, y, offset + (i / n) * Math.PI * 2, speed, tex);
  }

  burst(x: number, y: number, n: number, interval: number, speed: number, tex = 'eb_orb') {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * interval * 1000, () => {
        if (this.phase === 'combat' || this.phase === 'boss') this.fan(x, y, 1, 0, speed, tex);
      });
    }
  }

  /** Fire `n` shots from an enemy's current position (follows it as it moves). */
  stream(e: Enemy, n: number, interval: number, speed: number, tex = 'eb_orb') {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * interval * 1000, () => {
        if (e.active && !e.dead && (this.phase === 'combat' || this.phase === 'boss')) this.fan(e.x, e.y + 10, 1, 0, speed, tex);
      });
    }
  }

  /** Straight-down bomb drop (dive bombers). */
  dropBombs(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 140, () => {
        const b = this.eShot(x + (i - (n - 1) / 2) * 14, y, Math.PI / 2, 120 * this.diff.bulletSpeed, 'eb_big');
        b.setScale(0.8);
      });
    }
  }

  /** Surface-to-air guided missile: a shootable air enemy that homes for a few seconds. */
  launchMissile(x: number, y: number) {
    const m = this.spawnEnemy('missile', x, y, homing(this, 140 * this.diff.bulletSpeed, 360, 300 * this.diff.bulletSpeed, 2.4, 2.8));
    m.data2.missile = 1;
    m.rotation = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y) - Math.PI / 2;
    m.data2.h = m.rotation + Math.PI / 2;
    m.entered = true;
    Sound.sfx('samLaunch');
    this.fx.smokePuff(x, y, 3);
    return m;
  }

  spawnPShot(tex: string, x: number, y: number, angle: number, speed: number, r: number, dmg: number) {
    const s = this.pShots.get().fire(tex, x, y, angle, speed, r, D.pShot);
    s.dmg = dmg;
    s.setBlendMode(Phaser.BlendModes.ADD);
    return s;
  }

  nearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (!e.active || e.dead || e.invuln || e.y < 0 || e.y > H || e.x < 0 || e.x > W) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  spawnItem(kind: string, x: number, y: number) {
    return this.items.get().spawn(kind, Phaser.Math.Clamp(x, 30, W - 30), y);
  }

  supplyDrop() {
    this.hud.banner('SUPPLY DROP', t('supply'), '#60c0ff', 1300);
    const x = Phaser.Math.Between(120, W - 120);
    const img = this.add.image(x, H + 80, tk('transport')).setDepth(D.flyover).setScale(0.8);
    const sh = this.add.image(x, H + 80, tk('transport') + '_sh').setDepth(D.shadow).setScale(0.7);
    let dropped = false;
    this.flyovers.push({
      img,
      sh,
      vy: -150,
      mid: () => {
        if (dropped) return;
        dropped = true;
        const extra = run.wingmen < 2 && Math.random() < 0.5 ? 'E' : Phaser.Utils.Array.GetRandom(['R', 'S', 'B']);
        this.spawnItem(['V', 'L', 'M'][Phaser.Math.Between(0, 2)], img.x - 30, img.y);
        this.spawnItem(extra, img.x + 30, img.y);
        Sound.sfx('item');
      },
    });
  }

  private updateFlyovers(dt: number) {
    for (let i = this.flyovers.length - 1; i >= 0; i--) {
      const f = this.flyovers[i];
      f.img.y += f.vy * dt;
      f.sh.setPosition(f.img.x + 50, f.img.y + 90);
      if (f.mid && f.img.y < H * 0.45) f.mid();
      if (f.img.y < -150) {
        f.img.destroy();
        f.sh.destroy();
        this.flyovers.splice(i, 1);
      }
    }
  }

  // ================================================================ updates
  private updateShots(dt: number) {
    this.pShots.forActive((s) => {
      if (s.homing) {
        if (!s.target || !s.target.active || s.target.dead) s.target = this.nearestEnemy(s.x, s.y);
        s.speed = Math.min(s.speed + s.accel * dt, 900);
        let a = Math.atan2(s.vy, s.vx);
        if (s.target) a = Phaser.Math.Angle.RotateTo(a, Phaser.Math.Angle.Between(s.x, s.y, s.target.x, s.target.y), s.turn * dt);
        s.vx = Math.cos(a) * s.speed;
        s.vy = Math.sin(a) * s.speed;
        s.rotation = a + Math.PI / 2;
        if (run.era !== 'future' && Math.random() < 0.3) this.fx.smokePuff(s.x - s.vx * 0.02, s.y - s.vy * 0.02, 1);
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -40 || s.y > H + 40 || s.x < -40 || s.x > W + 40) s.kill();
    });
    this.eShots.forActive((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.texture.key === 'eb_blue' || s.texture.key === 'eb_orb') s.rotation += dt * 6;
      if (s.y < -30 || s.y > H + 30 || s.x < -30 || s.x > W + 30) s.kill();
    });
  }

  private updateEnemies(dt: number) {
    const pl = this.player;
    const firing = (this.phase === 'combat' || this.phase === 'boss' || this.phase === 'warning') && pl.alive;
    for (const e of this.enemies) {
      if (!e.active || e.dead) {
        if (e.active && e.dead && e.kind === 'core') {
          // core is mid-explosion; keep it shaking
          e.x += Phaser.Math.Between(-2, 2);
        }
        continue;
      }
      e.t += dt;
      if (!e.owner) e.behavior(e, dt);
      if (e.flashT > -1) {
        const was = e.flashT;
        e.flashT -= dt;
        if (was > 0 && e.flashT <= 0) {
          e.clearTint();
          if (e.kind === 'kamikaze') e.setTint(0xffb0a0);
        }
      }
      e.shadow?.setPosition(e.x + 18, e.y + 30).setRotation(e.rotation);
      for (const tm of e.turrets) {
        if (!tm.img.active) continue;
        tm.img.setPosition(e.x + tm.ox, e.y + tm.oy);
        tm.img.rotation = Phaser.Math.Angle.Between(tm.img.x, tm.img.y, pl.x, pl.y) + Math.PI / 2;
      }
      if (e.data2.missile && Math.random() < 0.7) this.fx.smokePuff(e.x - Math.cos(e.data2.h) * 14, e.y - Math.sin(e.data2.h) * 14, 1);
      if (!e.air && !e.owner && Math.random() < 0.25 && !this.world.isLandAt(e.y)) this.fx.wake(e.x + Phaser.Math.Between(-e.hw, e.hw), e.y - e.hh, 1);
      if (e.hp < e.maxHp * 0.4 && e.maxHp > 8 && Math.random() < 0.25) this.fx.smokePuff(e.x + Phaser.Math.Between(-e.hw, e.hw) * 0.5, e.y, 1);

      if (firing && e.fire) {
        e.fireT -= dt * this.diff.fireRate;
        if (e.fireT <= 0) {
          e.fireT = e.fireEvery * (0.8 + Math.random() * 0.4);
          if (e.y > 10 && e.y < H * 0.72 && e.x > 0 && e.x < W && pl.y - e.y > 60) e.fire(e);
        }
      }

      const onScreen = e.y > -e.hh && e.y < H + e.hh && e.x > -e.hw && e.x < W + e.hw;
      if (onScreen) e.entered = true;
      if (!e.owner) {
        const gone = e.y > H + 140 || e.y < -260 || e.x < -200 || e.x > W + 200;
        if ((e.entered && !onScreen && gone) || (!e.entered && e.t > 14)) {
          if (e.squad) e.squad.escaped = true;
          this.removeEnemy(e);
        }
      }
    }
  }

  private updateItems(dt: number) {
    const pl = this.player;
    this.items.forActive((it) => {
      it.t += dt;
      it.vy = Math.min(70, it.vy + 160 * dt);
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.vx *= 0.99;
      if (it.x < 24 || it.x > W - 24) it.vx = -it.vx;
      it.x = Phaser.Math.Clamp(it.x, 24, W - 24);
      it.setScale(1 + Math.sin(it.t * 6) * 0.08);
      if (it.cycle) {
        const order = ['V', 'L', 'M'];
        const k = order[Math.floor(it.t / 2.2) % 3];
        if (k !== it.kind) {
          it.kind = k;
          it.setTexture('item_' + k);
        }
      }
      if (pl.alive) {
        const d = Phaser.Math.Distance.Between(it.x, it.y, pl.x, pl.y);
        if (d < 100) {
          it.x = Phaser.Math.Linear(it.x, pl.x, dt * 5);
          it.y = Phaser.Math.Linear(it.y, pl.y, dt * 5);
        }
        if (d < 30) {
          this.applyItem(it.kind, it.x, it.y);
          it.kill();
          return;
        }
      }
      if (it.y > H + 40) it.kill();
    });
  }

  private applyItem(kind: string, x: number, y: number) {
    const pl = this.player;
    const add = (n: number) => {
      run.score += n;
      run.stageScore += n;
    };
    add(200);
    const weaponName = ERAS[run.era].weapons;
    switch (kind) {
      case 'P':
        if (run.power < 5) {
          run.power++;
          this.fx.text(x, y, run.power === 5 ? 'MAX POWER!' : 'POWER UP', '#ff8060', 16);
          Sound.sfx('power');
        } else {
          add(5000);
          this.fx.text(x, y, '+5000', '#ffe080');
          Sound.sfx('medal');
        }
        break;
      case 'V':
      case 'L':
      case 'M':
        if (run.weapon === kind) {
          if (run.power < 5) run.power++;
          else add(5000);
        } else run.weapon = kind;
        this.fx.text(x, y, weaponName[kind], '#80e0ff', 16);
        Sound.sfx('power');
        break;
      case 'B':
        run.bombs = Math.min(maxBombs(), run.bombs + 1);
        this.fx.text(x, y, 'BOMB +1', '#c080ff');
        Sound.sfx('item');
        break;
      case 'S':
        pl.shield = true;
        this.fx.text(x, y, 'SHIELD', '#60b0ff');
        Sound.sfx('item');
        break;
      case 'E':
        if (run.wingmen < 2) {
          run.wingmen++;
          pl.syncWingmen();
          this.fx.text(x, y, 'WINGMAN JOINED', '#ffffff');
        } else {
          add(3000);
          this.fx.text(x, y, '+3000', '#ffe080');
        }
        Sound.sfx('power');
        break;
      case 'R':
        pl.armor = Math.min(maxArmor(), pl.armor + 1);
        this.fx.text(x, y, 'REPAIR', '#60ff90');
        Sound.sfx('item');
        break;
      case '1UP':
        run.lives++;
        this.fx.text(x, y, '1UP!', '#ff60c0', 18);
        Sound.sfx('oneup');
        break;
      case 'medal': {
        const v = 500 * (1 + Math.floor(run.stage / 2));
        add(v);
        this.fx.text(x, y, `+${v}`, '#ffd040', 12);
        Sound.sfx('medal');
        break;
      }
    }
  }

  // ================================================================ combat
  private collide() {
    const pl = this.player;
    const list = this.enemies;
    this.pShots.forActive((s) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (!e.active || e.dead) continue;
        if (e.y < -e.hh * 0.5 || e.y > H + e.hh) continue;
        if (Math.abs(s.x - e.x) < e.hw + s.r && Math.abs(s.y - e.y) < e.hh + s.r) {
          if (s.pierce) {
            if (s.hitSet.has(e)) continue;
            s.hitSet.add(e);
            this.damageEnemy(e, s.dmg);
            this.fx.hit(s.x, s.y);
          } else {
            this.damageEnemy(e, s.dmg);
            this.fx.hit(s.x, s.y - 6);
            s.kill();
            return;
          }
        }
      }
    });

    if (!pl.vulnerable) return;
    let hit = false;
    this.eShots.forActive((s) => {
      if (hit) return;
      const r = s.r + 4;
      if ((s.x - pl.x) ** 2 + (s.y - pl.y) ** 2 < r * r) {
        s.kill();
        hit = true;
      }
    });
    if (!hit) {
      for (const e of list) {
        if (!e.active || e.dead || !e.air || e.owner) continue;
        if (Math.abs(e.x - pl.x) < e.hw * 0.7 + 10 && Math.abs(e.y - pl.y) < e.hh * 0.7 + 12) {
          this.damageEnemy(e, 10);
          hit = true;
          break;
        }
      }
    }
    if (hit) this.hurtPlayer();
  }

  damageEnemy(e: Enemy, dmg: number) {
    if (e.dead) return;
    if (e.invuln) {
      Sound.sfx('armor');
      return;
    }
    e.hp -= dmg;
    if (e.flashT <= -0.08) e.hitFlash(e.maxHp > 150);
    if (e.owner) this.player.addOd(dmg * 0.03);
    if (e.hp <= 0) this.killEnemy(e);
    else Sound.sfx(e.maxHp > 20 ? 'armor' : 'hit');
  }

  killEnemy(e: Enemy, silentScore = false) {
    if (e.dead) return;
    e.dead = true;
    if (!silentScore || e.kind === 'part') {
      run.score += e.score;
      run.stageScore += e.score;
      run.stageKills++;
      this.player.addOd(e.od);
      if (e.score >= 500) this.fx.text(e.x, e.y, e.score.toLocaleString(), '#ffffff', e.score >= 2000 ? 18 : 13);
    }
    if (e.kind === 'core') {
      e.owner?.onPartKilled(e);
      return;
    }
    this.fx.explode(e.x, e.y, e.boom);
    if (e.squad) {
      const sq = e.squad;
      sq.killed++;
      if (sq.killed === sq.size && !sq.escaped) {
        this.spawnItem(sq.reward, e.x, e.y);
        run.score += 2000;
        run.stageScore += 2000;
        this.fx.text(e.x, e.y - 24, 'SQUADRON BONUS 2000', '#ffd040', 15);
      }
    }
    if (!silentScore) this.rollDrop(e);
    e.owner?.onPartKilled(e);
    this.removeEnemy(e);
  }

  private rollDrop(e: Enemy) {
    if (e.drop) {
      this.spawnItem(e.drop, e.x, e.y);
      if (e.data2.mid) this.spawnItem(['V', 'L', 'M'][Phaser.Math.Between(0, 2)], e.x + 40, e.y);
      return;
    }
    const r = Math.random();
    const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
    switch (e.kind) {
      case 'heavy':
        if (r < 0.3) this.spawnItem(pick(['P', 'V', 'L', 'M', 'B', 'R']), e.x, e.y);
        break;
      case 'ace':
        if (r < 0.2) this.spawnItem(pick(['medal', 'P', 'R']), e.x, e.y);
        break;
      case 'bomber':
        this.spawnItem(pick(['P', 'B', 'R', 'S']), e.x, e.y);
        break;
      case 'truck':
        if (r < 0.55) this.spawnItem(pick(['P', 'B', 'R', 'S', 'medal']), e.x, e.y);
        break;
      case 'missile':
        break;
      case 'gunship':
        if (r < 0.2) this.spawnItem(pick(['P', 'medal', 'R']), e.x, e.y);
        break;
      case 'gunboat':
      case 'destroyer':
      case 'tank':
      case 'flak':
      case 'sam':
      case 'aagun':
      case 'infantry':
        if (r < 0.22) this.spawnItem(pick(['P', 'R', 'B', 'medal']), e.x, e.y);
        break;
      case 'part':
        if (r < 0.3) this.spawnItem(pick(['medal', 'R']), e.x, e.y);
        break;
      default:
        if (r < 0.04) this.spawnItem('medal', e.x, e.y);
    }
  }

  removeEnemy(e: Enemy) {
    e.setActive(false).setVisible(false);
    e.dead = true;
    e.shadow?.setVisible(false);
    for (const t of e.turrets) t.img.setVisible(false).setActive(false);
  }

  private clearEnemyShots(score: boolean) {
    this.eShots.forActive((s) => {
      if (score) {
        run.score += 10;
        run.stageScore += 10;
      }
      this.fx.spark(s.x, s.y, 1);
      s.kill();
    });
  }

  private hurtPlayer() {
    const pl = this.player;
    if (!pl.vulnerable) return;
    if (pl.shield) {
      pl.shield = false;
      pl.invuln = 1.2;
      Sound.sfx('shieldBreak');
      this.fx.ring(pl.x, pl.y, 1.4, 400, 0x60b0ff);
      return;
    }
    pl.armor--;
    run.stageHits++;
    pl.invuln = 1.6;
    Sound.sfx('playerHit');
    this.cameras.main.shake(220, 0.012);
    this.fx.screenFlash(0xff2020, 0.35, 250);
    this.fx.explode(pl.x, pl.y, 's');
    if (pl.armor <= 0) this.killPlayer();
  }

  private killPlayer() {
    const pl = this.player;
    pl.alive = false;
    pl.control = false;
    pl.shield = false;
    pl.odT = 0;
    pl.od = 0;
    this.fx.explode(pl.x, pl.y, 'l');
    this.clearEnemyShots(false);
    run.lives--;
    this.hud.update();
    run.wingmen = 0;
    pl.syncWingmen();
    if (run.lives <= 0) {
      this.time.delayedCall(2200, () => {
        this.setPhase('over');
        prefs.setHi(run.era, run.score);
        Sound.stopMusic(1);
        this.cameras.main.fadeOut(800);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameOver'));
      });
      return;
    }
    run.power = Math.max(1, run.power - 1);
    this.time.delayedCall(1500, () => {
      pl.alive = true;
      pl.armor = maxArmor();
      run.bombs = Math.max(run.bombs, 2);
      pl.x = W / 2;
      pl.y = H + 60;
      pl.invuln = 3.5;
      this.tweens.add({
        targets: pl,
        y: H - 150,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (this.phase === 'combat' || this.phase === 'boss' || this.phase === 'warning') pl.control = true;
        },
      });
    });
  }

  private useBomb() {
    const pl = this.player;
    if (!pl.alive || !pl.control || run.bombs <= 0) return;
    run.bombs--;
    pl.invuln = Math.max(pl.invuln, 2.6);
    Sound.sfx('bomb');
    this.fx.screenFlash(0xffffff, 0.75, 600);
    this.fx.ring(pl.x, pl.y, 6, 700, 0xffe0a0);
    this.clearEnemyShots(true);
    this.hud.banner(ERAS[run.era].bomb, '', '#ffb060', 700);
    // friendly bomber flyover
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 140;
      const img = this.add.image(x, H + 100 + Math.abs(i - 1) * 60, tk('transport')).setDepth(D.flyover).setScale(0.9);
      const sh = this.add.image(x, H + 100, tk('transport') + '_sh').setDepth(D.shadow).setScale(0.8);
      this.flyovers.push({ img, sh, vy: -900 });
    }
    const dm = pl.dmgMul;
    const blast = () => {
      for (const e of this.enemies) {
        if (e.active && !e.dead && e.y > -20 && e.y < H + 20) this.damageEnemy(e, 22 * dm);
      }
      this.clearEnemyShots(true);
    };
    blast();
    this.time.delayedCall(550, blast);
    for (let i = 0; i < 16; i++) {
      this.time.delayedCall(150 + i * 60, () => {
        this.fx.explode(Phaser.Math.Between(30, W - 30), Phaser.Math.Between(60, H - 120), i % 3 === 0 ? 'm' : 's');
      });
    }
    this.cameras.main.shake(900, 0.012);
  }
}
