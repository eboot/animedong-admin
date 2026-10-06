import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormTextarea,
  CListGroup,
  CListGroupItem,
  CRow,
  CSpinner,
} from '@coreui/react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const UPSTREAM = 'http://168.110.213.108'

const FIELDS = [
  ['title', 'Judul'],
  ['poster', 'Poster (URL)'],
  ['japanese', 'Judul Jepang'],
  ['score', 'Skor'],
  ['producers', 'Produser'],
  ['type', 'Tipe'],
  ['status', 'Status'],
  ['episodes', 'Jumlah Episode'],
  ['duration', 'Durasi'],
  ['aired', 'Tayang'],
  ['studios', 'Studio'],
]

const synopsisToText = (s) => {
  if (!s) return ''
  if (typeof s === 'string') return s
  if (Array.isArray(s.paragraphs)) return s.paragraphs.join('\n\n')
  return ''
}

const genresToText = (g) =>
  Array.isArray(g) ? g.map((x) => x.title || x).join(', ') : ''

const textToGenres = (t) =>
  t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((title) => ({ title, genreId: '' }))

const EpisodeServers = ({ episodeId }) => {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [serverLabel, setServerLabel] = useState('')
  const [serverId, setServerId] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [loadingServer, setLoadingServer] = useState(false)
  const [error, setError] = useState('')

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (data) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/episode/${episodeId}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal memuat episode')
      setData(j.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadServer = async (sid, label, fresh = false) => {
    setLoadingServer(true)
    setServerUrl('')
    setServerLabel(label)
    setServerId(sid)
    setFromCache(false)
    try {
      const res = await fetch(`${API_BASE}/api/server/${sid}${fresh ? '?fresh=1' : ''}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal memuat server')
      setServerUrl(j.data.url)
      setFromCache(!!j.cached)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingServer(false)
    }
  }

  return (
    <div className="mt-2">
      <CButton size="sm" color="secondary" variant="outline" onClick={toggle}>
        {open ? 'Tutup Server' : 'Lihat Server'}
      </CButton>
      {open && (
        <div className="mt-2 p-2 border rounded bg-body-tertiary">
          {loading && <CSpinner size="sm" />}
          {error && <div className="text-danger small">{error}</div>}
          {data?.server?.qualities?.map((q) => (
            <div key={q.title} className="mb-2">
              <strong className="small">{q.title}</strong>
              <div className="d-flex flex-wrap gap-1 mt-1">
                {q.serverList?.map((s) => (
                  <CButton
                    key={s.serverId}
                    size="sm"
                    color="info"
                    variant="outline"
                    onClick={() => loadServer(s.serverId, `${q.title} / ${s.title}`)}
                  >
                    {s.title}
                  </CButton>
                ))}
              </div>
            </div>
          ))}
          {loadingServer && <CSpinner size="sm" />}
          {serverUrl && (
            <div className="mt-2">
              <div className="small text-body-secondary">
                Server {serverLabel}:
                {fromCache && (
                  <CBadge color="success" className="ms-2">
                    tersimpan di database
                  </CBadge>
                )}
              </div>
              <code className="text-break small">{serverUrl}</code>
              <div className="mt-1 d-flex gap-3">
                <a href={serverUrl} target="_blank" rel="noreferrer" className="small">
                  Buka stream
                </a>
                {fromCache && (
                  <a
                    href="#"
                    className="small"
                    onClick={(e) => {
                      e.preventDefault()
                      loadServer(serverId, serverLabel, true)
                    }}
                  >
                    Ambil ulang dari API
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AnimeDetail = () => {
  const { animeId } = useParams()
  const [from, setFrom] = useState('')
  const [form, setForm] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const applyData = useCallback((data, source) => {
    setFrom(source)
    setForm({
      title: data.title || '',
      poster: data.poster || '',
      japanese: data.japanese || '',
      score: data.score || '',
      producers: data.producers || '',
      type: data.type || '',
      status: data.status || '',
      episodes: data.episodes || '',
      duration: data.duration || '',
      aired: data.aired || '',
      studios: data.studios || '',
      synopsis: synopsisToText(data.synopsis),
      genres: genresToText(data.genres),
    })
    setEpisodes(data.episode_list || [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/anime/${animeId}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal memuat detail')
      applyData(j.data, j.from)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [animeId, applyData])

  useEffect(() => {
    load()
  }, [load])

  const fetchLive = async () => {
    setFetching(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API_BASE}/api/anime/${animeId}?fresh=1`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal')
      applyData(j.data, j.from)
      setNotice('Data diambil ulang dari API (belum disimpan — klik Simpan untuk menyimpan).')
    } catch (e) {
      setError(e.message)
    } finally {
      setFetching(false)
    }
  }

  const save = async () => {
    if (!form.title.trim()) {
      setError('Judul wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API_BASE}/api/anime/${animeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          genres: textToGenres(form.genres),
          episode_list: episodes,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan')
      applyData(j.data, 'db')
      setNotice('Tersimpan ke database.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <>
      <CCard className="mb-3">
        <CCardHeader>
          Detail Anime{' '}
          <CBadge color={from === 'db' ? 'success' : 'warning'} className="ms-2">
            {from === 'db' ? 'dari database' : 'dari API (belum disimpan)'}
          </CBadge>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError('')}>
              {error}
            </CAlert>
          )}
          {notice && (
            <CAlert color="success" dismissible onClose={() => setNotice('')}>
              {notice}
            </CAlert>
          )}
          {!form ? (
            <p className="text-body-secondary">Data tidak ditemukan.</p>
          ) : (
            <>
              <CRow>
                <CCol md={3} className="mb-3">
                  {form.poster ? (
                    <img
                      src={form.poster}
                      alt=""
                      className="img-fluid rounded"
                      style={{ maxHeight: 320, objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="text-body-secondary">Tidak ada poster</div>
                  )}
                  <div className="small text-body-secondary mt-2 text-break">
                    anime_id: <code>{animeId}</code>
                  </div>
                </CCol>
                <CCol md={9}>
                  <CRow className="g-2">
                    {FIELDS.map(([k, label]) => (
                      <CCol md={k === 'title' || k === 'poster' ? 12 : 6} key={k}>
                        <CFormInput
                          label={label}
                          value={form[k]}
                          onChange={set(k)}
                        />
                      </CCol>
                    ))}
                    <CCol md={12}>
                      <CFormInput
                        label="Genre (pisahkan koma)"
                        value={form.genres}
                        onChange={set('genres')}
                      />
                    </CCol>
                    <CCol md={12}>
                      <CFormTextarea
                        label="Sinopsis"
                        rows={4}
                        value={form.synopsis}
                        onChange={set('synopsis')}
                      />
                    </CCol>
                  </CRow>
                  <div className="d-flex gap-2 mt-3">
                    <CButton color="primary" onClick={save} disabled={saving}>
                      {saving ? 'Menyimpan...' : 'Simpan ke Database'}
                    </CButton>
                    <CButton
                      color="secondary"
                      variant="outline"
                      onClick={fetchLive}
                      disabled={fetching}
                    >
                      {fetching ? 'Mengambil...' : 'Ambil Ulang dari API'}
                    </CButton>
                  </div>
                  <div className="small text-body-secondary mt-2">
                    Sumber API: {UPSTREAM}/otakudesu/anime/{animeId}
                  </div>
                </CCol>
              </CRow>
            </>
          )}
        </CCardBody>
      </CCard>

      {episodes.length > 0 && (
        <CCard>
          <CCardHeader>Daftar Episode ({episodes.length})</CCardHeader>
          <CCardBody>
            <CListGroup>
              {episodes.map((ep) => (
                <CListGroupItem key={ep.episodeId}>
                  <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div>
                      <CBadge color="primary" className="me-2">
                        Ep {ep.eps}
                      </CBadge>
                      <span>{ep.title}</span>
                      <div className="small text-body-secondary">{ep.date}</div>
                    </div>
                    <a
                      href={`${UPSTREAM}/otakudesu/episode/${ep.episodeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline-primary"
                    >
                      Stream
                    </a>
                  </div>
                  <EpisodeServers episodeId={ep.episodeId} />
                </CListGroupItem>
              ))}
            </CListGroup>
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default AnimeDetail
