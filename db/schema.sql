CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  stage INTEGER NOT NULL,
  era TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_era_score ON scores (era, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_ip_time ON scores (ip_hash, created_at);
