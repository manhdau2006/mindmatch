import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { GraduationCap } from 'lucide-react';

export default function MyMentees() {
  return (
    <PagePlaceholder
      title="Trang Quản lý Mentee của tôi (My Mentees)"
      route="/my-mentees"
      icon={GraduationCap}
      description="Khu vực dành cho Mentor theo dõi danh sách các học viên đang hướng dẫn, lịch sử các buổi mentoring, ghi chú tiến độ học tập và mục tiêu đã hoàn thành."
      features={[
        'Danh sách Mentee đang đồng hành cùng trạng thái tiến trình',
        'Quản lý ghi chú riêng tư cho từng học viên (Mentoring Notes)',
        'Theo dõi tiến độ hoàn thành mục tiêu ngắn hạn và dài hạn',
        'Tùy chọn kết thúc hướng dẫn hoặc gửi feedback đánh giá'
      ]}
    />
  );
}
