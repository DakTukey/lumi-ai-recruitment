# Nền và chế độ sáng/tối của preview CV

Tất cả preview sử dụng `CvPreview`: trình tạo CV ứng viên, xem lại trước khi nộp, CV đã nộp của ứng viên và trình xem HR (cả mẫu lẫn thật).

- Thêm mảng hình học mờ ở góc trên phải và đường cong ở góc dưới phải. Độ đậm 4.5% / 3.5%, không bắt sự kiện chuột, nằm dưới nội dung.
- Thanh **Màu nền CV** có hai nút **Sáng / Tối**, hỗ trợ bàn phím, trạng thái `aria-pressed`, `type=button` để không vô tình gửi form ứng tuyển.
- Chế độ tối đổi đồng bộ nền giấy, cột trái, chữ, nhãn, liên kết, kỹ năng và thông báo thiếu dữ liệu. Không chỉ đổi màu khung ngoài.
- Lựa chọn lưu trong trình duyệt với khóa `lumi.cv-preview-theme`; mặc định sáng. Các preview trong cùng trang/tab và các tab cùng origin đồng bộ. Khi storage bị chặn, vẫn đổi màu được trong phiên hiện tại.
- Đây là lựa chọn trình xem, không ghi vào nội dung CV/database và không thay đổi bản snapshot đã nộp.
- Dark palette chỉ áp dụng trong `@media screen`. Khi in/PDF, dùng bảng màu sáng, ẩn nút đổi nền và họa tiết trang trí, giữ bố cục giấy hai cột.

## Kiểm tra

- Frontend build, lint và 11 tệp test qua.
- Test render bảo đảm nút không submit form và trạng thái mặc định đúng; nội dung CV ứng viên/HR vẫn đồng nhất.
- Test trạng thái: mặc định sáng, lưu/đọc lại nền tối, sự kiện cập nhật, dữ liệu preference không hợp lệ và storage bị chặn.
- Trình duyệt trên hồ sơ HR mẫu: đổi sáng/tối; tải lại vẫn tối; mở tab thứ hai đổi sáng và tab đầu tự cập nhật. Kiểm tra trực quan họa tiết, màu chữ, sidebar, nút chọn.
- CSS in được kiểm tra mã nguồn; chưa thao tác hộp thoại in hoặc xuất file PDF trong lượt này.

Ảnh: `cv-preview-light.png`, `cv-preview-dark.png`.
