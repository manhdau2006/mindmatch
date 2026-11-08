// Mặc định: cùng hostname với trang web, cổng 5000 (mở bằng IP LAN trên điện thoại vẫn đúng)
export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

export async function apiFetch(path, { auth, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.userId) headers['x-user-id'] = String(auth.userId);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Lỗi ${res.status}`);
  return data;
}

const pad = (n) => String(n).padStart(2, '0');

export function formatMessageTime(iso) {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "14:20" | "Hôm qua" | "T3" | "08/11"
export function formatChatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (diffDays === 0) return formatMessageTime(iso);
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}
