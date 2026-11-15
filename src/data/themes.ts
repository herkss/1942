import type { LandKind } from '../gfx/terrain';

export type BossKind = 'bomber' | 'ship' | 'fortress';
export type Weather = 'none' | 'rain' | 'storm' | 'snow' | 'ash';
export type IslandStyle = 'green' | 'ice' | 'volc' | 'none';

export type DecoKind =
  | 'island' | 'baseIsland' | 'lighthouse' | 'sunkShip' | 'sunkBigShip' | 'sunkPlane'
  | 'burning' | 'floatWreck' | 'oil' | 'debris' | 'reef' | 'rock' | 'mine' | 'buoy';

export interface Theme {
  name: string;
  ko: string;
  ja: string;
  /** land segment flown over mid-stage (null = open sea) */
  land: LandKind | null;
  /** weighted scenery mix over water */
  deco: Partial<Record<DecoKind, number>>;
  /** music style index (see audio/styles) */
  music: number;
  /** fraction of the combat phase spent over land [start, end] */
  landSpan?: [number, number];
  /** deep, mid, highlight water colours */
  water: [string, string, string];
  island: IslandStyle;
  islandRate: number;
  cloudRate: number;
  lowClouds?: boolean;
  weather: Weather;
  night?: boolean;
  overlay?: [number, number];
  fleet?: boolean;
  boss: BossKind;
}

export const THEMES: Theme[] = [
  { name: 'DAWN PATROL', ja: '夜明けの哨戒', land: 'jungle', music: 0, deco: { island: 3, sunkShip: 1, sunkPlane: 1, debris: 1, buoy: 0.6, lighthouse: 0.6 }, ko: '새벽 초계', water: ['#0b3a5e', '#15608c', '#7fc4e8'], island: 'green', islandRate: 0.35, cloudRate: 0.5, weather: 'none', overlay: [0xffb070, 0.1], boss: 'bomber' },
  { name: 'CORAL ISLES', ja: '珊瑚諸島', land: null, music: 1, deco: { island: 4, reef: 3, sunkPlane: 2, sunkShip: 1, baseIsland: 1 }, ko: '산호 군도', water: ['#0a5370', '#1b8aa6', '#9fe6f0'], island: 'green', islandRate: 0.85, cloudRate: 0.35, weather: 'none', boss: 'ship' },
  { name: 'STORM FRONT', ja: '嵐の前線', land: null, music: 2, deco: { rock: 2, debris: 2, sunkShip: 1, burning: 1, island: 1, floatWreck: 1, sunkPlane: 0.8 }, ko: '폭풍 전선', water: ['#16262f', '#2a4250', '#7f98a6'], island: 'green', islandRate: 0.2, cloudRate: 0.9, weather: 'storm', boss: 'fortress' },
  { name: 'MOUNTAIN PASS', ja: '山岳回廊', land: 'mountain', landSpan: [0.08, 0.9], music: 3, deco: { island: 2, rock: 2, sunkPlane: 1, debris: 1, sunkShip: 0.8 }, ko: '산악 협곡', water: ['#123a52', '#1f5a78', '#9fd0e8'], island: 'green', islandRate: 0.4, cloudRate: 0.7, weather: 'none', boss: 'bomber' },
  { name: 'SUNSET STRAIT', ja: '夕焼けの海峡', land: 'desert', music: 4, deco: { island: 2, sunkShip: 2, burning: 1.5, oil: 1.5, debris: 1, sunkPlane: 1 }, ko: '석양의 해협', water: ['#2b2350', '#5a3d6e', '#ffb38a'], island: 'green', islandRate: 0.5, cloudRate: 0.6, weather: 'none', overlay: [0xff7030, 0.12], boss: 'bomber' },
  { name: 'NIGHT RAID', ja: '夜間強襲', land: 'city', landSpan: [0.1, 0.88], music: 5, deco: { island: 2, buoy: 2, lighthouse: 1.5, burning: 1.5, baseIsland: 1, oil: 1, sunkShip: 0.8, sunkPlane: 0.8 }, ko: '야간 강습', water: ['#030b18', '#0a1d33', '#3a6a8f'], island: 'green', islandRate: 0.4, cloudRate: 0.3, weather: 'none', night: true, boss: 'ship' },
  { name: 'ARCTIC ROUTE', ja: '北極航路', land: 'snow', music: 6, deco: { island: 4, sunkShip: 1.5, debris: 1, rock: 1, floatWreck: 1, sunkPlane: 0.8 }, ko: '북극 항로', water: ['#0d2c40', '#1f4d66', '#cfefff'], island: 'ice', islandRate: 0.9, cloudRate: 0.5, weather: 'snow', boss: 'fortress' },
  { name: 'NIGHT FRONT', ja: '夜間地上戦線', land: 'waste', landSpan: [0.06, 0.92], music: 7, deco: { burning: 2, debris: 2, oil: 1, sunkShip: 1, sunkPlane: 0.8 }, ko: '야간 지상전', water: ['#050a12', '#0e1a28', '#3a5a74'], island: 'none', islandRate: 0, cloudRate: 0.3, weather: 'none', night: true, boss: 'fortress' },
  { name: 'VOLCANIC CHAIN', ja: '火山列島', land: 'lava', music: 8, deco: { island: 4, rock: 2, burning: 1.5, sunkPlane: 1, sunkShip: 0.8 }, ko: '화산 열도', water: ['#1c1414', '#3b2320', '#ff7a3c'], island: 'volc', islandRate: 0.8, cloudRate: 0.3, weather: 'ash', overlay: [0xff3000, 0.08], boss: 'bomber' },
  { name: 'FLEET ASSAULT', ja: '敵艦隊強襲', land: null, music: 9, deco: { burning: 3, sunkBigShip: 2, sunkShip: 2, oil: 3, debris: 2, mine: 1.5, floatWreck: 1, sunkPlane: 0.8 }, ko: '적 함대 강습', water: ['#0b3150', '#17557a', '#8cc8e6'], island: 'none', islandRate: 0, cloudRate: 0.4, weather: 'none', fleet: true, boss: 'ship' },
  { name: 'ABOVE THE CLOUDS', ja: '雲上の戦場', land: null, music: 10, deco: { sunkShip: 1, debris: 1, island: 0.5, sunkPlane: 0.8 }, ko: '구름 위의 전장', water: ['#2d5f86', '#5a8fb8', '#e0f2ff'], island: 'none', islandRate: 0, cloudRate: 1, lowClouds: true, weather: 'none', boss: 'fortress' },
  { name: 'EYE OF THE STORM', ja: '嵐の目', land: 'mountain', landSpan: [0.1, 0.88], music: 11, deco: { rock: 2, burning: 2, debris: 2, sunkShip: 1, island: 1, floatWreck: 1, sunkPlane: 0.8 }, ko: '폭풍의 눈', water: ['#060d14', '#152430', '#56788c'], island: 'green', islandRate: 0.2, cloudRate: 0.9, weather: 'storm', night: true, boss: 'bomber' },
  { name: 'LAST LINE', ja: '最終防衛線', land: 'waste', music: 12, deco: { island: 2, baseIsland: 2, burning: 2, sunkBigShip: 1, oil: 2, mine: 1, sunkShip: 0.8, sunkPlane: 0.8 }, ko: '최후 방어선', water: ['#3a1d2e', '#6b3044', '#ffa070'], island: 'volc', islandRate: 0.4, cloudRate: 0.5, weather: 'ash', overlay: [0xff5020, 0.1], fleet: true, boss: 'ship' },
  { name: 'SKY CITADEL', ja: '天空要塞', land: 'city', landSpan: [0.1, 0.85], music: 13, deco: { burning: 2, sunkBigShip: 1.5, debris: 2, oil: 2, buoy: 1, floatWreck: 1, sunkShip: 0.8, sunkPlane: 0.8 }, ko: '천공 요새', water: ['#0a1030', '#1d2a5a', '#9ab0ff'], island: 'none', islandRate: 0, cloudRate: 0.8, weather: 'rain', night: true, boss: 'fortress' },
];

export function themeFor(stage: number): Theme {
  return THEMES[(stage - 1) % THEMES.length];
}

export function loopOf(stage: number): number {
  return Math.floor((stage - 1) / THEMES.length) + 1;
}

/** Overall difficulty multiplier — grows every stage and every loop. */
export function difficulty(stage: number) {
  const s = stage - 1;
  return {
    hp: 1 + 0.14 * s,
    bossHp: 1 + 0.38 * s,
    bulletSpeed: Math.min(1.85, 1 + 0.055 * s),
    fireRate: 1 + 0.09 * s,
    spawn: Math.min(2.4, 1 + 0.1 * s),
    extraBullets: Math.floor(s / 3),
  };
}
