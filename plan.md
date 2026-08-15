# FINTRACK --- Complete Technical Architecture & Deployment Plan

**Document purpose:** Master implementation and deployment reference for
FINTRACK.

**Target scale:** 5--6 users\
**Primary goal:** Mobile-friendly web application with a zero/near-zero
infrastructure-cost deployment model, while retaining durable
server-side storage, document storage, CSV imports, Google Drive
imports, duplicate detection, recurring/subscription detection, and
responsive UX.

------------------------------------------------------------------------

# 1. Executive Architecture

## Recommended production architecture

``` text
                         ┌──────────────────────┐
                         │       Users 1–6      │
                         │ Web / Mobile Browser │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                    ┌────────────────────────────┐
                    │        Cloudflare           │
                    │                            │
                    │ React + Vite static app   │
                    │ CDN / HTTPS / Edge         │
                    └─────────────┬──────────────┘
                                  │
                             API requests
                                  ▼
                    ┌────────────────────────────┐
                    │    Cloudflare Worker       │
                    │                            │
                    │ Hono REST API             │
                    │ Validation                │
                    │ Business logic             │
                    │ Authorization             │
                    │ Import processing         │
                    └───────┬───────────┬────────┘
                            │           │
                         SQL│           │Objects
                            ▼           ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ Cloudflare   │  │ Cloudflare   │
                  │ D1           │  │ R2           │
                  │ SQLite       │  │ Documents    │
                  └──────────────┘  └──────────────┘

                            ▲
                            │
                      Daily sync
                            │
                  ┌─────────┴─────────┐
                  │ Google Drive      │
                  │ FINTRACK Inbox    │
                  └───────────────────┘
```

## Core architectural decision

Do NOT use EC2, Kubernetes, Docker servers, Nginx, PM2, Redis, Kafka,
RabbitMQ, MongoDB, or PostgreSQL for the initial version.

Use:

``` text
React + TypeScript + Vite
          ↓
Cloudflare
          ↓
Hono Worker
          ↓
   ┌──────┴──────┐
   ↓             ↓
  D1            R2
```

This is intentionally serverless and is appropriate for the very small
expected user base.

------------------------------------------------------------------------

# 2. Product Scope

FINTRACK is a private personal-finance dashboard.

Required areas:

1.  Dashboard
2.  Transactions
3.  Recurring
4.  Subscriptions
5.  Budgets
6.  Goals
7.  Documents
8.  Rules
9.  Settings

Global actions:

-   Drive sync
-   Import
-   Add entry

The application must:

-   Start with no sample financial data.
-   Persist durable state on the server.
-   Work from multiple signed-in devices.
-   Support desktop, tablet, and mobile.
-   Support manual transaction entry.
-   Support CSV imports.
-   Support document uploads.
-   Support Google Drive inbox imports.
-   Prevent duplicate transactions.
-   Detect recurring/subscription patterns.
-   Provide budgets and goals.
-   Provide net-worth configuration.
-   Provide a complete data-wipe workflow.
-   Preserve Google Drive files when FINTRACK data is erased.

------------------------------------------------------------------------

# 3. Technology Stack

## Frontend

  Technology        Purpose
  ----------------- ---------------------
  React             UI
  TypeScript        Type safety
  Vite              Development/build
  Tailwind CSS      Styling
  shadcn/ui         Reusable UI
  Lucide React      Icons
  React Router      Routing
  TanStack Query    Server state/cache
  React Hook Form   Form handling
  Zod               Validation
  Recharts          Charts
  date-fns          Date handling
  PapaParse         CSV parsing
  Sonner            Toast notifications
  vite-plugin-pwa   PWA/mobile install

## Backend

  Technology                   Purpose
  ---------------------------- -----------------------------------
  Cloudflare Workers           Serverless backend
  Hono                         REST API framework
  Zod                          Request validation
  Web Crypto / native crypto   Fingerprints and secure utilities

## Database

**Cloudflare D1**

SQLite-based relational database.

## File storage

**Cloudflare R2**

Used only for original uploaded/imported files.

## Authentication

Preferred:

**Cloudflare Access**

Restrict application access to explicitly allowed users.

## Deployment

-   GitHub
-   Cloudflare
-   Wrangler
-   Cloudflare build/deploy pipeline

------------------------------------------------------------------------

# 4. Dependency Installation

## Production dependencies

``` bash
npm install \
react \
react-dom \
react-router-dom \
@tanstack/react-query \
react-hook-form \
zod \
@hookform/resolvers \
lucide-react \
recharts \
date-fns \
papaparse \
sonner \
clsx \
tailwind-merge \
class-variance-authority
```

## Radix UI dependencies

``` bash
npm install \
@radix-ui/react-dialog \
@radix-ui/react-dropdown-menu \
@radix-ui/react-select \
@radix-ui/react-tabs \
@radix-ui/react-tooltip
```

## Backend

``` bash
npm install hono
```

## Development dependencies

``` bash
npm install -D \
typescript \
vite \
@vitejs/plugin-react \
tailwindcss \
vite-plugin-pwa \
wrangler \
eslint \
prettier \
vitest \
@testing-library/react \
@testing-library/jest-dom \
playwright
```

------------------------------------------------------------------------

# 5. Project Structure

``` text
FINTRACK/
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── charts/
│   │   ├── forms/
│   │   ├── modals/
│   │   └── layout/
│   │
│   ├── pages/
│   │   ├── Dashboard/
│   │   ├── Transactions/
│   │   ├── Recurring/
│   │   ├── Subscriptions/
│   │   ├── Budgets/
│   │   ├── Goals/
│   │   ├── Documents/
│   │   ├── Rules/
│   │   └── Settings/
│   │
│   ├── hooks/
│   ├── services/
│   │   ├── api.ts
│   │   ├── transactions.ts
│   │   ├── documents.ts
│   │   └── preferences.ts
│   │
│   ├── schemas/
│   │   ├── transaction.ts
│   │   ├── budget.ts
│   │   ├── goal.ts
│   │   └── document.ts
│   │
│   ├── utils/
│   │   ├── dates.ts
│   │   ├── currency.ts
│   │   └── fingerprint.ts
│   │
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
│
├── worker/
│   ├── routes/
│   │   ├── state.ts
│   │   ├── transactions.ts
│   │   ├── documents.ts
│   │   ├── preferences.ts
│   │   └── drive-sync.ts
│   │
│   ├── services/
│   │   ├── transaction.service.ts
│   │   ├── recurring.service.ts
│   │   ├── import.service.ts
│   │   └── document.service.ts
│   │
│   ├── db/
│   │   ├── schema.sql
│   │   └── migrations/
│   │
│   ├── utils/
│   └── index.ts
│
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
└── README.md
```

------------------------------------------------------------------------

# 6. Implementation Phases

## Phase 0 --- Requirements Freeze

Before writing code:

-   Confirm the FINTRACK scope.
-   Confirm private access.
-   Confirm target users: 5--6.
-   Confirm mobile + desktop requirement.
-   Confirm no sample financial data.
-   Confirm Google Drive import requirement.
-   Confirm daily 8:00 AM sync requirement.
-   Confirm free/near-zero cost objective.

### Exit criteria

-   Scope is frozen.
-   No unnecessary infrastructure is introduced.

------------------------------------------------------------------------

# 7. Phase 1 --- Repository and Development Environment

## Tasks

1.  Create Git repository.
2.  Initialize React + TypeScript + Vite.
3.  Install dependencies.
4.  Configure ESLint.
5.  Configure Prettier.
6.  Configure Tailwind.
7.  Configure Vitest.
8.  Configure Playwright.
9.  Configure environment files.
10. Add README.
11. Add `.gitignore`.
12. Add basic CI workflow.

## Required scripts

``` json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "format": "prettier --write .",
  "deploy": "wrangler deploy"
}
```

### Exit criteria

-   App starts locally.
-   TypeScript compiles.
-   Lint passes.
-   Test runner works.
-   Build succeeds.

------------------------------------------------------------------------

# 8. Phase 2 --- Application Shell

Build:

-   Desktop sidebar.
-   Mobile top bar.
-   Mobile bottom navigation.
-   Top actions.
-   Responsive page container.
-   Global loading state.
-   Global error state.
-   Toast system.
-   Modal infrastructure.
-   Accessible dialogs.
-   Focus trapping.
-   Escape-to-close.
-   Keyboard accessibility.

Navigation order:

``` text
Dashboard
Transactions
Recurring
Subscriptions
Budgets
Goals
Documents
Rules
Settings
```

### Responsive targets

-   390px
-   768px
-   1440px

### Exit criteria

All nine routes are reachable and responsive.

------------------------------------------------------------------------

# 9. Phase 3 --- Cloudflare Infrastructure

Create:

-   Cloudflare project.
-   D1 database.
-   R2 bucket.
-   Worker.
-   Required bindings.
-   Local development bindings.
-   Production configuration.

Logical bindings:

``` text
DB      → D1
BUCKET  → R2
```

Do not hard-code resource IDs in application logic.

### Exit criteria

Worker can:

1.  Connect to D1.
2.  Read/write D1.
3.  Write/read R2.
4.  Return a health response.

------------------------------------------------------------------------

# 10. Phase 4 --- D1 Database

## Tables

### transactions

``` sql
id TEXT PRIMARY KEY
date TEXT NOT NULL
merchant TEXT NOT NULL
category TEXT NOT NULL DEFAULT 'Needs review'
amount REAL NOT NULL
type TEXT NOT NULL
account TEXT NOT NULL DEFAULT 'Imported account'
tags TEXT NOT NULL DEFAULT '[]'
receipt INTEGER NOT NULL DEFAULT 0
source TEXT NOT NULL
fingerprint TEXT NOT NULL UNIQUE
createdAt TEXT NOT NULL
```

Allowed types:

``` text
expense
income
```

## tags

``` sql
name TEXT PRIMARY KEY
createdAt TEXT NOT NULL
```

## rules

``` sql
id TEXT PRIMARY KEY
whenText TEXT NOT NULL
thenText TEXT NOT NULL
enabled INTEGER NOT NULL DEFAULT 1
createdAt TEXT NOT NULL
```

## settings

``` sql
key TEXT PRIMARY KEY
value TEXT NOT NULL
updatedAt TEXT NOT NULL
```

## documents

``` sql
id TEXT PRIMARY KEY
filename TEXT NOT NULL
mimeType TEXT NOT NULL
size INTEGER NOT NULL
objectKey TEXT NOT NULL UNIQUE
status TEXT NOT NULL
source TEXT NOT NULL
createdAt TEXT NOT NULL
```

## Recommended indexes

``` sql
CREATE INDEX idx_transactions_date
ON transactions(date);

CREATE INDEX idx_transactions_merchant
ON transactions(merchant);

CREATE INDEX idx_transactions_category
ON transactions(category);

CREATE INDEX idx_transactions_account
ON transactions(account);
```

### Important

Migration files must be idempotent and must never drop production data.

------------------------------------------------------------------------

# 11. Phase 5 --- Settings and Empty State

Initial financial state:

``` text
transactions = []
documents = []
goals = []
budgets = []
subscriptions = []
recurring = []
rules = []
tags = []
dismissedPatterns = []
```

Initial dashboard:

``` text
selectedPeriod = all-time
assets = 0
liabilities = 0
netWorthConfigured = false
```

Net Worth must display:

``` text
Not set
```

until explicitly configured.

Totals derived from transactions:

``` text
$0.00
```

No fake:

-   trends
-   insights
-   recent activity
-   upcoming payments
-   percentages

Starter category definitions may exist as configuration:

``` text
Housing
Groceries
Shopping
Dining
Transportation
Utilities
Subscriptions
Insurance
Health
Entertainment
Income
Needs review
Other
```

Starter account definitions may exist as configuration:

``` text
Main Checking
Everyday Visa
Rewards Card
Cash
```

They must never create balances or transactions.

------------------------------------------------------------------------

# 12. Phase 6 --- API Layer

## GET /api/state

Return:

-   up to 5,000 transactions, newest first
-   tags
-   rules
-   decoded settings
-   up to 100 document metadata records

Never return raw file bytes.

## POST /api/transactions

Support:

-   one transaction
-   batch transactions

Validate:

-   merchant
-   source
-   date
-   amount
-   type
-   tags

Normalize tags.

Calculate fingerprint.

Prevent duplicates.

Apply categorization rules only after duplicate detection.

## PATCH /api/transactions/:id

Allow:

-   category
-   tags

## DELETE /api/transactions/:id

Delete exact ID.

## PUT /api/preferences

Persist:

-   categories
-   accounts
-   tags
-   rules
-   goals
-   budgets
-   subscriptions
-   recurring
-   dismissed patterns
-   assets
-   liabilities
-   selected period
-   other settings

Do not overwrite unrelated settings.

## POST /api/documents

Multipart upload.

Requirements:

-   max 20 MB per file
-   R2 storage
-   D1 metadata
-   status tracking

## DELETE /api/state

Require:

``` text
DELETE ALL FINTRACK DATA
```

Then:

1.  Delete D1 records.
2.  Delete FINTRACK R2 objects.
3.  Recreate structural settings.
4.  Set `freshStart = true`.
5.  Set `driveResetAt`.
6.  Set assets/liabilities to zero.
7.  Set `netWorthConfigured = false`.
8.  Set `selectedPeriod = all-time`.

------------------------------------------------------------------------

# 13. Phase 7 --- Transaction UI

Build Add Entry modal.

Fields:

-   Expense / Income
-   Amount
-   Merchant/source
-   Date
-   Category
-   Account
-   Tags
-   Receipt checkbox
-   Receipt upload

Never prefill fake financial values.

Transactions page:

-   search
-   account filter
-   category filter
-   date period
-   responsive table/list
-   category inline editing
-   tag inline editing
-   receipt indicator

------------------------------------------------------------------------

# 14. Phase 8 --- Duplicate Detection

Centralize duplicate detection.

Fingerprint input:

``` text
date
+
merchant.trim().toLowerCase()
+
amount.toFixed(2)
+
account.trim().toLowerCase()
```

Example:

``` text
2026-08-09|netflix|15.99|everyday visa
```

Use cryptographic hashing where appropriate.

Database must enforce:

``` sql
UNIQUE(fingerprint)
```

Duplicate handling must work for:

-   manual entries
-   CSV
-   documents
-   Google Drive
-   concurrent imports

The database constraint is the final protection.

------------------------------------------------------------------------

# 15. Phase 9 --- CSV Import

Flow:

``` text
CSV
 ↓
Parse
 ↓
Detect columns
 ↓
Preview
 ↓
Mapping step if ambiguous
 ↓
Normalize
 ↓
Validate
 ↓
Duplicate detection
 ↓
Insert
 ↓
Import summary
```

Recognize:

-   date
-   description/merchant
-   amount
-   debit
-   credit
-   category
-   account

Output:

``` text
Inserted
Duplicates
Skipped
Needs review
```

Never create placeholder transactions for invalid rows.

------------------------------------------------------------------------

# 16. Phase 10 --- Document Storage

Supported:

-   receipts
-   invoices
-   statements
-   PDFs
-   images
-   CSV
-   spreadsheets

Flow:

``` text
Browser
 ↓
Worker
 ↓
Validate size/type
 ↓
R2
 ↓
D1 metadata
```

R2 object keys:

``` text
uploads/<uuid>-<safe-filename>
drive-inbox/<safe-file-id>-<safe-filename>
```

Maximum:

``` text
20 MB/file
```

Never expose raw R2 URLs or object keys to users.

------------------------------------------------------------------------

# 17. Phase 11 --- Document Intelligence

Implement in stages.

## Stage 1

Only store files.

``` text
Upload → R2 → D1
```

## Stage 2

Add extraction.

Extract only grounded:

-   merchant/payee
-   date
-   total
-   type
-   category

## Stage 3

Confidence/review.

If uncertain:

``` text
status = review
```

Do not create a financial transaction from uncertain extraction.

Do not introduce paid AI/OCR infrastructure unless it is actually
required.

------------------------------------------------------------------------

# 18. Phase 12 --- Dashboard

## Period selector

Options:

``` text
All time
This month
Last month
Last 3 months
Last 6 months
This year
```

Persist globally.

Selected period must affect:

-   dashboard
-   transactions
-   charts
-   totals
-   recent activity

## Summary cards

### Net Worth

``` text
assets - liabilities
```

Only after explicit configuration.

### Income

Sum income transactions.

### Spending

Sum expense transactions.

### Savings rate

``` text
((income - spending) / income) * 100
```

If income is zero:

``` text
0%
```

## Charts

-   Cash flow
-   Spending by category

No invented data.

## Recent activity

Five newest transactions.

## Insight

Only factual insights.

## Coming up

Confirmed recurring/subscription items only.

------------------------------------------------------------------------

# 19. Phase 13 --- Recurring Detection

Do not use AI initially.

Algorithm:

``` text
Transactions
 ↓
Normalize merchant
 ↓
Group by merchant
 ↓
Require ≥2 unique dates
 ↓
Calculate intervals
 ↓
Classify cadence
 ↓
Calculate amount variation
 ↓
Calculate confidence
 ↓
Suggest recurring item
```

Cadence windows:

  Cadence           Days
  ----------- ----------
  Weekly            5--9
  Biweekly        12--17
  Monthly         24--40
  Quarterly      75--110
  Annual        330--400

Amount variation:

-   subscription: ≤20%
-   recurring: ≤35%

High confidence:

-   ≥3 occurrences
-   amount variation ≤12%
-   interval jitter ≤5 days

Suggestions must not automatically become confirmed recurring items.

Actions:

``` text
Keep
Ignore
```

Ignored patterns persist across sessions.

------------------------------------------------------------------------

# 20. Phase 14 --- Subscriptions

Reuse the recurring detection engine.

Subscription hints may include configured strong merchant/category/tag
signals.

Show:

-   service
-   category/group
-   cadence
-   amount
-   monthly equivalent
-   annual equivalent
-   next renewal
-   confidence
-   occurrence count

Actions:

-   Keep
-   Ignore
-   Add manually
-   Edit
-   Delete

No seeded subscriptions.

------------------------------------------------------------------------

# 21. Phase 15 --- Recurring Page

Show:

-   Active detection status
-   Suggestions
-   Estimated monthly commitment
-   Estimated annual commitment
-   Next expected payment
-   Confirmed recurring list
-   Add recurring payment
-   Edit/manage

Recurring entry:

``` text
name
category
amount
cadence
nextDate
account
active
```

No seeded recurring records.

------------------------------------------------------------------------

# 22. Phase 16 --- Budgets

Start empty.

Create budget fields:

``` text
category
monthlyLimit
active
```

Calculate:

``` text
spent
budget limit
remaining
percentage
```

Show:

-   progress
-   over-budget state
-   budget health summary

Support:

-   create
-   edit
-   delete

------------------------------------------------------------------------

# 23. Phase 17 --- Goals

Start empty.

Goal:

``` text
name
targetAmount
currentSavedAmount
dueDate?
note?
```

Display:

-   target
-   current
-   remaining
-   progress
-   percentage
-   due date

Actions:

-   create
-   edit
-   delete

------------------------------------------------------------------------

# 24. Phase 18 --- Rules and Tags

## Rules

Rule:

``` text
whenText
thenText
enabled
```

Actions:

-   create
-   edit
-   enable/disable
-   delete

Rules apply to future imports after duplicate detection.

Do not silently rewrite historical transactions.

## Tags

Tag creation requires only:

``` text
tag name
```

No category.

Support:

-   create
-   usage count
-   delete
-   confirmation before removing from historical transactions

------------------------------------------------------------------------

# 25. Phase 19 --- Settings

## Net worth

Fields:

``` text
assets
liabilities
```

Preview:

``` text
assets - liabilities
```

Save:

``` text
netWorthConfigured = true
```

## Categories

Add/remove.

Case-insensitive duplicate prevention.

Historical labels remain unchanged when removed.

## Accounts

Same behavior as categories.

## Tags

Simple tag management.

## Detection settings

Show:

-   detection explanation
-   ignored suggestion count
-   Restore ignored suggestions

## Drive settings

Show:

-   folder
-   folder link
-   schedule
-   timezone
-   last sync
-   status
-   imported count
-   duplicate count
-   review count
-   errors

Never display tokens.

## Danger zone

Erase all data.

Require user-visible confirmation:

``` text
DELETE
```

Server confirmation:

``` text
DELETE ALL FINTRACK DATA
```

------------------------------------------------------------------------

# 26. Phase 20 --- Google Drive Integration

Dedicated folder:

``` text
FinTrack Financial Inbox
```

Rules:

-   Search for exact folder name first.
-   Reuse if exactly one exists.
-   If none exists, create one.
-   If multiple exact matches exist, ask which one to use.
-   Never create duplicate folders unnecessarily.

The Site must not directly browse Drive from browser code.

Architecture:

``` text
Google Drive
     ↓
Scheduled automation
     ↓
GET /api/drive-sync
     ↓
List new files
     ↓
Parse
     ↓
POST /api/drive-sync
     ↓
D1 + R2
```

------------------------------------------------------------------------

# 27. Drive Sync API

## GET /api/drive-sync

Return:

-   folder metadata
-   schedule metadata
-   last sync
-   status
-   counts
-   processed file IDs
-   reset timestamp

## POST /api/drive-sync

Accept:

-   transactions
-   file metadata
-   file content when available
-   concise errors

For transactions:

-   normalize
-   source = google-drive
-   add `Drive import` tag
-   duplicate detection

For files:

-   enforce 20 MB
-   store in R2
-   store D1 metadata
-   review uncertain content

Only mark a file processed after successful storage/processing.

------------------------------------------------------------------------

# 28. Phase 21 --- Daily Automation

Automation title:

``` text
Sync FinTrack Inbox
```

Schedule:

``` text
BEGIN:VEVENT
DTSTART:<next 8:00 AM in user timezone>
RRULE:FREQ=DAILY
END:VEVENT
```

Timing mode:

``` text
exact_schedule
```

Automation must:

1.  Verify Drive/Site access.
2.  Get temporary authorization.
3.  Read `/api/drive-sync`.
4.  Read `processedFileIds`.
5.  Read `resetAt`.
6.  List direct children of the dedicated folder.
7.  Ignore processed files.
8.  Ignore files modified at/before reset timestamp.
9.  Parse CSV/document data.
10. Upload original file bytes where possible.
11. POST data to `/api/drive-sync`.
12. Verify response.
13. Report counts.
14. Never expose secrets.

If transfer fails:

``` text
Do NOT mark file processed.
```

This allows retry on the next run.

------------------------------------------------------------------------

# 29. Phase 22 --- PWA

Install:

``` bash
npm install -D vite-plugin-pwa
```

Configure:

-   manifest
-   icons
-   theme color
-   standalone display
-   service worker

Goal:

``` text
Desktop browser
+
Mobile browser
+
Add to Home Screen
```

No native Android/iOS application in V1.

------------------------------------------------------------------------

# 30. Phase 23 --- Security

## Required controls

-   HTTPS
-   private access
-   server-side validation
-   parameterized D1 queries
-   private R2
-   no secrets in frontend
-   no sensitive logs
-   UUID IDs
-   safe filenames
-   size limits
-   authorization on every protected API
-   input normalization
-   output escaping/safe rendering

Never log:

-   bearer tokens
-   full files
-   account numbers
-   sensitive document contents
-   raw transaction payloads

------------------------------------------------------------------------

# 31. Phase 24 --- Testing Strategy

## Unit tests

Test:

-   date period calculation
-   currency calculations
-   savings rate
-   fingerprint generation
-   tag normalization
-   recurring detection
-   cadence detection
-   confidence calculation
-   monthly equivalent
-   duplicate detection

## API tests

Test:

-   state retrieval
-   transaction CRUD
-   preferences
-   document upload
-   drive sync
-   data wipe
-   validation failures
-   authorization failures

## Integration tests

Test:

``` text
CSV → API → D1
Upload → R2 → D1
Drive → API → D1/R2
```

## E2E tests

Use Playwright.

Test:

-   login/access
-   dashboard
-   add transaction
-   edit transaction
-   delete transaction
-   filters
-   CSV import
-   documents
-   budgets
-   goals
-   recurring
-   subscriptions
-   settings
-   wipe flow

------------------------------------------------------------------------

# 32. Phase 25 --- Responsive Testing

Required widths:

``` text
390px
768px
1440px
```

Verify:

-   cards stack correctly
-   charts resize
-   tables don't break
-   buttons remain tappable
-   modals fit
-   bottom navigation reaches all tabs
-   no horizontal overflow
-   no clipped text
-   no inaccessible controls

------------------------------------------------------------------------

# 33. Phase 26 --- Production Verification

Before release:

### Data

-   No sample transactions.
-   No sample goals.
-   No sample budgets.
-   No sample subscriptions.
-   No sample recurring entries.
-   No sample rules.
-   No sample documents.
-   No configured net worth values.

### Persistence

Verify:

-   refresh retains data
-   another browser session retains data
-   another device retains data

### Transactions

-   add
-   edit
-   delete
-   duplicate detection
-   CSV import

### Documents

-   upload
-   metadata
-   R2 storage
-   deletion

### Settings

-   categories
-   accounts
-   tags
-   rules
-   goals
-   budgets
-   net worth
-   detection settings

### Drive

-   folder exists once
-   correct folder selected
-   endpoint works
-   automation exists once
-   schedule is 8:00 AM
-   timezone correct

### Mobile

Test all pages at 390px.

------------------------------------------------------------------------

# 34. Production Deployment Sequence

Use this exact order.

``` text
1. Git repository
       ↓
2. React/Vite project
       ↓
3. Application shell
       ↓
4. Cloudflare project
       ↓
5. D1 database
       ↓
6. R2 bucket
       ↓
7. Worker/API
       ↓
8. Database migrations
       ↓
9. Transaction system
       ↓
10. Dashboard
       ↓
11. Imports
       ↓
12. Documents
       ↓
13. Recurring/subscriptions
       ↓
14. Budgets/goals
       ↓
15. Settings
       ↓
16. Google Drive
       ↓
17. Automation
       ↓
18. PWA
       ↓
19. Security
       ↓
20. Automated tests
       ↓
21. Production deployment
       ↓
22. Production verification
```

------------------------------------------------------------------------

# 35. CI/CD

Recommended GitHub flow:

``` text
Developer
   ↓
git push
   ↓
GitHub
   ↓
CI
   ├── install
   ├── lint
   ├── unit tests
   ├── build
   └── E2E tests
          ↓
       deploy
          ↓
     Cloudflare
```

Production deployment should happen only after CI succeeds.

------------------------------------------------------------------------

# 36. Cost Strategy

Target:

``` text
₹0 / month
```

within free allowances.

Use:

-   Cloudflare Workers
-   Cloudflare D1
-   Cloudflare R2
-   Cloudflare hosting
-   GitHub
-   PWA
-   Google Drive

Avoid:

-   EC2
-   managed PostgreSQL
-   managed MongoDB
-   Redis
-   Kafka
-   RabbitMQ
-   Kubernetes
-   paid OCR
-   paid AI APIs

The architecture should be designed so that a small increase in usage
does not immediately require infrastructure changes.

Important: "free" means within current provider free quotas. It is not a
guarantee of zero cost forever.

------------------------------------------------------------------------

# 37. Why No EC2?

For this workload:

``` text
5–6 users
low request volume
small database
small file volume
```

EC2 introduces:

-   server maintenance
-   OS updates
-   process management
-   security patches
-   networking configuration
-   reverse proxy
-   TLS setup
-   monitoring
-   deployment management

None of those solve an actual problem at this scale.

------------------------------------------------------------------------

# 38. Why No Kubernetes?

Kubernetes would introduce:

``` text
cluster
nodes
pods
services
ingress
configmaps
secrets
autoscaling
monitoring
```

For six users, this is architectural overkill.

Serverless is the correct abstraction here.

------------------------------------------------------------------------

# 39. Why No Redis?

The application does not initially need:

-   distributed caching
-   session cache
-   pub/sub
-   queues
-   rate-limit state at scale

TanStack Query handles browser-side server-state caching.

D1 handles durable state.

------------------------------------------------------------------------

# 40. Why No Kafka/RabbitMQ?

There is no high-volume asynchronous event stream requirement.

Google Drive imports can be handled through the scheduled workflow.

If document processing becomes expensive later, a queue can be
introduced as a V2 optimization.

------------------------------------------------------------------------

# 41. Future Scaling Path

If usage grows significantly:

``` text
V1
React
+
Worker
+
D1
+
R2
```

Then potentially:

``` text
V2
React
+
Workers
+
D1
+
R2
+
Queue
```

Then only if justified:

``` text
V3
Workers
+
Queue
+
PostgreSQL
+
Object storage
+
dedicated processing workers
```

Infrastructure should be introduced only when measurements show a need.

------------------------------------------------------------------------

# 42. Recommended Development Milestones

## Milestone 1

Application shell.

Deliver:

-   routes
-   navigation
-   responsive layout
-   components

## Milestone 2

Database + API.

Deliver:

-   D1
-   migrations
-   Worker
-   state API
-   transaction API

## Milestone 3

Transactions.

Deliver:

-   add
-   edit
-   delete
-   filtering
-   search
-   tags
-   categories

## Milestone 4

Dashboard.

Deliver:

-   totals
-   period selection
-   charts
-   recent activity
-   empty states

## Milestone 5

Imports.

Deliver:

-   CSV
-   duplicate detection
-   documents
-   R2

## Milestone 6

Financial intelligence.

Deliver:

-   recurring
-   subscriptions
-   budgets
-   goals
-   rules

## Milestone 7

Drive.

Deliver:

-   Drive folder
-   sync API
-   scheduled automation

## Milestone 8

Production.

Deliver:

-   PWA
-   security
-   tests
-   CI/CD
-   deployment
-   final verification

------------------------------------------------------------------------

# 43. Definition of Done

FINTRACK is not complete until:

-   all nine tabs work
-   all visible buttons work
-   all modals work
-   all forms validate
-   data persists in D1
-   files persist in R2
-   duplicate detection works
-   CSV import works
-   document upload works
-   recurring detection works
-   subscription detection works
-   budgets work
-   goals work
-   rules work
-   tags work
-   net worth works
-   data wipe works
-   Drive sync endpoint works
-   daily automation exists once
-   automation runs at 8:00 AM
-   timezone is correct
-   mobile layout works
-   desktop layout works
-   no sample financial data remains
-   production build succeeds
-   production tests pass

------------------------------------------------------------------------

# 44. Final Architecture Reference

``` text
                         FINTRACK
                            │
                            ▼
                 ┌────────────────────┐
                 │ React + TypeScript │
                 │ Vite + Tailwind    │
                 │ PWA                │
                 └─────────┬──────────┘
                           │ HTTPS
                           ▼
                 ┌────────────────────┐
                 │ Cloudflare         │
                 │ Access             │
                 └─────────┬──────────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │ Hono Worker        │
                 │                    │
                 │ REST API           │
                 │ Validation         │
                 │ Business Logic     │
                 └───────┬─────┬──────┘
                         │     │
                    SQL  │     │  Objects
                         ▼     ▼
                    ┌──────┐ ┌──────┐
                    │ D1   │ │ R2   │
                    │ DB   │ │Files │
                    └──────┘ └──────┘
                         ▲
                         │
                  ┌──────┴──────┐
                  │ Google      │
                  │ Drive       │
                  └──────┬──────┘
                         ▲
                         │
                  Daily 8:00 AM
                  scheduled sync
```

------------------------------------------------------------------------

# 45. Master Checklist

## Foundation

-   [ ] Repository created
-   [ ] React/Vite initialized
-   [ ] TypeScript configured
-   [ ] Tailwind configured
-   [ ] ESLint configured
-   [ ] Prettier configured
-   [ ] Vitest configured
-   [ ] Playwright configured
-   [ ] CI configured

## Frontend

-   [ ] App shell
-   [ ] Sidebar
-   [ ] Mobile top bar
-   [ ] Bottom navigation
-   [ ] Dashboard
-   [ ] Transactions
-   [ ] Recurring
-   [ ] Subscriptions
-   [ ] Budgets
-   [ ] Goals
-   [ ] Documents
-   [ ] Rules
-   [ ] Settings

## Backend

-   [ ] Worker
-   [ ] Hono
-   [ ] Authentication
-   [ ] State API
-   [ ] Transactions API
-   [ ] Preferences API
-   [ ] Documents API
-   [ ] Drive Sync API
-   [ ] Data wipe API

## Database

-   [ ] D1 created
-   [ ] Schema migrated
-   [ ] Indexes created
-   [ ] Unique fingerprint
-   [ ] Empty state initialized

## Storage

-   [ ] R2 bucket
-   [ ] Private access
-   [ ] 20 MB limit
-   [ ] Safe object keys
-   [ ] D1 metadata

## Imports

-   [ ] CSV parser
-   [ ] Column detection
-   [ ] Mapping
-   [ ] Duplicate detection
-   [ ] Document storage
-   [ ] Review state

## Intelligence

-   [ ] Recurring detection
-   [ ] Subscription detection
-   [ ] Confidence
-   [ ] Ignore
-   [ ] Restore ignored

## Google Drive

-   [ ] Folder located/created
-   [ ] Folder metadata saved
-   [ ] Drive sync endpoint
-   [ ] Processed file IDs
-   [ ] Reset timestamp
-   [ ] Daily automation
-   [ ] 8:00 AM schedule
-   [ ] Correct timezone

## Security

-   [ ] Private access
-   [ ] Server validation
-   [ ] Parameterized queries
-   [ ] No secret in frontend
-   [ ] No sensitive logging
-   [ ] Safe file handling
-   [ ] Authorization checks

## Testing

-   [ ] Unit tests
-   [ ] API tests
-   [ ] Integration tests
-   [ ] E2E tests
-   [ ] 390px test
-   [ ] 768px test
-   [ ] 1440px test
-   [ ] Production verification

## Final state

-   [ ] No sample financial data
-   [ ] Net Worth = Not set
-   [ ] Selected period = All time
-   [ ] All financial arrays empty
-   [ ] Drive folder retained
-   [ ] Automation retained
-   [ ] Production URL verified

------------------------------------------------------------------------

# 46. Working Principle

For every implementation decision, ask:

1.  Does this solve a real current requirement?
2.  Does it keep the system free/low-cost?
3.  Does it reduce operational complexity?
4.  Does it preserve data durability?
5.  Does it work on mobile?
6.  Does it fail safely?
7.  Can it be replaced or scaled later?

The default architecture should remain simple until actual usage proves
that additional infrastructure is necessary.
