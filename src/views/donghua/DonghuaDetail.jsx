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

const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '')
const UPSTREAM = 'http://168.110.213.108/donghua'

const FIELDS = [
  ['title', 'Judul'],
  ['poster', 'Poster (URL)'],
  ['cover', 'Cover (URL)'],
  ['status', 'Status'],
  ['type', 'Tipe'],
  ['rating', 'Rating'],
  ['studio', 'Studio'],
  ['network', 'Network'],
  ['released', 'Rilis'],
  ['duration', 'Durasi'],
  ['episodes_count', 'Jumlah Episode'],
  ['season', 'Season'],
  ['country', 'Negara'],
  ['subber', 'Subber'],
]

const genresToText = (g) =>
  Array.isArray(g) ? g.map((x) => x.title || x).join(', ') : ''

const textToGenres = (t) =>
  t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((title) => ({ title, genreId: '' }))

const EpisodeStream = ({ slug }) => {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState('')

  const load = async (fresh = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `${API_BASE}/api/donghua/episode/${encodeURIComponent(slug)}${fresh ? '?fresh=1' : ''}`
      )
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal memuat stream')
      setData(j.data)
      setFromCache(!!j.cached)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (data) return
    load(false)
  }

  return (
    <div className="mt-2">
      <CButton size="sm" color="secondary" variant="outline" onClick={toggle}>
        {open ? 'Tutup Stream' : 'Lihat Stream'}
      </CButton>
      {open && (
        <div className="mt-2 p-2 border rounded bg-body-tertiary">
          {loading && <CSpinner size="sm" />}
          {error && <div className="text-danger small">{error}</div>}
          {data && (
            <>
              <div className="small text-body-secondary mb-2">
                Server streaming:
                {fromCache && (
                  <CBadge color="success" className="ms-2">
                    tersimpan di database
                  </CBadge>
                )}
                {fromCache && (
                  <a
                    href="#"
                    className="small ms-2"
                    onClick={(e) => {
                      e.preventDefault()
                      load(true)
                    }}
                  >
                    Ambil ulang dari API
                  </a>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {(data.servers || []).map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-info"
                  >
                    {s.name || `Server ${i + 1}`}
                  </a>
                ))}
                {(data.servers || []).length === 0 && (
                  <span className="text-body-secondary small">
                    Tidak ada server streaming.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const DonghuaDetail = () => {
  const { slug } = useParams()
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
      cover: data.cover || '',
      status: data.status || '',
      type: data.type || '',
      rating: data.rating || '',
      studio: data.studio || '',
      network: data.network || '',
      released: data.released || '',
      duration: data.duration || '',
      episodes_count: data.episodes_count || '',
      season: data.season || '',
      country: data.country || '',
      subber: data.subber || '',
      synopsis: data.synopsis || '',
      genres: genresToText(data.genres),
    })
    setEpisodes(data.episodes_list || [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/donghua/${encodeURIComponent(slug)}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal memuat detail')
      applyData(j.data, j.from)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [slug, applyData])

  useEffect(() => {
    load()
  }, [load])

  const fetchLive = async () => {
    setFetching(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(
        `${API_BASE}/api/donghua/${encodeURIComponent(slug)}?fresh=1`
      )
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
      const res = await fetch(`${API_BASE}/api/donghua/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          genres: textToGenres(form.genres),
          episodes_list: episodes,
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
          Detail Donghua{' '}
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
                    slug: <code>{slug}</code>
                  </div>
                </CCol>
                <CCol md={9}>
                  <CRow className="g-2">
                    {FIELDS.map(([k, label]) => (
                      <CCol md={k === 'title' || k === 'poster' || k === 'cover' ? 12 : 6} key={k}>
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
                    Sumber API: {UPSTREAM}/{slug}
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
              {episodes.map((ep, i) => (
                <CListGroupItem key={ep.slug || i}>
                  <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div>
                      {ep.eps && (
                        <CBadge color="primary" className="me-2">
                          Ep {ep.eps}
                        </CBadge>
                      )}
                      <span>{ep.title}</span>
                      {ep.date && (
                        <div className="small text-body-secondary">{ep.date}</div>
                      )}
                    </div>
                  </div>
                  {ep.slug && <EpisodeStream slug={ep.slug} />}
                </CListGroupItem>
              ))}
            </CListGroup>
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default DonghuaDetail
