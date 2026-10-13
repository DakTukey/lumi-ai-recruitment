# Candidate onboarding

Implemented: three fixed steps at `/onboarding`, with answers persisted to PostgreSQL.
Question labels, types, help text and order are in
`frontend/src/features/profile/ProfileEditor.tsx`; no dynamic question/answer tables.

## Storage

Flyway V2 adds `location varchar(255)`, `desired_position varchar(255)`,
`onboarding_status varchar(20) NOT NULL DEFAULT 'NOT_STARTED'` and
`onboarding_step integer NOT NULL DEFAULT 0` to `candidate.candidate_profiles`.
Existing rows and existing field types are preserved. Existing accounts start at NOT_STARTED.
The step is zero based, constrained to 0–2; status has a database CHECK constraint.

- Name: `auth.users.full_name`.
- Phone, location, skills, experience years, desired position: `candidate.candidate_profiles`.
- `headline` remains a separate existing field; it is not used for desired position.
- No new schema/table. Skills remain comma-separated TEXT.

## Lifecycle and REST API

Candidate login/register/GET `/api/auth/me` includes `onboardingStatus` (null for other roles).
NOT_STARTED/IN_PROGRESS candidates are redirected to `/onboarding`; recruiter/admin routes are unaffected.
Each successful Continue saves the entire editable profile snapshot and advances the persisted step.
Completing step 2 sets COMPLETED. Skip sets SKIPPED and preserves previously saved answers.
Unsaved input is not saved by Skip. Both terminal statuses stop automatic onboarding redirects.
Reload or another login resumes the persisted step for unfinished onboarding.
Back retains current input in memory; another Continue saves it. Optional answers may be empty.

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/api/candidate/profile` | Read current user's profile |
| PUT | `/api/candidate/profile` | Replace editable fields; keep onboarding state |
| POST | `/api/candidate/onboarding/steps/{step}` | Save profile; steps 0/1 advance, 2 completes |
| POST | `/api/candidate/onboarding/skip` | Skip; no profile fields overwritten |

Save DTO: `fullName`, `phone`, `location`, `skills`, `experienceYears`, `desiredPosition`.
Send all editable fields, including unchanged values; omitted optional fields become null.
The frontend loads the full snapshot before allowing edits.
Name is required (max 150); phone max 30 and restricted characters; location/desired position max 255;
skills max 4000; experience optional, 0–80 with one decimal place.
Identity comes exclusively from the authenticated session. The service rechecks ACTIVE/CANDIDATE.
All writes are transactional, require CSRF, and return DTOs rather than entities.

Profile personal and preferences panels now read/write the same API. CV/AI panels remain demos.
Work preferences are persisted by V4 (see below).

## Run and validate

Restart backend after building so Hibernate validates V4 and the new API is available.
Start backend from `backend` (`mvn spring-boot:run`) or use `mvn -f backend/pom.xml spring-boot:run`.
Start frontend from `frontend` (`npm run dev`); Vite proxies `/api` to port 8080.

Integration tests require LUMI_TEST_POSTGRES_URL, LUMI_TEST_POSTGRES_USER,
LUMI_TEST_POSTGRES_PASSWORD and permission to create/drop isolated test databases.
Run `mvn test` from backend. Without the environment variable, database tests are skipped.
All test contexts use isolated databases; application data is not a test fixture.
Frontend checks: `npm run build`, `npm run lint`.

Test coverage includes V1→V2 data preservation, fresh migrations/Hibernate validation,
onboarding persistence across login, skip preservation, completion, profile editing,
invalid DTOs, CSRF, unauthenticated/recruiter rejection and forged user IDs.

## V4: career preferences survey

The three steps now ask about (1) desired position and employment types,
(2) relevant experience range and skills, (3) work modes and office preferences.
Name, email, phone and current residence stay in the Profile personal panel.
All survey answers are optional. Skills use suggestions and individual custom chips;
the existing comma-separated TEXT storage remains unchanged.
Question copy and labels live in `frontend/src/features/profile/questions.ts`;
rendering and input handling live in `ProfileEditor.tsx`.

V4 adds the following columns to `candidate.candidate_profiles`:

| Column | Meaning |
|---|---|
| employment_types jsonb | Array of FULL_TIME, PART_TIME, INTERNSHIP, CONTRACT |
| work_modes jsonb | Array of ONSITE, HYBRID, REMOTE |
| preferred_locations jsonb | Selected company office locations, distinct from current residence |
| experience_range varchar(30) | NONE, UNDER_ONE, ONE_TO_THREE, THREE_TO_FIVE, FIVE_PLUS; NULL means unanswered |
| position_undecided boolean | Explicitly undecided; clears desired_position when true |

New accounts have NULL experience_years, rather than an assumed zero.
Selecting a range clears exact years; no midpoint is invented. Existing exact years
are retained by migration; positive values populate the corresponding range.
Legacy zero stays zero with NULL range because it may have been a default.
V4 resets only IN_PROGRESS step numbers to 0 because question order changed;
answers remain and COMPLETED/SKIPPED accounts are not prompted again.

GET `/api/candidate/profile/options` returns company-supported choices. Configure
`app.candidate-preferences` in application.yml, including environment overrides
`LUMI_EMPLOYMENT_TYPES`, `LUMI_WORK_MODES`, `LUMI_LOCATIONS` (comma-separated).
Defaults are FULL_TIME/INTERNSHIP, ONSITE/HYBRID/REMOTE, and Đà Nẵng.
A single office is shown as information; multiple offices allow selection.
Position and skill suggestions are editable configuration, not a list of active vacancies.
There is no dynamic question table or new schema.

The save DTO now also accepts employmentTypes, workModes, preferredLocations,
experienceRange and positionUndecided. The frontend always sends the full snapshot.
For older clients, omitted list fields and positionUndecided preserve existing values;
other omitted optional fields still clear their values. Arrays deduplicate on save.
Unsupported new company choices are rejected. Previously saved choices remain
editable/removable even if company configuration changes.

The Profile preferences panel edits the same persisted answers. These fields are
available for future matching; this change does not implement recommendation ranking.
Tests cover V3→V4 preservation and repeat migrations, fresh Hibernate validation,
actual repository values, unanswered vs NONE, unsupported choices and rollback.

## Focused onboarding layout

The `/onboarding` route uses its own layout outside PublicLayout. Its header contains
only the Lumi identity and a single Skip button. Its footer reminds users that saved
steps are retained and answers can be edited later. The shorter introduction is
“Tìm cơ hội phù hợp với bạn”. Skip shares the editor's request state so it cannot
race a save. Completing/skipping returns to the public layout with its full navigation.
Profile editing continues inside the public layout.

## Candidate profile overview

`/profile` now shows the persisted profile as an overview: identity and cover,
career preferences, skills, experience, contact details and a CV tab. Edit actions
open a native dialog using the existing ProfileEditor; a successful save updates
the overview and closes the dialog. Escape/close discards unsaved edits.
Completion reflects five actual groups: career goal (including undecided), skills
and experience together, work preferences, current residence, contact phone.
No job/application demo counts are displayed as real profile statistics.
CV selection remains local only, with a visible notice that the file is not uploaded.

## CV builder and account settings entry points

The candidate header avatar opens a disclosure with Profile, Settings and Logout.
It closes on outside pointer interaction, route changes and Escape. Settings at
`/settings` is protected for candidates and shows account information from the
session; security, notifications and privacy clearly show upcoming features.

Profile CV tab is addressable as `/profile?tab=cv`, with “CV của tôi” and a
“Tạo CV với AI” entry to `/cv-builder`. A side card also links to the builder.
The protected builder prefills identity, contact, desired position and skills
from GET profile, allows manual text editing and classic/modern template selection,
and provides native browser Print/Save PDF. Print styles only include the CV.
V5 now persists structured CV drafts via the candidate resume API; users explicitly save
before leaving. Saved CVs can be reopened and do not modify the candidate profile.
See [candidate-resumes.md](candidate-resumes.md). AI writing is explicitly
marked upcoming. There is no AI API integration, password-change endpoint or persisted
notification/privacy preference in this UI change.
