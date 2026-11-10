// Transposé de challenge_list_screen.dart, create_challenge_screen.dart, challenge_detail_screen.dart
import { useNavigate, useParams } from 'react-router-dom'
import { BarChart3, Calendar, Gamepad2, Info, SearchX, Trophy, Flag, type LucideIcon } from 'lucide-react'
import { AppBar, Avatar, Button, Empty } from '../components/ui'
import { useUser } from '../services/auth'
import { useDb } from '../lib/db'
import { canDispute, challengeService, STATUS_META } from '../services/challenges'
import { userService } from '../services/users'
import { formatDate, sc } from '../lib/format'


function DetailRow({ icon: Icon, label, value, color = 'var(--cyan)' }: { icon: LucideIcon; label: string; value: string; color?: string }) {
  return (
    <div className="row" style={{ padding: '10px 0' }}>
      <span style={{ padding: 8, borderRadius: 10, background: `color-mix(in srgb, ${color} 15%, transparent)`, display: 'grid' }}><Icon size={18} color={color} /></span>
      <span className="grow grey">{label}</span>
      <span className="bold" style={{ textAlign: 'right' }}>{value}</span>
    </div>
  )
}


// ================= Fiche détaillée =================
export function ChallengeDetailScreen() {
  useDb()
  const { id = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const c = challengeService.getById(id)
  if (!c) return <div className="screen"><AppBar title="Détails du défi" back /><Empty icon={SearchX} title="Défi introuvable" /></div>
  const creator = userService.getById(c.creatorId)
  const opponent = userService.getById(c.opponentId)
  const s = STATUS_META[c.status]
  const d = c.matchDetails
  const winner = userService.getById(d?.winnerId)

  return (
    <div className="screen">
      <AppBar title="Détails du défi" back />
      <div className="screen-body">
        <div className="card row between" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,.25), rgba(157,78,221,.25))' }}>
          <div><p className="grey" style={{ fontSize: 13 }}>Montant</p><p className="headline-lg yellow">{sc(c.amount)} XOF</p></div>
          <div style={{ textAlign: 'right' }}><p className="grey" style={{ fontSize: 13 }}>Statut</p>
            <span className="pill" style={{ background: `color-mix(in srgb, ${s.color} 20%, transparent)`, color: s.color, fontSize: 13 }}>{s.short}</span></div>
        </div>
        <div className="row mt-16" style={{ justifyContent: 'space-around' }}>
          {[creator, opponent].map((p, i) => (
            <div key={i} className="center-col" style={{ gap: 6, width: 120 }}>
              <Avatar name={p?.pseudo ?? '?'} size={56} />
              <span className="bold ellipsis" style={{ maxWidth: 120 }}>{p?.pseudo ?? 'En attente'}</span>
              {d?.winnerId && p?.id === d.winnerId && <span className="pill" style={{ background: 'rgba(255,214,10,.2)', color: 'var(--yellow)' }}>🏆 Gagnant</span>}
            </div>
          ))}
        </div>
        {d?.creatorScore != null && <p className="display-md center-col mt-8">{d.creatorScore} - {d.opponentScore}</p>}
        <div className="card mt-16">
          <DetailRow icon={Gamepad2} label="Type de défi" value={c.matchType} />
          <DetailRow icon={Gamepad2} label="Plateforme" value={c.platform} />
          <DetailRow icon={BarChart3} label="Niveau requis" value={`Niveau ${c.requiredLevel}`} />
          <DetailRow icon={Calendar} label="Créé le" value={formatDate(c.createdAt)} />
          {d?.matchCode && <DetailRow icon={Info} label="Code match" value={d.matchCode} />}
          {winner && <DetailRow icon={Trophy} label="Gagnant" value={winner.pseudo} color="var(--yellow)" />}
        </div>
        {c.dispute && (
          <div className="card mt-16" style={{ border: '1px solid var(--orange)' }}>
            <p className="title-md" style={{ color: 'var(--orange)' }}>⚖️ Litige {c.dispute.resolvedAt ? 'résolu' : 'en cours'}</p>
            <p className="body-md mt-8">Raison : {c.dispute.reason}</p>
            {c.dispute.resolution && <p className="body-md mt-4">Décision : {c.dispute.resolution}</p>}
            <Button variant="text" onClick={() => navigate(`/disputes/${c.id}/evidence`)}>Voir les Preuves</Button>
          </div>
        )}
        {canDispute(c, user.id) && (
          <Button variant="outline" block icon={Flag} style={{ marginTop: 16, color: 'var(--orange)', borderColor: 'var(--orange)' }} onClick={() => navigate(`/disputes/new/${c.id}`)}>Contester le résultat</Button>
        )}
        {(c.status === 'accepted' || c.status === 'inProgress') && (c.creatorId === user.id || c.opponentId === user.id) && (
          <Button block icon={Gamepad2} style={{ marginTop: 16 }} onClick={() => navigate(`/match/${c.id}/${c.status === 'inProgress' ? 'live' : 'lobby'}`)}>Rejoindre le Match Lobby</Button>
        )}
      </div>
    </div>
  )
}
