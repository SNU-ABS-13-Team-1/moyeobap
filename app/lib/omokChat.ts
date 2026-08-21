import { getSupabase } from "./supabase";
import { getRoom } from "./omok";

export type OmokChatAuthorRole = "black" | "white" | "spectator";
export type OmokChatKind = "text" | "image";

export type OmokChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  /** 메시지를 쓴 시점의 역할. 이 기능 이전 메시지는 null입니다. */
  authorRole: OmokChatAuthorRole | null;
  text: string;
  kind: OmokChatKind;
  imageUrl?: string;
  createdAt: string;
};

type OmokChatRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_role: OmokChatAuthorRole | null;
  text: string;
  kind: OmokChatKind;
  created_at: string;
};

// kind가 'image'일 때는(모여밥 이모티콘) 별도 컬럼 없이 text에 이미지
// 경로를 그대로 저장합니다 — 팟 채팅(messages 테이블)과 동일한 방식입니다.
function mapRow(row: OmokChatRow): OmokChatMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    text: row.text,
    kind: row.kind,
    imageUrl: row.kind === "image" ? row.text : undefined,
    createdAt: row.created_at,
  };
}

export async function getRoomChat(roomId: string): Promise<OmokChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("omok_chat_messages")
    .select("id, author_id, author_name, author_role, text, kind, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) {
    if (error) console.error("getRoomChat error:", error);
    return [];
  }
  return (data as OmokChatRow[]).map(mapRow);
}

// 관전자도 채팅에 참여할 수 있습니다. 대신 메시지마다 쓴 시점의 역할을
// 함께 저장해, 화면에서 두는 사람과 구경하는 사람을 구분해 보여줍니다.
// 역할을 조회 시점에 방의 black_id/white_id로 계산하지 않는 이유는, 재대국
// 때 흑백이 교대되면 지난 메시지의 표시까지 뒤바뀌기 때문입니다.
// 이모티콘 ID → 실제 경로 화이트리스트 검증은 호출하는 쪽(API 라우트)에서
// 하고, 여기는 최종 text/kind만 받습니다.
export async function postRoomChat(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
  kind: OmokChatKind = "text",
): Promise<OmokChatMessage | { error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "메시지를 입력해주세요." };
  if (trimmed.length > 500) return { error: "메시지가 너무 길어요." };

  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };

  const authorRole: OmokChatAuthorRole =
    room.blackId === userId ? "black" : room.whiteId === userId ? "white" : "spectator";

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("omok_chat_messages")
    .insert({
      room_id: roomId,
      author_id: userId,
      author_name: userName,
      author_role: authorRole,
      text: trimmed,
      kind,
    })
    .select("id, author_id, author_name, author_role, text, kind, created_at")
    .single();

  if (error || !data) {
    console.error("postRoomChat error:", error);
    return { error: "메시지를 보내지 못했어요." };
  }
  return mapRow(data as OmokChatRow);
}
