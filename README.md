# STEEL WINGS — Carrier Strike (강철의 날개)

항공모함에서 이륙 → 교전 → 보스 격파 → 모함 착함으로 이어지는 2D 종스크롤 슈팅 게임.
Phaser 3 + TypeScript + Vite. 모든 그래픽(Canvas2D)과 사운드(Web Audio)는 코드로 생성되어 외부 에셋 파일이 없습니다.

## 특징
- **시대 선택**: 2차대전(1942) / 현대(2026) / 미래(2199) — 기체·함선·보스·무기·음악 스타일이 시대별로 달라짐
- **스테이지 흐름**: 항모 이륙 연출 → 웨이브 전투 → WARNING → 보스전 → 착함 연출 → 결과 정산 → 격납고 강화 → 다음 스테이지
- **12개 테마 스테이지** (새벽, 산호 군도, 폭풍, 석양, 야간, 북극, 화산, 함대, 구름 위, 폭풍의 눈, 최후 방어선, 천공 요새) + 이후 LOOP로 무한 진행, 단계마다 난이도 상승
- **무기 3종 × 5레벨**: 확산(V) / 관통(L) / 유도(M), 호위기(E), 실드(S), 수리(+), 폭탄(B), 1UP, 훈장
- **스킬**: 폭탄(아군 폭격 + 탄 소거), 회피 롤(무적), 오버드라이브(게이지 충전 후 화력 강화)
- **이벤트**: 중간 보스, 보급기, 후방 기습, 골드 편대, 자폭기 러시, 레드 편대 전멸 보너스, 날씨(비·폭풍 번개·눈·화산재)
- **보스 3종**: 거대 폭격기 / 전함 / 공중 요새 — 파괴 가능한 포탑·부품, HP 3단계 패턴 변화
- **격납고 업그레이드**: 장갑, 화력, 엔진, 폭탄창, 항전장비, 폭탄·호위기 구매
- PC(키보드·게임패드)와 모바일(터치 드래그 + 버튼) 모두 지원, 세로 화면

## 조작
| | PC | 모바일 |
|---|---|---|
| 이동 | 방향키 / WASD / 게임패드 | 화면 드래그 |
| 사격 | 자동 | 자동 |
| 폭탄 | X / Space | BOMB 버튼 |
| 회피 롤 | Z / Shift | ROLL 버튼 |
| 오버드라이브 | C / V | OD 버튼 |
| 일시정지 / 음소거 | P·ESC / M | ❚❚ 버튼 |

## 개발
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 생성
```

## 배포 (Cloudflare Pages, 1942.herks.co.kr)
**방법 A — GitHub Actions (이 저장소에 포함됨)**
1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → *Direct Upload*로 `steel-wings` 프로젝트 생성 (또는 첫 배포 시 자동 생성)
2. API 토큰 생성 (권한: *Account → Cloudflare Pages → Edit*)
3. GitHub 저장소 Settings → Secrets → Actions 에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 추가
4. `main` 브랜치에 push 하면 자동 빌드·배포

**방법 B — Cloudflare Git 연동**: Pages 프로젝트에서 GitHub 저장소 연결, Build command `npm run build`, Output `dist`.

**커스텀 도메인**: Pages 프로젝트 → Custom domains → `1942.herks.co.kr` 추가.
`herks.co.kr`이 Cloudflare DNS를 쓰면 자동 설정, 아니면 DNS에 `CNAME 1942 → steel-wings.pages.dev` 추가.

## 구조
```
src/
  data/      설정, 시대·스테이지 테마, 런 상태/저장
  gfx/       절차적 텍스처 생성 (기체·함선·항모·보스·섬·구름·이펙트)
  audio/     Web Audio 효과음 + 절차적 작곡 시퀀서
  objects/   플레이어, 적/탄/아이템, 보스
  systems/   웨이브 디렉터, 이펙트, HUD
  scenes/    Boot, Title, Game, Hangar, GameOver, Pause
```
