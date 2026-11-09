// Transposé de home_screen.dart (« Arène » + grille de GameCard)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BarChart3, Gift, History, Megaphone, Video, Wallet, Zap, type LucideIcon } from 'lucide-react'
import { IconButton } from '../components/ui'
import { SoccerBall, Toll } from '../components/icons'
import { useUser } from '../services/auth'
import { announcementService } from '../services/announcements'
import { notificationService } from '../services/notifications'

type IconLike = LucideIcon | typeof SoccerBall

function GameCard({ title, subtitle, colors, icon: Icon, onTap, badge }: {
  title: string; subtitle: string; colors: [string, string]; icon: IconLike; onTap: () => void; badge?: number
}) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onClick={onTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        position: 'relative', overflow: 'hidden', aspectRatio: '0.85', border: 0, borderRadius: 20, padding: 16,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left',
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        boxShadow: `0 8px 16px ${colors[0]}66`, cursor: 'pointer', color: '#fff',
        transform: pressed ? 'scale(.95)' : 'scale(1)', transition: 'transform .1s',
      }}
    >
      <span style={{ position: 'absolute', right: -20, top: -20, opacity: .1 }}><Icon size={100} color="#fff" /></span>
      <Icon size={36} color="#fff" />
      <span className="mt-12" style={{ font: '900 17px/1.2 var(--font-title)', letterSpacing: .5 }}>{title}</span>
      <span className="mt-4" style={{
        fontSize: 12, lineHeight: 1.3, color: 'rgba(255,255,255,.9)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{subtitle}</span>
      {badge ? (
        <span style={{
          position: 'absolute', top: 12, right: 12, padding: '4px 8px', borderRadius: 20,
          background: 'var(--pink)', boxShadow: '0 0 8px 1px rgba(255,0,110,.5)', fontSize: 12, fontWeight: 700,
        }}>{badge}</span>
      ) : null}
    </button>
  )
}

export function HomeScreen() {
  const user = useUser()
  const navigate = useNavigate()
  const unreadAnnouncements = announcementService.getUnreadCount()
  const unreadNotifications = notificationService.getUnreadCount(user.id)

  return (
    <div className="screen gradient with-nav">
      <header style={{
        position: 'sticky', top: 0, zIndex: 5, padding: '8px 8px 16px',
        background: 'linear-gradient(180deg, rgba(0,229,255,.1), transparent), rgba(10,22,40,.85)', backdropFilter: 'blur(12px)',
      }}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <span className="row" style={{ gap: 4, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,214,10,.2)', border: '1px solid var(--yellow)' }}>
            <Toll color="var(--yellow)" />
            <span style={{ fontWeight: 700 }}>{Math.trunc(user.walletBalance.available)}</span>
          </span>
          <IconButton icon={Bell} label="Notifications" color="var(--cyan)" badge={unreadNotifications} onClick={() => navigate('/notifications')} />
        </div>
        <h1 className="headline-md black" style={{ textAlign: 'center', letterSpacing: 1 }}>Arène KickFlow</h1>
      </header>

      <div className="screen-body">
        <p className="body-md" style={{ textAlign: 'center', marginTop: 8 }}>Choisissez votre action</p>
        <div className="mt-24" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <GameCard title="TROUVER DÉFI" subtitle="Créez ou rejoignez un défi 1v1 contre vos amis" colors={['#FF3B6D', '#B91D43']} icon={SoccerBall} onTap={() => navigate('/defis')} />
          <GameCard title="HISTORIQUE" subtitle="Consultez l'historique de tous vos défis" colors={['#39FF14', '#00C853']} icon={History} onTap={() => navigate('/historique')} />
          <GameCard title="COMPÉTITIONS" subtitle="Créez ou rejoignez des compétitions personnalisées" colors={['#9D4EDD', '#7F5AF0']} icon={Zap} onTap={() => navigate('/tournaments')} />
          <GameCard title="STREAMING" subtitle="Regardez les défis en direct et animez vos parties" colors={['#FF006E', '#9D174D']} icon={Video} onTap={() => navigate('/streaming')} />
          <GameCard title="CLASSEMENT" subtitle="Découvrez le top 10 des meilleurs joueurs" colors={['#FFD60A', '#FF9500']} icon={BarChart3} onTap={() => navigate('/leaderboard')} />
          <GameCard title="PARRAINAGE" subtitle="Invitez vos amis et gagnez des récompenses" colors={['#00E5FF', '#0083B0']} icon={Gift} onTap={() => navigate('/referral')} />
          <GameCard title="ANNONCES" subtitle="Découvrez les actualités et nouveautés de l'app" colors={['#FF6B35', '#E63946']} icon={Megaphone} badge={unreadAnnouncements} onTap={() => navigate('/announcements')} />
        </div>

        <div className="row mt-32" style={{
          padding: 24, borderRadius: 20, border: '1px solid rgba(0,229,255,.3)',
          background: 'linear-gradient(135deg, rgba(0,229,255,.2), rgba(157,78,221,.2))',
        }}>
          <div className="grow">
            <Wallet size={32} color="var(--cyan)" />
            <p className="title-lg mt-12">Portefeuille</p>
            <p className="body-sm mt-4">Gérez vos SkillCoins et transactions</p>
          </div>
          <button type="button" className="btn btn-primary sm" onClick={() => navigate('/wallet')}>Ouvrir</button>
        </div>
      </div>
    </div>
  )
}
