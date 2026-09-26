-- Habit tracking. Idempotent: also included in schema.sql.

CREATE TABLE IF NOT EXISTS habits (
  id            TEXT    PRIMARY KEY,
  userId        TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  color         TEXT    NOT NULL DEFAULT 'violet',
  frequency     TEXT    NOT NULL CHECK(frequency IN ('daily', 'weekly')),
  targetPerWeek INTEGER NOT NULL DEFAULT 7 CHECK(targetPerWeek BETWEEN 1 AND 7),
  archived      INTEGER NOT NULL DEFAULT 0,
  sortOrder     INTEGER NOT NULL DEFAULT 0,
  createdAt     TEXT    NOT NULL,
  updatedAt     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(userId, archived, sortOrder);

-- One row per habit per completed day; unchecking deletes the row.
CREATE TABLE IF NOT EXISTS habit_logs (
  habitId   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (habitId, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(userId, date);
