// Fiche publique d'un joueur : niveau, stats, ID eFootball, ajouter en ami, défier
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Swords, UserCheck, UserPlus, Users } from 'lucide-react'
import { Avatar, Empty, useAction, useSnack } from '../../components/ui'
import { Section, TopBar } from '../../components/kit'
import { useUser } from '../../services/auth'
import { useDb } from '../../lib/db'
import { userService } from '../../services/users'
import { challengeService } from '../../services/challenges'
import { sc } from '../../lib/format'

export function PlayerScreen() {
  useDb()
  const { id = '' } = useParams()
  const me = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const { run, busy } = useAction()
  const p = userService.getById(id)
  if (!p || p.username === 'compte_supprime') return <div className="screen"><TopBar back title="Joueur" /><Empty icon={Users} title="Joueur introuvable" /></div>
  if (p.id === me.id) { navigate('/profil', { replace: true }); return null }

  const games = p.stats.wins + p.stats.losses
  const rate = games ? Math.round((p.stats.wins / games) * 100) : 0
  const isFriend = me.friendIds.includes(p.id)
  // Nos confrontations directes
  const h2h = challengeService.getMine(me.id).filter((c) => c.status === 'completed' && (c.creatorId === p.id || c.opponentId === p.id))
  const myWins = h2h.filter((c) => c.matchDetails?.winnerId === me.id).length
  const since = new Date(p.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="screen">
      <TopBar back title="Joueur" />
      <div className="k-body">
        <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar name={p.pseudo} photo={p.profilePhoto} size={96} />
          <h2 style={{ font: '700 24px var(--font-title)', margin: '12px 0 0' }}>{p.pseudo}</h2>
          <div className="k-muted k-small">Niveau {p.stats.level}{p.country ? ` · ${p.country}` : ''} · membre depuis {since}</div>
          {isFriend && <span className="k-pill mt-8" style={{ background: 'rgba(46,229,157,.14)', color: 'var(--k-green)' }}><UserCheck size={12} />ami</span>}
        </div>

        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <div className="k-card k-stat"><b>{p.stats.wins}</b><span className="k-dim k-xs">Victoires</span></div>
          <div className="k-card k-stat" style={{ marginTop: 0 }}><b>{p.stats.losses}</b><span className="k-dim k-xs">Défaites</span></div>
          <div className="k-card k-stat" style={{ marginTop: 0 }}><b style={{ color: 'var(--k-green)' }}>{rate} %</b><span className="k-dim k-xs">Réussite</span></div>
        </div>

        <div className="k-card row">
          <span className="k-dim k-xs">ID eFootball</span>
          {p.efootballId ? (
            <>
              <span className="k-mono grow k-ellipsis">{p.efootballId}</span>
              <button type="button" className="k-icon" style={{ background: 'transparent', color: 'var(--cyan)' }} aria-label="Copier l'ID"
                onClick={async () => { try { await navigator.clipboard.writeText(p.efootballId!) } catch { /* ignore */ } snack('ID copié', 'success') }}><Copy size={20} /></button>
            </>
          ) : <span className="grow k-dim k-small">pas encore renseigné</span>}
        </div>

        {h2h.length > 0 && (
          <div className="k-card">
            <div className="row between"><span className="k-muted">Vos confrontations</span><b>{myWins} – {h2h.length - myWins}</b></div>
            <div className="k-dim k-xs mt-4">{h2h.length} match{h2h.length > 1 ? 's' : ''} joué{h2h.length > 1 ? 's' : ''} ensemble · gains cumulés de {p.pseudo} : {sc(p.stats.totalEarned)} SC</div>
          </div>
        )}

        <Section title="Actions" />
        <button type="button" className="k-btn primary block" onClick={() => navigate(`/challenges/create?to=${p.id}`)}><Swords size={20} />Défier {p.pseudo}</button>
        {isFriend ? (
          <button type="button" className="k-btn ghost block" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(() => userService.removeFriend(p.id), 'Retiré de tes amis')}>Retirer de mes amis</button>
        ) : (
          <button type="button" className="k-btn ghost block" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(() => userService.addFriend(p.id), `${p.pseudo} ajouté à tes amis`)}><UserPlus size={20} />Ajouter en ami</button>
        )}
      </div>
    </div>
  )
}
