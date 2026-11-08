import { listConversationsForUser } from './store.js';
import { isOnline } from './presence.js';

export const conversationRoom = (id) => `conversation:${id}`;
export const userRoom = (id) => `user:${id}`;

export async function conversationViews(userId, onlyId) {
  const list = await listConversationsForUser(userId, onlyId);
  return list.map((c) => ({ ...c, partner: { ...c.partner, isOnline: isOnline(c.partner.id) } }));
}

export async function conversationView(conversationId, userId) {
  const [view] = await conversationViews(userId, conversationId);
  return view;
}
