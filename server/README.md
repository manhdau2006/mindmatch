# MindMatch – Backend

Backend chung của cả nhóm: **Express** (REST API) + **Socket.io** (chat realtime) + **PostgreSQL** (qua **Prisma**).

## 1. Cần cài

- [Node.js](https://nodejs.org/) 20 trở lên
- PostgreSQL — chọn 1 trong 2:
  - **Cài thật:** tải [PostgreSQL cho Windows](https://www.postgresql.org/download/windows/), tạo database tên `mindmatch`.
  - **Không muốn cài:** chạy `npx prisma dev` trong thư mục `server`. Nó in ra mấy đường link, lấy dòng **TCP**.

## 2. Chạy lần đầu

```bash
cd server
npm install
```

Copy file `.env.example` thành `.env`, rồi sửa dòng `DATABASE_URL`:

- Postgres cài thật: `postgresql://postgres:<mật khẩu>@localhost:5432/mindmatch`
- `npx prisma dev`: dán dòng TCP, thêm `&connection_limit=1&pgbouncer=true` vào cuối

Tạo bảng, thêm dữ liệu mẫu, chạy server:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Server chạy ở `http://localhost:5000`. Mở `http://localhost:5000/api/health` thấy `{"status":"OK"}` là được.

## 3. Thử chat

Ở thư mục gốc chạy `npm run dev` (web ở cổng 3000), mở 2 tab:

- `http://localhost:3000/messages?as=1` — học sinh Nguyễn Văn An
- `http://localhost:3000/messages?as=2` — gia sư Hoàng Tuấn

Gõ ở tab này, tab kia nhận ngay.

> `?as=<id>` là cách giả làm user khi chưa có đăng nhập. Khi phần Đăng nhập xong sẽ bỏ.

## 4. Các lệnh hay dùng

| Lệnh | Làm gì |
|---|---|
| `npm run dev` | Chạy server, tự khởi động lại khi sửa code |
| `npm run db:migrate -- --name <ten>` | Áp dụng thay đổi trong `schema.prisma` vào DB |
| `npm run db:seed` | Thêm dữ liệu mẫu (chạy lại nhiều lần không bị trùng) |
| `npm run db:studio` | Mở giao diện web để xem/sửa dữ liệu |
| `npx prisma migrate reset` | Xoá sạch DB, tạo lại bảng + dữ liệu mẫu |

## 5. Thêm phần của bạn vào backend

1. **Bảng:** thêm model vào `prisma/schema.prisma`, chạy `npm run db:migrate -- --name <ten>`, commit cả thư mục `prisma/migrations`.
2. **API:** tạo file mới trong `src/routes/` (xem `conversations.js` làm mẫu), gắn vào `index.js`:
   ```js
   app.use('/api/bookings', bookingRoutes(io));
   ```
3. **Biết ai đang gọi API:** thêm `router.use(requireAuth)`, sau đó dùng `req.userId` / `req.user`.

## 6. Cấu trúc thư mục

```text
server/
├── index.js                  Khởi động server
├── prisma/
│   ├── schema.prisma         Thiết kế các bảng (cả nhóm dùng chung)
│   ├── migrations/           Lịch sử thay đổi bảng (Prisma tự sinh, phải commit)
│   └── seed.js               Dữ liệu mẫu
└── src/
    ├── auth.js               Xác định user đang gọi, chặn tài khoản bị ban
    ├── db.js                 Kết nối database
    ├── store.js              Truy vấn dữ liệu chat
    ├── chat.js               Sự kiện Socket.io của chat
    ├── presence.js           Theo dõi ai đang online
    ├── views.js              Định dạng dữ liệu trả về
    └── routes/
        └── conversations.js  API chat
```

## 7. API chat

Mỗi request gửi kèm header `x-user-id: <id>` (khi test) hoặc `Authorization: Bearer <token>` (khi có đăng nhập).

| Method | Đường dẫn | Làm gì |
|---|---|---|
| GET | `/api/conversations` | Danh sách hội thoại của tôi |
| POST | `/api/conversations` | Tạo hội thoại khi Match. Body: `{ "studentId": 1, "tutorId": 2 }` |
| GET | `/api/conversations/:id/messages` | Lịch sử tin nhắn (`?limit=50&before=<id tin>` để tải tin cũ hơn) |
| POST | `/api/conversations/:id/messages` | Gửi tin. Body: `{ "content": "..." }` |
| POST | `/api/conversations/:id/read` | Đánh dấu đã đọc |
| PATCH | `/api/conversations/:id/close` | Đóng hội thoại |

## 8. Sự kiện Socket.io

Kết nối: `io('http://localhost:5000', { auth: { userId: 1 } })`. Server tự cho bạn vào mọi phòng chat của mình.

| Hướng | Tên sự kiện | Dữ liệu |
|---|---|---|
| Gửi lên | `send_message` | `{ conversationId, content, clientId }` — server trả lời `{ ok, message }` hoặc `{ ok: false, error }` |
| Gửi lên | `mark_read` | `{ conversationId }` |
| Gửi lên | `typing` | `{ conversationId, isTyping }` |
| Nhận về | `receive_message` | Tin nhắn mới |
| Nhận về | `messages_read` | `{ conversationId, readerId, messageIds }` |
| Nhận về | `typing` | `{ conversationId, userId, isTyping }` |
| Nhận về | `presence` | `{ userId, isOnline, lastActiveAt }` |
| Nhận về | `conversation_created`, `conversation_closed` | Hội thoại mới / bị đóng |

## Lỗi hay gặp

- **`Can't reach database server`** — Postgres chưa chạy. Bật Postgres, hoặc chạy lại `npx prisma dev`.
- **`prepared statement "s0" already exists`** — đang dùng `prisma dev` mà thiếu `&pgbouncer=true` trong `DATABASE_URL`.
- **Web báo "Không kết nối được server chat"** — backend chưa chạy, hoặc chạy sai cổng (phải là 5000).
- **`Tài khoản không tồn tại`** — id trong `?as=` không có trong DB. Chạy `npm run db:seed`.
