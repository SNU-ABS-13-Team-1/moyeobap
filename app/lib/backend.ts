import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRedis } from "./kv";
import { getSupabase } from "./supabase";
import { toParticipantProfiles } from "./potParticipants";
import { RESTAURANTS } from "../data/restaurants";
import { isChatEmojiPath } from "../data/chat-emojis";
import type {
  CampusStats,
  CategoryStat,
  ChatMessage,
  ChatMessagePreview,
  DiningMateStat,
  MyStatsReport,
  PeakHourStat,
  PotEvent,
  PotEventType,
  Restaurant,
  SerializedPot,
  TopRestaurantStat,
  User,
} from "../types/moyeobap";

export type ServerPot = {
  id: string;
  restaurantId: string;
  deadline: string; // ISO timestamp
  participants: (User & { joinedAt: number; isPaid?: boolean; orderMemo?: string })[];
  status: "active" | "closed" | "failed";
  category?: "lunch" | "cafe" | "other";
  maxParticipants: number | null;
  createdAt: string;
  creatorId: string;
  managerId: string | null;
  orderCompletedAt: string | null;
  orderCompletedBy: string | null;
  pinnedMessageId?: string | null;
};

type StoredPot = Omit<
  ServerPot,
  "creatorId" | "managerId" | "orderCompletedAt" | "orderCompletedBy"
> & Partial<Pick<
  ServerPot,
  "creatorId" | "managerId" | "orderCompletedAt" | "orderCompletedBy"
>>;

const POT_INDEX_KEY = "moyeobap:pots:index";
const EVENT_LOG_KEY = "moyeobap:events";
const potKey = (id: string) => `moyeobap:pot:${id}`;
const potMessagesKey = (id: string) => `moyeobap:pot:${id}:messages`;
const potMessageReadKey = (potId: string, userId: string) =>
  `moyeobap:pot:${potId}:read:${userId}`;
const CUSTOM_RESTAURANT_INDEX_KEY = "moyeobap:restaurants:custom:index";
const customRestaurantKey = (id: string) => `moyeobap:restaurant:custom:${id}`;

// Local-dev fallback when neither Supabase nor Redis is configured.
const memoryPots = new Map<string, ServerPot>();
const memoryPotIndex = new Set<string>();
const memoryMessages = new Map<string, ChatMessage[]>();
const memoryMessageReads = new Map<string, string>();
const memoryEvents: PotEvent[] = [];
const memoryCustomRestaurants = new Map<string, Restaurant>();
const memoryCustomRestaurantIndex = new Set<string>();

function normalizePot(pot: StoredPot): ServerPot {
  const participants = pot.participants
    .map((participant) => ({ ...participant }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
  const firstParticipantId = participants[0]?.id ?? null;

  return {
    ...pot,
    category: pot.category,
    participants,
    creatorId: pot.creatorId ?? firstParticipantId ?? "",
    managerId: pot.managerId ?? firstParticipantId,
    orderCompletedAt: pot.orderCompletedAt ?? null,
    orderCompletedBy: pot.orderCompletedBy ?? null,
    pinnedMessageId: pot.pinnedMessageId ?? null,
  };
}

function clonePot(pot: ServerPot): ServerPot {
  return { ...pot, participants: pot.participants.map((participant) => ({ ...participant })) };
}

function getPinnedMessageView(potId: string, messageId: string) {
  const messages = memoryMessages.get(potId) ?? [];
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;
  return { id: msg.id, authorName: msg.authorName, text: msg.text };
}

/** API 응답에서 이메일 id와 계좌번호를 제거하고, 참여자에게만 신원을 공개합니다. */
export function toPotView(
  pot: ServerPot,
  currentUser: User | null,
  chatSummary?: { latestMessage: ChatMessagePreview | null; unreadMessageCount: number },
): SerializedPot {
  const isParticipating = Boolean(
    currentUser && pot.participants.some((participant) => participant.id === currentUser.id),
  );

  const pinnedMessage = pot.pinnedMessageId
    ? getPinnedMessageView(pot.id, pot.pinnedMessageId)
    : null;

  return {
    id: pot.id,
    restaurantId: pot.restaurantId,
    deadline: pot.deadline,
    participantCount: pot.participants.length,
    participants: isParticipating
      ? toParticipantProfiles(pot.participants, pot.managerId, currentUser?.id ?? null)
      : null,
    isParticipating,
    isManaging: Boolean(currentUser && currentUser.id === pot.managerId),
    status: pot.status,
    category: pot.category,
    maxParticipants: pot.maxParticipants,
    orderCompletedAt: pot.orderCompletedAt,
    pinnedMessage,
    latestMessage: isParticipating ? chatSummary?.latestMessage ?? null : null,
    unreadMessageCount: isParticipating ? chatSummary?.unreadMessageCount ?? 0 : 0,
  };
}

/** 마감 시간이 지났거나 정원이 찼는데 아직 반영 안 된 상태를 지금 시각 기준으로 계산합니다. */
export function deriveStatus(pot: ServerPot, now: Date = new Date()): ServerPot["status"] {
  if (pot.status !== "active") return pot.status;
  if (pot.participants.length === 0) return "failed";

  const timeUp = now.getTime() >= new Date(pot.deadline).getTime();
  const capReached =
    pot.maxParticipants !== null && pot.participants.length >= pot.maxParticipants;

  if (!timeUp && !capReached) return "active";
  return pot.participants.length >= 2 ? "closed" : "failed";
}

async function ensureRestaurantExistsInSupabase(restaurantId: string): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data } = await supabase.from("restaurants").select("id").eq("id", restaurantId).maybeSingle();
    if (data) return;

    const restaurant = RESTAURANTS.find((r) => r.id === restaurantId) ?? memoryCustomRestaurants.get(restaurantId);
    if (restaurant) {
      const { error } = await supabase.from("restaurants").upsert({
        id: restaurant.id,
        name: restaurant.name,
        emoji: restaurant.emoji,
        category: restaurant.category,
        sub_category: restaurant.subCategory ?? null,
        min_order: restaurant.minOrder,
        delivery_time: restaurant.deliveryTime,
        menus: restaurant.menus,
        address: restaurant.address ?? null,
        phone: restaurant.phone ?? null,
        business_hours: restaurant.businessHours ?? null,
        closed_days: restaurant.closedDays ?? null,
        rating: restaurant.rating ?? 5.0,
        is_custom: restaurant.isCustom ?? false,
      });
      if (error) {
        console.error("Supabase ensureRestaurantExistsInSupabase error:", error);
      }
    }
  } catch (err) {
    console.error("ensureRestaurantExistsInSupabase exception:", err);
  }
}

const MAX_EVENTS = 2000;

/**
 * 기록 데이터를 남깁니다. 기록에 실패해도 사용자의 동작은 성공한 것으로
 * 둡니다 — 통계용 로그 때문에 모집 참여가 막히면 안 됩니다.
 */
export async function logEvent(
  type: PotEventType,
  pot: Pick<ServerPot, "id" | "restaurantId" | "participants">,
  userId?: string,
): Promise<void> {
  const event: PotEvent = {
    id: randomUUID(),
    type,
    potId: pot.id,
    restaurantId: pot.restaurantId,
    ...(userId ? { userId } : {}),
    participantCount: pot.participants.length,
    createdAt: new Date().toISOString(),
  };

  try {
    const client = getRedis();
    if (!client) {
      memoryEvents.push(event);
      if (memoryEvents.length > MAX_EVENTS) {
        memoryEvents.splice(0, memoryEvents.length - MAX_EVENTS);
      }
      return;
    }
    await client.rpush(EVENT_LOG_KEY, JSON.stringify(event));
    await client.ltrim(EVENT_LOG_KEY, -MAX_EVENTS, -1);
  } catch (error) {
    console.error("이벤트 기록 실패", error);
  }
}

export async function listEvents(): Promise<PotEvent[]> {
  const client = getRedis();
  if (!client) return [...memoryEvents];
  const raw = await client.lrange<string>(EVENT_LOG_KEY, 0, -1);
  return raw.map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
}

export async function savePot(pot: ServerPot): Promise<boolean> {
  // 캐시는 쓰기가 "끝난 뒤"에 비웁니다. 쓰기 전에 비우면, 커밋되기 직전에
  // 끼어든 listPots()가 옛 데이터를 다시 캐시에 앉혀 놓아 저장이 끝난 뒤로도
  // TTL 내내 옛 목록이 내려갑니다.
  try {
    return await writePot(pot);
  } finally {
    invalidatePotsCache();
  }
}

async function writePot(pot: ServerPot): Promise<boolean> {
  const normalized = normalizePot(pot);
  try {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await ensureRestaurantExistsInSupabase(normalized.restaurantId);

        let { error: potErr } = await supabase.from("pots").upsert({
          id: normalized.id,
          restaurant_id: normalized.restaurantId,
          deadline: normalized.deadline,
          status: normalized.status,
          max_participants: normalized.maxParticipants,
          creator_id: normalized.creatorId,
          manager_id: normalized.managerId,
          order_completed_at: normalized.orderCompletedAt,
          order_completed_by: normalized.orderCompletedBy,
          created_at: normalized.createdAt,
        });

        if (potErr && (potErr.code === "PGRST204" || potErr.message?.includes("order_completed"))) {
          if (!normalized.orderCompletedAt) {
            const legacyFallback = await supabase.from("pots").upsert({
              id: normalized.id,
              restaurant_id: normalized.restaurantId,
              deadline: normalized.deadline,
              status: normalized.status,
              max_participants: normalized.maxParticipants,
              creator_id: normalized.creatorId,
              manager_id: normalized.managerId,
              created_at: normalized.createdAt,
            });
            potErr = legacyFallback.error;
          }
        }

        if (potErr && (potErr.code === "PGRST204" || potErr.message?.includes("creator_id"))) {
          const basicFallback = await supabase.from("pots").upsert({
            id: normalized.id,
            restaurant_id: normalized.restaurantId,
            deadline: normalized.deadline,
            status: normalized.status,
            max_participants: normalized.maxParticipants,
            created_at: normalized.createdAt,
          });
          potErr = basicFallback.error;
        }

        if (!potErr) {
          if (normalized.participants.length === 0) {
            const { error: deleteErr } = await supabase
              .from("pot_participants")
              .delete()
              .eq("pot_id", normalized.id);
            if (deleteErr) {
              console.error("Supabase savePot participants delete error:", deleteErr);
            } else {
              return true;
            }
          } else {
            const participantRows = normalized.participants.map((p) => ({
              pot_id: normalized.id,
              user_id: p.id,
              user_name: p.name,
              user_initial: p.initial,
              is_paid: p.isPaid ?? false,
              order_memo: p.orderMemo ?? null,
              joined_at: new Date(p.joinedAt).toISOString(),
            }));
            let { error: partErr } = await supabase
              .from("pot_participants")
              .upsert(participantRows, { onConflict: "pot_id,user_id" });

            if (partErr && (partErr.code === "PGRST204" || partErr.message?.includes("order_memo") || partErr.message?.includes("is_paid"))) {
              const fallbackRows = normalized.participants.map((p) => ({
                pot_id: normalized.id,
                user_id: p.id,
                user_name: p.name,
                user_initial: p.initial,
                is_paid: p.isPaid ?? false,
                joined_at: new Date(p.joinedAt).toISOString(),
              }));
              const fallbackRes = await supabase
                .from("pot_participants")
                .upsert(fallbackRows, { onConflict: "pot_id,user_id" });
              partErr = fallbackRes.error;

              if (partErr && (partErr.code === "PGRST204" || partErr.message?.includes("is_paid"))) {
                const fallbackRows2 = normalized.participants.map((p) => ({
                  pot_id: normalized.id,
                  user_id: p.id,
                  user_name: p.name,
                  user_initial: p.initial,
                  joined_at: new Date(p.joinedAt).toISOString(),
                }));
                const fallbackRes2 = await supabase
                  .from("pot_participants")
                  .upsert(fallbackRows2, { onConflict: "pot_id,user_id" });
                partErr = fallbackRes2.error;
              }
            }

            if (!partErr) {
              // 이번 팟에 포함되지 않은 기존 참여자(퇴장/취소)만 선별 삭제
              const currentParticipantIds = normalized.participants.map((p) => `"${p.id}"`).join(",");
              const { error: cleanupErr } = await supabase
                .from("pot_participants")
                .delete()
                .eq("pot_id", normalized.id)
                .not("user_id", "in", `(${currentParticipantIds})`);
              if (cleanupErr) {
                console.error("Supabase savePot stale participants delete error:", cleanupErr);
              }
              return true;
            } else {
              console.error("Supabase savePot participants upsert error:", partErr);
            }
          }
        } else {
          console.error("Supabase savePot error:", potErr);
        }
      } catch (sbErr) {
        console.error("Supabase savePot exception:", sbErr);
      }

      // Supabase가 정본 저장소인데 저장에 실패했다면 성공으로 위장하지 않습니다.
      // 여기서 메모리에 담고 true를 돌려주면, 호출한 API는 200을 응답하고 화면에는
      // "참여 중"으로 보이지만 다음 요청이 다른 서버리스 인스턴스로 가는 순간
      // 그 상태가 사라집니다. 사용자가 실패를 알 수 있도록 false를 반환합니다.
      return false;
    }

    memoryPots.set(normalized.id, normalized);
    memoryPotIndex.add(normalized.id);

    const client = getRedis();
    if (!client) return true;
    await client.set(potKey(normalized.id), JSON.stringify(normalized));
    await client.sadd(POT_INDEX_KEY, normalized.id);
    return true;
  } catch (error) {
    console.error("savePot exception:", error);
    return false;
  }
}

export async function toggleParticipantPaid(potId: string, userId: string): Promise<ServerPot | null> {
  const pot = await getPot(potId);
  if (!pot) return null;

  const participant = pot.participants.find((p) => p.id === userId);
  if (!participant) return null;

  participant.isPaid = !participant.isPaid;

  const memoryPot = memoryPots.get(potId);
  if (memoryPot) {
    const memPart = memoryPot.participants.find((p) => p.id === userId);
    if (memPart) memPart.isPaid = participant.isPaid;
  } else {
    memoryPots.set(potId, pot);
  }

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("pot_participants")
      .update({ is_paid: participant.isPaid })
      .eq("pot_id", potId)
      .eq("user_id", userId);
    if (!error) return pot;
  }

  const saved = await savePot(pot);
  if (!saved) return null;
  return pot;
}

export async function updateParticipantMemo(
  potId: string,
  userId: string,
  memo: string,
): Promise<ServerPot | null> {
  const pot = await getPot(potId);
  if (!pot) return null;

  const participant = pot.participants.find((p) => p.id === userId);
  if (!participant) return null;

  participant.orderMemo = memo.trim().slice(0, 100);

  const memoryPot = memoryPots.get(potId);
  if (memoryPot) {
    const memoryPart = memoryPot.participants.find((p) => p.id === userId);
    if (memoryPart) memoryPart.orderMemo = participant.orderMemo;
  } else {
    memoryPots.set(potId, pot);
  }

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("pot_participants")
      .update({ order_memo: participant.orderMemo })
      .eq("pot_id", potId)
      .eq("user_id", userId);
    if (!error) return pot;
  }

  const saved = await savePot(pot);
  if (!saved) return null;
  return pot;
}

export async function pinPotMessage(
  potId: string,
  messageId: string | null,
): Promise<ServerPot | null> {
  const pot = await getPot(potId);
  if (!pot) return null;

  pot.pinnedMessageId = messageId;
  const saved = await savePot(pot);
  if (!saved) return null;
  return pot;
}

export async function deletePot(id: string): Promise<boolean> {
  try {
    memoryPots.delete(id);
    memoryPotIndex.delete(id);
    memoryMessages.delete(id);
    memoryMessageReads.delete(id);

    const supabase = getSupabase();
    if (supabase) {
      // 외래 키 제약 조건 및 RLS에 안전하도록 자식 테이블을 먼저 명시적으로 삭제합니다.
      try {
        await supabase.from("messages").delete().eq("pot_id", id);
        await supabase.from("message_reads").delete().eq("pot_id", id);
        await supabase.from("pot_participants").delete().eq("pot_id", id);
        const { error } = await supabase.from("pots").delete().eq("id", id);
        if (error) {
          console.error("Supabase deletePot error:", error);
        }
      } catch (sbErr) {
        console.error("Supabase deletePot exception:", sbErr);
      }
    }

    const client = getRedis();
    if (client) {
      await client.del(potKey(id));
      await client.del(potMessagesKey(id));
      await client.srem(POT_INDEX_KEY, id);
    }
    return true;
  } catch (error) {
    console.error("deletePot exception:", error);
    return false;
  } finally {
    // savePot과 같은 이유로 삭제가 끝난 뒤에 비웁니다.
    invalidatePotsCache();
  }
}

export async function updatePotCategory(
  potId: string,
  category: "lunch" | "cafe" | "other",
): Promise<ServerPot | null> {
  const pot = await getPot(potId);
  if (!pot) return null;

  pot.category = category;
  const memoryPot = memoryPots.get(potId);
  if (memoryPot) {
    memoryPot.category = category;
  }
  const saved = await savePot(pot);
  if (!saved) return null;
  return pot;
}

export async function getPot(id: string): Promise<ServerPot | null> {
  const memoryPot = memoryPots.get(id);
  const memoryPartMap = new Map(
    memoryPot?.participants.map((p) => [p.id, { isPaid: p.isPaid, orderMemo: p.orderMemo }]),
  );

  const supabase = getSupabase();
  if (supabase) {
    const { data: potRow, error } = await supabase
      .from("pots")
      .select("*, pot_participants(*)")
      .eq("id", id)
      .maybeSingle();

    if (!error && potRow) {
      type SupabaseParticipant = {
        user_id: string;
        user_name: string;
        user_initial: string;
        bank_account: string | null;
        joined_at: string;
        is_paid?: boolean;
        order_memo?: string | null;
      };

      return normalizePot({
        id: potRow.id,
        restaurantId: potRow.restaurant_id,
        deadline: potRow.deadline,
        status: potRow.status as ServerPot["status"],
        category: (potRow.category as ServerPot["category"]) ?? memoryPot?.category,
        maxParticipants: potRow.max_participants,
        createdAt: potRow.created_at,
        creatorId: potRow.creator_id ?? undefined,
        managerId: potRow.manager_id ?? undefined,
        orderCompletedAt: potRow.order_completed_at ?? null,
        orderCompletedBy: potRow.order_completed_by ?? null,
        participants: ((potRow.pot_participants as SupabaseParticipant[]) ?? []).map((p) => {
          const mem = memoryPartMap.get(p.user_id);
          return {
            id: p.user_id,
            name: p.user_name,
            initial: p.user_initial,
            email: p.user_id,
            isPaid: typeof p.is_paid === "boolean" ? p.is_paid : Boolean(mem?.isPaid),
            orderMemo: (p.order_memo?.trim() || mem?.orderMemo || undefined),
            joinedAt: new Date(p.joined_at).getTime(),
          };
        }),
      });
    }
  }

  const client = getRedis();
  if (!client) {
    const pot = memoryPots.get(id);
    return pot ? clonePot(pot) : null;
  }
  const pot = await client.get<StoredPot>(potKey(id));
  return pot ? normalizePot(pot) : null;
}

let cachedPots: { data: ServerPot[]; cachedAt: number } | null = null;
const POTS_CACHE_TTL_MS = 3_000;

export function invalidatePotsCache(): void {
  cachedPots = null;
}

/** 마감/정원 도달로 상태가 바뀐 팟은 목록 조회 시점에 계산해서 반영(저장)합니다. */
export async function listPots(): Promise<ServerPot[]> {
  const now = new Date();
  if (cachedPots && now.getTime() - cachedPots.cachedAt < POTS_CACHE_TTL_MS) {
    return cachedPots.data;
  }

  const supabase = getSupabase();

  let pots: ServerPot[];

  if (supabase) {
    const { data: rows, error } = await supabase
      .from("pots")
      .select("*, pot_participants(*)")
      .order("created_at", { ascending: false });

    if (!error && rows) {
      type SupabaseParticipant = {
        user_id: string;
        user_name: string;
        user_initial: string;
        bank_account: string | null;
        joined_at: string;
        is_paid?: boolean;
        order_memo?: string | null;
      };

      pots = rows.map((potRow) => {
        const memPot = memoryPots.get(potRow.id);
        const memPartMap = new Map(
          memPot?.participants.map((p) => [p.id, { isPaid: p.isPaid, orderMemo: p.orderMemo }]),
        );

        return normalizePot({
          id: potRow.id,
          restaurantId: potRow.restaurant_id,
          deadline: potRow.deadline,
          status: potRow.status as ServerPot["status"],
          category: (potRow.category as ServerPot["category"]) ?? memPot?.category,
          maxParticipants: potRow.max_participants,
          createdAt: potRow.created_at,
          creatorId: potRow.creator_id ?? undefined,
          managerId: potRow.manager_id ?? undefined,
          orderCompletedAt: potRow.order_completed_at ?? null,
          orderCompletedBy: potRow.order_completed_by ?? null,
          participants: ((potRow.pot_participants as SupabaseParticipant[]) ?? []).map((p) => {
            const mem = memPartMap.get(p.user_id);
            return {
              id: p.user_id,
              name: p.user_name,
              initial: p.user_initial,
              email: p.user_id,
              isPaid: typeof p.is_paid === "boolean" ? p.is_paid : Boolean(mem?.isPaid),
              orderMemo: (p.order_memo?.trim() || mem?.orderMemo || undefined),
              joinedAt: new Date(p.joined_at).getTime(),
            };
          }),
        });
      });
    } else {
      console.error("Supabase listPots error:", error);
      const client = getRedis();
      if (!client) {
        pots = [...memoryPotIndex]
          .map((id) => memoryPots.get(id))
          .filter((pot): pot is ServerPot => Boolean(pot))
          .map(clonePot);
      } else {
        const ids = await client.smembers(POT_INDEX_KEY).catch(() => []);
        if (ids.length === 0) {
          pots = [...memoryPotIndex]
            .map((id) => memoryPots.get(id))
            .filter((pot): pot is ServerPot => Boolean(pot))
            .map(clonePot);
        } else {
          const items = await client.mget<(StoredPot | null)[]>(...ids.map(potKey)).catch(() => []);
          pots = (items.filter(Boolean) as StoredPot[]).map(normalizePot);
        }
      }
    }
  } else {
    const client = getRedis();
    if (!client) {
      pots = [...memoryPotIndex]
        .map((id) => memoryPots.get(id))
        .filter((pot): pot is ServerPot => Boolean(pot))
        .map(clonePot);
    } else {
      const ids = await client.smembers(POT_INDEX_KEY).catch(() => []);
      if (ids.length === 0) {
        pots = [...memoryPotIndex]
          .map((id) => memoryPots.get(id))
          .filter((pot): pot is ServerPot => Boolean(pot))
          .map(clonePot);
      } else {
        const items = await client.mget<(StoredPot | null)[]>(...ids.map(potKey)).catch(() => []);
        pots = (items.filter(Boolean) as StoredPot[]).map(normalizePot);
      }
    }
  }

  const resolved = await Promise.all(
    pots.map(async (pot) => {
      const nextStatus = deriveStatus(pot, now);
      if (nextStatus !== pot.status) {
        // 방어 로직: 마감 시간 도달(timeUp) 또는 정원 도달(capReached)로 인한 자연스러운 상태 변화일 때만 DB에 저장합니다.
        // 마감 시간 전인데 순간적인 읽기 타이밍 이슈 등으로 참여자가 0명으로 잘못 읽힌 경우 failed로 자동 저장해 팟을 날리는 것을 방지합니다.
        const timeUp = now.getTime() >= new Date(pot.deadline).getTime();
        const capReached =
          pot.maxParticipants !== null && pot.participants.length >= pot.maxParticipants;

        if (timeUp || capReached || nextStatus === "active") {
          const changed = { ...pot, status: nextStatus };
          await savePot(changed);
          await logEvent(nextStatus === "closed" ? "pot_closed" : "pot_failed", changed);
          return changed;
        }
      }
      return pot;
    }),
  );

  const finalPots = resolved.filter((pot) => pot.status !== "failed" && pot.participants.length > 0);
  cachedPots = { data: finalPots, cachedAt: now.getTime() };
  return finalPots;
}

export async function saveCustomRestaurant(restaurant: Restaurant): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from("restaurants").upsert({
        id: restaurant.id,
        name: restaurant.name,
        emoji: restaurant.emoji,
        category: restaurant.category,
        sub_category: restaurant.subCategory ?? null,
        min_order: restaurant.minOrder,
        delivery_time: restaurant.deliveryTime,
        menus: restaurant.menus,
        address: restaurant.address ?? null,
        phone: restaurant.phone ?? null,
        business_hours: restaurant.businessHours ?? null,
        closed_days: restaurant.closedDays ?? null,
        rating: restaurant.rating ?? 5.0,
        is_custom: true,
        is_one_time: restaurant.isOneTime ?? false,
      });
      if (!error) {
        cachedCustomRestaurants = null;
        return true;
      }
      console.error("Supabase saveCustomRestaurant error:", error);
      return false;
    }

    const client = getRedis();
    if (!client) {
      memoryCustomRestaurants.set(restaurant.id, restaurant);
      memoryCustomRestaurantIndex.add(restaurant.id);
      return true;
    }
    await client.set(customRestaurantKey(restaurant.id), restaurant);
    await client.sadd(CUSTOM_RESTAURANT_INDEX_KEY, restaurant.id);
    return true;
  } catch (error) {
    console.error("직접 추가 매장 저장 실패", error);
    return false;
  }
}

let cachedCustomRestaurants: { data: Restaurant[]; cachedAt: number } | null = null;
const CUSTOM_RESTAURANTS_TTL_MS = 60_000;

export async function listCustomRestaurants(): Promise<Restaurant[]> {
  const now = Date.now();
  if (cachedCustomRestaurants && now - cachedCustomRestaurants.cachedAt < CUSTOM_RESTAURANTS_TTL_MS) {
    return cachedCustomRestaurants.data;
  }

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_custom", true);

      if (error || !data) return [];
      const result = data.map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        category: r.category as "lunch" | "cafe",
        subCategory: r.sub_category ?? undefined,
        minOrder: r.min_order,
        deliveryTime: r.delivery_time,
        menus: r.menus ?? [],
        address: r.address ?? undefined,
        phone: r.phone ?? undefined,
        businessHours: r.business_hours ?? undefined,
        closedDays: r.closed_days ?? undefined,
        rating: r.rating ? Number(r.rating) : undefined,
        isCustom: true,
        isOneTime: r.is_one_time ?? false,
      }));
      cachedCustomRestaurants = { data: result, cachedAt: now };
      return result;
    }
  } catch (err) {
    console.error("listCustomRestaurants error:", err);
  }

  const client = getRedis();
  if (!client) {
    return [...memoryCustomRestaurantIndex]
      .map((id) => memoryCustomRestaurants.get(id))
      .filter((r): r is Restaurant => Boolean(r));
  }
  const ids = await client.smembers(CUSTOM_RESTAURANT_INDEX_KEY);
  if (ids.length === 0) return [];
  const items = await client.mget<Restaurant[]>(...ids.map(customRestaurantKey));
  return items.filter((r): r is Restaurant => Boolean(r));
}

export async function getAnyRestaurant(id: string): Promise<Restaurant | undefined> {
  const seeded = RESTAURANTS.find((r) => r.id === id);
  if (seeded) return seeded;

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
      if (data && !error) {
        return {
          id: data.id,
          name: data.name,
          emoji: data.emoji,
          category: data.category as "lunch" | "cafe",
          subCategory: data.sub_category ?? undefined,
          minOrder: data.min_order,
          deliveryTime: data.delivery_time,
          menus: data.menus ?? [],
          address: data.address ?? undefined,
          phone: data.phone ?? undefined,
          businessHours: data.business_hours ?? undefined,
          closedDays: data.closed_days ?? undefined,
          rating: data.rating ? Number(data.rating) : undefined,
          isCustom: data.is_custom,
        };
      }
    }
  } catch (err) {
    console.error("getAnyRestaurant exception:", err);
  }

  const client = getRedis();
  if (!client) return memoryCustomRestaurants.get(id);
  return (await client.get<Restaurant>(customRestaurantKey(id))) ?? undefined;
}

const MAX_MESSAGES_PER_POT = 200;

export async function addMessage(message: ChatMessage): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (supabase) {
      let { error } = await supabase.from("messages").insert({
        pot_id: message.potId,
        author_id: message.authorId,
        author_name: message.authorName,
        text: message.text,
        kind: message.kind ?? "text",
        created_at: message.createdAt,
      });

      // 만약 Supabase DB에 신규 kind 제약조건이 아직 반영되지 않았다면 text 마커로 fallback 저장
      if (error && error.code === "23514") {
        const fallbackText = message.kind === "order_link"
          ? `[ORDER_LINK] ${message.text}`
          : message.kind === "image"
          ? `[IMAGE] ${message.imageUrl || message.text}`
          : message.text;

        const retry = await supabase.from("messages").insert({
          pot_id: message.potId,
          author_id: message.authorId,
          author_name: message.authorName,
          text: fallbackText,
          kind: "text",
          created_at: message.createdAt,
        });
        error = retry.error;
      }

      if (error) {
        console.error("Supabase addMessage error:", error);
        return false;
      }
      cachedPotChatSummaries.clear();
      return true;
    }

    const client = getRedis();
    if (!client) {
      const list = memoryMessages.get(message.potId) ?? [];
      list.push(message);
      memoryMessages.set(message.potId, list.slice(-MAX_MESSAGES_PER_POT));
      return true;
    }
    const key = potMessagesKey(message.potId);
    await client.rpush(key, JSON.stringify(message));
    await client.ltrim(key, -MAX_MESSAGES_PER_POT, -1);
    return true;
  } catch (error) {
    console.error("채팅 메시지 저장 실패", error);
    return false;
  }
}

export async function listMessages(potId: string): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("pot_id", potId)
      .order("created_at", { ascending: true })
      .limit(MAX_MESSAGES_PER_POT);

    if (error || !data) return [];
    return data.map((m) => {
      let kind = m.kind as ChatMessage["kind"];
      let text = m.text;
      let imageUrl: string | undefined;

      // 마커로 저장된 order_link 복원
      if (text.startsWith("[ORDER_LINK] ")) {
        kind = "order_link";
        text = text.slice("[ORDER_LINK] ".length);
      } else if (text.startsWith("[IMAGE] ")) {
        kind = "image";
        imageUrl = text.slice("[IMAGE] ".length);
        text = "📷 사진";
      } else if (kind === "image") {
        imageUrl = text;
      }

      return {
        id: m.id,
        potId: m.pot_id,
        authorId: m.author_id,
        authorName: m.author_name,
        text,
        kind,
        imageUrl,
        createdAt: m.created_at,
      };
    });
  }

  const client = getRedis();
  if (!client) return memoryMessages.get(potId) ?? [];
  const raw = await client.lrange<ChatMessage | string>(potMessagesKey(potId), 0, -1);
  return raw.flatMap((entry) => {
    if (typeof entry !== "string") return [entry];
    try {
      return [JSON.parse(entry) as ChatMessage];
    } catch {
      return [];
    }
  });
}

function toChatPreview(message: ChatMessage): ChatMessagePreview {
  let text = message.text;
  let imageUrl = message.imageUrl;
  if (text.startsWith("[ORDER_LINK] ")) {
    text = text.slice("[ORDER_LINK] ".length);
  } else if (text.startsWith("[IMAGE] ")) {
    imageUrl = text.slice("[IMAGE] ".length);
  }

  const normalizedText = message.kind === "account"
    ? `${message.authorName}님이 계좌를 공유했어요.`
    : message.kind === "order_link" || message.text.startsWith("[ORDER_LINK] ")
    ? `${message.authorName}님이 주문 링크를 공유했어요.`
    : (message.kind === "image" || message.text.startsWith("[IMAGE] "))
      && isChatEmojiPath(imageUrl ?? text)
    ? `${message.authorName}님이 이모티콘을 보냈어요.`
    : message.kind === "image" || message.text.startsWith("[IMAGE] ")
    ? `${message.authorName}님이 사진을 보냈어요.`
    : text.replace(/\s+/g, " ").trim().slice(0, 80);

  return {
    authorName: message.authorName,
    text: normalizedText,
    createdAt: message.createdAt,
  };
}

export type PotChatSummary = {
  latestMessage: ChatMessagePreview | null;
  unreadMessageCount: number;
};

let cachedPotChatSummaries = new Map<string, { data: Map<string, PotChatSummary>; cachedAt: number }>();
const CHAT_SUMMARIES_TTL_MS = 10_000;

/** 내 참여 목록에 필요한 최근 메시지와 읽지 않은 수를 한 번에 계산합니다. */
export async function getPotChatSummaries(
  pots: ServerPot[],
  user: User | null,
  sessionSupabase?: SupabaseClient,
): Promise<Map<string, PotChatSummary>> {
  const summaries = new Map<string, PotChatSummary>();
  if (!user) return summaries;

  const now = Date.now();
  const cached = cachedPotChatSummaries.get(user.id);
  if (cached && now - cached.cachedAt < CHAT_SUMMARIES_TTL_MS) {
    return cached.data;
  }

  const participatingPots = pots.filter((pot) =>
    pot.participants.some((participant) => participant.id === user.id),
  );
  if (participatingPots.length === 0) {
    cachedPotChatSummaries.set(user.id, { data: summaries, cachedAt: now });
    return summaries;
  }

  const potIds = participatingPots.map((pot) => pot.id);
  const joinedAtByPot = new Map(
    participatingPots.map((pot) => [
      pot.id,
      pot.participants.find((participant) => participant.id === user.id)?.joinedAt ?? 0,
    ]),
  );

  const supabase = sessionSupabase ?? getSupabase();
  if (supabase) {
    const [{ data: messageRows, error: messageError }, { data: readRows, error: readError }] =
      await Promise.all([
        supabase
          .from("messages")
          .select("pot_id, author_id, author_name, text, kind, created_at")
          .in("pot_id", potIds)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("message_reads")
          .select("pot_id, last_read_at")
          .eq("user_id", user.id)
          .in("pot_id", potIds),
      ]);

    if (messageError || !messageRows) return summaries;

    const readAtByPot = new Map<string, number>();
    if (!readError && readRows) {
      for (const row of readRows) {
        readAtByPot.set(row.pot_id, new Date(row.last_read_at).getTime());
      }
    }

    for (const pot of participatingPots) {
      const rows = messageRows.filter((message) => message.pot_id === pot.id);
      const latestRow = rows[0];
      const latestMessage = latestRow
        ? toChatPreview({
            id: "preview",
            potId: pot.id,
            authorId: latestRow.author_id,
            authorName: latestRow.author_name,
            text: latestRow.text,
            kind: latestRow.kind as ChatMessage["kind"],
            createdAt: latestRow.created_at,
          })
        : null;
      const cursor = Math.max(readAtByPot.get(pot.id) ?? 0, joinedAtByPot.get(pot.id) ?? 0);
      const unreadMessageCount = readError
        ? 0
        : rows.filter((message) =>
            message.author_id !== user.id && new Date(message.created_at).getTime() > cursor,
          ).length;
      summaries.set(pot.id, { latestMessage, unreadMessageCount });
    }
    cachedPotChatSummaries.set(user.id, { data: summaries, cachedAt: now });
    return summaries;
  }

  const client = getRedis();
  for (const pot of participatingPots) {
    const messages = await listMessages(pot.id);
    const latestMessage = messages.length > 0 ? toChatPreview(messages[messages.length - 1]) : null;
    const storedReadAt = client
      ? await client.get<string>(potMessageReadKey(pot.id, user.id))
      : memoryMessageReads.get(potMessageReadKey(pot.id, user.id));
    const cursor = Math.max(
      storedReadAt ? new Date(storedReadAt).getTime() : 0,
      joinedAtByPot.get(pot.id) ?? 0,
    );
    const unreadMessageCount = messages.filter((message) =>
      message.authorId !== user.id && new Date(message.createdAt).getTime() > cursor,
    ).length;
    summaries.set(pot.id, { latestMessage, unreadMessageCount });
  }
  cachedPotChatSummaries.set(user.id, { data: summaries, cachedAt: now });
  return summaries;
}

/** 채팅을 실제로 불러온 시점까지 읽은 것으로 기록합니다. */
export async function markPotMessagesRead(
  potId: string,
  userId: string,
  messages: ChatMessage[],
  sessionSupabase?: SupabaseClient,
): Promise<void> {
  cachedPotChatSummaries.delete(userId);
  const latestMessage = messages[messages.length - 1];
  if (!latestMessage) return;

  const supabase = sessionSupabase ?? getSupabase();
  if (supabase) {
    const { error } = await supabase.from("message_reads").upsert({
      pot_id: potId,
      user_id: userId,
      last_read_at: latestMessage.createdAt,
    });
    if (error && error.code !== "PGRST205") {
      console.error("Supabase markPotMessagesRead error:", error);
    }
    return;
  }

  const client = getRedis();
  const key = potMessageReadKey(potId, userId);
  if (client) {
    await client.set(key, latestMessage.createdAt);
    return;
  }
  memoryMessageReads.set(key, latestMessage.createdAt);
}

let cachedCampusStats: { data: CampusStats; cachedAt: number } | null = null;
const STATS_CACHE_TTL_MS = 60_000;

/** 전체 캠퍼스 식사 트렌드 및 통계 집계 */
export async function getCampusStats(): Promise<CampusStats> {
  const nowMs = Date.now();
  if (cachedCampusStats && nowMs - cachedCampusStats.cachedAt < STATS_CACHE_TTL_MS) {
    return cachedCampusStats.data;
  }

  const pots = await listPots();
  const customList = await listCustomRestaurants();
  const customMap = new Map(customList.map((r) => [r.id, r]));

  let totalParticipants = 0;
  let totalCompletedPots = 0;
  let lunchPotCount = 0;
  let cafePotCount = 0;

  // 1. 시간대별 팟 개설 분포 (0~23시)
  const hourCounts = new Array(24).fill(0);

  // 2. 카테고리별 분포 맵
  const categoryCounts: Record<string, number> = {
    "한식": 0,
    "일식/돈까스": 0,
    "중식": 0,
    "양식/피자/버거": 0,
    "분식/도시락": 0,
    "카페/디저트": 0,
    "기타": 0,
  };

  // 3. 식당별 통계 맵
  const restaurantStatsMap = new Map<string, {
    restaurantId: string;
    name: string;
    category: string;
    potCount: number;
    participantCount: number;
    successCount: number;
  }>();

  let totalMatchingMinutesSum = 0;
  let matchingPotCount = 0;
  let fastestMatchingMinutes = 999;

  for (const pot of pots) {
    const pCount = pot.participants.length;
    totalParticipants += pCount;

    const isSuccess = pot.status === "closed" || Boolean(pot.orderCompletedAt) || pCount >= 2;
    if (pot.status === "closed" || pot.orderCompletedAt) {
      totalCompletedPots++;
    }

    // 식당 정보 확인
    const standardRest = RESTAURANTS.find((r) => r.id === pot.restaurantId);
    const customRest = customMap.get(pot.restaurantId);
    const restName = standardRest?.name || customRest?.name || pot.restaurantId;
    const catInfo = resolveFoodCategory({
      subCategory: standardRest?.subCategory || customRest?.subCategory,
      restaurantName: restName,
      restaurantCategory: standardRest?.category || customRest?.category,
      potCategory: pot.category,
    });

    const isCafe = catInfo.campusCategory === "카페/디저트";

    if (isCafe) {
      cafePotCount++;
    } else {
      lunchPotCount++;
    }

    if (isSuccess) {
      if (pot.createdAt && (pot.orderCompletedAt || pot.deadline)) {
        const start = new Date(pot.createdAt).getTime();
        const end = new Date(pot.orderCompletedAt || pot.deadline).getTime();
        const diffMin = Math.max(1, Math.round((end - start) / (1000 * 60)));
        if (diffMin <= 180) {
          totalMatchingMinutesSum += diffMin;
          matchingPotCount++;
          if (diffMin < fastestMatchingMinutes) {
            fastestMatchingMinutes = diffMin;
          }
        }
      }
    }

    // 시간대 집계 (생성 시각 또는 마감 시각)
    const potDate = new Date(pot.createdAt || pot.deadline);
    const hour = (potDate.getUTCHours() + 9) % 24; // KST 기준
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;

    // 카테고리 매핑
    categoryCounts[catInfo.campusCategory] = (categoryCounts[catInfo.campusCategory] || 0) + 1;

    // 매장 통계 집계
    let displayCategory = standardRest?.subCategory || customRest?.subCategory || catInfo.campusCategory;
    if (displayCategory === "lunch" || displayCategory === "restaurant") displayCategory = "점심 식사";
    else if (displayCategory === "cafe") displayCategory = "카페/디저트";
    else if (displayCategory === "other") displayCategory = "기타";

    const existing = restaurantStatsMap.get(pot.restaurantId) || {
      restaurantId: pot.restaurantId,
      name: restName,
      category: displayCategory,
      potCount: 0,
      participantCount: 0,
      successCount: 0,
    };
    existing.potCount++;
    existing.participantCount += pCount;
    if (isSuccess) existing.successCount++;
    restaurantStatsMap.set(pot.restaurantId, existing);
  }

  // 피크 아워 포맷 (오전 9시 ~ 오후 6시/18시 중심)
  const peakHours: PeakHourStat[] = [];
  for (let h = 9; h <= 18; h++) {
    peakHours.push({
      hour: h,
      label: `${h}시`,
      count: hourCounts[h] || 0,
    });
  }

  // 카테고리 백분율 계산 (순수 음식/디저트 카테고리만 입맛 점유율에 100% 반영)
  const validFoodCategories = Object.entries(categoryCounts).filter(
    ([cat, count]) => count > 0 && cat !== "기타 일반식" && cat !== "기타"
  );
  const totalCatCount = validFoodCategories.reduce((sum, [, count]) => sum + count, 0) || 1;
  const categoryDistribution: CategoryStat[] = validFoodCategories
    .map(([category, count]) => ({
      category,
      label: category,
      count,
      percentage: Math.round((count / totalCatCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 인기 음식점 TOP 5
  const topRestaurants: TopRestaurantStat[] = Array.from(restaurantStatsMap.values())
    .map((item) => ({
      restaurantId: item.restaurantId,
      name: item.name,
      category: item.category,
      potCount: item.potCount,
      participantCount: item.participantCount,
      successRate: item.potCount > 0 ? Math.round((item.successCount / item.potCount) * 100) : 0,
    }))
    .sort((a, b) => b.potCount - a.potCount || b.participantCount - a.participantCount)
    .slice(0, 5);

  // 통계 계산
  const totalSavedDeliveryFee = Math.max(0, totalParticipants - pots.length) * 3000;
  const avgMatchingMinutes = matchingPotCount > 0 ? Math.round((totalMatchingMinutesSum / matchingPotCount) * 10) / 10 : 54.5;
  const resolvedFastestMinutes = fastestMatchingMinutes === 999 ? 25 : fastestMatchingMinutes;
  const avgParticipantsPerPot = pots.length > 0 ? Math.round((totalParticipants / pots.length) * 10) / 10 : 3.6;

  const totalTypePots = lunchPotCount + cafePotCount || 1;
  const lunchRatio = Math.round((lunchPotCount / totalTypePots) * 100);
  const cafeRatio = 100 - lunchRatio;

  const result: CampusStats = {
    totalPots: pots.length,
    totalCompletedPots,
    totalParticipants,
    totalSavedDeliveryFee,
    avgMatchingMinutes,
    fastestMatchingMinutes: resolvedFastestMinutes,
    avgParticipantsPerPot,
    lunchRatio,
    cafeRatio,
    peakHours,
    categoryDistribution,
    topRestaurants,
  };

  cachedCampusStats = { data: result, cachedAt: nowMs };
  return result;
}

/**
 * 음식점 정보 및 매장명을 기반으로 표준 음식 카테고리와 개인 식사 스타일을 추론하는 헬퍼
 */
export function resolveFoodCategory(params: {
  subCategory?: string | null;
  restaurantName?: string | null;
  restaurantCategory?: string | null;
  potCategory?: "lunch" | "cafe" | "other" | null;
}): { campusCategory: string; personalStyle: string } {
  const { subCategory, restaurantName = "", restaurantCategory, potCategory } = params;
  const name = (restaurantName || "").trim().toLowerCase();
  const sub = (subCategory || "").trim().toLowerCase();
  const cat = (restaurantCategory || "").trim().toLowerCase();

  // 1. 카페 / 디저트 우선 판별
  if (
    potCategory === "cafe" ||
    cat === "cafe" ||
    sub.includes("카페") ||
    sub.includes("디저트") ||
    sub.includes("커피") ||
    sub.includes("음료") ||
    name.includes("카페") ||
    name.includes("커피") ||
    name.includes("디저트") ||
    name.includes("베이커리") ||
    name.includes("와플") ||
    name.includes("마카롱") ||
    name.includes("도넛") ||
    name.includes("스타벅스") ||
    name.includes("메가커피") ||
    name.includes("빽다방") ||
    name.includes("컴포즈") ||
    name.includes("이디야") ||
    name.includes("투썸") ||
    name.includes("공차") ||
    name.includes("요거트") ||
    name.includes("빙수") ||
    name.includes("설빙")
  ) {
    return {
      campusCategory: "카페/디저트",
      personalStyle: "디저트/카페 러버 ☕",
    };
  }

  // 2. 샐러드 / 샌드위치 / 포케 우선 판별 (샐러디, 서브웨이 등)
  if (
    sub.includes("샐러드") ||
    sub.includes("샌드위치") ||
    sub.includes("포케") ||
    name.includes("샐러드") ||
    name.includes("샐러디") ||
    name.includes("샌드위치") ||
    name.includes("서브웨이") ||
    name.includes("써브웨이") ||
    name.includes("포케")
  ) {
    return {
      campusCategory: "샐러드/포케",
      personalStyle: "신선한 샐러드·포케파 🥗",
    };
  }

  // 3. 아시안 (쌀국수, 베트남, 태국 등)
  if (
    sub.includes("아시안") ||
    name.includes("쌀국수") ||
    name.includes("베트남") ||
    name.includes("태국") ||
    name.includes("팟타이")
  ) {
    return {
      campusCategory: "아시안",
      personalStyle: "이국적인 아시안 푸드파 🍜",
    };
  }

  // 3. 표준 subCategory 기반 판별
  if (sub.includes("한식") || sub.includes("찜·탕") || sub.includes("고기") || sub.includes("족발·보쌈")) {
    return {
      campusCategory: "한식",
      personalStyle: "든든한 한식파 🍚",
    };
  }
  if (sub.includes("일식") || sub.includes("돈까스·회") || sub.includes("돈까스") || sub.includes("초밥")) {
    return {
      campusCategory: "일식/돈까스",
      personalStyle: "깔끔한 일식파 🍣",
    };
  }
  if (sub.includes("중식")) {
    return {
      campusCategory: "중식",
      personalStyle: "화끈한 중식파 🥟",
    };
  }
  if (sub.includes("양식") || sub.includes("패스트푸드") || sub.includes("피자") || sub.includes("치킨")) {
    return {
      campusCategory: "양식/버거/치킨",
      personalStyle: "양식/버거 매니아 🍔",
    };
  }
  if (sub.includes("분식") || sub.includes("도시락")) {
    return {
      campusCategory: "분식/도시락",
      personalStyle: "분식 러버 떡볶이파 🍢",
    };
  }

  // 3. 직접 등록 매장 등 subCategory가 없을 때 매장명(name) 기반 키워드 추론
  // (1) 한식 키워드
  if (
    name.includes("한식") ||
    name.includes("찌개") ||
    name.includes("국밥") ||
    name.includes("짜글이") ||
    name.includes("삼겹") ||
    name.includes("제육") ||
    name.includes("갈비") ||
    name.includes("불고기") ||
    name.includes("백반") ||
    name.includes("곰탕") ||
    name.includes("설렁탕") ||
    name.includes("순대") ||
    name.includes("감자탕") ||
    name.includes("보쌈") ||
    name.includes("족발") ||
    name.includes("육회") ||
    name.includes("해장국") ||
    name.includes("비빔밥") ||
    name.includes("냉면") ||
    name.includes("솥밥") ||
    name.includes("덮밥") ||
    name.includes("구이") ||
    name.includes("탕") ||
    name.includes("찜")
  ) {
    return {
      campusCategory: "한식",
      personalStyle: "든든한 한식파 🍚",
    };
  }

  // (2) 일식 / 돈까스 키워드
  if (
    name.includes("일식") ||
    name.includes("돈까스") ||
    name.includes("돈가스") ||
    name.includes("카츠") ||
    name.includes("초밥") ||
    name.includes("스시") ||
    name.includes("라멘") ||
    name.includes("우동") ||
    name.includes("소바") ||
    name.includes("텐동") ||
    name.includes("사케동") ||
    name.includes("연어") ||
    name.includes("회") ||
    name.includes("이자카야")
  ) {
    return {
      campusCategory: "일식/돈까스",
      personalStyle: "깔끔한 일식파 🍣",
    };
  }

  // (3) 중식 키워드
  if (
    name.includes("중식") ||
    name.includes("짜장") ||
    name.includes("자장") ||
    name.includes("짬뽕") ||
    name.includes("마라") ||
    name.includes("탕수육") ||
    name.includes("반점") ||
    name.includes("중화") ||
    name.includes("훠궈") ||
    name.includes("양꼬치") ||
    name.includes("딤섬")
  ) {
    return {
      campusCategory: "중식",
      personalStyle: "화끈한 중식파 🥟",
    };
  }

  // (4) 분식 / 도시락 / 간편식 키워드
  if (
    name.includes("분식") ||
    name.includes("떡볶이") ||
    name.includes("김밥") ||
    name.includes("라볶이") ||
    name.includes("튀김") ||
    name.includes("어묵") ||
    name.includes("도시락") ||
    name.includes("한솥") ||
    name.includes("본도시락") ||
    name.includes("엽기떡볶이") ||
    name.includes("신전") ||
    name.includes("배떡") ||
    name.includes("밥버거") ||
    name.includes("봉구스") ||
    name.includes("이삭") ||
    name.includes("토스트")
  ) {
    return {
      campusCategory: "분식/도시락",
      personalStyle: "분식 러버 떡볶이파 🍢",
    };
  }

  // (5) 양식 / 피자 / 버거 / 치킨 키워드
  if (
    name.includes("양식") ||
    name.includes("파스타") ||
    name.includes("피자") ||
    name.includes("버거") ||
    name.includes("치킨") ||
    name.includes("통닭") ||
    name.includes("스테이크") ||
    name.includes("리조또") ||
    name.includes("맥도날드") ||
    name.includes("버거킹") ||
    name.includes("롯데리아") ||
    name.includes("맘스터치") ||
    name.includes("kfc") ||
    name.includes("프랭크버거") ||
    name.includes("비비큐") ||
    name.includes("bbq") ||
    name.includes("교촌") ||
    name.includes("bhc") ||
    name.includes("굽네")
  ) {
    return {
      campusCategory: "양식/버거/치킨",
      personalStyle: "양식/버거 매니아 🍔",
    };
  }

  // (6) 샐러드 / 샌드위치 / 포케 키워드
  if (
    name.includes("샐러드") ||
    name.includes("샌드위치") ||
    name.includes("포케") ||
    name.includes("서브웨이") ||
    name.includes("샐러디") ||
    name.includes("써브웨이")
  ) {
    return {
      campusCategory: "샐러드/포케",
      personalStyle: "신선한 샐러드·포케파 🥗",
    };
  }

  // (7) 아시안 키워드
  if (
    name.includes("쌀국수") ||
    name.includes("베트남") ||
    name.includes("태국") ||
    name.includes("팟타이") ||
    name.includes("분짜")
  ) {
    return {
      campusCategory: "아시안",
      personalStyle: "이국적인 아시안 푸드파 🍜",
    };
  }

  // 4. 어떤 키워드에도 걸리지 않은 직접 등록 매장
  return {
    campusCategory: "기타 일반식",
    personalStyle: "다양한 맛집 탐험가 🍴",
  };
}

/** 특정 사용자의 개인화 식사 리포트 집계 */
export async function getMyStatsReport(userId: string): Promise<MyStatsReport> {
  const pots = await listPots();
  const customList = await listCustomRestaurants();
  const customMap = new Map(customList.map((r) => [r.id, r]));

  const myPots = pots.filter((p) => p.participants.some((part) => part.id === userId));
  const myTotalJoinedPots = myPots.length;
  let totalCompletedPots = 0;

  // 1. 함께 식사한 밥친구 빈도 맵
  const mateFrequency = new Map<string, { name: string; initial: string; count: number }>();

  // 2. 나의 주문 식사 스타일 선호도 맵
  const myStyleCounts: Record<string, number> = {};

  for (const pot of myPots) {
    if (pot.status === "closed" || pot.orderCompletedAt) {
      totalCompletedPots++;
    }

    // 밥친구 집계
    for (const part of pot.participants) {
      if (part.id === userId) continue;
      const mate = mateFrequency.get(part.name) || {
        name: part.name,
        initial: part.initial,
        count: 0,
      };
      mate.count++;
      mateFrequency.set(part.name, mate);
    }

    // 식사 스타일 집계
    const standardRest = RESTAURANTS.find((r) => r.id === pot.restaurantId);
    const customRest = customMap.get(pot.restaurantId);
    const restName = standardRest?.name || customRest?.name || pot.restaurantId;
    const catInfo = resolveFoodCategory({
      subCategory: standardRest?.subCategory || customRest?.subCategory,
      restaurantName: restName,
      restaurantCategory: standardRest?.category || customRest?.category,
      potCategory: pot.category,
    });

    myStyleCounts[catInfo.personalStyle] = (myStyleCounts[catInfo.personalStyle] || 0) + 1;
  }

  // 밥친구 TOP 3
  const topMates: DiningMateStat[] = Array.from(mateFrequency.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 최애 카테고리 1위
  let favoriteCategory = "다양한 맛집 탐험가 🍴";
  let favoriteCategoryPercentage = 100;

  const sortedStyles = Object.entries(myStyleCounts).sort((a, b) => b[1] - a[1]);
  if (sortedStyles.length > 0 && myTotalJoinedPots > 0) {
    favoriteCategory = sortedStyles[0][0];
    favoriteCategoryPercentage = Math.round((sortedStyles[0][1] / myTotalJoinedPots) * 100);
  }

  // 내가 아낀 배달비 (참여 횟수 * 3,000원)
  const savedDeliveryFee = myTotalJoinedPots * 3000;

  return {
    totalJoinedPots: myTotalJoinedPots,
    totalCompletedPots,
    savedDeliveryFee,
    topMates,
    favoriteCategory,
    favoriteCategoryPercentage,
  };
}
