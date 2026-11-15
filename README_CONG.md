# Module 4 – Đặt lịch & Thanh toán

Người phụ trách **Công**, đồ án MindMatch, môn Nhập môn Công nghệ phần mềm. Module dùng React/Vite ở frontend và Express/Prisma/PostgreSQL ở backend. Nền backend và chat của nhóm được tích hợp từ `origin/plinh`. Nhánh triển khai hiện tại là `feature/cong-recurring-booking-payment`.

## Nghiệp vụ đã triển khai

1. Phụ huynh hoặc học viên dùng role `student`, chọn gia sư đã Match và lịch học định kỳ thuộc lịch rảnh của gia sư.
2. Chọn thứ trong tuần, giờ học, ngày bắt đầu và ngày kết thúc tùy chọn rồi bấm **Gửi yêu cầu đặt chỗ**.
3. Hệ thống tạo Booking `pending_tutor`, hiển thị cho cả hai bên và giữ lịch trong thời hạn chờ.
4. Gia sư nhận yêu cầu xem lịch, khoản phí và chọn **Từ chối** hoặc **Thanh toán để nhận lớp**.
5. Thanh toán giả lập thành công chuyển lớp sang `confirmed`. Thất bại giữ yêu cầu chờ để gia sư thử lại. Từ chối chuyển sang `rejected` và lưu lý do nếu có.
6. Hai bên tự thỏa thuận và thanh toán học phí định kỳ ngoài MindMatch.

**Phí nhận lớp demo là 100.000đ cho một yêu cầu lớp định kỳ, do gia sư trả một lần.** Lớp học hai hoặc nhiều ngày mỗi tuần vẫn có một khoản phí cho cả yêu cầu. Admin cấu hình mức phí mới qua `PaymentConfig.acceptanceFeeVnd`. Transaction lưu mức đã áp dụng tại lúc tạo yêu cầu.

Yêu cầu giữ lịch tối đa **24 giờ**, cấu hình bằng `REQUEST_HOLD_HOURS`, và hết hạn chậm nhất khi buổi học đầu bắt đầu. Từ chối hoặc hết hạn giải phóng lịch.

## Cài đặt và chạy bằng Windows PowerShell

Mở PowerShell tại thư mục gốc repo, nơi có `package.json` và thư mục `server`. Các lệnh dùng `npm.cmd` và `npx.cmd` để chạy trong PowerShell.

### Cài dependency lần đầu

```powershell
npm.cmd ci
Set-Location server
npm.cmd ci
Set-Location ..
```

### Terminal A — PostgreSQL local

Với PostgreSQL đã cài, tạo database `mindmatch` và điền URL kết nối của database đó tại Terminal B. Phiên kiểm thử trên máy Công dùng PostgreSQL local qua Prisma Dev với lệnh sau.

```powershell
Set-Location server
$env:HOST='127.0.0.1'
npx.cmd prisma dev --name mindmatch-booking --db-port 5432 --port 51213 --shadow-db-port 5433
```

Giữ terminal này chạy. `HOST=127.0.0.1` xử lý lỗi kiểm tra cổng IPv6 `EADDRNOTAVAIL` đã gặp trên máy Windows hiện tại.

### Terminal B — backend và dữ liệu demo

Mở terminal mới tại thư mục gốc repo. URL bên dưới tương ứng với Prisma Dev tại Terminal A.

```powershell
Set-Location server
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/template1?sslmode=disable&pgbouncer=true&connection_limit=1&connect_timeout=10&pool_timeout=10&max_idle_connection_lifetime=1'
$env:AUTH_MODE='dev'
$env:PAYMENT_MODE='local'
$env:REQUEST_HOLD_HOURS='24'
$env:PORT='5000'
$env:FRONTEND_URL='http://127.0.0.1:3000'
$env:CORS_ORIGINS='http://127.0.0.1:3000'
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npm.cmd run db:seed:booking
npm.cmd start
```

Với PostgreSQL tự cài, thay `DATABASE_URL` bằng kết nối của mình, ví dụ `postgresql://postgres:MAT_KHAU@127.0.0.1:5432/mindmatch`. Các biến cũng có thể lưu trong `server/.env` theo mẫu `server/.env.example`.

Seed tạo **12 học viên, 8 gia sư, 1 Admin và 96 Match demo**. Các tài khoản được nhận diện bằng email. Seed bổ sung lịch tuần cho tài khoản chưa có lịch và in ID cùng URL từng tài khoản ra terminal. Khi chạy lại, lịch tuần đã chỉnh vẫn được giữ. Các khung giờ theo ngày phục vụ dữ liệu cũ cũng được bổ sung cho ba ngày tới.

Kiểm tra server bằng `http://127.0.0.1:5000/api/health`, kết quả mong đợi là `{"status":"OK"}`.

### Terminal C — frontend

Mở terminal mới tại thư mục gốc repo.

```powershell
$env:VITE_BOOKING_DEMO='true'
$env:VITE_API_URL='http://127.0.0.1:5000'
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 3000 --strictPort
```

Trong lúc phát triển giao diện, có thể dùng `npm.cmd run dev -- --host 127.0.0.1 --port 3000 --strictPort` với cùng hai biến môi trường. Chế độ demo dùng `?as=<User.id>` để chọn danh tính backend.

### Biến môi trường

| Vị trí | Biến | Giá trị hoặc mục đích |
|---|---|---|
| Backend | `DATABASE_URL` | PostgreSQL local, bắt buộc |
| Backend | `AUTH_MODE` | `dev` cho tài khoản demo, `token` cho Firebase ID token |
| Backend | `PAYMENT_MODE` | `local` trong cấu hình demo |
| Backend | `REQUEST_HOLD_HOURS` | Thời hạn chờ gia sư, mặc định 24 giờ, tối đa 168 giờ |
| Backend | `PORT` | `5000` |
| Backend | `CORS_ORIGINS` | Origin frontend, ví dụ `http://127.0.0.1:3000` |
| Backend | `FRONTEND_URL` | URL dùng khi seed in đường dẫn tài khoản |
| Frontend | `VITE_API_URL` | `http://127.0.0.1:5000` |
| Frontend | `VITE_BOOKING_DEMO` | `true` khi demo bằng `?as=` |
| Đăng nhập thật | `VITE_FIREBASE_*` | Các trường trong `.env.example` ở gốc repo |
| Backend xác thực thật | `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | Firebase project và đường dẫn service account |

Biến `VITE_*` được đọc lúc chạy Vite hoặc build. Sau khi thay cấu hình, khởi động lại Vite hoặc build lại. Thông tin xác thực lưu trong biến môi trường hoặc file `.env` đã được Git ignore.

## Demo theo vai trò

ID phụ thuộc database đang seed. Lấy URL chính xác từ kết quả `npm.cmd run db:seed:booking`. Các tài khoản sau có trong database của phiên bàn giao ngày 15/11/2026.

| Tài khoản | Email demo | ID trong phiên bàn giao | Đường dẫn local |
|---|---|---|---|
| Nguyễn Hoàng An, phụ huynh/học viên | `demo.an.student@mindmatch.test` | 100 | [Mở phụ huynh](http://127.0.0.1:3000/bookings?as=100) |
| Cô Thu Hà, gia sư Tiếng Anh | `demo.thuha.tutor@mindmatch.test` | 111 | [Mở gia sư](http://127.0.0.1:3000/bookings?as=111) |
| Admin demo | `booking.admin@mindmatch.test` | 12 | [Mở Admin](http://127.0.0.1:3000/bookings?as=12) |

### Gửi yêu cầu rồi nhận lớp

1. Mở tài khoản gia sư và lưu lịch rảnh Thứ Ba, Thứ Năm, 19 giờ đến 20 giờ, 2 buổi/tuần.
2. Mở tài khoản phụ huynh ở tab khác. Chọn gia sư vừa chuẩn bị, chọn Thứ Ba và Thứ Năm, 19 giờ đến 20 giờ, cùng ngày bắt đầu trong tương lai. Có thể bỏ trống ngày kết thúc để lịch tiếp tục hằng tuần.
3. Bấm **Gửi yêu cầu đặt chỗ**. Kiểm tra lịch lặp, phí 100.000đ do gia sư đóng và trạng thái chờ gia sư.
4. Ở tab gia sư, mở yêu cầu đến và chọn **Thanh toán để nhận lớp**. Thử kết quả giả lập thất bại, kiểm tra yêu cầu vẫn chờ, sau đó thử lại với kết quả thành công.
5. Cả hai tab hiển thị **Đã xác nhận**. Danh sách giao dịch ghi đúng gia sư là người trả. Thông báo cập nhật dùng Socket.IO `booking_updated` và có polling dự phòng.

Khi lịch đã bị một yêu cầu khác giữ, chọn lịch còn trống hoặc một cặp tài khoản demo khác để tạo yêu cầu mới.

### Từ chối và hết hạn

Tạo một yêu cầu ở lịch còn trống, mở đúng gia sư rồi chọn **Từ chối** và nhập lý do. Phụ huynh thấy trạng thái từ chối. Lịch được giải phóng và khoản phí chờ chuyển thành `cancelled`.

Worker kiểm tra hết hạn mỗi 15 giây. API đọc danh sách cũng xử lý hết hạn. Thanh toán mới sau hạn trả HTTP 409, yêu cầu chuyển `expired` và lịch có thể được chọn lại.

### Admin cấu hình phí

Mở tài khoản Admin để xem giao dịch, dòng tiền phí nhận lớp và người trả. Đổi mức phí thành 120.000đ, sau đó tạo yêu cầu mới để kiểm tra mức mới. Transaction của yêu cầu trước giữ số tiền đã lưu. Có thể đưa cấu hình trở lại 100.000đ sau khi demo.

### Dữ liệu đã kiểm chứng trong phiên triển khai

Cặp học viên 9 và gia sư 11 có lớp Thứ Ba, Thứ Năm, 19 giờ đến 20 giờ từ 17/11/2026, Booking `089d1ab1-ba8d-4138-81a2-d791ac729a86`. Đã thử thất bại, thanh toán lại thành công và gửi lặp. Hai tài khoản cùng thấy `confirmed`, khoản phí 100.000đ có đúng một sự kiện `paid`.

Cặp học viên 100 và gia sư 110 có một yêu cầu chờ Thứ Hai, Thứ Tư, 9 giờ đến 10 giờ từ 16/11/2026 và một yêu cầu bị từ chối. Yêu cầu chờ hết hạn lúc 9 giờ ngày 16/11/2026 theo Việt Nam. Khi chạy lại sau thời điểm này, tạo yêu cầu mới với ngày tương lai theo các bước trên.

## Lịch lặp, trạng thái và cơ sở dữ liệu

`WeeklySchedule` lưu các thứ rảnh, khoảng giờ và số buổi mỗi tuần. Booking lưu lịch học thực tế gồm các thứ lặp, khoảng giờ và ngày hiệu lực. Múi giờ là `Asia/Ho_Chi_Minh`. Các thứ được mã hóa 1 đến 7, tương ứng Thứ Hai đến Chủ nhật. Số buổi mỗi tuần của lớp là số thứ đã chọn. Mỗi ngày học có cùng khoảng giờ và kéo dài tối đa 8 giờ.

Lịch có thể kéo dài đến ngày kết thúc tùy chọn, bao gồm ngày đó. Khi bỏ trống ngày kết thúc, lịch tiếp tục hằng tuần. Backend kiểm tra giao của thứ, giờ và khoảng ngày cho toàn bộ thời gian hiệu lực.

```mermaid
stateDiagram-v2
    [*] --> pending_tutor: student.request [Match active, lịch rảnh hợp lệ, lịch trống]
    pending_tutor --> confirmed: tutor.pay_success [đúng gia sư, còn hạn, kiểm tra lại lịch]
    pending_tutor --> pending_tutor: tutor.pay_failed / ghi lần thử thất bại
    pending_tutor --> rejected: tutor.reject [đúng gia sư, còn hạn] / hủy phí chờ
    pending_tutor --> expired: clock.tick hoặc list.read [now >= expiresAt] / hủy phí chờ
    confirmed --> confirmed: gửi lại thanh toán / trả kết quả đã xác nhận
    rejected --> [*]
    expired --> [*]
```

File UML riêng phục vụ báo cáo nằm trong [docs/booking-state.mmd](docs/booking-state.mmd).

| Model hoặc trường | Nội dung |
|---|---|
| `User`, `Match` | ID hai bên, role và điều kiện Match active |
| `WeeklySchedule` | Lịch tuần của gia sư và lịch mong muốn của học viên |
| `Booking.kind` | `recurring_class` cho yêu cầu lớp định kỳ, `single_session` cho dữ liệu lịch sử |
| `Booking.recurrenceWeekdays` | Các thứ học trong tuần |
| `Booking.recurrenceStart`, `recurrenceEnd` | Ngày bắt đầu và ngày kết thúc tùy chọn |
| `Booking.startTime`, `endTime`, `timeZone` | Giờ học và múi giờ |
| `Booking.status`, `expiresAt` | Trạng thái và hạn giữ lịch |
| `Booking.confirmedAt`, `rejectionReason` | Thời điểm xác nhận và lý do từ chối |
| `Booking.slotId` | Khung giờ của dữ liệu lịch sử theo buổi |
| `Transaction.bookingId` | Unique, một khoản phí cho mỗi yêu cầu |
| `Transaction.purpose`, `payerId` | `class_acceptance` và ID gia sư nhận yêu cầu |
| `Transaction.amount`, `currency` | Mức phí tại lúc tạo yêu cầu, số nguyên VND |
| `Transaction.status`, `provider` | `pending`, `failed`, `succeeded`, `cancelled` và provider `local` |
| `Transaction.commissionBps`, `commission`, `tutorIncome` | `10000`, toàn bộ khoản phí và `0` cho giao dịch phí nhận lớp |
| `PaymentEvent` | Lưu mỗi lần thử và khóa chống gửi lại |
| `PaymentConfig.acceptanceFeeVnd` | Mức phí cho yêu cầu được tạo tiếp theo |

Các migration phải được áp dụng theo thứ tự và cùng được đưa lên Git.

| Migration bổ sung của module | Thay đổi |
|---|---|
| `20261112000000_booking_payment` | Match, slot, Booking, Transaction, cấu hình và dữ liệu tài chính nền |
| `20261115000000_weekly_schedule` | Lịch tuần dùng chung cho học viên và gia sư |
| `20261115010000_recurring_class_acceptance` | Booking định kỳ, người trả, loại phí và ràng buộc dữ liệu |

Backend khóa hàng của hai user theo cùng thứ tự ID để xử lý đồng thời. Khi gửi yêu cầu và khi nhận phí thành công, hệ thống kiểm tra Match active, đúng người gọi, lịch thuộc gia sư và xung đột của cả hai bên. Các yêu cầu chờ còn hạn giữ độc quyền lịch đã chọn. Hai yêu cầu trùng lịch đồng thời cho kết quả một HTTP 201 và một HTTP 409.

Lần thanh toán dùng `attemptId` duy nhất. Cùng khóa và cùng kết quả trả lại trạng thái hiện tại. Cùng khóa nhưng kết quả khác trả HTTP 409. Gia sư dùng khóa mới khi thử lại sau thất bại. Cập nhật Transaction, PaymentEvent và Booking diễn ra trong cùng DB transaction.

Booking và giao dịch theo buổi từ phiên trước được giữ trong lịch sử để đọc dữ liệu đã có. Migration gán người trả của giao dịch cũ từ học viên trong Match. Các file xử lý dữ liệu lịch sử, webhook và tài chính cũ được dùng cho tương thích và kiểm thử hồi quy.

## API của module

Các đường dẫn dưới đây đặt sau `/api/bookings`. Request dùng `Authorization: Bearer <Firebase ID token>` hoặc `x-user-id: <User.id>` khi chạy `AUTH_MODE=dev`.

| Method | Path | Chức năng và quyền |
|---|---|---|
| GET | `/me` | Xem danh tính backend và lịch tuần |
| GET | `/config` | Xem mức phí hiện tại và thời hạn chờ |
| GET | `/matches` | Student/Tutor xem Match active và lịch hai bên |
| GET | `/schedule` | Student/Tutor xem lịch tuần của mình |
| PUT | `/schedule` | Lưu `weekdays`, `sessionsPerWeek`, `startTime`, `endTime` |
| GET | `/` | Xem yêu cầu của mình, Admin xem toàn bộ |
| POST | `/requests` | Student gửi yêu cầu định kỳ |
| POST | `/:id/reject` | Gia sư nhận yêu cầu từ chối, `reason` tùy chọn |
| POST | `/:id/pay-acceptance` | Gia sư nhận yêu cầu trả phí giả lập |
| GET | `/finance/admin` | Admin xem giao dịch và dòng tiền |
| PATCH | `/finance/config` | Admin đổi `acceptanceFeeVnd` |

Body gửi yêu cầu lấy `matchId` từ `/matches`, chọn ngày tương lai và lịch thuộc gia sư.

```json
{
  "matchId": 117,
  "weekdays": [2, 4],
  "startTime": "19:00",
  "endTime": "20:00",
  "startDate": "2026-11-17"
}
```

Có thể thêm `endDate` với định dạng `YYYY-MM-DD`. Body thanh toán mô phỏng dùng `success` hoặc `failure`.

```json
{
  "outcome": "success",
  "attemptId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Các endpoint cũ `/hold`, `/:id/checkout`, `/:id/demo-payment` trả HTTP 410 để hướng người gọi sang luồng lớp định kỳ.

## Các file triển khai chính

| File | Vai trò |
|---|---|
| `server/prisma/schema.prisma`, `server/prisma/migrations/` | Schema và migration |
| `server/prisma/seed-booking.js` | Tài khoản, Match, lịch demo và URL đăng nhập giả lập |
| `server/src/recurrence.js` | Phép kiểm tra lịch lặp và giao với slot có ngày cụ thể |
| `server/src/recurringBookingService.js` | Gửi yêu cầu, giữ lịch, từ chối, thanh toán phí |
| `server/src/weeklySchedule.js` | Validation lịch tuần và tương thích slot |
| `server/src/bookingService.js` | Dữ liệu dùng chung, hết hạn và tương thích dữ liệu cũ |
| `server/src/routes/bookings.js` | REST API, phân quyền và cấu hình Admin |
| `server/index.js` | Đăng ký router, worker và Socket.IO |
| `src/pages/BookingPayment.jsx`, `BookingPayment.css` | Giao diện phụ huynh, gia sư và Admin |
| `src/components/WeeklySchedule.jsx` | Chọn thứ, giờ và số buổi/tuần |
| `server/test/booking.test.js`, `recurring.test.js` | Kiểm thử hồi quy và luồng lớp định kỳ |

Phần dùng chung được chỉnh ở router, xác thực và điều hướng để frontend/backend dùng cùng ID và vào được module. Các trang Match, lịch rảnh và Sessions liên kết đến trang đặt lịch. `User.firebaseUid` nối UID Firebase dạng chuỗi với `User.id` số nguyên trong PostgreSQL. Role được lấy từ database backend.

## Kiểm thử và kết quả đã chạy

Chạy trong terminal có `DATABASE_URL` như phần backend, với PostgreSQL đang hoạt động.

```powershell
Set-Location server
npx.cmd prisma validate
npx.cmd prisma migrate status
npm.cmd run test:booking
Set-Location ..
$env:VITE_BOOKING_DEMO='true'
$env:VITE_API_URL='http://127.0.0.1:5000'
npm.cmd run build
git diff --check
```

Chạy riêng luồng định kỳ bằng `npm.cmd run test:recurring` trong thư mục `server`. Bộ test tạo và dọn fixture, đồng thời khôi phục cấu hình phí.

Kết quả thực chạy trong phiên triển khai ngày **15/11/2026** đã đạt **26/26, fail 0**, lần cuối khoảng 13,68 giây. Bốn migration gồm chat và ba migration module đã áp dụng, schema up to date. Build frontend đạt 1.641 module, còn cảnh báo bundle lớn hơn 500 kB.

| Trường hợp kiểm chứng | Kết quả |
|---|---|
| Phụ huynh gửi lịch lặp, đúng gia sư trả phí, cả hai thấy lớp xác nhận | Đạt qua PostgreSQL và HTTP API |
| Gia sư từ chối | Booking `rejected`, phí `cancelled`, lịch được giải phóng |
| Thanh toán thất bại rồi thử lại | Giữ `pending_tutor`, lần thành công chuyển `confirmed` |
| Sai role, sai gia sư, Match không hợp lệ, lịch ngoài lịch rảnh | Backend chặn theo quyền và điều kiện nghiệp vụ |
| Hai yêu cầu trùng lịch gửi đồng thời | Một 201 và một 409 |
| Lịch dài hơn 4 tuần, ngày kết thúc, học viên trùng lịch giữa hai gia sư | Kiểm tra đúng giao của lịch lặp |
| Hết hạn, thanh toán đến muộn | Giải phóng lịch, chặn thu phí sau hạn |
| Thanh toán lặp hoặc đồng thời | Một Transaction và đúng một sự kiện thu phí thành công |
| Thay phí cấu hình và thay số ngày học trong tuần | Giữ mức phí đã chụp, một khoản phí cho cả lớp |
| Thanh toán và từ chối đồng thời | Trạng thái Booking và Transaction nhất quán |
| Socket.IO | Hai bên nhận `booking_updated` |
| Hồi quy chat, lịch tuần, dữ liệu cũ và chữ ký webhook tạo local | Đạt |
| Thuật toán lịch lặp | 500 cặp lịch lặp và 500 cặp lịch lặp–slot khớp triển khai tham chiếu |
| Render giao diện và HTTP frontend | Đúng nút theo role/trạng thái, trang demo trả 200 |

Thanh toán nhận lớp đã kiểm thử bằng **mô phỏng local**. Kiểm tra giao diện đã thực hiện ở mức render HTML và HTTP, thao tác tương tác trực tiếp trong trình duyệt còn cần Công kiểm tra theo kịch bản demo.

## Tích hợp với các module của nhóm

Module Match cần tạo/cập nhật `Match` active bằng cùng ID PostgreSQL của hai user. Nhóm xác thực cần provisioning `User` backend, role và ánh xạ Firebase UID. Khi cần nối tài khoản có sẵn, chạy lệnh sau trong `server` với `DATABASE_URL` đã cấu hình.

```powershell
node prisma/link-firebase.js 'email-user-backend' 'firebase-uid'
```

Khi kiểm thử đăng nhập thật, đặt `AUTH_MODE=token`, điền Firebase service account, cấu hình frontend Firebase và build với `VITE_BOOKING_DEMO=false`. Luồng này còn cần xác minh bằng tài khoản Firebase của nhóm. Phí nhận lớp của đồ án dùng mô phỏng local.

## Xử lý lỗi local đã gặp

- PostgreSQL báo `P1001` khi Prisma Dev ngừng đáp ứng. Dừng backend và phiên Prisma Dev, chạy `npx.cmd prisma dev stop mindmatch-booking` trong `server`, rồi khởi động lại Terminal A với `HOST=127.0.0.1` và Terminal B.
- Prisma Generate báo `EPERM` với DLL trên Windows khi backend còn sử dụng Prisma Client. Dừng backend, chạy lại generate rồi khởi động backend.
- API báo tài khoản không tồn tại khi ID trên database khác ID mẫu. Chạy seed và mở URL vừa in ra terminal.
- Trang hiển thị lỗi kết nối khi backend hoặc PostgreSQL chưa chạy. Kiểm tra `/api/health` và terminal backend.
