import React from 'react';
import PagePlaceholder from '../components/PagePlaceholder';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <PagePlaceholder
      title="Trang Cài đặt Hệ thống (Settings)"
      route="/settings"
      icon={SettingsIcon}
      description="Quản lý cài đặt tài khoản bảo mật, tùy chỉnh thông báo, thay đổi mật khẩu, quản lý phiên đăng nhập và các thiết lập hiển thị cá nhân hóa."
      features={[
        'Đổi mật khẩu và kích hoạt xác thực 2 bước (2FA)',
        'Cài đặt quyền riêng tư và hiển thị hồ sơ với cộng đồng',
        'Cấu hình nhận thông báo qua Email / SMS / Trình duyệt',
        'Tùy chọn xóa tài khoản và xuất dữ liệu cá nhân (GDPR compliance)'
      ]}
    />
  );
}
