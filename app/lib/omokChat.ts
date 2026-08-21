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

// 흑/백뿐 아니라 관전자도 채팅을 보낼 수 있습니다(게임 조작은 여전히
// 참여자만 가능 — app/lib/omok.ts의 submitMove 참고). 여기서는 방이 실제로
// 존재하는지만 확인해 엉뚱한/존재하지 않는 방에 메시지가 쌓이는 것만
// 막습니다.
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
