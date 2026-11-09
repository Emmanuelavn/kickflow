// Transposé de tournaments_screen, create_tournament_screen, tournament_detail_screen, leaderboard_screen,
// referral_screen, influencer_dashboard, friends_screen (.dart)
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, Coins, Crown, LayoutGrid, Search, Trophy, UserMinus, UserPlus, Users } from 'lucide-react'
import { AppBar, Avatar, Button, Dialog, Empty, IconButton, TextArea, TextField, useAction, useSnack } from '../components/ui'
import { useUser } from '../services/auth'
import { useDb } from '../lib/db'
import { roundName, tournamentService, TOURNAMENT_STATUS } from '../services/tournaments'
import { userService } from '../services/users'
import { formatDate, sc } from '../lib/format'
import { tournamentPrizes, type TournamentType, type User } from '../lib/types'


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
