# iVote — Upgrade & Repair Notes

This document records fixes made to your iVote system before the Flutter
scanning app was removed. The remaining architecture includes Laravel +
Repository pattern, a React admin dashboard, and a Python/OpenCV
recognition service. It lists what changed and why, compared with the
original code.

The zip has two top-level things:
- `ivote-backend/` — your actual runnable Laravel app (this is the one
  that had the breaking bugs)
- `ivote_capstone_system/`-equivalent folders (`web/`,
  `recognition_service/`, `database/`, `testing/`) — the other parts
  of the system

## Backend — bugs that would have stopped it from running at all

1. **`routes/api.php` was corrupted.** It contained a pasted-in copy of
   a `BallotController` class instead of route definitions — every API
   request would have 404'd. Rewritten with all routes, correctly
   grouped into public / authenticated / admin-only.
2. **Laravel Sanctum was used but never installed** (`createToken()`,
   `auth:sanctum`) — login would fatal error. Since this sandbox can't
   `composer install` new packages, and honestly your app doesn't need
   multi-device sessions, I replaced it with a small self-contained
   bearer-token scheme (`User::issueApiToken()` / `AuthenticateApiToken`
   middleware) — no new dependency required. Swapping in real Sanctum
   later is a small, contained change if you ever need it.
3. **Almost no migrations existed** — only the default
   `users`/`cache`/`jobs` tables. `elections`, `positions`, `candidates`,
   `ballots`, `ballot_scans`, `votes`, `audit_logs`, `settings` were all
   missing, even though your models, controllers, and `database/ivote_schema.sql`
   all assumed they existed. Added all of them as proper migrations.
4. **`AuditLog` model didn't exist**, even though `ScanController`
   already referenced `App\Models\AuditLog`. Added it.
5. **`RepositoryServiceProvider` was never registered** in
   `bootstrap/providers.php` — every controller's dependency injection
   would have failed. Registered it, and added the missing
   `Ballot`/`User` repository bindings.
6. **The `admin` middleware alias was never registered** in
   `bootstrap/app.php` — registered it, plus the new `auth.token` alias.
7. **The seeder created users with `role`/`is_active`** columns that
   didn't exist yet — fixed once the users migration was corrected, and
   extended to seed a ready-to-scan demo election.

## Backend — missing features, now implemented

- `UserController` + `/api/users` (Admin CRUD) — the Users page had
  nothing to talk to.
- `BallotController` + `/api/ballots*` — generate, list, show (for
  printing), delete, bulk-delete.
- `AuditLogController` + `/api/audit-logs`.
- `ElectionController::results()` + `/api/elections/{id}/results` —
  powers the Dashboard chart and Reports page.
- `ScanController::recent()` + `/api/scans/recent` — Scanner Monitoring
  page.
- `ReportController` + `/api/reports/{type}` — **note:** this streams
  CSV, not PDF. No PDF library (e.g. `barryvdh/laravel-dompdf`) was
  ever added to `composer.json`, and this sandbox can't install new
  Composer packages. CSV opens directly in Excel/Sheets and needs zero
  new dependencies. If you want an actual PDF, run
  `composer require barryvdh/laravel-dompdf` and swap the response body
  in `ReportController` for a rendered Blade view — the rest of the
  wiring (route, frontend button) is already in place.

## Web dashboard (React)

- **`BallotsPage.jsx` was truncated** — it literally ended with the
  comment `// ...the rest of your code remains exactly the same` after
  18 lines. Rebuilt in full: generate, list, select, print, delete.
- `apiClient.js` had a hardcoded `127.0.0.1:8000` base URL — now reads
  `VITE_API_BASE_URL` (see `web/.env.example`), so a real deployment
  isn't silently pointed at localhost.
- `ReportsPage.jsx` now downloads `.csv` to match what the backend
  actually sends (was requesting `.pdf`, which didn't exist).
- Cleaned up a stray `console.log('LOGIN RESPONSE', ...)` debug
  statement left in `AuthContext.jsx`.

## Recognition service (Python)

- **QR decoding was completely disabled.** `decode_qr_codes` was
  stubbed to always `return []`, silently forcing every scan through
  the slower, less reliable OCR fallback. Restored the real
  `pyzbar.pyzbar.decode` import.
- **`vote_for_count` was computed incorrectly** —
  `len(candidates[0].get("vote_for_count", [1]))` always evaluated to
  `1` regardless of the actual data (it was reading a list-shaped
  default off the wrong object). `BallotTemplate` now carries a real
  per-position `vote_for_counts` map.
- **The ballot template was hardcoded** to one fixed 2-position demo
  layout for every election. `main.py` now fetches the real election's
  positions/candidates from the backend's public `/elections/active`
  endpoint and generates a matching template, with an in-memory cache
  and a safe fallback if the backend is unreachable.

## Tests

- Fixed `BallotDuplicateScanTest` to use the new bearer-token auth
  instead of `actingAs($user, 'sanctum')` (which never worked, since
  Sanctum wasn't installed).
- Added factories for `Election`, `Position`, `Candidate`, `Ballot`
  (only `User` existed before).
- Added `AdminManagementTest` covering ballot generation, user
  creation, and the BR-07 admin-only restriction.

## Running it

```bash
cd ivote-backend
cp .env.example .env   # if you don't already have one
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve

# in another terminal
cd ../web
npm install
cp .env.example .env   # set VITE_API_BASE_URL if not localhost
npm run dev

# recognition service
cd ../recognition_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

Seeded demo accounts: `admin@ivote.com` / `officer@ivote.com`, both
with password `password123`.

## What I did not change

Your data model, your repository-pattern architecture, your routes'
naming, your React component structure, and your OpenCV pipeline design
are all exactly as you built them — this
pass was about making what you designed actually run, plus the couple
of correctness bugs (QR decode, vote-for-count) called out above.
