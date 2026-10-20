# Ý tưởng tính năng AI cho ứng dụng tuyển dụng

Danh sách này ghi lại 8 ý tưởng đã đề xuất cho sản phẩm tuyển dụng Lumi. Thứ tự giữ theo mức ưu tiên đã thống nhất trong trao đổi; trạng thái cập nhật sau khi hoàn thành triển khai Phiếu phỏng vấn thông minh cho HR (Ý tưởng 4).

## Danh sách ý tưởng

| Ưu tiên | Ý tưởng | Độ hay | Khác biệt | Ứng dụng | Công sức | Trạng thái |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | AI phỏng vấn dựa trên CV và bằng chứng dự án/GitHub | 5/5 | 4/5 | 5/5 | Cao | Tích hợp trong Ý tưởng 4 |
| 2 | AI hỏi bổ sung khi CV chưa thể hiện rõ yêu cầu của JD | 4/5 | 4/5 | 5/5 | Vừa | **Đã triển khai** |
| 3 | AI kiểm tra GitHub và đối chiếu với kinh nghiệm khai trong CV | 5/5 | 4/5 | 4/5 | Vừa–cao | **Đã triển khai** |
| 4 | AI tạo phiếu phỏng vấn riêng cho HR theo từng ứng viên | 4/5 | 3/5 | 5/5 | Vừa | **Đã triển khai** |
| 5 | AI góp ý JD và giúp HR điều chỉnh tiêu chí tuyển dụng | 4/5 | 3/5 | 4/5 | Vừa | Chưa triển khai theo luồng góp ý và điều chỉnh tiêu chí |
| 6 | Phỏng vấn mini bằng giọng nói | 5/5 | 2/5 | 4/5 | Cao | Chưa triển khai |
| 7 | Kiểm tra chứng chỉ qua nguồn của đơn vị cấp | 3/5 | 3/5 | 4/5 | Vừa–cao | Chưa triển khai |
| 8 | Theo dõi mắt/camera trong phiên phỏng vấn | Chưa chấm | Chưa chấm | Chưa chấm | Cao | Chưa triển khai; cần đánh giá kỹ trước khi cân nhắc |

## Phạm vi từng ý tưởng

### 1. AI phỏng vấn theo CV và bằng chứng dự án/GitHub

AI tạo bộ câu hỏi phỏng vấn dựa trên kinh nghiệm và dự án ứng viên khai trong CV, cùng bằng chứng công khai ứng viên cung cấp. Tính năng này đã được tích hợp trực tiếp vào Phiếu phỏng vấn thông minh (Ý tưởng 4), cung cấp bộ câu hỏi đào sâu có định hướng cho HR.

### 2. AI hỏi bổ sung khi CV chưa làm rõ yêu cầu của JD — đã triển khai

Sau khi có đánh giá CV–JD, ứng viên có thể chủ động tạo tối đa ba câu hỏi cho các tiêu chí còn thiếu hoặc mới có bằng chứng một phần. Ứng viên trả lời bằng văn bản hoặc bỏ qua; HR xem câu hỏi, căn cứ trong CV, câu trả lời và trạng thái xác minh. Câu trả lời lưu riêng, không sửa CV đã nộp, không tự thay đổi điểm hoặc vòng tuyển dụng. Xem [thiết kế và luồng sử dụng](application-clarifications.md).

### 3. AI kiểm tra GitHub và đối chiếu CV — đã triển khai

Với liên kết GitHub do ứng viên cung cấp, hệ thống tự động đối chiếu năng lực thực tế với hồ sơ ứng tuyển:
- **Thu thập dữ liệu an toàn & tối ưu**: Quét qua REST API công khai (không cần OAuth, không clone repo, không lưu mã nguồn về đĩa). Lấy danh sách repository không fork, ngôn ngữ lập trình, tần suất commit, file cấu hình (Test, Dockerfile/compose, CI/CD) và spot-check tối đa 200 dòng trong 1 file logic nghiệp vụ (Service / Hook).
- **Phát hiện tín hiệu code cục bộ (0 token AI)**: Nhận diện repo tutorial/clone mẫu bằng regex, ghi nhận tín hiệu commit ít trong dữ liệu công khai (không kết luận dùng AI/gian lận), tính % tỷ lệ ngôn ngữ theo dung lượng code.
- **Đối chiếu AI có căn cứ (Grounded Generation)**: Mô hình AI (`openai/gpt-oss-120b` / `gemini-3.1-flash-lite`) phân loại kỹ năng thành hai danh sách minh bạch:
  - `verified_skills`: Kỹ năng mà AI nhận xét có tín hiệu từ code/repo công khai; chưa xác minh danh tính hay quyền sở hữu mã nguồn.
  - `unverified_skills`: Kỹ năng trong CV nhưng chưa thấy trên GitHub, kèm khuyến nghị đạo đức nghề nghiệp *"Chưa có bằng chứng công khai; HR nên hỏi thêm trong phỏng vấn"*, tuyệt đối không kết luận ứng viên nói dối.
- **Khớp nối dự án & Gợi ý phỏng vấn**: So khớp dự án trong CV với repository tương ứng; AI đề xuất câu hỏi phỏng vấn đào sâu vào các mảng kỹ năng chưa có bằng chứng công khai.
- **Kiến trúc & Giao diện**:
  - AI Service: Router `/api/github-verify`, module `github_fetcher.py` và `github_verifier.py`.
  - Backend: Bảng cache `recruitment.application_github_verifications` (Flyway `V25`), lưu trữ JSONB, cache 24h hỗ trợ re-verify. Nguồn URL lấy từ bản CV/PDF đã nộp, không lấy từ bản sửa sau đó.
  - Frontend: Tab *"Đối chiếu GitHub"* chuyên biệt cho HR tại màn hình chi tiết đơn ứng tuyển (`/recruiter/applications/:id`).

### 4. Phiếu phỏng vấn thông minh cho HR (Interview Scorecard) — đã triển khai

Hệ thống cung cấp phiếu phỏng vấn chuẩn hóa (Interview Scorecard) được AI cá nhân hóa theo từng ứng viên:

- **Điều kiện sử dụng**: HR đã duyệt sơ tuyển và chuyển hồ sơ sang `INTERVIEW` mới được tạo, tạo lại hoặc chấm/lưu/hoàn tất phiếu. Ngoài vòng này chỉ xem phiếu đã lưu. Backend kiểm tra trạng thái trước khi gọi AI và kiểm tra lại dưới khóa dòng trước khi lưu, kể cả khi HR đổi vòng trong lúc AI đang xử lý. Điểm AI không tự chuyển vòng.
- **Tổng hợp thông minh từ 3 nguồn**: AI tự động gom các điểm mâu thuẫn/nghi vấn từ:
  1. Kỹ năng còn thiếu trong đánh giá CV–JD (`assessment_missing_skills`).
  2. Kỹ năng chưa có bằng chứng hoặc tín hiệu công khai cần hỏi thêm từ GitHub (`github_unverified_skills`, `github_vibe_flags`).
  3. Bằng chứng và câu trả lời tự khai báo trong phần hỏi bổ sung (`clarifications`).
- **Cấu trúc phân tầng chuyên nghiệp**: Chia làm 2–3 section rõ ràng: *Chuyên môn kỹ thuật cốt lõi*, *Kiểm chứng dự án & mã nguồn*, *Kỹ năng mềm & Xử lý tình huống*.
- **Tiêu chuẩn chấm điểm (Rubric) minh bạch**: Mỗi câu hỏi gồm mã câu hỏi, kỹ năng đo lường, mục tiêu kiểm chứng, gợi ý câu trả lời Đạt (Good) vs Dấu hiệu cảnh báo (Poor), thang điểm 1–5 sao và ô ghi chú phản hồi của người phỏng vấn.
- **Quyết định tuyển dụng chuẩn hóa**: Người phỏng vấn chọn mức đề xuất (*Strong Hire, Hire, Consider, No Hire*), viết nhận xét tổng kết và chốt kết quả (Draft hoặc Completed).
- **Kiến trúc & Giao diện**:
  - AI Service: Router `/api/interview-scorecard/generate`, module `interview_scorecard.py`.
  - Backend: Bảng `recruitment.application_interview_scorecards` (Flyway `V26`), Controller, Service tính điểm trung bình, lưu người phỏng vấn và phiên bản để ngăn ghi đè. V27 bổ sung version; phiếu đã chấm/ghi chú không được tái tạo câu hỏi, phiếu hoàn tất được giữ nguyên.
  - Frontend: Tab *"Phiếu phỏng vấn"* tại chi tiết đơn ứng tuyển của HR, giao diện tương tác đánh giá sao, hiển thị rubric và chốt biên bản phỏng vấn.

### 5. AI góp ý JD và tiêu chí tuyển dụng

AI rà soát JD để phát hiện yêu cầu mơ hồ, tiêu chí trùng nhau, điều kiện khó đo lường hoặc yêu cầu chưa nhất quán với cấp bậc. AI đề xuất cách viết rõ hơn và cấu trúc tiêu chí; HR xem, sửa và chủ động chấp nhận trước khi lưu JD. Ứng dụng đã có chức năng hỗ trợ soạn JD và một số công cụ đánh giá công việc, nhưng luồng góp ý rồi điều chỉnh tiêu chí theo ý tưởng này chưa hoàn thành.

### 6. Phỏng vấn mini bằng giọng nói

Ứng viên tham gia phiên hỏi đáp ngắn với câu hỏi liên quan CV và JD, trả lời bằng giọng nói. Hệ thống chuyển lời nói thành văn bản và tạo bản tóm tắt để HR xem lại. Cần có sự đồng ý rõ ràng, cho phép ứng viên xem lại bản chép lời và không tự động loại ứng viên dựa trên giọng, giọng địa phương, khuyết tật hoặc điều kiện thiết bị.

### 7. Xác minh chứng chỉ qua nguồn của đơn vị cấp

Khi có cổng xác minh hoặc API chính thức, ứng viên cung cấp thông tin cần thiết và hệ thống tra cứu trạng thái chứng chỉ. Lưu nguồn, thời điểm và kết quả tra cứu. Nếu đơn vị cấp không có API/cổng công khai thì đánh dấu chưa xác minh và chuyển HR kiểm tra thủ công, không suy đoán tính thật giả từ ảnh chứng chỉ.

### 8. Theo dõi mắt/camera trong phiên phỏng vấn

Ý tưởng ban đầu là nhận biết dấu hiệu rời mắt khỏi màn hình trong lúc phỏng vấn. Chưa triển khai. Không dùng hướng nhìn hoặc tín hiệu camera để kết luận gian lận hay quyết định tuyển dụng: các tín hiệu này dễ sai do khuyết tật, cách giao tiếp, ánh sáng, thiết bị và khác biệt cá nhân. Chỉ cân nhắc nếu có mục đích cụ thể, đồng ý rõ ràng, phương án thay thế không dùng camera và quy trình người thật kiểm tra.

## Thứ tự triển khai tham khảo

1. **[Đã hoàn thành]** Hoàn thiện tính năng hỏi bổ sung (ý tưởng 2) theo CV và JD với kiểm chứng quyền sở hữu và CSRF.
2. **[Đã hoàn thành]** Kiểm tra GitHub và đối chiếu với kinh nghiệm CV (ý tưởng 3) kết hợp thuật toán phân tích code tĩnh và AI grounded.
3. **[Đã hoàn thành]** Phiếu phỏng vấn thông minh (Interview Scorecard) riêng cho HR may đo theo từng ứng viên (kết hợp ý tưởng 1 và 4).
4. Xây dựng góp ý JD và tiêu chí có HR duyệt (ý tưởng 5).
5. Thử phỏng vấn giọng nói (ý tưởng 6) sau khi xác định quy trình đồng ý, lưu trữ âm thanh/bản chép lời và xem lại.
6. Chỉ xác minh chứng chỉ tự động (ý tưởng 7) khi có nguồn chính thức phù hợp.
7. Chưa đưa theo dõi mắt/camera (ý tưởng 8) vào chấm điểm hoặc quyết định tuyển dụng.
