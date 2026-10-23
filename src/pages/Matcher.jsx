import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { Users2 } from 'lucide-react';

export default function Matcher() {
  return (
    <PagePlaceholder
      title="Trang Ghép đôi & Khám phá (Matcher)"
      route="/matcher"
      icon={Users2}
      description="Không gian tìm kiếm và kết nối thông minh giữa Mentor và Mentee. Cung cấp bộ lọc đa chiều theo kỹ năng, kinh nghiệm, ngôn ngữ và độ tương thích nguyện vọng."
      features={[
        'Hiển thị danh sách card hồ sơ Mentor / Mentee trực quan',
        'Bộ lọc nâng cao theo kỹ năng (Tags), số năm kinh nghiệm, đánh giá sao',
        'Chỉ số độ tương thích (% Match Score) tính toán tự động',
        'Gửi lời mời kết nối (Send Connection Request) kèm tin nhắn giới thiệu'
      ]}
    />
  );
}
