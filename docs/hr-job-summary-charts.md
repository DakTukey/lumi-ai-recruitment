# Biểu đồ trong tổng hợp AI của từng tin

Tab Tổng hợp AI có hai biểu đồ dùng chung cho dữ liệu thật và mẫu:

- Thanh ngang phân bố đơn theo 7 trạng thái, hiển thị số lượng và tỷ lệ trên tổng đơn của job. Đây là ảnh chụp trạng thái hiện tại, không phải tỷ lệ chuyển vòng.
- Vòng tròn tỷ lệ đơn đã có kết quả AI. Đây là độ bao phủ đánh giá, không phải điểm phù hợp. Đơn chưa có kết quả vẫn nằm trong tổng số.

Dữ liệu thật dùng `getApplicationSummary(jobId)` hiện có, gồm `total`, `assessed`, `stages`; không lấy số liệu từ trang danh sách đang phân trang hoặc danh sách tối đa 5 ứng viên ưu tiên. Dữ liệu mẫu tính từ các đơn đúng `jobId` và chỉ xem COMPLETED là có kết quả. Tin không có đơn hiển thị thanh trống, thông báo chưa có đơn và vòng tròn trung tính với dấu “—”.

Component `JobApplicationCharts.tsx` dùng SVG/CSS, không thêm thư viện. Có số liệu dạng văn bản, mô tả SVG cho trình đọc màn hình, hai cột trên desktop, một cột dưới 700px và tắt chuyển động nếu người dùng chọn giảm chuyển động.

Đã kiểm tra trình duyệt: Frontend có 2 đơn, 1 đã nộp + 1 đang xem xét, 1/2 có kết quả AI → 50%; chuyển Product Designer có 0 đơn không dùng dữ liệu của Frontend. Frontend build, lint và 6 file kiểm thử hiện có đều thành công. Không thay đổi API hoặc database.
