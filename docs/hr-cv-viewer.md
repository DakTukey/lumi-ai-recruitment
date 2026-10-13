# Trình xem CV dành cho HR

CV đã nộp dùng bố cục giấy hai cột, nền xanh nhạt ở cột thông tin cá nhân và nền trắng ở cột nội dung. Khung CV chiếm trọn chiều ngang tab, không còn bị cột chuyển vòng thu hẹp.

- Cột trái: tên, vị trí mong muốn, liên hệ, liên kết, kỹ năng và ngoại ngữ.
- Cột phải: giới thiệu, kinh nghiệm, dự án, học vấn, chứng chỉ, giải thưởng và hoạt động. Mục chưa có dữ liệu giữ tiêu đề và thông báo “Chưa cung cấp”; dữ liệu xuất hiện đúng vị trí khi bản CV đã nộp có nội dung. Kinh nghiệm mới nhất đứng trước.
- Dữ liệu thật lấy từ `resumeSnapshot` đã nộp. Giao diện đọc không sửa dữ liệu, không tạo thêm điểm kỹ năng hoặc thông tin cá nhân.
- CV mẫu và CV thật dùng chung thành phần hiển thị; CV mẫu có nhãn rõ ràng. Văn bản mẫu được giữ nguyên, không suy diễn trường học, công ty hay ngày tháng.
- Hiện schema CV chưa có ảnh chân dung, sở thích hoặc người giới thiệu. Vòng tròn hiển thị chữ viết tắt từ tên, không dùng ảnh của người trong mẫu tham khảo.
- Trên khung hẹp, hai cột chuyển thành một cột để đọc được nội dung. Chuyển vòng trên hồ sơ mẫu có tab riêng; bản thật giữ tab chuyển vòng hiện có.
- Preview ứng viên, xem lại CV trước khi nộp và CV đã nộp dùng chung bố cục với HR. Mã template cũ vẫn đọc được; lần lưu tiếp theo trong trình tạo CV sử dụng `modern`.

## Kiểm tra

- Frontend build, lint và 11 tệp test đều qua.
- Kiểm tra render với snapshot có đầy đủ kinh nghiệm, học vấn, dự án, chứng chỉ, ngoại ngữ, giải thưởng, hoạt động và liên kết: không mất trường, không lặp chứng chỉ, không thay đổi dữ liệu đầu vào. Snapshot cũ thiếu các mục tùy chọn vẫn hiển thị.
- Trình duyệt: đăng nhập HR, mở CV Minh Anh, kiểm tra hai cột và không tràn ngang, chuyển sang tab chuyển vòng rồi quay lại CV.
- Kiểm tra trình duyệt dùng hồ sơ mẫu; dữ liệu snapshot đầy đủ được kiểm tra bằng render thành phần, chưa xác nhận hồ sơ thật trên trình duyệt trong lượt này.

Ảnh: `hr-cv-viewer.png`.

## Đối chiếu dữ liệu CV

Nguồn: `candidate.resumes` (V5, V6), `ResumeSections`, `ResumeDto`; màn hình HR đọc `resumeSnapshot` trong đơn ứng tuyển.

| Dữ liệu lưu | Vị trí / nhãn hiển thị |
| --- | --- |
| `full_name`, `desired_position` | Tên ứng viên, vị trí mong muốn ở đầu cột trái |
| `email`, `phone`, `location` | Email, số điện thoại, địa điểm |
| `github_url`, `linkedin_url`, `portfolio_url` | GitHub, LinkedIn, Portfolio / Website |
| `summary` | Giới thiệu |
| `skills` | Kỹ năng |
| `experiences` | Chức danh, công ty, thời gian, trạng thái hiện tại, mô tả |
| `educations` | Trường học, bằng cấp, chuyên ngành, thời gian, mô tả |
| `projects` | Tên dự án, vai trò, liên kết dự án, mô tả |
| `certifications` | Tên chứng chỉ, đơn vị cấp, ngày cấp, liên kết chứng chỉ |
| `languages` | Tên ngoại ngữ, trình độ, chứng nhận |
| `awards` | Tên giải thưởng, đơn vị trao, ngày nhận, mô tả |
| `activities` | Tên hoạt động, tổ chức, vai trò, thời gian, trạng thái hiện tại, mô tả |

Nhãn giữ chỗ chỉ nằm trong trình xem HR, không thêm nội dung vào dữ liệu CV. Các màn hình preview ứng viên cũng hiển thị nhãn giữ chỗ như HR. Không lấy hồ sơ ứng viên hiện tại để tự bổ sung vào snapshot cũ. Các trường quản lý như ID, trạng thái, phiên bản, mặc định và thời gian cập nhật không phải nội dung CV; tên bản CV xuất hiện ở thanh thông tin trình xem.

`tests/cv-preview.test.mjs` kiểm tra phần giữ chỗ, đầy đủ dữ liệu của mọi nhóm, các liên kết, ngày tháng, giữ nguyên snapshot và không ảnh hưởng mẫu CV ứng viên.
Ảnh nhãn giữ chỗ: `hr-cv-field-labels.png`.

## Đồng bộ preview ứng viên

- `CvPreview` mặc định dùng bố cục chung. Container tài liệu và CSS hoạt động độc lập với khung HR.
- `CvBuilderPage` dùng một bố cục hai cột, có nhãn dữ liệu và chỗ cho mục chưa cung cấp; bỏ bộ chọn một/hai cột cũ. Bản CV cũ vẫn mở được, khi lưu dùng mã template `modern` hiện có trong API.
- `ApplyWithResume` dùng mặc định chung khi xem lại trước lúc ứng tuyển. `SubmittedApplicationDetail` dùng cùng `SubmittedCvViewer` cho cả ứng viên và HR.
- Dưới 1100 px, trình sửa cho chuyển Chỉnh sửa / Xem trước để tài liệu có đủ chiều ngang. Nội dung đang nhập được giữ khi chuyển. Khung CV hẹp vẫn tự xếp một cột; kiểu in giữ hai cột và không in biểu mẫu.
- Build, lint và bộ test qua. Test render xác nhận preview mặc định của ứng viên và HR giống nhau với cả dữ liệu template `classic` lẫn `modern`.
- Kiểm tra trình duyệt bằng trang thử tạm dùng đúng `CvPreview` với dữ liệu minh họa: hai cột, không tràn ngang, đổi tên cập nhật ngay lên tài liệu. Trang thử đã xóa. Chưa kiểm tra phiên tài khoản ứng viên thực tế vì chưa có thông tin đăng nhập demo.
- Ảnh kiểm tra: `candidate-cv-preview-sync.png`.

Preview dùng chung có họa tiết góc mờ và nút Sáng/Tối, nhớ lựa chọn trên trình duyệt. Xem [nền preview CV](cv-preview-appearance.md).
