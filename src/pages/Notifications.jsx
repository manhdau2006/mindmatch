import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { Bell } from 'lucide-react';

export default function Notifications() {
  return (
    <PagePlaceholder
      title="Trang Thông báo Hệ thống (Notifications)"
      route="/notifications"
      icon={Bell}
      description="Trung tâm tổng hợp mọi thông báo quan trọng: lời mời kết nối mới, nhắc nhở trước giờ hẹn, phản hồi đánh giá và cập nhật từ ban quản trị Mindmatch."
      features={[
        'Phân loại thông báo: Lịch hẹn (Sessions), Tin nhắn (Messages), Hệ thống (System)',
        'Đánh dấu đã đọc tất cả hoặc xóa thông báo',
        'Cài đặt nhận thông báo qua email hoặc push notification trên trình duyệt',
        'Chuyển hướng trực tiếp đến nội dung liên quan khi click'
      ]}
    />
  );
}
