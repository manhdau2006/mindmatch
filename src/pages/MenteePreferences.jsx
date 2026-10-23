import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { Sliders } from 'lucide-react';

export default function MenteePreferences() {
  return (
    <PagePlaceholder
      title="Trang Thiết lập Nguyện vọng Mentee (Mentee Preferences)"
      route="/preferences"
      icon={Sliders}
      description="Cho phép Mentee lựa chọn chi tiết các tiêu chí mong muốn khi tìm kiếm Mentor: chuyên ngành kỹ thuật, mức độ kinh nghiệm, ngôn ngữ giao tiếp và hình thức học tập."
      features={[
        'Chọn lĩnh vực trọng tâm (Frontend, Backend, AI/ML, UI/UX, Product)',
        'Mức độ kinh nghiệm mong muốn ở Mentor (Senior, Lead, Principal)',
        'Kỳ vọng về tần suất gặp mặt (hàng tuần, 2 tuần/lần)',
        'Bộ trọng số ưu tiên phục vụ thuật toán gợi ý ghép đôi (Smart Matching)'
      ]}
    />
  );
}
