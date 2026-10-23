import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { CalendarDays } from 'lucide-react';

export default function Sessions() {
  return (
    <PagePlaceholder
      title="Trang Quản lý Phiên hướng dẫn (Sessions)"
      route="/sessions"
      icon={CalendarDays}
      description="Quản lý toàn diện các buổi hẹn hướng dẫn (Upcoming, Completed, Cancelled). Cho phép đặt lịch mới, xác nhận buổi hẹn, hủy lịch hoặc đánh giá sau buổi học."
      features={[
        'Tab phân loại: Sắp diễn ra (Upcoming), Đã hoàn thành (Past), Chờ xác nhận (Pending)',
        'Chi tiết buổi hẹn: Thời gian, link họp (Google Meet/Zoom), mục tiêu trao đổi',
        'Nút xác nhận hoặc dời lịch linh hoạt',
        'Hệ thống đánh giá sao và viết cảm nhận (Review & Rating)'
      ]}
    />
  );
}
