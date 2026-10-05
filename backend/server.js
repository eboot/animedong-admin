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
  stats,
} from './db.js'
import {
  SOURCES,
  SCHEDULE_SOURCE,
  scrapeSource,
  scrapeSchedule,
  fetchAnimeDetail,
  fetchEpisode,
  fetchServer,
} from './scrape.js'

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
app.get('/api/home', (req, res) => {
  const { source, q, page, limit } = req.query
  if (source && !SOURCES[source]) {
    return res.status(400).json({ error: `Sumber tidak dikenal: ${source}` })
  }
  res.json(
    listAnime({
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
      error: 'Pilih sumber dulu: animehome | samehadaku | anoboy | animeindo | schedule',
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
app.get('/api/schedule', (req, res) => {
  const { day, q, page, limit } = req.query
  res.json(
    listSchedule({
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
    const saved = getAnimeDetail(animeId)
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
app.put('/api/anime/:animeId', (req, res) => {
  const { animeId } = req.params
  const d = req.body ?? {}
  if (!d.title) return res.status(400).json({ error: 'Judul wajib diisi' })
  saveAnimeDetail(animeId, d)
  res.json({ ok: true, data: getAnimeDetail(animeId) })
})

// Data episode (daftar server per kualitas) — live dari API
app.get('/api/episode/:episodeId', async (req, res) => {
  try {
    const data = await fetchEpisode(req.params.episodeId)
    res.json({ ok: true, data })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

// URL stream dari sebuah serverId — live dari API
app.get('/api/server/:serverId', async (req, res) => {
  try {
    const data = await fetchServer(req.params.serverId)
    res.json({ ok: true, data })
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message })
  }
})

app.get('/api/stats', (req, res) => {
  res.json(stats())
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
})
