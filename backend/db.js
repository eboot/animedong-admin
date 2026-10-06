import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

// Database bernama "home" sesuai permintaan.
export const db = new DatabaseSync(join(DATA_DIR, 'home.sqlite'))

db.exec(`
  CREATE TABLE IF NOT EXISTS home (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    title TEXT NOT NULL,
    poster TEXT,
    episodes TEXT,
    released_on TEXT,
    type TEXT,
    href TEXT,
    scraped_at DATETIME DEFAULT (datetime('now', 'localtime')),
    UNIQUE(source, anime_id)
  );
  CREATE INDEX IF NOT EXISTS idx_home_scraped ON home(scraped_at DESC);
  CREATE INDEX IF NOT EXISTS idx_home_source ON home(source);

  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    anime_id TEXT NOT NULL,
    title TEXT NOT NULL,
    poster TEXT,
    url TEXT,
    scraped_at DATETIME DEFAULT (datetime('now', 'localtime')),
    UNIQUE(day, anime_id)
  );
  CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule(day);

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
    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS stream_cache (
    server_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    fetched_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS donghua (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    poster TEXT,
    status TEXT,
    type TEXT,
    current_episode TEXT,
    scraped_at DATETIME DEFAULT (datetime('now', 'localtime')),
    UNIQUE(source, slug)
  );
  CREATE INDEX IF NOT EXISTS idx_donghua_scraped ON donghua(scraped_at DESC);

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
    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS donghua_stream (
    slug TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    fetched_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );
`)

// Kolom tambahan untuk sumber animehome (dibuat bila belum ada).
if (!db.prepare(`PRAGMA table_info(home)`).all().some((c) => c.name === 'release_day')) {
  db.exec(`ALTER TABLE home ADD COLUMN release_day TEXT`)
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO home
    (source, anime_id, title, poster, episodes, released_on, release_day, type, href)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

/** Insert satu item. Return true jika baris BARU (false = sudah ada). */
export function insertAnime(item) {
  const r = insertStmt.run(
    item.source,
    item.anime_id,
    item.title,
    item.poster ?? null,
    item.episodes ?? null,
    item.released_on ?? null,
    item.release_day ?? null,
    item.type ?? null,
    item.href ?? null
  )
  return r.changes === 1
}

const insertScheduleStmt = db.prepare(`
  INSERT OR IGNORE INTO schedule (day, anime_id, title, poster, url)
  VALUES (?, ?, ?, ?, ?)
`)

/** Insert satu jadwal. Return true jika baris BARU. */
export function insertSchedule(item) {
  const r = insertScheduleStmt.run(
    item.day,
    item.anime_id,
    item.title,
    item.poster ?? null,
    item.url ?? null
  )
  return r.changes === 1
}

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export function listSchedule({ day, q, page = 1, limit = 100 } = {}) {
  const where = []
  const params = []
  if (day) {
    where.push('day = ?')
    params.push(day)
  }
  if (q) {
    where.push('title LIKE ?')
    params.push(`%${q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderCase = `CASE day ${DAY_ORDER.map((d, i) => `WHEN '${d}' THEN ${i}`).join(' ')} ELSE 99 END`
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM schedule ${whereSql}`)
    .get(...params).c
  const rows = db
    .prepare(
      `SELECT s.id, s.day, s.anime_id, s.title,
         COALESCE(
           NULLIF(s.poster, ''),
           (SELECT h.poster FROM home h
            WHERE h.anime_id = s.anime_id AND h.poster <> ''
            ORDER BY h.scraped_at DESC, h.id DESC LIMIT 1),
           ''
         ) AS poster,
         s.url, s.scraped_at
       FROM schedule s ${whereSql}
       ORDER BY ${orderCase}, s.scraped_at DESC, s.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit)
  return { total, page, limit, rows, days: DAY_ORDER }
}

export function getAnimeDetail(animeId) {
  const row = db.prepare(`SELECT * FROM anime_detail WHERE anime_id = ?`).get(animeId)
  if (!row) return null
  return {
    ...row,
    synopsis: safeJson(row.synopsis, { paragraphs: [], connections: [] }),
    genres: safeJson(row.genres, []),
    episode_list: safeJson(row.episode_list, []),
  }
}

function safeJson(s, fallback) {
  try {
    return s ? JSON.parse(s) : fallback
  } catch {
    return fallback
  }
}

const upsertDetailStmt = db.prepare(`
  INSERT INTO anime_detail
    (anime_id, title, poster, japanese, score, producers, type, status,
     episodes, duration, aired, studios, synopsis, genres, episode_list, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  ON CONFLICT(anime_id) DO UPDATE SET
    title=excluded.title, poster=excluded.poster, japanese=excluded.japanese,
    score=excluded.score, producers=excluded.producers, type=excluded.type,
    status=excluded.status, episodes=excluded.episodes, duration=excluded.duration,
    aired=excluded.aired, studios=excluded.studios, synopsis=excluded.synopsis,
    genres=excluded.genres, episode_list=excluded.episode_list,
    updated_at=datetime('now', 'localtime')
`)

/** Simpan/update detail anime. `d.episode_list` dkk boleh array (disimpan JSON). */
export function saveAnimeDetail(animeId, d) {
  const str = (v) => (v == null ? '' : String(v))
  const js = (v) => JSON.stringify(v ?? [])
  upsertDetailStmt.run(
    animeId,
    str(d.title),
    str(d.poster),
    str(d.japanese),
    str(d.score),
    str(d.producers),
    str(d.type),
    str(d.status),
    str(d.episodes),
    str(d.duration),
    str(d.aired),
    str(d.studios),
    typeof d.synopsis === 'string' ? d.synopsis : js(d.synopsis),
    js(d.genres),
    js(d.episode_list)
  )
}

export function listAnime({ source, q, page = 1, limit = 50 } = {}) {
  const where = []
  const params = []
  if (source) {
    where.push('source = ?')
    params.push(source)
  }
  if (q) {
    where.push('title LIKE ?')
    params.push(`%${q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM home ${whereSql}`)
    .get(...params).c
  const rows = db
    .prepare(
      `SELECT * FROM home ${whereSql}
       ORDER BY scraped_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit)
  return { total, page, limit, rows }
}

export function stats() {
  return db
    .prepare(
      `SELECT source, COUNT(*) AS total, MAX(scraped_at) AS last_scrape
       FROM home GROUP BY source`
    )
    .all()
}

/** Ringkasan angka untuk halaman Dashboard. */
export function dashboardStats() {
  const count = (sql) => db.prepare(sql).get()?.c ?? 0
  return {
    anime: {
      total: count('SELECT COUNT(*) AS c FROM home'),
      details: count('SELECT COUNT(*) AS c FROM anime_detail'),
      bySource: db
        .prepare(
          `SELECT source, COUNT(*) AS total, MAX(scraped_at) AS last_scrape
           FROM home GROUP BY source ORDER BY total DESC`
        )
        .all(),
    },
    schedule: {
      total: count('SELECT COUNT(*) AS c FROM schedule'),
      byDay: db
        .prepare('SELECT day, COUNT(*) AS total FROM schedule GROUP BY day')
        .all(),
    },
    donghua: {
      total: count('SELECT COUNT(*) AS c FROM donghua'),
      details: count('SELECT COUNT(*) AS c FROM donghua_detail'),
    },
    streams: {
      anime: count('SELECT COUNT(*) AS c FROM stream_cache'),
      donghua: count('SELECT COUNT(*) AS c FROM donghua_stream'),
    },
    recent: db
      .prepare(
        `SELECT source, title, episodes, scraped_at
         FROM home ORDER BY scraped_at DESC LIMIT 8`
      )
      .all(),
  }
}

// URL stream per serverId — simpan saat pertama diambil, pakai lagi tanpa ke API.
export function getStreamUrl(serverId) {
  const row = db.prepare('SELECT url FROM stream_cache WHERE server_id = ?').get(serverId)
  return row?.url || ''
}

export function saveStreamUrl(serverId, url) {
  db.prepare(
    `INSERT INTO stream_cache (server_id, url, fetched_at)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(server_id) DO UPDATE SET url = excluded.url, fetched_at = excluded.fetched_at`
  ).run(serverId, url)
}

// ---- Donghua ----

const insertDonghuaStmt = db.prepare(`
  INSERT OR IGNORE INTO donghua
    (source, slug, title, poster, status, type, current_episode)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

/** Insert satu donghua. Return true jika baris BARU (false = sudah ada). */
export function insertDonghua(item) {
  const r = insertDonghuaStmt.run(
    item.source,
    item.slug,
    item.title,
    item.poster ?? null,
    item.status ?? null,
    item.type ?? null,
    item.current_episode ?? null
  )
  return r.changes === 1
}

export function listDonghua({ q, page = 1, limit = 50 } = {}) {
  const where = []
  const params = []
  if (q) {
    where.push('title LIKE ?')
    params.push(`%${q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM donghua ${whereSql}`)
    .get(...params).c
  const rows = db
    .prepare(
      `SELECT * FROM donghua ${whereSql}
       ORDER BY scraped_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, (page - 1) * limit)
  return { total, page, limit, rows }
}

export function getDonghuaDetail(slug) {
  const row = db.prepare(`SELECT * FROM donghua_detail WHERE slug = ?`).get(slug)
  if (!row) return null
  return {
    ...row,
    genres: safeJson(row.genres, []),
    episodes_list: safeJson(row.episodes_list, []),
  }
}

const upsertDonghuaDetailStmt = db.prepare(`
  INSERT INTO donghua_detail
    (slug, title, poster, cover, status, type, rating, studio, network,
     released, duration, episodes_count, season, country, subber,
     genres, synopsis, episodes_list, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  ON CONFLICT(slug) DO UPDATE SET
    title=excluded.title, poster=excluded.poster, cover=excluded.cover,
    status=excluded.status, type=excluded.type, rating=excluded.rating,
    studio=excluded.studio, network=excluded.network, released=excluded.released,
    duration=excluded.duration, episodes_count=excluded.episodes_count,
    season=excluded.season, country=excluded.country, subber=excluded.subber,
    genres=excluded.genres, synopsis=excluded.synopsis,
    episodes_list=excluded.episodes_list,
    updated_at=datetime('now', 'localtime')
`)

/** Simpan/update detail donghua. `d.episodes_list`/`d.genres` boleh array (disimpan JSON). */
export function saveDonghuaDetail(slug, d) {
  const str = (v) => (v == null ? '' : String(v))
  const js = (v) => JSON.stringify(v ?? [])
  upsertDonghuaDetailStmt.run(
    slug,
    str(d.title),
    str(d.poster),
    str(d.cover),
    str(d.status),
    str(d.type),
    str(d.rating),
    str(d.studio),
    str(d.network),
    str(d.released),
    str(d.duration),
    str(d.episodes_count),
    str(d.season),
    str(d.country),
    str(d.subber),
    js(d.genres),
    typeof d.synopsis === 'string' ? d.synopsis : js(d.synopsis),
    js(d.episodes_list)
  )
}

// Data streaming per episode donghua — simpan saat pertama diambil.
export function getDonghuaStream(slug) {
  const row = db.prepare('SELECT data FROM donghua_stream WHERE slug = ?').get(slug)
  return safeJson(row?.data, null)
}

export function saveDonghuaStream(slug, data) {
  db.prepare(
    `INSERT INTO donghua_stream (slug, data, fetched_at)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(slug) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`
  ).run(slug, JSON.stringify(data))
}
