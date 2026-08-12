// data/*.csv 정본을 앱이 읽는 app/data/restaurants.ts로 옮긴다.
//
//     node scripts/csv-to-ts.mjs   (= npm run data:build)
//
// 정본은 CSV다. app/data/restaurants.ts는 이 스크립트가 만드는 생성물이므로
// 직접 고치지 않는다. 고쳐도 다음 실행에서 덮어써진다.
//
// 매장 정보를 바꾸려면: 조사표 엑셀 수정 -> scripts/xlsx_to_csv.py 실행 ->
// 이 스크립트 실행.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app/data/restaurants.ts');

// 소분류 14종별 목록 아이콘. DATA_GUIDE 2절의 분류표와 짝을 이룬다.
const EMOJI = {
  '한식': '🍚', '중식': '🥡', '분식': '🍢', '패스트푸드': '🍔',
  '치킨': '🍗', '피자': '🍕', '찜·탕': '🍲', '돈까스·회': '🍣',
  '양식': '🍝', '아시안': '🍜', '고기': '🥩', '족발·보쌈': '🍖',
  '도시락': '🍱', '카페·디저트': '☕',
};
const FALLBACK_EMOJI = '🍽️';

/** 따옴표로 감싼 값과 값 안의 쉼표·줄바꿈을 처리하는 최소 CSV 파서. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter(r => r.some(cell => cell !== ''));
  return body.map(cells =>
    Object.fromEntries(header.map((key, i) => [key, (cells[i] ?? '').trim()])));
}

const readCsv = name => parseCsv(readFileSync(join(ROOT, 'data', name), 'utf8'));

const quote = value => JSON.stringify(value);
const won = price => {
  const number = Number(price);
  return Number.isFinite(number) ? `${number.toLocaleString('en-US')}원` : String(price);
};

const restaurants = readCsv('restaurants.csv');
const menus = readCsv('menus.csv');

const menusByStore = new Map();
for (const menu of menus) {
  if (!menusByStore.has(menu.restaurant_id)) menusByStore.set(menu.restaurant_id, []);
  menusByStore.get(menu.restaurant_id).push(menu);
}

const warnings = [];
const blocks = [];

for (const store of restaurants) {
  const storeMenus = menusByStore.get(store.restaurant_id) ?? [];
  if (storeMenus.length === 0) {
    warnings.push(`${store.restaurant_id} (${store.name}): 메뉴 없음 — 앱에서 제외`);
    continue;
  }
  if (!EMOJI[store.category]) {
    warnings.push(`${store.restaurant_id} (${store.name}): 분류 '${store.category}'가 14종에 없음`);
  }

  const lines = [
    `    id: ${quote(store.restaurant_id)},`,
    `    name: ${quote(store.name)},`,
    `    emoji: ${quote(EMOJI[store.category] ?? FALLBACK_EMOJI)},`,
    `    category: ${quote(store.type === 'cafe' ? 'cafe' : 'lunch')},`,
    `    subCategory: ${quote(store.category)},`,
    `    minOrder: ${Number(store.min_order) || 0},`,
    `    deliveryTime: ${quote(store.delivery_time ? `${store.delivery_time}분` : '')},`,
    `    menus: [${storeMenus
      .map(m => `{ name: ${quote(m.name)}, price: ${quote(won(m.price))} }`)
      .join(', ')}],`,
  ];

  // 확인하지 못한 값은 빈 문자열로 넣지 않고 필드 자체를 뺀다.
  const optional = [
    ['address', store.address], ['phone', store.phone],
    ['businessHours', store.business_hours], ['closedDays', store.closed_days],
  ];
  for (const [key, value] of optional) {
    if (value) lines.push(`    ${key}: ${quote(value)},`);
  }
  if (store.rating) lines.push(`    rating: ${Number(store.rating)},`);

  blocks.push(`  {\n${lines.join('\n')}\n  }`);
}

const output = `import { Restaurant } from '../types/moyeobap';

// 이 파일은 scripts/csv-to-ts.mjs가 생성합니다. 직접 고치지 마세요.
// 정본은 data/restaurants.csv와 data/menus.csv입니다.
// 갱신: npm run data:build
export const RESTAURANTS: Restaurant[] = [
${blocks.join(',\n')},
];
`;

writeFileSync(OUT, output);

const lunch = restaurants.filter(s => s.type !== 'cafe').length;
console.log(`매장 ${blocks.length}곳(식당 ${lunch} / 카페 ${restaurants.length - lunch}), 메뉴 ${menus.length}개 -> app/data/restaurants.ts`);
for (const warning of warnings) console.warn(`  경고: ${warning}`);
