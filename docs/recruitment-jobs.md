# Public recruitment jobs (V3, extended in V7–V8)

Implemented for one company: Lumi Studio. No company/tenant table.
Migration V3 adds schema `recruitment`, `departments` and `jobs`; existing account/profile data is unchanged.
No production seed jobs or departments are automatically inserted.

## Tables

- departments: UUID id, unique name (150), description TEXT, is_active.
- jobs: UUID id, department_id FK, created_by FK to auth.users, title (255), description,
  requirements, benefits, legacy skills (comma-separated TEXT), location, employment_type,
  work_mode, experience_level, salary_min/max NUMERIC(15,2), currency, status, featured,
  published_at, application_deadline, created_at, updated_at (TIMESTAMPTZ), headcount INTEGER.
- Status DRAFT/PUBLISHED/CLOSED; employment FULL_TIME/PART_TIME/INTERNSHIP/CONTRACT;
  work mode ONSITE/HYBRID/REMOTE; experience INTERN/JUNIOR/MIDDLE/SENIOR.
- Salary is monthly VND, not millions; nullable endpoints mean negotiable/from/up to.
  Currency currently restricted to VND. CHECKs enforce nonnegative ordered salaries,
  nonblank title, valid codes, published date and deadline order.
- FK indexes for department and author; indexes for publication and deadline.
- No cascading delete of users/departments into jobs.

V7 adds `catalog.skills`, `recruitment.job_skills`, `job_requirements`, `job_history`
and `recruiter_profiles`, plus job `version` and `updated_by`. See
[HR/catalog database](recruitment-catalog-and-hr.md) for constraints and migration rules.
Existing skill text is preserved and backfilled into unique catalog/link records.
Public reads and skill searches now use `job_skills`; new writes must use those links.
The API still returns `skills: string[]`. Structured requirements are not yet exposed
by public DTOs; the public free-form requirements text remains available.

V8 adds `headcount`: NOT NULL, DEFAULT 1, CHECK > 0. It represents people to recruit,
not applications received. Existing jobs receive 1 without changing their other data.
Java `Job` defaults to 1 and validates with `@NotNull`/`@Positive`; list/detail DTOs
return `headcount` as an integer. Any future write API must validate its request too.

## Public API

GET `/api/departments`: active departments, sorted by name.
GET `/api/jobs`: paginated published jobs.
GET `/api/jobs/{uuid}`: job detail, same visibility rules; missing/hidden => JSON 404.

Visibility: PUBLISHED, published_at <= now, deadline absent or > now,
active department. Client cannot request draft/closed visibility using a status parameter.
No account identifiers/passwords appear in job responses. All endpoints return ApiResponse DTOs.

List parameters:

| Parameter | Contract |
|---|---|
| keyword | title or skills; case-insensitive literal substring, max 200; accents significant |
| departmentId | UUID |
| level | repeated or comma-separated INTERN/JUNIOR/MIDDLE/SENIOR; OR within field |
| workMode | repeated or comma-separated ONSITE/HYBRID/REMOTE; OR within field |
| minSalary | minimum advertised lower monthly salary, VND; excludes unknown lower salary |
| ids | optional UUID list, for session-only saved jobs |
| sort | featured (default), newest, salary; unknown salary sorts last |
| page, size | zero-based page >= 0; size 1–100, default 12 |

Filters combine with AND. Sorting includes publication date and UUID tie-breaker.
Response: content, page, size, totalElements, totalPages, first, last.
Invalid filters/UUIDs => 400. Read permission does not authorize writes.

## Frontend

Explore fetches from API, with loading/error/retry/empty states and 12 jobs per page.
Department tabs come from the department API. Changes to filters reset the page;
late responses from superseded requests are ignored. Opening job detail fetches fresh data.
Descriptions/requirements/benefits render as plain text, preserving line breaks.
No fallback to hard-coded jobs on an API error. Removed mock personalized suggestions.

Recruiters can now create real private drafts and departments through the [recruiter API](recruiter-job-api.md). Publishing/editing/closing remains demo-only and does not publish to the public API.
Saving/applying remains session-only demo state; UUIDs and application snapshots keep
those existing demo flows compatible. CV upload, actual application persistence and
recommendation are not implemented in this change.

Recruiter demo forms require a positive integer headcount (maximum 2147483647, the
PostgreSQL INTEGER limit). Editing preserves it; the list, preview and candidate job
detail display it. Public API data is used directly; unknown legacy demo values do
not imply a real hiring target.

## Run / verification

From project root: `mvn -f backend/pom.xml spring-boot:run`.
Frontend: `cd frontend` then `npm run dev` (proxy /api to 8080).
Database without job records displays an empty list. Next step: recruiter draft editing and publication/closing.

Backend tests use isolated PostgreSQL databases with LUMI_TEST_POSTGRES_URL,
LUMI_TEST_POSTGRES_USER, LUMI_TEST_POSTGRES_PASSWORD. Run `mvn verify`.
Includes public anonymous reads, filtering, salary ordering/nulls, pagination, hidden states,
closing a published job, invalid parameters, unknown UUID and write denial.
V8 tests also cover old data/defaults, invalid headcount writes, entity validation,
idempotent migrations, and list/detail API headcount mapping. 33 backend tests pass.
Frontend: `npm run build`, `npm run lint`.
