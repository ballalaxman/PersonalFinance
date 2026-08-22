# FINTRACK Application Guide

This guide explains what FINTRACK does, how to use each feature, how the frontend and backend connect, and how to configure the Cloudflare services used by the application.

## 1. What FINTRACK Does

FINTRACK is a private monthly cash-flow application. It records money entering, leaving, and being allocated into investments.

Transactions have three types:

- **Income** — salary, interest, dividends, refunds, or other incoming money.
- **Expense** — rent, groceries, utilities, fees, entertainment, and other consumed money.
- **Savings / Investment** — SIPs, mutual funds, EPF, PPF, stock purchases, fixed deposits, bonds, and other asset allocations.

The primary calculations are:

```text
Cash surplus        = Income - Expenses
Invested savings    = Total Savings/Investment transactions
Unallocated savings = Cash surplus - Invested savings
Savings rate        = Cash surplus / Income × 100
Investment rate     = Invested savings / Income × 100
```

Investment transactions are not counted as ordinary expenses and do not consume expense budgets. FINTRACK currently tracks invested cash contributions, not market value, units, holdings, realized gains, or Net Worth.

## 2. Application Pages

### Dashboard

Use the Dashboard to review the selected period.

It displays:

- income;
- expenses;
- cash surplus;
- invested savings;
- unallocated savings;
- savings and investment rates;
- cash-flow history;
- spending by category;
- recent activity;
- upcoming recurring schedules.

Select a month and year to scope every dashboard total, chart, insight, and recent transaction to that calendar month.

### Transactions

Use Transactions to review financial entries.

Available actions:

- search by merchant, category, or tag;
- select a month/year and filter within it by account, category, and transaction type;
- edit the complete transaction without creating a duplicate;
- edit a category inline;
- add or remove tags;
- delete a transaction;
- load older transactions in cursor-paginated pages.

Amounts are always stored as positive magnitudes. The transaction type determines how the amount affects cash-flow calculations.

### Recurring

Use Recurring for scheduled income, expenses, and investments.

A schedule contains:

- transaction type;
- name;
- expected amount;
- category and account;
- cadence;
- start date and next due date;
- monthly day when applicable;
- optional end date;
- reminder timing;
- active or paused state.

When a schedule becomes due, the shared Cloudflare scheduled handler creates one pending occurrence. It does not immediately create a transaction.

The user must reconcile it:

- **Confirm** — create the corresponding transaction.
- **Skip** — skip this occurrence without disabling the schedule.
- **Postpone** — move the reminder/reconciliation date.

The database constraint `UNIQUE(scheduleId, dueDate)` prevents the scheduled handler from producing the same occurrence twice.

### Budgets

Use Budgets to define monthly spending limits by expense category. Only transactions with type `expense` consume budgets. Income and Savings/Investment entries are excluded.

### Goals

Use Goals to create savings targets, record the current saved amount, and optionally set a due date and notes.

### Documents

Use Documents to upload receipts, invoices, statements, PDFs, or images.

- The original file bytes are stored privately in Cloudflare R2.
- D1 stores only metadata and the private R2 object key.
- The application enforces a 20 MB limit per file.

### Rules

Use Rules to automate category selection based on merchant text. Rules can be created, edited, enabled, disabled, and deleted.

### Settings

Use Settings to manage:

- transaction categories;
- accounts;
- ignored recurring suggestions;
- recurring schedule timezone;
- browser reminder permission;
- complete data deletion.

The timezone must be a valid IANA value such as:

```text
Asia/Kolkata
Europe/London
America/New_York
```

## 3. Common User Workflows

### Add income

1. Select **Add entry**.
2. Choose **Income**.
3. Enter the amount, source, date, category, account, and optional tags.
4. Save the transaction.

### Add an expense

1. Select **Add entry**.
2. Choose **Expense**.
3. Enter the merchant, amount, date, category, and account.
4. Optionally attach a receipt.
5. Save the transaction.

### Add an SIP, EPF, PPF, or stock investment

1. Select **Add entry**.
2. Choose **Savings / Investment**.
3. Enter the contributed amount.
4. Use an investment category such as `Mutual Fund SIP`, `EPF`, `PPF`, `Stocks`, or `Fixed Deposit`.
5. Select the bank/source account and save.

Record dividends or interest received as **Income**. Record brokerage, penalties, taxes, or service fees as **Expense**. Do not record a transfer between two owned cash accounts twice.

### Add a monthly SIP schedule

1. Open **Recurring**.
2. Select **Add recurring**.
3. Choose **Savings / Investment**.
4. Enter the SIP name, amount, category, and source account.
5. Select `monthly` cadence and the required day of month.
6. Select the next due date and reminder timing.
7. Save the schedule.
8. When the pending occurrence appears, confirm, skip, or postpone it.

For months that do not contain the requested day, the recurrence calculator uses the final calendar day while preserving the preferred day for later months.

## 4. How the Components Connect

```text
Browser / PWA
      |
      | HTTPS / JSON API with Bearer JWT
      v
Cloudflare Worker (Hono)
      |
      +------------------+
      |                  |
      v                  v
Cloudflare D1       Cloudflare R2
structured data     original files
      ^
      |
Cron Trigger
recurring due processing

```

### Frontend to Worker

The React frontend calls relative `/api/...` endpoints. During local development, Vite proxies those requests to `http://localhost:8787`. In production, the Worker serves the API and built frontend assets from the same deployment.

### Authentication

Registration and login are public. Successful authentication returns a signed JWT. The frontend sends it as:

```text
Authorization: Bearer <token>
```

Private routes verify the token and derive `userId` from it. The request body must never be trusted to identify the owner of a resource.

### D1

D1 stores:

- users;
- transactions;
- tags and rules;
- settings;
- document metadata;
- recurring schedules and occurrences;
- browser push subscriptions.

All user-owned reads and writes are scoped by authenticated `userId`.

### R2

R2 stores original uploaded bytes. Object keys are namespaced by user, for example:

```text
uploads/<userId>/<uuid>-<safe-filename>
```

R2 objects are private and are not exposed through public bucket URLs.

## 5. Local Development Setup

### Requirements

- Node.js 20 or later
- npm
- Cloudflare Wrangler through the project dependencies

Install dependencies:

```powershell
cd "C:\Users\Dell\Desktop\Moksa\PersonalFinance"
npm install
```

### Environment files

The frontend `.env` is intentionally empty because the frontend currently requires no `VITE_*` variables.

Put Worker development values in `.dev.vars`:

```text
JWT_SECRET=<long-random-secret>
VAPID_PUBLIC_KEY=<generated-public-key>
VAPID_PRIVATE_KEY=<generated-private-key>
APP_ORIGIN=http://localhost:5173
```

Never commit `.dev.vars`.

Generate a JWT secret in PowerShell:

```powershell
$bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

Generate VAPID keys:

```powershell
npx web-push generate-vapid-keys
```

### Initialize D1

For a new local database:

```powershell
npm run db:migrate
```

For a local database created with the old transaction schema:

```powershell
npm run db:migrate:post-testing
```

Do not apply both initialization paths to the same fresh local database.

### Start the application

Terminal 1 — Worker API:

```powershell
npm run worker:dev
```

Terminal 2 — React frontend:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

Check Worker health:

```powershell
Invoke-RestMethod http://localhost:8787/api/health
```

### Test the scheduled handler locally

Start Wrangler with scheduled-event testing:

```powershell
npx wrangler dev --test-scheduled
```

Invoke the shared schedule:

```powershell
Invoke-RestMethod "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
```

Refresh Recurring and inspect **Needs confirmation**.

## 6. Connect Cloudflare D1

Authenticate Wrangler:

```powershell
npx wrangler login
```

Create D1 only if the intended database does not already exist:

```powershell
npx wrangler d1 create fintrack-db
```

Put the returned database ID in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fintrack-db"
database_id = "<your-database-id>"
```

For a new remote database, apply the complete schema:

```powershell
npx wrangler d1 execute fintrack-db --remote --file=worker/db/schema.sql
```

For an existing remote database using the old schema, back it up first and run:

```powershell
npm run db:migrate:post-testing:remote
```

Do not run the post-testing migration twice. Verify the migration in a non-production database before applying it to real financial data.

## 7. Connect Cloudflare R2

Create the bucket only if it does not already exist:

```powershell
npx wrangler r2 bucket create fintrack-files
```

Configure the binding:

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "fintrack-files"
```

The bucket must remain private. The Worker reads and writes it through the `BUCKET` binding.

## 8. Configure Production Variables and Secrets

Generate separate production values; do not reuse local secrets.

Store secrets using Wrangler:

```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put VAPID_PRIVATE_KEY
```

Configure public/non-secret variables for the production environment:

```toml
[vars]
APP_ORIGIN = "https://your-fintrack-domain.example"
VAPID_PUBLIC_KEY = "<generated-public-key>"
```

`APP_ORIGIN` must contain only the origin: scheme, hostname, and optional port. Do not include a trailing route or Markdown link syntax.

## 9. Configure Browser Notifications

The browser side requires:

- HTTPS in production, or `localhost` during development;
- a registered PWA service worker;
- a VAPID public key;
- permission granted through the Settings action;
- a stored device subscription.

In Settings, select **Enable reminders**. The application requests permission only after that user action. Notification text is privacy-safe and does not include amounts or account names.

Current limitation: browser subscription storage and notification display/deep-link handling are implemented, but server-side encrypted Web Push dispatch is not yet complete. Enabling the setting registers the device, but real remote delivery must not be considered production-ready until VAPID signing/encryption, bounded delivery, expired-endpoint cleanup, and delivery tests are completed.

## 10. Data sync policy

Google Drive sync and CSV transaction import are disabled. Add transactions manually and upload supported documents directly to private R2 storage through the Documents page.

## 11. Build, Test, and Deploy

Run checks:

```powershell
npm run build
npm run lint
npm run test
```

Install Playwright browsers once, then run E2E tests:

```powershell
npx playwright install chromium
npm run test:e2e
```

Deploy:

```powershell
npm run build
npm run deploy
```

After deployment, verify:

- registration, login, logout, and token expiry;
- user isolation;
- income, expense, and investment entry;
- Dashboard formulas;
- pagination;
- manual transactions and document uploads;
- R2 uploads and deletion;
- recurring schedule generation and reconciliation;
- Cron execution and timezone behavior;
- mobile layout;
- production CORS;
- D1 backup and restore procedures.

## 12. Data Deletion and Backups

The Settings danger zone deletes the current user's structured records and R2 objects after exact confirmation. It does not affect files stored outside FINTRACK.

Before production use:

- configure daily D1 backups;
- back up immediately before schema migrations;
- keep encrypted backups outside the repository;
- test restoration into a non-production database;
- monitor D1 rows read/written, storage, Worker errors, Cron failures, and R2 usage.

## 13. Current Implementation Status

Implemented or substantially implemented:

- authenticated user accounts and user-scoped data;
- income, expense, and investment transaction types;
- monthly savings calculations;
- D1 and R2 bindings;
- manual transaction and document paths;
- transaction pagination;
- full in-place transaction editing with duplicate protection;
- shared month/year filtering and D1-backed dashboard aggregates;
- multiple transaction tags across listing and editing;
- normalized recurring schedules and occurrences;
- idempotent occurrence generation;
- confirmation, skipping, and postponement;
- shared Cron configuration;
- push subscription registration and notification-click handling;
- legacy subscription redirect and migration path.

Still requiring completion or verification before production:

- server-side encrypted Web Push delivery;
- complete removal of deprecated Net Worth implementation code after the rollback window;
- automated D1 backups and restore drill;
- full unit, API, migration, authorization, E2E, responsive, and production smoke testing.

For implementation phases and acceptance criteria, see [POST_TESTING_IMPLEMENTATION_PLAN.md](POST_TESTING_IMPLEMENTATION_PLAN.md).
