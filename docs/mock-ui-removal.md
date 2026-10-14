# Loại bỏ dữ liệu mẫu trên giao diện

Cập nhật 14/10/2026.

Danh sách việc, trang chi tiết, HR và đối chiếu AI dùng API. Tham số `data=sample` không còn bật dữ liệu giả. Bỏ nút Xem mẫu, hồ sơ mẫu và kết quả AI mẫu. Fixture được giữ riêng trong `frontend/tests/fixtures` để kiểm thử.

Admin đọc tin và phòng ban từ API; tài khoản, nhật ký và cài đặt chưa có API quản trị được ghi rõ chưa kết nối. Không còn thao tác giả báo thành công. Không xóa tài khoản hoặc dữ liệu trong database; tin được seed trước đây vẫn là bản ghi API. Hình minh họa marketing có nhãn minh họa, không phải kết quả ứng viên.

Lưu tin hiện chỉ tồn tại trong phiên giao diện và tách theo tài khoản, chưa lưu database. Kiểm tra: 19 tệp frontend test qua; build qua; lint còn cảnh báo TopCandidatesWidget có sẵn. Trình duyệt đã kiểm tra URL cũ có data=sample vẫn tải 6 tin qua API, không bật dữ liệu mẫu.
