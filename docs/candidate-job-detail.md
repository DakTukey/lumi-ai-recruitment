# Trang chi tiết công việc

- Route công khai `/jobs/:jobId`, không cần đăng nhập để đọc tin. Đọc dữ liệu từ API `GET /api/jobs/:jobId`.
- Mẫu: `http://localhost:5173/jobs/1?data=sample`. Mẫu chỉ lấy từ danh sách mẫu rõ nguồn, không dùng thay thế API lỗi và không nhận đơn.
- Link cũ `/?jobId=...` tự chuyển sang trang mới. Sau đăng nhập hoặc hoàn tất CV, ứng viên quay lại `/jobs/:jobId?apply=1`.
- Thẻ việc làm dùng link thật, có thể mở tab mới; vùng thẻ có thể nhấn, nút lưu hoạt động riêng.

## Bố cục

Phần đầu gồm tiêu đề, phòng ban, địa điểm, hình thức, cấp độ và loại hợp đồng nếu có; hàng tóm tắt gồm lương, số lượng tuyển, hạn tuyển và ngày đăng. Các giá trị thiếu được ghi rõ, không suy diễn.

Nội dung có bốn mục đánh số: mô tả công việc, yêu cầu, kỹ năng, quyền lợi. Nội dung JD là văn bản an toàn; hỗ trợ xuống dòng và danh sách dấu gạch đầu dòng. Không tạo điểm AI hoặc quyền lợi giả cho tin thật.

Đã thêm khối **Hiểu nhanh vị trí với AI** thu gọn dưới thông tin vị trí. Khi mở, đọc cache hoặc tạo tóm tắt JD thật, có trích dẫn đối chiếu cho từng ý. Chi tiết cấu hình, API và kiểm thử ở [job-ai-summary.md](job-ai-summary.md).

Desktop dùng nội dung chính và sidebar ứng tuyển bám theo khi cuộn. Tablet thu về một cột; điện thoại có thanh ứng tuyển/lưu tin cố định, footer chừa đủ chỗ. Có link quy trình tuyển dụng và nút sao chép link công việc không kèm nguồn điều hướng.

## Ứng tuyển và điều hướng

- Nhấn ứng tuyển mở modal `ApplyWithResume` hiện có: chọn CV READY, xem lại CV, thư tùy chọn và xác nhận. API nộp đơn, kiểm tra đơn trùng và resume version giữ nguyên.
- Khách được dẫn đến đăng nhập rồi quay lại đúng công việc. Tài khoản HR/admin không được dùng nút ứng tuyển; backend vẫn kiểm tra quyền riêng.
- Đóng modal bị chặn trong lúc gửi; URL `apply=1` giữ đúng trạng thái khi tải lại. Mở/đóng modal giữ nguồn danh sách trong lịch sử.
- Quay lại giữ tìm kiếm, bộ lọc, sắp xếp, trang đã tải và cuộn. Bộ nhớ chỉ giữ tối đa tám danh sách, tách theo tài khoản và mục lịch sử; reload toàn trang bắt đầu phiên danh sách mới.
- `from` chỉ cho phép trang danh sách `/` hoặc `/saved`, loại bỏ đường dẫn ngoài và tham số không liên quan.
- Trang có trạng thái tải, lỗi kết nối, tin không tồn tại/không còn tuyển và nút thử lại.

## Kiểm tra

- Build, 13 tệp kiểm thử đạt; lint không có lỗi, còn cảnh báo cũ trong `TopCandidatesWidget.tsx`.
- Trình duyệt: 1600px hai vùng, sidebar sticky ở 24px; 900px một cột; 390px thanh hành động cố định; không tràn ngang.
- 14 tin mẫu: mở chi tiết rồi dùng Back/nút quay lại giữ đủ 14 tin và vị trí cuộn chính xác; bộ lọc Junior, sort lương và trạng thái lưu giữ đúng.
- Mở trực tiếp, reload, sao chép link và API trả 404 đã kiểm tra.
- Máy chủ giả lập tách biệt đã xác minh đọc job theo DTO thật, mở modal CV READY, gửi `jobId/resumeId/resumeVersion`, hiển thị thành công và nhận biết đơn đã nộp; đóng modal/quay lại giữ bộ lọc; khách được dẫn đến `/login`.
- Không tạo hoặc gửi đơn vào database thật trong kiểm tra. Các máy chủ giả lập đã dừng.

Ảnh: `candidate-job-detail-desktop.png`, `candidate-job-detail-content.png`, `candidate-job-detail-mobile.png`.
