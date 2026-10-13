# Số hồ sơ đã nộp trên trang chi tiết công việc

- API công khai `/api/jobs` và `/api/jobs/{id}` trả thêm `applicationCount`.
- Đếm số dòng trong `recruitment.applications` của đúng job, bao gồm mọi trạng thái xử lý (kể cả đã loại/rút). Đây là tổng hồ sơ từng gửi, không phải số ứng viên còn trong vòng tuyển.
- CV đã tạo và kết quả AI đối chiếu không phải đơn ứng tuyển, không được tính. Một ứng viên chỉ có một đơn cho mỗi job theo ràng buộc database; nộp trùng không tăng số đếm.
- Chỉ trả số tổng hợp, không công khai danh tính, CV hoặc điểm AI của ứng viên khác.
- Hiện “Hồ sơ đã nộp: 0 hồ sơ” khi job chưa nhận đơn. Tin mẫu hoặc API chưa có số liệu hiện “Chưa thống kê”, không dựng số giả.
- Đặt cạnh “Số lượng tuyển” ở phần thông tin đầu trang. Desktop có năm ô; mobile có ô lương toàn chiều rộng, bốn ô còn lại xếp hai cột.
- Sau khi ứng tuyển thành công, form yêu cầu tải lại chi tiết job để cập nhật số đếm. Không cần sửa schema hoặc lưu cột đếm dễ sai lệch; truy vấn danh sách gộp số lượng cho toàn bộ job của trang trong một lượt.

Kiểm tra: integration test số 0 → 1 → 2, nộp trùng, phân biệt hai job, mọi trạng thái, truy cập khách và không lộ danh tính; public job API/ứng tuyển/CV AI liên quan qua. Build frontend và lint qua (còn cảnh báo TopCandidatesWidget có sẵn).
