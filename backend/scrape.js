/**
 * Scraper: ambil data dari API 168.110.213.108/otakudesu, normalisasi,
 * simpan ke database "home". Duplikat (source + anime_id) dilewati.
 *
 * Field URL eksternal (samehadakuUrl / otakudesuUrl / url situs)
 * SENGAJA tidak disimpan — sesuai permintaan.
 */

export const SOURCES = {
  animehome: {
    label: 'Otaku',
    url: 'http://168.110.213.108/otakudesu/home',
  },
  animebrowse: {
    label: 'Browse',
    url: 'http://168.110.213.108/otakudesu/anime',
  },
}

export const SCHEDULE_SOURCE = {
  key: 'schedule',
  label: 'Jadwal',
  url: 'http://168.110.213.108/otakudesu/schedule',
}

const clean = (s) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''

function normalizeAnimeHome(json) {
  const out = []
  const data = json?.data ?? {}
  // Kumpulkan semua animeList dari tiap section (ongoing, completed, dll).
  for (const section of Object.values(data)) {
    const list = section?.animeList
    if (!Array.isArray(list)) continue
    for (const a of list) {
      if (!a?.animeId) continue
      out.push({
        source: 'animehome',
        anime_id: String(a.animeId),
        title: clean(a.title),
        poster: a.poster || '',
        episodes:
          a.episodes === '' || a.episodes == null ? '' : `Ep ${a.episodes}`,
        released_on: clean(a.latestReleaseDate),
        release_day: clean(a.releaseDay),
        type: '',
        href: a.href || '',
        // otakudesuUrl TIDAK disimpan.
      })
    }
  }
  return out
}

function normalizeAnimeBrowse(json) {
  // /otakudesu/anime: data.list = grup alfabet [{startWith, animeList}].
  const out = []
  const groups = json?.data?.list
  if (!Array.isArray(groups)) return out
  for (const g of groups) {
    const list = g?.animeList
    if (!Array.isArray(list)) continue
    for (const a of list) {
      if (!a?.animeId) continue
      out.push({
        source: 'animebrowse',
        anime_id: String(a.animeId),
        title: clean(a.title),
        poster: '',
        episodes: '',
        released_on: '',
        release_day: '',
        type: '',
        href: '',
        // otakudesuUrl TIDAK disimpan.
      })
    }
  }
  return out
}

const NORMALIZERS = {
  animehome: normalizeAnimeHome,
  animebrowse: normalizeAnimeBrowse,
}

export async function scrapeSource(key, insertFn) {
  const src = SOURCES[key]
  if (!src) throw new Error(`Sumber tidak dikenal: ${key}`)
  const res = await fetch(src.url, {
    headers: {
      'User-Agent': 'AnimeDongAdmin/1.0',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${src.url}`)
  const json = await res.json()
  const items = NORMALIZERS[key](json)
  let inserted = 0
  for (const item of items) {
    if (!item.title) continue
    if (insertFn(item)) inserted++
  }
  return { source: key, total: items.length, inserted, skipped: items.length - inserted }
}

/** Scrape jadwal rilisan per hari. Simpan ke tabel `schedule`. */
export async function scrapeSchedule(insertFn) {
  const res = await fetch(SCHEDULE_SOURCE.url, {
    headers: {
      'User-Agent': 'AnimeDongAdmin/1.0',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${SCHEDULE_SOURCE.url}`)
  const json = await res.json()
  const days = json?.data?.scheduleList ?? json?.data
  if (!Array.isArray(days)) throw new Error('Format jadwal tidak dikenali')
  let total = 0
  let inserted = 0
  for (const d of days) {
    const list = d?.animeList ?? d?.anime_list
    if (!Array.isArray(list)) continue
    for (const a of list) {
      const slug = a?.animeId ?? a?.slug
      if (!slug) continue
      total++
      // Format baru: tanpa poster/url; otakudesuUrl TIDAK disimpan (URL eksternal).
      if (
        insertFn({
          day: clean(d.title ?? d.day),
          anime_id: String(slug),
          title: clean(a.title),
          poster: a.poster || '',
          url: a.url || '',
        })
      )
        inserted++
    }
  }
  return { source: 'schedule', total, inserted, skipped: total - inserted }
}

const API_BASE = 'http://168.110.213.108'

async function fetchUpstream(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'User-Agent': 'AnimeDongAdmin/1.0',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${path}`)
  const json = await res.json()
  if (!json?.data) throw new Error('Data tidak ditemukan')
  return json.data
}

const stripExternalUrls = (obj) => {
  if (Array.isArray(obj)) return obj.map(stripExternalUrls)
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (['otakudesuUrl', 'samehadakuUrl', 'anichinUrl', 'href'].includes(k)) continue
      out[k] = stripExternalUrls(v)
    }
    return out
  }
  return obj
}

/** Ambil detail anime dari API upstream (tanpa URL eksternal). */
export async function fetchAnimeDetail(animeId) {
  const raw = await fetchUpstream(`/otakudesu/anime/${encodeURIComponent(animeId)}`)
  const data = stripExternalUrls(raw.details ?? raw)
  const syn = data.synopsis ?? {}
  const synopsis = Array.isArray(syn.paragraphs)
    ? syn
    : { paragraphs: syn.paragraphList ?? [], connections: [] }
  return {
    anime_id: animeId,
    title: clean(data.title),
    poster: data.poster || '',
    japanese: clean(data.japanese),
    score: clean(String(data.score ?? '')),
    producers: clean(data.producers),
    type: clean(data.type),
    status: clean(data.status),
    episodes: data.episodes == null ? '' : String(data.episodes),
    duration: clean(data.duration),
    aired: clean(data.aired),
    studios: clean(data.studios),
    synopsis,
    genres: (data.genreList ?? []).map((g) => ({
      title: clean(g.title),
      genreId: g.genreId || '',
    })),
    episode_list: (data.episodeList ?? []).map((e) => ({
      title: clean(e.title),
      eps: e.eps ?? '',
      date: clean(e.date),
      episodeId: e.episodeId || '',
      href: e.href || '',
    })),
  }
}

/** Ambil data episode (daftar server per kualitas + defaultStreamingUrl). */
export async function fetchEpisode(episodeId) {
  const raw = await fetchUpstream(`/otakudesu/episode/${encodeURIComponent(episodeId)}`)
  const d = stripExternalUrls(raw.details ?? raw)
  const server = d.server ?? {}
  return {
    ...d,
    defaultStreamingUrl: d.defaultStreamingUrl || '',
    server: {
      ...server,
      qualities: server.qualities ?? server.qualityList ?? [],
    },
  }
}

/** Ambil URL stream dari sebuah serverId. */
export async function fetchServer(serverId) {
  const d = await fetchUpstream(`/otakudesu/server/${encodeURIComponent(serverId)}`)
  const det = d.details ?? d
  return { url: det?.url || '' }
}

// ---- Donghua (API baru: 168.110.213.108/donghua) ----

const DONGHUA_API_BASE = 'http://168.110.213.108/donghua'

export const DONGHUA_SOURCES = {
  donghua: {
    label: 'Donghua',
    url: `${DONGHUA_API_BASE}/`,
  },
}

export const DONGHUA_SCHEDULE_SOURCE = {
  key: 'donghua-schedule',
  label: 'Jadwal Donghua',
  url: `${DONGHUA_API_BASE}/schedule`,
}

async function fetchDonghuaUpstream(path) {
  const res = await fetch(`${DONGHUA_API_BASE}${path}`, {
    headers: {
      'User-Agent': 'AnimeDongAdmin/1.0',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${path}`)
  const json = await res.json()
  if (!json || json.status === 'error') throw new Error('Data tidak ditemukan')
  return json
}

// Kartu home adalah kartu EPISODE: slug = "{serial}-episode-{n}-subtitle-indonesia".
// Turunkan slug serial-nya; untuk movie ("{judul}-subtitle-indonesia") pakai
// fallback potong suffix. URL situs asli (anichin.moe) TIDAK disimpan.
const EP_SLUG_RE = /^(.*)-episode-\d+-subtitle-indonesia$/
function seriesSlugFromCard(cardSlug) {
  const s = String(cardSlug || '')
  const m = s.match(EP_SLUG_RE)
  if (m) return m[1]
  return s.replace(/-subtitle-indonesia?$/, '')
}

function normalizeDonghuaCards(json) {
  const sections = json?.results
  if (!Array.isArray(sections)) return []
  const cards = sections
    .filter((sec) => sec?.section === 'rilisan_terbaru')
    .flatMap((sec) => sec.cards ?? [])
  const seen = new Set()
  const items = []
  for (const c of cards) {
    const slug = seriesSlugFromCard(c?.slug)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    items.push({
      source: 'donghua',
      slug,
      title: clean(c.title),
      poster: c.thumbnail || '',
      status: '',
      type: clean(c.type),
      current_episode: c.eps != null ? `Episode ${c.eps}` : '',
    })
  }
  return items
}

/**
 * Scrape daftar donghua dari halaman 1..27 (section rilisan_terbaru).
 * Berhenti lebih awal bila sebuah halaman tidak mengembalikan kartu.
 */
export async function scrapeDonghua(insertFn) {
  const MAX_PAGE = 27
  let total = 0
  let inserted = 0
  for (let page = 1; page <= MAX_PAGE; page++) {
    const json = await fetchDonghuaUpstream(`/?page=${page}`)
    const items = normalizeDonghuaCards(json)
    if (items.length === 0) break
    total += items.length
    for (const item of items) {
      if (!item.title) continue
      if (insertFn(item)) inserted++
    }
    if (page < MAX_PAGE) await new Promise((r) => setTimeout(r, 300))
  }
  return { source: 'donghua', total, inserted, skipped: total - inserted }
}

/** Ambil detail donghua dari API upstream. */
export async function fetchDonghuaDetail(slug) {
  const json = await fetchDonghuaUpstream(`/${encodeURIComponent(slug)}`)
  const d = json?.result
  if (!d) throw new Error('Data tidak ditemukan')
  const paragraphs = d.sinopsis?.paragraphs
  return {
    slug,
    title: clean(d.name),
    poster: d.thumbnail || '',
    cover: '',
    status: clean(d.status),
    type: clean(d.tipe),
    rating: d.rating == null ? '' : String(d.rating),
    studio: clean(d.studio),
    network: clean(d.network),
    released: clean(d.tanggal_rilis),
    duration: clean(d.durasi),
    episodes_count: Array.isArray(d.episode) ? String(d.episode.length) : '',
    season: clean(d.season),
    country: clean(d.negara),
    subber: clean(d.subber),
    genres: (d.genre ?? []).map((g) => ({
      title: clean(typeof g === 'string' ? g : g.name),
      genreId: '',
    })),
    synopsis: Array.isArray(paragraphs) ? paragraphs.join('\n\n') : clean(d.sinopsis),
    episodes_list: (d.episode ?? []).map((e) => ({
      title: clean(e.subtitle || e.name),
      eps: e.episode == null ? '' : String(e.episode),
      date: clean(e.date),
      slug: e.slug || '',
    })),
  }
}

/** Ambil daftar server streaming sebuah episode donghua (URL embed langsung). */
export async function fetchDonghuaEpisode(slug) {
  const json = await fetchDonghuaUpstream(`/episode/${encodeURIComponent(slug)}`)
  const d = json?.result
  if (!d) throw new Error('Data tidak ditemukan')
  const players = Array.isArray(d.players) ? d.players : []
  const servers = players
    .filter((p) => p?.url)
    .map((p) => ({ name: clean(p.name), url: p.url }))
  return {
    episode: clean(d.name),
    main_url: servers[0]?.url ?? null,
    servers,
  }
}

const DONGHUA_DAY_FIX = { "Jum'at": 'Jumat' }

/** Scrape jadwal donghua Senin..Minggu. Simpan ke tabel `donghua_schedule`. */
export async function scrapeDonghuaSchedule(insertFn) {
  const json = await fetchDonghuaUpstream('/schedule')
  const days = json?.results
  if (!Array.isArray(days)) throw new Error('Format jadwal tidak dikenal')
  let total = 0
  let inserted = 0
  for (const d of days) {
    const day = DONGHUA_DAY_FIX[d.day] || d.day
    for (const it of d.items ?? []) {
      if (!it?.slug) continue
      total++
      // URL situs asli (anichin.moe) TIDAK disimpan — pakai slug sebagai identitas.
      const item = {
        day,
        slug: String(it.slug),
        title: clean(it.title),
        poster: it.thumbnail || '',
        url: '',
        eps: it.eps != null ? String(it.eps) : '',
      }
      if (insertFn(item)) inserted++
    }
  }
  return { source: 'donghua-schedule', total, inserted, skipped: total - inserted }
}
