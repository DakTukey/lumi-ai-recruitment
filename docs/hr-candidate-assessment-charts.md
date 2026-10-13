# Biểu đồ đánh giá AI từng ứng viên

Đường dẫn: HR → Tin tuyển dụng → Tổng hợp AI → Xem đánh giá AI; hoặc Tất cả đơn ứng tuyển → Xem đánh giá AI của ứng viên.

## Nội dung

- Thanh ngang cho mỗi kỹ năng/tiêu chí, ghi điểm đóng góp / điểm tối đa. Độ dài thanh thể hiện tỷ lệ điểm đạt của riêng tiêu chí.
- Chọn thanh bằng chuột hoặc bàn phím để xem nguồn, trích dẫn CV và lý do chấm điểm bên dưới.
- Vòng tròn đếm các tiêu chí khớp CV/JD, cần làm rõ và chưa có bằng chứng. Đây là số lượng tiêu chí, không phải tỷ lệ năng lực, độ tin cậy hay điểm phù hợp tổng.
- Hồ sơ chưa có kết quả không được quy đổi thành điểm 0 và không có biểu đồ giả.

## Dữ liệu

Hai màn đánh giá mẫu và đánh giá thật dùng chung thành phần `AssessmentCharts`.

Kết quả thật: API lưu `points` là mức đáp ứng 0–100, `weight` là trọng số. Điểm đóng góp = points × weight / tổng trọng số; điểm tối đa = 100 × weight / tổng trọng số. Trọng số 0 không đóng góp điểm. Điểm tổng giữ nguyên từ kết quả đã lưu; số trên biểu đồ làm tròn tối đa hai chữ số thập phân. Nhãn bắt buộc/ưu tiên chỉ lấy từ bản JD lưu lúc ứng tuyển khi xác định được duy nhất tiêu chí cùng tên; nếu không sẽ hiển thị trọng số.

Dữ liệu mẫu: `points` đã là điểm đạt và `weight` là điểm tối đa. Không áp dụng phép quy đổi của API lần nữa. Ví dụ Minh Anh: 40/40 + 30/30 + 0/20 + 8/10 = 78/100.

Không thay đổi cách chấm điểm, không gọi phân tích AI tự động, không thêm thư viện biểu đồ. Dùng SVG và CSS; hai cột trên màn hình rộng, một cột ở chiều rộng tối đa 700px.

## Kiểm tra

- Frontend build, lint và 7 tệp kiểm tra đều qua.
- Kiểm tra công thức: trọng số 2/1, điểm mẫu, trọng số 0, danh sách trống, đếm PARTIAL thành cần làm rõ, giữ nguyên dữ liệu đầu vào.
- Trình duyệt: hồ sơ Minh Anh hiển thị bốn tiêu chí và vòng tròn 2/1/1; chọn UI/UX hiển thị đúng bằng chứng và lý do; Tab/Enter chọn TypeScript; chuyển sang Quang Huy đang phân tích không còn biểu đồ; mở lại Minh Anh chọn mặc định React.
- Đã kiểm tra bố cục ở kích thước trình duyệt hiện tại và cấu hình CSS cho màn hình nhỏ; chưa đổi kích thước trình duyệt để kiểm tra breakpoint.
- Chưa kích hoạt phân tích AI thật trong lượt này. Luồng dữ liệu thật được tích hợp và kiểm tra biên dịch; kết quả hiển thị dùng bản đánh giá đã lưu qua API hiện có.

Ảnh: `hr-candidate-assessment-charts.png`, `hr-candidate-assessment-evidence.png`.

## Radar mức đáp ứng CV/JD

Thêm radar trước phần bằng chứng và thanh điểm. Mọi trục đều dùng mức đáp ứng 0–100, không dùng điểm đóng góp đã nhân trọng số. Với mẫu Minh Anh, giá trị radar là React 100, TypeScript 100, UI/UX 0, kinh nghiệm thực tế 80; tổng điểm mẫu vẫn là 78/100.

- Lưới cố định 25/50/75/100, đường ngoài nét đứt là mốc 100. Hình tô tím là mức đáp ứng từ CV. Màu điểm thể hiện trạng thái bằng chứng.
- Tên dài được xuống dòng/rút gọn trên hình; danh sách nút giữ nguyên tên và số điểm. Chọn tiêu chí cập nhật cùng trạng thái với thanh điểm và bằng chứng ngay dưới radar.
- Dưới 3 tiêu chí: giải thích chưa đủ trục và giữ các thanh điểm. Không thêm tiêu chí giả.
- Trên 8 tiêu chí: chia thành các nhóm cân bằng, mỗi nhóm 3–8 trục, có điều hướng và số nhóm. Không bỏ tiêu chí; chọn thanh ở nhóm khác sẽ đưa radar sang đúng nhóm.
- Không thay đổi thuật toán hay điểm tổng, không kích hoạt AI mới. Dùng dữ liệu đánh giá thật đã lưu và mẫu thông qua thành phần chung.
- Bố cục theo chiều rộng vùng nội dung, có mô tả SVG cho trình đọc màn hình và nút tiêu chí dùng được bằng bàn phím.

Kiểm tra bổ sung: công thức tọa độ có thang cố định, điểm 0 tại tâm, chia nhóm 3–200 tiêu chí không mất trục hoặc tạo nhóm dưới 3, tên dài tối đa hai dòng. Trình duyệt xác nhận chọn UI/UX cập nhật bằng chứng và thanh điểm; Quang Huy đang phân tích không hiện radar. Đã xem bố cục ở kích thước cửa sổ hiện tại; chưa kiểm tra mọi breakpoint hay gọi lại AI thật.

Ảnh radar: `hr-candidate-radar.png`.
