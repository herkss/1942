import type { Era, WeaponId } from './config';

export interface Upgrades {
  armor: number;
  engine: number;
  fire: number;
  bomb: number;
  skill: number;
}

export interface RunState {
  era: Era;
  stage: number;
  score: number;
  lives: number;
  credits: number;
  weapon: WeaponId;
  power: number;
  bombs: number;
  wingmen: number;
  up: Upgrades;
  stageScore: number;
  stageKills: number;
  stageHits: number;
  continues: number;
}

export const UPGRADE_DEFS: { id: keyof Upgrades; name: string; ko: string; desc: string; max: number; base: number }[] = [
  { id: 'armor', name: 'ARMOR', ko: '장갑 강화', desc: '최대 내구도 +1', max: 4, base: 600 },
  { id: 'fire', name: 'FIREPOWER', ko: '화력 강화', desc: '모든 공격력 +12%', max: 6, base: 500 },
  { id: 'engine', name: 'ENGINE', ko: '엔진 튜닝', desc: '이동속도 +7%', max: 4, base: 400 },
  { id: 'bomb', name: 'BOMB BAY', ko: '폭탄창 확장', desc: '최대 폭탄 +1', max: 3, base: 700 },
  { id: 'skill', name: 'AVIONICS', ko: '항전장비', desc: '회피 쿨다운 -12%, 오버드라이브 충전 +15%', max: 4, base: 650 },
];

export function upgradeCost(id: keyof Upgrades, lvl: number) {
  const d = UPGRADE_DEFS.find((u) => u.id === id)!;
  return Math.round(d.base * Math.pow(1.7, lvl));
}

export function newRun(era: Era): RunState {
  return {
    era,
    stage: 1,
    score: 0,
    lives: 3,
    credits: 0,
    weapon: 'V',
    power: 1,
    bombs: 3,
    wingmen: 0,
    up: { armor: 0, engine: 0, fire: 0, bomb: 0, skill: 0 },
    stageScore: 0,
    stageKills: 0,
    stageHits: 0,
    continues: 0,
  };
}

export const run: RunState = newRun('ww2');

export function resetRun(era: Era) {
  Object.assign(run, newRun(era));
}

export const maxArmor = () => 3 + run.up.armor;
export const maxBombs = () => 3 + run.up.bomb;

function read(key: string, def: string) {
  try {
    return localStorage.getItem(key) ?? def;
  } catch {
    return def;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

export const prefs = {
  get era(): Era {
    const v = read('sw.era', 'ww2');
    return (['ww2', 'modern', 'future'].includes(v) ? v : 'ww2') as Era;
  },
  set era(v: Era) {
    write('sw.era', v);
  },
  get muted() {
    return read('sw.muted', '0') === '1';
  },
  set muted(v: boolean) {
    write('sw.muted', v ? '1' : '0');
  },
  hi(era: Era) {
    return parseInt(read('sw.hi.' + era, '0'), 10) || 0;
  },
  setHi(era: Era, score: number) {
    if (score > this.hi(era)) write('sw.hi.' + era, String(score));
  },
};
