import { getUser, toId } from './store.js';

// dev: client gửi thẳng userId (header `x-user-id` / socket auth `{ userId }`) để test.
// token: bắt buộc gửi token đăng nhập -> cần cài verifyToken() khi phần Đăng nhập xong.
export const AUTH_MODE = process.env.AUTH_MODE || 'dev';

async function verifyToken(token) {
  // TODO: giải mã JWT của phần Đăng nhập, vd: return jwt.verify(token, process.env.JWT_SECRET).sub;
  void token;
  throw new Error('Chưa cài đặt xác thực token');
}

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

async function resolveUser({ token, devUserId }) {
  let rawId;
  if (AUTH_MODE === 'token' || !devUserId) {
    if (!token) throw new AuthError('Chưa đăng nhập');
    rawId = await verifyToken(token);
  } else {
    rawId = devUserId;
  }

  const id = toId(rawId);
  const user = id && (await getUser(id));
  if (!user) throw new AuthError('Tài khoản không tồn tại');
  if (user.isBanned) throw new AuthError('Tài khoản đã bị khoá', 403);
  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    req.user = await resolveUser({ token, devUserId: req.headers['x-user-id'] });
    req.userId = req.user.id;
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
}

export async function socketAuth(socket, next) {
  try {
    const { token, userId } = socket.handshake.auth || {};
    socket.data.user = await resolveUser({ token, devUserId: userId });
    socket.data.userId = socket.data.user.id;
    next();
  } catch (err) {
    next(new Error(err.message));
  }
}
