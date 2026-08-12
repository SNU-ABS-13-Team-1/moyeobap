import { getRedis } from "./kv";
import { RESTAURANTS } from "../data/restaurants";
import type { ChatMessage, Restaurant, SerializedPot, User } from "../types/moyeobap";

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

export async function savePot(pot: ServerPot): Promise<void> {
  const client = getRedis();
  const snapshot = clonePot(pot);
  if (!client) {
    memoryPots.set(snapshot.id, snapshot);
    memoryPotIndex.add(snapshot.id);
    return;
  }
  await client.set(potKey(snapshot.id), snapshot);
  await client.sadd(POT_INDEX_KEY, snapshot.id);
}

export async function getPot(id: string): Promise<ServerPot | null> {
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
  const client = getRedis();
  const now = new Date();

  let pots: ServerPot[];
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

  return Promise.all(pots.map(async (pot) => {
    const nextStatus = deriveStatus(pot, now);
    if (nextStatus !== pot.status) {
      const changed = { ...pot, status: nextStatus };
      await savePot(changed);
      return changed;
    }
    return pot;
  }));
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
