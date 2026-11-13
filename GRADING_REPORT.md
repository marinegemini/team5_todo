# Grading Report

**Branch:** `main`  
**Commit SHA:** `4c2c495fae4d2ebbbf0e9e281b74b0cd39da5178`  
**Review Method:** Static review only (source code, test files, configuration, and documentation inspected; no test cases or application servers executed).

---

## Treatment of Runtime-Dependent Criteria

Per static-review rules, any criterion in `EVALUATION.md` that requires executing the application, running tests, measuring live timings, or deploying to a live host is marked **`Unverified (requires runtime evidence)`**:

- **Testing Coverage (0–30):** Points are awarded conservatively for the static presence and completeness of test suites/helpers (`tests/unit.test.ts`, `tests/e2e.spec.ts`, `tests/helpers.ts`, `playwright.config.ts`). Points requiring runtime execution evidence (e.g., 3 consecutive passing E2E runs, manual browser notification/WebAuthn testing) are withheld.
- **Deployment (0–30):** No live deployment exists; deployment and post-deployment runtime checks score `0`. Static configuration and documentation are scored from repository files.
- **Quality & Performance (0–30):** Static architecture (TypeScript strict mode, ESLint config, SQLite indexes/prepared statements, security controls, ARIA/dark-mode markup) is scored from code inspection. Runtime-only benchmarks (Lighthouse > 90, FCP < 1s, API < 300ms, 1000-todo filter < 100ms) are marked `Unverified` and receive partial/withheld credit.

---

## Per-Feature Scorecard (0–110)

| # | Feature | Score | Max | Status & Evidence / Deductions |
|---|---|---|---|---|
| 01 | **Todo CRUD Operations** | **10** | 10 | Full schema (`lib/db.ts:242-258`), REST routes (`app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`), Singapore timezone validation (`app/api/todos/route.ts:36-47`), optimistic UI, Edit modal, and Overdue/Pending/Completed sections (`app/page.tsx`). Note: `app/page.tsx:385-394` deletes without a confirmation dialog (matches PRP 01, differs from `EVALUATION.md:37`). Runtime E2E behavior: *Unverified (requires runtime evidence)*. |
| 02 | **Priority System** | **10** | 10 | `Priority` type and `validatePriority` (`lib/todoSort.ts:3-7`), `sortTodos` (`lib/todoSort.ts:25-27`), `PriorityBadge` (`app/page.tsx:52-60`), priority dropdown (`app/page.tsx:916-925`), and priority filter (`app/page.tsx:1077-1091`). Runtime sorting/contrast: *Unverified (requires runtime evidence)*. |
| 03 | **Recurring Todos** | **10** | 10 | `is_recurring` / `recurrence_pattern` schema (`lib/db.ts:249-250`), due-date requirement validation (`app/api/todos/route.ts:51-61`), `calculateNextDueDate` with month-end/leap-year clamping (`lib/recurrence.ts:8-38`), next-instance creation with metadata inheritance on completion (`app/api/todos/[id]/route.ts:95-115`). |
| 04 | **Reminders & Notifications** | **10** | 10 | `reminder_minutes` / `last_notification_sent` (`lib/db.ts:251-252`), `GET /api/notifications/check` (`app/api/notifications/check/route.ts:6-15`), `useNotifications` 30s polling hook (`lib/hooks/useNotifications.ts:5-57`), 7 presets + disabled-without-due-date select (`app/page.tsx:990-1012`), reset on edit (`lib/db.ts:654-656`). Live browser notification firing: *Unverified (requires runtime evidence)*. |
| 05 | **Subtasks & Progress Tracking** | **10** | 10 | `subtasks` table with `ON DELETE CASCADE` (`lib/db.ts:260-269`), `PRAGMA foreign_keys = ON` (`lib/db.ts:208`), `/api/todos/[id]/subtasks` & `/api/subtasks/[id]` routes, `calculateProgress` (`lib/subtaskProgress.ts:3-11`), `ProgressBar` green at 100% / blue otherwise (`app/page.tsx:86-108`), collapsible `SubtaskList` (`app/page.tsx:722-783`). |
| 06 | **Tag System** | **10** | 10 | `tags` & `todo_tags` tables with `UNIQUE(user_id, name)` (`lib/db.ts:271-285`), all 6 tag endpoints (`app/api/tags/route.ts`, `app/api/tags/[id]/route.ts`, `app/api/todos/[id]/tags/route.ts`), `ManageTagsModal` (`app/page.tsx:1387-1499`), multi-tag pills & click-to-filter (`app/page.tsx:708-718`). |
| 07 | **Template System** | **5** | 10 | **Partial (-5 pts):** `templates` table (`lib/db.ts:287-302`), all 5 API routes (`app/api/templates/route.ts`, `[id]/route.ts`, `[id]/use/route.ts`), `SaveTemplateModal` (`app/page.tsx:1502-1616`), and `TemplateManager` (`app/page.tsx:1619-1696`) are present, **but** `TemplateManager` lacks a category filter (`EVALUATION.md:236`) and an edit template UI (`EVALUATION.md:246`), exposing only `Use` and `Delete` buttons (`app/page.tsx:1674-1689`). |
| 08 | **Search & Filtering** | **10** | 10 | `useDebounce` 300ms (`lib/hooks/useDebounce.ts:3-12`), `applyFilters` (`lib/filters.ts:32-77`), search + priority + tag + advanced status/date-range + saved `localStorage` presets (`app/page.tsx:1049-1215`). Minor note: `lib/filters.ts:36-42` searches todo titles and subtask titles, not tag names (`EVALUATION.md:267`, though tag filtering is provided via dropdown/pills). |
| 09 | **Export & Import** | **10** | 10 | `GET /api/todos/export` JSON (`version: 1`) & RFC 4180 CSV (`app/api/todos/export/route.ts:53-92`), `POST /api/todos/import` Zod validation (`app/api/todos/import/route.ts:5-31`), transactional `importAll` with ID remapping & case-insensitive tag reuse (`lib/db.ts:710-776`), toolbar buttons & status banner (`app/page.tsx:838-861, 875-889`). |
| 10 | **Calendar View** | **10** | 10 | `holidays` table (`lib/db.ts:304-311`) & `scripts/seed-holidays.ts`, `GET /api/holidays` (`app/api/holidays/route.ts`), `generateCalendarGrid` (`lib/calendar.ts:11-36`), `/calendar` page with `?month=YYYY-MM` (`app/calendar/page.tsx`), `CalendarGrid` (`components/CalendarGrid.tsx`), `DayTodosModal` (`components/DayTodosModal.tsx`). Minor note: `components/CalendarGrid.tsx:150-166` renders up to 3 pills + `+X more` rather than a dedicated total-count badge (`EVALUATION.md:342`). |
| 11 | **Authentication (WebAuthn)** | **10** | 10 | `users` & `authenticators` tables (`lib/db.ts:211-226`), all 6 `/api/auth/*` routes, `lib/auth.ts` 7-day HTTP-only JWT (`lib/auth.ts:9, 36-46`), `middleware.ts` protecting `/` and `/calendar` (`middleware.ts:4-17`), `/login` page (`app/login/page.tsx`). |

**Feature Completeness Total:** **105 / 110**

---

## Category Totals

### 1. Feature Completeness: **105 / 110**
- **Deduction (-5):** Feature 07 missing Template Manager category filter and edit UI (`app/page.tsx:1619-1696`, vs. `EVALUATION.md:236, 246`).

### 2. Testing Coverage: **12 / 30**
- **E2E Tests (7 / 15):**
  - Present: `playwright.config.ts` (`Asia/Singapore` at `playwright.config.ts:11`), `tests/helpers.ts` (virtual authenticator + `createTodo`/`addSubtask`/`createTag`), and `tests/e2e.spec.ts` (2 tests covering auth redirects and a combined user journey).
  - **Deductions:** Only 1 combined spec file exists instead of all 11 feature test files (`EVALUATION.md:412`), and runtime pass evidence / 3 consecutive runs (`EVALUATION.md:417`) are **Unverified (requires runtime evidence)** (-8 pts).
- **Unit Tests (5 / 10):**
  - Present: `tests/unit.test.ts` (6 tests covering `validatePriority`, `sortTodos`, `calculateNextDueDate`, `calculateProgress`, `applyFilters`, `generateCalendarGrid`).
  - **Deductions:** Missing unit tests for `lib/db.ts` CRUD (`EVALUATION.md:404`), `lib/auth.ts` JWT creation/verification (`EVALUATION.md:390`), and `todoDB.importAll` ID remapping (`EVALUATION.md:316, 407`), plus runtime execution is **Unverified (requires runtime evidence)** (-5 pts).
- **Manual Testing (0 / 5):**
  - **Deduction (-5):** Requires live browser interaction (WebAuthn prompts, Browser Notifications API) — **Unverified (requires runtime evidence)**.

### 3. Deployment: **4 / 30**
- **Successful Deployment (0 / 15):** No deployed production URL or Railway/Vercel deployment configuration (`railway.json`, `Procfile`, `vercel.json`) in the repository — **Unverified / Not Started (-15 pts)**.
- **Environment Configuration (2 / 5):**
  - **Deduction (-2):** `.env.example` is missing (`EVALUATION.md:476`).
  - **Deduction (-1):** `lib/db.ts:201` uses `process.env.DATABASE_PATH || path.join(process.cwd(), 'todos.db')` without checking `RAILWAY_VOLUME_MOUNT_PATH` (`EVALUATION.md:718`), and `package.json:8` uses `"start": "next start"` instead of `"next start -p ${PORT:-3000}"` (`EVALUATION.md:666`).
- **Production Testing (0 / 5):** **Unverified / Not Applicable** without a live deployment (-5 pts).
- **Documentation (2 / 5):**
  - Present: `CLAUDE.md`, `README.md`, `USER_GUIDE.md`, `RAILWAY_DEPLOYMENT.md`, `RAILWAY_SIMPLE_SETUP.md`.
  - **Deduction (-3):** `README.md` / deployment docs are reference templates rather than updated with this implementation's specific env vars, changelog, or live URL (`EVALUATION.md:777-781`).

### 4. Quality & Performance: **21 / 30**
- **Code Quality (8 / 10):**
  - Present: TypeScript `"strict": true` (`tsconfig.json:7`), `eslint.config.mjs` configured, prepared statements and try/catch error handling in API routes.
  - **Deductions:** Missing `app/not-found.tsx` (`EVALUATION.md:495`) and `app/error.tsx` error boundary (`EVALUATION.md:494`), and runtime `npm run lint` / `npm run build` execution is **Unverified (requires runtime evidence)** (-2 pts).
- **Performance (6 / 10):**
  - Present: SQLite indexes on `user_id`, `due_date`, `todo_id`, `tag_id`, `date` (`lib/db.ts:256-311`), batched `findAllByUser` avoiding N+1 queries (`lib/db.ts:555-604`), and 300ms debounced client filtering (`lib/hooks/useDebounce.ts:3`).
  - **Deductions:** No lazy loading/virtualization for >100 todos (`EVALUATION.md:453`), and runtime benchmarks (FCP < 1s, API < 300ms, 1000-todo filter < 100ms) are **Unverified (requires runtime evidence)** (-4 pts).
- **Accessibility (2 / 5):**
  - Present: `aria-label` attributes, `role="alert"` / `role="status"`, dark-mode Tailwind classes, Escape-key modal close (`app/page.tsx:208-215`).
  - **Deductions:** Lighthouse accessibility score > 90 and WCAG AA contrast verification are **Unverified (requires runtime evidence)** (-3 pts).
- **Security (5 / 5):**
  - Verified statically: HTTP-only, `SameSite=Lax`, `Secure` in production JWT cookies (`lib/auth.ts:36-45`); `getSession()` check + `session.userId` scoping on protected API routes; parameterized SQLite prepared statements (`lib/db.ts`); React JSX escaping.

---

## Final Score & Rating

| Category | Score | Max |
|---|---|---|
| Feature Completeness | 105 | 110 |
| Testing Coverage | 12 | 30 |
| Deployment | 4 | 30 |
| Quality & Performance | 21 | 30 |
| **Total Score** | **142** | **200** |

**Rating:** **✅ Good (140–159)** — *Mostly complete, minor issues* (with 25+ points currently withheld due to no live deployment and unverified runtime-only checks).

---

## Highest-Priority Improvements

1. **Prepare & Deploy to Railway (`+20–25 pts` potential)**
   - Add `.env.example` documenting `JWT_SECRET`, `RP_NAME`, `RP_ID`, `RP_ORIGIN` (`EVALUATION.md:476`).
   - Update `lib/db.ts:201` to support `process.env.RAILWAY_VOLUME_MOUNT_PATH` (`EVALUATION.md:718`) and `package.json:8` to `"start": "next start -p ${PORT:-3000}"` (`EVALUATION.md:666`).
   - Deploy to Railway with a persistent volume and verify WebAuthn & SQLite persistence on HTTPS.
2. **Expand Automated & Manual Test Coverage (`+10–15 pts` potential)**
   - Split `tests/e2e.spec.ts` into the 11 per-feature Playwright spec files (`EVALUATION.md:412`) and record 3 consecutive passing runs (`EVALUATION.md:417`).
   - Add unit tests in `tests/unit.test.ts` for `lib/db.ts` CRUD, `lib/auth.ts` JWT sign/verify, and `todoDB.importAll` ID remapping (`EVALUATION.md:316, 390, 404`).
3. **Complete Template Manager UI (`+5 pts`)**
   - Add a category filter dropdown and inline Edit flow (calling existing `PUT /api/templates/[id]`) to `TemplateManager` in `app/page.tsx:1619-1696`.
4. **Add Error Boundaries & 404 Page (`+1–2 pts`)**
   - Add `app/not-found.tsx` and `app/error.tsx` (`EVALUATION.md:494-495`).

