import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;
let redisChecked = false;

export function getRedis(): Redis | null {
  if (redisChecked) return redisClient;
  redisChecked = true;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function isStorageConfigured(): boolean {
  return getRedis() !== null;
}
