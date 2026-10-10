// Integrasi animeapi (KuramaAnime scraper) sebagai sumber data anime.
// Semua scrape data anime lewat API animeapi — animedong-admin tidak lagi
// scraping langsung untuk sumber 'kurama', cukup baca dari animeapi.
//
// Env: KURAMA_API_URL (default http://127.0.0.1:3002)

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

export const kuramaBase = () =>
  (process.env.KURAMA_API_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '')

/** Mapping satu anime animeapi -> baris tabel home (source='kurama'). */
function mapKurama(a) {
  return {
    source: 'kurama',
    anime_id: String(a.id),
    title: clean(a.title),
    poster: a.poster || '',
    episodes: a.episodes_count ? `Ep ${a.episodes_count}` : '',
    released_on: clean(a.aired),
    release_day: '',
    type: clean(a.type),
    href: a.url || '',
  }
}

/**
 * Scrape via animeapi: trigger scrape di animeapi (kecuali n=0),
 * lalu import semua hasilnya ke tabel home.
 * @returns {source, total, inserted, skipped} — format sama seperti scrapeSource.
 */
export async function scrapeKurama(insertFn, n = 10) {
  const base = kuramaBase()
  let triggered = null
  if (n > 0) {
    let res
    try {
      res = await fetch(`${base}/api/scrape/latest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n }),
      })
    } catch (e) {
      throw new Error(`animeapi tidak terjangkau di ${base}: ${e.message}`)
    }
    if (!res.ok) throw new Error(`animeapi scrape HTTP ${res.status}`)
    triggered = await res.json()
  }
  // Import (paginasi) — idempoten, duplikat dilewati insertFn.
  let page = 1
  let total = 0
  let inserted = 0
  for (;;) {
    const res = await fetch(`${base}/api/anime?page=${page}&limit=200`)
    if (!res.ok) throw new Error(`HTTP ${res.status} dari ${base}/api/anime`)
    const json = await res.json()
    const rows = json.rows ?? []
    if (!rows.length) break
    for (const a of rows) {
      const item = mapKurama(a)
      if (!item.title) continue
      total++
      if (insertFn(item)) inserted++
    }
    if (rows.length < 200) break
    page++
  }
  return { source: 'kurama', total, inserted, skipped: total - inserted, triggered }
}

/**
 * Detail satu anime dari animeapi, dalam format yang sama dengan
 * fetchAnimeDetail() (siap untuk saveAnimeDetail / response API).
 */
export async function fetchKuramaDetail(animeId) {
  const base = kuramaBase()
  let res
  try {
    res = await fetch(`${base}/api/anime/${encodeURIComponent(animeId)}`)
  } catch (e) {
    throw new Error(`animeapi tidak terjangkau di ${base}: ${e.message}`)
  }
  if (!res.ok) throw new Error(`animeapi HTTP ${res.status} untuk anime ${animeId}`)
  const json = await res.json()
  const a = json.data ?? {}
  const genres = clean(a.genres)
    ? clean(a.genres)
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
        .map((g) => ({ title: g, genreId: '' }))
    : []
  return {
    anime_id: String(animeId),
    title: clean(a.title),
    poster: a.poster || '',
    japanese: clean(a.alt_titles),
    score: '',
    producers: clean(a.studio),
    type: clean(a.type),
    status: clean(a.status),
    episodes: a.episodes_count == null ? '' : String(a.episodes_count),
    duration: clean(a.duration),
    aired: clean(a.aired),
    studios: clean(a.studio),
    synopsis: { paragraphs: a.synopsis ? [a.synopsis] : [], connections: [] },
    genres,
    episode_list: (a.episodes ?? []).map((e) => ({
      title: clean(e.title) || `Episode ${e.episode_num}`,
      eps: e.episode_num ?? '',
      date: '',
      episodeId: `kurama:${a.id}:${e.episode_num}`,
      href: e.url || '',
    })),
  }
}

/** Cek koneksi ke animeapi (untuk /api/kurama/status). */
export async function kuramaStatus() {
  const base = kuramaBase()
  try {
    const res = await fetch(`${base}/api/stats`)
    if (!res.ok) return { ok: false, base, error: `HTTP ${res.status}` }
    const json = await res.json()
    return { ok: true, base, stats: json.data ?? null }
  } catch (e) {
    return { ok: false, base, error: e.message }
  }
}
