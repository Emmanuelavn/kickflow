// Transposé de main_navigation_screen.dart : 5 onglets + bannière et popup d'annonces
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { History, Home, Search, User, Video } from 'lucide-react'
import { announcementService } from '../services/announcements'
import { AnnouncementBanner, AnnouncementPopup } from '../components/announcements'
import { useDb } from '../lib/db'
import type { Announcement } from '../lib/types'

const TABS = [
  { to: '/', icon: Home, label: 'Accueil', end: true },
  { to: '/defis', icon: Search, label: 'Défis' },
  { to: '/historique', icon: History, label: 'Historique' },
  { to: '/streaming', icon: Video, label: 'Streaming' },
  { to: '/profil', icon: User, label: 'Profil' },
]

export function MainNavigation() {
  useDb()
  const navigate = useNavigate()
  const [popup, setPopup] = useState<Announcement | null>(null)
  const banner = announcementService.getActiveBanner()

  useEffect(() => {
    const t = setTimeout(() => setPopup(announcementService.getNextPopup()), 1000)
    return () => clearTimeout(t)
  }, [])

  const closePopup = () => {
    if (popup) announcementService.markPopupAsShown(popup.id)
    setPopup(null)
  }

  return (
    <>
      {banner && (
        <div style={{ paddingTop: 'var(--safe-top)', background: 'var(--dark-navy)' }}>
          <AnnouncementBanner a={banner} onTap={() => navigate('/announcements')} onDismiss={() => announcementService.dismissBanner(banner.id)} />
        </div>
      )}
      <Outlet />
      <nav className="bottom-nav" aria-label="Navigation principale">
        {TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} replace className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <span className="nav-icon"><Icon size={isActive ? 26 : 24} /></span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {popup && (
        <AnnouncementPopup
          a={popup}
          onClose={closePopup}
          onAction={() => { closePopup(); navigate(popup.actionRoute ?? '/announcements') }}
        />
      )}
    </>
  )
}
