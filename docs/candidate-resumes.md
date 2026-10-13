# CV có cấu trúc — Flyway V5–V6

Đã triển khai `candidate.resumes`. Một hồ sơ ứng viên có 0–N CV; mỗi CV thuộc
một hồ sơ qua `candidate_id → candidate.candidate_profiles.user_id`.
Entity là `com.lumi.recruitment.entity.candidate.Resume`, quan hệ `@ManyToOne` lazy.
Không đổi dữ liệu hoặc kiểu cột của hồ sơ ứng viên hiện tại.

## Dữ liệu

- Cột thông thường: `id`, `candidate_id`, `title`, `full_name`, `email`, `phone`,
  `location`, `desired_position`, `summary`, `github_url`, `linkedin_url`, `portfolio_url`.
- Danh sách JSONB: `skills` (chuỗi), `experiences`, `educations`, `projects`, `certifications`.
- V6 bổ sung các danh sách JSONB tùy chọn: `languages`, `awards`, `activities`.
- Điều khiển: `template` (`classic`/`modern`), `status` (`DRAFT`/`READY`), `is_default`,
  `version`, `created_at`, `updated_at`.

Các danh sách có cấu trúc cố định, DTO kiểm tra từng phần tử:

| Mục | Trường |
| --- | --- |
| Kinh nghiệm | company, position, startDate, endDate, current, description |
| Học vấn | school, degree, field, startDate, endDate, description |
| Dự án | name, role, url, description |
| Chứng chỉ | name, issuer, issuedDate, credentialUrl |
| Ngoại ngữ | name, proficiency, certification |
| Giải thưởng | title, issuer, awardedDate, description |
| Hoạt động | name, organization, role, startDate, endDate, current, description |

Ngày dùng `YYYY-MM`, cho phép bỏ trống. Kết thúc không được trước bắt đầu;
kinh nghiệm đang làm không có ngày kết thúc. URL chỉ nhận HTTP/HTTPS hoặc bỏ trống.
Tối đa 100 kỹ năng (100 ký tự/mục), 30 mục mỗi danh sách, mô tả 6000 ký tự.

Bản nháp chỉ cần tên bản CV; hoàn tất cần họ tên, email và vị trí ứng tuyển.
CV mặc định phải hoàn tất. Unique partial index bảo đảm tối đa một CV mặc định
mỗi ứng viên; không tự chọn CV mặc định khi tạo/xóa. Chuyển CV mặc định về nháp
sẽ bỏ trạng thái mặc định. Index theo chủ sở hữu và thời gian cập nhật phục vụ danh sách.

## REST và quyền sở hữu

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/candidate/resumes` | CV của tài khoản hiện tại |
| GET | `/api/candidate/resumes/{id}` | Nội dung CV thuộc tài khoản hiện tại |
| POST | `/api/candidate/resumes` | Tạo CV, trả 201 |
| PUT | `/api/candidate/resumes/{id}` | Lưu toàn bộ nội dung chỉnh sửa |
| PUT | `/api/candidate/resumes/{id}/default` | Đặt mặc định, body `{ "version": 0 }` |
| DELETE | `/api/candidate/resumes/{id}?version=0` | Xóa CV |

Save DTO chứa toàn bộ trường nội dung và danh sách, template, status, version.
Không nhận chủ sở hữu, ID, trạng thái mặc định hoặc timestamp từ client.
Các thao tác ghi yêu cầu phiên ứng viên ACTIVE và CSRF; dữ liệu người khác trả 404.
Các yêu cầu ghi cùng ứng viên khóa hồ sơ cha để tuần tự hóa thao tác đặt mặc định.
`@Version` và kiểm tra phiên bản gửi lên trả 409 khi bản đang sửa đã cũ, tránh ghi đè.
Version hiện là kiểm soát cập nhật đồng thời, không phải lịch sử các bản CV.

V6 thêm ba cột NOT NULL với mặc định `[]` và kiểm tra kiểu array; không thay đổi
nội dung, version, thời gian, trạng thái hoặc chủ sở hữu CV cũ. API trả đủ ba
danh sách. Client cũ bỏ qua/null một danh sách mới thì giữ nguyên khi cập nhật;
gửi `[]` để xóa nội dung mục đó. Khi tạo mới, danh sách bỏ qua/null mặc định rỗng.
Các mục mới tối đa 30 phần tử, trường văn bản tối đa 255 ký tự, mô tả 6000 ký tự;
ngày giải thưởng và khoảng thời gian hoạt động được kiểm tra như các mục cũ.

## Giao diện

`/profile?tab=cv` liệt kê CV thật, mở sửa, đặt mặc định và xóa có xác nhận.
`/cv-builder` tạo CV mới, điền sẵn từ hồ sơ nhưng không ghi lại hồ sơ.
`/cv-builder?id={uuid}` mở dữ liệu CV đã lưu. Bấm **Lưu bản nháp** hoặc **Hoàn tất CV**
để lưu vào PostgreSQL; tải lại trang giữ dữ liệu đã lưu. Không tự động lưu.
Lần lưu đầu tạo một record và chuyển sang URL có ID của CV; các lần lưu tiếp
theo cập nhật cùng record. Nội dung vừa lưu và thông báo thành công được giữ
ngay sau lần tạo đầu. Nút **CV của tôi** mở danh sách các bản đã lưu.
Giao diện chặn gửi yêu cầu lưu đồng thời và nhắc các trường còn thiếu khi
hoàn tất; ứng viên vẫn có thể lưu bản nháp chưa đầy đủ. Các liên kết tạo CV
được ghi **Tạo CV mới**. Trợ lý AI hỗ trợ viết lại từng mục Giới thiệu, Kinh nghiệm,
Dự án ngay trong form; xem [luồng hỗ trợ viết CV](cv-writing-assistant.md).
Thanh trạng thái nhắc thay đổi chưa lưu; nút quay về CV và tải lại/đóng trang có cảnh báo.
Các liên kết điều hướng chung khác chưa chặn rời trang có thay đổi chưa lưu.
In/Lưu PDF xuất nội dung đang xem, không tự lưu thay đổi hoặc tải file lên server.

Trình tạo CV có Ngoại ngữ, Giải thưởng và Hoạt động tùy chọn. Những mục chưa có dữ liệu giữ nhãn và thông báo **Chưa cung cấp**, giống trình xem CV của HR. Dòng JSONB chưa có nội dung văn bản không tạo entry trống, kể cả khi chỉ chọn Đang tham gia. Mô tả kinh nghiệm, dự án và hoạt động hiện mỗi dòng thành một gạch đầu dòng, bỏ tiền tố `-`, `•`, `*` đã gõ; nội dung lưu giữ nguyên.

Preview khi chỉnh sửa, xem lại trước ứng tuyển và CV đã nộp dùng chung bố cục **hai cột** với HR: liên hệ, kỹ năng, ngoại ngữ ở cột trái; giới thiệu, kinh nghiệm, dự án, học vấn, chứng chỉ, giải thưởng, hoạt động ở cột phải. Các trường công ty, vai trò, bằng cấp, chuyên ngành, đơn vị cấp/trao và liên kết có nhãn rõ. CV cũ với template `classic` hoặc `modern` đều đọc được; trình sửa lưu bằng mã `modern` hiện có. Không đổi schema database.

Kinh nghiệm/hoạt động đang diễn ra hiển thị trước, sau đó ngày gần nhất trước; học vấn, chứng chỉ và giải thưởng cũng xếp ngày gần nhất trước. Thứ tự nhập trong trình sửa giữ nguyên. CV chưa có kinh nghiệm đưa học vấn lên trước. Ngày hiển thị `MM/YYYY`, mục đang diễn ra ghi **Hiện tại**.

Dưới 1100 px, nút **Chỉnh sửa / Xem trước** chuyển giữa hai vùng, giữ nội dung đang nhập. Trên màn hình rộng, biểu mẫu và preview hiển thị cạnh nhau; preview có vùng cuộn riêng. Khung tài liệu hẹp tự xếp một cột để đọc được. Khi in, luôn hiện CV bất kể chế độ đang chọn; ẩn biểu mẫu và các nút, dùng lề A4 15 mm và bố cục giấy hai cột. Trang in được trình duyệt phân trang, không có kéo thả hoặc tự điều chỉnh nội dung để vừa một trang.

Upload PDF và hỏi đáp tạo toàn bộ CV chưa triển khai. AI viết lại từng mục đã có API,
dùng Groq chính và Gemini dự phòng; cấu hình key trong server AI để chạy mô hình thật. Luồng ứng tuyển và snapshot CV được mô tả
tại [API hồ sơ ứng tuyển](applications-api.md).

## Kiểm tra

Test tích hợp dùng database riêng qua biến `LUMI_TEST_POSTGRES_*` như hướng dẫn onboarding.
Bao gồm lưu/đọc JSONB, quan hệ nhiều CV, sửa/xóa, hồ sơ không thay đổi, quyền sở hữu,
role/CSRF, dữ liệu lồng nhau sai, xung đột phiên bản và hai yêu cầu đặt mặc định đồng thời.
Test migration V4→V5 xác nhận dữ liệu tài khoản/hồ sơ không đổi, FK/default/JSONB constraints,
chạy lại không thay đổi dữ liệu. Các test database mới kiểm tra Hibernate validate.

Kiểm tra ngày 04/10/2026: frontend build/lint đạt; 25 bài kiểm thử backend đạt,
không bỏ qua bài nào. Kiểm tra trình duyệt với database riêng xác nhận: không
tạo CV chỉ khi mở trang; lưu bản nháp chỉ có tên tạo một record DRAFT/version 0;
tải lại giữ nội dung; bổ sung thông tin rồi hoàn tất cập nhật cùng ID thành
READY/version 1, vẫn chỉ có một record; CV xuất hiện trong danh sách và hồ sơ
cá nhân không bị thay đổi. Ảnh minh họa: `cv-save-flow-preview.png`.

Áp dụng hiện tại: sao lưu trước, khởi động backend mới để Flyway chạy V5; không baseline lại.
Backup cục bộ: `backend/backups/before-resumes-v5-20261004/database.dump` (không đưa lên Git).

V6 đã kiểm tra ngày 04/10/2026: 28 bài kiểm thử backend và 3 bài frontend đạt,
build/lint đạt. Kiểm thử trình duyệt trên database riêng xác nhận nhập/lưu/tải
lại ba mục mới, dòng trống ẩn, gạch đầu dòng và đổi mẫu giữ nguyên nội dung.
Database cục bộ đã áp dụng V6; đối chiếu xác nhận tài khoản, hồ sơ và các trường
CV cũ được giữ nguyên. Backup trước V6 nằm trong
`backend/backups/before-resume-v6-20261004-223041/database.dump`.
Ảnh kết quả: `cv-structure-preview.jpg`.

Kiểm tra bố cục preview: build/lint và 4 bài frontend đạt. Thử trong trình duyệt
với database riêng: mẫu một/hai cột, thứ tự học vấn cho CV sinh viên, màn hình
390 px và 900 px, tên/liên kết dài không tràn ngang, chuyển chế độ xem giữ
nội dung và lưu bản nháp thành công. Chưa kiểm tra file PDF xuất từ hộp thoại
in của trình duyệt. Ảnh: `cv-layout-two-column.jpg`, `cv-layout-one-column.jpg`,
`cv-layout-mobile.jpg`.

## Dùng CV để ứng tuyển (V9)

Ứng viên chọn CV READY đã lưu từ job thật, xem toàn bộ CV rồi xác nhận nộp. CV DRAFT không xuất hiện trong lựa chọn. Một ứng viên chỉ nộp một lần cho mỗi job. CV đã dùng không được xóa, vẫn được sửa; sửa không làm đổi snapshot đã nộp. Xem [luồng ứng tuyển thật](applications-api.md).

## Màu nền preview

Trình xem CV dùng chung với HR có họa tiết góc mờ và nút **Sáng / Tối**. Lựa chọn được nhớ trên trình duyệt và đồng bộ giữa các preview; không ghi vào nội dung CV. Khi in/PDF, bảng màu sáng được áp dụng và các nút đổi nền được ẩn. Xem [chi tiết và kiểm tra](cv-preview-appearance.md).

## Guided CV editor (13/10/2026)

The candidate CV builder now has four freely selectable steps: basic information;
introduction, skills and languages; education, experience and projects; optional
certificates, awards and activities followed by final review. Desktop keeps the
shared CV preview beside the editor. Smaller screens retain the edit/preview switch.

Step changes keep all panels mounted, preserving entry identities and pending AI
suggestions/undo. Selecting a step from mobile preview returns to editing. First
creation retains the active step even when the editor remounts with its saved ID.
Navigation alone does not save. Existing DRAFT/READY APIs, ownership checks,
versioning, job return link and PDF behavior are unchanged. The final review links
missing required values back to their fields; completion also focuses the first
missing field. Optional sections never block moving forward.

Validation: frontend build and all 14 existing test files pass. Browser checks with
isolated synthetic API responses cover forward/back navigation, AI proposal retention
and apply, first draft save without resetting the step, missing email on completion,
optional sections skipped, adding a project, READY save and reopening the saved CV.
Desktop and 390px/320px mobile layouts, switching preview to editing, and horizontal
layout bounds were checked. Save/AI browser checks use a temporary fixture rather than
writing real candidate records or calling providers. Existing lint warning in
TopCandidatesWidget.tsx remains unrelated.

Screenshots with synthetic data: `cv-wizard-desktop.png`, `cv-wizard-mobile.png`.

## Position suggestions and job context (13/10/2026)

- `GET /api/candidate/resumes/position-options` returns distinct active position names
  from `recruitment.job_positions`, joined to active departments. It uses the same
  active-candidate/profile checks as other resume reads. HR/anonymous users cannot
  access this candidate endpoint. It does not change the onboarding option config.
- `JobDto.positionName` exposes the catalog position separately from the advert title;
  list queries fetch the relation together with the department. Old jobs without a
  position use their advert title as the CV prefill fallback.
- New general CVs prefill the profile's desired position. New CVs opened with `jobId`
  prefer the job's catalog position. Existing CVs retain their saved wording; an explicit
  “Dùng vị trí…” button applies the job's position if the candidate wants it.
- The editable combobox supports keyboard selection, accent-insensitive Vietnamese
  search, deduplication, and custom text. Dropdown failure or unavailable jobs do not
  prevent manual entry or saving. Job metadata cannot overwrite edits after first save.
- Resume payload/schema remain unchanged: `desiredPosition` is display text, while
  applying still uses the selected job's ID. No new positions are created by CV entry.

Validation: two PostgreSQL integration tests passed in a separate temporary database
(active/deactivated catalog filtering, deduplication, role protection, custom-position
save/read, and job title vs catalog position in detail/list APIs). All 14 frontend
suite files and the production build pass. Browser fixtures checked profile prefill,
job prefill, preservation of saved CV text, custom text save, unavailable APIs,
keyboard controls, Vietnamese search, desktop and 390px mobile layout. Screenshots
`cv-position-desktop.png` and `cv-position-mobile.png` use synthetic data.
