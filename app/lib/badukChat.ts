import { getSupabase } from "./supabase";
import { getRoom } from "./baduk";

export type BadukChatAuthorRole = "black" | "white" | "spectator";

export type BadukChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  /** 메시지를 쓴 시점의 역할. */
  authorRole: BadukChatAuthorRole | null;
  text: string;
  createdAt: string;
};

type BadukChatRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_role: BadukChatAuthorRole | null;
  text: string;
  created_at: string;
};

function mapRow(row: BadukChatRow): BadukChatMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function getRoomChat(roomId: string): Promise<BadukChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("baduk_chat_messages")
    .select("id, author_id, author_name, author_role, text, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) {
    if (error) console.error("getRoomChat error:", error);
    return [];
  }
  return (data as BadukChatRow[]).map(mapRow);
}

// 관전자도 채팅에 참여할 수 있습니다. 메시지마다 쓴 시점의 역할을 함께
// 저장해, 재대국으로 흑백이 교대돼도 지난 메시지의 표시가 뒤바뀌지
// 않습니다.
export async function postRoomChat(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<BadukChatMessage | { error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "메시지를 입력해주세요." };
  if (trimmed.length > 500) return { error: "메시지가 너무 길어요." };

  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };

  const authorRole: BadukChatAuthorRole =
    room.blackId === userId ? "black" : room.whiteId === userId ? "white" : "spectator";

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("baduk_chat_messages")
    .insert({
      room_id: roomId,
      author_id: userId,
      author_name: userName,
      author_role: authorRole,
      text: trimmed,
    })
    .select("id, author_id, author_name, author_role, text, created_at")
    .single();

  if (error || !data) {
    console.error("postRoomChat error:", error);
    return { error: "메시지를 보내지 못했어요." };
  }
  return mapRow(data as BadukChatRow);
}
