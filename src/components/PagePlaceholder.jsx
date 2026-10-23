import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Construction } from 'lucide-react';

export default function PagePlaceholder({
  title,
  route,
  icon: Icon = Construction,
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header tối giản */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Mindmatch
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {route}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Quay lại Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Nội dung Placeholder chính */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex-grow flex items-center justify-center w-full">
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-10 sm:p-14 text-center">
          {/* Icon nhận diện trang */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
            <Icon className="w-8 h-8" />
          </div>

          {/* Dòng tiêu đề duy nhất */}
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {title} đang được phát triển
          </h1>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Mindmatch. Project Nhập môn công nghệ phần mềm.</p>
      </footer>
    </div>
  );
}
