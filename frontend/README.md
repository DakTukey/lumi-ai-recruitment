# Lumi Studio — AI Recruitment Assistant

Frontend React + TypeScript + Vite cho cổng tuyển dụng nội bộ của **Lumi Studio**, một công ty công nghệ giả lập tại Đà Nẵng. Nhận diện dùng tông xanh rừng, trắng ngà và cam đất. Icon Lucide, font Be Vietnam Pro và Manrope được đóng gói cục bộ.

## Chạy trên Ubuntu hoặc Windows

Yêu cầu Node.js 22.12+ (khuyến nghị 22.22.1 như môi trường hiện tại).

```bash
cd frontend
npm ci
npm run dev
```

Mở URL Vite in trong terminal và giữ terminal chạy. Nếu `localhost` không kết nối được, thử `npm run dev -- --host 127.0.0.1` rồi mở địa chỉ được in ra, thường là `http://127.0.0.1:5173`. Nếu cổng đã dùng, Vite có thể chọn cổng kế tiếp. Khi chuyển hệ điều hành, không copy `node_modules`; chạy lại `npm ci`.

```bash
npm run build
npm run lint
npm run format:check
```

## Các màn hình đã có

| Đường dẫn | Nội dung |
| --- | --- |
| `/` | Tìm kiếm không dấu, lọc lĩnh vực/kinh nghiệm/hình thức/lương, sắp xếp và xem chi tiết vị trí tại Lumi Studio |
| `/saved` | Danh sách việc đã lưu |
| `/profile` | Hồ sơ thật; danh sách CV có dữ liệu đã lưu; chọn PDF cục bộ |
| `/applications` | Theo dõi và rút đơn ứng tuyển thử |
| `/login` | Đăng nhập/đăng ký thật; tự đăng nhập sau đăng ký và mở khảo sát tùy chọn |
| `/about` | Giới thiệu Lumi Studio |
| `/hiring-process` | Quy trình tuyển dụng của Lumi Studio |
| `/recruiter` | Giao diện HR tông tối; xem/tìm tin công khai thật, chuyển sang mẫu để thử tạo nháp/đăng/đóng tin và xử lý hồ sơ minh họa |
| `/admin` | Tổng quan quản trị doanh nghiệp, thống kê và phân bổ tin theo phòng ban |
| `/admin/users` | Tìm không dấu, lọc, phân trang, thêm và chỉnh sửa tài khoản mẫu |
| `/admin/jobs` | Tìm, lọc và chỉnh sửa nội dung/trạng thái tin mẫu |
| `/admin/departments` | Tìm, thêm và chỉnh sửa phòng ban mẫu |
| `/admin/permissions` | Vai trò và bảng phạm vi truy cập |
| `/admin/activity` | Nhật ký thao tác trong phiên và xuất CSV |
| `/admin/settings` | Chỉnh sửa thông tin doanh nghiệp mẫu |

Giao diện có bố cục responsive, menu mobile, trạng thái không có kết quả, modal dùng phần tử `dialog`, nhãn cho các nút icon và điều hướng bàn phím.

## Tổ chức mã nguồn

```text
src/
├── app/
│   ├── App.tsx                 # Router và các màn hình
│   ├── providers/              # AuthProvider: phiên thật; DemoProvider: dữ liệu tuyển dụng mẫu
│   └── routes/                 # ProtectedRoute phân quyền theo role
├── components/
│   ├── common/Brand.tsx        # Logo và tên thương hiệu Lumi Studio
│   └── ui/Modal.tsx            # Dialog modal dùng chung
├── features/
│   ├── auth/AuthPage.tsx       # Trang đăng nhập
│   ├── jobs/
│   │   ├── components/         # JobCard, JobDetail
│   │   ├── data/jobs.ts        # Dữ liệu giả lập
│   │   └── pages/              # ExplorePage, RecruiterPage
│   ├── applications/pages/     # Quản lý đơn ứng tuyển
│   ├── assessments/components/ # Modal phân tích AI (AssessmentPanel)
│   ├── company/pages/          # AboutPage, HiringProcessPage
│   └── profile/pages/          # Hồ sơ ứng viên
├── hooks/
│   ├── useLocalStorage.ts      # Đọc/ghi localStorage type-safe
│   └── useDocumentTitle.ts     # Đặt document.title theo trang
├── services/
│   ├── api.ts                  # Base HTTP client (cookie session + CSRF + error handling)
│   ├── auth.service.ts         # Đăng nhập, đăng ký, getMe
│   ├── job.service.ts          # Đọc/tìm tin công khai và danh sách phòng ban
│   ├── application.service.ts  # Nộp đơn, rút đơn, cập nhật trạng thái
│   ├── resume.service.ts       # Upload/quản lý CV
│   └── assessment.service.ts   # Đọc kết quả đánh giá AI
├── types/
│   ├── domain.ts               # Entity types đồng bộ với database schema
│   └── api.ts                  # Response wrapper types (ApiResponse, PaginatedResponse)
├── styles/globals.css          # CSS toàn ứng dụng
└── main.tsx                    # Entry point
```

### Path alias

Import bằng `@/` thay vì đường dẫn tương đối:

```ts
import { get } from '@/services/api'
import type { Job } from '@/types/domain'
```

Alias được cấu hình trong `vite.config.ts` và `tsconfig.app.json`. Code hiện tại vẫn dùng đường dẫn tương đối — cả hai đều hoạt động.

## Kiến trúc Service Layer

Thư mục `services/` chứa các module gọi API đến Spring Boot backend:

- **`api.ts`** — base client dùng `fetch` với `credentials: include`, lấy CSRF token trước request thay đổi dữ liệu, hỗ trợ `get`/`post`/`put`/`del`/`upload`. Lỗi đăng nhập hiển thị tại form; phiên hết hạn được thông báo cho AuthProvider.
- **Service files** — mỗi file tương ứng một nhóm endpoint: auth, job, application, resume, assessment.

> **Hiện tại**: Đăng nhập/đăng ký đã gọi Spring Boot. Danh sách/chi tiết việc làm đọc PostgreSQL qua API. Đăng tin của nhân sự, ứng tuyển và AI vẫn là demo.

## Chạy đăng ký và đăng nhập thật

Khởi động PostgreSQL và backend bằng `cd backend && ./mvnw spring-boot:run` từ thư mục gốc dự án. Với database cũ chưa migration, làm theo [hướng dẫn schema](../docs/account-schema-migration.md) trước khi chạy.

Frontend mặc định gọi `/api`; Vite proxy đến `http://localhost:8080`. Có thể đặt `API_PROXY_TARGET` để đổi backend thử nghiệm. Nếu cấu hình `VITE_API_BASE_URL` thành URL khác origin, cần cấu hình CORS tương ứng tại backend. Khi triển khai, reverse proxy `/api` tới backend và bật `SESSION_COOKIE_SECURE=true` trên HTTPS.

Luồng đăng ký: form → `AuthProvider.signUp` → `auth.service.register` → `POST /api/auth/register` → `RegisterRequest` → `AuthController` → `AuthService` → repository/PostgreSQL. Backend tạo `auth.users` và `candidate.candidate_profiles` trong cùng transaction, băm mật khẩu, chỉ cấp vai trò `CANDIDATE`. Sau khi lưu thành công, backend tạo phiên cookie HttpOnly và trả `AuthResponse` chứa `UserDto`, không trả mật khẩu. Frontend cập nhật tài khoản và mở `/onboarding` cho ứng viên chưa hoàn thành/bỏ qua bộ câu hỏi; có thể bỏ qua để về `/`.

Email được chuẩn hóa trước validation/kiểm tra trùng; email đã dùng trả 409, dữ liệu sai trả 400. Mật khẩu tối thiểu 6 ký tự và tối đa 72 byte UTF-8 để tương thích BCrypt. Form kiểm tra mật khẩu xác nhận và khóa gửi trong lúc chờ. Tải lại trang lấy tài khoản qua `GET /api/auth/me`; `POST /api/auth/logout` hủy phiên. Phiên hiện lưu trong bộ nhớ backend, hết hạn sau 30 phút không hoạt động hoặc khi backend khởi động lại.

Ứng viên chưa hoàn thành/bỏ qua onboarding được chuyển đến `/onboarding`; các lần sau về `/` hoặc đường dẫn đã yêu cầu. Nhân sự vào `/recruiter`; quản trị viên doanh nghiệp vào `/admin` (vẫn có thể truy cập không gian HR). Hồ sơ cá nhân, kinh nghiệm và kỹ năng đã đọc/ghi qua API; CV, xác minh email và quên mật khẩu chưa triển khai. Xem [hướng dẫn onboarding](../docs/candidate-onboarding.md).

## Giới hạn của bản thiết kế

- Lumi Studio, tin tuyển dụng, ứng viên và phân tích AI đều là dữ liệu giả lập. Không đại diện cho tuyển dụng thực tế.
- Đăng ký/đăng nhập dùng tài khoản thật trong PostgreSQL. Không còn đăng nhập bằng tài khoản demo hard-code hoặc tin cậy role từ localStorage.
- `/admin/*` chỉ dành cho `COMPANY_ADMIN`. `/recruiter` dành cho `RECRUITER` và `COMPANY_ADMIN`; các trang hồ sơ, việc đã lưu và đơn ứng tuyển yêu cầu `CANDIDATE`.
- Việc đã lưu, đơn thử và tin mới nằm trong bộ nhớ React, mất khi tải lại trang. Hồ sơ, khảo sát và CV có cấu trúc được lưu thật trong PostgreSQL.
- Chọn CV chỉ kiểm tra tên đuôi PDF và kích thước tối đa 5 MB; chưa upload file. Email ở form đăng ký/đăng nhập được gửi tới backend.
- Tin thêm từ nhà tuyển dụng chỉ xuất hiện trong khu vực nhân sự demo, không xuất bản ra trang tìm việc. Ba hồ sơ phân tích mẫu được dựng riêng, không phải phân tích các đơn vừa nộp.
- Service CV có cấu trúc đã nối giao diện và lưu thật; service đơn ứng tuyển và AI mới có khung, chưa nối giao diện.
- Quản trị riêng, so sánh nhiều CV và các API nghiệp vụ là các phần triển khai tiếp theo.

## Tham khảo thiết kế

- [TopCV](https://www.topcv.vn/): tìm việc, bộ lọc và cách trình bày thông tin thị trường Việt Nam.
- [Wellfound](https://wellfound.com/): hành trình riêng cho ứng viên và doanh nghiệp, thông tin công việc rõ ràng.
- [Welcome to the Jungle](https://www.welcometothejungle.com/en): nhấn mạnh môi trường phù hợp và bản sắc doanh nghiệp.
- [Lucide](https://lucide.dev/guide/react): bộ icon nét đồng nhất.

Thiết kế Lumi Studio là bố cục và nhận diện giả lập riêng; không sao chép tài sản hoặc logo của các trang tham khảo. Hình minh họa hero được xây bằng CSS và icon, không phụ thuộc ảnh từ dịch vụ ngoài.

### Public jobs connected to PostgreSQL (V3)

Explore and job details now use `/api/jobs` and `/api/departments`, with server filtering,
12-item pagination and loading/error/empty states. Mock personalized suggestions were removed.
No sample jobs are inserted automatically. Recruiter job creation is still an isolated demo;
it does not add jobs to the public list. Saved jobs and applications remain session-only demos.
See [recruitment API](../docs/recruitment-jobs.md).

Trang HR mặc định đọc tin công khai thật, không dùng dữ liệu mẫu làm thống kê.
Chế độ **Xem mẫu** có form tin 3 bước với lương/hạn nộp/kỹ năng/tiêu chí, sửa/xem trước/đăng/đóng/mở lại; hồ sơ ứng tuyển lọc theo job/vòng, CV mẫu, ghi chú/lịch sử; hồ sơ HR có form chỉnh sửa. Phân tích AI vẫn là minh họa cố định. Các thao tác ghi thật vẫn chưa triển khai. Xem
[bố cục, phạm vi chức năng và kiểm tra HR](../docs/recruiter-interface.md).

### Khảo sát khởi tạo hồ sơ

Sau đăng ký/đăng nhập, ứng viên chưa hoàn tất khảo sát có 3 bước tùy chọn:
**Công việc mong muốn → Kinh nghiệm & kỹ năng → Cách làm việc**.
Bấm Tiếp tục để lưu từng bước; có thể bỏ qua và sửa sau trong Hồ sơ.
Họ tên, số điện thoại và nơi ở nằm ở phần thông tin cá nhân.
Câu hỏi cố định trong `src/features/profile/questions.ts`; danh sách lựa chọn của
công ty lấy từ `/api/candidate/profile/options`. Câu trả lời lưu thật vào PostgreSQL.
Xem [chi tiết dữ liệu và cấu hình](../docs/candidate-onboarding.md).

### CV và cài đặt

- Avatar ứng viên mở menu **Hồ sơ của tôi / Cài đặt / Đăng xuất**.
- `/profile?tab=cv` mở thẳng mục **CV & tài liệu**.
- `/cv-builder` là trình tạo CV: điền sẵn thông tin Hồ sơ, chọn 2 mẫu,
  chỉnh nội dung có cấu trúc, lưu bản nháp/hoàn tất vào database, in/lưu PDF qua trình duyệt. Không tự động lưu.
  Trợ lý viết bằng AI được đánh dấu **Sắp có**.
- `/settings` hiển thị thông tin tài khoản; đổi mật khẩu, thông báo và
  quyền riêng tư được đánh dấu **Sắp có**. Các trang này dành cho ứng viên đã đăng nhập.

### CV có cấu trúc (V5)

`candidate.resumes` lưu dữ liệu riêng của mỗi CV: tên, liên hệ, các link, kỹ năng,
kinh nghiệm, học vấn, dự án và chứng chỉ. Một ứng viên có nhiều CV; tối đa một CV
mặc định đã hoàn tất. `/profile?tab=cv` liệt kê, mở sửa, đặt mặc định và xóa CV.
`/cv-builder?id={uuid}` mở lại bản đã lưu. Frontend gọi `/api/candidate/resumes`
qua controller/service/DTO/repository; chủ sở hữu lấy từ phiên đăng nhập.
Upload PDF, AI và snapshot CV khi ứng tuyển thật chưa triển khai.
CV hỗ trợ các mục tùy chọn Ngoại ngữ, Giải thưởng, Hoạt động qua migration V6.
Mục trống không hiện trong bản xem trước/PDF; mô tả kinh nghiệm, dự án và hoạt động
hiện thành gạch đầu dòng. Mẫu CV dùng cùng dữ liệu; đổi mẫu không làm mất nội dung.
Chạy `npm test` để kiểm tra ẩn mục trống, thứ tự thời gian và định dạng gạch đầu dòng.

Xem [thiết kế và API CV](../docs/candidate-resumes.md).

## Giao diện quản trị doanh nghiệp

Trang Admin sử dụng phiên đăng nhập thật và vai trò `COMPANY_ADMIN` do máy chủ trả về. Form đăng ký công khai vẫn chỉ tạo `CANDIDATE`; không có cơ chế tự cấp quyền Admin. Tài khoản Admin hiện cần được cấp qua quy trình quản trị dữ liệu hiện có.

Các danh sách, thống kê, thông tin doanh nghiệp và nhật ký trong trang Admin là **dữ liệu mẫu độc lập**. Thay đổi được giữ khi chuyển giữa các mục `/admin/*`, nhưng đặt lại khi tải lại hoặc rời trang Admin. Chỉnh sửa vai trò/trạng thái không thay đổi tài khoản thật; đổi trạng thái tin không xuất bản lên trang ứng viên. Chưa có API Admin để lưu các thao tác này vào PostgreSQL. Xem [chi tiết giao diện và kiểm tra](../docs/admin-interface.md).
