import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { MailCheck } from 'lucide-react';

export default function EmailVerification() {
  return (
    <PagePlaceholder
      title="Trang Xác thực Email (Email Verification)"
      route="/verify-email"
      icon={MailCheck}
      description="Yêu cầu người dùng xác minh địa chỉ email sau khi đăng ký để kích hoạt đầy đủ quyền hạn trong hệ thống và chống tài khoản rác."
      features={[
        'Kiểm tra trạng thái emailVerified từ Firebase Auth',
        'Nút gửi lại email xác thực (Resend verification link)',
        'Tự động kiểm tra và chuyển hướng khi email đã được xác minh',
        'Cung cấp thông tin hỗ trợ nếu không nhận được email'
      ]}
    />
  );
}
