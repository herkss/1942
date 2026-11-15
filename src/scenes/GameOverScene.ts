import Phaser from 'phaser';
import { W, H, FONT } from '../data/config';
import { run, prefs, MAX_CONTINUES } from '../data/state';
import { t, eraName, fontLoc, FONT_ANY } from '../data/i18n';
import { Sound } from '../audio/sound';
import { MISC_STYLES } from '../audio/styles';
import { submitScore, fetchTop, nick, type ScoreRow } from '../net/leaderboard';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export class GameOverScene extends Phaser.Scene {
  private done = false;
  private submitted = false;
  private status!: Phaser.GameObjects.Text;
  private board: Phaser.GameObjects.Text[] = [];
  private form: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super('GameOver');
  }

  create() {
    this.done = false;
    this.submitted = false;
    this.board = [];
    prefs.setHi(run.era, run.score);
    // free keys the gameplay scene captured so typing works in the form
    this.input.keyboard!.clearCaptures();

    this.add.rectangle(W / 2, H / 2, W, H, 0x05080c);
    const title = this.add
      .text(W / 2, 70, 'GAME OVER', { fontFamily: FONT, fontSize: '50px', color: '#ff4040', stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 90, duration: 900, ease: 'Cubic.easeOut' });
    this.add.text(W / 2, 140, `${eraName(run.era)}  ·  STAGE ${run.stage}`, { fontFamily: fontLoc(), fontSize: '17px', color: '#cfe6ff' }).setOrigin(0.5);
    this.add.text(W / 2, 172, `SCORE  ${run.score.toLocaleString()}`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(W / 2, 204, `HI-SCORE  ${prefs.hi(run.era).toLocaleString()}`, { fontFamily: FONT, fontSize: '15px', color: '#ffd860' }).setOrigin(0.5);

    // ranking form (DOM so mobile keyboards & IME for 한국어/日本語 work)
    this.add.text(W / 2, 244, t('regTitle'), { fontFamily: fontLoc(), fontSize: '16px', color: '#9fd8ff' }).setOrigin(0.5);
    const inputCss =
      'width:300px;padding:9px 10px;margin:4px 0;border-radius:6px;border:2px solid #3a6a96;background:#0b1a2a;color:#fff;font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;';
    const html = `
      <form style="display:flex;flex-direction:column;align-items:center;font-family:'Black Han Sans','Dela Gothic One',sans-serif">
        <input name="nick" maxlength="12" autocomplete="nickname" placeholder="${esc(t('nickPh'))}" value="${esc(nick.get())}" style="${inputCss}" />
        <input name="msg" maxlength="40" placeholder="${esc(t('msgPh'))}" style="${inputCss}" />
        <button type="submit" style="margin-top:6px;width:300px;padding:10px;border:0;border-radius:6px;background:#d0a020;color:#1a1000;font-size:18px;font-family:inherit;cursor:pointer">${esc(t('submit'))}</button>
      </form>`;
    this.form = this.add.dom(W / 2, 326).createFromHTML(html);
    const el = this.form.node as HTMLElement;
    const formEl = el.querySelector('form')!;
    // keep keystrokes away from Phaser's global keyboard handler
    formEl.addEventListener('keydown', (e) => e.stopPropagation());
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit(formEl);
    });
    this.status = this.add.text(W / 2, 404, '', { fontFamily: fontLoc(), fontSize: '15px', color: '#ffd860' }).setOrigin(0.5);

    // mini leaderboard
    void this.loadBoard();

    const left = MAX_CONTINUES - run.continues;
    const cont = this.add
      .text(W / 2, H - 110, left > 0 ? t('continueBtn', left) : t('noContinue'), {
        fontFamily: fontLoc(),
        fontSize: left > 0 ? '22px' : '17px',
        color: left > 0 ? '#ffffff' : '#ff9090',
        backgroundColor: left > 0 ? '#20603a' : '#2a1414',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5);
    if (left > 0) cont.setInteractive({ useHandCursor: true });
    const quit = this.add
      .text(W / 2, H - 52, t('toTitle'), { fontFamily: fontLoc(), fontSize: '18px', color: '#cfe6ff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    if (left > 0) this.add.text(W / 2, H - 18, t('contNote'), { fontFamily: fontLoc(), fontSize: '11px', color: '#7f98b0' }).setOrigin(0.5);
    cont.on('pointerdown', () => this.cont());
    quit.on('pointerdown', () => this.toTitle());
    this.input.keyboard!.on('keydown-ESC', () => this.toTitle());
    Sound.music('gameover', MISC_STYLES.gameover, 3, run.era, false);
  }

  private async submit(formEl: HTMLFormElement) {
    if (this.submitted) return;
    const fd = new FormData(formEl);
    const name = String(fd.get('nick') ?? '').trim();
    const message = String(fd.get('msg') ?? '').trim();
    if (!name) {
      this.status.setText(t('needNick')).setColor('#ff8080');
      Sound.sfx('deny');
      return;
    }
    this.submitted = true;
    nick.set(name);
    this.status.setText(t('sending')).setColor('#cfe6ff');
    const res = await submitScore(run.era, { name, message, score: run.score, stage: run.stage });
    if (!res.ok) {
      this.submitted = false;
      this.status.setText(res.error ?? 'error').setColor('#ff8080');
      Sound.sfx('deny');
      return;
    }
    Sound.sfx('oneup');
    this.status.setText(t('submitted', res.rank ?? '-') + (res.online ? '' : `  (${t('offline')})`)).setColor('#60ff90');
    this.form?.setVisible(false);
    this.form?.destroy();
    this.form = null;
    void this.loadBoard(name);
  }

  private async loadBoard(highlight?: string) {
    const { rows, online } = await fetchTop(run.era, 8);
    if (!this.scene.isActive()) return;
    this.board.forEach((b) => b.destroy());
    this.board = [];
    const y0 = 432;
    const head = this.add
      .text(W / 2, y0, `${t('ranking')} TOP 8${online ? '' : `  · ${t('offline')}`}`, { fontFamily: fontLoc(), fontSize: '13px', color: '#9fd8ff' })
      .setOrigin(0.5);
    this.board.push(head);
    if (!rows.length) {
      this.board.push(this.add.text(W / 2, y0 + 40, t('noScores'), { fontFamily: fontLoc(), fontSize: '13px', color: '#7f98b0' }).setOrigin(0.5));
      return;
    }
    rows.forEach((r: ScoreRow, i) => {
      const y = y0 + 22 + i * 21;
      const me = highlight && r.name === highlight && r.score === run.score;
      const col = me ? '#60ff90' : i === 0 ? '#ffd860' : '#ffffff';
      this.board.push(
        this.add.text(30, y, `${i + 1}.`, { fontFamily: FONT, fontSize: '13px', color: col }),
        this.add.text(62, y, r.name, { fontFamily: FONT_ANY, fontSize: '13px', color: col }),
        this.add.text(W - 30, y, `${r.score.toLocaleString()}  S${r.stage}`, { fontFamily: FONT, fontSize: '13px', color: col }).setOrigin(1, 0),
      );
    });
  }

  private cont() {
    if (this.done || run.continues >= MAX_CONTINUES) return;
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
