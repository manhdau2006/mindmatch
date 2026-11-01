import React, { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import './Messages.css';

// Mock data
const MOCK_CONVERSATIONS = [
  {
    id: 1,
    name: 'Thầy Hoàng Tuấn',
    role: 'Gia sư Toán cao cấp',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    lastMessage: 'Hẹn em 19h tối mai học qua Zoom nhé!',
    time: '14:20',
    unreadCount: 2,
    isOnline: true,
  },
  {
    id: 2,
    name: 'Cô Mai Linh',
    role: 'Gia sư Tiếng Anh (IELTS)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
    lastMessage: 'Bài tập Writing Task 2 cô đã sửa xong rồi nha.',
    time: 'Hôm qua',
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: 3,
    name: 'Anh Minh Đức',
    role: 'Gia sư Lập trình Python',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
    lastMessage: 'Em nhớ cài sẵn thư viện numpy với pandas.',
    time: '2 ngày trước',
    unreadCount: 0,
    isOnline: true,
  },
];

const MOCK_MESSAGES = [
  { id: 1, conversationId: 1, senderId: 2, text: 'Chào em, tối mai 19h học được không?', time: '14:15' },
  { id: 2, conversationId: 1, senderId: 'me', text: 'Dạ được ạ, em chuẩn bị sẵn bài tập rồi thầy.', time: '14:18' },
  { id: 3, conversationId: 1, senderId: 2, text: 'Hẹn em 19h tối mai học qua Zoom nhé!', time: '14:20' },

  { id: 4, conversationId: 2, senderId: 'me', text: 'Cô ơi cô xem bài luận giúp em chưa ạ?', time: 'Hôm qua' },
  { id: 5, conversationId: 2, senderId: 2, text: 'Bài tập Writing Task 2 cô đã sửa xong rồi nha.', time: 'Hôm qua' },
];
//End Mock data

export default function Messages() {
  const [selectedId, setSelectedId] = useState(null);

  const activeChat = MOCK_CONVERSATIONS.find((c) => c.id === selectedId);

  const chatMessages = MOCK_MESSAGES.filter((m) => m.conversationId === selectedId);

  return (
    <div className="chat-container">
      {/*Conversation bar*/}
      <div className={`chat-sidebar ${selectedId ? 'mobile-hidden' : ''}`}>
        <div className="chat-sidebar-header">Đoạn chat</div>

        <div className="conversation-list">
          {MOCK_CONVERSATIONS.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
            >
              <div className="avatar-box">
                <img src={conv.avatar} alt={conv.name} className="avatar-img" />
                {conv.isOnline && <span className="online-dot"></span>}
              </div>

              <div className="conversation-info">
                <div className="conversation-top">
                  <span className="user-name">{conv.name}</span>
                  <span className="chat-time">{conv.time}</span>
                </div>
                <p className="last-message">{conv.lastMessage}</p>
              </div>

              {conv.unreadCount > 0 && (
                <span className="unread-badge">{conv.unreadCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversation in details */}
      <div className={`chat-main ${!selectedId ? 'mobile-hidden' : ''}`}>
        {activeChat ? (
          <>
            {/* Header chat */}
            <div className="chat-header">
              <div className="chat-header-user">
                {/* Buttonback */}
                <button className="btn-back" onClick={() => setSelectedId(null)}>
                  <ArrowLeft size={20} />
                </button>
                <img src={activeChat.avatar} alt={activeChat.name} className="avatar-img" />
                <div>
                  <div className="chat-header-name">{activeChat.name}</div>
                  <div className="chat-header-status">
                    {activeChat.isOnline ? 'Đang hoạt động' : 'Không trực tuyến'}
                  </div>
                </div>
              </div>

              {/* Report button */}
              <button
                onClick={() => alert(`Mở modal báo cáo người dùng: ${activeChat.name}`)}
                className="text-xs text-red-500 hover:underline border border-red-200 px-2 py-1 rounded"
              >
                Báo cáo
              </button>
            </div>

            {/* Messages */}
            <div className="chat-messages-body">
              {chatMessages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 mt-6">
                  Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-row ${msg.senderId === 'me' ? 'me' : 'other'}`}
                  >
                    <div className="message-bubble">
                      <div>{msg.text}</div>
                      <span className="message-time-text">{msg.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/*Where to send message*/}
            <div className="chat-footer">
              <input
                type="text"
                placeholder="Nhập tin nhắn..."
                className="chat-input"
              />
              <button className="btn-send">
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          /* For desktop: Khi chưa chọn ai */
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Chọn một cuộc hội thoại từ danh sách bên trái để bắt đầu chat
          </div>
        )}
      </div>
    </div>
  );
}