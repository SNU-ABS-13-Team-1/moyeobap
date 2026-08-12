import { randomUUID } from "node:crypto";
import { getRedis } from "./kv";
import { getSupabase } from "./supabase";
import { RESTAURANTS } from "../data/restaurants";
import type {
  ChatMessage,
  PotEvent,
  PotEventType,
  Restaurant,
  SerializedPot,
  User,
} from "../types/moyeobap";

export type ServerPot = {
  id: string;
  restaurantId: string;
  deadline: string; // ISO timestamp
  participants: (User & { joinedAt: number })[];
  status: "active" | "closed" | "failed";
  maxParticipants: number | null;
  createdAt: string;
  creatorId: string;
  managerId: string | null;
};

type StoredPot = Omit<ServerPot, "creatorId" | "managerId"> &
  Partial<Pick<ServerPot, "creatorId" | "managerId">>;

const POT_INDEX_KEY = "moyeobap:pots:index";
const EVENT_LOG_KEY = "moyeobap:events";
const potKey = (id: string) => `moyeobap:pot:${id}`;
const potMessagesKey = (id: string) => `moyeobap:pot:${id}:messages`;
const CUSTOM_RESTAURANT_INDEX_KEY = "moyeobap:restaurants:custom:index";
const customRestaurantKey = (id: string) => `moyeobap:restaurant:custom:${id}`;

// Local-dev fallback when neither Supabase nor Redis is configured.
const memoryPots = new Map<string, ServerPot>();
const memoryPotIndex = new Set<string>();
const memoryMessages = new Map<string, ChatMessage[]>();
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
    participants,
    creatorId: pot.creatorId ?? firstParticipantId ?? "",
    managerId: pot.managerId ?? firstParticipantId,
  };
}

function clonePot(pot: ServerPot): ServerPot {
  return { ...pot, participants: pot.participants.map((participant) => ({ ...participant })) };
}

/** API 응답에서 이메일 id와 계좌번호를 제거하고, 참여자에게만 신원을 공개합니다. */
export function toPotView(pot: ServerPot, currentUser: User | null): SerializedPot {
  const isParticipating = Boolean(
    currentUser && pot.participants.some((participant) => participant.id === currentUser.id),
  );

  return {
    id: pot.id,
    restaurantId: pot.restaurantId,
    deadline: pot.deadline,
    participantCount: pot.participants.length,
    participants: isParticipating
      ? pot.participants.map((participant) => ({
          name: participant.name,
          initial: participant.initial,
          isManager: participant.id === pot.managerId,
        }))
      : null,
    isParticipating,
    isManaging: Boolean(currentUser && currentUser.id === pot.managerId),
    status: pot.status,
    maxParticipants: pot.maxParticipants,
  };
}

/** 마감 시간이 지났거나 정원이 찼는데 아직 반영 안 된 상태를 지금 시각 기준으로 계산합니다. */
export function deriveStatus(pot: ServerPot, now: Date = new Date()): ServerPot["status"] {
  if (pot.status !== "active") return pot.status;

  const timeUp = now.getTime() >= new Date(pot.deadline).getTime();
  const capReached =
    pot.maxParticipants !== null && pot.participants.length >= pot.maxParticipants;

  if (!timeUp && !capReached) return "active";
  return pot.participants.length >= 2 ? "closed" : "failed";
}

async function ensureRestaurantExistsInSupabase(restaurantId: string): Promise<void> {
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
}

const MAX_EVENTS = 2000;

/**
 * 행동/Event 기록을 남깁니다. 기록에 실패해도 사용자의 동작은 성공한 것으로
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

export async function savePot(pot: ServerPot): Promise<void> {
  const normalized = normalizePot(pot);

  const supabase = getSupabase();
  if (supabase) {
    // Foreign key 무결성 보장을 위해 음식점 레코드가 있는지 먼저 확인 후 자동으로 넣어줍니다.
    await ensureRestaurantExistsInSupabase(normalized.restaurantId);

    // 1. Upsert pot row (DB에 creator_id/manager_id 칼럼이 없어도 호환되도록 안전 처리)
    let { error: potErr } = await supabase.from("pots").upsert({
      id: normalized.id,
      restaurant_id: normalized.restaurantId,
      deadline: normalized.deadline,
      status: normalized.status,
      max_participants: normalized.maxParticipants,
      creator_id: normalized.creatorId,
      manager_id: normalized.managerId,
      created_at: normalized.createdAt,
    });

    if (potErr && (potErr.code === "PGRST204" || potErr.message?.includes("creator_id"))) {
      // creator_id/manager_id 칼럼이 아직 추가되지 않은 경우 기본 칼럼만으로 재시도
      const fallback = await supabase.from("pots").upsert({
        id: normalized.id,
        restaurant_id: normalized.restaurantId,
        deadline: normalized.deadline,
        status: normalized.status,
        max_participants: normalized.maxParticipants,
        created_at: normalized.createdAt,
      });
      potErr = fallback.error;
    }

    if (potErr) {
      console.error("Supabase savePot error:", potErr);
    }

    // 2. Refresh participants
    await supabase.from("pot_participants").delete().eq("pot_id", normalized.id);
    if (normalized.participants.length > 0) {
      const participantRows = normalized.participants.map((p) => ({
        pot_id: normalized.id,
        user_id: p.id,
        user_name: p.name,
        user_initial: p.initial,
        bank_account: p.accountNumber ? (p.bankName ? `${p.bankName} ${p.accountNumber}` : p.accountNumber) : null,
        joined_at: new Date(p.joinedAt).toISOString(),
      }));
      const { error: partErr } = await supabase.from("pot_participants").insert(participantRows);
      if (partErr) {
        console.error("Supabase savePot participants error:", partErr);
      }
    }
    return;
  }

  const client = getRedis();
  const snapshot = clonePot(normalized);
  if (!client) {
    memoryPots.set(snapshot.id, snapshot);
    memoryPotIndex.add(snapshot.id);
    return;
  }
  await client.set(potKey(snapshot.id), snapshot);
  await client.sadd(POT_INDEX_KEY, snapshot.id);
}

export async function getPot(id: string): Promise<ServerPot | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data: potRow, error } = await supabase
      .from("pots")
      .select("*, pot_participants(*)")
      .eq("id", id)
      .maybeSingle();

    if (error || !potRow) return null;

    type SupabaseParticipant = {
      user_id: string;
      user_name: string;
      user_initial: string;
      bank_account: string | null;
      joined_at: string;
    };

    const rawParticipants = ((potRow.pot_participants as SupabaseParticipant[]) ?? []).map((p) => ({
      id: p.user_id,
      name: p.user_name,
      initial: p.user_initial,
      email: p.user_id,
      accountNumber: p.bank_account ?? undefined,
      joinedAt: new Date(p.joined_at).getTime(),
    }));

    return normalizePot({
      id: potRow.id,
      restaurantId: potRow.restaurant_id,
      deadline: potRow.deadline,
      status: potRow.status as ServerPot["status"],
      maxParticipants: potRow.max_participants,
      createdAt: potRow.created_at,
      creatorId: potRow.creator_id ?? undefined,
      managerId: potRow.manager_id ?? undefined,
      participants: rawParticipants,
    });
  }

  const client = getRedis();
  if (!client) {
    const pot = memoryPots.get(id);
    return pot ? clonePot(pot) : null;
  }
  const pot = await client.get<StoredPot>(potKey(id));
  return pot ? normalizePot(pot) : null;
}

/** 마감/정원 도달로 상태가 바뀐 팟은 목록 조회 시점에 계산해서 반영(저장)합니다. */
export async function listPots(): Promise<ServerPot[]> {
  const supabase = getSupabase();
  const now = new Date();

  let pots: ServerPot[];

  if (supabase) {
    const { data: rows, error } = await supabase
      .from("pots")
      .select("*, pot_participants(*)")
      .order("created_at", { ascending: false });

    if (error || !rows) {
      console.error("Supabase listPots error:", error);
      return [];
    }

    type SupabaseParticipant = {
      user_id: string;
      user_name: string;
      user_initial: string;
      bank_account: string | null;
      joined_at: string;
    };

    pots = rows.map((potRow) =>
      normalizePot({
        id: potRow.id,
        restaurantId: potRow.restaurant_id,
        deadline: potRow.deadline,
        status: potRow.status as ServerPot["status"],
        maxParticipants: potRow.max_participants,
        createdAt: potRow.created_at,
        creatorId: potRow.creator_id ?? undefined,
        managerId: potRow.manager_id ?? undefined,
        participants: ((potRow.pot_participants as SupabaseParticipant[]) ?? []).map((p) => ({
          id: p.user_id,
          name: p.user_name,
          initial: p.user_initial,
          email: p.user_id,
          accountNumber: p.bank_account ?? undefined,
          joinedAt: new Date(p.joined_at).getTime(),
        })),
      }),
    );
  } else {
    const client = getRedis();
    if (!client) {
      pots = [...memoryPotIndex]
        .map((id) => memoryPots.get(id))
        .filter((pot): pot is ServerPot => Boolean(pot))
        .map(clonePot);
    } else {
      const ids = await client.smembers(POT_INDEX_KEY);
      if (ids.length === 0) return [];
      const items = await client.mget<(StoredPot | null)[]>(...ids.map(potKey));
      pots = items.filter((pot): pot is StoredPot => Boolean(pot)).map(normalizePot);
    }
  }

  return Promise.all(
    pots.map(async (pot) => {
      const nextStatus = deriveStatus(pot, now);
      if (nextStatus !== pot.status) {
        const changed = { ...pot, status: nextStatus };
        await savePot(changed);
        await logEvent(nextStatus === "closed" ? "pot_closed" : "pot_failed", changed);
        return changed;
      }
      return pot;
    }),
  );
}

export async function saveCustomRestaurant(restaurant: Restaurant): Promise<void> {
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
    });
    if (error) console.error("Supabase saveCustomRestaurant error:", error);
    return;
  }

  const client = getRedis();
  if (!client) {
    memoryCustomRestaurants.set(restaurant.id, restaurant);
    memoryCustomRestaurantIndex.add(restaurant.id);
    return;
  }
  await client.set(customRestaurantKey(restaurant.id), restaurant);
  await client.sadd(CUSTOM_RESTAURANT_INDEX_KEY, restaurant.id);
}

export async function listCustomRestaurants(): Promise<Restaurant[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("is_custom", true);

    if (error || !data) return [];
    return data.map((r) => ({
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
    }));
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

  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
    if (data) {
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

  const client = getRedis();
  if (!client) return memoryCustomRestaurants.get(id);
  return (await client.get<Restaurant>(customRestaurantKey(id))) ?? undefined;
}

const MAX_MESSAGES_PER_POT = 200;

export async function addMessage(message: ChatMessage): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("messages").insert({
      pot_id: message.potId,
      author_id: message.authorId,
      author_name: message.authorName,
      text: message.text,
      kind: message.kind ?? "text",
      created_at: message.createdAt,
    });
    if (error) console.error("Supabase addMessage error:", error);
    return;
  }

  const client = getRedis();
  if (!client) {
    const list = memoryMessages.get(message.potId) ?? [];
    list.push(message);
    memoryMessages.set(message.potId, list.slice(-MAX_MESSAGES_PER_POT));
    return;
  }
  const key = potMessagesKey(message.potId);
  await client.rpush(key, JSON.stringify(message));
  await client.ltrim(key, -MAX_MESSAGES_PER_POT, -1);
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
    return data.map((m) => ({
      id: m.id,
      potId: m.pot_id,
      authorId: m.author_id,
      authorName: m.author_name,
      text: m.text,
      kind: m.kind as ChatMessage["kind"],
      createdAt: m.created_at,
    }));
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
