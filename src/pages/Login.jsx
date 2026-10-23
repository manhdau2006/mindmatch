import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { LogIn } from 'lucide-react';

export default function Login() {
  return (
    <PagePlaceholder
      title="Trang Đăng nhập & Đăng ký (Login / Auth)"
      route="/login"
      icon={LogIn}
      description="Cung cấp biểu mẫu xác thực người dùng qua Email/Mật khẩu hoặc các nhà cung cấp xã hội (Google OAuth), đồng thời hỗ trợ chuyển đổi giữa đăng nhập và đăng ký tài khoản mới."
      features={[
        'Đăng nhập qua Email/Mật khẩu với Firebase Authentication',
        'Đăng nhập nhanh 1 chạm bằng Google Account',
        'Biểu mẫu đăng ký kèm chọn vai trò Mentor / Mentee',
        'Chức năng quên mật khẩu và đặt lại mật khẩu an toàn'
      ]}
    />
  );
}
