import type { SupabaseClient } from '@supabase/supabase-js';
import { RESTAURANTS } from '../data/restaurants';

/** Header-only projection: never downloads other participants or message text.
 * The service-role client is server-only; membership is filtered by verified user ID. */
export async function getNotificationSummary(userId: string, now: Date, db: SupabaseClient) {
  const [{ data: open, error: openError }, { data: memberships, error: memberError }] = await Promise.all([
    db.from('pots').select('id, restaurant_id, created_at, creator_id, status, deadline')
      .eq('status', 'active').gt('deadline', now.toISOString())
      .order('created_at', { ascending: false }).limit(30),
    db.from('pot_participants').select('pot_id, joined_at, pots!inner(id, restaurant_id, status)')
      .eq('user_id', userId).neq('pots.status', 'failed'),
  ]);
  if (openError || memberError) throw new Error('Notification membership query failed');
  // Supabase's untyped relation result can be an object or an array.
  const mine = (memberships ?? []).flatMap((row) => {
    const pot = Array.isArray(row.pots) ? row.pots[0] : row.pots;
    return pot ? [{ id: row.pot_id as string, joinedAt: row.joined_at as string,
      restaurantId: pot.restaurant_id as string }] : [];
  });
  const ids = mine.map((p) => p.id);
  const unreadIds = new Set<string>();
  if (ids.length) {
    const [{ data: latest, error: latestError }, { data: reads, error: readsError }] = await Promise.all([
      db.from('pots').select('id, messages(author_id, created_at)').in('id', ids)
        .order('created_at', { referencedTable: 'messages', ascending: false })
        .limit(1, { referencedTable: 'messages' }),
      db.from('message_reads').select('pot_id, last_read_at').eq('user_id', userId).in('pot_id', ids),
    ]);
    if (latestError || readsError) throw new Error('Notification unread query failed');
    const readAt = new Map((reads ?? []).map((r) => [r.pot_id, Date.parse(r.last_read_at)]));
    const joinedAt = new Map(mine.map((p) => [p.id, Date.parse(p.joinedAt)]));
    for (const row of latest ?? []) {
      const message = row.messages?.[0];
      if (message && message.author_id !== userId && Date.parse(message.created_at) >
          Math.max(readAt.get(row.id) ?? 0, joinedAt.get(row.id) ?? 0)) unreadIds.add(row.id);
    }
  }
  const names = new Map(RESTAURANTS.map((r) => [r.id, r.name]));
  const restaurantIds = [...new Set([
    ...(open ?? []).map((p) => p.restaurant_id as string),
    ...mine.filter((p) => unreadIds.has(p.id)).map((p) => p.restaurantId),
  ])].filter((id) => !names.has(id));
  if (restaurantIds.length) {
    const { data, error } = await db.from('restaurants').select('id, name').in('id', restaurantIds);
    if (error) throw new Error('Notification restaurant query failed');
    for (const row of data ?? []) names.set(row.id, row.name);
  }
  return {
    openPots: (open ?? []).map((p) => ({ id: p.id, name: names.get(p.restaurant_id) ?? '새 팟',
      createdAt: p.created_at, creatorId: p.creator_id, status: p.status, deadline: p.deadline })),
    myPotIds: ids,
    unread: mine.filter((p) => unreadIds.has(p.id)).map((p) => ({ potId: p.id,
      name: names.get(p.restaurantId) ?? '이름 없는 팟' })),
    serverTime: now.toISOString(),
  };
}
