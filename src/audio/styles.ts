/**
 * Per-stage music styles. Each one changes scale, tempo, groove, instruments
 * and effects so every stage (and every boss) has its own BGM character.
 */

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygDom: [0, 1, 4, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

export interface Style {
  title: string;
  scale: number[];
  bpm: number;
  key: number; // MIDI root of the bass octave region
  progs: number[][];
  rhythms: string[];
  lead: OscillatorType;
  leadOct: number;
  leadVol: number;
  leadCut: number;
  pluck?: number; // short decay seconds for plucked leads
  bassWave: OscillatorType;
  bass: string;
  sub: number; // sub-bass level (sine one octave under)
  kick: string;
  snare: string;
  hat: string;
  tom?: string;
  arp?: string; // digits index into chord tones, '.' = rest
  arpWave?: OscillatorType;
  pad?: OscillatorType;
  padVol?: number;
  bell?: string;
  delay?: number;
  swing?: number;
  dist?: number;
}

const R_STRAIGHT = ['x..x..x.x.x.x...', 'x.x.x...x..xx...', 'x...x.x.x...x.x.', 'x..x..x...x.x.x.'];
const R_BUSY = ['x.xx.xx.x.xx.x.x', 'x..x..x.x..x.xx.', 'xxx.xxx.x.x.xxx.'];
const R_SPARSE = ['x.......x...x...', 'x...x.......x.x.', 'x.....x.x.......'];
const R_SYNC = ['x..x..x...x..x..', '..x..x..x...x...', 'x..x...x.x..x...'];

export const STAGE_STYLES: Style[] = [
  // 0 DAWN PATROL — heroic sunrise march
  { title: 'Sunrise Sortie', scale: SCALES.dorian, bpm: 138, key: 45, progs: [[0, 6, 3, 4], [0, 3, 6, 4]], rhythms: R_STRAIGHT, lead: 'square', leadOct: 1, leadVol: 0.1, leadCut: 3200, bassWave: 'sawtooth', bass: 'x.x.x.x.x.x.x.x.', sub: 0.22, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', pad: 'sawtooth', padVol: 0.03 },
  // 1 CORAL ISLES — tropical marimba bounce
  { title: 'Coral Breeze', scale: SCALES.mixo, bpm: 124, key: 48, progs: [[0, 3, 4, 0], [0, 6, 3, 4]], rhythms: R_SYNC, lead: 'triangle', leadOct: 2, leadVol: 0.16, leadCut: 5000, pluck: 0.18, bassWave: 'triangle', bass: 'x..x..x.x..x..x.', sub: 0.18, kick: 'x...x...x...x...', snare: '......x.......x.', hat: 'xxxxxxxxxxxxxxxx', bell: '..x...x...x...x.', delay: 0.25, swing: 0.16 },
  // 2 STORM FRONT — pounding phrygian toms
  { title: 'Thunderhead', scale: SCALES.phrygian, bpm: 150, key: 43, progs: [[0, 1, 0, 6], [0, 5, 1, 0]], rhythms: R_BUSY, lead: 'sawtooth', leadOct: 1, leadVol: 0.09, leadCut: 2400, bassWave: 'sawtooth', bass: 'xxxxxxxxxxxxxxxx', sub: 0.28, kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: '..x...x...x...x.', tom: 'x.......x.x.x...', pad: 'sawtooth', padVol: 0.03, dist: 6 },
  // 3 MOUNTAIN PASS — epic horns over rolling drums
  { title: 'Ridge Runner', scale: SCALES.minor, bpm: 132, key: 45, progs: [[0, 5, 2, 6], [0, 3, 5, 4]], rhythms: R_STRAIGHT, lead: 'square', leadOct: 1, leadVol: 0.1, leadCut: 2600, bassWave: 'sawtooth', bass: 'x...x.x.x...x.x.', sub: 0.3, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x...x...x...x...', tom: '............xxxx', pad: 'sawtooth', padVol: 0.04, delay: 0.18 },
  // 4 SUNSET STRAIT — melancholic flute, half-time
  { title: 'Crimson Horizon', scale: SCALES.minor, bpm: 112, key: 45, progs: [[0, 5, 3, 4], [0, 6, 5, 4]], rhythms: R_SPARSE, lead: 'sine', leadOct: 2, leadVol: 0.14, leadCut: 4000, bassWave: 'triangle', bass: 'x.......x...x...', sub: 0.24, kick: 'x...............', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', pad: 'triangle', padVol: 0.06, delay: 0.32, arp: '0.1.2.1.0.1.2.1.', arpWave: 'triangle' },
  // 5 NIGHT RAID — stealth pulse
  { title: 'Blackout', scale: SCALES.harmonic, bpm: 126, key: 44, progs: [[0, 5, 0, 4], [0, 1, 0, 4]], rhythms: R_SYNC, lead: 'sine', leadOct: 1, leadVol: 0.12, leadCut: 2200, bassWave: 'square', bass: 'x.x.x.x.x.x.x.x.', sub: 0.3, kick: 'x.......x.......', snare: '............x...', hat: '..x...x...x...x.', arp: '0120012001200120', arpWave: 'square', delay: 0.36 },
  // 6 ARCTIC ROUTE — crystal bells
  { title: 'Ice Crystal', scale: SCALES.lydian, bpm: 128, key: 47, progs: [[0, 1, 0, 4], [0, 5, 1, 4]], rhythms: R_STRAIGHT, lead: 'triangle', leadOct: 2, leadVol: 0.15, leadCut: 6000, bassWave: 'triangle', bass: 'x...x...x...x...', sub: 0.22, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bell: 'x...x...x...x.x.', pad: 'sine', padVol: 0.07, delay: 0.42 },
  // 7 NIGHT FRONT — dark industrial ground war
  { title: 'Iron Front', scale: SCALES.phrygian, bpm: 140, key: 42, progs: [[0, 1, 0, 1], [0, 6, 5, 1]], rhythms: R_BUSY, lead: 'sawtooth', leadOct: 0, leadVol: 0.1, leadCut: 1800, bassWave: 'sawtooth', bass: 'xx.xxx.xxx.xxx.x', sub: 0.34, kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', tom: 'x.......x.......', dist: 9, pad: 'sawtooth', padVol: 0.025 },
  // 8 VOLCANIC CHAIN — aggressive harmonic minor
  { title: 'Magma Run', scale: SCALES.harmonic, bpm: 160, key: 44, progs: [[0, 5, 4, 0], [0, 3, 4, 4]], rhythms: R_BUSY, lead: 'sawtooth', leadOct: 1, leadVol: 0.09, leadCut: 2800, bassWave: 'sawtooth', bass: 'xxxxxxxxxxxxxxxx', sub: 0.3, kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: '..x...x...x...x.', tom: '..............xx', dist: 7 },
  // 9 FLEET ASSAULT — military snare march, brass
  { title: 'Battle Fleet', scale: SCALES.minor, bpm: 120, key: 45, progs: [[0, 3, 4, 0], [0, 5, 6, 4]], rhythms: R_STRAIGHT, lead: 'square', leadOct: 1, leadVol: 0.11, leadCut: 2200, bassWave: 'sawtooth', bass: 'x...x...x...x...', sub: 0.26, kick: 'x.......x.......', snare: 'x.xxx.x.x.xxx.xx', hat: '................', tom: 'x...............', pad: 'sawtooth', padVol: 0.04 },
  // 10 ABOVE THE CLOUDS — uplifting airy arps
  { title: 'Skyward', scale: SCALES.major, bpm: 146, key: 48, progs: [[0, 4, 5, 3], [0, 5, 3, 4]], rhythms: R_STRAIGHT, lead: 'square', leadOct: 1, leadVol: 0.08, leadCut: 3600, bassWave: 'sawtooth', bass: 'x.x.x.x.x.x.x.x.', sub: 0.2, kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: '0123012301230123', arpWave: 'square', delay: 0.3, pad: 'triangle', padVol: 0.05 },
  // 11 EYE OF THE STORM (mountains at night) — exotic phrygian dominant
  { title: 'Storm Peak', scale: SCALES.phrygDom, bpm: 154, key: 43, progs: [[0, 1, 0, 6], [0, 3, 1, 0]], rhythms: R_BUSY, lead: 'sawtooth', leadOct: 1, leadVol: 0.09, leadCut: 2600, bassWave: 'sawtooth', bass: 'x.xxx.xxx.xxx.xx', sub: 0.3, kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', tom: 'x...x.......x.x.', dist: 5, delay: 0.2 },
  // 12 LAST LINE — epic full orchestra-ish
  { title: 'Last Stand', scale: SCALES.minor, bpm: 144, key: 45, progs: [[0, 5, 6, 4], [0, 3, 6, 2]], rhythms: R_STRAIGHT, lead: 'sawtooth', leadOct: 1, leadVol: 0.1, leadCut: 3000, bassWave: 'sawtooth', bass: 'x.x.x.x.x.x.x.x.', sub: 0.3, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tom: '............x.xx', arp: '0120312031203120', arpWave: 'square', pad: 'sawtooth', padVol: 0.045 },
  // 13 SKY CITADEL — final organ & driving 16ths
  { title: 'Citadel of the Sky', scale: SCALES.harmonic, bpm: 168, key: 45, progs: [[0, 5, 1, 4], [0, 3, 5, 4]], rhythms: R_BUSY, lead: 'square', leadOct: 1, leadVol: 0.1, leadCut: 3400, bassWave: 'sawtooth', bass: 'xxxxxxxxxxxxxxxx', sub: 0.32, kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..x...x...x...x.', arp: '0123432101234321', arpWave: 'sawtooth', pad: 'square', padVol: 0.035, delay: 0.22, dist: 3 },
];

export const BOSS_STYLES: Record<'bomber' | 'ship' | 'fortress', Style> = {
  bomber: { title: 'Giant in the Sky', scale: SCALES.minor, bpm: 158, key: 45, progs: [[0, 5, 0, 4], [0, 5, 6, 4]], rhythms: R_BUSY, lead: 'sawtooth', leadOct: 1, leadVol: 0.1, leadCut: 3000, bassWave: 'sawtooth', bass: 'xxxxxxxxxxxxxxxx', sub: 0.32, kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', arp: '0123012301230123', arpWave: 'square', dist: 4 },
  ship: { title: 'Dreadnought', scale: SCALES.phrygian, bpm: 148, key: 42, progs: [[0, 1, 0, 6], [0, 1, 5, 1]], rhythms: R_BUSY, lead: 'square', leadOct: 1, leadVol: 0.1, leadCut: 2400, bassWave: 'sawtooth', bass: 'x.xxx.xxx.xxx.xx', sub: 0.36, kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tom: 'x.x.....x.x.....', dist: 6, pad: 'sawtooth', padVol: 0.035 },
  fortress: { title: 'Fortress Overture', scale: SCALES.harmonic, bpm: 172, key: 44, progs: [[0, 5, 4, 0], [0, 1, 4, 4]], rhythms: R_BUSY, lead: 'sawtooth', leadOct: 1, leadVol: 0.1, leadCut: 3200, bassWave: 'sawtooth', bass: 'xxxxxxxxxxxxxxxx', sub: 0.34, kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: '..x...x...x...x.', tom: '............xxxx', arp: '0123432101234321', arpWave: 'sawtooth', dist: 5, delay: 0.15 },
};

export const MISC_STYLES: Record<'title' | 'hangar' | 'clear' | 'gameover', Style> = {
  title: { title: 'Steel Wings', scale: SCALES.dorian, bpm: 112, key: 45, progs: [[0, 6, 3, 4]], rhythms: R_STRAIGHT, lead: 'square', leadOct: 1, leadVol: 0.1, leadCut: 3000, bassWave: 'sawtooth', bass: 'x...x.x.x...x.x.', sub: 0.24, kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.', pad: 'sawtooth', padVol: 0.04, delay: 0.2 },
  hangar: { title: 'Hangar Bay', scale: SCALES.dorian, bpm: 96, key: 45, progs: [[0, 3, 1, 4], [0, 5, 1, 4]], rhythms: R_SYNC, lead: 'triangle', leadOct: 2, leadVol: 0.12, leadCut: 4000, pluck: 0.3, bassWave: 'triangle', bass: 'x..x..x...x..x..', sub: 0.22, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', pad: 'triangle', padVol: 0.05, swing: 0.2, delay: 0.25 },
  clear: { title: 'Victory', scale: SCALES.major, bpm: 132, key: 48, progs: [[0, 3, 4, 0]], rhythms: R_STRAIGHT, lead: 'square', leadOct: 1, leadVol: 0.11, leadCut: 3600, bassWave: 'sawtooth', bass: 'x.x.x.x.x.x.x.x.', sub: 0.2, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', pad: 'sawtooth', padVol: 0.04 },
  gameover: { title: 'Fallen', scale: SCALES.minor, bpm: 84, key: 45, progs: [[0, 5, 3, 0]], rhythms: R_SPARSE, lead: 'triangle', leadOct: 1, leadVol: 0.12, leadCut: 2400, bassWave: 'triangle', bass: 'x.......x.......', sub: 0.25, kick: 'x...............', snare: '................', hat: '................', pad: 'triangle', padVol: 0.06, delay: 0.3 },
};
