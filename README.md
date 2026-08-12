# 모여밥

같은 음식점에서 공동주문할 사람을 찾고 참여하는 웹앱입니다. 제품 범위와 UX
결정은 [AGENTS.md](AGENTS.md)를 단일 기준으로
관리합니다.

## 현재 구현

- Next.js App Router 기반 실시간 현황판
- 조사된 음식점과 대표 메뉴 데이터
- 모집 생성, 참여, 참여 취소와 자동 마감 API
- 참여자 전용 신원·관리자 표시와 채팅
- Supabase Auth 기반 Google 로그인과 프로필 편집
- 현황판(`/`), 내 참여(`/my`), 새 모집(`/pots/new`), 모집 상세(`/pots/[id]`)
  페이지 분리
- 데스크톱 모집 상세·채팅 2단 배치와 모바일 정보·채팅 탭 전환
- 4초 간격 모집 갱신, 3초 간격 채팅 갱신
- Upstash Redis 저장소와 로컬 개발용 메모리 저장소

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm ci
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
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

기존 프로젝트의 legacy 키를 사용하는 동안에는
`NEXT_PUBLIC_SUPABASE_ANON_KEY`도 지원합니다. Google provider를 활성화하고
Supabase Auth의 Redirect URLs에 로컬 `http://localhost:3000/auth/callback`과
운영 도메인의 `/auth/callback`을 등록해야 합니다. 프로필 테이블과 RLS는
`supabase/migrations/20260812000000_google_auth_profiles.sql`을 적용합니다.

Vercel KV 이름을 사용하는 경우 `KV_REST_API_URL`, `KV_REST_API_TOKEN`도
지원합니다. `.env*` 파일은 Git에서 제외됩니다.

## 검증 명령

```bash
npm run lint
npm run typecheck
npm run build
```

## 프로젝트 구조

```text
app/
├─ api/                    인증, 음식점, 모집과 채팅 API
├─ components/moyeobap/    현황판 UI와 공통 모달
├─ data/                   화면에서 사용하는 음식점 데이터
├─ hooks/                  시계와 토스트 상태 훅
├─ lib/                    인증, 저장소, API 클라이언트와 도메인 유틸리티
├─ types/                  클라이언트·API 공유 타입
├─ page.tsx                실시간 현황판
├─ prototype.css           현재 화면 스타일
└─ globals.css             최소 전역 리셋

data/                      조사 원본과 가공 CSV
public/scratch-moyeobap/   이전 정적 프로토타입 참고본
scripts/                   데이터 가공 스크립트
```
