# 모여밥

같은 음식점에서 공동주문할 사람을 찾고 참여하는 웹앱입니다. 제품 범위와 UX
결정은 [AGENTS.md](AGENTS.md)를 단일 기준으로
관리합니다.

## 현재 구현

- 배포된 사이트: [moyeobap.vercel.app](https://moyeobap.vercel.app/)
- GitHub 저장소: [famegon/moyeobap](https://github.com/famegon/moyeobap)
- 제품 범위와 세부 결정: [모여밥 작업 지침서](AGENTS.md)

음식점과 메뉴는 팀이 직접 조사한 실제 데이터 112곳입니다. 모집 정보는 접속한
사람들이 실제로 만든 것이며 서버에 저장되어 다른 사람에게도 보입니다.

## 왜 만들고 있나요?

약 40명이 함께 생활하는 공간에서 점심이나 카페 주문을 함께할 사람을 찾으려면
직접 물어보거나 Slack 대화를 계속 확인해야 합니다. 누가 같은 음식점을 원하는지,
몇 명이 모였는지, 언제 모집이 끝나는지 한눈에 알기 어렵고 주문을 제안하는
사람에게 부담도 몰립니다.

모여밥은 음식점별 공동주문 모집과 참여 현황을 한곳에 보여줘 이 과정을 더
간단하게 만드는 것을 목표로 합니다. 메뉴를 직접 고르거나 결제하는 서비스는
아니며, 함께 주문할 사람을 모으는 데 집중합니다.

## 사용자는 어떻게 이용하나요?

1. Slack 공지에 있는 모여밥 링크를 눌러 실시간 모집을 확인합니다.
2. 원하는 음식점의 모집을 열어 마감 시간, 참여 인원과 매장 정보를 확인합니다.
3. 참여하려면 Google 계정으로 로그인한 뒤 모집에 참여합니다.
4. 원하는 모집이 없다면 음식점과 마감 시간을 골라 새 모집을 만듭니다.
5. 모집이 끝나면 확정된 참여자들과 팟 채팅에서 실제 주문을 논의합니다.

## 지금 어디까지 진행됐나요?

현재는 사용자가 위 과정을 자연스럽게 따라갈 수 있는지 화면을 직접 눌러보며
점검하고 있습니다. 현황판, 모집 상세, 새 모집 화면을 만들어 두었지만 최종
디자인은 아닙니다. 불편하거나 빠진 부분을 발견하면 화면 구성뿐 아니라 앞서
정한 사용 순서도 다시 고칩니다.

화면 구성이 안정되면 색상, 글꼴, 버튼과 카드 모양 같은 공통 디자인을 정하고
실제 UI를 다듬을 예정입니다.

## 현재 화면에서 확인할 수 있는 것

### 실시간 현황판

- 로그인하지 않아도 모집 목록과 현재 참여 인원 확인
- 전체 모집과 내가 참여한 모집 전환
- 점심과 카페 모집 전환
- 마감된 모집은 `마감` 탭으로 따로 모아 확인
- 음식점·카테고리 검색과 마감이 가까운 순서 확인
- 카드에서 바로 참여하거나 상세 화면으로 이동

### 모집 상세

- 마감 시간, 참여 인원, 배달 예상 시간과 최소 주문금액 확인
- 매장 정보와 대표메뉴 최대 5개 확인
- 참여와 참여 취소
- 참여 후 참여자 이름과 현재 모집 관리자 확인
- 관리자가 빠질 때 참여 순서에 따른 자동 관리자 변경 확인
- 참여자끼리 팟 채팅으로 대화. 마감 뒤에도 대화는 이어집니다
- 등록해 둔 계좌번호를 버튼 한 번으로 채팅방에 공유

### 새 모집 만들기

- 음식점, 점심·카페 구분과 모집 마감 시간 입력
- 목록에 없는 매장은 이름과 구분만 입력해 즉석에서 직접 추가
- 마감 시간은 15분부터 3시간까지, 최대 인원은 선택 사항
- 같은 음식점의 진행 중인 모집 확인
- 같은 마감 시간의 중복 모집 방지
- 모집 생성자를 첫 참여자이자 최초 관리자로 등록

## 지금 어디까지 연결됐나

| 항목 | 현재 상태 |
|---|---|
| 음식점·메뉴 데이터 | 팀이 조사한 실제 데이터 112곳 |
| 참여·새 모집·채팅 | Supabase PostgreSQL에 저장 |
| 새로고침 후 변경사항 | 유지됨 |
| 여러 사용자의 실시간 참여 | 4초마다 목록 갱신, 채팅은 Supabase Realtime과 3초 보조 갱신 |
| 모집 마감 자동 처리 | 마감 시간이나 정원 도달 시 자동 마감 |
| 로그인 | Supabase Auth 기반 Google OAuth |
| Slack 알림 | 미구현. 연동 범위 결정 전 |
| 참여자 대화 | 앱 안의 팟 채팅으로 처리. Slack 인계는 계획에서 제외 |

## 데이터 구분

모여밥이 다루는 데이터는 중요도가 아니라 **서비스 안에서 만들어지고 활용되는
방식**에 따라 세 가지로 나눕니다.

1. **외부 기준 데이터** — 음식점명, 위치, 메뉴 등 외부에서 가져와 쓰는 데이터
2. **실시간 상태 데이터** — 모집 중인 음식점, 참여 인원, 마감 시간 등 현재 상태
3. **행동/Event 데이터** — 모집 생성·참여·취소·성공·평가 등 누적되는 이용 기록

세 데이터는 각각 다른 역할을 맡으므로 메인·보조로 나누지 않습니다. 구분의
근거와 평가기준 대응, 발표에서 다룰 방식은
[데이터 구분과 평가기준 대응](docs/DATA_CATEGORIES.md)에 정리했습니다.

## 음식점·메뉴 데이터 작성

팀원들이 수집한 자료는 원본과 앱에서 사용하는 정리본을 구분합니다. 데이터를
추가하거나 수정하기 전에는 [상세 데이터 작성 가이드](data/DATA_GUIDE.md)의
파일 형식과 검수 기준을 확인해 주세요.

```text
시흥캠퍼스_식당카페_조사표_통합.xlsx   조사·검수 작업 파일 (저장소 루트)
조사표_원본/              빈 템플릿과 개인별 조사표
data/
├─ <캡처폴더>/extracted.json   배민 캡처 OCR 산출물 (매장·메뉴 원본)
├─ restaurants.csv      검토가 끝난 음식점·카페 정보 (정본)
├─ menus.csv            검토가 끝난 메뉴·가격 정보 (정본)
├─ sources.csv          출처와 확인 날짜
└─ DATA_GUIDE.md        데이터 입력 및 검수 규칙
```

앱용 데이터는 음식점·카페와 메뉴를 각각 `restaurants.csv`와 `menus.csv`로
분리하고 `restaurant_id`로 연결합니다. 메뉴 화면에는 이미지, 이름과 가격만
표시합니다.

핵심 작성 규칙:

- 음식점과 메뉴 ID는 중복 없이 작성하고 임의로 변경하지 않습니다.
- 가격에는 쉼표나 `원`을 붙이지 않고 숫자만 입력합니다.
- 단품 주문이 불가능한 샷·시럽·휘핑 등의 추가 옵션은 메뉴에서 제외합니다.
- 출처와 가격 확인 날짜를 `sources.csv`에 기록합니다.
- 확인하지 못한 값은 추측하지 않고 비워둡니다.
- 이미지 사용 권한을 확인하고 최종 데이터에는 허용된 로컬 경로나 `https`
  주소만 사용합니다.
- 계정 비밀번호, API 키, 계좌번호 등 개인정보나 민감정보를 올리지 않습니다.
- 수집 경로는 **배민 앱 화면 캡처 → AI OCR → 조사표 엑셀** 하나로 통일합니다.
  크롤러나 HTML 저장 후 파싱하는 방식은 쓰지 않습니다
  ([DATA_GUIDE §6](data/DATA_GUIDE.md#6-수집-경로)).

## 팀원 협업 방식 제안

`main` 브랜치는 현재 확인 가능한 안정 버전으로 사용합니다. 팀원은 기능이나
데이터를 수정할 때 개인 브랜치를 만든 뒤 Pull Request로 검토를 요청합니다.

```bash
git switch -c data/restaurant-update
```

작업을 마친 뒤:

```bash
git add data/
git commit -m "배곧 지역 음식점 데이터 추가"
git push -u origin data/restaurant-update
```

Pull Request에서는 다음 항목을 확인합니다.

- 음식점 및 메뉴 ID 중복 여부
- 메뉴와 음식점 연결 여부
- 가격과 숫자 형식
- 출처와 마지막 확인 날짜
- 단품 주문이 불가능한 추가 옵션 포함 여부
- 이미지 주소 형식과 사용 권한
- 개인정보 또는 민감정보 포함 여부
- 기존 화면에서 데이터가 정상적으로 표시되는지

### 작업용 브랜치 안내

`main`을 직접 건드리지 않기 위해, 진행 중인 작업은 별도 브랜치에서 이루어질
수 있습니다. 브랜치 이름은 작업 내용에 따라 자유롭게 정하며, 아래
`dev/wip`은 예시일 뿐 고정된 브랜치가 아닙니다.

다른 팀원이 특정 작업 브랜치를 처음 받아서 이어서 수정하려면(예시로
`dev/wip` 브랜치를 받는 경우):

```bash
git fetch origin
git switch --track origin/dev/wip
```

이 브랜치의 변경사항은 검토가 끝나기 전까지 `main`에 반영되지 않습니다.
작업이 정리되면 Pull Request를 통해 `main`으로 병합을 요청합니다.

## 로컬 실행 방법

### 준비 사항

- Node.js 22.13 이상
- npm

### 실행

```bash
npm ci
cp .env.example .env.local
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다. Redis 환경
변수가 없으면 모집과 채팅은 실행 중인 개발 서버의 메모리에 저장되며 서버를
재시작하면 초기화됩니다.

## 환경 변수

운영 환경에서는 다음 값을 설정해야 합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase server-only service role key>
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

기존 프로젝트의 legacy 키를 사용하는 동안에는
`NEXT_PUBLIC_SUPABASE_ANON_KEY`도 지원합니다. Google provider를 활성화하고
Supabase Auth의 Redirect URLs에 로컬 `http://localhost:3000/auth/callback`과
운영 도메인의 `/auth/callback`을 등록해야 합니다. 프로필 테이블과 RLS는
`supabase/migrations/`의 SQL을 파일명 순서대로 적용합니다. 현재는 Google
프로필 마이그레이션과 피드백·채팅 읽음·주문 완료 마이그레이션이 포함됩니다.
새 프로젝트라면 SQL Editor에서 먼저 `supabase/schema.sql`을 적용하고, 기존
프로젝트라면 적용하지 않은 migration만 순서대로 실행합니다.

`SUPABASE_SERVICE_ROLE_KEY`는 핵심 테이블을 수정하는 서버 API에서만 사용합니다.
절대로 `NEXT_PUBLIC_` 접두사를 붙이거나 브라우저 코드·Git 저장소에 넣지 않습니다.

Vercel KV 이름을 사용하는 경우 `KV_REST_API_URL`, `KV_REST_API_TOKEN`도
지원합니다. `.env*` 파일은 Git에서 제외됩니다.

`UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN`이 없으면 모집 정보가
프로세스 메모리에만 남습니다. 혼자 화면을 확인할 때는 문제없지만, 배포
환경에서는 요청마다 다른 인스턴스에 닿아 팟이 사라졌다 나타납니다. 개인
Vercel에 배포한다면 Storage 탭에서 데이터베이스를 먼저 연결하세요.

## 검증 명령

```bash
npm run lint
npm run typecheck
npm run build
```

## 매장 데이터 고치기

음식점·메뉴 정보는 CSV가 정본이고, 앱이 읽는 `app/data/restaurants.ts`는
스크립트가 만드는 생성물입니다. 직접 고치면 다음 실행에서 덮어써집니다.

```bash
python3 scripts/xlsx_to_csv.py   # 조사표 엑셀 → data/*.csv
npm run data:build               # data/*.csv → app/data/restaurants.ts
```

작성 규칙과 검수 항목은 [데이터 작성 가이드](data/DATA_GUIDE.md)에 있습니다.

## 배포

GitHub 저장소를 Vercel에 연결해 [moyeobap2.vercel.app](https://moyeobap.vercel.app/)
으로 배포하고 있습니다.

## 프로젝트 구조

```text
moyeobap/
├─ app/
│  ├─ api/               인증·프로필·모집·참여·채팅 API와 행동 기록
│  ├─ components/moyeobap/  헤더, 모집 카드, 페이지 UI와 채팅
│  ├─ data/restaurants.ts   매장 데이터 (생성물, 직접 수정 금지)
│  ├─ lib/               Supabase·Redis 연결, 세션, 팟·이벤트 처리
│  ├─ types/moyeobap.ts  공용 타입
│  ├─ my/                내 참여 모집과 채팅방 허브
│  ├─ pots/              새 모집과 모집 상세 페이지
│  ├─ page.tsx           실시간 현황판
│  ├─ prototype.css      현재 화면 스타일
│  ├─ globals.css        전역 리셋
│  └─ layout.tsx         공통 화면 틀과 페이지 정보
├─ scripts/              엑셀 → CSV → 앱 데이터 변환
├─ public/               공유 이미지와 정적 파일
├─ data/                 음식점·메뉴 정본 CSV와 작성 가이드
├─ docs/                 데이터 구분과 평가기준 대응 문서
├─ package.json
├─ next.config.ts
└─ README.md
```

화면에 보이는 음식점은 `app/data/restaurants.ts`(CSV에서 생성)에서 오고,
모집·채팅은 사용자가 만든 실제 데이터가 Supabase에 저장됩니다. 환경변수가 없는
로컬 환경에서는 Upstash Redis 또는 프로세스 메모리로 대체됩니다.
별도의 예시(Mock) 데이터 파일은 없습니다.
