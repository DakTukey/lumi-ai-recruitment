# Danh mục vị trí trong form tuyển dụng

Form thật và form mẫu dùng thứ tự: phòng ban → vị trí/chức danh → cấp độ → số lượng → tiêu đề tin. Vị trí thật lấy từ database, không nhập tự do. Tiêu đề được gợi ý theo cấp độ và chức danh, HR vẫn có thể chỉnh; đổi cấp độ/chức danh không ghi đè tiêu đề đã chỉnh. Có nút dùng lại tiêu đề gợi ý.

Địa điểm trong form tạo/sửa tự điền theo một văn phòng hiện tại của công ty: Văn phòng/Hybrid dùng Đà Nẵng; Remote dùng “Làm việc từ xa”. Trường chỉ đọc. Giá trị nằm trong bản nháp để phần xem trước và dữ liệu gửi lưu thống nhất. Giao diện AI hỗ trợ viết JD cũng dùng cách điền này. Chưa thêm danh mục nhiều văn phòng hay đổi quy tắc API backend; tin cũ trong database không bị sửa tự động.

Đổi phòng ban xóa vị trí cũ. Có trạng thái đang tải, lỗi/tải lại và danh mục trống. Form không còn tạo phòng ban trực tiếp.

## Database và API

- Migration `V14__job_positions.sql` tạo `recruitment.job_positions`: `id`, `department_id`, `name`, `is_active`, `created_at`, `updated_at`. Tên không trùng trong cùng phòng ban, không phân biệt hoa/thường.
- `recruitment.jobs.position_id` liên kết qua khóa ngoại ghép `(position_id, department_id)` để ngăn vị trí thuộc sai phòng ban.
- Không suy đoán chức danh hay đổi tiêu đề của tin cũ. Cột mới cho phép null để giữ dữ liệu cũ; API tạo/sửa và đăng/mở lại yêu cầu chọn vị trí hợp lệ.
- `GET /api/recruiter/positions?departmentId=<uuid>` trả các vị trí đang hoạt động thuộc phòng ban hoạt động. Chỉ RECRUITER/COMPANY_ADMIN được gọi.
- API tạo/sửa nhận `positionId`; dữ liệu trả về có `positionId`, `positionName`, `title`. Lịch sử sửa và snapshot JD lúc ứng tuyển giữ cả chức danh.
- Danh mục ban đầu được thêm cho các phòng ban có tên nhận diện trong migration. Database local hiện có phòng IT, với 7 vị trí. Không tự tạo thêm phòng ban.
- Trang Admin quản lý danh mục vị trí thật chưa nằm trong thay đổi này. Phòng ban chưa có danh mục sẽ hiển thị thông báo, không cho nhập chức danh tùy ý.

## Kiểm tra

76 kiểm thử backend thành công trên database test riêng, gồm migration không đổi tiêu đề cũ, khóa ngoại phòng ban, danh mục theo quyền, chức danh bắt buộc, sai phòng ban, chức danh ngừng sử dụng và luồng tạo/sửa/đăng tin. Frontend build, lint và 6 file kiểm thử đều thành công.

Kiểm tra trình duyệt localhost: chọn IT tải 7 vị trí; chọn Backend Developer/Senior tự tạo tiêu đề; tiêu đề tùy chỉnh được giữ khi đổi cấp độ; bỏ phòng ban xóa chức danh.

Backend local đã khởi động lại và áp dụng V14 thành công. Không tạo thêm tin tuyển dụng để kiểm tra trên database ứng dụng.
