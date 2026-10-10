import React, { useCallback, useEffect, useState } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CWidgetStatsA,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilLayers, cilLink, cilVideo } from '@coreui/icons'
import { CChartBar, CChartDoughnut } from '@coreui/react-chartjs'

const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '')

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const PALETTE = [
  '#5856d6',
  '#3399ff',
  '#2eb85c',
  '#f9b115',
  '#e55353',
  '#9c27b0',
  '#00bcd4',
  '#795548',
]

const orderDays = (byDay) => {
  const map = Object.fromEntries((byDay || []).map((d) => [d.day, d.total]))
  const ordered = DAY_ORDER.filter((d) => map[d] != null).map((d) => ({
    day: d,
    total: map[d],
  }))
  for (const [day, total] of Object.entries(map)) {
    if (!DAY_ORDER.includes(day)) ordered.push({ day, total })
  }
  return ordered
}

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/dashboard`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gagal memuat data')
      setData(json.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center py-5">
          <CSpinner />
        </CCardBody>
      </CCard>
    )
  }

  if (error) {
    return (
      <CCard>
        <CCardHeader>Dashboard</CCardHeader>
        <CCardBody>
          <div className="text-danger">
            Gagal memuat data. Pastikan backend jalan di {API_BASE}
          </div>
        </CCardBody>
      </CCard>
    )
  }

  const { anime, schedule, donghua, streams, recent } = data
  const totalStreams = (streams?.anime || 0) + (streams?.donghua || 0)
  const byDay = orderDays(schedule?.byDay)

  const cards = [
    {
      icon: cilVideo,
      color: 'primary',
      value: anime?.total ?? 0,
      title: 'Total Anime',
      footer: `${anime?.details ?? 0} detail tersimpan`,
    },
    {
      icon: cilCalendar,
      color: 'info',
      value: schedule?.total ?? 0,
      title: 'Total Jadwal',
      footer: `${byDay.length} hari terisi`,
    },
    {
      icon: cilLayers,
      color: 'warning',
      value: donghua?.total ?? 0,
      title: 'Total Donghua',
      footer: `${donghua?.details ?? 0} detail tersimpan`,
    },
    {
      icon: cilLink,
      color: 'success',
      value: totalStreams,
      title: 'URL Stream Tersimpan',
      footer: `${streams?.anime ?? 0} anime · ${streams?.donghua ?? 0} donghua`,
    },
  ]

  return (
    <>
      <CRow className="g-3 mb-3">
        {cards.map((c) => (
          <CCol key={c.title} sm={6} xl={3}>
            <CWidgetStatsA
              color={c.color}
              value={
                <>
                  <CIcon icon={c.icon} className="me-2" />
                  {Number(c.value).toLocaleString('id-ID')}
                </>
              }
              title={c.title}
              footer={<span className="small">{c.footer}</span>}
            />
          </CCol>
        ))}
      </CRow>

      <CRow className="g-3 mb-3">
        <CCol md={6}>
          <CCard className="h-100">
            <CCardHeader>Anime per Sumber</CCardHeader>
            <CCardBody>
              <div style={{ height: 260 }}>
                <CChartBar
                  data={{
                    labels: (anime?.bySource || []).map((s) => s.source),
                    datasets: [
                      {
                        label: 'Judul',
                        data: (anime?.bySource || []).map((s) => s.total),
                        backgroundColor: PALETTE,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={6}>
          <CCard className="h-100">
            <CCardHeader>Jadwal per Hari</CCardHeader>
            <CCardBody>
              <div style={{ height: 260 }}>
                <CChartDoughnut
                  data={{
                    labels: byDay.map((d) => d.day),
                    datasets: [
                      {
                        data: byDay.map((d) => d.total),
                        backgroundColor: PALETTE,
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard>
        <CCardHeader>Terakhir di-scrape</CCardHeader>
        <CCardBody>
          <CTable hover responsive small>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Sumber</CTableHeaderCell>
                <CTableHeaderCell>Judul</CTableHeaderCell>
                <CTableHeaderCell>Episode</CTableHeaderCell>
                <CTableHeaderCell>Waktu</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {(recent || []).map((r, i) => (
                <CTableRow key={`${r.source}-${i}`}>
                  <CTableDataCell>{r.source}</CTableDataCell>
                  <CTableDataCell>{r.title}</CTableDataCell>
                  <CTableDataCell>{r.episodes || '—'}</CTableDataCell>
                  <CTableDataCell className="text-body-secondary">
                    {r.scraped_at || '—'}
                  </CTableDataCell>
                </CTableRow>
              ))}
              {(!recent || recent.length === 0) && (
                <CTableRow>
                  <CTableDataCell colSpan={4} className="text-center text-body-secondary">
                    Belum ada data — mulai dari halaman Anime.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Dashboard
