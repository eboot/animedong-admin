import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilVideo, cilCalendar, cilTv } from '@coreui/icons'
import { CNavItem } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Anime',
    to: '/anime',
    icon: <CIcon icon={cilVideo} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Jadwal',
    to: '/jadwal',
    icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Donghua',
    to: '/donghua',
    icon: <CIcon icon={cilTv} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Jadwal Donghua',
    to: '/donghua/jadwal',
    icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
  },
]

export default _nav
