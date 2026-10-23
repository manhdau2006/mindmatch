import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { HelpCircle } from 'lucide-react';

export default function Help() {
  return (
    <PagePlaceholder
      title="Trang Trợ giúp & Hỗ trợ (Help & FAQ)"
      route="/help"
      icon={HelpCircle}
      description="Trung tâm giải đáp thắc mắc, câu hỏi thường gặp (FAQ), hướng dẫn sử dụng các tính năng trên Mindmatch và kênh liên hệ trực tiếp với đội ngũ phát triển."
      features={[
        'Bộ câu hỏi thường gặp (FAQ) cho cả Mentor và Mentee',
        'Cẩm nang hướng dẫn cách đặt lịch và sử dụng phòng họp trực tuyến',
        'Biểu mẫu gửi yêu cầu hỗ trợ (Support Ticket)',
        'Quy tắc ứng xử cộng đồng (Community Guidelines) và chính sách bảo mật'
      ]}
    />
  );
}
