-- Skema Supabase (PostgreSQL) untuk AnimeDong Admin.
-- Cara pakai: buat project di https://supabase.com/dashboard,
-- buka SQL Editor, paste seluruh file ini, Run.
-- Catatan: day_order ditambahkan agar urutan hari Senin..Minggu
-- tetap benar di query paginasi (SQLite memakai CASE WHEN).

CREATE TABLE IF NOT EXISTS home (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  anime_id TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  episodes TEXT,
  released_on TEXT,
  release_day TEXT,
  type TEXT,
  href TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source, anime_id)
);
CREATE INDEX IF NOT EXISTS idx_home_scraped ON home (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_home_source ON home (source);

CREATE TABLE IF NOT EXISTS schedule (
  id BIGSERIAL PRIMARY KEY,
  day TEXT NOT NULL,
  day_order INT NOT NULL DEFAULT 99,
  anime_id TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (day, anime_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule (day);

CREATE TABLE IF NOT EXISTS anime_detail (
  anime_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  poster TEXT,
  japanese TEXT,
  score TEXT,
  producers TEXT,
  type TEXT,
  status TEXT,
  episodes TEXT,
  duration TEXT,
  aired TEXT,
  studios TEXT,
  synopsis TEXT,
  genres TEXT,
  episode_list TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_cache (
  server_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donghua (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  status TEXT,
  type TEXT,
  current_episode TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source, slug)
);
CREATE INDEX IF NOT EXISTS idx_donghua_scraped ON donghua (scraped_at DESC);

CREATE TABLE IF NOT EXISTS donghua_detail (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  poster TEXT,
  cover TEXT,
  status TEXT,
  type TEXT,
  rating TEXT,
  studio TEXT,
  network TEXT,
  released TEXT,
  duration TEXT,
  episodes_count TEXT,
  season TEXT,
  country TEXT,
  subber TEXT,
  genres TEXT,
  synopsis TEXT,
  episodes_list TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donghua_stream (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donghua_schedule (
  id BIGSERIAL PRIMARY KEY,
  day TEXT NOT NULL,
  day_order INT NOT NULL DEFAULT 99,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  url TEXT,
  eps TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (day, slug)
);
CREATE INDEX IF NOT EXISTS idx_donghua_schedule_day ON donghua_schedule (day);
