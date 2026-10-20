# Lumi AI Recruitment System

Ứng dụng tuyển dụng cho doanh nghiệp: ứng viên gửi CV PDF, hệ thống hỗ trợ đọc hồ sơ và đối chiếu với JD; HR xem bằng chứng, hỏi bổ sung và quản lý quy trình tuyển dụng. AI cung cấp thông tin hỗ trợ; quyết định tuyển dụng do người tuyển dụng thực hiện.

## Chức năng hiện tại

**Ứng viên:** đăng ký/đăng nhập, hồ sơ cá nhân, tìm công việc công khai, tải nhiều CV PDF, xem PDF gốc, sửa/xác nhận thông tin AI đọc, đối chiếu CV–JD trước khi nộp, nộp PDF, theo dõi đơn và trả lời câu hỏi bổ sung tùy chọn.

**HR:** tạo/sửa/đăng/đóng tin tuyển dụng, nhập/soạn JD với AI, xem đúng CV/JD tại thời điểm nộp, đánh giá CV–JD theo tiêu chí và trích dẫn, đọc phần trả lời bổ sung, đối chiếu dữ liệu GitHub công khai, tạo phiếu phỏng vấn, chấm/lưu phiếu, ghi chú và chuyển vòng. Trợ lý email tạo bản nháp nội dung để HR duyệt.

CV Builder đã ngừng trong luồng mới; CV lịch sử vẫn xem được. Không tự gửi email, không đặt lịch phỏng vấn, không phỏng vấn giọng nói/camera hoặc xác minh chứng chỉ qua đơn vị cấp. Việc làm đã lưu hiện chỉ giữ trong phiên giao diện và sẽ mất khi tải lại trang.

## Kiến trúc và yêu cầu

```text
React 19 / Vite 8 (5173)
        │ REST, session cookie + CSRF
Spring Boot 4.1.1 / Java 21 (8080)
        ├── PostgreSQL / Flyway (5432)
        └── FastAPI / Python (8000)
                    ├── Groq API
                    └── Gemini API
```

- Java 21; Node.js >=22.13.0; Python >=3.11.
- PostgreSQL: môi trường demo kiểm tra với PostgreSQL 18. Không cần PostgREST.
- Mặc định dùng API cloud. Ollama/Qwen là tùy chọn cấu hình riêng, không bắt buộc khởi động hoặc tải model để dùng bản demo này.
- AI cần mạng và quota nhà cung cấp. Kết quả đã lưu có thể đọc lại khi AI không khả dụng. PDF có chữ được trích văn bản trước; PDF scan cần khả năng đọc ảnh của provider (cloud hiện dùng Gemini).

## Khởi chạy

Tạo database `lumi_recruitment`; cấu hình tại `backend/src/main/resources/application.yml`. Không xóa database hiện có để chạy lại demo. Backend tự áp dụng các migration mới khi khởi động.

```sql
CREATE DATABASE lumi_recruitment;
```

AI service:

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Chỉ sao chép khi chưa có .env; giữ nguyên khóa/cấu hình hiện tại nếu đã có.
cp -n .env.example .env
# Điền GROQ_API_KEY / GEMINI_API_KEY trong .env. Không commit khóa.
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Cấu hình mẫu dùng `openai/gpt-oss-120b` cho Groq và `gemini-3.1-flash-lite` cho Gemini; khả năng phục vụ còn tùy tài khoản và quota. `GITHUB_TOKEN` là tùy chọn để truy cập API GitHub với hạn mức của tài khoản. Không dán khóa vào frontend.

Backend:

```bash
cd backend
./mvnw clean package -DskipTests
java -jar target/recruitment-backend-0.0.1-SNAPSHOT.jar
```

Khi demo cần giữ phiên đăng nhập lâu hơn, chạy backend với profile `demo`:

```bash
java -jar target/recruitment-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=demo
```

Profile này cho phép phiên không hoạt động tối đa 8 giờ; cấu hình mặc định vẫn là 30 phút. Khởi động lại backend sẽ làm mất phiên đang lưu trong bộ nhớ, nên cần đăng nhập lại sau khi khởi động.

`-DskipTests` ở lệnh chạy nhanh chỉ bỏ qua kiểm thử, không phải bằng chứng kiểm thử đã đạt. Dùng lệnh kiểm thử bên dưới khi nghiệm thu.

Frontend:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Mở `http://127.0.0.1:5173`. Không dùng địa chỉ 5174 và ID `11111111-...` từ môi trường giả lập giao diện trước đây để trình diễn dữ liệu thật.

## Kiểm thử

```bash
cd frontend
npm run build
npm test
npm run lint
```

```bash
cd ai-service
.venv/bin/python -m unittest discover -s tests
```

Backend có kiểm thử tích hợp tạo/xóa database riêng. Các bài này sẽ bị bỏ qua nếu thiếu biến môi trường; không tính bài bị bỏ qua là đạt. Chỉ dùng PostgreSQL kiểm thử mà tài khoản có quyền tạo database:

```bash
cd backend
LUMI_TEST_POSTGRES_URL=jdbc:postgresql://localhost:5432/postgres \
LUMI_TEST_POSTGRES_USER=postgres \
LUMI_TEST_POSTGRES_PASSWORD='<mật khẩu PostgreSQL kiểm thử>' \
./mvnw clean test
```

Kết quả mới nhất và giới hạn kiểm tra được ghi tại [báo cáo demo](docs/demo-readiness-2026-10-20.md), thay vì ghi cố định số bài test trong README.

## Tài khoản demo cục bộ

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Ứng viên | candidate.test@example.com | Password123! |
| HR | hr@gmail.com | Password123! |

Các tài khoản này dành cho môi trường demo đã chuẩn bị; không mặc định có sẵn trong database mới và không dùng lại cho môi trường công khai.

## Tài liệu

- [Luồng PDF hiện tại](docs/pdf-only-candidate-cv.md)
- [AI và cách trình bày demo](README_AI.md)
- [Câu hỏi bổ sung](docs/application-clarifications.md)
- [Các ý tưởng và phạm vi](docs/ai-feature-ideas.md)
- [Báo cáo và checklist demo](docs/demo-readiness-2026-10-20.md)
- [Qwen cục bộ — cấu hình tùy chọn](docs/local-qwen-cv-processing.md)

Dự án phục vụ đề cương thực tập thực tế K24. Tác giả: Phạm Văn Hoài (hoaiphamimz@gmail.com).
