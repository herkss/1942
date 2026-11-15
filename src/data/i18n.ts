import type { Era } from './config';
import type { Theme } from './themes';

export type Lang = 'en' | 'ko' | 'ja';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'ko', label: '한국어' },
  { id: 'ja', label: '日本語' },
];

function detect(): Lang {
  try {
    const v = localStorage.getItem('sw.lang');
    if (v === 'en' || v === 'ko' || v === 'ja') return v;
  } catch {
    /* ignore */
  }
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('ko') ? 'ko' : n.startsWith('ja') ? 'ja' : 'en';
}

let lang: Lang = detect();

export function getLang() {
  return lang;
}
export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem('sw.lang', l);
  } catch {
    /* ignore */
  }
}

/** Font stack for localized (non-Latin) text. */
/** Font stack able to render names typed in any of the supported languages. */
export const FONT_ANY = '"Black Han Sans", "Dela Gothic One", "Black Ops One", "Malgun Gothic", "Hiragino Sans", sans-serif';

export function fontLoc() {
  return lang === 'ja'
    ? '"Dela Gothic One", "Black Ops One", "Hiragino Sans", "Yu Gothic", sans-serif'
    : '"Black Han Sans", "Black Ops One", "Malgun Gothic", sans-serif';
}

type Entry = Record<Lang, string>;
const S = {
  subtitle: { en: 'CARRIER STRIKE', ko: 'CARRIER STRIKE  ·  강철의 날개', ja: 'CARRIER STRIKE  ·  鋼鉄の翼' },
  selectEra: { en: 'SELECT ERA', ko: '시대 선택', ja: '時代選択' },
  language: { en: 'LANGUAGE', ko: '언어', ja: '言語' },
  tapStart: { en: '▶  TAP TO START', ko: '▶  터치하여 시작', ja: '▶  タップでスタート' },
  pressStart: { en: '▶  PRESS ENTER', ko: '▶  ENTER 키로 시작', ja: '▶  ENTERでスタート' },
  helpTouch: {
    en: 'Drag: move  ·  Auto-fire  ·  BOMB / ROLL / OD buttons',
    ko: '드래그: 이동   ·   자동 사격   ·   BOMB / ROLL / OD 버튼',
    ja: 'ドラッグ: 移動 ・ 自動射撃 ・ BOMB / ROLL / OD ボタン',
  },
  helpKeys: {
    en: 'Arrows/WASD move · Auto-fire · X/Space bomb · Z/Shift roll · C overdrive · P pause · M mute',
    ko: '방향키/WASD 이동 · 자동사격 · X/Space 폭탄 · Z/Shift 회피 · C 오버드라이브 · P 일시정지 · M 음소거',
    ja: '方向キー/WASD 移動 · 自動射撃 · X/Space ボム · Z/Shift 回避 · C オーバードライブ · P ポーズ · M ミュート',
  },
  eraWw2: { en: 'WWII', ko: '2차대전', ja: '第二次大戦' },
  eraModern: { en: 'MODERN', ko: '현대전', ja: '現代戦' },
  eraFuture: { en: 'FUTURE', ko: '미래전', ja: '未来戦' },

  engage: { en: 'Weapons free', ko: '교전 개시', ja: '交戦開始' },
  approaching: { en: '{0} approaching', ko: '{0} 접근 중', ja: '{0} 接近中' },
  missionSub: { en: 'Returning to carrier', ko: '모함으로 귀환합니다', ja: '母艦へ帰還します' },
  landedSub: { en: 'Trap successful', ko: '착함 성공', ja: '着艦成功' },
  midBoss: { en: 'Heavy bomber inbound', ko: '중간 보스 출현', ja: '中ボス出現' },
  ambush: { en: 'Bandits on your six', ko: '후방에서 적기 접근', ja: '後方より敵機接近' },
  gold: { en: 'Medals for each kill', ko: '격추 시 훈장 획득', ja: '撃墜で勲章獲得' },
  rush: { en: 'Kamikaze rush', ko: '자폭기 돌격', ja: '特攻機突入' },
  supply: { en: 'Friendly supply plane', ko: '아군 보급기 도착', ja: '友軍補給機到着' },
  extend: { en: 'Extra life', ko: '보너스 생명 +1', ja: '残機 +1' },
  landfall: { en: 'Crossing the coastline', ko: '해안선 돌파 — 지상 목표 주의', ja: '海岸線突破 — 地上目標に注意' },
  backToSea: { en: 'Back over open water', ko: '다시 바다 위로', ja: '再び海上へ' },
  loop: { en: 'LOOP {0}', ko: 'LOOP {0}', ja: 'LOOP {0}' },

  rKills: { en: 'Kills', ko: '격추 수', ja: '撃墜数' },
  rStage: { en: 'Stage score', ko: '스테이지 점수', ja: 'ステージスコア' },
  rClear: { en: 'Clear bonus', ko: '클리어 보너스', ja: 'クリアボーナス' },
  rPerfect: { en: 'No-damage bonus', ko: '무피격 보너스', ja: 'ノーダメージボーナス' },
  rCredits: { en: 'Credits earned', ko: '획득 크레딧', ja: '獲得クレジット' },
  rTotal: { en: 'Total score', ko: '총 점수', ja: '総スコア' },
  rTapHangar: { en: 'Tap for hangar', ko: '터치하여 격납고로', ja: 'タップで格納庫へ' },
  rEnterHangar: { en: 'ENTER — to hangar', ko: 'ENTER — 격납고로', ja: 'ENTER — 格納庫へ' },

  hangarSub: { en: 'Maintenance & upgrades', ko: '격납고 — 기체 정비 및 강화', ja: '格納庫 — 整備と強化' },
  upArmor: { en: 'Armor', ko: '장갑 강화', ja: '装甲強化' },
  upArmorD: { en: 'Max armor +1', ko: '최대 내구도 +1', ja: '最大耐久 +1' },
  upFire: { en: 'Firepower', ko: '화력 강화', ja: '火力強化' },
  upFireD: { en: 'All damage +12%', ko: '모든 공격력 +12%', ja: '全攻撃力 +12%' },
  upEngine: { en: 'Engine', ko: '엔진 튜닝', ja: 'エンジン調整' },
  upEngineD: { en: 'Speed +7%', ko: '이동속도 +7%', ja: '移動速度 +7%' },
  upBomb: { en: 'Bomb bay', ko: '폭탄창 확장', ja: '爆弾倉拡張' },
  upBombD: { en: 'Max bombs +1', ko: '최대 폭탄 +1', ja: '最大ボム +1' },
  upSkill: { en: 'Avionics', ko: '항전장비', ja: 'アビオニクス' },
  upSkillD: { en: 'Roll cooldown -12%, overdrive +15%', ko: '회피 쿨다운 -12%, 오버드라이브 충전 +15%', ja: '回避CT -12%、OD充填 +15%' },
  buyBomb: { en: 'Bomb resupply', ko: '폭탄 보급', ja: 'ボム補給' },
  buyWing: { en: 'Wingman', ko: '호위기 배치', ja: '僚機配備' },
  owned: { en: 'Owned {0} / {1}', ko: '보유 {0} / {1}', ja: '所持 {0} / {1}' },
  next: { en: 'NEXT: STAGE {0}  {1}', ko: 'NEXT: STAGE {0}  {1}', ja: 'NEXT: STAGE {0}  {1}' },
  sortie: { en: 'SORTIE ▶', ko: '출격  SORTIE ▶', ja: '出撃  SORTIE ▶' },
  hangarTouch: { en: 'Tap an item twice to buy', ko: '항목을 두 번 터치하면 구매', ja: '項目を2回タップで購入' },
  hangarKeys: { en: '↑↓ select · ENTER buy · S/SPACE sortie', ko: '↑↓ 선택 · ENTER 구매 · S/SPACE 출격', ja: '↑↓ 選択 · ENTER 購入 · S/SPACE 出撃' },

  cont: { en: 'CONTINUE  {0}', ko: '컨티뉴  {0}', ja: 'コンティニュー  {0}' },
  toTitle: { en: 'TITLE', ko: '타이틀로', ja: 'タイトルへ' },
  contNote: { en: 'Continuing resets your score and restarts this stage', ko: '컨티뉴 시 점수가 초기화되고 현재 스테이지부터 재시작합니다', ja: 'コンティニューするとスコアがリセットされ、このステージから再開します' },

  resume: { en: 'RESUME', ko: '계속하기', ja: '再開' },
  quit: { en: 'QUIT TO TITLE', ko: '타이틀로', ja: 'タイトルへ' },
  pauseHelp: { en: 'P / ESC: resume  ·  Q: title', ko: 'P / ESC: 계속   ·   Q: 타이틀', ja: 'P / ESC: 再開  ·  Q: タイトル' },
  nowPlaying: { en: '♪ {0}', ko: '♪ {0}', ja: '♪ {0}' },
  ranking: { en: 'RANKING', ko: '랭킹', ja: 'ランキング' },
  noScores: { en: 'No records yet — be the first ace!', ko: '아직 기록이 없습니다 — 첫 에이스가 되어보세요!', ja: 'まだ記録がありません — 最初のエースに!' },
  offline: { en: 'offline · local records', ko: '오프라인 · 이 기기 기록', ja: 'オフライン · 端末の記録' },
  loading: { en: 'Loading…', ko: '불러오는 중…', ja: '読み込み中…' },
  regTitle: { en: 'REGISTER YOUR SCORE', ko: '랭킹 등록', ja: 'ランキング登録' },
  nickPh: { en: 'Nickname (max 12)', ko: '닉네임 (최대 12자)', ja: 'ニックネーム (12文字まで)' },
  msgPh: { en: 'Message (max 40)', ko: '한마디 (최대 40자)', ja: 'ひとこと (40文字まで)' },
  submit: { en: 'SUBMIT', ko: '등록', ja: '登録' },
  submitted: { en: 'Registered! Rank #{0}', ko: '등록 완료! {0}위', ja: '登録完了! {0}位' },
  needNick: { en: 'Enter a nickname', ko: '닉네임을 입력하세요', ja: 'ニックネームを入力してください' },
  sending: { en: 'Sending…', ko: '전송 중…', ja: '送信中…' },
  continueBtn: { en: 'CONTINUE ({0} left)', ko: '컨티뉴 (남은 횟수 {0})', ja: 'コンティニュー (残り{0}回)' },
  noContinue: { en: 'NO CONTINUES LEFT', ko: '컨티뉴 횟수를 모두 사용했습니다', ja: 'コンティニュー回数がありません' },
} satisfies Record<string, Entry>;

export type StrKey = keyof typeof S;

export function t(key: StrKey, ...args: (string | number)[]) {
  let s: string = S[key][lang];
  args.forEach((a, i) => (s = s.replace(`{${i}}`, String(a))));
  return s;
}

export function eraName(e: Era) {
  return t(e === 'ww2' ? 'eraWw2' : e === 'modern' ? 'eraModern' : 'eraFuture');
}

export function themeName(th: Theme) {
  return lang === 'ko' ? th.ko : lang === 'ja' ? th.ja : th.name;
}
