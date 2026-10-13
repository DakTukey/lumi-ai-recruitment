# Trang chi tiết tin và hồ sơ ứng tuyển của HR

## Điều hướng

- `/recruiter`: tổng quan.
- `/recruiter/jobs`: danh sách tin.
- `/recruiter/jobs/:id`: chi tiết tin, các tab Thông tin, Ứng viên, Tổng hợp AI, Lịch sử chỉnh sửa.
- `/recruiter/applications`: tra cứu tất cả đơn ứng tuyển.
- `/recruiter/applications/:id`: CV, đánh giá AI, ghi chú, lịch sử; hồ sơ thật có thêm JD lúc nộp và chuyển vòng.
- `/recruiter/profile`: hồ sơ HR.

Chi tiết tin và hồ sơ được đặt trong nội dung chính của workspace, không còn dialog lồng nhau hoặc cuộn bên trong dialog. Tạo/sửa tin và xác nhận đăng/đóng/mở lại vẫn dùng cửa sổ nổi hiện có. Sửa/đổi trạng thái từ trang chi tiết giữ nguyên trang, đồng thời cập nhật nội dung/trạng thái sau khi lưu.

`tab` lưu tab đang xem. Bộ lọc hồ sơ dùng `search`, `stage`, `page`, và `jobId` cho tra cứu toàn công ty. Hồ sơ có `from` lưu đường dẫn quay lại, bao gồm tin, tab và bộ lọc. Nút quay lại dùng đích cụ thể nên vẫn hoạt động khi mở đường dẫn trực tiếp hoặc tải lại trang. Đích quay lại chỉ chấp nhận danh sách HR, tổng quan hoặc trang chi tiết tin; không chuyển đến website khác hoặc vòng lặp hồ sơ.

`data=sample` xác định chế độ mẫu trong URL. Dữ liệu mẫu được giữ trong bộ nhớ workspace khi điều hướng; tải lại vẫn khôi phục trang/tab nhưng đặt lại các thay đổi mẫu như thông báo trên giao diện. Khi đổi giữa mẫu và thật, đưa về danh sách tương ứng để tránh dùng nhầm ID của chế độ khác.

Đường dẫn HR có bảo vệ vai trò như trước. Khi cần đăng nhập, lưu cả đường dẫn và query để HR/admin có thể trở lại đúng trang sau đăng nhập. Đăng nhập admin không có đích HR vẫn vào trang quản trị.

## Hiển thị và dữ liệu

Trang dùng API chi tiết tin/đơn hiện có. Có trạng thái tải, lỗi kèm thử lại, hồ sơ/tin mẫu không tồn tại và đường dẫn không hợp lệ. Kết quả chi tiết được gắn với ID để phản hồi chậm không ghi đè tin khác. Tab của hồ sơ do URL điều khiển trên trang HR; màn hồ sơ ứng viên ngoài HR vẫn dùng tab cục bộ hiện có.

Bố cục thích ứng theo chiều rộng phần nội dung, đặc biệt sidebar chuyển vòng của hồ sơ mẫu chuyển xuống dưới khi không đủ chỗ cho CV và biểu đồ. Trình duyệt nhận tiêu đề trang, focus vào tiêu đề khi chuyển trang, và hỗ trợ Back/Forward.

## Kiểm tra

- Frontend build, lint và bộ kiểm tra, gồm kiểm tra URL, dữ liệu mẫu/thật, khôi phục tab/bộ lọc, đích quay lại và đích sau đăng nhập.
- Trình duyệt: mở tin mẫu từ danh sách thành trang riêng; mở đánh giá Minh Anh thành trang hồ sơ; tải lại giữ đúng hồ sơ và tab AI; quay lại khôi phục từ khóa Minh và vòng đã nộp.
- Đổi nhanh từ khóa Huy và vòng đang xem xét giữ cả hai bộ lọc. Back/Forward giữa Ứng viên và Tổng hợp AI hoạt động đúng.
- Sửa tin vẫn mở dialog; đóng/mở lại tin mẫu cập nhật trạng thái ngay trên trang chi tiết.
- Không gọi AI mới hay tạo bản ghi tuyển dụng thật trong lần kiểm tra này. Database local hiện không có tin/đơn thật, nên chưa kiểm tra thao tác lưu thành công trên một bản ghi thật từ giao diện mới.

Ảnh: `hr-job-detail-page.png`, `hr-application-detail-page.png`.
