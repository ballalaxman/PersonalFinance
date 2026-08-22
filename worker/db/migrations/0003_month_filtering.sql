CREATE INDEX IF NOT EXISTS idx_transactions_page
ON transactions(userId, date DESC, createdAt DESC, id DESC);
