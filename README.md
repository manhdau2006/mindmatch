 Công nghệ sử dụng

- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) (Icons)
- **Routing:** [React Router v6](https://reactrouter.com/)
- **Backend as a Service (BaaS):** [Firebase](https://firebase.google.com/)
  - **Firebase Authentication:** Quản lý đăng ký, đăng nhập và phân quyền (Mentor / Mentee).
  - **Cloud Firestore:** Lưu trữ thông tin người dùng, hồ sơ, dữ liệu matching và lịch hẹn (sessions).
  - **Firebase Realtime Database:** Quản lý luồng tin nhắn và trạng thái trực tuyến tức thì.

---

 Cấu trúc thư mục.  
 --> phần này giữ lại ghi chú cho mn hiểu nhiệm vụ các file chứ hôm sau xoá chú thích sau ha

```text
mindmatch/
├── .env.example             # Mẫu khai báo các biến môi trường (API keys, config Firebase,...)
├── .gitignore               # Khai báo các file/thư mục không đưa lên Git (node_modules, .env, dist,...)
├── README.md                # Tài liệu hướng dẫn cài đặt, chạy dự án và giới thiệu hệ thống
├── index.html               # File HTML gốc (entry point) để gắn React app vào DOM
├── package.json             # Quản lý danh sách dependencies, thư viện và các script chạy lệnh (npm run dev/build)
├── package-lock.json        # Khóa phiên bản chính xác của các thư viện và cây phụ thuộc
├── postcss.config.js        # Cấu hình PostCSS để xử lý tiền/hậu kỳ CSS (hỗ trợ Tailwind CSS)
├── tailwind.config.js       # Cấu hình hệ thống thiết kế của Tailwind CSS (theme, màu sắc, font,...)
├── vite.config.js           # Cấu hình công cụ đóng gói và máy chủ phát triển Vite (plugins, aliases,...)
└── src/                     # Thư mục chứa toàn bộ mã nguồn chính của ứng dụng React
    ├── App.jsx              # Component gốc, thường quản lý điều hướng (routing) và layout chung
    ├── index.css            # File CSS chính, nạp Tailwind directives (@tailwind) và style toàn cục
    ├── main.jsx             # File khởi tạo React, render <App /> vào thẻ root trong index.html
    │
    ├── components/          # Thư mục chứa các UI component tái sử dụng trong toàn bộ dự án
    │   └── PagePlaceholder.jsx   # Giao diện khung chờ (skeleton/placeholder) khi trang chưa tải xong hoặc đang phát triển
    │
    ├── context/             # Quản lý trạng thái toàn cục (Global State) qua React Context API
    │   └── AuthContext.jsx       # Quản lý và cung cấp trạng thái đăng nhập, thông tin người dùng cho toàn app
    │
    ├── lib/                 # Các thư viện kết nối bên ngoài hoặc hàm tiện ích hệ thống
    │   ├── firebase.js           # Khởi tạo kết nối với Firebase (Authentication, Firestore, Storage,...)
    │   └── utils.js              # Các hàm bổ trợ dùng chung (format ngày tháng, xử lý chuỗi, classnames,...)
    │
    └── pages/               # Chứa các màn hình/trang chính tương ứng với từng route/đường dẫn
        ├── Availability.jsx      # Thiết lập và quản lý lịch rảnh / thời gian biểu kết nối
        ├── Dashboard.jsx         # Bảng điều khiển tổng quan khi người dùng đăng nhập thành công
        ├── EmailVerification.jsx # Màn hình thông báo / xác thực địa chỉ email tài khoản
        ├── Help.jsx              # Trang hỗ trợ, hướng dẫn sử dụng và giải đáp thắc mắc (FAQ)
        ├── Landing.jsx           # Trang chủ giới thiệu nền tảng trước khi người dùng đăng nhập
        ├── Login.jsx             # Giao diện đăng nhập / xác thực tài khoản
        ├── Matcher.jsx           # Tính năng ghép nối (matching) người học (Mentee) và người hướng dẫn (Mentor)
        ├── MenteePreferences.jsx # Thiết lập các tiêu chí, nguyện vọng và sở thích ghép nối của Mentee
        ├── Messages.jsx          # Giao diện phòng trò chuyện / gửi tin nhắn trực tiếp
        ├── MyMentees.jsx         # Danh sách và quản lý các mentee đang được hướng dẫn (dành cho Mentor)
        ├── Notifications.jsx     # Trang hiển thị lịch sử thông báo hệ thống và tương tác
        ├── Onboarding.jsx        # Quy trình chào mừng và thu thập thông tin người dùng lần đầu đăng nhập
        ├── Profile.jsx           # Trang xem và chỉnh sửa thông tin hồ sơ cá nhân
        ├── Resources.jsx         # Kho tài liệu, tài nguyên học tập và tham khảo
        ├── Sessions.jsx          # Quản lý các buổi hẹn, phiên cố vấn (lịch hẹn sắp tới, lịch sử gặp)
        └── Settings.jsx          # Thiết lập cấu hình tài khoản cá nhân và tùy chọn hệ thống
