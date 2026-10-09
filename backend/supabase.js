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
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_KEY belum di-set. ' +
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
