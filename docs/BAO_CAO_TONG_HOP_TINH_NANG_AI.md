# 🎓 BÁO CÁO TOÀN DIỆN CÁC TÍNH NĂNG AI TRONG HỆ THỐNG TUYỂN DỤNG LUMI
**Tài liệu Kỹ thuật Chi tiết dành cho Báo cáo, Thuyết trình và Vấn đáp Đồ án Tốt nghiệp / Bảo vệ Dự án**

---

## 📌 MỤC LỤC
1. [Kiến Trúc Kỹ Thuật Tổng Thể (System Architecture)](#1-kiến-trúc-kỹ-thuật-tổng-thể)
2. [Chi Tiết Cách Triển Khai & Luồng Hoạt Động Của 8 Tính Năng AI](#2-chi-tiết-cách-triển-khai--luồng-hoạt-động-của-8-tính-năng-ai)
   - [2.1. Đánh giá độ phù hợp CV & JD (Candidate-Job Assessment)](#21-đánh-giá-độ-phù-hợp-cv--jd-candidate-job-assessment)
   - [2.2. Kiểm tra GitHub & Đối chiếu kinh nghiệm trong CV (GitHub Skill Verification)](#22-kiểm-tra-github--đối-chiếu-kinh-nghiệm-trong-cv-github-skill-verification)
   - [2.3. Phiếu phỏng vấn thông minh cho HR (AI Interview Scorecard)](#23-phiếu-phỏng-vấn-thông-minh-cho-hr-ai-interview-scorecard)
   - [2.4. Hỏi bổ sung thông tin theo CV & JD (Application Clarifications)](#24-hỏi-bổ-sung-thông-tin-theo-cv--jd-application-clarifications)
   - [2.5. Bóc tách hồ sơ ứng viên từ file PDF (AI PDF Resume Parser)](#25-bóc-tách-hồ-sơ-ứng-viên-từ-file-pdf-ai-pdf-resume-parser)
   - [2.6. Trợ lý HR tạo tin tuyển dụng thông minh (Recruiter Job AI Creator)](#26-trợ-lý-hr-tạo-tin-tuyển-dụng-thông-minh-recruiter-job-ai-creator)
   - [2.7. Tóm tắt tin tuyển dụng cho ứng viên (Job AI Summary)](#27-tóm-tắt-tin-tuyển-dụng-cho-ứng-viên-job-ai-summary)
   - [2.8. Trợ lý HR soạn Email cá nhân hóa (Recruiter Email AI Composer)](#28-trợ-lý-hr-soạn-email-cá-nhân-hóa-recruiter-email-ai-composer)
3. [Các Trụ Cột Kỹ Thuật Bảo Vệ Đồ Án (Core Technical Pillars)](#3-các-trụ-cột-kỹ-thuật-bảo-vệ-đồ-án)
4. [Kịch Bản Thuyết Trình Demo Mẫu (Live Demo Script 5 Phút)](#4-kịch-bản-thuyết-trình-demo-mẫu-live-demo-script-5-phút)
5. [Bộ Câu Hỏi & Đáp Vấn Đáp Với Hội Đồng (Defense Q&A)](#5-bộ-câu-hỏi--đáp-vấn-đáp-với-hội-đồng-defense-qa)

---

## 1. KIẾN TRÚC KỸ THUẬT TỔNG THỂ

Hệ thống được thiết kế theo mô hình **3 tầng phân tách trách nhiệm (3-Tier Separation of Concerns)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND: REACT 19 / TYPESCRIPT                   │
│  - Giao diện Ứng viên & HR (Vite, SPA, CSS Modules)                    │
│  - Nguyên lý Human-in-the-loop: xem trước, xác nhận, tick chấm điểm   │
│  - Bảo vệ CSRF Token tự động trên mọi HTTP method ghi (POST, PUT, DEL) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON (Cookie Session + Header X-CSRF-TOKEN)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKEND: SPRING BOOT 3.5 / JAVA 21                   │
│  - Phân quyền nghiêm ngặt (RBAC: CANDIDATE, RECRUITER, COMPANY_ADMIN)  │
│  - Kiểm soát luồng đồng thời: Semaphore (2 slots) chống nghẽn LLM      │
│  - Bộ đệm dữ liệu (Cache thông minh 24h & Source Hash) giảm chi phí   │
│  - Xác thực kép (Dual Validation) trước và sau khi lưu cơ sở dữ liệu   │
│  - Lưu trữ cơ sở dữ liệu: PostgreSQL 16 + JSONB hiệu năng cao          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON (Internal RestClient, timeout 60s)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    AI SERVICE: PYTHON 3.14 / FASTAPI                   │
│  - Multi-Provider: Groq Cloud (Primary ~1s) ➔ Google Gemini (Backup)  │
│  - Grounded AI Generation: bắt buộc trích dẫn văn bản nguồn chính xác │
│  - Pydantic v2 Strict Schema: extra='forbid' chống hallucination       │
│  - Bóc tách PDF (pypdf), GitHub REST API Async (httpx + semaphore)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CHI TIẾT CÁCH TRIỂN KHAI & LUỒNG HOẠT ĐỘNG CỦA 8 TÍNH NĂNG AI

---

### 2.1. Đánh giá độ phù hợp CV & JD (Candidate-Job Assessment)

#### A. Mục đích nghiệp vụ
Tự động so khớp hồ sơ ứng viên với các yêu cầu của tin tuyển dụng, loại bỏ việc đọc thủ công tốn thời gian (15–30 phút/CV) và chống lại sự thiên vị, đánh giá cảm tính của con người.

#### B. Sơ đồ luồng hoạt động (End-to-End Workflow)
```
[HR bấm "Phân tích AI"] 
         │
         ▼
[Frontend: AiAssessmentTab.tsx] 
         │ gọi triggerAssessment(appId, force)
         ▼
[Backend: AiAssessmentController.java] (Kiểm tra role RECRUITER)
         │
         ▼
[Backend: ApplicationAiEvaluator.java]
  ├─ 1. Khóa giao dịch PostgreSQL: pg_try_advisory_xact_lock("assessment:" + id)
  ├─ 2. Lấy dữ liệu: application_resume_snapshots & applications.job_snapshot
  ├─ 3. Tính toán SHA-256 hash của JD & CV (jobHash, inputHash)
  ├─ 4. Kiểm tra cache: Nếu !force và đã có kết quả cùng hash ➔ trả về ngay (0 token)
  └─ 5. Nếu chưa có: gửi HTTP POST sang AI Service /api/assess qua AiServiceClient
         │
         ▼
[AI Service: routers/assess.py]
  ├─ 1. Validate request bằng Pydantic model AssessRequest
  ├─ 2. Xây dựng prompt grounded: chỉ định rõ JD là yêu cầu, CV là năng lực
  ├─ 3. Gọi generate_grounded() sang Groq Cloud (llama-3.3-70b-versatile)
  └─ 4. Trả về AssessResult (criteria, matched_skills, missing_skills, gaps, interview_questions)
         │
         ▼
[Backend: ApplicationAiEvaluator.java]
  ├─ 1. Validate kép bằng AssessmentContext.validate(id, input, result)
  ├─ 2. Insert vào recruitment.ai_assessments (JSONB)
  └─ 3. Insert từng dòng vào recruitment.ai_assessment_criteria
         │
         ▼
[Frontend: AiAssessmentTab.tsx]
  Render Score (0–100), Radar Chart đa chiều (AssessmentRadar.tsx), 
  bảng tiêu chí kèm trích dẫn chứng cứ CV (Evidence).
```

#### C. Chi tiết triển khai mã nguồn
- **Frontend**: `frontend/src/features/applications/components/AiAssessmentTab.tsx`, `AssessmentCharts.tsx`, `AssessmentRadar.tsx`.
- **Backend**:
  - Controller: `com.lumi.recruitment.controller.AiAssessmentController`
  - Service: `com.lumi.recruitment.service.AiAssessmentService`, `ApplicationAiEvaluator.java`
  - DTO: `com.lumi.recruitment.dto.AiAssessmentDto`, `AiServiceResult.java`
  - Database: Bảng `recruitment.ai_assessments` và `recruitment.ai_assessment_criteria`.
- **AI Service**:
  - Model: `ai-service/models/schemas.py` (`AssessRequest`, `AssessResult`, `CriterionResult`, `GapItem`).
  - Logic: `ai-service/services/grounded_generation.py`, `ai-service/routers/assess.py`.
- **Công thức tính điểm**:
  $$\text{Score} = \frac{\sum (\text{points}_i \times \text{weight}_i)}{\sum \text{weight}_i}$$
  Trong đó: Kỹ năng bắt buộc nhân đôi trọng số ($\text{weight} = 2$), kỹ năng ưu tiên ($\text{weight} = 1$). Tiêu chí nào đạt điểm thì bắt buộc trường `evidence` phải trích dẫn nguyên văn từ CV.

---

### 2.2. Kiểm tra GitHub & Đối chiếu kinh nghiệm trong CV (GitHub Skill Verification)

#### A. Mục đích nghiệp vụ
Xác minh năng lực code thực tế của ứng viên công nghệ; phát hiện tình trạng khai khống kỹ năng, sao chép bài tập tutorial hoặc "vibe coding" (dùng AI sinh code nhưng chỉ commit 1 lần rồi bỏ xó).

#### B. Sơ đồ luồng hoạt động (End-to-End Workflow)
```
[HR bấm tab "Đối chiếu GitHub"]
         │
         ▼
[Frontend: GithubVerification.tsx] 
         │ gọi triggerGithubVerification(appId, force)
         ▼
[Backend: GithubVerificationController.java]
         │
         ▼
[Backend: GithubVerificationService.java]
  ├─ 1. Kiểm tra cache trong recruitment.application_github_verifications (< 24h)
  ├─ 2. Lấy githubUrl, cv_skills, cv_projects từ snapshot hồ sơ
  └─ 3. Gửi sang AI Service: POST /api/github-verify
         │
         ▼
[AI Service: routers/github_verification.py ➔ services/github_verifier.py]
  ├─ BƯỚC 1: Cào dữ liệu tĩnh bằng services/github_fetcher.py (0 token AI)
  │    ├─ Gọi REST API: GET /users/{username}
  │    ├─ Lấy danh sách repo không fork: GET /users/{username}/repos?sort=updated
  │    ├─ Chạy song song (asyncio.Semaphore(4)):
  │    │    ├─ Tính bytes ngôn ngữ lập trình ➔ tính % (Python 70%, Java 30%)
  │    │    ├─ Quét 10 commit gần nhất ➔ kiểm tra ngày commit đầu & cuối
  │    │    ├─ Quét file tree root: tìm Dockerfile, thư mục test/, thư mục .github/ CI
  │    │    └─ Tìm 1 file logic cốt lõi (Service.java, Hook.tsx) < 200 dòng
  │    └─ Thuật toán gắn cờ Vibe-coding cục bộ:
  │         ├─ Regex phát hiện repo tutorial: f8, tutorial, bootcamp, clone, todomvc
  │         ├─ Phát hiện 1-commit duy nhất
  │         └─ Phát hiện repo cũ (>30 ngày) nhưng tổng commit < 4
  │
  ├─ BƯỚC 2: Gọi AI Grounded đối chiếu ngữ nghĩa (< 1500 tokens)
  │    ├─ Ghép prompt gồm CV skills, CV projects, tóm tắt GitHub, cờ vibe-coding
  │    ├─ Gọi Groq Cloud (llama-3.3-70b-versatile) với strict schema
  │    └─ Phân loại kỹ năng:
  │         ├─ verified_skills: có chứng cứ code/repo thực tế
  │         └─ unverified_skills: chưa có chứng cứ công khai, kèm lời khuyên HR hỏi thêm
  └─ BƯỚC 3: Gộp kết quả tĩnh & AI ➔ trả về GithubVerificationResult
         │
         ▼
[Backend: GithubVerificationService.java]
  Lưu kết quả JSONB vào recruitment.application_github_verifications (Cache 24h)
         │
         ▼
[Frontend: GithubVerification.tsx]
  Hiển thị: Điểm chất lượng code (1-10), Chips (Test, Docker, CI/CD, Cờ Vibe-coding),
  Thanh phân bố ngôn ngữ có màu, Bảng đối chiếu kỹ năng 2 cột, Bảng khớp nối dự án.
```

#### C. Chi tiết triển khai mã nguồn
- **Frontend**:
  - Component: `frontend/src/features/applications/components/GithubVerification.tsx`
  - Style: `frontend/src/features/applications/components/github-verification.css`
  - Service: `frontend/src/services/github-verification.service.ts`
- **Backend**:
  - Controller: `com.lumi.recruitment.controller.GithubVerificationController`
  - Service: `com.lumi.recruitment.service.GithubVerificationService`
  - DTO: `com.lumi.recruitment.dto.GithubVerificationDto` (kèm WireResult)
  - Database: Migration `V25__github_verifications.sql` tạo bảng `recruitment.application_github_verifications`.
- **AI Service**:
  - Fetcher: `ai-service/services/github_fetcher.py` (REST API async, regex tutorial pattern).
  - Verifier: `ai-service/services/github_verifier.py` (prompt < 1500 tokens, Groq/Gemini).
  - Router: `ai-service/routers/github_verification.py`.

---

### 2.3. Phiếu phỏng vấn thông minh cho HR (AI Interview Scorecard)

#### A. Mục đích nghiệp vụ
Khép kín quy trình tuyển dụng sau khi lọc CV và soi GitHub: AI chuẩn bị sẵn bộ câu hỏi phỏng vấn chuẩn hóa "may đo riêng" theo từng ứng viên; HR và Tech Lead cầm phiếu này vào phỏng vấn, chấm điểm 1–5 sao, ghi nhận xét và chốt quyết định tuyển dụng minh bạch.

#### B. Sơ đồ luồng hoạt động (End-to-End Workflow)
```
[HR mở tab "Phiếu phỏng vấn" ➔ Bấm "Tạo phiếu phỏng vấn AI"]
         │
         ▼
[Frontend: InterviewScorecard.tsx] 
         │ gọi generateInterviewScorecard(appId, force)
         ▼
[Backend: InterviewScorecardController.java]
         │
         ▼
[Backend: InterviewScorecardService.java]
  ├─ 1. Kiểm tra cache nếu đã có phiếu trước đó
  ├─ 2. Gom dữ liệu đa nguồn từ DB:
  │    ├─ Từ ai_assessments: lấy danh sách missing_skills
  │    ├─ Từ application_github_verifications: lấy unverified_skills, vibe_coding_flags
  │    └─ Từ application_resume_snapshots: lấy CV summary, skills, projects
  └─ 3. Gửi payload sang AI Service: POST /api/interview-scorecard/generate
         │
         ▼
[AI Service: routers/interview_scorecard.py ➔ services/interview_scorecard.py]
  ├─ AI phân tích điểm yếu và nghi vấn ➔ tạo 2–3 Sections (Chuyên môn, Dự án, Kỹ năng mềm)
  ├─ Soạn 6–8 câu hỏi đào sâu trọng tâm
  └─ Với mỗi câu hỏi, sinh kèm RUBRIC CHẤM ĐIỂM:
       ├─ rubric_good: Tiêu chuẩn câu trả lời Đạt (Good answer indicator)
       └─ rubric_poor: Dấu hiệu cảnh báo Chưa đạt (Poor/Red-flag indicator)
         │
         ▼
[Backend: InterviewScorecardService.java]
  Lưu phiếu nháp (status='DRAFT') vào recruitment.application_interview_scorecards
         │
         ▼
[Frontend: InterviewScorecard.tsx]
  HR phỏng vấn trực tiếp:
  ├─ Đọc câu hỏi và mục tiêu kiểm chứng
  ├─ Xem Rubric hướng dẫn để nhận biết câu trả lời
  ├─ Bấm tick 1–5 sao cho câu hỏi
  ├─ Gõ ghi chú câu trả lời vào ô textarea
  ├─ Chọn Đề xuất: STRONG_HIRE / HIRE / CONSIDER / NO_HIRE
  └─ Bấm "Lưu bản nháp" hoặc "Hoàn tất phiếu phỏng vấn" ➔ PUT /api/recruiter/applications/{id}/scorecard
         │
         ▼
[Backend tính điểm trung bình]:
  overall_score = sum(points) / count(rated_questions), làm tròn 1 chữ số thập phân.
```

#### C. Chi tiết triển khai mã nguồn
- **Frontend**: `frontend/src/features/applications/components/InterviewScorecard.tsx`, `interview-scorecard.css`, `interview-scorecard.service.ts`.
- **Backend**:
  - Controller: `com.lumi.recruitment.controller.InterviewScorecardController`
  - Service: `com.lumi.recruitment.service.InterviewScorecardService`
  - DTO: `com.lumi.recruitment.dto.InterviewScorecardDto`
  - Database: Migration `V26__interview_scorecards.sql` tạo bảng `recruitment.application_interview_scorecards`.
- **AI Service**:
  - Model: `ai-service/models/interview_scorecard.py`
  - Service: `ai-service/services/interview_scorecard.py`
  - Router: `ai-service/routers/interview_scorecard.py`

---

### 2.4. Hỏi bổ sung thông tin theo CV & JD (Application Clarifications)

#### A. Mục đích nghiệp vụ
Tránh loại nhầm ứng viên có năng lực nhưng viết CV chưa đầy đủ; trao quyền cho ứng viên chủ động giải trình và cung cấp minh chứng cho các tiêu chí mà AI nhận diện là chưa rõ ràng.

#### B. Sơ đồ luồng hoạt động
1. Sau khi nộp đơn, tại tab **"Bổ sung thông tin"**, ứng viên thấy các tiêu chí bị đánh giá `PARTIAL` hoặc `NO_EVIDENCE`.
2. Ứng viên bấm "Tạo câu hỏi làm rõ" ➔ Backend gọi AI Service `/api/application-clarifications` để sinh tối đa **3 câu hỏi cụ thể**.
3. Các câu hỏi được lưu vào bảng `recruitment.application_clarification_questions`.
4. Ứng viên nhập câu trả lời (tối đa 3.000 ký tự) hoặc bấm "Bỏ qua".
5. Dữ liệu gửi lên kèm CSRF token và cơ chế Optimistic Locking (`version`) để chống ghi đè khi submit không theo thứ tự.
6. HR mở cùng tab đó để xem câu trả lời của ứng viên đối chiếu song song với CV gốc.

#### C. Chi tiết triển khai mã nguồn
- **Frontend**: `ApplicationClarifications.tsx`, `application-clarifications.css`, `application-clarification.service.ts`.
- **Backend**: `ApplicationClarificationController.java`, `ApplicationClarificationService.java`, migration `V24__application_clarifications.sql`.
- **AI Service**: `models/application_clarifications.py`, `services/application_clarifications.py`, `routers/application_clarifications.py`.

---

### 2.5. Bóc tách hồ sơ ứng viên từ file PDF (AI PDF Resume Parser)

#### A. Mục đích nghiệp vụ
Cho phép ứng viên nộp CV dạng file PDF bất kỳ; AI tự động đọc cấu trúc trang phức tạp để chuyển đổi thành dữ liệu JSON chuẩn hóa, phục vụ cho việc đối chiếu và gợi ý việc làm.

#### B. Sơ đồ luồng hoạt động
1. Ứng viên tải file PDF lên hệ thống (`POST /candidate/resumes/parse-pdf`).
2. Backend chuyển tiếp file nhị phân (multipart/form-data) sang AI Service `/api/cv-parser`.
3. AI Service dùng thư viện `pypdf` trích xuất các khối văn bản thô theo trang, sau đó đưa vào mô hình AI với schema Pydantic `ParsedResumeResult`.
4. AI cấu trúc hóa thông tin thành các phần: Họ tên, Email, SĐT, Vị trí mong muốn, Tóm tắt, Danh sách kỹ năng, Kinh nghiệm, Học vấn, Dự án, Chứng chỉ, Hoạt động.
5. Dữ liệu trả về Backend lưu tạm vào `candidate.resume_documents` với trạng thái `PARSED`.
6. Frontend mở giao diện **Đối chiếu 2 cột (Side-by-side Review)**: Bên trái là file PDF gốc, bên phải là các trường dữ liệu AI đã bóc tách. Ứng viên kiểm tra, chỉnh sửa sai sót (nếu có) rồi bấm "Xác nhận & Lưu".

---

### 2.6. Trợ lý HR tạo tin tuyển dụng thông minh (Recruiter Job AI Creator)

#### A. Mục đích nghiệp vụ
Tăng tốc độ đăng tuyển công việc cho HR từ 45 phút xuống còn 1 phút; chuẩn hóa cấu trúc mô tả công việc, kỹ năng bắt buộc/ưu tiên và tiêu chí tuyển dụng theo tiêu chuẩn thị trường.

#### B. Hai chế độ hoạt động
- **Chế độ 1 - Bóc tách từ file nháp (`/api/jobs/parse-jd`)**: HR tải lên file PDF nháp hoặc dán văn bản tự do. AI tự động bóc tách thành: Tiêu đề, Mô tả công việc, Yêu cầu ứng viên, Quyền lợi, Danh mục kỹ năng (Required/Preferred) và Tiêu chí tuyển dụng có gán trọng số gợi ý.
- **Chế độ 2 - Tự động sinh JD từ chức danh (`/api/jobs/generate-jd`)**: HR chỉ cần nhập tên vị trí (vd: *Senior Golang Engineer*) và chọn phòng ban, AI tự động tạo toàn bộ nội dung một bản JD chuyên nghiệp chuẩn công nghệ.
- **Human-in-the-loop**: Dữ liệu AI tạo ra được điền sẵn vào Form (`RecruiterJobForm.tsx`), HR có toàn quyền sửa đổi, thêm bớt trước khi bấm "Lưu tin tuyển dụng".

---

### 2.7. Tóm tắt tin tuyển dụng cho ứng viên (Job AI Summary)

#### A. Mục đích nghiệp vụ
Giúp ứng viên nhanh chóng nắm bắt các yêu cầu then chốt của công việc chỉ trong 5 giây mà không cần đọc văn bản dài hàng ngàn từ.

#### B. Sơ đồ luồng & Bộ đệm thông minh (Source Hash Caching)
1. Khi ứng viên mở trang việc làm (`JobDetailPage.tsx`), Frontend gọi `GET /api/jobs/{id}/summary`.
2. Backend kiểm tra mã băm SHA-256 (`source_hash`) của nội dung tin tuyển dụng hiện tại so với bản lưu trong bảng `recruitment.job_ai_summaries`.
3. **Nếu hash trùng khớp**: Trả về ngay lập tức từ Database (độ trễ 10ms, tốn 0 token).
4. **Nếu tin tuyển dụng vừa được HR sửa (hash đổi)**: Backend mới gọi AI Service `/api/job-summary` để tóm tắt lại thành 3 gạch đầu dòng cốt lõi (Vị trí & Nhiệm vụ chính, Kỹ năng công nghệ bắt buộc, Chế độ đãi ngộ & địa điểm).

---

### 2.8. Trợ lý HR soạn Email cá nhân hóa (Recruiter Email AI Composer)

#### A. Mục đích nghiệp vụ
Tự động hóa khâu giao tiếp ứng viên nhưng vẫn giữ được sự ấm áp, lịch sự và mang tính cá nhân hóa cao cho từng trường hợp.

#### B. Sơ đồ luồng hoạt động
1. Tại màn hình đơn ứng tuyển, HR chọn tab **"Soạn email"** (`ApplicationEmailComposer.tsx`).
2. HR chọn 1 trong 3 kịch bản:
   - *Thư mời phỏng vấn (Interview Invitation)*: Tự động điền ngày giờ, địa điểm/link Google Meet, gợi ý chủ đề trao đổi.
   - *Thư từ chối khéo léo (Rejection with Feedback)*: Tự động trích dẫn nhận xét mang tính xây dựng từ kết quả đánh giá AI để động viên ứng viên.
   - *Thư mời nhận việc (Job Offer)*: Tự động điền mức lương, ngày bắt đầu làm việc và thời hạn phản hồi.
3. HR chọn tông giọng: *Trang trọng (Professional)* hoặc *Thân thiện, cởi mở (Friendly)*.
4. AI Service `/api/emails/generate` sinh tiêu đề (`subject`) và nội dung (`body`) hoàn chỉnh.
5. HR xem trước, chỉnh sửa câu chữ trực tiếp trên giao diện rồi bấm gửi hoặc copy.

---

## 3. CÁC TRỤ CỘT KỸ THUẬT BẢO VỆ ĐỒ ÁN

Nếu Hội đồng hỏi về kiến trúc AI, hãy trình bày **4 trụ cột kỹ thuật** sau:

### 1. Kiến trúc Hybrid (Tiết kiệm chi phí & Tốc độ cao)
- Không ném bừa toàn bộ mã nguồn hoặc tài liệu vào LLM.
- Các tác vụ tính toán số liệu (tính % ngôn ngữ, đếm commit, regex tutorial, kiểm tra file tree) được xử lý bằng **thuật toán code Python thuần túy (0 token)**.
- LLM chỉ nhận bản tóm tắt tinh gọn (< 1500 tokens) để thực hiện tư duy đối chiếu ngữ nghĩa cao cấp.

### 2. Nguyên tắc Grounded Generation (Tuyệt đối chống Ảo giác / Bịa đặt)
- Mọi mô hình AI đều được áp đặt **Pydantic v2 Strict Schema** với `extra='forbid'`.
- Kết quả chấm điểm bắt buộc phải đi kèm câu trích dẫn nguyên văn từ CV ứng viên. Nếu không có chứng cứ trong văn bản nguồn, AI bị chặn không được tự bịa điểm.

### 3. Khả năng chịu lỗi cao (Multi-Provider Fallback & Circuit Breaker)
- **Provider chính**: Groq Cloud chạy `llama-3.3-70b-versatile` hoặc `gpt-oss-120b` với tốc độ phản hồi cực nhanh (chỉ từ 1–2 giây).
- **Provider dự phòng**: Google Gemini Flash (`gemini-1.5-flash`).
- Cơ chế Cooldown Circuit Breaker: Nếu một provider bị lỗi hoặc dính Rate Limit (HTTP 429), hệ thống tự động ngắt và chuyển sang provider dự phòng mà người dùng không hề nhận thấy gián đoạn.

### 4. Triết lý Human-in-the-loop & Đạo đức AI
- AI đóng vai trò **trợ lý đề xuất thông tin**, không có quyền tự động đánh trượt hay thay đổi trạng thái hồ sơ của ứng viên.
- Quyền quyết định chuyển vòng, chấm điểm phỏng vấn và ra quyết định tuyển dụng luôn nằm 100% trong tay nhân sự (HR).

---

## 4. KỊCH BẢN THUYẾT TRÌNH DEMO MẪU (LIVE DEMO SCRIPT 5 PHÚT)

Khi lên bảng bảo vệ đồ án, hãy thực hiện kịch bản demo 5 bước mạch lạc sau:

- **Bước 1 (1 phút) - Đăng tuyển & Ứng tuyển**: 
  - Mở trang tạo JD bằng AI (`generate-jd`), chỉ cần nhập "Backend Java", AI tạo ra JD đầy đủ tiêu chí.
  - Ứng viên nộp CV dạng PDF có link GitHub.
- **Bước 2 (1 phút) - Đánh giá AI CV–JD**:
  - HR vào xem đơn ứng tuyển, mở tab **"Đánh giá AI"**: Xem điểm phù hợp (vd: 78/100), xem biểu đồ Radar, các kỹ năng khớp và các khoảng trống kỹ năng cần bù đắp.
- **Bước 3 (1 phút) - Điểm nhấn "Đối chiếu GitHub" (Highlight)**:
  - Bấm tab **"Đối chiếu GitHub"**: Chỉ cho thầy cô thấy AI phân tích profile GitHub thật:
    - Biểu đồ phân bố ngôn ngữ thực tế.
    - Phát hiện tín hiệu: Có Unit Test, có Docker hay dính cờ Vibe-coding (1 commit dump).
    - Bảng đối chiếu: Kỹ năng có bằng chứng code vs Kỹ năng khai khống chưa có bằng chứng.
- **Bước 4 (1 phút) - Khép kín với "Phiếu phỏng vấn thông minh"**:
  - Mở tab **"Phiếu phỏng vấn"**: Bấm tạo phiếu AI.
  - Thấy AI tự động gom các điểm thiếu từ CV và nghi vấn code từ GitHub thành câu hỏi phỏng vấn kèm Rubric Đạt/Kém.
  - HR giả lập chấm 4 sao, chọn "Đạt (Hire)" và bấm lưu phiếu.
- **Bước 5 (1 phút) - Soạn Email tự động**:
  - Sang tab **"Soạn email"**: Bấm tạo thư mời phỏng vấn hoặc offer, AI tự điền toàn bộ thông tin cá nhân hóa.

---

## 5. BỘ CÂU HỎI & ĐÁP VẤN ĐÁP VỚI HỘI ĐỒNG (DEFENSE Q&A)

### Q1: Tại sao em không dùng mô hình nhúng (Embedding) và Vector DB (RAG) để so sánh CV và JD mà lại dùng LLM trực tiếp?
> **Trả lời:**
> *"Dạ thưa thầy/cô, độ tương đồng Vector (Cosine Similarity) chỉ đo được sự trùng lặp từ ngữ bề mặt (semantic similarity) chứ không đánh giá được logic nghiệp vụ. Ví dụ: JD đòi '3 năm kinh nghiệm Java', nếu dùng Vector thì ứng viên ghi '1 năm Java' vẫn có độ tương đồng rất cao. Hệ thống của em dùng LLM với Pydantic Schema để phân tích logic điều kiện, bóc tách trọng số có căn cứ và yêu cầu trích dẫn bằng chứng cụ thể."*

### Q2: Nếu ứng viên không có GitHub hoặc để kho mã nguồn Private thì AI có đánh trượt không?
> **Trả lời:**
> *"Dạ hoàn toàn không. Đây là nguyên tắc đạo đức AI quan trọng mà nhóm em đã cài đặt trong hệ thống. Dữ liệu GitHub chỉ là nguồn tham khảo bổ trợ. Khi không có bằng chứng công khai, AI ghi rõ: 'Chưa có bằng chứng công khai; HR nên hỏi thêm khi phỏng vấn', tuyệt đối không kết luận ứng viên nói dối và hệ thống không tự động trừ điểm hay loại hồ sơ."*

### Q3: Nếu nhà cung cấp AI (Groq/OpenAI) bị nghẽn mạng hoặc sập thì hệ thống có chết theo không?
> **Trả lời:**
> *"Dạ không. Hệ thống được thiết kế chịu lỗi cao: Nhóm em đã xây dựng cơ chế Multi-Provider Fallback với Circuit Breaker. Nếu Groq bị nghẽn hoặc hết hạn ngạch (429), hệ thống tự động chuyển tiếp sang Google Gemini Flash. Đồng thời mọi kết quả phân tích đều được lưu cache 24h trong PostgreSQL, giúp người dùng mở lại xem tức thì mà không cần gọi lại AI."*

### Q4: Chi phí gọi AI của hệ thống có đắt không? Làm sao để mở rộng quy mô khi có hàng ngàn ứng viên?
> **Trả lời:**
> *"Dạ chi phí cực kỳ tối ưu nhờ kiến trúc Hybrid. Toàn bộ việc parse PDF, tính toán tỷ lệ ngôn ngữ, phân tích tần suất commit đều được chạy bằng code Python cục bộ (tốn 0 token). Chỉ khi đối chiếu logic nhóm em mới gọi LLM với prompt rút gọn dưới 1500 tokens. Với mô hình Llama-3.3 trên Groq, chi phí cho mỗi lượt phân tích chưa tới 0.001 USD (khoảng 25 VNĐ), hoàn toàn khả thi để mở rộng quy mô thực tế."*

### Q5: Dữ liệu cá nhân trong CV và mã nguồn của ứng viên có bị gửi lung tung lên mạng để huấn luyện AI không?
> **Trả lời:**
> *"Dạ thưa thầy/cô, hệ thống tuân thủ nghiêm ngặt nguyên tắc bảo mật: Nhóm em sử dụng các API trả phí/doanh nghiệp của Groq Cloud và Google Cloud với chính sách cam kết không lưu trữ (Zero Data Retention) và không dùng dữ liệu người dùng gửi lên để tái huấn luyện mô hình. Đồng thời, hệ thống chỉ đọc các repository công khai (public) mà ứng viên tự nguyện cung cấp liên kết trong CV, hoàn toàn không can thiệp vào các tài nguyên riêng tư."*
