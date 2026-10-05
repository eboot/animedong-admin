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
const SCHEDULE_URL = 'https://www.sankavollerei.web.id/anime/schedule'

const Schedule = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [days, setDays] = useState([])
  const [day, setDay] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const fetchList = useCallback(async (d = '', q = '') => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (d) params.set('day', d)
      if (q) params.set('q', q)
      const res = await fetch(`${API_BASE}/api/schedule?${params}`)
      const data = await res.json()
      setRows(data.rows || [])
      setTotal(data.total || 0)
      if (data.days) setDays(data.days)
    } catch {
      setError('Gagal memuat data. Pastikan backend jalan di ' + API_BASE)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleScrape = async () => {
    setScraping(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'schedule' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape gagal')
      setResult(data)
      fetchList(day, query)
    } catch (e) {
      setError(e.message)
    } finally {
      setScraping(false)
    }
  }

  return (
    <CCard>
      <CCardHeader>Jadwal Rilis Anime</CCardHeader>
      <CCardBody>
        <CRow className="g-3 mb-3 align-items-end">
          <CCol md={4}>
            <div>
              <div className="form-label">URL API Sumber</div>
              <div className="text-break small text-body-secondary">{SCHEDULE_URL}</div>
            </div>
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
            Scrape <strong>Jadwal</strong> selesai: {result.inserted} data baru disimpan,{' '}
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
                      <Link to={`/anime/detail/${a.anime_id}`}>{a.title}</Link>
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
