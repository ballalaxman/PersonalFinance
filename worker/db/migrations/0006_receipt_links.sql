-- Links a receipt file in the document vault to the transaction it belongs to,
-- so the receipt can be opened from the transaction. Idempotent.

CREATE TABLE IF NOT EXISTS transaction_receipts (
  transactionId TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  documentId    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  userId        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transaction_receipts_document ON transaction_receipts(documentId);
CREATE INDEX IF NOT EXISTS idx_transaction_receipts_user     ON transaction_receipts(userId);
