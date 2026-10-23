import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { UserCheck } from 'lucide-react';

export default function Onboarding() {
  return (
    <PagePlaceholder
      title="Trang Khởi tạo Hồ sơ (Onboarding)"
      route="/onboarding"
      icon={UserCheck}
      description="Quy trình từng bước (Step-by-step wizard) giúp người dùng mới thiết lập thông tin ban đầu: ảnh đại diện, danh xưng, kinh nghiệm làm việc và định hướng chuyên môn."
      features={[
        'Lựa chọn vai trò chính xác (Mentor hướng dẫn hoặc Mentee học viên)',
        'Nhập tóm tắt tiểu sử (Bio), mục tiêu nghề nghiệp và liên kết LinkedIn',
        'Tải lên ảnh đại diện hoặc chọn avatar hoạt họa mẫu',
        'Lưu trực tiếp vào Firestore collection users'
      ]}
    />
  );
}
