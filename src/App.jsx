import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Compass,
  X,
  ExternalLink,
  Home,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers
} from 'lucide-react';

// Import đồng loạt 16 trang từ thư mục src/pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import Onboarding from './pages/Onboarding';
import MenteePreferences from './pages/MenteePreferences';
import Availability from './pages/Availability';
import Dashboard from './pages/Dashboard';
import Matcher from './pages/Matcher';
import MyMentees from './pages/MyMentees';
import Sessions from './pages/Sessions';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Resources from './pages/Resources';
import Settings from './pages/Settings';
import Help from './pages/Help';

// Danh mục định tuyến hệ thống để test nhanh
const APP_ROUTES = [
  { path: '/', label: 'Landing Page', name: 'Trang chủ giới thiệu', group: 'Public' },
  { path: '/login', label: 'Login / Register', name: 'Đăng nhập & Đăng ký', group: 'Auth' },
  { path: '/verify-email', label: 'Email Verification', name: 'Xác thực Email', group: 'Auth' },
  { path: '/onboarding', label: 'Onboarding', name: 'Khởi tạo hồ sơ', group: 'Onboarding' },
  { path: '/preferences', label: 'Mentee Preferences', name: 'Nguyện vọng Mentee', group: 'Onboarding' },
  { path: '/availability', label: 'Mentor Availability', name: 'Cài đặt lịch rảnh', group: 'Matching' },
  { path: '/dashboard', label: 'Dashboard', name: 'Bảng điều khiển chính', group: 'Core' },
  { path: '/matcher', label: 'Smart Matcher', name: 'Ghép đôi Mentor/Mentee', group: 'Matching' },
  { path: '/my-mentees', label: 'My Mentees', name: 'Quản lý học viên', group: 'Mentoring' },
  { path: '/sessions', label: 'Sessions', name: 'Quản lý phiên hướng dẫn', group: 'Mentoring' },
  { path: '/messages', label: 'Messages', name: 'Tin nhắn thời gian thực', group: 'Communication' },
  { path: '/notifications', label: 'Notifications', name: 'Thông báo hệ thống', group: 'Communication' },
  { path: '/profile', label: 'Profile', name: 'Hồ sơ người dùng', group: 'Account' },
  { path: '/resources', label: 'Resources', name: 'Thư viện tài nguyên', group: 'Content' },
  { path: '/settings', label: 'Settings', name: 'Cài đặt bảo mật & tùy chọn', group: 'Account' },
  { path: '/help', label: 'Help & FAQ', name: 'Trợ giúp & Hỗ trợ', group: 'Support' },
];

// Component hiển thị khi không tìm thấy trang (404 Not Found)
function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-5">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Lỗi 404
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-3 mb-2">Trang không tồn tại</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Đường dẫn bạn đang truy cập không khớp với bất kỳ trang nào trong hệ thống Mindmatch.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-sm"
        >
          <Home className="w-4 h-4" />
          <span>Quay lại Trang chủ</span>
        </Link>
      </div>
    </div>
  );
}

// Floating Quick Navigation Menu để chuyển đổi nhanh giữa 16 trang
function QuickNavWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Menu popup */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold">Quick Navigator (16 Pages)</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Đóng menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
            <span>Đang ở: <strong className="text-indigo-600 font-mono">{location.pathname}</strong></span>
            <span className="text-slate-400">{APP_ROUTES.length} routes</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {APP_ROUTES.map((route) => {
              const isActive = location.pathname === route.path;
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-100'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium flex items-center gap-1.5">
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                      {route.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{route.path}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                    {route.group}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Nút bấm bật/tắt Floating Menu */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-lg hover:shadow-xl transition-all border border-slate-700 group"
        title="Nhấn để mở thanh chuyển trang nhanh"
      >
        <Compass className={`w-4 h-4 text-indigo-400 transition-transform ${isOpen ? 'rotate-90' : 'group-hover:rotate-45'}`} />
        <span>Menu 16 Trang</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      {/* Định tuyến tập trung toàn bộ 16 trang của hệ thống Mindmatch */}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/preferences" element={<MenteePreferences />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/matcher" element={<Matcher />} />
        <Route path="/my-mentees" element={<MyMentees />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        
        {/* Route fallback cho các đường dẫn không hợp lệ */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Thanh Quick Navigation hỗ trợ developer test nhanh các trang */}
      <QuickNavWidget />
    </>
  );
}
