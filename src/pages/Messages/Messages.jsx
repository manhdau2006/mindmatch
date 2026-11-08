import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, AlertCircle, RotateCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import './Messages.css';
import { formatChatTime, formatMessageTime } from '../../lib/chatApi';
import useChat from './useChat';

const DEV_DEFAULT_USER_ID = 1;

function Avatar({ user, size = 48 }) {
  const [broken, setBroken] = useState(false);
  if (user.avatar && !broken) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className="avatar-img"
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="avatar-img avatar-fallback" style={{ width: size, height: size }}>
      {(user.name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

function partnerStatusText(partner) {
  if (partner.isOnline) return 'Đang hoạt động';
  if (partner.lastActiveAt) return `Hoạt động ${formatChatTime(partner.lastActiveAt)}`;
  return 'Không trực tuyến';
}

export default function Messages() {
  const location = useLocation();

  // TODO: khi phần Đăng nhập xong, lấy id + token của user đăng nhập thay cho ?as=
  const myId = Number(new URLSearchParams(location.search).get('as')) || DEV_DEFAULT_USER_ID;
  const auth = useMemo(() => ({ userId: myId }), [myId]);

  const {
    conversations,
    messages,
    activeConversation,
    isPartnerTyping,
    selectedId,
    status,
    error,
    loadingList,
    openConversation,
    sendMessage,
    retryMessage,
    setTyping,
    dismissError,
  } = useChat(auth);

  const [inputMessage, setInputMessage] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length, isPartnerTyping, selectedId]);

  const isClosed = activeConversation?.status === 'closed';

  // Tin cuối của mình đã được đọc -> hiện "Đã xem"
  const lastSeenId = useMemo(() => {
    const mine = (messages || []).filter((m) => m.senderId === myId && !m.status);
    const last = mine[mine.length - 1];
    return last?.isRead ? last.id : null;
  }, [messages, myId]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isClosed) return;
    sendMessage(inputMessage);
    setInputMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // isComposing: bộ gõ tiếng Việt đang ghép dấu, Enter lúc này không phải là gửi
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className={`chat-sidebar ${selectedId ? 'mobile-hidden' : ''}`}>
        <div className="chat-sidebar-header">
          <span>Đoạn chat</span>
          {status !== 'connected' && (
            <span className={`connection-pill ${status}`}>
              {status === 'error' ? 'Mất kết nối' : 'Đang kết nối...'}
            </span>
          )}
        </div>

        <div className="conversation-list">
          {loadingList && <p className="chat-empty-text">Đang tải...</p>}
          {!loadingList && conversations.length === 0 && (
            <p className="chat-empty-text">
              Chưa có cuộc trò chuyện nào. Khi bạn và gia sư Match thành công, đoạn chat sẽ xuất hiện ở đây.
            </p>
          )}

          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => openConversation(conv.id)}
              className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
            >
              <div className="avatar-box">
                <Avatar user={conv.partner} />
                {conv.partner.isOnline && <span className="online-dot"></span>}
              </div>

              <div className="conversation-info">
                <div className="conversation-top">
                  <span className="user-name">{conv.partner.name}</span>
                  <span className="chat-time">{formatChatTime(conv.lastMessage?.createdAt)}</span>
                </div>
                <p className={`last-message ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                  {conv.lastMessage
                    ? `${conv.lastMessage.senderId === myId ? 'Bạn: ' : ''}${conv.lastMessage.content}`
                    : 'Hãy gửi lời chào đầu tiên 👋'}
                </p>
              </div>

              {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className={`chat-main ${!selectedId ? 'mobile-hidden' : ''}`}>
        {activeConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-header-user">
                <button className="btn-back" onClick={() => openConversation(null)} aria-label="Quay lại">
                  <ArrowLeft size={20} />
                </button>
                <Avatar user={activeConversation.partner} size={40} />
                <div>
                  <div className="chat-header-name">{activeConversation.partner.name}</div>
                  <div className={`chat-header-status ${activeConversation.partner.isOnline ? 'online' : ''}`}>
                    {partnerStatusText(activeConversation.partner)}
                  </div>
                </div>
              </div>

              {/* TODO: modal gửi Report */}
              <button
                onClick={() => alert(`Mở modal báo cáo người dùng: ${activeConversation.partner.name}`)}
                className="text-xs text-red-500 hover:underline border border-red-200 px-2 py-1 rounded"
              >
                Báo cáo
              </button>
            </div>

            {error && (
              <div className="chat-error-banner" onClick={dismissError}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="chat-messages-body">
              {!messages ? (
                <p className="chat-empty-text">Đang tải tin nhắn...</p>
              ) : messages.length === 0 ? (
                <p className="chat-empty-text">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
              ) : (
                messages.map((msg) => {
                  const mine = msg.senderId === myId;
                  return (
                    <div key={msg.id} className={`message-row ${mine ? 'me' : 'other'}`}>
                      <div className={`message-bubble ${msg.status || ''}`}>
                        <div className="message-content">{msg.content}</div>
                        <span className="message-time-text">
                          {msg.status === 'sending' ? 'Đang gửi...' : formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                      {msg.status === 'failed' && (
                        <button className="message-retry" onClick={() => retryMessage(msg)}>
                          <RotateCw size={12} /> Gửi lỗi, thử lại
                        </button>
                      )}
                      {msg.id === lastSeenId && <span className="message-seen">Đã xem</span>}
                    </div>
                  );
                })
              )}
              {isPartnerTyping && (
                <div className="message-row other">
                  <div className="message-bubble typing-bubble">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="chat-footer">
              <input
                ref={inputRef}
                type="text"
                placeholder={isClosed ? 'Cuộc trò chuyện đã đóng' : 'Nhập tin nhắn...'}
                className="chat-input"
                value={inputMessage}
                maxLength={2000}
                disabled={isClosed}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  setTyping(e.target.value.length > 0);
                }}
                onKeyDown={handleKeyDown}
              />
              <button
                className="btn-send"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isClosed}
                aria-label="Gửi"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Chọn một cuộc hội thoại từ danh sách bên trái để bắt đầu chat
          </div>
        )}
      </div>
    </div>
  );
}
