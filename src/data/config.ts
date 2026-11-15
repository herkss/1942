export const W = 480;
export const H = 800;
export const FONT = '"Black Ops One", "Black Han Sans", "Malgun Gothic", sans-serif';

/** Depth layers */
export const D = {
  water: 0,
  decoLow: 1,
  cloudLow: 2,
  carrier: 3,
  ground: 5,
  nightOverlay: 7,
  shadow: 8,
  enemyAir: 10,
  item: 12,
  pShot: 14,
  player: 20,
  eShot: 25,
  fx: 30,
  cloudHigh: 40,
  flyover: 42,
  weather: 45,
  flash: 90,
  hud: 100,
  banner: 110,
} as const;

export type Era = 'ww2' | 'modern' | 'future';
export type WeaponId = 'V' | 'L' | 'M';

export interface EraDef {
  id: Era;
  label: string;
  ko: string;
  years: string;
  weapons: Record<WeaponId, string>;
  bomb: string;
  bossNames: Record<'bomber' | 'ship' | 'fortress', string>;
}

export const ERAS: Record<Era, EraDef> = {
  ww2: {
    id: 'ww2', label: 'WORLD WAR', ko: '2차대전', years: '1942',
    weapons: { V: 'MACHINE GUN', L: 'AP CANNON', M: 'ROCKETS' },
    bomb: 'AIR RAID',
    bossNames: { bomber: 'GIGANT', ship: 'LEVIATHAN', fortress: 'IRON CITADEL' },
  },
  modern: {
    id: 'modern', label: 'MODERN', ko: '현대전', years: '2026',
    weapons: { V: 'VULCAN', L: 'RAILGUN', M: 'MISSILES' },
    bomb: 'CLUSTER STRIKE',
    bossNames: { bomber: 'BLACK MANTA', ship: 'TRIDENT', fortress: 'HYDRA PLATFORM' },
  },
  future: {
    id: 'future', label: 'FUTURE', ko: '미래전', years: '2199',
    weapons: { V: 'PLASMA', L: 'PHOTON LASER', M: 'SEEKERS' },
    bomb: 'NOVA BURST',
    bossNames: { bomber: 'VOID MOTH', ship: 'ABYSS ARK', fortress: 'SKY CITADEL Ω' },
  },
};
