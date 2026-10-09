// Integrasi Supabase (PostgreSQL) untuk AnimeDong Admin — contoh drop-in.
//
// Fungsi-fungsi di sini meniru signature & bentuk return db.js (SQLite):
//   insert*  -> boolean (true = baris BARU, false = sudah ada)
//   list*    -> { total, page, limit, rows }
// Bedanya: semua fungsi di sini ASYNC (butuh await).
//
// Cara pakai:
//   1. Jalankan supabase-schema.sql di SQL Editor project Supabase-mu.
//   2. Set env: SUPABASE_URL dan SUPABASE_SERVICE_KEY
//      (Dashboard -> Project Settings -> API; pakai SERVICE key karena ini backend).
//   3. npm install (sudah termasuk @supabase/supabase-js).
//   4. Ganti import di server.js/scheduler.js:
//        import { ... } from './db.js'  ->  import { ... } from './supabase.js'
//      dan tambahkan await di pemanggilnya.
import { createClient } from '@supabase/supabase-js'

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const dayOrder = (day) => {
  const i = DAY_ORDER.indexOf(day)
  return i === -1 ? 99 : i
}

let _client = null
export function supabase() {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  // Terima nama baru (SECRET_KEY) maupun lama (SERVICE_KEY)
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SECRET_KEY belum di-set. ' +
        'Isi dari Supabase Dashboard -> Project Settings -> API.'
    )
  }
  _client = createClient(url, key)
  return _client
}

/** Insert satu anime. Return true jika baris BARU. */
export async function insertAnime(item) {
  const { data, error } = await supabase()
    .from('home')
    .upsert(
      {
        source: item.source,
        anime_id: item.anime_id,
        title: item.title,
        poster: item.poster ?? null,
        episodes: item.episodes ?? null,
        released_on: item.released_on ?? null,
        release_day: item.release_day ?? null,
        type: item.type ?? null,
        href: item.href ?? null,
      },
      { onConflict: 'source,anime_id', ignoreDuplicates: true }
    )
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) === 1
}

/** Insert satu jadwal anime. Return true jika baris BARU. */
export async function insertSchedule(item) {
  const { data, error } = await supabase()
    .from('schedule')
    .upsert(
      {
        day: item.day,
        day_order: dayOrder(item.day),
        anime_id: item.anime_id,
        title: item.title,
        poster: item.poster ?? null,
        url: item.url ?? null,
      },
      { onConflict: 'day,anime_id', ignoreDuplicates: true }
    )
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) === 1
}

/** Insert satu donghua. Return true jika baris BARU. */
export async function insertDonghua(item) {
  const { data, error } = await supabase()
    .from('donghua')
    .upsert(
      {
        source: item.source,
        slug: item.slug,
        title: item.title,
        poster: item.poster ?? null,
        status: item.status ?? null,
        type: item.type ?? null,
        current_episode: item.current_episode ?? null,
      },
      { onConflict: 'source,slug', ignoreDuplicates: true }
    )
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) === 1
}

/** Insert satu jadwal donghua. Return true jika baris BARU. */
export async function insertDonghuaSchedule(item) {
  const { data, error } = await supabase()
    .from('donghua_schedule')
    .upsert(
      {
        day: item.day,
        day_order: dayOrder(item.day),
        slug: item.slug,
        title: item.title,
        poster: item.poster ?? null,
        url: item.url ?? null,
        eps: item.eps ?? null,
      },
      { onConflict: 'day,slug', ignoreDuplicates: true }
    )
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) === 1
}

function paginate(query, page, limit) {
  return query.range((page - 1) * limit, page * limit - 1)
}

/** List anime, sort terbaru dulu. Return { total, page, limit, rows }. */
export async function listAnime({ source, q, page = 1, limit = 50 } = {}) {
  let query = supabase().from('home').select('*', { count: 'exact' })
  if (source) query = query.eq('source', source)
  if (q) query = query.ilike('title', `%${q}%`)
  query = query.order('scraped_at', { ascending: false }).order('id', { ascending: false })
  const { data, error, count } = await paginate(query, page, limit)
  if (error) throw error
  return { total: count ?? 0, page, limit, rows: data ?? [] }
}

/** List jadwal anime, urut hari Senin..Minggu. */
export async function listSchedule({ day, q, page = 1, limit = 100 } = {}) {
  let query = supabase().from('schedule').select('*', { count: 'exact' })
  if (day) query = query.eq('day', day)
  if (q) query = query.ilike('title', `%${q}%`)
  query = query.order('day_order', { ascending: true }).order('title', { ascending: true })
  const { data, error, count } = await paginate(query, page, limit)
  if (error) throw error
  return { total: count ?? 0, page, limit, rows: data ?? [] }
}

/** List donghua, sort terbaru dulu. */
export async function listDonghua({ q, page = 1, limit = 50 } = {}) {
  let query = supabase().from('donghua').select('*', { count: 'exact' })
  if (q) query = query.ilike('title', `%${q}%`)
  query = query.order('scraped_at', { ascending: false }).order('id', { ascending: false })
  const { data, error, count } = await paginate(query, page, limit)
  if (error) throw error
  return { total: count ?? 0, page, limit, rows: data ?? [] }
}

/** List jadwal donghua, urut hari Senin..Minggu. */
export async function listDonghuaSchedule({ day, q, page = 1, limit = 200 } = {}) {
  let query = supabase().from('donghua_schedule').select('*', { count: 'exact' })
  if (day) query = query.eq('day', day)
  if (q) query = query.ilike('title', `%${q}%`)
  query = query.order('day_order', { ascending: true }).order('title', { ascending: true })
  const { data, error, count } = await paginate(query, page, limit)
  if (error) throw error
  return { total: count ?? 0, page, limit, rows: data ?? [] }
}

// ---- Detail, stream cache, statistik (cerminan db.js) ----

function safeJson(s, fallback) {
  try {
    return s ? JSON.parse(s) : fallback
  } catch {
    return fallback
  }
}

/** Ambil detail anime dari DB (null bila belum ada). */
export async function getAnimeDetail(animeId) {
  const { data, error } = await supabase()
    .from('anime_detail')
    .select('*')
    .eq('anime_id', animeId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    synopsis: safeJson(data.synopsis, { paragraphs: [], connections: [] }),
    genres: safeJson(data.genres, []),
    episode_list: safeJson(data.episode_list, []),
  }
}

/** Simpan / update detail anime (dari form edit). */
export async function saveAnimeDetail(animeId, d) {
  const str = (v) => (v == null ? '' : String(v))
  const js = (v) => JSON.stringify(v ?? [])
  const { error } = await supabase()
    .from('anime_detail')
    .upsert(
      {
        anime_id: animeId,
        title: str(d.title),
        poster: str(d.poster),
        japanese: str(d.japanese),
        score: str(d.score),
        producers: str(d.producers),
        type: str(d.type),
        status: str(d.status),
        episodes: str(d.episodes),
        duration: str(d.duration),
        aired: str(d.aired),
        studios: str(d.studios),
        synopsis: typeof d.synopsis === 'string' ? d.synopsis : js(d.synopsis),
        genres: js(d.genres),
        episode_list: js(d.episode_list),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'anime_id' }
    )
  if (error) throw error
}

/** Ambil URL stream tersimpan ('…' bila kosong). */
export async function getStreamUrl(serverId) {
  const { data, error } = await supabase()
    .from('stream_cache')
    .select('url')
    .eq('server_id', serverId)
    .maybeSingle()
  if (error) throw error
  return data?.url || ''
}

/** Simpan URL stream (upsert). */
export async function saveStreamUrl(serverId, url) {
  const { error } = await supabase().from('stream_cache').upsert(
    { server_id: serverId, url, fetched_at: new Date().toISOString() },
    { onConflict: 'server_id' }
  )
  if (error) throw error
}

/** Ambil detail donghua dari DB (null bila belum ada). */
export async function getDonghuaDetail(slug) {
  const { data, error } = await supabase()
    .from('donghua_detail')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    genres: safeJson(data.genres, []),
    episodes_list: safeJson(data.episodes_list, []),
  }
}

/** Simpan / update detail donghua. */
export async function saveDonghuaDetail(slug, d) {
  const str = (v) => (v == null ? '' : String(v))
  const js = (v) => JSON.stringify(v ?? [])
  const { error } = await supabase()
    .from('donghua_detail')
    .upsert(
      {
        slug,
        title: str(d.title),
        poster: str(d.poster),
        cover: str(d.cover),
        status: str(d.status),
        type: str(d.type),
        rating: str(d.rating),
        studio: str(d.studio),
        network: str(d.network),
        released: str(d.released),
        duration: str(d.duration),
        episodes_count: str(d.episodes_count),
        season: str(d.season),
        country: str(d.country),
        subber: str(d.subber),
        genres: js(d.genres),
        synopsis: typeof d.synopsis === 'string' ? d.synopsis : js(d.synopsis),
        episodes_list: js(d.episodes_list),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )
  if (error) throw error
}

/** Ambil data stream donghua tersimpan (null bila belum ada). */
export async function getDonghuaStream(slug) {
  const { data, error } = await supabase()
    .from('donghua_stream')
    .select('data')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return safeJson(data?.data, null)
}

/** Simpan data stream donghua (upsert). */
export async function saveDonghuaStream(slug, data) {
  const { error } = await supabase().from('donghua_stream').upsert(
    { slug, data: JSON.stringify(data), fetched_at: new Date().toISOString() },
    { onConflict: 'slug' }
  )
  if (error) throw error
}

/** Statistik per sumber (untuk /api/stats). */
export async function stats() {
  const { data, error } = await supabase().from('home').select('source, scraped_at')
  if (error) throw error
  const map = new Map()
  for (const r of data ?? []) {
    const e = map.get(r.source) ?? { source: r.source, total: 0, last_scrape: null }
    e.total++
    if (!e.last_scrape || r.scraped_at > e.last_scrape) e.last_scrape = r.scraped_at
    map.set(r.source, e)
  }
  return [...map.values()]
}

async function count(table) {
  // pakai '*' karena tidak semua tabel punya kolom 'id' (ada yang PK-nya anime_id/server_id/slug)
  const { count, error } = await supabase().from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

/** Ringkasan angka untuk halaman Dashboard. */
export async function dashboardStats() {
  const [homeTotal, detailTotal, schedTotal, donghuaTotal, donghuaDetailTotal, streamTotal, donghuaStreamTotal] =
    await Promise.all([
      count('home'),
      count('anime_detail'),
      count('schedule'),
      count('donghua'),
      count('donghua_detail'),
      count('stream_cache'),
      count('donghua_stream'),
    ])
  const bySource = await stats()
  bySource.sort((a, b) => b.total - a.total)
  const { data: schedRows, error: schedErr } = await supabase().from('schedule').select('day')
  if (schedErr) throw schedErr
  const dayMap = new Map()
  for (const r of schedRows ?? []) dayMap.set(r.day, (dayMap.get(r.day) ?? 0) + 1)
  const { data: recent, error: recentErr } = await supabase()
    .from('home')
    .select('source, title, episodes, scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(8)
  if (recentErr) throw recentErr
  return {
    anime: { total: homeTotal, details: detailTotal, bySource },
    schedule: {
      total: schedTotal,
      byDay: [...dayMap.entries()].map(([day, total]) => ({ day, total })),
    },
    donghua: { total: donghuaTotal, details: donghuaDetailTotal },
    streams: { anime: streamTotal, donghua: donghuaStreamTotal },
    recent: recent ?? [],
  }
}

/** Ambil data episode tersimpan (null bila belum ada). */
export async function getEpisodeCache(episodeId) {
  const { data, error } = await supabase()
    .from('episode_cache')
    .select('data')
    .eq('episode_id', episodeId)
    .maybeSingle()
  if (error) throw error
  return safeJson(data?.data, null)
}

/** Simpan data episode (daftar server per kualitas) — upsert. */
export async function saveEpisodeCache(episodeId, data) {
  const { error } = await supabase().from('episode_cache').upsert(
    { episode_id: episodeId, data: JSON.stringify(data), fetched_at: new Date().toISOString() },
    { onConflict: 'episode_id' }
  )
  if (error) throw error
}
