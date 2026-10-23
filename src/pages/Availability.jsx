import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { CalendarClock } from 'lucide-react';

export default function Availability() {
  return (
    <PagePlaceholder
      title="Trang Quản lý Lịch rảnh (Availability)"
      route="/availability"
      icon={CalendarClock}
      description="Dành riêng cho Mentor để cài đặt các khung giờ rảnh cố định trong tuần hoặc tạo các khung thời gian linh hoạt (time slots) cho phép Mentee đặt lịch tư vấn."
      features={[
        'Cài đặt thời gian biểu hàng tuần (thứ 2 đến chủ nhật)',
        'Quy định thời lượng cho mỗi phiên (30 phút, 45 phút, 60 phút)',
        'Khóa các ngày nghỉ hoặc bận đột xuất',
        'Đồng bộ với Google Calendar hoặc hệ thống lịch thông báo'
      ]}
    />
  );
}
