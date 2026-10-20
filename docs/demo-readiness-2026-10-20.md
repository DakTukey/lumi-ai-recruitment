# Rà soát khả năng demo — 20/10/2026

## Trạng thái sau khi sửa

Đã sửa các lỗi code trong báo cáo: route GitHub/scorecard; nguồn URL từ PDF nộp trực tiếp; bảo vệ điểm/ghi chú và khóa phiếu hoàn tất; phiên bản chống ghi đè; nhận câu trả lời bổ sung; trạng thái lỗi/tải lại; fixture migration; nội dung README/Settings. V27 bổ sung version của phiếu. Báo cáo ban đầu bên dưới giữ lại để tra nguyên nhân.

Kiểm tra sau sửa: toàn bộ lượt backend 128 bài đạt, không lỗi/bỏ qua (104 luồng + 18 migration + 6 unit); tiếp đó 14 bài luồng GitHub/phiếu/hỏi bổ sung chạy lại đạt, gồm một bài GitHub mới. Frontend build và 24 tệp kiểm thử đạt, lint sạch; Python 90 bài đạt. Các bài database dùng database riêng và provider giả lập; không gửi CV hiện có lên AI. Kết quả live sau sửa được ghi bổ sung ở cuối tài liệu.

Phần còn cần diễn tập trực tiếp: công cụ trình duyệt vẫn bị tắt quyền local browser use. Đây là giới hạn kiểm tra UI live, không thay cho kết quả kiểm thử API/database. Các giới hạn về tính xác thực ngữ nghĩa của AI/GitHub, việc làm đã lưu trong phiên, email/lịch/voice/camera/chứng chỉ là phạm vi sản phẩm hiện tại, không được quảng bá là đã có.

## Kết luận ban đầu

Luồng tuyển dụng cốt lõi có đủ thành phần để trình diễn: tải PDF, nộp đơn, phân tích CV–JD, hỏi bổ sung, HR xem hồ sơ và chuyển vòng. Chưa nên đánh dấu toàn bộ bản demo hoàn tất: hai tab GitHub/phiếu phỏng vấn đang bị chặn bởi bộ phân tích route, và một số hành vi của phiếu phỏng vấn chưa đúng mô tả.

Rà soát thực hiện trên commit `9c4d845`. Không sửa logic sản phẩm trong lượt rà soát này. Đã khởi động lại ba server và để backend cập nhật schema demo từ V24 lên V26. Không gửi CV/JD hiện có trong database đến nhà cung cấp AI; các yêu cầu thử AI dùng dữ liệu hoàn toàn giả lập.

## Kết quả kiểm tra mới

| Hạng mục | Kết quả |
| --- | --- |
| Frontend build | Thành công |
| Frontend tests | 24/24 đạt |
| Frontend lint | Không có lỗi chặn; còn 2 cảnh báo tại ApplicationClarifications và TopCandidatesWidget |
| Python tests | 90/90 đạt; phần gọi nhà cung cấp trong bộ unit test được giả lập |
| Backend LoginFlowTest | 100/100 đạt, không bỏ qua; PostgreSQL riêng, dịch vụ AI giả lập |
| Backend kiểm thử migration và unit bổ sung | Tổng lượt Maven: 124 bài, 123 đạt, 1 lỗi, không bỏ qua |
| Bài backend lỗi | AccountSchemaMigrationTest.recruitmentRepositoriesPersistRelationsAndRejectStaleJobUpdates: fixture cố tạo kỹ năng Spring Boot đã tồn tại, vi phạm skills_normalized_name_unique |
| Đóng gói backend | Thành công với `-DskipTests`; không dùng kết quả này để tuyên bố mọi test đều đạt |
| Endpoint hỏi bổ sung, AI thật | HTTP 200, 1 câu hỏi, khoảng 1,2 giây với dữ liệu giả |
| Endpoint phiếu phỏng vấn, AI thật | HTTP 200, 3 nhóm/7 câu hỏi, khoảng 3,6 giây với dữ liệu giả |
| Model thực sự trả kết quả | groq/openai/gpt-oss-120b |
| Frontend 5173 / Backend 8080 / FastAPI 8000 | Đã khởi động lại, kiểm tra HTTP 200 |
| PostgreSQL | Hoạt động; V25 và V26 đã được áp dụng vào database demo |
| Dữ liệu demo | 6 tin công khai còn hạn; 8 đơn ứng tuyển; 9 kết quả đánh giá; 3 PDF đã đọc, 1 PDF lỗi, 1 PDF chưa đọc tại thời điểm kiểm tra |
| Giao diện live | Chưa chạy lại bằng công cụ điều khiển trình duyệt: Work vẫn báo local browser use bị tắt |

## Việc cần sửa trước khi trình diễn phần mở rộng

### P1 — Hai tab mới không mở được trong trang hồ sơ HR

- `frontend/src/features/applications/components/SubmittedApplicationDetail.tsx` tạo nút `github` và `scorecard`.
- `frontend/src/features/jobs/recruiter-route.ts` chưa đưa hai giá trị này vào `applicationTabs`; `parseRecruiterRoute` trả về `cv` khi nhận tab lạ.
- Đã chạy trực tiếp hàm route: `github → cv`, `scorecard → cv`, `clarifications → clarifications`.
- Cần thêm hai tab và kiểm tra bấm tab, tải lại, mở liên kết trực tiếp.

### P1 — PDF nộp trực tiếp có thể mất đường vào tính năng GitHub

- Nút GitHub hiện chỉ xuất hiện khi `app.resumeSnapshot.githubUrl` có giá trị.
- `ApplicationService.submit` tạo snapshot tối thiểu khi gửi PDF không kèm phiên bản đã xác nhận; snapshot này không có githubUrl. Dữ liệu bóc tách sau đó không được chép ngược vào snapshot bất biến.
- Vì vậy PDF có GitHub và được phân tích sau khi nộp vẫn có thể không hiện nút GitHub.
- Cần hiển thị tab với trạng thái phù hợp và lấy nguồn thông tin theo bản PDF đã nộp như backend, giữ nguyên snapshot gốc.

### P1 — Tạo lại phiếu có thể xóa phần HR đã chấm

- Frontend có nút tạo lại câu hỏi ngay cả khi phiếu đã hoàn tất.
- `InterviewScorecardService.generate(force=true)` thay toàn bộ sections bằng câu hỏi mới có score=null/notes rỗng.
- Câu lệnh cập nhật không đặt lại status, overall_score, recommendation hoặc overall_notes, nên có thể giữ nhãn COMPLETED/điểm tổng cũ trên bộ câu hỏi mới chưa chấm.
- Cần khóa thao tác trên phiếu đã chấm/hoàn tất hoặc tạo phiên bản phiếu mới; có kiểm tra xung đột và bảo toàn dữ liệu đã lưu.

### P2 — Phiếu chưa nhận câu trả lời bổ sung

- UI/tài liệu mô tả tổng hợp CV, GitHub và phần làm rõ của ứng viên.
- Payload trong `InterviewScorecardService.generate` hiện chỉ có CV/JD, missing skills và tín hiệu GitHub. Không đọc bảng application_clarification_questions; model Python cũng không nhận trường câu trả lời.
- Cần nối dữ liệu này hoặc điều chỉnh mô tả. Không trình bày như một chức năng đã hoàn thành trước khi nối.

### P2 — Lỗi tải phiếu bị che thành đang tải mãi

- `InterviewScorecard.tsx` đặt error khi GET thất bại, nhưng data vẫn là undefined.
- Nhánh `if (data === undefined)` trả màn hình đang tải trước khi render thông báo lỗi.
- Cần trạng thái lỗi rõ ràng và nút thử lại; giữ nội dung cũ khi làm mới thất bại.

## Các giới hạn cần trình bày đúng

- Đối chiếu GitHub là gợi ý từ dữ liệu công khai; chưa xác minh quyền sở hữu tài khoản/repository hoặc năng lực cá nhân. Bộ normalize chưa đối chiếu trích dẫn với dữ liệu repo như luồng đánh giá CV–JD. Không quảng bá là xác minh chắc chắn hay phát hiện sử dụng AI/gian lận.
- Cờ repo ít commit/template là tín hiệu để hỏi thêm; không chứng minh ứng viên dùng AI. Bộ fetch chỉ lấy tối đa 10 commit gần nhất và tìm file theo phạm vi giới hạn.
- SavedJobsProvider vẫn lưu bằng useState: tải lại trang mất danh sách việc làm đã lưu. Không dùng mục này làm ví dụ về dữ liệu lưu bền vững.
- Chưa thấy luồng ứng viên tự rút đơn, gửi email tự động, đặt lịch phỏng vấn thật, phỏng vấn voice/camera hoặc xác minh chứng chỉ qua đơn vị cấp.
- Tính năng soạn email là tạo nội dung; không đồng nghĩa email đã được gửi.
- Trang Settings đang ghi phiên JWT trong khi backend dùng session/cookie; đang hứa gửi email tự động và không chia sẻ bên thứ ba trong khi AI cloud có nhận dữ liệu xử lý. Cần sửa các câu mô tả này theo hành vi thực tế.
- README còn nói Qwen đang dùng mặc định, Spring Boot 3, Node 20 và xác thực chứng chỉ. Source/config hiện dùng cloud Groq/Gemini, Spring Boot 4.1.1, frontend yêu cầu Node >=22.13.0; xác minh chứng chỉ thực tế chưa có.
- README ghi số test không khớp lượt kiểm tra hiện tại. Cần dùng kết quả mới và ghi rõ mock/live, không tính bài bị bỏ qua là đạt.

## Thứ tự hoàn thiện đề xuất

1. Sửa route hai tab mới và đường hiển thị GitHub cho PDF nộp trực tiếp.
2. Bảo toàn kết quả HR khi tạo lại phiếu; sửa trạng thái lỗi tải phiếu.
3. Nối câu trả lời bổ sung vào phiếu hoặc thu hẹp tuyên bố chức năng.
4. Sửa fixture migration để bộ backend chạy xanh thực sự.
5. Đồng bộ README/Settings và chuẩn bị một bộ CV/JD tự dựng, có liên kết GitHub phù hợp, được phép dùng khi trình diễn.
6. Diễn tập một lượt đầy đủ trên giao diện thật: tải PDF → nộp → xem phân tích → trả lời bổ sung → HR xem PDF/bằng chứng → GitHub → tạo phiếu → chấm/lưu/tải lại → chuyển vòng.
7. Chuẩn bị bản kết quả đã lưu và ảnh/video của cùng bộ dữ liệu demo để trình bày khi mạng/provider không khả dụng; ghi rõ đó là kết quả đã lưu.

Không cần bổ sung voice/camera hoặc toàn bộ 8 ý tưởng trước buổi demo. Ưu tiên hoàn tất đường đi hiện có, dữ liệu đúng và cách trình bày có căn cứ.

## Xác nhận vận hành sau sửa

- Frontend `5173`, backend `8080`, AI service `8000` đều trả HTTP 200; backend đã áp dụng V27. Ba dịch vụ đang chạy với bản sửa.
- Gọi endpoint AI thật `/api/interview-scorecard/generate` bằng CV/JD và câu trả lời **giả lập**: HTTP 200, khoảng 3,4 giây, 2 nhóm/6 câu hỏi; model `groq/openai/gpt-oss-120b`. Có câu hỏi đào sâu về SQL index và context trích nguyên lời tự khai với nhãn “chưa xác minh”. Không sử dụng hồ sơ có sẵn trong database cho kiểm tra này.
- Schema sinh mới quy định 2 nhóm × 3 câu hỏi; khi có câu trả lời bổ sung, AI phải sinh thêm câu hỏi tiếp theo có context trích đúng câu trả lời, rồi thay một câu trong phiếu để giữ tổng 6. Đây là kiểm tra cấu trúc và nguồn trích, không phải chứng minh mọi câu hỏi AI đều đúng ngữ nghĩa.
- Trong quá trình sửa có lượt provider trả sai cấu trúc và API trả 503. Phiếu lỗi không được lưu; sau khi siết schema và khởi động lại, lượt kiểm tra cuối đạt như trên. Một lượt thành công không bảo đảm provider luôn khả dụng; UI có thông báo thử lại và bản đã lưu vẫn được giữ.
- Python chạy lại sau thay đổi cuối: 90/90 bài đạt. Frontend build thành công, lint không còn cảnh báo đã nêu ở phần kiểm tra ban đầu; còn cảnh báo đóng gói về kích thước bundle và import tĩnh/động.
- Chưa bấm lại toàn bộ luồng trên UI thật do local browser use bị tắt. Cần tải lại trang để nhận hợp đồng `version` mới, rồi diễn tập theo mục 6 phía trên trước khi trình diễn.

## Bổ sung: lỗi đọc CV PDF và bản sửa

Người dùng gặp thông báo “AI chưa đọc được CV lúc này”. Log xác nhận nhánh đọc theo bố cục/scan trả 503 vì Gemini từ chối yêu cầu HTTP 400. Với cùng một PDF scan tự dựng, schema đầy đủ bị từ chối, schema gọn được chấp nhận. Đã bỏ metadata/ràng buộc làm phình grammar ở yêu cầu Gemini, giữ tên trường/kiểu và kiểm tra giới hạn gốc bằng Pydantic sau khi nhận kết quả. [Tài liệu Gemini](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en) cũng nêu giới hạn độ phức tạp schema.

Khi gọi tiếp, model `gemini-3.1-flash-lite` còn báo quá tải HTTP 503. Model `gemini-2.5-flash` được thử với dữ liệu giả nhưng trả 404, thông báo không còn mở cho người dùng mới; không dùng nó làm dự phòng. Bản cuối đọc scan/nhiều cột qua Groq vision `qwen/qwen3.8-27b` trước (tối đa 3 ảnh), rồi dự phòng toàn bộ PDF bằng Gemini `gemini-3.8-flash`. Tài liệu dài hơn 3 trang chuyển nguyên vẹn sang Gemini; không bỏ trang. Model Qwen này chạy qua API Groq, không tải về máy. Khả năng ảnh/JSON và giới hạn 3 ảnh được đối chiếu với [Groq Vision](https://console.groq.com/docs/vision).

Mỗi provider tối đa 20 giây, tổng đọc tài liệu tối đa 45 giây. Không đổi provider khi dịch vụ từ chối nội dung. Chế độ Ollama được bật chủ động vẫn ở local và không chuyển sang cloud. Không thay database hoặc gửi lại CV thật để kiểm tra; người dùng có thể đọc lại file đã lưu.

Kiểm tra trên endpoint đang chạy `/api/cv-parser` bằng hai PDF tự dựng, sau bản sửa cuối:

| Mẫu | HTTP | Thời gian | Dữ liệu |
| --- | --- | --- | --- |
| Scan 1 trang | 200 | 2,2 giây | Đúng tên/email, Java/SQL/Spring Boot, 1 mục kinh nghiệm |
| Có chữ 1 trang | 200 | 7,3 giây | Đúng tên/email, Java/SQL/Spring Boot, 1 mục kinh nghiệm |

Python: 94/94 bài đạt, gồm kiểm tra schema, giữ giới hạn đầu ra, gửi đúng ảnh theo trang, không cắt CV dài, không nhận phản hồi bị cắt, chuyển provider có giới hạn và giữ nguyên từ chối nội dung. Đây là thời gian đo với mẫu đơn giản, không cam kết thời gian/chất lượng với mọi CV hoặc bảo đảm dịch vụ cloud luôn khả dụng.

## Bổ sung: đọc CV mới liên tiếp gặp giới hạn API

Sau lần kiểm tra trên, log mới ghi Groq vision HTTP 429 và Gemini dự phòng không thành công. Kiểm tra cục bộ xác nhận file vừa lỗi là scan 1 trang, không có lớp chữ; không thể chuyển thẳng sang trích văn bản. Header Groq của model vision cho biết giới hạn token là 8.000/phút. Đây là lỗi mới, khác HTTP 400/503 ban đầu.

Đã giảm phần prompt bị lặp (mô tả trường + toàn bộ JSON Schema), vẫn kiểm tra kết quả bằng cùng Pydantic model. Khi Groq trả 429, đọc `Retry-After` và ghi nhận thời điểm hết hạn; chỉ thử lại một lần nếu thời gian chờ ≤15 giây trong ngân sách 20 giây. Hạn dài hơn không bị gọi lại liên tục. Nếu dự phòng cũng lỗi, giữ mã 429 và thời gian chờ về backend, hiển thị rõ giới hạn API thay vì thông báo 503 chung. Lỗi quota không trừ lượt đọc tài liệu; PDF gốc vẫn được giữ.

Kiểm thử mới: 96 bài Python đạt; 4 bài backend PDF trên database riêng đạt, không bỏ qua, gồm bài xác nhận 4 lần liên tiếp bị 429 vẫn còn 0 lượt lỗi file và đọc được sau khi dịch vụ hồi phục. Backend đã clean package và khởi động lại cùng FastAPI; cả ba server trả HTTP 200.

Kiểm tra endpoint với hai lần đọc CV scan **giả** liên tiếp: lần 1 HTTP 200 / 2,2 giây; lần 2 thực sự nhận 429 và `Retry-After: 14`, tự chờ rồi trả HTTP 200 / 16,5 giây. Cả hai lấy đúng tên, kỹ năng và số trang của mẫu. Kết quả này chứng minh đường chờ ngắn hoạt động; không chứng minh mọi quota dài/ngày đều có thể xử lý trong một yêu cầu.

Chưa gửi lại CV thật trong lần sửa này: kiểm duyệt tự động từ chối hành động gửi file từ database tới Groq/Gemini vì cần sự đồng ý rõ ràng về dữ liệu cá nhân và đích nhận. Việc kiểm tra cục bộ chỉ lấy số trang/lượng chữ, không in nội dung cá nhân. Cần người dùng cho phép trước khi thử lại file thật qua cloud.

## Bổ sung: xác nhận CV bị chặn bởi portfolio thiếu giao thức

Kiểm tra định dạng cục bộ trường portfolio của bản CV mới nhất cho thấy một tên miền, không có giao thức; không in giá trị liên kết hoặc gọi cloud. Quy tắc URL cũ chỉ chấp nhận `http://`/`https://`, nên dù AI đọc được CV, xác nhận vẫn bị chặn và thông báo chung không hướng dẫn cách sửa.

Đã chuẩn hóa liên kết trong **bản review**: cắt khoảng trắng ngoài, thêm `https://` cho tên miền hợp lệ (GitHub/LinkedIn/portfolio, URL dự án và chứng chỉ). Không đổi PDF, dữ liệu bóc tách ban đầu, nguồn trích hoặc đơn đã nộp. Chuỗi không phải URL như `javascript:`, `mailto:` hoặc chứa khoảng trắng vẫn bị chặn; người dùng có thể để trống liên kết tùy chọn. UI ghi nhãn “Portfolio / Website” và hướng dẫn để trống/thêm giao thức; thông báo lỗi URL có hướng sửa cụ thể.

Kiểm tra: 6 bài backend PDF/review/quota đạt trên database riêng, không bỏ qua; gồm xác nhận thành công tên miền thiếu giao thức, URL lồng trong mục dự án/chứng chỉ, bảo toàn dữ liệu trích gốc, từ chối liên kết sai và cho phép portfolio rỗng. Frontend 24 bài đạt, build thành công, lint sạch (các cảnh báo bundle cũ vẫn còn). Đã đóng gói sạch và nạp lại backend; không gọi lại AI để sửa liên kết này.

## Bổ sung: đồng bộ nền tối trong HR

Các widget dùng chung và các tab thêm sau đang đặt màu trắng/màu chữ tối cố định hoặc đọc biến theme chưa được HR khai báo. Đã chuyển tiến độ AI, dữ liệu trích PDF/thanh công cụ PDF, bổ sung thông tin, GitHub, phiếu phỏng vấn, top ứng viên và soạn email sang các biến bảng màu HR; bổ sung màu trạng thái, nền input và viền tương ứng. Các component dùng chung giữ màu sáng mặc định khi nằm ngoài workspace HR; giấy CV/PDF vẫn giữ hình thức tài liệu gốc. Thanh cuộn trang cũng theo chế độ tối khi workspace HR hiện diện.

Build thành công, lint sạch, 24 bài frontend đạt; các biến theme sử dụng đều có khai báo và các cặp chữ/nền chính kiểm tra từ CSS có tỷ lệ tương phản >4,5. Vite đang phục vụ stylesheet mới. Chưa kiểm tra hình ảnh trực tiếp trên trình duyệt vì công cụ vẫn báo local browser use bị tắt; kết quả build/kiểm tra CSS không thay thế xác nhận bằng mắt.

## Bổ sung: phiếu phỏng vấn chỉ mở thao tác ở vòng Phỏng vấn

Chỉ trạng thái `INTERVIEW` cho phép tạo/tạo lại/chấm/lưu/hoàn tất phiếu. `SUBMITTED`/`REVIEWING` hiển thị lý do và nút mở mục Chuyển vòng để HR quyết định sơ tuyển; không tự chuyển vòng theo điểm AI. `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN` và các hồ sơ chưa vào Phỏng vấn chỉ được xem lại phiếu đã lưu. Phiếu hoàn tất tiếp tục bất biến kể cả khi hồ sơ vẫn ở `INTERVIEW`.

API từ chối thao tác sai giai đoạn bằng 409 trước khi gọi AI. Sau khi provider trả câu hỏi, backend khóa dòng đơn ứng tuyển và kiểm tra lại trạng thái trước khi ghi; hồ sơ đổi vòng trong khi AI chạy sẽ không nhận phiếu mới hoặc bị ghi đè phiếu cũ. Khi lưu điểm/ghi chú cũng kiểm tra dưới cùng khóa dòng. Không thay trạng thái đơn, xóa hay chuyển đổi phiếu lịch sử. UI khóa trường nhập ở chế độ xem lại; khi gặp xung đột có nút tải lại cả trạng thái hồ sơ và phiếu.

Kiểm tra sau sửa: 12 bài backend scorecard/GitHub/quy trình HR đạt, không bỏ qua, trên database riêng với AI giả lập. Có ma trận mọi giai đoạn ngoài Phỏng vấn (không gọi provider, không sửa phiếu), tạo/chấm hợp lệ ở Phỏng vấn, giữ nguyên điểm/ghi chú để xem lại, hai trường hợp HR đổi vòng khi đang tạo mới/tạo lại, và các kiểm tra phiên bản/phiếu hoàn tất trước đó. Frontend 24 bài đạt (bổ sung kiểm tra quyền thao tác theo giai đoạn), build thành công, lint sạch. Backend đã đóng gói sạch và nạp bản mới; không gọi AI cloud hoặc sửa dữ liệu ứng tuyển thật để kiểm tra. Chưa diễn tập bằng mắt do local browser use bị tắt.
