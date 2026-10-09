// BRANCH supabase: backend ini baca/tulis ke Supabase (PostgreSQL),
// bukan SQLite lokal. Butuh env SUPABASE_URL + SUPABASE_SECRET_KEY.
import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  insertAnime,
  insertSchedule,
  listAnime,
  listSchedule,
  getAnimeDetail,
  saveAnimeDetail,
  getStreamUrl,
  saveStreamUrl,
  insertDonghua,
  listDonghua,
  getDonghuaDetail,
  saveDonghuaDetail,
  getDonghuaStream,
  saveDonghuaStream,
  insertDonghuaSchedule,
  listDonghuaSchedule,
  stats,
  dashboardStats,
} from './supabase.js'
import {
  SOURCES,
  SCHEDULE_SOURCE,
  DONGHUA_SOURCES,
  DONGHUA_SCHEDULE_SOURCE,
  scrapeSource,
  scrapeSchedule,
  scrapeDonghua,
  scrapeDonghuaSchedule,
  fetchAnimeDetail,
  fetchEpisode,
  fetchServer,
  fetchDonghuaDetail,
  fetchDonghuaEpisode,
} from './scrape.js'
import {
  startScheduler,
  getSchedulerStatus,
  runAllSchedulesNow,
} from './scheduler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Daftar sumber API yang tersedia (untuk dropdown frontend)
app.get('/api/sources', (req, res) => {
  res.json(
    Object.entries(SOURCES).map(([key, s]) => ({
      key,
      label: s.label,
      url: s.url,
    }))
  )
})

// List anime yang sudah di-scrape, sort terbaru dulu
app.get('/api/home', async (req, res) => {
  const { source, q, page, limit } = req.query
  if (source && !SOURCES[source]) {
    return res.status(400).json({ error: `Sumber tidak dikenal: ${source}` })
  }
  res.json(
    await listAnime({
      source: source || undefined,
      q: q || undefined,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(200, Math.max(1, parseInt(limit) || 50)),
    })
  )
})

// Scrape + simpan ke database "home" (duplikat dilewati).
// Body: { source } — boleh berupa key (animehome) atau URL API-nya langsung.
app.post('/api/scrape', async (req, res) => {
  let { source } = req.body ?? {}
  if (source === 'schedule' || source === SCHEDULE_SOURCE.url) {
    try {
      const result = await scrapeSchedule(insertSchedule)
      return res.json({ ok: true, ...result })
    } catch (e) {
      return res.status(502).json({ ok: false, error: e.message })
    }
  }
  const key =
    SOURCES[source]
      ? source
      : Object.keys(SOURCES).find((k) => SOURCES[k].url === source)
  if (!key) {
    return res.status(400).json({
      error: 'Pilih sumber dulu: animehome | animebrowse | schedule',
    })
  }
  try {
    const result = await scrapeSource(key, insertAnime)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// List jadwal rilisan, urut hari Senin..Minggu
app.get('/api/schedule', async (req, res) => {
  const { day, q, page, limit } = req.query
  res.json(
    await listSchedule({
      day: day || undefined,
      q: q || undefined,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(500, Math.max(1, parseInt(limit) || 100)),
    })
  )
})

// Detail anime: dari database bila ada, bila belum — ambil live dari API.
// Param ?fresh=1 memaksa ambil live walau sudah ada di database.
app.get('/api/anime/:animeId', async (req, res) => {
  const { animeId } = req.params
  if (!req.query.fresh) {
    const saved = await getAnimeDetail(animeId)
    if (saved) return res.json({ from: 'db', data: saved })
  }
  try {
    const data = await fetchAnimeDetail(animeId)
    res.json({ from: 'live', data })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// Simpan / update detail anime (dari form edit)
app.put('/api/anime/:animeId', async (req, res) => {
  const { animeId } = req.params
  const d = req.body ?? {}
  if (!d.title) return res.status(400).json({ error: 'Judul wajib diisi' })
  await saveAnimeDetail(animeId, d)
  res.json({ ok: true, data: await getAnimeDetail(animeId) })
})

// Data episode (daftar server per kualitas) — live dari API.
// defaultStreamingUrl ikut disimpan ke stream_cache.
app.get('/api/episode/:episodeId', async (req, res) => {
  try {
    const data = await fetchEpisode(req.params.episodeId)
    if (data?.defaultStreamingUrl)
      await saveStreamUrl(`episode:${req.params.episodeId}`, data.defaultStreamingUrl)
    res.json({ ok: true, data })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// URL stream dari sebuah serverId — dari database bila sudah tersimpan,
// kalau belum baru ambil live dari API lalu simpan. ?fresh=1 memaksa ambil live.
app.get('/api/server/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params
    if (!req.query.fresh) {
      const cached = await getStreamUrl(serverId)
      if (cached) return res.json({ ok: true, data: { url: cached }, cached: true })
    }
    const data = await fetchServer(serverId)
    if (data?.url) await saveStreamUrl(serverId, data.url)
    res.json({ ok: true, data, cached: false })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

app.get('/api/stats', async (req, res) => {
  res.json(await stats())
})

// Status + trigger manual auto-refresh jadwal (scheduler)
app.get('/api/scheduler/status', (req, res) => {
  res.json({ ok: true, data: getSchedulerStatus() })
})
app.post('/api/scheduler/run', async (req, res) => {
  try {
    const result = await runAllSchedulesNow()
    res.json({ ok: true, data: result })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// Ringkasan angka untuk halaman Dashboard
app.get('/api/dashboard', async (req, res) => {
  res.json({ ok: true, data: await dashboardStats() })
})

// ---- Donghua ----

// Daftar sumber API donghua (untuk dropdown frontend)
app.get('/api/donghua/sources', (req, res) => {
  res.json(
    Object.entries(DONGHUA_SOURCES).map(([key, s]) => ({
      key,
      label: s.label,
      url: s.url,
    }))
  )
})

// List donghua yang sudah di-scrape, sort terbaru dulu
app.get('/api/donghua', async (req, res) => {
  const { q, page, limit } = req.query
  res.json(
    await listDonghua({
      q: q || undefined,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(200, Math.max(1, parseInt(limit) || 50)),
    })
  )
})

// Scrape + simpan ke database (duplikat dilewati).
// Body: { source } — key 'donghua' atau URL API-nya langsung.
app.post('/api/donghua/scrape', async (req, res) => {
  const { source } = req.body ?? {}
  const key =
    DONGHUA_SOURCES[source]
      ? source
      : Object.keys(DONGHUA_SOURCES).find((k) => DONGHUA_SOURCES[k].url === source)
  if (!key) {
    return res.status(400).json({ error: 'Pilih sumber dulu: donghua' })
  }
  try {
    const result = await scrapeDonghua(insertDonghua)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// List jadwal donghua yang sudah di-scrape, urut hari Senin..Minggu.
// (Didefinisikan SEBELUM /:slug agar tidak tertelan parameter slug.)
app.get('/api/donghua/schedule', async (req, res) => {
  const { day, q, page, limit } = req.query
  res.json(
    await listDonghuaSchedule({
      day: day || undefined,
      q: q || undefined,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(500, Math.max(1, parseInt(limit) || 200)),
    })
  )
})

// Scrape + simpan jadwal donghua ke database (duplikat dilewati)
app.post('/api/donghua/schedule/scrape', async (req, res) => {
  try {
    const result = await scrapeDonghuaSchedule(insertDonghuaSchedule)
    res.json({ ok: true, ...result, url: DONGHUA_SCHEDULE_SOURCE.url })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// Detail donghua: dari database bila ada, bila belum — ambil live dari API.
// Param ?fresh=1 memaksa ambil live walau sudah ada di database.
app.get('/api/donghua/:slug', async (req, res) => {
  const { slug } = req.params
  if (!req.query.fresh) {
    const saved = await getDonghuaDetail(slug)
    if (saved) return res.json({ from: 'db', data: saved })
  }
  try {
    const data = await fetchDonghuaDetail(slug)
    res.json({ from: 'live', data })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// Simpan / update detail donghua (dari form edit)
app.put('/api/donghua/:slug', async (req, res) => {
  const { slug } = req.params
  const d = req.body ?? {}
  if (!d.title) return res.status(400).json({ error: 'Judul wajib diisi' })
  await saveDonghuaDetail(slug, d)
  res.json({ ok: true, data: await getDonghuaDetail(slug) })
})

// Daftar server streaming sebuah episode donghua — dari database bila sudah
// tersimpan, kalau belum ambil live dari API lalu simpan. ?fresh=1 memaksa live.
app.get('/api/donghua/episode/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    if (!req.query.fresh) {
      const cached = await getDonghuaStream(slug)
      if (cached) return res.json({ ok: true, data: cached, cached: true })
    }
    const data = await fetchDonghuaEpisode(slug)
    await saveDonghuaStream(slug, data)
    res.json({ ok: true, data, cached: false })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// Sajikan build frontend jika ada (npm run build di root -> build/)
const dist = ['dist', 'build']
  .map((d) => join(__dirname, '..', d))
  .find((d) => existsSync(d))
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(join(dist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`AnimeDong Admin API jalan di http://localhost:${PORT}`)
  startScheduler()
})
