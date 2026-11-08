import {
  getConversation,
  isParticipant,
  listConversationIds,
  createMessage,
  validateContent,
  markAsRead,
  touchUser,
} from './store.js';
import { markOnline, markOffline } from './presence.js';
import { conversationRoom, userRoom } from './views.js';

const reply = (ack, payload) => typeof ack === 'function' && ack(payload);

// Bọc handler async: lỗi DB không làm sập server, client nhận { ok: false }
const safe = (handler) => async (payload, ack) => {
  try {
    await handler(payload || {}, ack);
  } catch (err) {
    console.error(err);
    reply(ack, { ok: false, error: 'Lỗi server, vui lòng thử lại' });
  }
};

// Vào phòng trước khi kết nối hoàn tất -> không sót tin, kể cả khi reconnect
export async function joinRooms(socket, next) {
  try {
    const userId = socket.data.userId;
    socket.join(userRoom(userId));
    const ids = await listConversationIds(userId);
    socket.join(ids.map(conversationRoom));
    next();
  } catch (err) {
    next(err);
  }
}

const conversationRoomsOf = (socket) => [...socket.rooms].filter((r) => r.startsWith('conversation:'));

export function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.data.userId;

    if (markOnline(userId)) {
      for (const room of conversationRoomsOf(socket)) {
        socket.to(room).emit('presence', { userId, isOnline: true });
      }
    }

    // payload: { conversationId, content, clientId } -> ack: { ok, message } | { ok: false, error }
    socket.on('send_message', safe(async ({ conversationId, content, clientId }, ack) => {
      const conversation = await getConversation(conversationId);
      if (!isParticipant(conversation, userId)) {
        return reply(ack, { ok: false, error: 'Bạn không thuộc cuộc trò chuyện này' });
      }
      if (conversation.status !== 'active') {
        return reply(ack, { ok: false, error: 'Cuộc trò chuyện đã bị đóng' });
      }
      const error = validateContent(content);
      if (error) return reply(ack, { ok: false, error });

      const message = await createMessage({ conversationId: conversation.id, senderId: userId, content });
      socket.to(conversationRoom(conversation.id)).emit('receive_message', message);
      reply(ack, { ok: true, message, clientId });
    }));

    socket.on('mark_read', safe(async ({ conversationId }) => {
      const conversation = await getConversation(conversationId);
      if (!isParticipant(conversation, userId)) return;
      const messageIds = await markAsRead(conversation.id, userId);
      if (messageIds.length) {
        io.to(conversationRoom(conversation.id)).emit('messages_read', {
          conversationId: conversation.id,
          readerId: userId,
          messageIds,
        });
      }
    }));

    // Không truy vấn DB cho typing (gửi rất thường xuyên), chỉ kiểm tra theo phòng đã join
    socket.on('typing', ({ conversationId, isTyping } = {}) => {
      const room = conversationRoom(conversationId);
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('typing', { conversationId, userId, isTyping: !!isTyping });
    });

    // socket.rooms bị xoá khi 'disconnect', nên lấy danh sách phòng ở 'disconnecting'
    socket.on('disconnecting', async () => {
      const rooms = conversationRoomsOf(socket);
      if (!markOffline(userId)) return;
      try {
        const { lastActiveAt } = await touchUser(userId);
        for (const room of rooms) {
          io.to(room).emit('presence', { userId, isOnline: false, lastActiveAt });
        }
      } catch (err) {
        console.error(err);
      }
    });
  });
}
