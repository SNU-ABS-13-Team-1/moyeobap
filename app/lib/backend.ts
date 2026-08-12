import { randomUUID } from "node:crypto";
import { getRedis } from "./kv";
import { RESTAURANTS } from "../data/restaurants";
import type { ChatMessage, PotEvent, PotEventType, Restaurant, User } from "../types/moyeobap";

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
const EVENT_LOG_KEY = "moyeobap:events";
const potKey = (id: string) => `moyeobap:pot:${id}`;
const potMessagesKey = (id: string) => `moyeobap:pot:${id}:messages`;
const CUSTOM_RESTAURANT_INDEX_KEY = "moyeobap:restaurants:custom:index";
const customRestaurantKey = (id: string) => `moyeobap:restaurant:custom:${id}`;

// Local-dev fallback so `npm run dev` works without any Redis setup.
// Resets on process restart and is NOT safe for the Vercel serverless
// runtime (each invocation may hit a different instance) — production
// needs UPSTASH_REDIS_REST_URL/TOKEN set.
const memoryPots = new Map<string, ServerPot>();
const memoryPotIndex = new Set<string>();
const memoryMessages = new Map<string, ChatMessage[]>();
const memoryEvents: PotEvent[] = [];
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
  const client = getRedis();
  if (!client) return memoryPots.get(id) ?? null;
  return (await client.get<ServerPot>(potKey(id))) ?? null;
}

/** 마감/정원 도달로 상태가 바뀐 팟은 목록 조회 시점에 계산해서 반영(저장)합니다. */
export async function listPots(): Promise<ServerPot[]> {
  const client = getRedis();
  const now = new Date();

  let pots: ServerPot[];
  if (!client) {
    pots = [...memoryPotIndex].map((id) => memoryPots.get(id)).filter((p): p is ServerPot => Boolean(p));
  } else {
    const ids = await client.smembers(POT_INDEX_KEY);
    if (ids.length === 0) return [];
    const items = await client.mget<ServerPot[]>(...ids.map(potKey));
    pots = items.filter((p): p is ServerPot => Boolean(p));
  }

  const updated: ServerPot[] = [];
  for (const pot of pots) {
    const nextStatus = deriveStatus(pot, now);
    if (nextStatus !== pot.status) {
      const changed = { ...pot, status: nextStatus };
      await savePot(changed);
      // 마감·실패는 시간이나 정원 때문에 자동으로 일어나므로 userId가 없습니다.
      await logEvent(nextStatus === "closed" ? "pot_closed" : "pot_failed", changed);
      updated.push(changed);
    } else {
      updated.push(pot);
    }
  }
  return updated;
}

export async function saveCustomRestaurant(restaurant: Restaurant): Promise<void> {
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

  const client = getRedis();
  if (!client) return memoryCustomRestaurants.get(id);
  return (await client.get<Restaurant>(customRestaurantKey(id))) ?? undefined;
}

const MAX_MESSAGES_PER_POT = 200;

export async function addMessage(message: ChatMessage): Promise<void> {
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
  const client = getRedis();
  if (!client) return memoryMessages.get(potId) ?? [];
  const raw = await client.lrange<string>(potMessagesKey(potId), 0, -1);
  return raw.map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
}
