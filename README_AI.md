# AI trong Lumi Recruitment

Tài liệu mô tả luồng hiện tại, cập nhật 20/10/2026. CV Builder và trợ lý viết/rà soát trong Builder đã ngừng ở giao diện ứng viên mới; source cũ không đồng nghĩa người dùng còn sử dụng được những chức năng đó.

## Cách ứng dụng kết nối mô hình

Frontend gọi Spring Boot bằng phiên đăng nhập và CSRF. Backend phân quyền, lấy dữ liệu từ database, gọi FastAPI. FastAPI xây prompt, giới hạn đầu vào, yêu cầu JSON theo schema rồi kiểm tra đầu ra trước khi trả kết quả. Backend lưu kết quả gắn với hồ sơ để mở lại không phải gọi AI mỗi lần.

Mặc định dùng Groq và Gemini qua API; có token/quota và cần mạng. Không có bước tự huấn luyện model trong dự án hiện tại. Ollama/Qwen chỉ hoạt động khi chủ động cấu hình provider cục bộ; bản demo cloud không cần server Ollama.

## Các luồng đang cung cấp

| Luồng | Vai trò và hành vi |
| --- | --- |
| Đọc CV PDF | Giữ bản gốc; trích văn bản từ PDF có chữ hoặc dùng khả năng đọc ảnh cho scan; map về schema chung, lưu căn cứ/cảnh báo và cho ứng viên đối chiếu, sửa, xác nhận |
| Đối chiếu CV–JD trước ứng tuyển | Dùng PDF đã xác nhận, JD và tiêu chí hiện tại; trả mức đáp ứng cùng bằng chứng, lưu cache theo dữ liệu đầu vào |
| Tóm tắt JD | Tóm tắt công việc/yêu cầu/quyền lợi, kèm trích dẫn từ JD; không tự đăng hay thay JD |
| Đánh giá hồ sơ đã nộp | Hàng đợi phân tích độc lập với nộp đơn; dùng bản CV/JD cố định, retry có giới hạn; HR có thể yêu cầu phân tích lại |
| Hỏi bổ sung | Tối đa 3 yêu cầu cần làm rõ; ứng viên trả lời hoặc bỏ qua; không tự đổi điểm hay vòng tuyển dụng |
| Đối chiếu GitHub | HR dùng liên kết trong đúng CV đã nộp; chỉ đọc dữ liệu công khai. Không xác minh tài khoản thuộc ứng viên, quyền sở hữu code hay phát hiện dùng AI/gian lận |
| Phiếu phỏng vấn | Chỉ tạo/chấm khi HR đã chuyển hồ sơ sang vòng Phỏng vấn. Tổng hợp CV/JD, kỹ năng cần hỏi thêm, GitHub và câu trả lời bổ sung; HR chấm 1–5, ghi chú, lưu nháp và hoàn tất. Ngoài vòng Phỏng vấn chỉ xem phiếu đã lưu |
| Nhập/soạn JD | AI đưa nội dung vào bản nháp để HR xem và sửa trước khi lưu/đăng |
| Soạn email | Tạo nội dung nháp từ ngữ cảnh hồ sơ; HR duyệt và tự gửi bằng công cụ khác. Chưa có tự gửi email |

Phân vị/so sánh nhóm ứng tuyển là phép thống kê từ kết quả đã lưu, không phải một lần gọi LLM mới; cần đủ số mẫu phù hợp mới hiển thị. Danh sách xếp theo điểm là gợi ý thứ tự xem hồ sơ, không phải quyết định tuyển dụng.

## Luồng demo đề xuất

1. HR tạo hoặc mở một JD có tiêu chí rõ ràng, đang tuyển và còn hạn.
2. Ứng viên tải CV PDF tự dựng có kỹ năng, dự án và liên kết GitHub được phép sử dụng; mở PDF và kiểm tra thông tin AI đọc.
3. Nộp hồ sơ. Hệ thống tiếp nhận PDF ngay cả khi AI tạm lỗi; tiến độ phân tích hiển thị riêng.
4. Khi có đánh giá, ứng viên tạo câu hỏi bổ sung và gửi một câu trả lời, bỏ qua một câu khác.
5. HR mở đơn, đối chiếu PDF gốc với tiêu chí/trích dẫn, xem phần trả lời bổ sung có nhãn chưa xác minh.
6. HR mở GitHub. Nếu PDF chưa đọc/chưa có link, UI giải thích trạng thái; thiếu GitHub không được xem là thiếu năng lực.
7. HR mở mục Chuyển vòng, duyệt sơ tuyển và chuyển hồ sơ qua Đang xem xét → Phỏng vấn. Sau đó mở Phiếu phỏng vấn, tạo câu hỏi/tiêu chí, chấm thử trên dữ liệu giả và lưu. Tải lại để chứng minh dữ liệu còn nguyên. Chỉ hoàn tất khi đã chấm đủ câu và chọn đề xuất.
8. Chuyển vòng bằng thao tác của HR. Giải thích rõ điểm AI/câu trả lời không tự chuyển vòng.

Phiếu có điểm/ghi chú hoặc đã hoàn tất được bảo vệ khỏi tạo lại câu hỏi. Phiếu hoàn tất giữ nguyên biên bản. Phiên bản lưu ngăn hai tab HR ghi đè; khi xung đột, người dùng tải bản mới nhất.

Giao diện và API đều khóa tạo/tạo lại/lưu/hoàn tất khi trạng thái hồ sơ khác `INTERVIEW`. Phiếu cũ vẫn xem được ở mọi vòng mà HR có quyền truy cập. Backend kiểm tra lại trạng thái dưới khóa dòng ngay trước khi lưu kết quả AI; nếu HR chuyển vòng trong lúc AI chạy, yêu cầu bị từ chối và phiếu cũ được giữ nguyên. HR quyết định chuyển vòng, điểm AI không tự mở quyền tạo phiếu.

## Phạm vi kiểm chứng

- Schema và giới hạn dữ liệu giúp tránh JSON sai dạng. Chúng không chứng minh toàn bộ nhận xét AI đúng nội dung.
- Đánh giá CV–JD kiểm tra trích dẫn có trong nguồn và tính điểm từ trọng số server. Đây là mức đáp ứng theo thông tin cung cấp, không phải xác suất trúng tuyển hay chứng nhận năng lực.
- Câu trả lời bổ sung do ứng viên tự khai, chưa xác minh. Phiếu phỏng vấn dùng nó làm ngữ cảnh để HR kiểm chứng tiếp.
- GitHub công khai có thể thiếu repo công ty/private, lịch sử commit hoặc quyền sở hữu. Tín hiệu thiếu test/Docker/CI chỉ áp dụng cho phần dữ liệu đã đọc; không dùng làm kết luận tuyệt đối.
- Chưa có đối chiếu chứng chỉ với cơ sở dữ liệu đơn vị cấp. Nhận diện domain liên kết không phải xác minh chứng chỉ.
- Các bài unit/integration dùng provider giả lập kiểm tra logic; lần gọi provider thật được ghi riêng trong báo cáo demo.

## Khi AI lỗi hoặc hết quota

PDF scan/bố cục nhiều cột: thử Groq vision (`GROQ_VISION_MODEL`, mặc định `qwen/qwen3.8-27b`) với ảnh từng trang; model này nhận tối đa 3 trang. CV dài hơn không bị cắt trang mà chuyển toàn bộ PDF sang Gemini (`GEMINI_CV_MODEL`, mặc định `gemini-3.8-flash`). Gemini cũng dự phòng khi Groq tạm lỗi/JSON không hợp lệ, dùng schema gọn và mức suy luận thấp. Kiểu dữ liệu và giới hạn gốc vẫn được kiểm tra tại server. Tối đa 20 giây mỗi provider, tổng 45 giây; không dùng provider khác để vượt từ chối nội dung, không dùng model chỉ đọc chữ cho scan. Cả hai đều là API dùng mạng/quota, không tải Qwen/Ollama về máy.

Giới hạn token/phút vẫn có thể xuất hiện khi đọc nhiều CV liên tiếp. Yêu cầu Groq vision dùng mẫu JSON gọn thay vì lặp toàn bộ JSON Schema trong prompt. Khi gặp 429, server ghi nhận `Retry-After`, thử lại tối đa một lần nếu thời gian chờ không quá 15 giây trong ngân sách 20 giây; hạn dài hơn được giữ để tránh gọi dồn. Nếu Gemini cũng không trả được kết quả, AI service trả 429 kèm thời gian chờ, backend hiển thị thông báo giới hạn API và không tính lần đó vào 3 lượt đọc tài liệu. Cơ chế này không làm quota trở thành vô hạn.

Giữ PDF gốc, đơn đã nộp và kết quả cũ đã lưu. Hiển thị chưa có kết quả thay vì ghi điểm 0 hoặc bịa kết quả. Chờ/thử lại theo giới hạn; HR vẫn có thể xem hồ sơ và xử lý thủ công. Chuẩn bị một bộ kết quả đã lưu/ảnh hoặc video của cùng dữ liệu demo để trình bày khi mạng không khả dụng, và gọi đúng đó là kết quả đã lưu.

## Câu trả lời ngắn khi trình bày

**Ứng dụng giải quyết việc gì?** Giúp HR đọc hồ sơ theo cùng tiêu chí, xem bằng chứng và đặt câu hỏi cụ thể; ứng viên có cơ hội giải thích phần CV chưa kể rõ.

**Khác biệt chính là gì?** Luồng nối từ PDF gốc, tiêu chí JD, bằng chứng, hỏi bổ sung đến phiếu HR chấm và lịch sử xử lý, thay vì chỉ hiển thị một điểm số tổng.

**AI có tự quyết định tuyển ai không?** Không. HR đọc kết quả, kiểm chứng, phỏng vấn, chấm phiếu và chủ động chuyển vòng.

**Có cần train model không?** Hiện dùng model có sẵn qua API, prompt, schema và kiểm tra dữ liệu. Chưa fine-tune; muốn chứng minh tốt hơn cần bộ CV/JD có đáp án đối chiếu và đo chất lượng.

**Phỏng vấn mini để làm gì?** Đây vẫn là ý tưởng tương lai. Phiếu phỏng vấn hiện tại giúp người HR hỏi trực tiếp, chưa có phiên AI hỏi đáp bằng voice/camera.

Chi tiết: [hỏi bổ sung](docs/application-clarifications.md), [ý tưởng](docs/ai-feature-ideas.md), [báo cáo demo](docs/demo-readiness-2026-10-20.md).
