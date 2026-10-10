// Backfill + sync berkala: upload semua kolom poster/cover yang belum di R2.
// Dipakai dua cara:
//   1. CLI: node r2-sync.js
//   2. Dipanggil background dari server.js sehabis scrape.
// Idempoten: baris yang posternya sudah URL R2 dilewati.
import { db } from './db.js'
import { uploadImage, r2Enabled, r2PublicBase } from './r2.js'

// table, pk, kolom tambahan untuk key, kolom gambar
const TARGETS = [
  { table: 'home', pk: 'id', cols: ['poster'], key: (r) => `posters/${r.source}/${r.anime_id}` },
  { table: 'schedule', pk: 'id', cols: ['poster'], key: (r) => `posters/schedule/${r.id}` },
  { table: 'anime_detail', pk: 'anime_id', cols: ['poster'], key: (r) => `posters/anime-detail/${r.anime_id}` },
  { table: 'donghua', pk: 'id', cols: ['poster'], key: (r) => `posters/${r.source}/${r.slug}` },
  {
    table: 'donghua_detail', pk: 'slug', cols: ['poster', 'cover'],
    key: (r, col) => (col === 'cover' ? `covers/donghua/${r.slug}` : `posters/donghua-detail/${r.slug}`),
  },
  { table: 'donghua_schedule', pk: 'id', cols: ['poster'], key: (r) => `posters/donghua-schedule/${r.id}` },
]

export async function syncPostersToR2() {
  if (!r2Enabled()) throw new Error('R2 belum dikonfigurasi (cek env R2_*)')
  const base = r2PublicBase()
  let total = 0
  let uploaded = 0
  for (const t of TARGETS) {
    const selectCols = ['*'].join(', ')
    let rows
    try {
      rows = db.prepare(`SELECT ${selectCols} FROM ${t.table}`).all()
    } catch {
      continue // tabel belum ada, lewati
    }
    for (const r of rows) {
      for (const col of t.cols) {
        const cur = r[col]
        if (!cur || cur.startsWith(base)) continue
        total++
        const url = await uploadImage(cur, t.key(r, col))
        if (url && url !== cur) {
          db.prepare(`UPDATE ${t.table} SET ${col} = ? WHERE ${t.pk} = ?`).run(url, r[t.pk])
          uploaded++
        }
      }
    }
    console.log(`[r2] ${t.table}: selesai`)
  }
  return { total, uploaded }
}

const isCLI = process.argv[1]?.endsWith('r2-sync.js')
if (isCLI) {
  try {
    const res = await syncPostersToR2()
    console.log(`selesai: ${res.uploaded}/${res.total} gambar pindah ke R2`)
  } catch (e) {
    console.error('gagal:', e.message)
    process.exit(1)
  }
}
