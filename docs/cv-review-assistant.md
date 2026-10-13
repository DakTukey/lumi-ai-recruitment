# AI rà soát và hoàn thiện CV

Cập nhật: 13/10/2026.

CV Builder có khối “AI rà soát & hoàn thiện CV” phía trên các bước nhập. Luồng: rà soát → xem căn cứ → trả lời câu hỏi → xem trước/sau → áp dụng từng mục → lưu CV. Có thể hoàn tác từng đề xuất trước khi sửa tay. Các nút viết rõ hơn/rút gọn trong từng trường vẫn là công cụ phụ.

API:
- POST `/api/candidate/cv-review`: `{resume, jobId?}`.
- POST `/api/candidate/cv-review/refine`: `{resume, jobId?, target:{section,index}, answer}`.

Chỉ ứng viên ACTIVE, có CSRF, được gọi. Dùng chung giới hạn với trợ lý viết CV: mỗi tài khoản một yêu cầu đang chạy, toàn dịch vụ tối đa hai yêu cầu. Đầu vào là bản CV đang sửa, không bắt buộc lưu trước. Java tự lấy job đang được công khai từ `jobId`, không nhận JD do client tự thay. Job không tồn tại/đã đóng trả 404. Khi không có job, hiển thị rõ rà soát nội dung chung.

Dữ liệu gửi tới AI gồm nội dung năng lực, học vấn, các mục CV và JD liên quan. Không tự gửi họ tên, email, số điện thoại, địa chỉ hoặc liên kết tài khoản cá nhân. Mô tả và URL dự án/chứng chỉ là nội dung người dùng chủ động đưa vào CV. Không ghi prompt, nội dung CV, câu trả lời hay phản hồi nhà cung cấp vào log. Chỉ ghi tên nhà cung cấp và mã lỗi đã được giới hạn vào danh sách an toàn.

Rà soát tối đa 6 đề xuất, mỗi mục chỉ một đề xuất:
- ADD: hỏi thông tin để bổ sung mục trống.
- CLARIFY: hỏi làm rõ phần phụ trách/kết quả còn sơ sài.
- REWRITE: đề xuất viết lại nội dung đã có đủ căn cứ.

Chỉ cho phép sửa `summary` (index -1), `experiences[index].description`, `projects[index].description`. Học vấn, kỹ năng và các phần khác là ngữ cảnh. Không tự thêm kinh nghiệm hoặc dự án mới. Mỗi nhận xét có căn cứ trích nguyên văn CV/JD nếu có. Backend và Python kiểm tra mục/index, chống đề xuất trùng và kiểm tra trích dẫn thực sự tồn tại. Có thể bỏ nhãn định dạng kiểu `description: "..."` khi phần trích bên trong khớp chính xác nguồn; không chấp nhận bằng chứng bịa.

Đề xuất sửa chỉ dùng sự kiện trong CV/câu trả lời; JD là yêu cầu tuyển dụng, không là bằng chứng năng lực. Kiểm tra số liệu, URL mới; chặn kỹ năng từ danh mục JD chưa xuất hiện trong nguồn và lời hướng dẫn/nhận xét bị trả nhầm vào phần văn bản CV. Các kiểm tra không chứng minh mọi câu đúng về ngữ nghĩa, vì vậy người dùng cần đọc trước khi áp dụng. Không chấm điểm CV hay dự đoán khả năng trúng tuyển.

Thay đổi nội dung CV, xóa/sắp xếp mục hoặc đổi job khiến đề xuất cũ không áp dụng được. Sửa câu trả lời cũng khóa đề xuất đã tạo từ câu trả lời cũ. Áp dụng cập nhật đúng trường và live preview; không tự lưu database. Sau khi áp dụng một mục, các đề xuất khác vẫn có thể được duyệt nếu không có sửa tay. Hoàn tác cũng chỉ tác động mục tương ứng. Gọi AI không tạo/sửa bản CV trong database.

Groq là nguồn chính, Gemini dự phòng. Rà soát sử dụng giới hạn 8 giây cho Groq, 16 giây cho Gemini, tổng tối đa 26 giây; mỗi nhà cung cấp chỉ một lần mỗi yêu cầu, có cooldown sau lỗi. Java mặc định timeout 30 giây (cấu hình local hiện 60 giây), frontend rà soát CV chờ 45 giây. Lỗi giữ nguyên CV/câu trả lời và cho thử lại; không thay bằng kết quả giả.

Kiểm tra tự động: các kiểm thử frontend về dữ liệu gửi, áp dụng/hoàn tác một mục và vô hiệu hóa đề xuất cũ; Python về target, căn cứ, số liệu/liên kết, kỹ năng JD, nội dung văn bản và dự phòng; PostgreSQL integration trên database riêng về phân quyền, CSRF, giới hạn, không ghi CV, job lấy từ server, lỗi/timeout và phục hồi. Có CV/tài khoản `.example.test` riêng cho kiểm thử trình duyệt; không dùng CV người thật.
