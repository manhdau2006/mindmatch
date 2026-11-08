// Đếm số socket mỗi user (1 người có thể mở nhiều tab / thiết bị)
const socketCount = new Map();

// true nếu user vừa chuyển offline -> online
export function markOnline(userId) {
  const count = (socketCount.get(userId) || 0) + 1;
  socketCount.set(userId, count);
  return count === 1;
}

// true nếu user vừa chuyển online -> offline
export function markOffline(userId) {
  const count = (socketCount.get(userId) || 1) - 1;
  if (count > 0) {
    socketCount.set(userId, count);
    return false;
  }
  socketCount.delete(userId);
  return true;
}

export const isOnline = (userId) => socketCount.has(userId);
