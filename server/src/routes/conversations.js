import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  createConversation,
  closeConversation,
  getConversation,
  getUser,
  isParticipant,
  listMessages,
  createMessage,
  validateContent,
  markAsRead,
  toId,
} from '../store.js';
import { conversationViews, conversationView, conversationRoom, userRoom } from '../views.js';

export function conversationRoutes(io) {
  const router = Router();
  router.use(requireAuth);

  async function loadConversation(req, res, next) {
    const conversation = await getConversation(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (!isParticipant(conversation, req.userId)) {
      return res.status(403).json({ error: 'Bạn không thuộc cuộc trò chuyện này' });
    }
    req.conversation = conversation;
    next();
  }

  async function emitRead(conversationId, readerId) {
    const messageIds = await markAsRead(conversationId, readerId);
    if (messageIds.length) {
      io.to(conversationRoom(conversationId)).emit('messages_read', { conversationId, readerId, messageIds });
    }
    return messageIds;
  }

  router.get('/', async (req, res) => {
    res.json(await conversationViews(req.userId));
  });

  // Gọi khi học sinh và gia sư Match thành công
  router.post('/', async (req, res) => {
    const studentId = toId(req.body?.studentId);
    const tutorId = toId(req.body?.tutorId);
    if (!studentId || !tutorId || studentId === tutorId) {
      return res.status(400).json({ error: 'Cần studentId và tutorId hợp lệ' });
    }
    if (req.userId !== studentId && req.userId !== tutorId) {
      return res.status(403).json({ error: 'Chỉ người trong cặp Match mới tạo được cuộc trò chuyện' });
    }
    const [student, tutor] = await Promise.all([getUser(studentId), getUser(tutorId)]);
    if (student?.role !== 'student' || tutor?.role !== 'tutor') {
      return res.status(400).json({ error: 'studentId phải là học sinh, tutorId phải là gia sư' });
    }

    const conversation = await createConversation(studentId, tutorId);
    for (const uid of [studentId, tutorId]) {
      io.in(userRoom(uid)).socketsJoin(conversationRoom(conversation.id));
      io.to(userRoom(uid)).emit('conversation_created', await conversationView(conversation.id, uid));
    }
    res.status(201).json(await conversationView(conversation.id, req.userId));
  });

  // ?limit=50&before=<messageId> để tải tin cũ hơn
  router.get('/:id/messages', loadConversation, async (req, res) => {
    const limit = Math.min(toId(req.query.limit) || 50, 100);
    res.json(await listMessages(req.conversation.id, { limit, before: req.query.before }));
  });

  router.post('/:id/messages', loadConversation, async (req, res) => {
    if (req.conversation.status !== 'active') {
      return res.status(409).json({ error: 'Cuộc trò chuyện đã bị đóng' });
    }
    const error = validateContent(req.body?.content);
    if (error) return res.status(400).json({ error });

    const message = await createMessage({
      conversationId: req.conversation.id,
      senderId: req.userId,
      content: req.body.content,
    });
    io.to(conversationRoom(req.conversation.id)).emit('receive_message', message);
    res.status(201).json(message);
  });

  router.post('/:id/read', loadConversation, async (req, res) => {
    const messageIds = await emitRead(req.conversation.id, req.userId);
    res.json({ updated: messageIds.length });
  });

  router.patch('/:id/close', loadConversation, async (req, res) => {
    await closeConversation(req.conversation.id);
    io.to(conversationRoom(req.conversation.id)).emit('conversation_closed', {
      conversationId: req.conversation.id,
    });
    res.json(await conversationView(req.conversation.id, req.userId));
  });

  return router;
}
