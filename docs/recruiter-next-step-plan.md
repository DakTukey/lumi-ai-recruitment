# Kế hoạch luồng ứng tuyển thật và HR — 09/10/2026

Đợt 1 đã triển khai bằng V9 và API thật; xem [kết quả và hướng dẫn test](applications-api.md). Đợt 2 phần HR đã hoàn thành bằng [V10](hr-application-review.md); rút đơn ứng viên và các đợt 3–5 còn là kế hoạch.

## Mục tiêu đợt gần nhất

Ứng viên dùng CV đã lưu thật để nộp vào một tin đang tuyển. HR thấy đơn trong cả chi tiết job và danh sách tổng thể, mở đầy đủ CV đúng tại thời điểm nộp. Sửa CV hoặc JD sau đó không làm thay đổi dữ liệu của đơn đã gửi.

Luồng: **Job công khai → chọn CV READY → xem lại → xác nhận nộp → lưu đơn và bản chụp dữ liệu → ứng viên theo dõi đơn → HR xem hồ sơ.**

## Nền tảng đang có

- `candidate.resumes` và API quản lý nhiều CV, trạng thái DRAFT/READY, version; dữ liệu có cấu trúc và các mục tùy chọn đã lưu thật.
- `recruitment.jobs`, `job_skills`, `job_requirements`, lịch sử tin và API tạo/sửa/đăng/đóng/mở lại đã chạy thật.
- Danh sách/phân trang/thống kê hồ sơ HR và trình xem CV/JD đã nối API thật; ghi chú, chuyển vòng và lịch sử đã lưu thật bằng V10, AI vẫn chỉ có trong chế độ mẫu.
- Form nộp bằng CV READY và trang theo dõi đã lưu thật. Upload PDF chưa có backend; nộp bằng dữ liệu CV đã lưu, không dùng file chỉ mới chọn.

## Thứ tự và đầu ra

| Đợt | Phạm vi | Điều kiện hoàn thành |
| --- | --- | --- |
| 1 — hoàn thành | Database đơn và snapshot; API nộp đơn, ứng viên theo dõi, HR đọc hồ sơ; nối hai giao diện | Đã kiểm tra nộp → tải lại còn đơn → HR mở cùng CV, snapshot bất biến |
| 2 — HR hoàn thành, rút đơn chưa làm | Ghi chú HR, chuyển vòng và lịch sử V10 đã chạy; rút đơn còn lại | HR và ứng viên thấy trạng thái cập nhật; nội bộ riêng tư, cạnh tranh có kiểm soát; rút đơn cần nghiệm thu riêng |
| 3 | AI CV–JD và % phù hợp từng kỹ năng, sau đó tổng hợp ứng viên theo job | Có kết quả thật, bằng chứng và giải thích; AI lỗi không chặn nộp hoặc HR xử lý |
| 4 | Profile HR thật, file CV/JD, AI soạn JD, lịch phỏng vấn/thông báo | Mỗi luồng có lưu trữ/API riêng, kiểm thử quyền và lỗi; triển khai từng chức năng |
| 5 | Skill Passport, xác minh project/test/phỏng vấn, AI video/thích ứng và timestamp review | Có nguồn bằng chứng thực, báo cáo và quy trình HR kiểm tra |

## Đợt 1 — dữ liệu và luồng nộp/đọc

### Database dự kiến

Migration kế tiếp dự kiến V9, kiểm tra lại số migration trước khi tạo. Dùng schema `recruitment`; giữ CV gốc ở `candidate`, không tạo bảng tài khoản mới.

| Bảng | Trường và quan hệ chính |
| --- | --- |
| `recruitment.applications` | `id UUID PK`, `job_id FK → recruitment.jobs`, `candidate_id FK → candidate.candidate_profiles.user_id`, `resume_id FK → candidate.resumes`, `status`, `cover_letter`, `job_version`, `job_snapshot JSONB`, `version`, `applied_at`, `updated_at` |
| `recruitment.application_resume_snapshots` | `application_id PK/FK → applications` (1–1), `source_resume_version`, `schema_version`, `content JSONB`, `captured_at` |
| `recruitment.application_status_history` | `id`, `application_id FK`, `from_status` nullable ở lần nộp đầu, `to_status`, `changed_by FK → auth.users`, `reason`, `created_at`; chỉ thêm |

`content` giữ toàn bộ nội dung CV đã nộp: liên hệ, giới thiệu, kỹ năng, kinh nghiệm, học vấn, dự án, chứng chỉ, ngoại ngữ, giải thưởng, hoạt động, liên kết và mẫu trình bày. Không chỉ lưu tên CV hoặc đường dẫn đến bản đang sửa.

`job_snapshot` giữ JD, kỹ năng bắt buộc/ưu tiên, tiêu chí/trọng số và thông tin vị trí tại lúc nộp. AI mặc định đối chiếu hai snapshot này. Việc đánh giá lại theo JD mới, nếu bổ sung sau, phải tạo lần đánh giá riêng và chỉ rõ phiên bản JD.

Quy tắc dữ liệu:

- `UNIQUE(job_id, candidate_id)`: một người một đơn cho một tin, kể cả đã rút/đã loại. Mở lại cùng tin không tự tạo quyền nộp lại; nếu sản phẩm cần nộp lại phải thiết kế lượt nộp riêng.
- Trạng thái: `SUBMITTED`, `REVIEWING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`. Đưa `HIRED` vào backend ngay khi tạo bảng để đồng bộ UI.
- Snapshot bất biến; application version phục vụ kiểm soát thao tác đồng thời, không phải lịch sử CV.
- Chặn xóa CV gốc đã dùng bằng FK/service ở phiên bản đầu; UI giải thích lý do. Cho phép sửa CV gốc, nhưng không cập nhật snapshot. Không xóa dây chuyền đơn/snapshot khi xử lý CV hoặc job.
- Index theo `(job_id, status, applied_at, id)`, `(candidate_id, applied_at, id)`; lịch sử theo application/time. Ràng buộc version không âm, JSON đúng cấu trúc và timestamp bắt buộc.

### API dự kiến

| Endpoint | Mục đích |
| --- | --- |
| `POST /api/candidate/applications` | Nhận `jobId`, `resumeId`, `resumeVersion`, `coverLetter` tùy chọn; trả 201 cùng đơn đã lưu |
| `GET /api/candidate/applications` | Đơn của ứng viên đăng nhập, lọc trạng thái và phân trang |
| `GET /api/candidate/applications/{id}` | Đơn, CV đã nộp và lịch sử được phép xem |
| `GET /api/recruiter/applications` | Danh sách nội bộ, lọc job/tên/email/vòng và phân trang |
| `GET /api/recruiter/applications/{id}` | Đơn, snapshot CV/JD và dữ liệu HR được phép xem |
| `GET /api/recruiter/applications/summary?jobId=...` | Số lượng theo vòng của một job hoặc toàn bộ công ty; không suy ra số tổng từ một trang kết quả |

Candidate ID/người thực hiện lấy từ phiên, không nhận từ client. Role phải hoạt động; mọi thao tác ghi kiểm tra CSRF. Ứng viên chỉ đọc đơn của mình. HR/Admin đọc đơn trong phạm vi Lumi Studio như quyền quản lý tin hiện tại; không chỉ giới hạn theo người tạo tin. Nếu có nhiều công ty sau này phải bổ sung company scope trước khi mở dữ liệu.

Khi nộp, server đọc lại và kiểm tra: job còn công khai/đang tuyển, phòng ban hoạt động, chưa hết hạn; CV thuộc ứng viên và READY, version khớp. Không nhận snapshot do client tự tạo. Lưu application + CV snapshot + JD snapshot + lịch sử SUBMITTED trong **một transaction**. Dùng khóa theo thứ tự thống nhất và unique constraint để xử lý hai yêu cầu nộp đồng thời, sửa/xóa CV hoặc đóng job đồng thời.

CV version cũ/nộp trùng/job không còn nhận trả lỗi có thể xử lý ở UI, không tạo bản ghi dở dang. Sau lỗi mạng không khẳng định đã thất bại: đọc lại đơn của job để xác nhận trước khi cho nộp tiếp.

### Giao diện

- Job → Ứng tuyển: yêu cầu đăng nhập CANDIDATE, lấy danh sách CV thật READY; mặc định chọn CV mặc định hợp lệ, ứng viên vẫn đổi được.
- Không có CV READY: hiển thị tạo/hoàn tất CV và giữ ngữ cảnh job để quay lại. CV DRAFT không được nộp.
- Xem lại job, CV đã lưu và thư ứng tuyển trước khi gửi; báo rõ thay đổi CV chưa lưu không nằm trong đơn. Sau nộp hiện thành công dựa trên phản hồi server; chặn bấm gửi đồng thời.
- Trang Đơn ứng tuyển dùng API thật, giữ sau tải lại, mở CV đã gửi. Không dùng demo để thay cho API lỗi.
- HR giữ bố cục hiện tại, nối danh sách tổng thể và tab Ứng viên theo job vào cùng API/model. CV phải hiện đủ các mục và cùng quy tắc trình bày với CV ứng viên, chỉ đọc từ snapshot.
- Dùng DTO thật riêng; tránh đưa các chuỗi kinh nghiệm/học vấn rút gọn của `SampleApplication` làm hợp đồng dữ liệu thật.
- AI ở hồ sơ thật chỉ hiện **Chưa phân tích / Chưa kết nối AI**; chưa có worker thì không hiển thị đang chạy hoặc điểm mẫu.

## Đợt 2 — ATS có thao tác thật

Đã thêm `recruitment.application_notes`: `id`, `application_id FK`, `author_id FK`, `author_name`, `body`, `request_id`, `created_at`. Ghi chú là nội bộ HR, không đưa vào DTO/API của ứng viên. Bản đầu chỉ thêm ghi chú; sửa/xóa ghi chú cần quy tắc audit riêng.

API HR đã chạy (rút đơn vẫn dự kiến):

- `GET /api/recruiter/applications/{id}/review`: đơn, ghi chú, audit và vòng được phép.
- `POST /api/recruiter/applications/{id}/notes`: thêm ghi chú nội bộ.
- `POST /api/recruiter/applications/{id}/status`: nhận `version`, `status`, `reason` tùy chọn (bắt buộc khi loại); kiểm tra chuyển vòng và lưu lịch sử cùng transaction.
- `POST /api/candidate/applications/{id}/withdraw`: ứng viên rút đơn của mình, có version và lý do tùy chọn; ghi lịch sử.

Luồng chuyển vòng mặc định ở bản đầu:

| Từ | HR được chuyển đến |
| --- | --- |
| SUBMITTED | REVIEWING hoặc REJECTED |
| REVIEWING | INTERVIEW hoặc REJECTED |
| INTERVIEW | OFFER hoặc REJECTED |
| OFFER | HIRED hoặc REJECTED |
| HIRED / REJECTED / WITHDRAWN | Kết thúc; không đổi lại trong bản đầu |

Luồng rút đơn chưa triển khai; dự kiến ứng viên có thể rút khi ở SUBMITTED/REVIEWING/INTERVIEW/OFFER. HR không tự đặt WITHDRAWN. Cần đồng bộ danh sách lựa chọn UI theo trạng thái; không giữ quyền nhảy tùy ý của bản mẫu. Chuyển vòng HR bắt buộc lý do khi loại; các vòng khác tùy chọn. Chặn phiên bản cũ và thao tác cạnh tranh bằng 409; tải lại bản mới, không ghi đè hoặc tạo lịch sử thừa.

Tin đóng/hết hạn vẫn cho HR xem và xử lý đơn đã nhận. Chuyển vòng không tự gửi offer pháp lý, email hoặc tạo lịch phỏng vấn; các luồng đó triển khai riêng ở đợt 4.

## Đợt 3 — AI thật sau khi có dữ liệu

1. Chốt rubric: mỗi kỹ năng/tiêu chí của job yêu cầu gì, mức kỳ vọng, bắt buộc/ưu tiên và trọng số. Danh mục kỹ năng hiện chỉ có tên/liên kết và required; bổ sung mức kỳ vọng/rubric khi cần, không tự coi tên kỹ năng là yêu cầu đầy đủ.
2. Xây hợp đồng kết quả: tổng điểm phù hợp, % phù hợp từng kỹ năng với JD, nguồn bằng chứng, điểm khớp/thiếu/cần làm rõ và lý do. Điểm phù hợp, điểm năng lực và độ tin cậy là các khái niệm riêng. Thiếu bằng chứng dùng trạng thái chưa đủ thông tin và điểm nullable; không giả tạo phần trăm.
3. Dự kiến dùng schema `ai` để lưu các bảng kết quả đánh giá trong thiết kế tổng thể, liên kết application và snapshot/phiên bản rubric, model, prompt; có lịch sử các lần đánh giá. Đây là lựa chọn cần triển khai ở đợt AI, chưa có schema/bảng AI thật và chưa tạo trong đợt 1.
4. Spring Boot điều phối FastAPI qua tác vụ sau khi đơn đã commit, có retry giới hạn/trạng thái lỗi và cơ chế tránh xử lý trùng. React chỉ gọi Spring Boot. Không chờ AI trong transaction nộp đơn.
5. Nối kết quả vào tab Đánh giá AI, rồi tab Tổng hợp AI theo job. Chỉ xếp ưu tiên trên tập có kết quả phù hợp cùng rubric/phiên bản JD; hiển thị độ bao phủ và hồ sơ chưa đánh giá. HR vẫn xem toàn bộ đơn, AI không tự loại hoặc chuyển vòng.

Ban đầu chỉ dùng bằng chứng từ snapshot CV và JD, ghi rõ chưa kiểm chứng. GitHub/project, bài test, Skill Passport và video interview làm sau khi có luồng thu thập bằng chứng tương ứng.

## Kiểm thử và triển khai

- Migration V8 → migration mới trên database thử riêng: giữ nguyên users/profile/CV/job/lịch sử, chạy lại không tạo dữ liệu thừa; FK, unique, trạng thái, version và snapshot bất biến đúng; Hibernate validate qua.
- Quyền: chưa đăng nhập, sai role, tài khoản không hoạt động, đọc/nộp CV người khác, đọc đơn người khác, thiếu CSRF; ứng viên không thấy ghi chú HR.
- Luồng nộp: CV DRAFT/version cũ, job nháp/đóng/hết hạn/không công khai, nộp trùng và hai yêu cầu đồng thời. Lỗi transaction không để lại đơn thiếu snapshot hoặc lịch sử.
- Bất biến: nộp rồi sửa CV/JD, HR vẫn thấy bản đã nộp; xóa CV đã dùng bị chặn rõ ràng. Không lấy dữ liệu job khác khi danh sách trống.
- Hai role: ứng viên nộp → HR thấy ở cả hai nơi → xem đủ CV → ghi chú/chuyển vòng → ứng viên thấy trạng thái; HR note chỉ nội bộ. Sau tải lại dữ liệu còn; số tổng/vòng đúng khi có nhiều trang.
- Cạnh tranh: HR chuyển vòng đồng thời, ứng viên rút cùng lúc HR xử lý, job đóng cùng lúc nộp; mỗi kết quả có một trạng thái hợp lệ và lịch sử nhất quán.
- Frontend: trạng thái tải/trống/lỗi, chống gửi hai lần, thông báo thành công thật, mobile/desktop; không fallback sang mẫu. AI chưa có/lỗi vẫn nộp và xử lý hồ sơ được.
- Áp dụng database đang dùng: sao lưu, chạy migration qua Flyway và kiểm tra dữ liệu; không baseline lại, không tạo CV/job/đơn mock trong dữ liệu thật. Cập nhật tài liệu trạng thái sau khi nghiệm thu từng đợt.

## Phạm vi nên triển khai ngay

**Đợt 1 và phần HR của đợt 2 đã nghiệm thu. Phần còn lại của đợt 2:** ứng viên rút đơn với version/lịch sử và kiểm tra cạnh tranh với HR. Các chi tiết “dự kiến” của đợt 1 được giữ làm thiết kế tham chiếu; hợp đồng đã triển khai nằm trong [API ứng tuyển](applications-api.md).

Nguồn hiện trạng: [CV đã lưu](candidate-resumes.md), [chức năng HR](recruiter-features.md), [giao diện HR](recruiter-interface.md), [database](database-design.md), [API job](recruiter-job-api.md), [vòng đời job](recruiter-job-lifecycle.md).
