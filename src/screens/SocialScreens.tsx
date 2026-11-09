// Transposé de tournaments_screen, create_tournament_screen, tournament_detail_screen, leaderboard_screen,
// referral_screen, influencer_dashboard, friends_screen (.dart)
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Calendar, Coins, Copy, Crown, Gift, LayoutGrid, Plus, Search, Share2, Star, Trophy, UserMinus, UserPlus, Users, Zap,
} from 'lucide-react'
import { AppBar, Avatar, Button, Dialog, Empty, IconButton, TextArea, TextField, useAction, useSnack } from '../components/ui'
import { useUser } from '../services/auth'
import { db, useDb } from '../lib/db'
import { roundName, tournamentService, TOURNAMENT_STATUS } from '../services/tournaments'
import { userService } from '../services/users'
import { expiresIn, formatDate, sc } from '../lib/format'
import { tournamentPrizes, type ReferralTier, type TournamentType, type User } from '../lib/types'

// ================= Compétitions =================
export function TournamentsScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const { run } = useAction()
  const list = tournamentService.list()

  return (
    <div className="screen" style={{ background: 'linear-gradient(180deg, #2E1065, var(--dark-navy))' }}>
      <AppBar title="Compétitions" back actions={<IconButton icon={Plus} label="Créer un tournoi" onClick={() => navigate('/tournaments/create')} />} />
      <div className="screen-body">
        {list.length === 0 ? <Empty icon={Trophy} title="Aucune compétition" text="Créez la première !" /> : list.map((t, i) => {
          const s = TOURNAMENT_STATUS[t.status]
          const joined = t.participants.includes(user.id)
          const full = t.participants.length >= t.maxPlayers
          return (
            <div key={t.id} className="card anim-up" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(157,78,221,.35), rgba(127,90,240,.2))', border: '1px solid rgba(157,78,221,.5)', animationDelay: `${i * 50}ms` }}>
              <button type="button" onClick={() => navigate(`/tournaments/${t.id}`)} style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}>
                <div className="row between">
                  <span className="pill" style={{ background: `color-mix(in srgb, ${s.color} 20%, transparent)`, color: s.color }}>{s.label}</span>
                  <span className="body-sm">{t.status === 'registration' ? expiresIn(t.startDate) : ''}</span>
                </div>
                <p className="headline-sm mt-12">{t.name}</p>
                {t.description && <p className="body-md mt-4">{t.description}</p>}
                <div className="row mt-12" style={{ flexWrap: 'wrap', gap: 14 }}>
                  <span className="row" style={{ gap: 4 }}><Users size={16} color="var(--cyan)" />{t.participants.length}/{t.maxPlayers} joueurs</span>
                  <span className="row" style={{ gap: 4 }}><Coins size={16} color="var(--yellow)" />{sc(t.entryFee)} SC</span>
                  <span className="row" style={{ gap: 4 }}><Trophy size={16} color="var(--yellow)" />{sc(tournamentPrizes(t).prizePool)} SC</span>
                </div>
              </button>
              {t.status === 'registration' && (
                <Button block sm style={{ marginTop: 16 }} disabled={joined || full}
                  onClick={() => run(() => tournamentService.join(t.id), 'Inscription réussie !')}>
                  {joined ? '✅ Inscrit' : full ? 'Complet' : `S'inscrire (${sc(t.entryFee)} SC)`}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CreateTournamentScreen() {
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fee, setFee] = useState('50')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [type, setType] = useState<TournamentType>('singleElimination')
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16))
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nom requis'
    const amount = parseFloat(fee)
    if (!fee) e.fee = 'Montant requis'
    else if (Number.isNaN(amount) || amount < 0) e.fee = 'Montant invalide'
    setErrors(e)
    if (Object.keys(e).length) return
    const t = await run(() => tournamentService.create({ name: name.trim(), description: description.trim(), entryFee: amount, maxPlayers, type, startDate: new Date(date).toISOString() }))
    if (t) navigate(`/tournaments/${t.id}`, { replace: true })
  }

  return (
    <div className="screen">
      <AppBar title="Créer un tournoi" back />
      <div className="screen-body">
        <TextField label="Nom du tournoi" icon={Trophy} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextArea label="Description (optionnel)" value={description} onChange={setDescription} rows={3} />
        <TextField label="Frais d'inscription (SC)" icon={Coins} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))} error={errors.fee} />
        <p className="title-md mb-8">Nombre de joueurs</p>
        <div className="row gap-8 mb-16">
          {[4, 8, 16, 32].map((n) => <button key={n} type="button" className={`chip${maxPlayers === n ? ' selected' : ''}`} onClick={() => setMaxPlayers(n)}>{n}</button>)}
        </div>
        <p className="title-md mb-8">Format</p>
        {([['singleElimination', 'Élimination Simple', 'Une défaite = élimination'], ['doubleElimination', 'Élimination Double', 'Deux chances avant élimination']] as const).map(([v, t, s]) => (
          <label key={v} className="row" style={{ padding: 14, marginBottom: 8, borderRadius: 14, cursor: 'pointer', background: type === v ? 'rgba(0,229,255,.12)' : 'var(--card-dark)', border: `1px solid ${type === v ? 'var(--cyan)' : 'var(--border-dark)'}` }}>
            <input type="radio" checked={type === v} onChange={() => setType(v)} style={{ accentColor: 'var(--cyan)', width: 18, height: 18 }} />
            <span><span className="bold" style={{ display: 'block' }}>{t}</span><span className="body-sm">{s}</span></span>
          </label>
        ))}
        <div className="mt-8" />
        <TextField label="Date de début" icon={Calendar} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="card" style={{ background: 'rgba(255,214,10,.1)', border: '1px solid rgba(255,214,10,.3)' }}>
          <p>🥇 1er place: 60% du prize pool</p><p>🥈 2e place: 25% du prize pool</p><p>🥉 3e place: 15% du prize pool</p>
          <p className="body-sm mt-8">Prize pool = 80 % des frais d'inscription collectés.</p>
        </div>
        <Button block loading={busy} style={{ marginTop: 24 }} onClick={submit}>Créer le tournoi</Button>
      </div>
    </div>
  )
}

export function TournamentDetailScreen() {
  useDb()
  const { id = '' } = useParams()
  const user = useUser()
  const snack = useSnack()
  const { run } = useAction()
  const [tab, setTab] = useState(0)
  const [scoring, setScoring] = useState<string | null>(null)
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const t = tournamentService.get(id)
  if (!t) return <div className="screen"><AppBar title="Tournoi" back /><Empty icon={Trophy} title="Tournoi introuvable" /></div>
  const p = tournamentPrizes(t)
  const isOrganizer = t.createdBy === user.id || !!user.isAdmin
  const name = (uid?: string | null) => (uid ? userService.getById(uid)?.pseudo ?? '?' : 'TBD')

  return (
    <div className="screen">
      <AppBar title={t.name} back />
      <div style={{ padding: '0 16px' }}>
        <div className="row" style={{ padding: 4, borderRadius: 14, background: 'var(--card-dark)' }}>
          {['Aperçu', 'Bracket', 'Participants'].map((l, i) => (
            <button key={l} type="button" onClick={() => setTab(i)} className="grow" style={{ padding: 10, borderRadius: 10, border: 0, cursor: 'pointer', fontWeight: 700, background: tab === i ? 'var(--purple)' : 'transparent', color: tab === i ? '#fff' : 'var(--text-grey)' }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="screen-body">
        {tab === 0 && (
          <>
            <span className="pill" style={{ background: `color-mix(in srgb, ${TOURNAMENT_STATUS[t.status].color} 20%, transparent)`, color: TOURNAMENT_STATUS[t.status].color }}>{TOURNAMENT_STATUS[t.status].label}</span>
            {t.description && <p className="body-md mt-12">{t.description}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              {([[Users, 'Participants', `${t.participants.length}/${t.maxPlayers}`], [Coins, "Frais d'inscription", `${sc(t.entryFee)} SC`], [Trophy, 'Prize Pool', `${sc(p.prizePool)} SC`], [Calendar, 'Début', formatDate(t.startDate)], [LayoutGrid, 'Type', t.type === 'singleElimination' ? 'Élimination Simple' : 'Élimination Double']] as const).map(([I, l, v]) => (
                <div key={l} className="card" style={{ padding: 14 }}><I size={20} color="var(--cyan)" /><p className="label-sm mt-8">{l}</p><p className="bold">{v}</p></div>
              ))}
            </div>
            <p className="section-title">Récompenses</p>
            {([['🥇 1ère place', p.first, '#FFC107'], ['🥈 2e place', p.second, '#B0BEC5'], ['🥉 3e place', p.third, '#A1887F']] as const).map(([l, v, col], i) => (
              <div key={l} className="row card" style={{ border: `1px solid ${col}` }}>
                <span className="grow bold">{l}</span>{t.top3?.[i] && <span className="grey">{name(t.top3[i])}</span>}<span className="bold" style={{ color: col }}>{sc(v)} SC</span>
              </div>
            ))}
            {t.status === 'completed' && t.winnerId && <p className="card mt-16 center-col headline-sm"><Crown color="var(--yellow)" size={36} />Champion : {name(t.winnerId)}</p>}
            {t.status === 'registration' && isOrganizer && (
              <Button block style={{ marginTop: 24 }} disabled={t.participants.length < 2}
                onClick={async () => { if (await run(async () => { await tournamentService.start(t.id); return true }, 'Tournoi lancé !')) setTab(1) }}>
                {t.participants.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer le tournoi'}
              </Button>
            )}
            {t.status === 'registration' && !t.participants.includes(user.id) && (
              <Button variant="outline" block style={{ marginTop: 12 }} onClick={() => run(() => tournamentService.join(t.id), 'Inscription réussie !')}>S'inscrire ({sc(t.entryFee)} SC)</Button>
            )}
          </>
        )}
        {tab === 1 && (t.matches.length === 0 ? <Empty icon={LayoutGrid} title="Bracket pas encore généré" text="Il apparaîtra au lancement du tournoi." /> : (() => {
          const rounds = Math.max(...t.matches.map((m) => m.round))
          const totalRounds = Math.ceil(Math.log2(Math.max(2, t.participants.length)))
          return Array.from({ length: rounds }, (_, r) => r + 1).map((r) => (
            <div key={r}>
              <p className="section-title">{roundName(r, totalRounds)}</p>
              {t.matches.filter((m) => m.round === r).map((m) => (
                <div key={m.id} className="card" style={{ border: '1px solid var(--border-dark)' }}>
                  {[[m.player1Id, m.player1Score], [m.player2Id, m.player2Score]].map(([pid, score], i) => (
                    <div key={i} className="row between" style={{ padding: '6px 0', fontWeight: m.winnerId && m.winnerId === pid ? 800 : 500, color: m.winnerId && m.winnerId !== pid ? 'var(--text-muted)' : '#fff' }}>
                      <span>{m.winnerId === pid && '🏆 '}{pid ? name(pid as string) : 'Exempt'}</span><span>{score ?? '-'}</span>
                    </div>
                  ))}
                  {!m.winnerId && m.player2Id && t.status === 'ongoing' && (isOrganizer || m.player1Id === user.id || m.player2Id === user.id) && (
                    <Button sm variant="outline" block style={{ marginTop: 8 }} onClick={() => { setScoring(m.id); setS1(''); setS2('') }}>Saisir le résultat</Button>
                  )}
                </div>
              ))}
            </div>
          ))
        })())}
        {tab === 2 && (t.participants.length === 0 ? <Empty icon={Users} title="Aucun participant" /> : t.participants.map((pid) => {
          const u = userService.getById(pid)
          return <div key={pid} className="list-tile" style={{ cursor: 'default' }}><Avatar name={u?.pseudo ?? '?'} size={40} /><div className="grow"><p className="bold">{u?.username}</p>{u && <p className="body-sm">Niveau {u.stats.level} • {u.stats.wins}V-{u.stats.losses}D</p>}</div></div>
        }))}
      </div>
      <Dialog open={!!scoring} onClose={() => setScoring(null)}>
        {(() => {
          const m = t.matches.find((x) => x.id === scoring)
          if (!m) return null
          return (
            <>
              <h3 className="headline-sm">Résultat du match</h3>
              <div className="row mt-16">
                <TextField label={name(m.player1Id)} inputMode="numeric" value={s1} onChange={(e) => setS1(e.target.value.replace(/\D/g, ''))} />
                <TextField label={name(m.player2Id)} inputMode="numeric" value={s2} onChange={(e) => setS2(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="dialog-actions">
                <Button variant="text" onClick={() => setScoring(null)}>Annuler</Button>
                <Button sm onClick={() => {
                  if (s1 === '' || s2 === '' || s1 === s2) return snack('Entrez un score avec un vainqueur', 'warning')
                  run(async () => { await tournamentService.report(t.id, m.id, +s1, +s2); setScoring(null) }, 'Résultat enregistré')
                }}>Valider</Button>
              </div>
            </>
          )
        })()}
      </Dialog>
    </div>
  )
}

// ================= Classement =================
function rankTitle(level: number) {
  if (level >= 50) return 'Légende'
  if (level >= 40) return 'Champion'
  if (level >= 30) return 'Elite'
  if (level >= 20) return 'Or'
  if (level >= 10) return 'Argent'
  return 'Bronze'
}

export function LeaderboardScreen() {
  useDb()
  const user = useUser()
  const [scope, setScope] = useState<'global' | 'weekly' | 'friends' | 'country'>('global')
  let players: User[] = db.list('users')
  if (scope === 'friends') players = [user, ...userService.getFriends(user.id)]
  if (scope === 'country') players = players.filter((u) => u.country && u.country === user.country)
  players = [...players].sort((a, b) => (scope === 'weekly' ? b.stats.wins - a.stats.wins : b.stats.totalEarned - a.stats.totalEarned)).slice(0, 10)
  const medal = ['#FFD60A', '#C0C7D0', '#CD7F32']

  return (
    <div className="screen" style={{ background: 'linear-gradient(180deg, #7A4A00, var(--dark-navy))' }}>
      <AppBar title="Classement" back />
      <div className="screen-body">
        <p className="body-md center-col">Les meilleurs joueurs de l'arène KickFlow</p>
        <div className="chips mt-16 mb-16">
          {([['global', 'Global'], ['weekly', 'Victoires'], ['friends', 'Amis'], ['country', user.country || 'Pays']] as const).map(([v, l]) => (
            <button key={v} type="button" className={`chip${scope === v ? ' selected' : ''}`} onClick={() => setScope(v)}>{l}</button>
          ))}
        </div>
        {players.length === 0 ? <Empty icon={Trophy} title="Classement vide" text="Jouez pour apparaître dans le classement" /> : players.map((p, i) => (
          <div key={p.id} className="row card anim-up" style={{ border: `1px solid ${i < 3 ? medal[i] : p.id === user.id ? 'var(--cyan)' : 'var(--border-dark)'}`, animationDelay: `${i * 40}ms` }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 900, background: i < 3 ? medal[i] : 'var(--border-dark)', color: i < 3 ? 'var(--dark-navy)' : '#fff' }}>{i + 1}</span>
            <Avatar name={p.pseudo} photo={p.profilePhoto} size={44} />
            <div className="grow"><p className="bold ellipsis">{p.pseudo}{p.id === user.id ? ' (vous)' : ''}</p><p className="body-sm">{p.stats.wins}V · Niv. {p.stats.level} · {rankTitle(p.stats.level)}</p></div>
            <div className="center-col"><span className="bold yellow">{sc(p.stats.totalEarned)}</span><span className="label-sm">SC</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================= Parrainage =================
const TIERS: { tier: ReferralTier; label: string; min: number; rate: number }[] = [
  { tier: 'bronze', label: 'Bronze', min: 0, rate: 0.05 },
  { tier: 'silver', label: 'Argent', min: 10, rate: 0.08 },
  { tier: 'gold', label: 'Or', min: 50, rate: 0.1 },
  { tier: 'platinum', label: 'Platine', min: 100, rate: 0.12 },
  { tier: 'diamond', label: 'Diamant', min: 250, rate: 0.15 },
]

function useReferralStats(user: User) {
  const referred = db.list('users').filter((u) => u.referredBy && u.referredBy.toUpperCase() === user.referralCode.toUpperCase())
  const tier = [...TIERS].reverse().find((t) => referred.length >= t.min)!
  const earnings = db.list('referrals').filter((r) => r.referrerId === user.id).reduce((s, r) => s + r.commission, 0)
  const active = referred.filter((u) => u.stats.wins + u.stats.losses > 0).length
  return { referred, tier, earnings, active }
}

export function ReferralScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const { referred, tier, earnings } = useReferralStats(user)
  const link = `${location.origin}/register?ref=${user.referralCode}`

  async function copy() {
    try { await navigator.clipboard.writeText(user.referralCode) } catch { /* ignore */ }
    snack('✅ Code de parrainage copié !', 'success')
  }
  async function share() {
    const text = `Rejoins-moi sur KickFlow pour des défis eFootball ! Mon code : ${user.referralCode}`
    if (navigator.share) { try { await navigator.share({ title: 'KickFlow', text, url: link }) } catch { /* annulé */ } }
    else copy()
  }

  return (
    <div className="screen gradient">
      <AppBar title="💰 Parrainage" back />
      <div className="screen-body">
        <div className="center-col anim-scale" style={{ padding: 24, borderRadius: 24, background: 'linear-gradient(135deg, rgba(255,214,10,.3), rgba(0,229,255,.2))', border: '1px solid rgba(255,214,10,.4)' }}>
          <Gift size={48} color="var(--yellow)" />
          <p className="body-md mt-8">Ton code de parrainage</p>
          <p className="display-md mt-8" style={{ letterSpacing: 4 }}>{user.referralCode}</p>
          <div className="row mt-16" style={{ width: '100%' }}>
            <Button sm variant="yellow" icon={Copy} style={{ flex: 1 }} onClick={copy}>Copier</Button>
            <Button sm icon={Share2} style={{ flex: 1 }} onClick={share}>Partager</Button>
          </div>
        </div>
        <div className="row mt-16">
          <div className="card grow center-col"><Users color="var(--yellow)" /><span className="headline-sm mt-4">{referred.length}</span><span className="label-sm">Filleuls</span></div>
          <div className="card grow center-col"><Coins color="var(--cyan)" /><span className="headline-sm mt-4">{sc(earnings)} SC</span><span className="label-sm">Gains Totaux</span></div>
        </div>
        <div className="card mt-16 row"><Star color="var(--yellow)" /><span className="grow">Palier <b>{tier.label}</b> · commission {(tier.rate * 100).toFixed(0)} %</span></div>
        <p className="section-title">Comment ça marche ?</p>
        {[['1️⃣', 'Partage ton code avec tes amis'], ['2️⃣', "Ils s'inscrivent avec ton code"], ['3️⃣', 'Tu gagnes des SkillCoins bonus quand ils jouent'], ['4️⃣', 'Plus tu parraines, plus tu gagnes !']].map(([i, t]) => (
          <div key={i} className="row list-tile" style={{ cursor: 'default' }}><span style={{ fontSize: 24 }}>{i}</span><span>{t}</span></div>
        ))}
        <Button variant="outline" block icon={Zap} style={{ marginTop: 24 }} onClick={() => navigate('/influencer')}>Programme Influenceur</Button>
      </div>
    </div>
  )
}

export function InfluencerDashboardScreen() {
  useDb()
  const user = useUser()
  const { referred, earnings, active, tier } = useReferralStats(user)
  const next = TIERS.find((t) => t.min > referred.length)
  return (
    <div className="screen gradient">
      <AppBar title="Programme Influenceur" back />
      <div className="screen-body">
        <div className="row">
          <div className="card grow center-col"><Users color="var(--cyan)" /><span className="headline-sm mt-4">{referred.length}</span><span className="label-sm">Total Filleuls</span></div>
          <div className="card grow center-col"><Star color="var(--success)" /><span className="headline-sm mt-4">{active}</span><span className="label-sm">Actifs</span></div>
          <div className="card grow center-col"><Coins color="var(--yellow)" /><span className="headline-sm mt-4">{sc(earnings)}</span><span className="label-sm">Commissions</span></div>
        </div>
        <div className="card mt-16">
          <p className="title-md">Palier actuel : {tier.label}</p>
          {next ? (
            <>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--border-dark)', marginTop: 12, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (referred.length / next.min) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--purple))' }} />
              </div>
              <p className="body-sm mt-8">{next.min - referred.length} filleul(s) avant le palier {next.label} ({(next.rate * 100).toFixed(0)} %)</p>
            </>
          ) : <p className="body-sm mt-8">Palier maximum atteint 💎</p>}
        </div>
        <p className="section-title">Avantages</p>
        {[[Coins, 'Gagnez 5% sur les gains de vos filleuls'], [Gift, 'Bonus de 100 SC par filleul actif'], [Star, 'Accès prioritaire aux tournois VIP']].map(([I, t]) => {
          const Icon = I as typeof Coins
          return <div key={t as string} className="row list-tile" style={{ cursor: 'default' }}><Icon color="var(--yellow)" /><span>{t as string}</span></div>
        })}
        <p className="section-title">Mes filleuls</p>
        {referred.length === 0 ? <Empty icon={Users} title="Aucun filleul pour l'instant" text="Partagez votre code pour commencer" /> : referred.map((u) => (
          <div key={u.id} className="list-tile" style={{ cursor: 'default' }}><Avatar name={u.pseudo} size={40} /><div className="grow"><p className="bold">{u.pseudo}</p><p className="body-sm">{u.stats.wins + u.stats.losses} matchs joués</p></div></div>
        ))}
      </div>
    </div>
  )
}

// ================= Amis =================
export function FriendsScreen() {
  useDb()
  const user = useUser()
  const { run } = useAction()
  const [tab, setTab] = useState(0)
  const [q, setQ] = useState('')
  const [removing, setRemoving] = useState<User | null>(null)
  const friends = userService.getFriends(user.id)
  const results = q.trim() ? userService.search(q.trim()).filter((u) => u.id !== user.id) : []

  return (
    <div className="screen">
      <AppBar title="Amis" back />
      <div style={{ padding: '0 16px' }}>
        <div className="row" style={{ padding: 4, borderRadius: 14, background: 'var(--card-dark)' }}>
          {['Mes Amis', 'Rechercher'].map((l, i) => (
            <button key={l} type="button" onClick={() => setTab(i)} className="grow" style={{ padding: 10, borderRadius: 10, border: 0, cursor: 'pointer', fontWeight: 700, background: tab === i ? 'var(--cyan)' : 'transparent', color: tab === i ? 'var(--dark-navy)' : 'var(--text-grey)' }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="screen-body">
        {tab === 0 && (friends.length === 0 ? <Empty icon={Users} title="Aucun ami" text="Recherchez des joueurs pour les ajouter" /> : friends.map((f) => (
          <div key={f.id} className="list-tile" style={{ cursor: 'default' }}>
            <Avatar name={f.pseudo} photo={f.profilePhoto} size={44} />
            <div className="grow"><p className="bold">{f.pseudo}</p><p className="body-sm">Niveau {f.stats.level} • {f.stats.wins}V-{f.stats.losses}D</p></div>
            <IconButton icon={UserMinus} label="Supprimer" color="var(--error)" onClick={() => setRemoving(f)} />
          </div>
        )))}
        {tab === 1 && (
          <>
            <TextField label="Rechercher" icon={Search} placeholder="Rechercher par pseudo..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            {!q.trim() ? <Empty icon={Search} title="Recherchez des joueurs" /> : results.length === 0 ? <Empty icon={Search} title="Aucun joueur trouvé" /> : results.map((u) => {
              const isFriend = user.friendIds.includes(u.id)
              return (
                <div key={u.id} className="list-tile" style={{ cursor: 'default' }}>
                  <Avatar name={u.pseudo} photo={u.profilePhoto} size={44} />
                  <div className="grow"><p className="bold">{u.pseudo}</p><p className="body-sm">@{u.username} · Niveau {u.stats.level}</p></div>
                  <Button sm icon={UserPlus} disabled={isFriend} onClick={() => run(() => userService.addFriend(u.id), 'Ami ajouté avec succès !')}>{isFriend ? 'Ami' : 'Ajouter'}</Button>
                </div>
              )
            })}
          </>
        )}
      </div>
      <Dialog open={!!removing} onClose={() => setRemoving(null)}>
        <h3 className="headline-sm">Supprimer cet ami ?</h3>
        <p className="body-md mt-12">Voulez-vous vraiment retirer cette personne de votre liste d'amis ?</p>
        <div className="dialog-actions">
          <Button variant="text" onClick={() => setRemoving(null)}>Annuler</Button>
          <Button variant="danger" sm onClick={() => { const id = removing!.id; setRemoving(null); run(() => userService.removeFriend(id), 'Ami supprimé') }}>Supprimer</Button>
        </div>
      </Dialog>
    </div>
  )
}
