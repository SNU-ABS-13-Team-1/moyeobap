import { getSupabase } from "./supabase";
import { getRoom } from "./omok";

export type OmokChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

type OmokChatRow = {
  id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
};

function mapRow(row: OmokChatRow): OmokChatMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function getRoomChat(roomId: string): Promise<OmokChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("omok_chat_messages")
    .select("id, author_id, author_name, text, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) {
    if (error) console.error("getRoomChat error:", error);
    return [];
  }
  return (data as OmokChatRow[]).map(mapRow);
}

// 대국 참여자(흑/백)만 채팅을 보낼 수 있습니다. 관전자는 GET으로 읽을 수는
// 있지만(서버가 service_role로 내려주므로 RLS와 무관하게 동작) 쓰기는
// 막아, 팟 채팅과 동일한 "참여자만 쓸 수 있다" 원칙을 지킵니다.
export async function postRoomChat(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<OmokChatMessage | { error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "메시지를 입력해주세요." };
  if (trimmed.length > 500) return { error: "메시지가 너무 길어요." };

  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 채팅할 수 있어요." };
  }

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("omok_chat_messages")
    .insert({ room_id: roomId, author_id: userId, author_name: userName, text: trimmed })
    .select("id, author_id, author_name, text, created_at")
    .single();

  if (error || !data) {
    console.error("postRoomChat error:", error);
    return { error: "메시지를 보내지 못했어요." };
  }
  return mapRow(data as OmokChatRow);
}
