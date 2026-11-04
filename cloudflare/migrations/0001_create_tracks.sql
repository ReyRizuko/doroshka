CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  album TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL DEFAULT '',
  duration REAL NOT NULL DEFAULT 0,
  object_key TEXT UNIQUE,
  source_url TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  cover_url TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL,
  attribution TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (object_key IS NOT NULL OR source_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS tracks_title_idx ON tracks(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS tracks_artist_idx ON tracks(artist COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS tracks_album_idx ON tracks(album COLLATE NOCASE);
