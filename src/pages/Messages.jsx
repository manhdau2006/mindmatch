import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { MessageSquare } from 'lucide-react';

export default function Messages() {
  return (
    <PagePlaceholder
      title="Trang Tin nhắn & Trò chuyện (Messages)"
      route="/messages"
      icon={MessageSquare}
      description="Hệ thống nhắn tin thời gian thực giữa Mentor và Mentee, hỗ trợ trao đổi tài liệu, đặt câu hỏi nhanh và chuẩn bị trước cho các buổi hẹn."
      features={[
        'Danh sách hội thoại gần đây kèm trạng thái online/offline',
        'Chat thời gian thực (Realtime Chat) tích hợp Firebase Realtime Database / Firestore',
        'Gửi tệp đính kèm, ảnh chụp màn hình và đoạn mã (Code Snippets)',
        'Thông báo tin nhắn chưa đọc và lịch sử tin nhắn lưu trữ an toàn'
      ]}
    />
  );
}
