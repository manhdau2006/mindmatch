import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  return (
    <PagePlaceholder
      title="Bảng điều khiển trung tâm (Dashboard)"
      route="/dashboard"
      icon={LayoutDashboard}
      description="Trung tâm điều khiển cá nhân hóa hiển thị lịch hẹn sắp diễn ra, tiến độ mục tiêu, tin nhắn mới nhất, thông báo và các chỉ số hoạt động tổng thể của người dùng."
      features={[
        'Thống kê tổng quan (Tổng số buổi đã học/dạy, giờ tích lũy, số kết nối)',
        'Widget lịch hẹn sắp tới kèm nút tham gia phòng họp trực tuyến',
        'Lối tắt nhanh đến trang Matcher, Sessions, Messages',
        'Gợi ý Mentor hoặc Mentee phù hợp dựa trên thuật toán AI'
      ]}
    />
  );
}
