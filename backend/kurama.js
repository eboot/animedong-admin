// Integrasi animeapi (KuramaAnime scraper) sebagai sumber data anime.
//
// Arsitektur: animedong-admin TIDAK menyimpan data kurama di database-nya
// sendiri. Scrape di-trigger ke animeapi (datanya masuk ke database animeapi,
// yaitu Supabase), dan dashboard membaca langsung dari animeapi lewat fungsi
// di file ini (node sebagai perantara, browser tidak hit animeapi langsung).
//
// Env: KURAMA_API_URL (default http://127.0.0.1:3002)

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

export const kuramaBase = () =>
  (process.env.KURAMA_API_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '')

/**
 * Trigger scrape di animeapi. Data masuk ke database animeapi (Supabase).
 * @returns hasil mentah dari animeapi {ok, results}
 */
export async function scrapeKurama(n = 10) {
  const base = kuramaBase()
  if (!(n > 0)) return { ok: true, results: [], skipped: true }
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
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `animeapi scrape HTTP ${res.status}`)
  return body
}

/**
 * List anime langsung dari database animeapi, dalam format baris yang sama
 * seperti /api/home supaya tabel dashboard bisa pakai langsung.
 */
export async function fetchKuramaList({ page = 1, limit = 20, q = '' } = {}) {
  const base = kuramaBase()
  const params = new URLSearchParams({
    page: String(Math.max(1, parseInt(page) || 1)),
    limit: String(Math.min(200, Math.max(1, parseInt(limit) || 20))),
  })
  if (q) params.set('q', q)
  let res
  try {
    res = await fetch(`${base}/api/anime?${params}`)
  } catch (e) {
    throw new Error(`animeapi tidak terjangkau di ${base}: ${e.message}`)
  }
  if (!res.ok) throw new Error(`animeapi HTTP ${res.status}`)
  const json = await res.json()
  const rows = (json.rows ?? [])
    .filter((a) => clean(a.title))
    .map((a) => ({
      anime_id: String(a.id),
      title: clean(a.title),
      poster: a.poster || '',
      source: 'kurama',
      episodes: a.episodes_count ? `Ep ${a.episodes_count}` : '',
      released_on: clean(a.aired),
      scraped_at: a.scraped_at || '',
    }))
  return {
    rows,
    total: json.total ?? rows.length,
    page: json.page ?? 1,
    limit: json.limit ?? rows.length,
  }
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
