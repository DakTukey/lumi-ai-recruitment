# CV Builder: structured fields and completion review

Updated 2026-10-13.

The four-step builder now supports project dates (`startDate`, `endDate`, `current`) and `technologies: string[]`. Education supports optional numeric `gpa` and `gpaScale` (4, 10, or 100). Candidate and recruiter previews share the same renderer, including these fields. Project entries are ordered by recency in the preview without reordering the form.

These are additive properties inside existing `candidate.resumes.projects` and `candidate.resumes.educations` JSONB arrays. No schema migration is necessary. Existing saved CVs and submitted snapshots without the new properties still deserialize. Snapshot-based AI assessment already accepts the complete nested sections.

Example project:

```json
{"name":"Library API","role":"Backend Developer","description":"Implemented book lending API","url":"https://example.com/project","startDate":"2025-01","endDate":"","current":true,"technologies":["Java","PostgreSQL"]}
```

Example education:

```json
{"school":"University","degree":"Bachelor","field":"Computer Science","startDate":"2021-09","endDate":"2025-06","description":"Graduation project","gpa":3.65,"gpaScale":4}
```

GPA is optional; when used it requires a supported scale, is nonnegative, has at most two decimal places, and cannot exceed the scale. Project date validation rejects reversed ranges or an end date on a current project. Both frontend and backend enforce these rules.

Skill tags use case-insensitive identity while preserving spelling and punctuation such as C++ and C#. Search ignores Vietnamese accents; identity does not. Importing profile skills merges comma/newline-delimited values with the current CV and reports overlong names or items exceeding the 100-skill limit. Manual entry supports Enter/comma, IME composition, Backspace, and commits valid pending text when leaving the field. Candidate-defined skills remain in the CV and do not create catalog records. Empty catalogs permit manual entry.

Completion review suggests a summary, skills and at least education or described work/project evidence. Partially filled unnamed entries are highlighted. These are advisory checks: candidates may review and explicitly confirm completion, or save a draft. No AI score is inferred and work experience is not mandatory. Invalid field values block saving and return the user to the relevant step. Wholly empty repeatable rows are removed on save.

AI writing remains an assistant for summary, experience and project descriptions. It offers polish, shorten and bullets, asks follow-up questions, and requires Apply followed by Save. It does not automatically invent or fill the entire CV.

Verification: frontend build, lint (one existing warning in TopCandidatesWidget), 15 frontend test files, Java field/AI unit tests, four PostgreSQL integration tests in an isolated database, and one live AI request using synthetic CV content. The integration tests cover create/update/read, GPA and project persistence, invalid values, and legacy payload compatibility. Browser automation was unavailable in this session; visual desktop/mobile inspection remains unverified.
