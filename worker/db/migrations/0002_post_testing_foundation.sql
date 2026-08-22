-- Post-testing foundation migration.
-- Back up the production database before applying this migration.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE transactions_v2 (
  id          TEXT    PRIMARY KEY,
  userId      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,
  merchant    TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'Needs review',
  amount      REAL    NOT NULL,
  type        TEXT    NOT NULL CHECK(type IN ('expense', 'income', 'investment')),
  account     TEXT    NOT NULL DEFAULT 'Imported account',
  tags        TEXT    NOT NULL DEFAULT '[]',
  receipt     INTEGER NOT NULL DEFAULT 0,
  source      TEXT    NOT NULL,
  fingerprint TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL,
  UNIQUE(userId, fingerprint)
);

INSERT INTO transactions_v2
SELECT id, userId, date, merchant, category, amount, type, account, tags,
       receipt, source, fingerprint, createdAt
FROM transactions;

DROP TABLE transactions;
ALTER TABLE transactions_v2 RENAME TO transactions;

CREATE INDEX idx_transactions_user     ON transactions(userId);
CREATE INDEX idx_transactions_date     ON transactions(userId, date);
CREATE INDEX idx_transactions_merchant ON transactions(userId, merchant);
CREATE INDEX idx_transactions_category ON transactions(userId, category);
CREATE INDEX idx_transactions_account  ON transactions(userId, account);
CREATE INDEX idx_transactions_created  ON transactions(userId, createdAt);

CREATE TABLE recurring_schedules (
  id               TEXT    PRIMARY KEY,
  userId           TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  transactionType  TEXT    NOT NULL CHECK(transactionType IN ('expense', 'income', 'investment')),
  category         TEXT    NOT NULL,
  amount           REAL    NOT NULL CHECK(amount > 0),
  account          TEXT,
  cadence          TEXT    NOT NULL CHECK(cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  startDate        TEXT    NOT NULL,
  dayOfMonth       INTEGER CHECK(dayOfMonth IS NULL OR (dayOfMonth BETWEEN 1 AND 31)),
  nextDueDate      TEXT    NOT NULL,
  endDate          TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  notifyDaysBefore INTEGER NOT NULL DEFAULT 0 CHECK(notifyDaysBefore IN (0, 1, 3, 7)),
  createdAt        TEXT    NOT NULL,
  updatedAt        TEXT    NOT NULL
);

CREATE INDEX idx_recurring_schedules_user ON recurring_schedules(userId);
CREATE INDEX idx_recurring_schedules_due ON recurring_schedules(active, nextDueDate, userId);

CREATE TABLE recurring_occurrences (
  id                 TEXT PRIMARY KEY,
  userId             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduleId         TEXT NOT NULL REFERENCES recurring_schedules(id) ON DELETE CASCADE,
  dueDate            TEXT NOT NULL,
  expectedAmount     REAL NOT NULL CHECK(expectedAmount > 0),
  status             TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'skipped', 'postponed')),
  transactionId      TEXT REFERENCES transactions(id),
  postponedUntil     TEXT,
  notificationSentAt TEXT,
  createdAt          TEXT NOT NULL,
  resolvedAt         TEXT,
  UNIQUE(scheduleId, dueDate)
);

CREATE INDEX idx_recurring_occurrences_user ON recurring_occurrences(userId);
CREATE INDEX idx_recurring_occurrences_schedule ON recurring_occurrences(userId, scheduleId, dueDate);
CREATE INDEX idx_recurring_occurrences_status ON recurring_occurrences(userId, status, dueDate);

CREATE TABLE push_subscriptions (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  deviceLabel TEXT NOT NULL DEFAULT '',
  lastFailure TEXT,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL,
  UNIQUE(userId, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(userId);

PRAGMA defer_foreign_keys = OFF;
