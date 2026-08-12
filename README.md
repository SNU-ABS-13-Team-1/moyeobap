# 모여밥

서울대학교 시흥캠퍼스 구성원이 같은 음식점에서 공동주문할 사람을 찾고 참여하는
웹앱입니다. 제품 범위와 UX 결정은 [AGENTS.md](AGENTS.md)를 단일 기준으로
관리합니다.

## 현재 구현

- Next.js App Router 기반 실시간 현황판
- 조사된 음식점과 대표 메뉴 데이터
- 모집 생성, 참여, 참여 취소와 자동 마감 API
- 참여자 전용 신원·관리자 표시와 채팅
- 4초 간격 모집 갱신, 3초 간격 채팅 갱신
- Upstash Redis 저장소와 로컬 개발용 메모리 저장소

현재 이메일 로그인은 백엔드 흐름을 검증하기 위한 임시 인증입니다. 대상
워크스페이스 구성원 확인이 가능한 실제 인증으로 교체하기 전에는 운영 환경에
공개하지 않습니다.

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
MOYEOBAP_SESSION_SECRET=<충분히 긴 무작위 문자열>
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

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
