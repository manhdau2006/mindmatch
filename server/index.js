import 'dotenv/config'; // phải đứng đầu để các module khác đọc được biến môi trường
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { socketAuth, AUTH_MODE } from './src/auth.js';
import { joinRooms, registerChatHandlers } from './src/chat.js';
import { conversationRoutes } from './src/routes/conversations.js';
import { bookingRoutes } from './src/routes/bookings.js';
import { stripeWebhook } from './src/payments.js';
import { expireHolds } from './src/bookingService.js';

const PORT = process.env.PORT || 5000;
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : '*';

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '100kb' }), stripeWebhook);
app.use(express.json({ limit: '100kb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGINS } });

io.use(socketAuth);
io.use(joinRooms);
registerChatHandlers(io);

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.use('/api/conversations', conversationRoutes(io));
app.use('/api/bookings', bookingRoutes(io));
const expiryWorker = setInterval(() => expireHolds().catch(error => console.error('Expiry worker', error.message)), 15000);
expiryWorker.unref();

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || (err.code === 'P2002' ? 409 : 500)).json({ error: err.status ? err.message : 'Lỗi server' });
});

// 0.0.0.0 để điện thoại / máy ảo Android trong cùng mạng gọi được
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT} (AUTH_MODE=${AUTH_MODE})`);
});
