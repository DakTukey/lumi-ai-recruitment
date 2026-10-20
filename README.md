# Lumi AI Recruitment System

Hệ thống tuyển dụng thông minh ứng dụng Trí tuệ Nhân tạo (Qwen cục bộ và các nhà cung cấp AI theo tính năng), tích hợp toàn diện từ tải và kiểm tra CV PDF, bóc tách thông tin, xác thực chứng chỉ số, đối chiếu năng lực ứng viên đến quản lý tuyển dụng và gợi ý câu hỏi phỏng vấn chuyên sâu cho HR.

> 📖 **Chi tiết kiến trúc, luồng hoạt động 7 tính năng AI và bộ câu hỏi vấn đáp: Xem tại [README_AI.md](README_AI.md)**

---

## 🌟 Tính năng nổi bật

### 1. Dành cho Ứng viên (Candidate)
- **CV của tôi:** Tải nhiều PDF, xem nguyên bản, đổi tên và đặt mặc định.
- **Đọc và xác nhận PDF:** Qwen đọc CV có chữ hoặc scan; ứng viên đối chiếu và sửa dữ liệu trước khi sử dụng.
- **Lịch sử được giữ:** CV tạo trước đây chỉ xem; đơn đã nộp giữ nguyên bản CV tại thời điểm gửi.
- **AI Đối chiếu Độ phù hợp với Job (`JobMatchPanel`):**
  - Chấm điểm phù hợp (0–100) theo thời gian thực trước khi nộp đơn.
  - Trực quan hóa bằng **Biểu đồ Radar đa chiều (Spider Chart)** và Biểu đồ Thanh ngang.
  - Trích dẫn nguyên văn bằng chứng từ CV (Anti-hallucination Grounding).

### 2. Dành cho Nhà tuyển dụng / HR (Recruiter)
- **Quản lý Vòng đời Tin tuyển dụng:** Tạo bản nháp, đăng tin, quản lý vị trí, phòng ban, phân bổ chỉ tiêu tuyển dụng (`headcount`) và hạn nộp hồ sơ.
- **Đánh giá Hồ sơ Chuyên sâu với AI (`AiAssessmentTab`):**
  - Chấm điểm tự động dựa trên trọng số các tiêu chí trong JD (Kỹ năng bắt buộc x2, ưu tiên x1).
  - Trích xuất **Kỹ năng đáp ứng** và **Kỹ năng còn thiếu**.
  - Phân tích **Khoảng cách kỹ năng & Lộ trình bù đắp (Gaps & Roadmap)**.
  - **Tự động soạn câu hỏi phỏng vấn riêng:** AI tạo sẵn câu hỏi phỏng vấn nhắm trúng vào các lỗ hổng kỹ năng của ứng viên kèm lý do hỏi.
- **Widget Top Ứng viên Tiềm năng (Ranking Widget):** Tự động xếp hạng và vinh danh Top ứng viên xuất sắc nhất cho từng vị trí tuyển dụng.
- **AI Tóm tắt Tin tuyển dụng (`JobAiSummary`):** Tóm tắt nội dung JD thành 4 khối trọng tâm: Công việc chính, Yêu cầu bắt buộc, Yêu cầu ưu tiên, Lưu ý quan trọng.
- **Quản lý Quy trình Tuyển dụng (Workflow & Notes):** Chuyển vòng ứng tuyển (`Mới nộp` → `Xem xét` → `Phỏng vấn` → `Đề nghị` → `Tuyển dụng / Loại`) và lưu ghi chú nội bộ.

---

## 🏗️ Kiến trúc Hệ thống

Hệ thống được xây dựng theo kiến trúc Microservices hiện đại:

```
┌─────────────────────────────────┐
│     Frontend (React / Vite)     │  Port 5173
│  TypeScript, React Router, CSS  │
└────────────────┬────────────────┘
                 │ HTTP / REST API (Session Cookie + CSRF)
                 ▼
┌─────────────────────────────────┐
│   Backend (Spring Boot 3 / J21) │  Port 8080
│ Spring Security, JPA, Flyway DB │
└────────┬───────────────┬────────┘
         │               │ HTTP REST
         │ JDBC          ▼
         │       ┌─────────────────────────────────┐
         │       │    AI Service (Python FastAPI)  │  Port 8000
         │       │  Uvicorn, Pydantic, Gemini API  │
         ▼       └────────────────┬────────────────┘
┌─────────────────┐               │
│ PostgreSQL 16   │               ▼
│ Relational DB   │     ┌───────────────────┐
└─────────────────┘     │ Google Gemini API │ (gemini-3.8-flash)
                        └───────────────────┘
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu tiên quyết
- **Java:** JDK 21 trở lên
- **Node.js:** v20 trở lên & npm
- **Python:** 3.10 trở lên
- **PostgreSQL:** Phiên bản 15 hoặc 16

---

### 1. Cấu hình Cơ sở dữ liệu (PostgreSQL)
Tạo database có tên `lumi_recruitment`:
```sql
CREATE DATABASE lumi_recruitment;
```
*(Cấu hình kết nối nằm tại `backend/src/main/resources/application.yml` - Mặc định port 5432, user `postgres`).*

---

### 2. Khởi chạy AI Service (FastAPI)
```bash
cd ai-service

# Tạo và kích hoạt môi trường ảo
python3 -m venv .venv
source .venv/bin/activate

# Cài đặt thư viện phụ thuộc
pip install -r requirements.txt

# Tạo file .env từ mẫu và điền GEMINI_API_KEY
cp .env.example .env
# (Chỉnh sửa GEMINI_API_KEY trong file .env)

# Khởi chạy server
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Server AI sẽ lắng nghe tại: `http://127.0.0.1:8000` (Tài liệu Swagger: `http://127.0.0.1:8000/docs`).

Muốn đọc PDF và đánh giá CV cho HR bằng Qwen chạy tại máy, xem [hướng dẫn Qwen cục bộ](docs/local-qwen-cv-processing.md).

---

### 3. Khởi chạy Backend (Spring Boot)
```bash
cd backend

# Chạy Flyway migrations và khởi động server
./mvnw spring-boot:run
```
Backend sẽ lắng nghe tại: `http://127.0.0.1:8080`.

---

### 4. Khởi chạy Frontend (React / Vite)
```bash
cd frontend

# Cài đặt packages
npm install

# Khởi chạy chế độ phát triển
npm run dev
```
Ứng dụng giao diện sẽ sẵn sàng tại: `http://localhost:5173`.

---

## 🧪 Kiểm thử Hệ thống

* **Frontend Unit Tests (70/70 test suites passing):**
  ```bash
  cd frontend
  npm test
  ```
* **Frontend Lint & Build:**
  ```bash
  npm run lint
  npm run build
  ```
* **Backend Build & Verification:**
  ```bash
  cd backend
  ./mvnw clean test
  ```

---

## 👥 Tài khoản Thử nghiệm có sẵn

| Vai trò | Email | Mật khẩu | Chức năng chính |
|---|---|---|---|
| **Ứng viên (Candidate)** | `candidate.test@example.com` | `Password123!` | Tải CV PDF, xác nhận thông tin, đối chiếu công việc, nộp hồ sơ |
| **Nhà tuyển dụng (HR)** | `hr@gmail.com` | `Password123!` | Xem hồ sơ, AI phân tích, xem Top ứng viên, chuyển vòng |

---

## 📄 Bản quyền & Tác giả
Dự án được phát triển trong khuôn khổ Đề cương Thực tập Thực tế K24.
* **Tác giả:** Phạm Văn Hoài (hoaiphamimz@gmail.com)
