# Xử lý CV cục bộ bằng Qwen3-VL

Lumi dùng `qwen3-vl:2b-instruct-q4_K_M` để đọc CV PDF (kể cả PDF scan), đối chiếu CV với JD và nhập JD từ tài liệu cho HR. Đây là model đã huấn luyện sẵn, không cần fine-tune. Các tính năng soạn nội dung AI vẫn dùng cấu hình nhà cung cấp hiện tại.

## Luồng xử lý

1. Ứng viên nộp CV web hoặc PDF gốc. Đơn được lưu ngay; AI lỗi không hủy đơn.
2. Worker đọc bản CV và JD tại thời điểm nộp. Với PDF, nội dung đã đọc được lưu vào `candidate.resume_documents.parsed_content` để không phải đọc lại cùng một file. PDF gốc vẫn nguyên vẹn.
3. Qwen đối chiếu từng tiêu chí JD. Backend kiểm tra trích dẫn có trong nội dung CV đã đọc, tính điểm theo trọng số JD rồi lưu kết quả cho HR.
4. HR xem PDF gốc, thông tin đã trích xuất và tab **Đánh giá AI**. Tab tự cập nhật khi worker hoàn thành. Kết quả chỉ hỗ trợ sàng lọc, không xác minh năng lực hoặc quyết định tuyển dụng.

PDF có chữ được trích văn bản trước; PDF scan hoặc bố cục khó được dựng thành ảnh trang và đưa vào Qwen tại `127.0.0.1`. Không gửi PDF đến Groq/Gemini khi `CV_PROCESSING_PROVIDER=ollama`. Nếu model thiếu hoặc hết bộ nhớ, trạng thái phân tích báo lỗi, HR vẫn xem được PDF gốc và có thể thử lại.

## Cài và chạy trong workspace

Model cần khoảng 1,9 GB trên đĩa và thêm RAM khi chạy. Bản cài cục bộ nằm trong `ai-service/.local-ai/` (đã được Git bỏ qua). Cài Ollama theo [hướng dẫn Linux chính thức](https://docs.ollama.com/linux), hoặc dùng bản portable trong thư mục này. Sau đó:

```bash
cd ai-service
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_MODELS="$PWD/.local-ai/models"
./.local-ai/runtime/bin/ollama serve
```

Ở terminal khác:

```bash
cd ai-service
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_MODELS="$PWD/.local-ai/models"
./.local-ai/runtime/bin/ollama pull qwen3-vl:2b-instruct-q4_K_M
```

Thêm vào `ai-service/.env`:

```dotenv
CV_PROCESSING_PROVIDER=ollama
JD_IMPORT_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3-vl:2b-instruct-q4_K_M
```

Cài Python dependencies `pip install -r requirements.txt` và khởi động lại AI service. Backend đọc `AI_SERVICE_TIMEOUT_SECONDS` (mặc định 270 giây cho mỗi lượt đọc hoặc chấm) để đủ thời gian xử lý trên CPU. Chỉ cấu hình local cho xử lý CV; không cần xóa các API key dùng cho tính năng khác.

## Kiểm tra

Chạy `python -m unittest discover -s tests -q` trong `ai-service`. Mở một đơn nộp PDF ở role HR: tab **CV đã nộp** phải mở được PDF gốc, phần **Thông tin trích từ PDF và xác nhận của ứng viên** hiện trạng thái/kết quả; tab **Đánh giá AI** hiện điểm, trích dẫn theo tiêu chí và tên model `ollama/qwen3-vl:2b-instruct-q4_K_M`. Trường hợp AI chưa có kết quả, chờ worker hoặc bấm **Phân tích ngay**.

Hãy kiểm tra thủ công các CV nhiều cột, scan mờ và tiếng Việt trước khi dùng điểm cho quy trình thực tế. Backend xác minh trích dẫn nằm trong dữ liệu đã trích xuất, nhưng chưa thể bảo đảm mọi trường AI đọc đều đúng với từng điểm ảnh của PDF.

## HR nhập JD từ PDF scan

Vào **Tin tuyển dụng → Tạo tin → Nhập từ JD có sẵn → Tải tài liệu**, chọn PDF có chữ hoặc scan (1–10 trang, tối đa 10 MB, không có mật khẩu), DOCX, MD hoặc TXT. Có thể dán văn bản thay cho file. Bấm **Phân tích JD bằng AI**, giữ trang mở trong lúc chờ; PDF scan có thể mất vài phút trên CPU.

PDF ít chữ hoặc nhiều cột được dựng thành ảnh trang để model nhìn trực tiếp. Các đầu vào khác được lấy chữ trước rồi chuyển thành trường thông tin, tối đa 12.000 ký tự với model cục bộ để không tự cắt mất nội dung vì giới hạn bộ nhớ ngữ cảnh. Khi `JD_IMPORT_PROVIDER=ollama`, toàn bộ bước nhập JD chỉ gọi model cục bộ, không tự chuyển tài liệu sang API bên ngoài khi Ollama lỗi. Biến này độc lập với `CV_PROCESSING_PROVIDER`.

Kết quả chỉ điền vào form; chưa ghi tin vào database. HR đối chiếu chức danh, kỹ năng, lương, ngày hạn và trọng số tiêu chí trước khi lưu. Trường không có trong nguồn để trống; phòng ban chỉ được chọn khi tên gợi ý khớp phòng ban đang hoạt động. Tính năng **AI hỗ trợ viết JD** tiếp tục dùng provider hiện tại.

Form đăng tin áp dụng địa điểm văn phòng hiện tại của công ty hoặc làm từ xa theo cách làm việc. Nếu địa điểm đọc từ JD khác địa điểm áp dụng, màn hình kiểm tra hiển thị rõ địa điểm gốc để HR đối chiếu. Khi JD thiếu cách làm việc/cấp độ/hình thức hợp đồng, form yêu cầu HR chọn trước khi lưu.

Thời gian chờ: AI tối đa 250 giây, backend mặc định 270 giây và frontend 285 giây cho bước nhập JD. Nếu lỗi, nội dung/file đã chọn vẫn còn để thử lại hoặc nhập thủ công.

### Bước kiểm tra PDF trước khi gửi đơn (V22)

PDF mới cần được đọc và ứng viên xác nhận dữ liệu trước khi nộp. Kiểm tra ở **Hồ sơ → CV → Kiểm tra PDF** hoặc ngay màn hình ứng tuyển. Có thể sửa trường, chuyển mục phân loại nhầm, lưu bản sửa và xác nhận. HR xem PDF gốc cùng bản dữ liệu được xác nhận tại thời điểm nộp. Chi tiết và giới hạn nguồn trích dẫn nằm trong `docs/cv-pdf-import.md`, mục “Kiểm tra dữ liệu PDF trước khi ứng tuyển”.
