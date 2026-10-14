CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  operation TEXT,
  status TEXT NOT NULL,
  video_uri TEXT,
  error TEXT,
  model TEXT NOT NULL,
  mode TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  resolution TEXT NOT NULL,
  duration INTEGER NOT NULL,
  extension_count INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS video_jobs_active_user ON video_jobs(user_id)
  WHERE status IN ('submitting', 'running', 'uncertain');
CREATE INDEX IF NOT EXISTS video_jobs_history ON video_jobs(user_id, created_at DESC);
