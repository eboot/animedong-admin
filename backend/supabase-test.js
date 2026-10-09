// Tes koneksi Supabase: node supabase-test.js
// Butuh env SUPABASE_URL dan SUPABASE_SERVICE_KEY.
import { supabase, insertSchedule, listSchedule } from './supabase.js'

try {
  void supabase()
  console.log('[ok] konek ke Supabase')

  const isNew = await insertSchedule({
    day: 'Senin',
    anime_id: '__test__',
    title: '__Test Koneksi__',
    poster: null,
    url: null,
  })
  console.log('[ok] insert test:', isNew ? 'baris baru' : 'sudah ada (dilewati)')

  const res = await listSchedule({ q: '__Test Koneksi__' })
  console.log('[ok] listSchedule total:', res.total)

  // Bersihkan baris test
  const { error } = await supabase().from('schedule').delete().eq('anime_id', '__test__')
  if (error) throw error
  console.log('[ok] baris test dibersihkan — integrasi jalan')
} catch (e) {
  console.error('[gagal]', e.message)
  process.exit(1)
}
