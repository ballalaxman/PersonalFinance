-- Which reminders were already delivered, so each is sent once.
-- kind: 'upcoming' (refId = schedule, forDate = due date),
--       'due'      (refId = occurrence, forDate = due/postponed date),
--       'habits'   (refId = user, forDate = local date). Idempotent.

CREATE TABLE IF NOT EXISTS reminder_log (
  userId  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL,
  refId   TEXT NOT NULL,
  forDate TEXT NOT NULL,
  sentAt  TEXT NOT NULL,
  PRIMARY KEY (kind, refId, forDate)
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_user ON reminder_log(userId);
CREATE INDEX IF NOT EXISTS idx_reminder_log_sent ON reminder_log(sentAt);
