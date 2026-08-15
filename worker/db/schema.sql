-- FinTrack D1 Schema
-- Idempotent: safe to run on an already-initialised database.

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL DEFAULT '',
  passwordHash TEXT NOT NULL,
  createdAt    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Transactions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT    PRIMARY KEY,
  userId      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,
  merchant    TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'Needs review',
  amount      REAL    NOT NULL,
  type        TEXT    NOT NULL CHECK(type IN ('expense', 'income')),
  account     TEXT    NOT NULL DEFAULT 'Imported account',
  tags        TEXT    NOT NULL DEFAULT '[]',
  receipt     INTEGER NOT NULL DEFAULT 0,
  source      TEXT    NOT NULL,
  fingerprint TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL,
  -- fingerprint is unique per user, not globally
  UNIQUE(userId, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user     ON transactions(userId);
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(userId, date);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(userId, merchant);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(userId, category);
CREATE INDEX IF NOT EXISTS idx_transactions_account  ON transactions(userId, account);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(userId, createdAt);

-- ─── Tags ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
  userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (userId, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(userId);

-- ─── Rules ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rules (
  id        TEXT    PRIMARY KEY,
  userId    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whenText  TEXT    NOT NULL,
  thenText  TEXT    NOT NULL,
  enabled   INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rules_user ON rules(userId);

-- ─── Settings ────────────────────────────────────────────────────────────────
-- Compound PK so each user has their own independent settings namespace.

CREATE TABLE IF NOT EXISTS settings (
  userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (userId, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(userId);

-- ─── Documents ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id        TEXT    PRIMARY KEY,
  userId    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename  TEXT    NOT NULL,
  mimeType  TEXT    NOT NULL,
  size      INTEGER NOT NULL,
  objectKey TEXT    NOT NULL UNIQUE,
  status    TEXT    NOT NULL,
  source    TEXT    NOT NULL,
  createdAt TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(userId);
