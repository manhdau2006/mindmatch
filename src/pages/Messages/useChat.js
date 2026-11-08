import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, apiFetch } from '../../lib/chatApi';

const SEND_TIMEOUT_MS = 10000;
const TYPING_IDLE_MS = 2000;

const makeClientId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sortByUpdated = (list) =>
  [...list].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

const withLastMessage = (conversation, message) => ({
  ...conversation,
  lastMessage: { content: message.content, senderId: message.senderId, createdAt: message.createdAt },
  updatedAt: message.createdAt,
});

// auth: { userId } khi dev, hoặc { token } khi đã có đăng nhập
export default function useChat(auth) {
  const [conversations, setConversations] = useState([]);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [typingByConv, setTypingByConv] = useState({});
  const [status, setStatus] = useState('connecting'); // connecting | connected | error
  const [error, setError] = useState(null);
  const [loadingList, setLoadingList] = useState(true);

  const socketRef = useRef(null);
  const selectedIdRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const authRef = useRef(auth);
  authRef.current = auth;
  const authKey = auth.token || auth.userId;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const updateMessages = useCallback((conversationId, update) => {
    setMessagesByConv((prev) => ({ ...prev, [conversationId]: update(prev[conversationId] || []) }));
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(sortByUpdated(await apiFetch('/api/conversations', { auth: authRef.current })));
      setError(null);
    } catch (err) {
      setError(`Không tải được danh sách chat: ${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const list = await apiFetch(`/api/conversations/${conversationId}/messages`, {
        auth: authRef.current,
      });
      // Giữ lại tin đang gửi / gửi lỗi (chưa có trên server)
      updateMessages(conversationId, (prev) => [...list, ...prev.filter((m) => m.status)]);
    } catch (err) {
      setError(`Không tải được tin nhắn: ${err.message}`);
    }
  }, [updateMessages]);

  const markRead = useCallback((conversationId) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
    socketRef.current?.emit('mark_read', { conversationId });
  }, []);

  useEffect(() => {
    if (!authKey) return undefined;

    setLoadingList(true);
    const socket = io(API_URL, { auth: authRef.current });
    socketRef.current = socket;

    // Chạy cả khi kết nối lại -> tải lại để không sót tin lúc mất mạng
    socket.on('connect', () => {
      setStatus('connected');
      loadConversations();
      const current = selectedIdRef.current;
      if (current) {
        loadMessages(current);
        socket.emit('mark_read', { conversationId: current });
      }
    });

    socket.on('connect_error', (err) => {
      setStatus('error');
      setLoadingList(false);
      setError(`Không kết nối được server chat (${err.message})`);
    });

    socket.on('disconnect', () => setStatus('connecting'));

    socket.on('receive_message', (message) => {
      const cid = message.conversationId;
      const isOpen = selectedIdRef.current === cid;
      const fromMe = message.senderId === authRef.current.userId;

      setMessagesByConv((prev) => {
        if (!prev[cid] || prev[cid].some((m) => m.id === message.id)) return prev;
        return { ...prev, [cid]: [...prev[cid], message] };
      });

      setConversations((prev) => {
        if (!prev.some((c) => c.id === cid)) {
          loadConversations();
          return prev;
        }
        return sortByUpdated(
          prev.map((c) =>
            c.id === cid
              ? { ...withLastMessage(c, message), unreadCount: isOpen || fromMe ? c.unreadCount : c.unreadCount + 1 }
              : c
          )
        );
      });

      setTypingByConv((prev) => ({ ...prev, [cid]: false }));
      if (isOpen && document.visibilityState === 'visible') {
        socket.emit('mark_read', { conversationId: cid });
      }
    });

    socket.on('messages_read', ({ conversationId, messageIds }) => {
      const ids = new Set(messageIds);
      setMessagesByConv((prev) => {
        if (!prev[conversationId]) return prev;
        return {
          ...prev,
          [conversationId]: prev[conversationId].map((m) => (ids.has(m.id) ? { ...m, isRead: true } : m)),
        };
      });
    });

    socket.on('presence', ({ userId, isOnline, lastActiveAt }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.partner.id === userId
            ? { ...c, partner: { ...c.partner, isOnline, lastActiveAt: lastActiveAt || c.partner.lastActiveAt } }
            : c
        )
      );
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      setTypingByConv((prev) => ({ ...prev, [conversationId]: isTyping }));
    });

    socket.on('conversation_created', (conversation) => {
      setConversations((prev) =>
        prev.some((c) => c.id === conversation.id) ? prev : sortByUpdated([conversation, ...prev])
      );
    });

    socket.on('conversation_closed', ({ conversationId }) => {
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, status: 'closed' } : c)));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authKey, loadConversations, loadMessages]);

  // Quay lại tab / mở lại app -> đánh dấu đã đọc
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && selectedIdRef.current) markRead(selectedIdRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  const openConversation = useCallback((conversationId) => {
    setSelectedId(conversationId);
    if (!conversationId) return;
    loadMessages(conversationId);
    markRead(conversationId);
  }, [loadMessages, markRead]);

  const emitSend = useCallback((conversationId, content, clientId) => {
    const markFailed = () =>
      updateMessages(conversationId, (list) =>
        list.map((m) => (m.id === clientId ? { ...m, status: 'failed' } : m))
      );

    const socket = socketRef.current;
    if (!socket) return markFailed();

    socket.timeout(SEND_TIMEOUT_MS).emit('send_message', { conversationId, content, clientId }, (err, res) => {
      if (err || !res?.ok) {
        if (res?.error) setError(res.error);
        return markFailed();
      }
      const saved = res.message;
      updateMessages(conversationId, (list) => list.map((m) => (m.id === clientId ? saved : m)));
      setConversations((prev) =>
        sortByUpdated(prev.map((c) => (c.id === conversationId ? withLastMessage(c, saved) : c)))
      );
    });
  }, [updateMessages]);

  // Chỉ emit khi trạng thái đổi, tự tắt sau TYPING_IDLE_MS
  const setTyping = useCallback((isTyping) => {
    const socket = socketRef.current;
    const conversationId = selectedIdRef.current;
    if (!socket || !conversationId) return;

    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current !== isTyping) {
      isTypingRef.current = isTyping;
      socket.emit('typing', { conversationId, isTyping });
    }
    if (isTyping) {
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socket.emit('typing', { conversationId, isTyping: false });
      }, TYPING_IDLE_MS);
    }
  }, []);

  const sendMessage = useCallback((content) => {
    const text = content.trim();
    const conversationId = selectedIdRef.current;
    if (!text || !conversationId) return;

    const clientId = makeClientId();
    updateMessages(conversationId, (list) => [
      ...list,
      {
        id: clientId,
        conversationId,
        senderId: authRef.current.userId,
        content: text,
        messageType: 'text',
        isRead: false,
        createdAt: new Date().toISOString(),
        status: 'sending', // chỉ có ở client: sending | failed
      },
    ]);
    setTyping(false);
    emitSend(conversationId, text, clientId);
  }, [emitSend, setTyping, updateMessages]);

  const retryMessage = useCallback((message) => {
    updateMessages(message.conversationId, (list) =>
      list.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m))
    );
    emitSend(message.conversationId, message.content, message.id);
  }, [emitSend, updateMessages]);

  return {
    conversations,
    messages: selectedId ? messagesByConv[selectedId] : undefined,
    activeConversation: conversations.find((c) => c.id === selectedId) || null,
    isPartnerTyping: !!(selectedId && typingByConv[selectedId]),
    selectedId,
    status,
    error,
    loadingList,
    openConversation,
    sendMessage,
    retryMessage,
    setTyping,
    dismissError: () => setError(null),
  };
}
