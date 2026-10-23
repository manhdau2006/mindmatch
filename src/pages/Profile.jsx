import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { UserCheck2 } from 'lucide-react';

export default function Profile() {
  return (
    <PagePlaceholder
      title="Trang Hồ sơ Cá nhân (Profile)"
      route="/profile"
      icon={UserCheck2}
      description="Xem và chỉnh sửa hồ sơ chi tiết của người dùng: thông tin cá nhân, ảnh đại diện, danh sách kỹ năng chuyên môn, kinh nghiệm công tác, liên kết mạng xã hội và đánh giá."
      features={[
        'Xem trước hồ sơ ở góc nhìn công khai (Public View)',
        'Biểu mẫu chỉnh sửa thông tin cá nhân và cập nhật Bio',
        'Quản lý kỹ năng với tính năng thêm/xóa tag động',
        'Tổng hợp đánh giá (Reviews) và điểm trung bình từ các học viên'
      ]}
    />
  );
}
