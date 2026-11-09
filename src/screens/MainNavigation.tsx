// Barre de navigation du bas : 5 onglets (maquette v2)
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Home, Swords, Trophy, User } from 'lucide-react'
import { useDb } from '../lib/db'
import { useUser } from '../services/auth'
import { challengeService } from '../services/challenges'

const TABS = [
  { to: '/', icon: Home, label: 'Accueil', end: true },
  { to: '/defis', icon: Swords, label: 'Défis' },
  { to: '/tournaments', icon: Trophy, label: 'Tournois' },
  { to: '/classement', icon: BarChart3, label: 'Classement' },
  { to: '/profil', icon: User, label: 'Profil' },
]

export function MainNavigation() {
  useDb()
  const me = useUser()
  // Pastille sur « Défis » quand un défi m'est adressé directement
  const invited = challengeService.getAvailable(me).filter((c) => c.invitedUserId === me.id).length
  return (
    <>
      <Outlet />
      <nav className="bottom-nav" aria-label="Navigation principale">
        {TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} replace className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <span className="nav-icon" style={{ position: 'relative' }}>
                  <Icon size={isActive ? 25 : 23} />
                  {to === '/defis' && invited > 0 && <span style={{ position: 'absolute', top: 2, right: 0, width: 9, height: 9, borderRadius: '50%', background: 'var(--k-red)' }} />}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
