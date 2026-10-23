import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { Home } from 'lucide-react';

export default function Landing() {
  return (
    <PagePlaceholder
      title="Trang chủ giới thiệu (Landing Page)"
      route="/"
      icon={Home}
      description="Trang giới thiệu tổng quan về nền tảng Mindmatch, giải pháp kết nối Mentor và Mentee, số liệu nổi bật, feedback và nút kêu gọi hành động (CTA) đăng ký tham gia."
      features={[
        'Hero section giới thiệu sứ mệnh Mindmatch và nút đăng ký/đăng nhập',
        'Thống kê số lượng Mentor và phiên hướng dẫn thành công',
        'Danh sách Mentor tiêu biểu và đánh giá từ cộng đồng',
        'Các gói định hướng nghề nghiệp và lộ trình mentoring'
      ]}
    />
  );
}
