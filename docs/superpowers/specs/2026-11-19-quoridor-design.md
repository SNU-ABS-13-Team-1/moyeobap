# 쿼리도: 2인·4인 온라인 대전

2026-11-19

## 무엇을 만드나

9x9 보드에서 자기 말을 반대편 변까지 먼저 보내는 쿼리도(Gigamic)를 온라인
대전으로 만든다. 한 방에서 2인전 또는 4인전을 고른다. 매 턴 말을 한 칸
움직이거나, 벽을 하나 세워 남의 길을 돌아가게 만든다.

컴퓨터 대전은 만들지 않는다. 2:2 팀전도 만들지 않는다. 공식 룰북에는 없고
Board Game Arena에만 있는 변형이라 수요가 확인되면 옵션으로 붙인다.

## 규칙

근거는 Gigamic 공식 룰북(EN/FR/DE/KR), FoxMind 영문판, Wikipedia, BGA 도움말이다.
공식 문구가 갈리는 곳은 "판정"에 따로 적었다.

### 보드와 시작

- 9x9 칸. 열은 a~i(왼→오), 행은 1~9(아래→위). 서버 좌표는 `{r: 0..8, c: 0..8}`,
  표기는 `"e1"` = `{r:0, c:4}`.
- 2인전: 0번 자리 e1 출발 → 9행 도착, 1번 자리 e9 출발 → 1행 도착.
- 4인전: 0번 e1 → 9행, 1번 a5 → i열, 2번 e9 → 1행, 3번 i5 → a열.
  자리 번호 순서(아래 → 왼 → 위 → 오른)가 곧 시계 방향 턴 순서다.
- 벽: 2인전 각 10개, 4인전 각 5개.
- 첫 차례는 0번 자리. 자리 배정은 시작할 때 서버가 섞는다(공식 "추첨").

### 한 턴

말 이동 또는 벽 놓기 중 정확히 하나. 패스는 없다. 벽을 다 쓰면 말만 움직인다.

### 말 이동

상하좌우 한 칸. 벽은 통과하지 못하고 대각선 이동은 없다. 단, 바로 옆 칸에
다른 말이 있고 그 사이에 벽이 없으면:

1. 그 말 바로 뒤 칸이 비어 있고 보드 안이며 벽으로 막히지 않았으면 → 뛰어넘어 뒤 칸으로 간다.
2. 뒤 칸이 **벽·다른 말·보드 밖** 중 하나로 막혔으면 → 넘을 말의 좌우(진행 방향에
   직각) 칸으로 비껴간다. 각 칸은 보드 안이고, 비어 있고, 넘을 말과 그 칸 사이에
   벽이 없어야 한다.
3. 뒤 칸이 열려 있으면 비껴가기는 불가(1번만 가능).
4. 한 번에 말 하나만 넘는다. 두 말을 연달아 넘지 못한다.

점프는 의무가 아니다. 다른 방향의 일반 이동도 그대로 고를 수 있다.

### 벽 놓기

벽은 2칸 길이로, 칸 사이 홈 2개를 덮는다. 8x8 교차점 하나와 방향으로 나타낸다.

- `{r, c, o:'h'}` (r, c ∈ 0..7): 행 r과 r+1 사이 홈 중 c열·c+1열 부분을 막는다.
- `{r, c, o:'v'}`: 열 c와 c+1 사이 홈 중 r행·r+1행 부분을 막는다.
- 표기: 교차점의 왼쪽 아래 칸 + 방향. `"e3h"` = `{r:2, c:4, o:'h'}`로 3행과 4행
  사이, e·f열 부분을 막는다. 열 문자 h와 방향 h가 겹치므로 파싱은
  `^([a-i])([1-9])([hv])?$`로 한다.

다음 중 하나라도 해당하면 놓을 수 없다.

1. 남은 벽이 0개.
2. 교차점이 0..7 범위를 벗어남.
3. 같은 방향 겹침: 가로는 같은 r에서 |Δc| ≤ 1, 세로는 같은 c에서 |Δr| ≤ 1.
4. 십자 교차: 같은 교차점에 반대 방향 벽이 있음.
5. 길 막힘: 벽을 놓은 뒤 **아직 게임 중인 모든 플레이어** 중 누구 하나라도
   목표 변에 닿을 길이 없음. 다른 말은 장애물로 보지 않고 벽만 본다.
   4인전에서 나간 플레이어의 말은 보드에 남지만 길 검사 대상에서 뺀다.

길 검사는 플레이어마다 BFS 한 번. 칸이 81개라 최적화는 하지 않는다.

### 끝

- 2인전: 자기 목표 변 9칸 중 하나에 먼저 닿은 사람이 이기고, 그 즉시 게임이 끝난다.
- 4인전(2026-11-19 변경): 1~4위를 모두 가린다. 목표 변에 닿은 순서대로 1위, 2위, 3위를 받고,
  도착한 말은 보드에서 빠지며 남은 사람끼리 계속한다. 경기 중인 사람이 한 명 남으면 그 사람이
  남은 최고 등수를 받고 끝난다.
- 기권·연속 시간 초과로 나간 사람은 아래부터 등수를 받는다(먼저 나간 사람이 4위).
  이미 도착한 사람이 방을 나가도 등수는 그대로다.
- 다른 참가자가 모두 나가면 남은 한 명이 남은 최고 등수를 받는다. 승자(winner_id)는 1위다.

### 판정 (공식 문구가 애매한 곳)

| 상황 | 판정 | 근거 |
|---|---|---|
| 넘을 말 뒤가 다른 말·보드 끝 | 비껴가기 허용 | 독일어판 룰북 그림 10, Wikipedia |
| 뒤가 열렸는데 비껴가기 | 금지 | 공식 문구 |
| 4인 턴 순서 | 시계 방향(자리 0→1→2→3) | 독일어판 "Uhrzeigersinn" |
| 4인 종료 | 1~4위를 모두 가림(공식 문구는 첫 도착자로 끝) | 사용자 요청(2026-11-19) |
| 갈 칸도 없고 벽도 못 놓음 | 그 턴만 서버가 자동으로 넘김 | 규정 없음. 자발적 패스는 계속 금지 |
| 말에 둘러싸여 이동 불가, 벽은 놓을 수 있음 | 벽을 놓아야 함 | 패스가 없으므로 |

"자동으로 넘김"은 서버가 턴을 넘길 때마다 다음 사람의 합법 수가 하나라도 있는지
검사해서 처리한다. 수가 없으면 기보에 `pass`로 남기고 다음 사람으로 넘긴다.
남은 전원이 수가 없는 경우는 벽이 길을 남겨 두는 한 생기지 않는다.

## 구조: 루미큐브 온라인을 닮는다

쿼리도는 턴제고 숨긴 정보가 없다. 레포에서 2~4인 가변 인원 턴제를 이미 하는 것은
루미큐브 온라인(`rummyOnline.ts`)이라 그 뼈대를 그대로 쓴다.

| 가져올 것 | 출처 |
|---|---|
| `players` JSONB 배열, 나간 사람 건너뛰는 `nextTurnIndex` | `rummyOnline.ts` |
| `version` 낙관적 잠금, 턴 타이머, 연속 3회 시간 초과 → 자동 기권 | `rummyOnline.ts`, `rummyMatch.ts` |
| 방장 시작·재시작·강퇴, 1명 남으면 승리 | `rummyOnline.ts` |
| 로비(인원 선택은 `createExtras`) | `RummyLobby.tsx`, `GameLobby.tsx` |
| DB 행 + Postgres Changes 구독, Presence로 접속·관전 | `RummyRoom.tsx` |
| 재연결 복구, 오래된 스냅샷 거부 | `useOmokRoom.ts` |

루미의 손패·덱 같은 서버 전용 테이블은 필요 없다. `gameSeats.ts`는 2자리
전용이라 쓰지 않는다.

권위는 서버에 있다. 클라이언트는 `"e3h"` 같은 수 하나만 POST하고, 서버가 같은
순수 규칙 모듈로 차례·합법성을 다시 검증한 뒤 `version` CAS로 행을 갱신한다.
클라이언트 검증은 하이라이트·미리보기용일 뿐이다.

## 모듈

| 파일 | 역할 |
|---|---|
| `app/lib/quoridorMatch.ts` | 순수 규칙. 타입, 상수, 표기 파싱, 합법 이동 생성, 벽 판정, BFS, 승리 판정, `applyMove`. 다른 모듈 import 없음 |
| `app/lib/quoridorMatch.test.ts` | 규칙 테스트(`node:test`) |
| `app/lib/quoridorOnline.ts` | 서버 DB 로직. 방 목록·생성·참가·나가기·시작·수·시간 초과·재시작·강퇴·종료 기록 |
| `app/lib/quoridorChat.ts` | 채팅 |
| `app/lib/quoridorRanking.ts` | 주간 Elo 반영·조회. 계산 자체는 순수 함수 `computeEloDeltas` |
| `app/api/games/quoridor/rooms/route.ts` | GET 목록 / POST 생성 |
| `app/api/games/quoridor/rooms/[id]/{join,leave,start,kick,turn,timeout,restart,chat}/route.ts` | 각 10~30줄, `getSession()` → lib 호출 |
| `app/api/games/quoridor/ranking/route.ts` | 주간 랭킹(`ensurePrevWeekSnapshot`, `getHall`, `s-maxage=30`) |
| `app/games/quoridor/layout.tsx` | `isFeatureEnabled('quoridor')` 아니면 `notFound()` |
| `app/games/quoridor/page.tsx` + 로비·방 컴포넌트 | 화면 |
| `app/hooks/useQuoridorRoom.ts` | 방 구독·복구 |

상태는 기보에서 매번 다시 만들지 않고 행에 그대로 둔다(`pawns`, `walls`,
`walls_left`). 기보 `moves`는 다시 보기와 디버깅용이다.

## DB

마이그레이션 두 개. 운영 DB에는 머지 **전에** 하나씩 수동으로 적용한다.

`2026MMDD000000_add_quoridor_flag.sql`

```sql
INSERT INTO public.app_flags (key, enabled) VALUES ('quoridor', false)
ON CONFLICT DO NOTHING;
```

`2026MMDD010000_add_quoridor_online.sql`

- `quoridor_rooms`
  - `id`, `host_id`, `status ('waiting'|'playing'|'finished')`
  - `mode SMALLINT CHECK (mode IN (2, 4))`
  - `players JSONB` (`[{id, name, seat, left, timeouts}]`)
  - `turn_index`, `pawns JSONB`, `walls JSONB`, `walls_left JSONB`, `moves JSONB`
  - `winner_id`, `end_reason`
  - `turn_started_at`, `turn_limit_sec INTEGER DEFAULT 60 CHECK (BETWEEN 30 AND 600)`
  - `version INTEGER`, `created_at`, `updated_at`
  - RLS는 참여자만 SELECT(루미와 같은 `players @>` 정책), `supabase_realtime` publication에 추가
- `quoridor_chat_messages`: `kind ('text'|'image')` 포함, 원나잇 마이그레이션과 같은 형태
- `quoridor_matches`: 끝난 판 기록(`players`, `mode`, `winner_id`, `end_reason`, `moves`)
- `quoridor_ratings`: PK `(user_id, week_key)`, `user_name`, `rating INTEGER DEFAULT 1200`,
  `wins`, `losses`, `updated_at`. 알까기(`20260907000000_add_alkkagi.sql`)와 같은 주간
  Elo 테이블이다. 쿼리도는 무승부가 없어 `draws`는 두지 않는다

### 랭킹: 주간 Elo

오목·체스·바둑·알까기와 같은 방식이다. K=32, 시작 1200점이고, 매주 월요일(KST)에
1200점으로 다시 시작한다. 지난주 상위 3명은 `game_week_hall`에 남는다. 모듈은
`app/lib/quoridorRanking.ts`로 두고 `alkkagiRanking.ts`의 구조를 따른다.

2인전은 표준 Elo다.

```
E_A = 1 / (1 + 10^((R_B - R_A) / 400))
R_A' = R_A + K * (S_A - E_A)        S = 1(승) / 0(패)
```

4인전은 **등수끼리 모든 쌍**(6쌍)을 각각 한 판으로 본다. 위 등수가 이긴 것이다.

- 한 사람이 쌍 3개에 들어가므로 쌍마다 K를 `32 / 3`으로 나눈다. 그래야 4인전 1위의
  변동 폭이 2인전 1승과 비슷해진다.
- 모든 변동은 **게임 시작 전 점수**로 계산한 뒤 합쳐서 한 번에 반영하고, 반올림도
  플레이어당 마지막에 한 번만 한다.

```
k = 32 / (인원 - 1)
R_i' = R_i + Σ_{j ≠ i} k * (S_ij - E(i, j))      S_ij = 1(i가 j보다 위 등수) / 0
```

예를 들어 네 명 모두 1200점이면 1위 +16, 2위 +5.33 → +5, 3위 −5, 4위 −16이다.
승수(wins)는 1위만 세고, 나머지 등수는 패(losses)로 센다.

- 기권·연속 시간 초과로 나간 사람도 패자로 계산한다. 4인전에서 중간에 나가면 그 판이
  끝날 때 함께 반영한다. 반영을 한 번에 하기 위해서다.
- 방이 시작 전에 깨지거나 아무도 이기지 않고 사라진 판은 반영하지 않는다.
- 전적은 `quoridor_matches`에 한 줄 남긴다. 반영 전후 점수를 `players` JSON에
  같이 적어 두어 나중에 계산을 검증할 수 있게 한다.
- 정렬은 `rating` → `wins` → 이름 순이다.

Elo 계산은 DB를 모르는 순수 함수(`computeEloDeltas(ratings, ranks)`)로
분리해 테스트한다.

## 화면

`prototype.css`에 `/* ===== Quoridor ===== */` 섹션을 두고 BEM(`.quoridor-room__board`
등)으로 쓴다. Tailwind 유틸리티는 이 프로젝트에서 동작하지 않는다. 오목 방의
`omok-room__*` 레이아웃 클래스는 재사용한다.

### 보드

- CSS grid로 9칸 + 8홈을 번갈아 둔다(17x17 트랙, 칸:홈 ≈ 5:1).
  360px 폭이면 칸 약 34px, 홈 약 6px.
- 내 출발 변이 항상 아래에 오도록 보드를 회전해서 그린다. 좌표 변환은 화면
  계층에서만 하고, 서버로 보내는 표기는 항상 절대 좌표다.
- 각 플레이어의 목표 변에 그 플레이어 색 띠. 말은 색 + 모양(●▲■◆)으로 구분해
  색각 이상에도 읽히게 한다.

### 조작

- 하단 엄지 영역에 **이동 / 벽** 토글. 기본은 이동.
- 이동 모드: 갈 수 있는 칸에 점 표시, 탭하면 바로 보낸다(확인 없음).
- 벽 모드: 보드를 탭하면 가장 가까운 교차점에 반투명 미리보기 벽이 생긴다.
  - 같은 자리를 다시 탭하거나 회전 버튼을 누르면 가로·세로가 바뀐다.
  - 손가락을 끌면 미리보기만 따라오고, 떼도 확정되지 않는다.
  - 확정은 큰 "확정" 버튼으로만 하고, "취소"로 없앤다.
  - 놓을 수 없는 자리면 미리보기가 빨간색이 되고 이유 한 줄이 뜬다
    (`겹침`, `교차`, `OO의 길을 막음`, `남은 벽 없음`). 확정 버튼은 꺼진다.
  - 드래그로 바로 놓는 방식은 쓰지 않는다. 기존 앱 리뷰에서 불만이 가장 많았다.

### 정보

- 위쪽 플레이어 칩: 색·모양·이름·남은 벽·목표 방향 화살표·타이머.
  현재 차례 칩은 테두리 강조. 내 차례가 오면 `navigator.vibrate`가 있을 때 짧게 진동.
- 접이식 기보 목록. 되돌리기는 없다.
- 기권은 확인 창을 거친다.
- 관전자는 보드 회전 없이 0번 자리 기준으로 본다.

## 등록 지점

- `app/games/page.tsx`: GAMES 배열에 카드, `flag: 'quoridor'`
- `app/lib/openRooms.ts`: `OpenRoomGame` 유니언, MAX 상수, `GAME_LABEL`, `PAGE_PATH`,
  `fromQuoridor`, `mergeOpenRooms`
- `app/lib/openRooms.test.ts`: MAX_PLAYERS 일치 테스트
- `app/api/games/rooms/route.ts`: 플래그 검사 후 `listRooms` 합치기
- 폴링은 `POLLING_PRESETS.GAME_ROOM`/`GAME_LOBBY`/`GAME_RANKING`만 쓴다
- 실시간 채널은 `useEffect` 클린업에서 `removeChannel`
- 실시간 대전 API에는 CDN 캐시를 걸지 않는다
- 방은 1시간 움직임이 없으면 `cleanupStaleRooms`로 지운다

## 테스트

`quoridorMatch.test.ts`에 최소한 아래를 넣는다. 흔한 구현 버그 목록에서 뽑았다.

- 표기 파싱: `"h8h"`, `"h8"`, `"i9v"`, 범위 밖·잘못된 문자열
- 벽 겹침: 같은 방향 |Δ|=0, 1은 거부, 2는 허용
- 십자 교차 거부
- 길 막힘: 2인·4인 각각, 본인 길만 막는 벽도 거부, 다른 말이 길을 막고 있어도 허용
- 나간 플레이어는 길 검사에서 제외
- 직선 점프, 뒤가 벽/말/보드 끝일 때 비껴가기, 뒤가 열렸을 때 비껴가기 불가,
  비껴갈 칸 쪽에 벽이 있으면 불가, 두 말 연속 점프 불가
- 4인 시계 방향 턴, 나간 사람 건너뛰기, 수가 없으면 자동 넘김
- 승리 즉시 종료, 종료 후 수 거부

`computeEloDeltas`는 2인 동점(±16), 2인 점수 차, 4인 동점(+16 / −5×3),
4인에서 약자 승리 시 변동이 더 커지는지를 확인한다.

서버 쪽은 오목·루미 테스트처럼 가짜 Supabase 클라이언트로 차례 검증과
`version` 충돌을 확인한다.

## 범위 밖

컴퓨터 대전, 2:2 팀전, 3인전(공식 미지원), 되돌리기, 기보 다시 보기 화면(기보는
저장만 한다).
