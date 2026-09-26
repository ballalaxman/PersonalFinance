# FINTRACK

FINTRACK is a private, responsive personal-finance and habit-tracking application for recording income, expenses, and savings/investments; reviewing monthly cash flow; and managing budgets, goals, documents, and recurring payments.

The application uses a React frontend with a Cloudflare Worker API. Structured data is stored in Cloudflare D1, while uploaded file bytes are stored privately in Cloudflare R2.

## Application features

The app has two dashboards, switched with the **Finance / Habits** tabs in the header. Each has its own navigation; Settings is shared.

### Habits

- Create daily habits or habits with a weekly target (for example 3 days per week).
- Check habits off from the Today view, or backfill any day of the current week.
- See current and best streaks (days for daily habits, weeks for weekly ones), 30-day completion, and a 12-week activity heatmap.
- Archive a habit to hide it while keeping its history, or delete it with its check-ins.

### Dashboard

- View income, expenses, cash surplus, invested savings, and savings-rate summaries.
- Select a specific month and year for every total and chart.
- Review cash-flow and spending-by-category charts.
- View recent transactions and upcoming recurring payments.
- Display useful empty states when no financial data exists.

### Transactions

- Add income, expense, and Savings/Investment transactions manually.
- Search and filter transactions within the selected month by account, category, type, merchant, or tag.
- Edit complete transactions in place, manage multiple tags, and delete transactions.
- Prevent duplicate records using a transaction fingerprint.
- Attach a receipt when adding an entry; it is stored in the document vault.

### Recurring payments

- Schedule recurring income, expenses, and investments with due-date selection.
- Confirm (at the actual amount), skip, or postpone due occurrences before they become transactions.
- Delete a schedule, or pause it from the edit form.

### Budgets and goals

- Create monthly category budgets and compare them with spending.
- Create savings goals and track saved amounts.

### Reminders

- Push notifications for recurring bills (due, awaiting confirmation, or coming up) and an evening habit nudge.
- Choose reminder times or turn either off in Settings; send a test notification to check a device.

### Rules, tags, and settings

- Create and manage categorization rules.
- Create reusable transaction tags.
- Manage categories, accounts, and detection preferences.
- Erase the current user's data through a protected confirmation flow.

### Documents

- Upload receipts, invoices, statements, images, PDFs, and other supported files.
- Store original file bytes privately in Cloudflare R2.
- Store document metadata in Cloudflare D1.
- Open stored documents from the vault (served only to their owner).

### Authentication and privacy

- Register and sign in with an authenticated account.
- Isolate records through user-scoped database queries.
- Protect private API routes with bearer-token authentication.
- Namespace uploaded files by user.
- Avoid exposing financial contents or secrets in responses and logs.

## Technology

- React 18, TypeScript, Vite, and Tailwind CSS
- Zustand
- Hono on Cloudflare Workers
- Cloudflare D1 for structured data
- Cloudflare R2 for original files
- Zod for validation
- Vitest for testing
- Wrangler for Worker development and deployment

## Project structure

```text
src/                    React application
  components/           Layout, UI, and modal components
  pages/                Application pages
  schemas/              Frontend validation schemas
  services/             API clients
  store/                Authentication and application state
  utils/                Shared frontend helpers

worker/                 Cloudflare Worker API
  db/schema.sql          D1 schema
  middleware/            API authentication
  routes/                API endpoints
  utils/                 Worker helpers

wrangler.toml           Cloudflare bindings and deployment configuration
```

## Local setup

Requirements:

- Node.js 20 or later
- npm
- A Cloudflare account for D1, R2, and deployment

Install dependencies:

```bash
npm install
```

Create a local environment file containing a strong development `JWT_SECRET`. Do not commit secrets.

Initialize the local D1 database:

```bash
npm run db:migrate
```

Run the frontend and Worker in separate terminals:

```bash
npm run dev
npm run worker:dev
```

## Commands

```bash
npm run dev          # Start Vite
npm run worker:dev   # Start the Worker locally
npm run build        # Type-check and build
npm run lint         # Run ESLint
npm run format       # Format the repository
npm run test         # Run unit tests
npm run db:migrate   # Apply the local D1 schema
npm run db:migrate:post-testing # Upgrade an existing local D1 database
npm run db:migrate:post-testing:remote # Upgrade the configured remote D1 database
npm run db:migrate:month-filtering # Add the local month-pagination index
npm run db:migrate:month-filtering:remote # Add the production month-pagination index
npm run db:migrate:habits # Add the habit tables locally
npm run db:migrate:habits:remote # Add the habit tables in production
npm run db:migrate:reminders:remote # Add the reminder log table in production
npm run icons        # Regenerate favicon and PWA icons from scripts/generate-icons.mjs
npm run deploy       # Deploy with Wrangler
```

## Cloudflare deployment

The Worker expects these bindings:

```text
DB       Cloudflare D1 database
BUCKET   Private Cloudflare R2 bucket
```

Configure the production secret, build, and deploy:

```bash
npx wrangler secret put JWT_SECRET
npm run vapid:generate                   # once; prints a key pair
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put ALLOWED_EMAILS   # comma-separated emails allowed to register
npm run build
npm run deploy
```

Set the exact production `APP_ORIGIN` before enabling reminders; `VAPID_SUBJECT` (a `mailto:` contact) is optional. See APPLICATION_GUIDE.md §9 for how reminders work. Apply `worker/db/migrations/0002_post_testing_foundation.sql` to an existing D1 database before deploying code that reads the new recurring tables.

Before deploying, confirm that the D1 database ID and R2 bucket name in `wrangler.toml` belong to the intended environment.

## Data-storage rules

- D1 is the source of truth for structured application data and file metadata.
- Original document and receipt bytes belong in R2, never in D1.
- Browser storage is not the durable source of truth for financial data.
- Every user-owned query must be scoped by the authenticated user's ID.
- Do not seed sample financial records.

For feature usage, service connections, local setup, and deployment instructions, see [APPLICATION_GUIDE.md](APPLICATION_GUIDE.md).
