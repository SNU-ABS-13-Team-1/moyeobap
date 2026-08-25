# 알림: 새 팟 · 내 팟 채팅

2026-08-25

## 무엇을 해결하나

게임 화면에 들어가 있으면 현황판을 볼 수 없다. 그 사이에 팟이 새로 열려도,
참여 중인 팟에 이야기가 오가도 알 방법이 없어서 게임을 끝내고 나서야 발견한다.

## 두 경로로 나뉘는 이유

RLS 때문에 감지 방법이 갈린다.

| | 새 팟 | 내 팟 채팅 |
|---|---|---|
| 경로 | 서버 API 폴링(15초) | Supabase Realtime |
| 근거 | `pots`는 `revoke all ... from authenticated` — 클라이언트가 구독할 수 없다 | `messages`는 `grant select` + `messages_select_participants` 정책이 있어 참여자가 구독할 수 있다 |
| 지연 | 최대 15초 | 즉시 |

## 구성

```
app/lib/notifications.ts                 selectNewPots / shouldNotifyMessage (순수 함수)
app/lib/notifications.test.ts            위 두 함수의 테스트
app/api/notifications/summary/route.ts   모집 중 팟 목록 · 내 팟 id · 안읽음 집계
app/components/moyeobap/
  NotificationProvider.tsx               폴링 + Realtime 구독 + 토스트 큐
  NotificationToasts.tsx                 우하단 토스트, 3초 후 사라짐
  Header.tsx                             현황판 · 내 참여에 카운트 배지
app/layout.tsx                           플래그가 켜져 있을 때만 Provider를 매단다
supabase/migrations/20260904000000_add_notifications_flag.sql
```

## 판정을 서버가 아니라 클라이언트에서 하는 이유

"무엇이 새 팟인가"의 기준 시각(`lastSeenPotAt`)은 브라우저 localStorage에 있다.
이걸 질의 문자열에 실으면 응답이 올 때마다 SWR 키가 바뀌고, 폴링이 자기 자신을
다시 부르는 루프가 된다. 그래서 서버는 모집 중 팟 목록만 내려주고, 판정은
클라이언트가 `selectNewPots`로 한다. 기준 시각(`now`)은 응답에 실려 온 서버
시각을 써서, 브라우저 시계가 틀어져도 판정이 흔들리지 않게 한다.

## 규칙

- 새 팟: `status === 'active'`, 마감 전, 내가 만들지 않은 것, `createdAt > lastSeenAt`
- `lastSeenAt`이 없으면(첫 방문) 아무것도 띄우지 않는다 — 밀린 알림을 쏟지 않는다
- 채팅: 내가 쓴 메시지는 제외. 구독 자체를 내 팟 id로 걸고, 받은 이벤트도 내 팟
  집합으로 한 번 더 거른다(구독 필터나 RLS가 어긋나도 남의 팟 내용이 뜨지 않게)
- 배지 해제: 현황판을 열면 새 팟 배지가, 팟 상세를 열면 기존 `message_reads`
  갱신을 통해 그 팟 채팅 배지가 사라진다

## 테스트 서버에만 켜는 방법

운영과 테스트가 같은 코드로 배포되므로 코드 분기가 아니라 `app_flags`를 쓴다
(`games_hub`와 같은 방식). 마이그레이션은 `notifications`를 **false로** 넣고,
테스트 DB에서만 켠다.

```sql
update public.app_flags set enabled = true where key = 'notifications';
```

플래그가 꺼져 있으면 `layout.tsx`가 Provider를 매달지 않는다. 폴링도 Realtime
구독도 시작되지 않는다. `isFeatureEnabled`는 조회 실패 시 false를 돌려주는
fail-closed라, 마이그레이션을 적용하지 않은 환경에서도 조용히 꺼져 있다.

## 남겨둔 것

- 브라우저 알림(Notification API)과 소리는 넣지 않았다. 권한 팝업이 필요하고,
  거부되면 오히려 아무것도 안 보인다
- 알림 히스토리 화면은 만들지 않았다. 배지와 토스트로 충분하다
