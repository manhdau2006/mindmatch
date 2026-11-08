import { prisma } from './db.js';

export const MAX_CONTENT_LENGTH = 2000;

const userSummary = { select: { id: true, name: true, role: true, avatar: true, lastActiveAt: true } };

export const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// ---------- User ----------

export function getUser(userId) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export function touchUser(userId) {
  return prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
}

// ---------- Conversation ----------

export function getConversation(conversationId) {
  const id = toId(conversationId);
  return id ? prisma.conversation.findUnique({ where: { id } }) : null;
}

export const isParticipant = (conversation, userId) =>
  !!conversation && (conversation.studentId === userId || conversation.tutorId === userId);

export function createConversation(studentId, tutorId) {
  return prisma.conversation.upsert({
    where: { studentId_tutorId: { studentId, tutorId } },
    update: {},
    create: { studentId, tutorId },
  });
}

export function closeConversation(conversationId) {
  return prisma.conversation.update({ where: { id: conversationId }, data: { status: 'closed' } });
}

export async function listConversationIds(userId) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ studentId: userId }, { tutorId: userId }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Hội thoại nhìn từ phía `userId`: kèm người kia, tin cuối, số tin chưa đọc
export async function listConversationsForUser(userId, onlyId) {
  const rows = await prisma.conversation.findMany({
    where: {
      OR: [{ studentId: userId }, { tutorId: userId }],
      ...(onlyId && { id: onlyId }),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      student: userSummary,
      tutor: userSummary,
      messages: { orderBy: { id: 'desc' }, take: 1 },
      _count: { select: { messages: { where: { isRead: false, senderId: { not: userId } } } } },
    },
  });

  return rows.map((c) => {
    const last = c.messages[0];
    return {
      id: c.id,
      status: c.status,
      partner: c.studentId === userId ? c.tutor : c.student,
      lastMessage: last ? { content: last.content, senderId: last.senderId, createdAt: last.createdAt } : null,
      unreadCount: c._count.messages,
      updatedAt: c.updatedAt,
    };
  });
}

// ---------- Message ----------

export function validateContent(content) {
  if (typeof content !== 'string' || !content.trim()) return 'Tin nhắn không được để trống';
  if (content.trim().length > MAX_CONTENT_LENGTH) return `Tin nhắn tối đa ${MAX_CONTENT_LENGTH} ký tự`;
  return null;
}

export async function createMessage({ conversationId, senderId, content, messageType = 'text' }) {
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId, content: content.trim(), messageType },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  return message;
}

export async function listMessages(conversationId, { limit = 50, before } = {}) {
  const beforeId = toId(before);
  const rows = await prisma.message.findMany({
    where: { conversationId, ...(beforeId && { id: { lt: beforeId } }) },
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.reverse();
}

// Đánh dấu đã đọc các tin người kia gửi cho `readerId`, trả về id các tin vừa cập nhật
export async function markAsRead(conversationId, readerId) {
  const unread = await prisma.message.findMany({
    where: { conversationId, isRead: false, senderId: { not: readerId } },
    select: { id: true },
  });
  const ids = unread.map((m) => m.id);
  if (ids.length) {
    await prisma.message.updateMany({ where: { id: { in: ids } }, data: { isRead: true } });
  }
  return ids;
}
