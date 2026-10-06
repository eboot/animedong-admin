/**
 * Scraper: ambil data dari API sankavollerei, normalisasi,
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
  samehadaku: {
    label: 'Samehadaku',
    url: 'https://www.sankavollerei.web.id/anime/samehadaku/home',
  },
  anoboy: {
    label: 'Anoboy',
    url: 'https://www.sankavollerei.web.id/anime/anoboy/home?page=1',
  },
  animeindo: {
    label: 'Animeindo',
    url: 'https://www.sankavollerei.web.id/anime/stream/latest',
  },
}

export const SCHEDULE_SOURCE = {
  key: 'schedule',
  label: 'Jadwal',
  url: 'http://168.110.213.108/otakudesu/schedule',
}

const clean = (s) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''

function normalizeSamehadaku(json) {
  const out = []
  const data = json?.data ?? {}
  // Kumpulkan semua animeList dari tiap section (recent, dll).
  for (const section of Object.values(data)) {
    const list = section?.animeList
    if (!Array.isArray(list)) continue
    for (const a of list) {
      if (!a?.animeId) continue
      out.push({
        source: 'samehadaku',
        anime_id: String(a.animeId),
        title: clean(a.title),
        poster: a.poster || '',
        episodes: clean(a.episodes),
        released_on: clean(a.releasedOn),
        type: '',
        href: a.href || '',
        // samehadakuUrl & otakudesuUrl TIDAK disimpan.
      })
    }
  }
  return out
}

function normalizeAnoboy(json) {
  const list = json?.anime_list
  if (!Array.isArray(list)) return []
  return list
    .filter((a) => a?.slug)
    .map((a) => ({
      source: 'anoboy',
      anime_id: String(a.slug),
      title: clean(a.title),
      poster: a.poster || '',
      episodes: clean(a.episode),
      released_on: '',
      type: clean(a.type),
      href: '',
      // field "url" (link situs anoboy) TIDAK disimpan.
    }))
}

function normalizeAnimeindo(json) {
  const list = json?.data
  if (!Array.isArray(list)) return []
  return list
    .filter((a) => a?.slug)
    .map((a) => ({
      source: 'animeindo',
      anime_id: String(a.slug),
      title: clean(a.title),
      poster: a.poster || '',
      episodes: clean(a.episode) ? `Ep ${clean(a.episode)}` : '',
      released_on: '',
      type: '',
      href: '',
    }))
}

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

const NORMALIZERS = {
  animehome: normalizeAnimeHome,
  samehadaku: normalizeSamehadaku,
  anoboy: normalizeAnoboy,
  animeindo: normalizeAnimeindo,
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
const LEGACY_API_BASE = 'https://www.sankavollerei.web.id'

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

// ---- Donghua ----

export const DONGHUA_SOURCES = {
  donghua: {
    label: 'Donghua',
    url: 'https://www.sankavollerei.web.id/anime/donghua/latest/1',
  },
}

async function fetchDonghuaUpstream(path) {
  const res = await fetch(`${LEGACY_API_BASE}${path}`, {
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

function normalizeDonghua(json) {
  // latest/1 mengembalikan daftar SERIAL (slug serial, bukan per episode).
  // href & anichinUrl TIDAK disimpan — pakai slug sebagai identitas.
  const list = json?.latest_donghua
  if (!Array.isArray(list)) return []
  return list
    .filter((a) => a?.slug)
    .map((a) => ({
      source: 'donghua',
      slug: String(a.slug),
      title: clean(a.title),
      poster: a.poster || '',
      status: clean(a.status),
      type: clean(a.type),
      current_episode: '',
    }))
}

/** Scrape daftar donghua. Simpan ke tabel `donghua`. */
export async function scrapeDonghua(insertFn) {
  const src = DONGHUA_SOURCES.donghua
  const json = await fetchDonghuaUpstream(new URL(src.url).pathname)
  const items = normalizeDonghua(json)
  let inserted = 0
  for (const item of items) {
    if (!item.title) continue
    if (insertFn(item)) inserted++
  }
  return { source: 'donghua', total: items.length, inserted, skipped: items.length - inserted }
}

/** Ambil detail donghua dari API upstream. */
export async function fetchDonghuaDetail(slug) {
  const d = stripExternalUrls(
    await fetchDonghuaUpstream(`/anime/donghua/detail/${encodeURIComponent(slug)}`)
  )
  return {
    slug,
    title: clean(d.title),
    poster: d.poster || '',
    cover: d.cover || '',
    status: clean(d.status),
    type: clean(d.type),
    rating: clean(String(d.rating ?? '')),
    studio: clean(d.studio),
    network: clean(d.network),
    released: clean(d.released),
    duration: clean(d.duration),
    episodes_count: d.episodes_count == null ? '' : String(d.episodes_count),
    season: clean(d.season),
    country: clean(d.country),
    subber: clean(d.subber),
    genres: (d.genres ?? []).map((g) => ({
      title: clean(g.name),
      genreId: g.slug || '',
    })),
    synopsis: clean(d.synopsis),
    episodes_list: (d.episodes_list ?? []).map((e) => ({
      title: clean(e.episode),
      eps: e.episode_number == null ? '' : String(e.episode_number),
      date: clean(e.release_date),
      slug: e.slug || '',
    })),
  }
}

/** Ambil daftar server streaming sebuah episode donghua (URL langsung). */
export async function fetchDonghuaEpisode(slug) {
  const d = stripExternalUrls(
    await fetchDonghuaUpstream(`/anime/donghua/episode/${encodeURIComponent(slug)}`)
  )
  const streaming = d.streaming ?? {}
  const servers = Array.isArray(streaming.servers) ? streaming.servers : []
  return {
    episode: clean(d.episode),
    main_url: streaming.main_url ?? null,
    servers: servers
      .filter((s) => s?.url)
      .map((s) => ({ name: clean(s.name), url: s.url })),
  }
}
