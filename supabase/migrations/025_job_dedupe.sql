-- Once-only claims for scheduled-job side effects (e.g. one 24h reminder email per booking).
-- Safe to run more than once. Rows older than 30 days are pruned by the worker.
CREATE TABLE IF NOT EXISTS job_dedupe (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_dedupe_created ON job_dedupe (created_at);

ALTER TABLE job_dedupe ENABLE ROW LEVEL SECURITY;
