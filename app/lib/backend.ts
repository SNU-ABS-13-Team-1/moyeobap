import { getRedis } from "./kv";
import { getSupabase } from "./supabase";
import { RESTAURANTS } from "../data/restaurants";
import type { ChatMessage, Restaurant, User } from "../types/moyeobap";

export type ServerPot = {
  id: string;
  restaurantId: string;
  deadline: string; // ISO timestamp
  participants: (User & { joinedAt: number })[];
  status: "active" | "closed" | "failed";
  maxParticipants: number | null;
  createdAt: string;
};

const POT_INDEX_KEY = "moyeobap:pots:index";
const potKey = (id: string) => `moyeobap:pot:${id}`;
const potMessagesKey = (id: string) => `moyeobap:pot:${id}:messages`;
const CUSTOM_RESTAURANT_INDEX_KEY = "moyeobap:restaurants:custom:index";
const customRestaurantKey = (id: string) => `moyeobap:restaurant:custom:${id}`;

// Local-dev fallback when neither Supabase nor Redis is configured.
const memoryPots = new Map<string, ServerPot>();
const memoryPotIndex = new Set<string>();
const memoryMessages = new Map<string, ChatMessage[]>();
const memoryCustomRestaurants = new Map<string, Restaurant>();
const memoryCustomRestaurantIndex = new Set<string>();

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

export async function savePot(pot: ServerPot): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    // Foreign key 무결성 보장을 위해 음식점 레코드가 있는지 먼저 확인 후 자동으로 넣어줍니다.
    await ensureRestaurantExistsInSupabase(pot.restaurantId);

    // 1. Upsert pot row
    const { error: potErr } = await supabase.from("pots").upsert({
      id: pot.id,
      restaurant_id: pot.restaurantId,
      deadline: pot.deadline,
      status: pot.status,
      max_participants: pot.maxParticipants,
      created_at: pot.createdAt,
    });
    if (potErr) {
      console.error("Supabase savePot error:", potErr);
    }

    // 2. Refresh participants
    await supabase.from("pot_participants").delete().eq("pot_id", pot.id);
    if (pot.participants.length > 0) {
      const participantRows = pot.participants.map((p) => ({
        pot_id: pot.id,
        user_id: p.id,
        user_name: p.name,
        user_initial: p.initial,
        bank_account: p.bankAccount ?? null,
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
  if (!client) {
    memoryPots.set(pot.id, pot);
    memoryPotIndex.add(pot.id);
    return;
  }
  await client.set(potKey(pot.id), pot);
  await client.sadd(POT_INDEX_KEY, pot.id);
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

    const participants = ((potRow.pot_participants as SupabaseParticipant[]) ?? []).map((p) => ({
      id: p.user_id,
      name: p.user_name,
      initial: p.user_initial,
      bankAccount: p.bank_account ?? undefined,
      joinedAt: new Date(p.joined_at).getTime(),
    }));

    return {
      id: potRow.id,
      restaurantId: potRow.restaurant_id,
      deadline: potRow.deadline,
      status: potRow.status as ServerPot["status"],
      maxParticipants: potRow.max_participants,
      createdAt: potRow.created_at,
      participants,
    };
  }

  const client = getRedis();
  if (!client) return memoryPots.get(id) ?? null;
  return (await client.get<ServerPot>(potKey(id))) ?? null;
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

    pots = rows.map((potRow) => ({
      id: potRow.id,
      restaurantId: potRow.restaurant_id,
      deadline: potRow.deadline,
      status: potRow.status as ServerPot["status"],
      maxParticipants: potRow.max_participants,
      createdAt: potRow.created_at,
      participants: ((potRow.pot_participants as SupabaseParticipant[]) ?? []).map((p) => ({
        id: p.user_id,
        name: p.user_name,
        initial: p.user_initial,
        bankAccount: p.bank_account ?? undefined,
        joinedAt: new Date(p.joined_at).getTime(),
      })),
    }));
  } else {
    const client = getRedis();
    if (!client) {
      pots = [...memoryPotIndex].map((id) => memoryPots.get(id)).filter((p): p is ServerPot => Boolean(p));
    } else {
      const ids = await client.smembers(POT_INDEX_KEY);
      if (ids.length === 0) return [];
      const items = await client.mget<ServerPot[]>(...ids.map(potKey));
      pots = items.filter((p): p is ServerPot => Boolean(p));
    }
  }

  const updated: ServerPot[] = [];
  for (const pot of pots) {
    const nextStatus = deriveStatus(pot, now);
    if (nextStatus !== pot.status) {
      const changed = { ...pot, status: nextStatus };
      await savePot(changed);
      updated.push(changed);
    } else {
      updated.push(pot);
    }
  }
  return updated;
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
  const raw = await client.lrange<string>(potMessagesKey(potId), 0, -1);
  return raw.map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
}
