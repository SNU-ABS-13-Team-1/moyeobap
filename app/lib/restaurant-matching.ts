import type { Restaurant } from '../types/moyeobap';

/**
 * 사용자 입력과 등록된 상호를 비교할 때 띄어쓰기·대소문자·일반 특수문자의
 * 차이만 제거합니다. 지점명과 단어 순서는 유지해 서로 다른 매장을 자동으로
 * 합치지 않습니다.
 */
export function normalizeRestaurantName(name: string): string {
  return name
    .normalize('NFKC')
    .toLocaleLowerCase('ko')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function findExactRestaurant(
  restaurants: Restaurant[],
  name: string,
  category: Restaurant['category'],
): Restaurant | undefined {
  const normalizedName = normalizeRestaurantName(name);
  if (!normalizedName) return undefined;

  return restaurants.find((restaurant) => (
    restaurant.category === category
    && normalizeRestaurantName(restaurant.name) === normalizedName
  ));
}

export function findRestaurantSuggestions(
  restaurants: Restaurant[],
  name: string,
  category: Restaurant['category'],
  limit = 3,
): Restaurant[] {
  const normalizedName = normalizeRestaurantName(name);
  if (normalizedName.length < 2) return [];

  return restaurants
    .filter((restaurant) => restaurant.category === category)
    .map((restaurant) => {
      const candidate = normalizeRestaurantName(restaurant.name);
      let score = Number.POSITIVE_INFINITY;

      if (candidate === normalizedName) score = 0;
      else if (candidate.startsWith(normalizedName) || normalizedName.startsWith(candidate)) score = 1;
      else if (candidate.includes(normalizedName) || normalizedName.includes(candidate)) score = 2;

      return { restaurant, candidate, score };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => (
      a.score - b.score
      || Math.abs(a.candidate.length - normalizedName.length) - Math.abs(b.candidate.length - normalizedName.length)
      || a.restaurant.name.localeCompare(b.restaurant.name, 'ko')
    ))
    .slice(0, limit)
    .map(({ restaurant }) => restaurant);
}
