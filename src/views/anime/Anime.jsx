import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '')

const SOURCE_COLORS = {
  animehome: 'primary',
  samehadaku: 'info',
  anoboy: 'warning',
  animeindo: 'success',
  animebrowse: 'danger',
  kurama: 'dark',
}

const PAGE_SIZE = 20

const Anime = () => {
  const [sources, setSources] = useState([])
  const [sourceKey, setSourceKey] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // key = '' -> semua sumber (tabel home); 'kurama' -> baca langsung
  // dari database animeapi; lainnya -> filter tabel home per sumber.
  const fetchList = useCallback(async (q = '', p = 1, key = '') => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(p),
      })
      if (q) params.set('q', q)
      let url
      if (key === 'kurama') {
        url = `${API_BASE}/api/kurama/anime?${params}`
      } else {
        if (key) params.set('source', key)
        url = `${API_BASE}/api/home?${params}`
      }
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data')
      setRows(data.rows || [])
      setTotal(data.total || 0)
      setPage(data.page || p)
    } catch (e) {
      setError(e.message || 'Gagal memuat data. Pastikan backend jalan di ' + API_BASE)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/sources`)
      .then((r) => r.json())
      .then(setSources)
      .catch(() => setSources([]))
    fetchList('', 1, '')
  }, [fetchList])

  const handleScrape = async () => {
    if (!sourceKey) return
    setScraping(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape gagal')
      setResult(data)
      fetchList(query, 1, sourceKey)
    } catch (e) {
      setError(e.message)
    } finally {
      setScraping(false)
    }
  }

  const kuramaResults = result?.source === 'kurama' ? result.results || [] : []
  const kuramaOk = kuramaResults.filter((r) => r.ok).length

  return (
    <CCard>
      <CCardHeader>Anime</CCardHeader>
      <CCardBody>
        <CRow className="g-3 mb-3 align-items-end">
          <CCol md={5}>
            <CFormSelect
              label="URL API Sumber"
              value={sourceKey}
              onChange={(e) => {
                const k = e.target.value
                setSourceKey(k)
                setQuery('')
                fetchList('', 1, k)
              }}
            >
              <option value="">— Pilih sumber API —</option>
              {sources.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                  {s.url && !s.url.startsWith('kurama://') ? ` — ${s.url}` : ''}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CButton
              color="primary"
              onClick={handleScrape}
              disabled={!sourceKey || scraping}
            >
              {scraping ? (
                <>
                  <CSpinner size="sm" className="me-2" /> Scraping...
                </>
              ) : (
                'Scrape & Simpan'
              )}
            </CButton>
          </CCol>
          <CCol md={4}>
            <CFormInput
              placeholder="Cari judul..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                fetchList(e.target.value, 1, sourceKey)
              }}
            />
          </CCol>
        </CRow>

        {result && (
          <CAlert color="success" dismissible onClose={() => setResult(null)}>
            {result.source === 'kurama' ? (
              <>
                Scrape <strong>Kurama (via animeapi)</strong> selesai: {kuramaOk}{' '}
                berhasil, {kuramaResults.length - kuramaOk} gagal dari{' '}
                {kuramaResults.length} anime. Data tersimpan di database animeapi.
              </>
            ) : (
              <>
                Scrape{' '}
                <strong>
                  {sources.find((s) => s.key === sourceKey)?.label || sourceKey}
                </strong>{' '}
                selesai: {result.inserted} data baru disimpan, {result.skipped}{' '}
                dilewati (sudah ada) dari {result.total} total.
              </>
            )}
          </CAlert>
        )}
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError('')}>
            {error}
          </CAlert>
        )}

        <p className="text-body-secondary">
          {total} anime {sourceKey === 'kurama' ? 'di database animeapi' : 'tersimpan'}{' '}
          — urut dari yang terbaru di-scrape.
        </p>

        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
          </div>
        ) : (
          <div className="table-responsive">
            <CTable hover align="middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Poster</CTableHeaderCell>
                  <CTableHeaderCell>Judul</CTableHeaderCell>
                  <CTableHeaderCell>Sumber</CTableHeaderCell>
                  <CTableHeaderCell>Episode</CTableHeaderCell>
                  <CTableHeaderCell>Rilis</CTableHeaderCell>
                  <CTableHeaderCell>Disimpan</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={6} className="text-center text-body-secondary">
                      Belum ada data. Pilih sumber API lalu klik Scrape &amp; Simpan.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {rows.map((a) => (
                  <CTableRow key={`${a.source}:${a.anime_id}`}>
                    <CTableDataCell>
                      {a.poster ? (
                        <img
                          src={a.poster}
                          alt=""
                          width={48}
                          height={68}
                          style={{ objectFit: 'cover', borderRadius: 4 }}
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-body-secondary">-</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell style={{ maxWidth: 320 }}>
                      <Link to={`/anime/detail/${a.anime_id}`}>{a.title}</Link>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={SOURCE_COLORS[a.source] || 'secondary'}>
                        {sources.find((s) => s.key === a.source)?.label || a.source}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{a.episodes || '-'}</CTableDataCell>
                    <CTableDataCell>{a.released_on || '-'}</CTableDataCell>
                    <CTableDataCell className="text-nowrap">{a.scraped_at}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}

        {total > PAGE_SIZE && (
          <CPagination className="justify-content-center mt-3 mb-0" aria-label="Navigasi halaman">
            <CPaginationItem
              disabled={page <= 1}
              onClick={() => fetchList(query, page - 1, sourceKey)}
            >
              ‹
            </CPaginationItem>
            {pageNumbers(page, Math.ceil(total / PAGE_SIZE)).map((p, i) =>
              p === '…' ? (
                <CPaginationItem key={`ellipsis-${i}`} disabled>
                  …
                </CPaginationItem>
              ) : (
                <CPaginationItem
                  key={p}
                  active={p === page}
                  onClick={() => fetchList(query, p, sourceKey)}
                >
                  {p}
                </CPaginationItem>
              ),
            )}
            <CPaginationItem
              disabled={page >= Math.ceil(total / PAGE_SIZE)}
              onClick={() => fetchList(query, page + 1, sourceKey)}
            >
              ›
            </CPaginationItem>
          </CPagination>
        )}
      </CCardBody>
    </CCard>
  )
}

// Nomor halaman kompak: 1 … [p-1, p, p+1] … total
const pageNumbers = (page, totalPages) => {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

export default Anime
