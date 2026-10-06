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
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const KIND = {
  anime: {
    label: 'Anime',
    sourceUrl: 'http://168.110.213.108/otakudesu/schedule',
    listPath: '/api/schedule',
    scrape: { path: '/api/scrape', body: { source: 'schedule' } },
    detailLink: (a) => `/anime/detail/${a.anime_id}`,
  },
  donghua: {
    label: 'Donghua',
    sourceUrl: 'http://168.110.213.108/donghua/schedule',
    listPath: '/api/donghua/schedule',
    scrape: { path: '/api/donghua/schedule/scrape', body: {} },
    detailLink: (a) => `/donghua/detail/${a.slug}`,
  },
}

const Schedule = () => {
  const [kind, setKind] = useState('anime')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [days, setDays] = useState([])
  const [day, setDay] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const cfg = KIND[kind]

  const fetchList = useCallback(
    async (k = kind, d = '', q = '') => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ limit: '200' })
        if (d) params.set('day', d)
        if (q) params.set('q', q)
        const res = await fetch(`${API_BASE}${KIND[k].listPath}?${params}`)
        const data = await res.json()
        setRows(data.rows || [])
        setTotal(data.total || 0)
        if (data.days) setDays(data.days)
      } catch {
        setError('Gagal memuat data. Pastikan backend jalan di ' + API_BASE)
      } finally {
        setLoading(false)
      }
    },
    [kind]
  )

  useEffect(() => {
    fetchList(kind)
  }, [kind, fetchList])

  const handleScrape = async () => {
    setScraping(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch(`${API_BASE}${cfg.scrape.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg.scrape.body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape gagal')
      setResult(data)
      fetchList(kind, day, query)
    } catch (e) {
      setError(e.message)
    } finally {
      setScraping(false)
    }
  }

  return (
    <CCard>
      <CCardHeader>Jadwal Rilis {cfg.label}</CCardHeader>
      <CCardBody>
        <CRow className="g-3 mb-3 align-items-end">
          <CCol md={4}>
            <CFormSelect
              label="Jenis"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value)
                setDay('')
                setQuery('')
                setResult(null)
              }}
            >
              <option value="anime">Anime</option>
              <option value="donghua">Donghua</option>
            </CFormSelect>
            <div className="text-break small text-body-secondary mt-2">{cfg.sourceUrl}</div>
          </CCol>
          <CCol md={2}>
            <CButton color="primary" onClick={handleScrape} disabled={scraping}>
              {scraping ? (
                <>
                  <CSpinner size="sm" className="me-2" /> Scraping...
                </>
              ) : (
                'Scrape & Simpan'
              )}
            </CButton>
          </CCol>
          <CCol md={3}>
            <CFormSelect
              label="Hari"
              value={day}
              onChange={(e) => {
                setDay(e.target.value)
                fetchList(e.target.value, query)
              }}
            >
              <option value="">Semua hari</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormInput
              label="Cari"
              placeholder="Cari judul..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                fetchList(day, e.target.value)
              }}
            />
          </CCol>
        </CRow>

        {result && (
          <CAlert color="success" dismissible onClose={() => setResult(null)}>
            Scrape <strong>Jadwal {cfg.label}</strong> selesai: {result.inserted} data baru disimpan,{' '}
            {result.skipped} dilewati (sudah ada) dari {result.total} total.
          </CAlert>
        )}
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError('')}>
            {error}
          </CAlert>
        )}

        <p className="text-body-secondary">{total} jadwal tersimpan — urut hari Senin..Minggu.</p>

        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
          </div>
        ) : (
          <div className="table-responsive">
            <CTable hover align="middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Hari</CTableHeaderCell>
                  <CTableHeaderCell>Poster</CTableHeaderCell>
                  <CTableHeaderCell>Judul</CTableHeaderCell>
                  <CTableHeaderCell>Disimpan</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={4} className="text-center text-body-secondary">
                      Belum ada data. Klik Scrape &amp; Simpan.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {rows.map((a) => (
                  <CTableRow key={a.id}>
                    <CTableDataCell>
                      <CBadge color="info">{a.day}</CBadge>
                    </CTableDataCell>
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
                    <CTableDataCell style={{ maxWidth: 340 }}>
                      <Link to={cfg.detailLink(a)}>{a.title}</Link>
                    </CTableDataCell>
                    <CTableDataCell className="text-nowrap">{a.scraped_at}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default Schedule
