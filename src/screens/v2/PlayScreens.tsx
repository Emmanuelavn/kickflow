// Accueil, onglet Défis et création d'un défi (maquette v2, écrans 1, 2 et 7)
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, ChevronRight, Plus, Radio, Search, Trophy, UserPlus } from 'lucide-react'
import { Avatar, Empty, useAction, useSnack } from '../../components/ui'
import { ChallengeRow, Coins, Section, Seg, TopBar, minutesAgo, prizeOf } from '../../components/kit'
import { PushCard } from '../../components/PushCard'
import { useUser } from '../../services/auth'
import { useDb } from '../../lib/db'
import { challengeService, STATUS_META } from '../../services/challenges'
import { userService } from '../../services/users'
import { notificationService } from '../../services/notifications'
import { announcementService } from '../../services/announcements'
import { tournamentService } from '../../services/tournaments'
import { streamService } from '../../services/streams'
import { sc } from '../../lib/format'
import type { Challenge } from '../../lib/types'

function stepOf(c: Challenge) {
  if (c.status === 'accepted') return { n: 1, text: 'Retrouvez-vous sur eFootball' }
  const mine = c.matchDetails?.reports ?? {}
  if (c.matchDetails?.lastDraw && !Object.keys(mine).length) return { n: 2, text: 'Match nul : rejouez une manche décisive' }
  return Object.keys(mine).length ? { n: 3, text: 'Déclarez le score' } : { n: 2, text: 'Jouez le match' }
}

// ================= 1. Accueil =================
export function HomeV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const current = challengeService.getCurrentMatch(me.id)
  const waiting = challengeService.getCreatedBy(me.id).filter((c) => c.status === 'pending')
  const available = challengeService.getAvailable(me).slice(0, 3)
  const unread = notificationService.getUnreadCount(me.id) + announcementService.getUnreadCount()
  const tournament = tournamentService.list().find((t) => t.status !== 'completed')
  const lives = streamService.live()
  const opponent = current ? userService.getById(current.creatorId === me.id ? current.opponentId : current.creatorId) : undefined
  const step = current ? stepOf(current) : null

  return (
    <div className="screen with-nav">
      <header className="k-top" style={{ paddingTop: 20 }}>
        <button type="button" onClick={() => navigate('/profil')} style={{ all: 'unset', cursor: 'pointer' }} aria-label="Mon profil">
          <Avatar name={me.pseudo} photo={me.profilePhoto} size={44} />
        </button>
        <div className="grow"><div className="k-dim k-small">Salut</div><h2 className="k-ellipsis" style={{ font: '700 19px var(--font-title)' }}>{me.pseudo}</h2></div>
        <Coins value={me.walletBalance.available} onClick={() => navigate('/wallet')} />
        <button type="button" className="k-icon" aria-label="Notifications" onClick={() => navigate('/notifications')}>
          <Bell size={22} />{unread > 0 && <span className="k-dot" />}
        </button>
      </header>

      <div className="k-body">
        <PushCard />
        {!me.efootballId && (
          <button type="button" className="k-card row" style={{ width: '100%', textAlign: 'left', marginBottom: 12, cursor: 'pointer', color: 'inherit', borderColor: 'rgba(255,214,10,.4)' }} onClick={() => navigate('/profil?edit=1')}>
            <UserPlus size={22} color="var(--yellow)" />
            <span className="grow k-small">Ajoute ton <b>ID eFootball</b> pour que tes adversaires te trouvent dans le jeu.</span>
            <ChevronRight size={18} className="k-dim" />
          </button>
        )}

        {current && opponent && step && (
          <div className="k-card now">
            <div className="row between">
              <span className="k-label" style={{ color: 'var(--cyan)' }}>Match en cours</span>
              <span className="k-pill" style={{ background: 'rgba(255,214,10,.12)', color: 'var(--yellow)' }}>{sc(current.amount)} SC</span>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Avatar name={opponent.pseudo} photo={opponent.profilePhoto} size={40} />
              <div className="grow"><b>contre {opponent.pseudo}</b><div className="k-muted k-small">Étape {step.n} sur 3 · {step.text}</div></div>
            </div>
            <div className="k-steps" style={{ margin: '14px 0' }}>
              {[1, 2, 3].map((n) => <span key={n} className={n < step.n ? 'done' : n === step.n ? 'now' : ''} />)}
            </div>
            <button type="button" className="k-btn primary block" style={{ height: 46 }} onClick={() => navigate(`/match/${current.id}`)}>Reprendre le match<ChevronRight size={18} /></button>
          </div>
        )}

        {waiting.length > 0 && (
          <button type="button" className="k-card row" style={{ width: '100%', textAlign: 'left', marginTop: current ? 12 : 0, cursor: 'pointer', color: 'inherit' }} onClick={() => navigate(`/match/${waiting[0].id}`)}>
            <span className="k-pill" style={{ background: 'rgba(255,214,10,.12)', color: 'var(--yellow)' }}>En attente</span>
            <span className="grow k-small">{waiting.length === 1 ? `Ton défi de ${sc(waiting[0].amount)} SC attend un adversaire` : `${waiting.length} défis attendent un adversaire`}</span>
            <ChevronRight size={18} className="k-dim" />
          </button>
        )}

        <button type="button" className="k-btn outline block" style={{ marginTop: 14 }} onClick={() => navigate('/challenges/create')}><Plus size={22} />Lancer un défi</button>

        <Section title="Défis disponibles" action={<button type="button" className="k-link" onClick={() => navigate('/defis')}>Tout voir</button>} />
        {available.length ? (
          <div className="k-card k-list">{available.map((c) => <ChallengeRow key={c.id} c={c} />)}</div>
        ) : (
          <div className="k-card k-muted k-small" style={{ textAlign: 'center' }}>Aucun défi pour l'instant. Lance le premier !</div>
        )}

        <div className="row" style={{ gap: 10, marginTop: 14, alignItems: 'stretch' }}>
          <button type="button" className="k-card k-tournament grow" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: '12px 14px' }} onClick={() => navigate(tournament ? `/tournaments/${tournament.id}` : '/tournaments')}>
            <div className="k-label" style={{ color: '#C9B6FF' }}>Tournoi</div>
            <div className="bold k-ellipsis" style={{ marginTop: 4 }}>{tournament?.name ?? 'Voir les tournois'}</div>
            {tournament && <div className="k-dim k-xs">{tournament.participants.length}/{tournament.maxPlayers} inscrits</div>}
          </button>
          <button type="button" className="k-card grow" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: '12px 14px', marginTop: 0 }} onClick={() => navigate('/lives')}>
            <div className="k-label row" style={{ gap: 6, color: 'var(--k-red)' }}><Radio size={14} />En direct</div>
            <div className="bold" style={{ marginTop: 4 }}>{lives.length ? `${lives.length} live${lives.length > 1 ? 's' : ''}` : 'Aucun live'}</div>
            <div className="k-dim k-xs">{lives.length ? 'Regarder' : 'Diffuser mon match'}</div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ================= 7. Onglet Défis =================
type DefisTab = 'dispo' | 'mine' | 'histo'
export function DefisV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as DefisTab) || 'dispo'
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'friends' | 'level' | 'small'>('all')
  const { run } = useAction()

  const available = challengeService.getAvailable(me).filter((c) => {
    const creator = userService.getById(c.creatorId)
    if (q && !(creator?.pseudo ?? '').toLowerCase().includes(q.toLowerCase())) return false
    if (filter === 'friends') return me.friendIds.includes(c.creatorId)
    if (filter === 'level') return me.stats.level >= c.requiredLevel
    if (filter === 'small') return c.amount <= 50
    return true
  })
  const mine = challengeService.getMine(me.id).filter((c) => ['pending', 'accepted', 'inProgress', 'disputed'].includes(c.status))
  const history = challengeService.getMine(me.id).filter((c) => c.status === 'completed' || c.status === 'cancelled')

  return (
    <div className="screen with-nav">
      <TopBar title="Défis" right={<button type="button" className="k-icon primary" aria-label="Lancer un défi" onClick={() => navigate('/challenges/create')}><Plus size={22} /></button>} />
      <div className="k-body">
        <Seg<DefisTab> value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={[['dispo', 'Disponibles'], ['mine', 'Mes défis'], ['histo', 'Historique']]} />

        {tab === 'dispo' && (
          <>
            <label className="k-field" style={{ marginTop: 12, minHeight: 44 }}>
              <Search size={18} className="k-dim" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un joueur" aria-label="Rechercher un joueur" style={{ height: 42 }} />
            </label>
            <div className="k-chips" style={{ marginTop: 10 }}>
              {([['all', 'Tous'], ['friends', 'Mes amis'], ['level', 'Mon niveau'], ['small', '≤ 50 SC']] as const).map(([v, l]) => (
                <button key={v} type="button" className={`k-chip sm${filter === v ? ' on' : ''}`} onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
            <div className="mt-12">
              {available.length ? <div className="k-card k-list">{available.map((c) => <ChallengeRow key={c.id} c={c} />)}</div>
                : <Empty icon={Search} title="Aucun défi disponible" text="Change de filtre ou lance ton propre défi." />}
            </div>
          </>
        )}

        {tab === 'mine' && (
          <div className="mt-12">
            {mine.length === 0 ? <Empty icon={Trophy} title="Aucun défi en cours" text="Lance un défi ou accepte celui d'un joueur." /> : (
              <div className="k-card k-list">
                {mine.map((c) => {
                  const oppId = c.creatorId === me.id ? c.opponentId : c.creatorId
                  const opp = userService.getById(oppId)
                  const s = STATUS_META[c.status]
                  return (
                    <div key={c.id} className="k-item">
                      <button type="button" className="row grow" style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/match/${c.id}`)}>
                        <Avatar name={opp?.pseudo ?? '?'} size={40} />
                        <span className="grow" style={{ minWidth: 0 }}>
                          <b className="k-ellipsis" style={{ display: 'block' }}>{opp ? `contre ${opp.pseudo}` : c.invitedUserId ? `invitation à ${userService.getById(c.invitedUserId)?.pseudo ?? 'un ami'}` : 'En attente d\'adversaire'}</b>
                          <span className="k-pill" style={{ marginTop: 4, background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}>{s.short}</span>
                        </span>
                        <span className="k-amount">{sc(c.amount)}</span>
                      </button>
                      {c.status === 'pending' && c.creatorId === me.id && (
                        <button type="button" className="k-btn danger sm" onClick={() => run(() => challengeService.cancel(c.id), 'Défi annulé, mise rendue')}>Annuler</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'histo' && (
          <div className="mt-12">
            {history.length === 0 ? <Empty icon={Trophy} title="Aucun match terminé" text="Tes victoires et défaites apparaîtront ici." /> : (
              <div className="k-card k-list">
                {history.map((c) => {
                  const oppId = c.creatorId === me.id ? c.opponentId : c.creatorId
                  const opp = userService.getById(oppId)
                  const won = c.matchDetails?.winnerId === me.id
                  const isCreator = c.creatorId === me.id
                  const d = c.matchDetails
                  const score = d?.creatorScore != null ? `${isCreator ? d.creatorScore : d.opponentScore} – ${isCreator ? d.opponentScore : d.creatorScore}` : ''
                  return (
                    <button key={c.id} type="button" className="k-item" onClick={() => navigate(`/match/${c.id}`)}>
                      <Avatar name={opp?.pseudo ?? '?'} size={40} />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <b className="k-ellipsis" style={{ display: 'block' }}>{opp ? opp.pseudo : 'Défi annulé'}</b>
                        <span className="k-dim k-small">{minutesAgo(c.createdAt)}{score && ` · ${score}`}</span>
                      </span>
                      {c.status === 'cancelled' ? <span className="k-pill" style={{ background: 'var(--k-s2)', color: 'var(--k-muted)' }}>Annulé</span>
                        : <b style={{ color: won ? 'var(--k-green)' : 'var(--k-red)' }}>{won ? `+${sc(prizeOf(c.amount))}` : `−${sc(c.amount)}`}</b>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ================= 2. Lancer un défi =================
const AMOUNTS = [10, 25, 50, 100]
export function CreateChallengeV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const [params] = useSearchParams()
  const presetTo = params.get('to')
  const presetAmount = Number(params.get('amount')) || 50
  const [amount, setAmount] = useState(presetAmount)
  const [custom, setCustom] = useState(AMOUNTS.includes(presetAmount) ? '' : String(presetAmount))
  const [who, setWho] = useState<'all' | 'friend'>(presetTo ? 'friend' : 'all')
  const [friendId, setFriendId] = useState<string | null>(presetTo)
  const [platform, setPlatform] = useState('Mobile')
  const [hours, setHours] = useState(6)
  const { run, busy } = useAction()
  const friends = userService.getFriends(me.id)
  const target = friendId ? userService.getById(friendId) : undefined
  const stake = custom ? Math.max(0, Math.round(Number(custom) || 0)) : amount

  async function publish() {
    if (stake < 1) return snack('Choisis une mise', 'warning')
    if (stake > me.walletBalance.available) return snack(`Solde insuffisant : tu as ${sc(me.walletBalance.available)} SC`, 'error')
    if (who === 'friend' && !friendId) return snack('Choisis un ami', 'warning')
    const c = await run(() => challengeService.create({
      amount: stake, matchType: 'Défi 1v1', platform, challengeType: 'public', expirationHours: hours,
      invitedUserId: who === 'friend' ? friendId : null,
    }), who === 'friend' ? `Défi envoyé à ${target?.pseudo}` : 'Défi publié !')
    if (c) navigate(`/match/${c.id}`, { replace: true })
  }

  return (
    <div className="screen">
      <TopBar back title="Lancer un défi" />
      <div className="k-body" style={{ flex: 1 }}>
        <p className="k-label" style={{ margin: '8px 0 10px' }}>SkillCoins en jeu</p>
        <div className="k-chips">
          {AMOUNTS.map((a) => <button key={a} type="button" className={`k-chip${!custom && amount === a ? ' on' : ''}`} onClick={() => { setAmount(a); setCustom('') }}>{a}</button>)}
          <label className={`k-chip${custom ? ' on' : ''}`} style={{ paddingRight: 8 }}>
            <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="Autre" aria-label="Autre montant"
              style={{ width: 64, border: 0, outline: 0, background: 'transparent', color: 'inherit', font: 'inherit' }} />
          </label>
        </div>
        <p className="k-dim k-small" style={{ marginTop: 8 }}>Tu as {sc(me.walletBalance.available)} SC disponibles</p>

        <p className="k-label" style={{ margin: '24px 0 10px' }}>Contre qui ?</p>
        <div className="k-chips">
          <button type="button" className={`k-chip${who === 'all' ? ' on' : ''}`} onClick={() => setWho('all')}>Tout le monde</button>
          <button type="button" className={`k-chip${who === 'friend' ? ' on' : ''}`} onClick={() => setWho('friend')}>Un ami</button>
        </div>
        {who === 'friend' && (
          friends.length === 0 && !target ? (
            <p className="k-small k-muted mt-8">Tu n'as pas encore d'amis. <button type="button" className="k-link" onClick={() => navigate('/friends')}>Ajouter des amis</button></p>
          ) : (
            <div className="k-chips mt-12">
              {(target && !friends.some((f) => f.id === target.id) ? [target, ...friends] : friends).map((f) => (
                <button key={f.id} type="button" className={`k-chip sm${friendId === f.id ? ' on' : ''}`} onClick={() => setFriendId(f.id)}>
                  <Avatar name={f.pseudo} size={22} />{f.pseudo}
                </button>
              ))}
            </div>
          )
        )}

        <p className="k-label" style={{ margin: '24px 0 10px' }}>Plateforme</p>
        <div className="k-chips">
          {['Mobile', 'Console', 'PC'].map((p) => <button key={p} type="button" className={`k-chip${platform === p ? ' on' : ''}`} onClick={() => setPlatform(p)}>{p}</button>)}
        </div>

        <p className="k-label" style={{ margin: '24px 0 10px' }}>Le défi reste ouvert</p>
        <div className="k-chips">
          {[1, 6, 24].map((h) => <button key={h} type="button" className={`k-chip${hours === h ? ' on' : ''}`} onClick={() => setHours(h)}>{h} h</button>)}
        </div>

        <div className="k-card" style={{ marginTop: 26 }}>
          <div className="row between"><span className="k-muted">Ta mise</span><b>{sc(stake)} SC</b></div>
          <div className="row between" style={{ marginTop: 8 }}><span className="k-muted">Le gagnant reçoit</span><b className="yellow">{sc(prizeOf(stake))} SC</b></div>
          <div className="k-dim k-xs" style={{ marginTop: 8 }}>Cagnotte de {sc(stake * 2)} SC moins 20 % de commission. Si personne n'accepte, ta mise est rendue.</div>
        </div>
      </div>
      <div style={{ padding: '16px 20px calc(24px + var(--safe-bottom))' }}>
        <button type="button" className="k-btn primary block" disabled={busy} onClick={publish}>{busy ? <span className="spinner" /> : who === 'friend' && target ? `Défier ${target.pseudo}` : 'Publier le défi'}</button>
      </div>
    </div>
  )
}
