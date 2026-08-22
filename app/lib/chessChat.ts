import { getSupabase } from "./supabase";
import { colorOf, getRoom } from "./chessOnline";

// 체스 방 채팅. 플레이어(백/흑)와 관전자 모두 쓸 수 있고, 메시지마다 쓴 시점의
// 역할을 저장합니다(재대국으로 색이 바뀌어도 지난 메시지 표시가 안 뒤집히게).
export type ChessChatAuthorRole = "white" | "black" | "spectator";

export type ChessChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: ChessChatAuthorRole | null;
  text: string;
  createdAt: string;
};

type ChatRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_role: ChessChatAuthorRole | null;
  text: string;
  created_at: string;
};

function mapRow(row: ChatRow): ChessChatMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function getRoomChat(roomId: string): Promise<ChessChatMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chess_chat_messages")
    .select("id, author_id, author_name, author_role, text, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) {
    if (error) console.error("chess getRoomChat error:", error);
    return [];
  }
  return (data as ChatRow[]).map(mapRow);
}

export async function postRoomChat(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<ChessChatMessage | { error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "메시지를 입력해주세요." };
  if (trimmed.length > 500) return { error: "메시지가 너무 길어요." };

  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };

  const authorRole: ChessChatAuthorRole = colorOf(room, userId) ?? "spectator";

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("chess_chat_messages")
    .insert({ room_id: roomId, author_id: userId, author_name: userName, author_role: authorRole, text: trimmed })
    .select("id, author_id, author_name, author_role, text, created_at")
    .single();

  if (error || !data) {
    console.error("chess postRoomChat error:", error);
    return { error: "메시지를 보내지 못했어요." };
  }
  return mapRow(data as ChatRow);
}
