import "server-only";
import { createHmac } from "node:crypto";
import { getSupabaseConfig } from "./supabase/config";

// 내 팟에 새 채팅이 왔다는 알림을 Realtime Broadcast로 보냅니다.
//
// 예전에는 로그인한 사용자 모두가 messages 테이블을 postgres_changes로
// 구독했습니다. postgres_changes는 DB의 변경 로그(WAL)를 계속 훑고 구독자마다
// 권한을 검사해서 운영 DB 시간의 절반 이상을 차지했습니다. Broadcast는 DB를
// 거치지 않으므로, 메시지를 저장한 서버가 참여자에게 직접 신호만 보냅니다.
//
// 채널 이름은 사용자 id를 서버 비밀값으로 HMAC한 값이라 남이 추측해서 엿들을
// 수 없습니다. 비밀값이 없는 환경(로컬 등)에서는 알림을 보내지 않고, 헤더
// 표시는 60초 폴링으로 따라옵니다.

export const CHAT_NOTIFY_EVENT = "chat";

/** 서버에서 Broadcast를 기다리는 최대 시간. 채팅 전송 응답을 붙잡지 않게 짧게 둡니다. */
const BROADCAST_TIMEOUT_MS = 2_000;

function notifySecret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function topicFor(secret: string, userId: string): string {
  const digest = createHmac("sha256", secret).update(`chat-notify:${userId}`).digest("hex");
  return `notify-${digest.slice(0, 32)}`;
}

/** 이 사용자가 구독할 알림 채널 이름. 비밀값이 없으면 null입니다. */
export function chatNotifyTopic(userId: string): string | null {
  const secret = notifySecret();
  return secret ? topicFor(secret, userId) : null;
}

/** 보낸 사람을 뺀 참여자들에게 "이 팟에 새 메시지"를 알립니다. 실패해도 채팅 전송은 성공으로 둡니다. */
export async function broadcastChatNotice(
  potId: string,
  authorId: string,
  recipientIds: readonly string[],
): Promise<void> {
  const config = getSupabaseConfig();
  const secret = notifySecret();
  const recipients = recipientIds.filter((id) => id !== authorId);
  if (!config || !secret || recipients.length === 0) return;

  try {
    const response = await fetch(`${config.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: recipients.map((userId) => ({
          topic: topicFor(secret, userId),
          event: CHAT_NOTIFY_EVENT,
          payload: { potId, authorId },
        })),
      }),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("broadcastChatNotice failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("broadcastChatNotice error:", error);
  }
}
