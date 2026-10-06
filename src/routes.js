import React from 'react'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Anime = React.lazy(() => import('./views/anime/Anime'))
const AnimeDetail = React.lazy(() => import('./views/anime/AnimeDetail'))
const Schedule = React.lazy(() => import('./views/schedule/Schedule'))
const Donghua = React.lazy(() => import('./views/donghua/Donghua'))
const DonghuaDetail = React.lazy(() => import('./views/donghua/DonghuaDetail'))
const DonghuaSchedule = React.lazy(() => import('./views/donghua/DonghuaSchedule'))

export const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/anime', name: 'Anime', element: Anime },
  { path: '/anime/detail/:animeId', name: 'Detail Anime', element: AnimeDetail },
  { path: '/jadwal', name: 'Jadwal', element: Schedule },
  { path: '/donghua', name: 'Donghua', element: Donghua },
  { path: '/donghua/detail/:slug', name: 'Detail Donghua', element: DonghuaDetail },
  { path: '/donghua/jadwal', name: 'Jadwal Donghua', element: DonghuaSchedule },
]
