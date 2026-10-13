# Việc làm mẫu cho Candidate

Mở `http://127.0.0.1:5173/?data=sample#opportunities` hoặc chọn **Xem mẫu** trên trang việc làm.

- 14 tin minh họa, gồm nhiều phòng ban, cấp độ, hình thức làm việc và mức lương; hiện 12 tin đầu, nút **Xem thêm công việc** nối thêm tối đa 12 tin mỗi lượt.
- Có thể tìm theo vị trí/kỹ năng, lọc, sắp xếp, lưu trong phiên và mở chi tiết.
- Chi tiết có số lượng tuyển, địa điểm, mức lương, mô tả, yêu cầu và quyền lợi mẫu.
- Tin mẫu được đánh dấu rõ và không nhận đơn ứng tuyển.
- Chọn **Dữ liệu thật** để quay lại API việc làm đang tuyển. Không tự dùng mẫu khi API trống hoặc lỗi.
- Không thêm record hay thay đổi bảng trong database. Dữ liệu mẫu nằm tại `frontend/src/features/jobs/candidate-job-preview.ts`.

## Bố cục và tải thêm

- Khung trang, tìm kiếm, header và footer đồng bộ chiều rộng tối đa 1520px. Sidebar desktop rộng 240px.
- Từ 1440px: 3 cột; 701–1439px: 2 cột; đến 700px: 1 cột. Đến 1023px, bộ lọc nằm sau nút **Bộ lọc**.
- Hiện số tin đã tải trên tổng kết quả. Hết kết quả thì hiện **Bạn đã xem tất cả công việc**.
- API thật tiếp tục dùng `page` và `size=12`. Trang tiếp theo được nối vào danh sách; ID trùng được cập nhật tại chỗ.
- Khi đang tải thêm hoặc tải thêm thất bại, giữ các tin đã xem; có nút thử lại trang bị lỗi. Phản hồi cũ bị bỏ qua khi đổi bộ lọc.
- Đổi tìm kiếm, bộ lọc, sắp xếp hoặc nguồn dữ liệu sẽ bắt đầu lại từ 12 tin đầu. Nhấn thẻ mở trang `/jobs/:id`; quay lại bằng nút trong trang hoặc Back của trình duyệt giữ bộ lọc, sắp xếp, số tin đã tải và vị trí cuộn. Danh sách được giữ trong bộ nhớ theo tài khoản và mục lịch sử; không lưu qua reload.

Đã kiểm tra trên trình duyệt: 1600px có 3 cột, 900px có 2 cột và bộ lọc thu gọn, 390px có 1 cột; không tràn ngang. Tải 12 rồi thêm 2 tin mẫu không trùng; lọc Junior còn 5 tin, đặt lại về 12/14; mở/đóng chi tiết giữ 14 tin và vị trí cuộn. Nguồn thật trả 0 tin đang tuyển nên chưa kiểm tra tải trang thứ hai với dữ liệu database.

Frontend build và 13 tệp kiểm thử chạy thành công. Lint không có lỗi; còn một cảnh báo có sẵn trong `TopCandidatesWidget.tsx`. Chi tiết trang công việc và luồng ứng tuyển: [candidate-job-detail.md](candidate-job-detail.md).
