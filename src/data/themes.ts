export type BossKind = 'bomber' | 'ship' | 'fortress';
export type Weather = 'none' | 'rain' | 'storm' | 'snow' | 'ash';
export type IslandStyle = 'green' | 'ice' | 'volc' | 'none';

export interface Theme {
  name: string;
  ko: string;
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
  { name: 'DAWN PATROL', ko: '새벽 초계', water: ['#0b3a5e', '#15608c', '#7fc4e8'], island: 'green', islandRate: 0.35, cloudRate: 0.5, weather: 'none', overlay: [0xffb070, 0.1], boss: 'bomber' },
  { name: 'CORAL ISLES', ko: '산호 군도', water: ['#0a5370', '#1b8aa6', '#9fe6f0'], island: 'green', islandRate: 0.85, cloudRate: 0.35, weather: 'none', boss: 'ship' },
  { name: 'STORM FRONT', ko: '폭풍 전선', water: ['#16262f', '#2a4250', '#7f98a6'], island: 'green', islandRate: 0.2, cloudRate: 0.9, weather: 'storm', boss: 'fortress' },
  { name: 'SUNSET STRAIT', ko: '석양의 해협', water: ['#2b2350', '#5a3d6e', '#ffb38a'], island: 'green', islandRate: 0.5, cloudRate: 0.6, weather: 'none', overlay: [0xff7030, 0.12], boss: 'bomber' },
  { name: 'NIGHT RAID', ko: '야간 강습', water: ['#030b18', '#0a1d33', '#3a6a8f'], island: 'green', islandRate: 0.4, cloudRate: 0.3, weather: 'none', night: true, boss: 'ship' },
  { name: 'ARCTIC ROUTE', ko: '북극 항로', water: ['#0d2c40', '#1f4d66', '#cfefff'], island: 'ice', islandRate: 0.9, cloudRate: 0.5, weather: 'snow', boss: 'fortress' },
  { name: 'VOLCANIC CHAIN', ko: '화산 열도', water: ['#1c1414', '#3b2320', '#ff7a3c'], island: 'volc', islandRate: 0.8, cloudRate: 0.3, weather: 'ash', overlay: [0xff3000, 0.08], boss: 'bomber' },
  { name: 'FLEET ASSAULT', ko: '적 함대 강습', water: ['#0b3150', '#17557a', '#8cc8e6'], island: 'none', islandRate: 0, cloudRate: 0.4, weather: 'none', fleet: true, boss: 'ship' },
  { name: 'ABOVE THE CLOUDS', ko: '구름 위의 전장', water: ['#2d5f86', '#5a8fb8', '#e0f2ff'], island: 'none', islandRate: 0, cloudRate: 1, lowClouds: true, weather: 'none', boss: 'fortress' },
  { name: 'EYE OF THE STORM', ko: '폭풍의 눈', water: ['#060d14', '#152430', '#56788c'], island: 'green', islandRate: 0.2, cloudRate: 0.9, weather: 'storm', night: true, boss: 'bomber' },
  { name: 'LAST LINE', ko: '최후 방어선', water: ['#3a1d2e', '#6b3044', '#ffa070'], island: 'volc', islandRate: 0.4, cloudRate: 0.5, weather: 'ash', overlay: [0xff5020, 0.1], fleet: true, boss: 'ship' },
  { name: 'SKY CITADEL', ko: '천공 요새', water: ['#0a1030', '#1d2a5a', '#9ab0ff'], island: 'none', islandRate: 0, cloudRate: 0.8, weather: 'rain', night: true, boss: 'fortress' },
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
