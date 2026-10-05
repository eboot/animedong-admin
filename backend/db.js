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
      `SELECT * FROM schedule ${whereSql}
       ORDER BY ${orderCase}, scraped_at DESC, id DESC
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
