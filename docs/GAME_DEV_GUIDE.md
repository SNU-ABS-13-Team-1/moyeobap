# 🎮 모여밥 신규 게임 & 실시간 기능 개발 가이드

새로운 미니게임이나 실시간 협업 기능을 개발할 때 **Supabase Egress(대역폭 5GB) 및 Vercel 사용량 한도를 초과하지 않도록** 아래 지침을 반드시 준수해야 합니다.

---

## 1. 실시간 상태 동기화 표준 (SWR Polling)

모든 게임 룸, 로비, 랭킹 화면에서 `useSWR`를 사용할 때는 직접 옵션을 작성하지 않고 **`app/lib/swrConfig.ts`의 `POLLING_PRESETS`**를 import하여 사용합니다.

### ✅ 올바른 코드 예시

```tsx
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { POLLING_PRESETS } from '../../lib/swrConfig';

export function MyNewGameRoom({ roomId }: { roomId: string }) {
  // 실시간 게임 룸 (8초 폴링 + 탭 비활성화 시 자동 정지)
  const { data, mutate } = useSWR(
    `/api/games/my-game/rooms/${roomId}`,
    fetcher,
    POLLING_PRESETS.GAME_ROOM,
  );
  
  // ...
}
```

### ❌ 절대 피해야 할 패턴

```tsx
// ❌ refreshWhenHidden이 없거나 주기가 너무 짧음 (사용자가 탭을 켜두고 자면 수 GB 트래픽 발생)
const { data } = useSWR(url, fetcher, { refreshInterval: 1000 }); 
```

---

## 2. Supabase Realtime 채널 & 브로드캐스트 규칙

### A. 방 나가기 / 언마운트 시 채널 완벽 정리 (Clean-up)
소켓 채널을 제대로 닫지 않으면 컴포넌트가 언마운트되어도 백그라운드에서 계속 메시지를 수신하여 트래픽이 낭비됩니다.

```tsx
useEffect(() => {
  const supabase = createSupabaseBrowserClient();
  const channel = supabase.channel(`game-room-${roomId}`);

  channel
    .on('broadcast', { event: 'state' }, (payload) => {
      // 상태 수신
    })
    .subscribe();

  // ✅ 반드시 클린업 함수에서 removeChannel 호출
  return () => {
    supabase.removeChannel(channel);
  };
}, [roomId]);
```

### B. 브로드캐스트 주기 제한
- 퐁이나 실시간 물리 엔진 게임처럼 초당 여러 번 상태를 전송해야 하는 경우, 전송 주기는 **최소 50ms (초당 20회 이하)**로 제한합니다.
- 단순 턴제 게임(오목, 바둑, 체스, 원나잇 인랑 등)은 매 틱마다 브로드캐스트하지 말고, **사용자가 돌을 놓거나 행동을 취했을 때만 1회성 전송**합니다.

---

## 3. 신규 게임 개발 체크리스트

새 기능을 PR 올리기 전 아래 항목을 체크하세요:

- [ ] `useSWR`에 `POLLING_PRESETS`를 적용했는가?
- [ ] 브라우저 다른 탭으로 전환했을 때 네트워크 요청(Fetch)이 멈추는가? (`refreshWhenHidden: false`)
- [ ] Supabase Realtime 채널 구독 후 `useEffect` 클린업에서 `removeChannel`을 호출하는가?
- [ ] 게임 방 삭제/종료 시 방 데이터가 무한정 쌓이지 않고 만료 로직이 동작하는가?
- [ ] 데이터베이스 마이그레이션 파일이 `supabase/migrations/YYYYMMDD000000_add_[game].sql` 규칙을 따르는가?
