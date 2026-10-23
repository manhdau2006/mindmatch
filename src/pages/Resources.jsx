import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { BookOpen } from 'lucide-react';

export default function Resources() {
  return (
    <PagePlaceholder
      title="Trang Thư viện Tài nguyên (Resources)"
      route="/resources"
      icon={BookOpen}
      description="Kho tài liệu hữu ích phục vụ cho cả Mentor và Mentee: giáo trình hướng dẫn, cẩm nang phỏng vấn, template lộ trình nghề nghiệp và các bài viết chia sẻ kinh nghiệm thực chiến."
      features={[
        'Kho tài liệu được phân loại theo chuyên đề (Frontend, Backend, DevOps, Career)',
        'Tải về các mẫu CV, Checklist chuẩn bị phỏng vấn, Roadmap phát triển',
        'Tính năng đóng góp tài liệu từ các Mentor uy tín',
        'Tìm kiếm và đánh dấu bài viết yêu thích (Bookmarks)'
      ]}
    />
  );
}
