// Penjadwal auto-refresh: scrape jadwal anime & donghua otomatis 2x sehari.
// Dipakai agar halaman Jadwal selalu segar tanpa pencet tombol scrape manual.
// Zona waktu: Asia/Makassar (WITA).
import cron from 'node-cron'
import { scrapeSchedule, scrapeDonghuaSchedule } from './scrape.js'
import { insertSchedule, insertDonghuaSchedule } from './db.js'

const TIMEZONE = 'Asia/Makassar'
// Jam 01:00 dan 13:00 WITA setiap hari
const SCHEDULE_CRON = '0 1,13 * * *'

let running = false
const lastRuns = []

function recordRun(name, result) {
  lastRuns.unshift({ name, at: new Date().toISOString(), ...result })
  if (lastRuns.length > 20) lastRuns.length = 20
}

async function runJob(name, scrapeFn, insertFn) {
  if (running) {
    console.log(`[scheduler] ${name}: dilewati, job lain masih jalan`)
    return { ok: false, skipped: true, reason: 'overlap' }
  }
  running = true
  const started = Date.now()
  console.log(`[scheduler] ${name}: mulai`)
  try {
    const result = await scrapeFn(insertFn)
    const out = { ok: true, ms: Date.now() - started, ...result }
    console.log(`[scheduler] ${name}: selesai`, JSON.stringify(result))
    recordRun(name, out)
    return out
  } catch (e) {
    const out = { ok: false, ms: Date.now() - started, error: e.message }
    console.error(`[scheduler] ${name}: gagal:`, e.message)
    recordRun(name, out)
    return out
  } finally {
    running = false
  }
}

export function runAnimeScheduleNow() {
  return runJob('anime-schedule', scrapeSchedule, insertSchedule)
}

export function runDonghuaScheduleNow() {
  return runJob('donghua-schedule', scrapeDonghuaSchedule, insertDonghuaSchedule)
}

export function runAllSchedulesNow() {
  return (async () => {
    const anime = await runAnimeScheduleNow()
    const donghua = await runDonghuaScheduleNow()
    return { anime, donghua }
  })()
}

export function getSchedulerStatus() {
  return {
    enabled: true,
    timezone: TIMEZONE,
    cron: SCHEDULE_CRON,
    jobs: ['anime-schedule', 'donghua-schedule'],
    running,
    lastRuns,
  }
}

export function startScheduler() {
  cron.schedule(
    SCHEDULE_CRON,
    () => {
      console.log('[scheduler] jadwal harian terpicu')
      runAllSchedulesNow()
    },
    { timezone: TIMEZONE }
  )
  console.log(`[scheduler] aktif: ${SCHEDULE_CRON} (${TIMEZONE})`)
}
