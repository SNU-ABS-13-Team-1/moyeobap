import { getSupabase } from "./supabase";
import { getRoom } from "./phoneOnline";

export type PhoneChatAuthorRole = "player" | "spectator";

export type PhoneChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: PhoneChatAuthorRole | null;
  text: string;
  createdAt: string;
};

type ChatRow = { id: string; author_id: string; author_name: string; author_role: PhoneChatAuthorRole | null; text: string; created_at: string };

function mapRow(row: ChatRow): PhoneChatMessage {
  return { id: row.id, authorId: row.author_id, authorName: row.author_name, authorRole: row.author_role, text: row.text, createdAt: row.created_at };
}

export async function getRoomChat(roomId: string): Promise<PhoneChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("phone_chat_messages")
    .select("id, author_id, author_name, author_role, text, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return (data as ChatRow[]).map(mapRow);
}

export async function postRoomChat(roomId: string, userId: string, userName: string, text: string): Promise<PhoneChatMessage | { error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "메시지를 입력해주세요." };
  if (trimmed.length > 500) return { error: "메시지가 너무 길어요." };
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  const authorRole: PhoneChatAuthorRole = room.players.some((p) => p.id === userId && !p.left) ? "player" : "spectator";

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };
  const { data, error } = await supabase
    .from("phone_chat_messages")
    .insert({ room_id: roomId, author_id: userId, author_name: userName, author_role: authorRole, text: trimmed })
    .select("id, author_id, author_name, author_role, text, created_at")
    .single();
  if (error || !data) return { error: "메시지를 보내지 못했어요." };
  return mapRow(data as ChatRow);
}
