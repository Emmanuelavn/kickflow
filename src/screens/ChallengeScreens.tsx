// Transposé de challenge_list_screen.dart, create_challenge_screen.dart, challenge_detail_screen.dart
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3, Calendar, CheckCircle2, Clock, Coins, Gamepad2, Info, PlusCircle, Search, SearchX, SlidersHorizontal,
  Timer, Trophy, Users, XCircle, Flag, type LucideIcon,
} from 'lucide-react'
import { AppBar, Avatar, BottomSheet, Button, Dialog, Empty, SelectField, useAction, useSnack } from '../components/ui'
import { SoccerBall } from '../components/icons'
import { useUser } from '../services/auth'
import { useDb } from '../lib/db'
import { canDispute, challengeService, STATUS_META, TYPE_META, COMMISSION_RATE } from '../services/challenges'
import { userService } from '../services/users'
import { expiresIn, formatDate, sc, timeAgo } from '../lib/format'
import type { Challenge, ChallengeType } from '../lib/types'

const glass = { background: 'rgba(26,35,50,.7)', border: '1px solid rgba(0,229,255,.3)', borderRadius: 20 } as const

function TabButton({ label, icon: Icon, selected, onTap, color }: { label: string; icon: LucideIcon; selected: boolean; onTap: () => void; color: string }) {
  return (
    <button type="button" onClick={onTap} className="row" style={{
      flex: 1, justifyContent: 'center', gap: 6, padding: '14px 4px', borderRadius: 16, cursor: 'pointer',
      background: selected ? `color-mix(in srgb, ${color} 20%, transparent)` : 'rgba(26,35,50,.5)',
      border: `2px solid ${selected ? `color-mix(in srgb, ${color} 50%, transparent)` : 'var(--border-dark)'}`,
      color: selected ? color : 'var(--text-grey)', fontWeight: 700, fontSize: 14, transition: 'all .3s',
    }}>
      <Icon size={18} />{label}
    </button>
  )
}

function AmountBadge({ amount }: { amount: number }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 12, textAlign: 'center', background: 'linear-gradient(90deg, rgba(255,214,10,.3), rgba(255,107,53,.3))' }}>
      <div style={{ color: 'var(--yellow)', fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{sc(amount)}</div>
      <div style={{ color: 'var(--text-grey)', fontSize: 10, fontWeight: 700 }}>SC</div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, value, color = 'var(--cyan)' }: { icon: LucideIcon; label: string; value: string; color?: string }) {
  return (
    <div className="row" style={{ padding: '10px 0' }}>
      <span style={{ padding: 8, borderRadius: 10, background: `color-mix(in srgb, ${color} 15%, transparent)`, display: 'grid' }}><Icon size={18} color={color} /></span>
      <span className="grow grey">{label}</span>
      <span className="bold" style={{ textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ================= Liste des défis =================
export function ChallengeListScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const [tab, setTab] = useState(2)
  const [query, setQuery] = useState('')
  const [minBudget, setMinBudget] = useState<number | null>(null)
  const [maxBudget, setMaxBudget] = useState<number | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState<Challenge | null>(null)
  const [mine, setMine] = useState<Challenge | null>(null)

  const available = challengeService.getAvailable(user).filter((c) =>
    (minBudget == null || c.amount >= minBudget) && (maxBudget == null || c.amount <= maxBudget) &&
    (!query || c.matchType.toLowerCase().includes(query.toLowerCase()) || c.platform.toLowerCase().includes(query.toLowerCase())))
  const myChallenges = challengeService.getCreatedBy(user.id)

  async function accept(c: Challenge) {
    try {
      await challengeService.accept(c.id)
      setSelected(null)
      snack('Défi accepté ! Préparez-vous pour le match 🎮', 'success')
      navigate(`/match/${c.id}/lobby`)
    } catch (e) {
      setSelected(null)
      snack((e as Error).message || "Erreur lors de l'acceptation du défi", 'error')
    }
  }

  return (
    <div className="screen with-nav" style={{ background: 'linear-gradient(180deg, #8B1A1A, #2A0D0D)' }}>
      <div style={{ padding: 16 }}>
        <div className="anim-fade">
          <h1 className="display-sm black">Défis</h1>
          <p className="body-md mt-4" style={{ color: 'rgba(255,255,255,.7)' }}>Créez ou rejoignez des défis disponibles</p>
        </div>
        <div className="row mt-16">
          <label className="row grow" style={{ padding: '0 16px', height: 50, borderRadius: 16, background: 'rgba(26,35,50,.5)', border: '1px solid rgba(0,229,255,.3)' }}>
            <Search size={20} color="var(--cyan)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." aria-label="Rechercher"
              style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 15 }} />
          </label>
          <button type="button" className="icon-btn" aria-label="Filtres" onClick={() => setFilterOpen(true)}
            style={{ width: 50, height: 50, borderRadius: 16, background: 'rgba(26,35,50,.5)', border: '1px solid rgba(0,229,255,.3)', color: 'var(--cyan)' }}>
            <SlidersHorizontal size={22} />
          </button>
        </div>
        <div className="row mt-16 gap-8">
          <TabButton label="Créer" icon={PlusCircle} selected={tab === 0} onTap={() => setTab(0)} color="var(--cyan)" />
          <TabButton label="Mes Défis" icon={Trophy} selected={tab === 1} onTap={() => setTab(1)} color="var(--pink)" />
          <TabButton label="Disponibles" icon={Users} selected={tab === 2} onTap={() => setTab(2)} color="#fff" />
        </div>
      </div>

      <div style={{ padding: '0 16px 16px', flex: 1 }}>
        {tab === 0 && (
          <div className="center-col anim-scale" style={{ ...glass, borderRadius: 24, padding: 32, minHeight: 360 }}>
            <span style={{ padding: 24, borderRadius: '50%', background: 'rgba(0,229,255,.15)' }}><SoccerBall size={64} color="var(--cyan)" /></span>
            <h2 className="headline-md mt-24">Créer un Nouveau Défi</h2>
            <p className="body-md mt-12">Configurez votre défi avec vos propres règles</p>
            <Button block icon={PlusCircle} style={{ marginTop: 32 }} onClick={() => navigate('/challenges/create')}>Créer un Défi</Button>
          </div>
        )}

        {tab === 1 && (myChallenges.length === 0 ? (
          <Empty icon={Trophy} title="Aucun défi créé" text="Créez votre premier défi !" />
        ) : myChallenges.map((c, i) => (
          <MyChallengeCard key={c.id} c={c} index={i} onOpen={() => setMine(c)} />
        )))}

        {tab === 2 && (available.length === 0 ? (
          <Empty icon={SearchX} title="Aucun défi disponible" text="Essayez de modifier vos filtres" />
        ) : available.map((c, i) => (
          <button key={c.id} type="button" className="row anim-up" onClick={() => setSelected(c)}
            style={{ ...glass, width: '100%', padding: 20, marginBottom: 16, gap: 16, textAlign: 'left', cursor: 'pointer', animationDelay: `${i * 50}ms` }}>
            <span style={{ padding: 16, borderRadius: 16, background: 'linear-gradient(90deg, rgba(0,229,255,.3), rgba(157,78,221,.3))' }}><SoccerBall size={32} color="var(--cyan)" /></span>
            <span className="grow">
              <span className="title-lg bold" style={{ display: 'block' }}>{c.matchType}</span>
              <span className="row body-sm grey mt-4" style={{ gap: 4 }}>
                <Gamepad2 size={14} />{c.platform}<span style={{ width: 8 }} /><BarChart3 size={14} />Niveau {c.requiredLevel}+
              </span>
              <span className="body-sm" style={{ display: 'block', marginTop: 4 }}>{userService.getById(c.creatorId)?.pseudo} · {timeAgo(c.createdAt)}</span>
            </span>
            <AmountBadge amount={c.amount} />
          </button>
        )))}
      </div>

      {/* Filtres */}
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} min={minBudget} max={maxBudget}
        onApply={(mn, mx) => { setMinBudget(mn); setMaxBudget(mx); setFilterOpen(false) }} />

      {/* Détail d'un défi disponible */}
      <BottomSheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && <ChallengeSheet c={selected} onAccept={() => accept(selected)} onCancel={() => setSelected(null)} />}
      </BottomSheet>

      {/* Détail d'un de mes défis */}
      <BottomSheet open={!!mine} onClose={() => setMine(null)}>
        {mine && <MyChallengeSheet c={challengeService.getById(mine.id) ?? mine} onClose={() => setMine(null)} />}
      </BottomSheet>
    </div>
  )
}

function FilterSheet({ open, onClose, min, max, onApply }: { open: boolean; onClose: () => void; min: number | null; max: number | null; onApply: (a: number | null, b: number | null) => void }) {
  const [tmin, setTmin] = useState(min ?? 0)
  const [tmax, setTmax] = useState(max ?? 500)
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="row">
        <span style={{ padding: 8, borderRadius: 12, background: 'rgba(0,229,255,.2)', display: 'grid' }}><SlidersHorizontal color="var(--cyan)" /></span>
        <h3 className="headline-sm">Filtres</h3>
      </div>
      <p className="title-sm mt-24">Budget minimum : <span className="cyan">{tmin > 0 ? `${tmin} SC` : 'Aucun'}</span></p>
      <input type="range" min={0} max={500} step={5} value={tmin} onChange={(e) => setTmin(+e.target.value)} style={{ width: '100%', accentColor: 'var(--cyan)' }} aria-label="Budget minimum" />
      <p className="title-sm mt-16">Budget maximum : <span className="pink">{tmax < 500 ? `${tmax} SC` : 'Aucun'}</span></p>
      <input type="range" min={0} max={500} step={5} value={tmax} onChange={(e) => setTmax(+e.target.value)} style={{ width: '100%', accentColor: 'var(--pink)' }} aria-label="Budget maximum" />
      <div className="row mt-24">
        <Button variant="outline" style={{ flex: 1 }} onClick={() => { setTmin(0); setTmax(500); onApply(null, null) }}>Réinitialiser</Button>
        <Button style={{ flex: 1 }} onClick={() => onApply(tmin > 0 ? tmin : null, tmax < 500 ? tmax : null)}>Appliquer</Button>
      </div>
    </BottomSheet>
  )
}

function ChallengeSheet({ c, onAccept, onCancel }: { c: Challenge; onAccept: () => void; onCancel: () => void }) {
  const creator = userService.getById(c.creatorId)
  const t = TYPE_META[c.challengeType]
  return (
    <div>
      <div className="row" style={{ gap: 16 }}>
        <span style={{ padding: 16, borderRadius: 16, background: 'linear-gradient(90deg, rgba(0,229,255,.3), rgba(157,78,221,.3))' }}><SoccerBall size={32} color="var(--cyan)" /></span>
        <div>
          <h3 className="headline-sm bold">{c.matchType}</h3>
          <span className="pill mt-4" style={{ background: `color-mix(in srgb, ${t.color} 20%, transparent)`, color: t.color, border: `1px solid color-mix(in srgb, ${t.color} 50%, transparent)`, borderRadius: 8 }}>{t.label}</span>
        </div>
      </div>
      {creator && (
        <div className="row card bordered mt-24" style={{ background: 'rgba(26,35,50,.5)', borderRadius: 16 }}>
          <Avatar name={creator.pseudo} photo={creator.profilePhoto} size={56} />
          <div>
            <p className="title-md bold">{creator.pseudo}</p>
            <p className="row body-sm grey mt-4" style={{ gap: 4 }}>
              <Trophy size={14} color="var(--yellow)" />Niveau {creator.stats.level}
              <span style={{ width: 8 }} /><Flag size={14} color="var(--success)" />{creator.stats.wins}V - {creator.stats.losses}D
            </p>
          </div>
        </div>
      )}
      <p className="title-lg mt-24">Détails du Défi</p>
      <DetailRow icon={Coins} label="Montant" value={`${sc(c.amount)} SC`} color="var(--yellow)" />
      <DetailRow icon={Gamepad2} label="Plateforme" value={c.platform} />
      <DetailRow icon={BarChart3} label="Niveau requis" value={`Niveau ${c.requiredLevel}+`} color="var(--purple)" />
      {c.expiresAt && <DetailRow icon={Timer} label="Expire" value={expiresIn(c.expiresAt)} color="var(--orange)" />}
      <DetailRow icon={Calendar} label="Créé" value={timeAgo(c.createdAt)} color="var(--text-grey)" />
      <div className="card mt-16" style={{ background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.3)', borderRadius: 16 }}>
        <p className="row title-sm"><Info size={20} color="var(--cyan)" />Informations du Match</p>
        <p className="body-md mt-8">Type: {c.matchType}</p>
        <p className="mt-4 bold yellow">Le gagnant remportera {sc(c.amount * 2 * (1 - COMMISSION_RATE))} SC</p>
        <p className="body-sm mt-4">Cagnotte {sc(c.amount * 2)} SC, commission {COMMISSION_RATE * 100} %</p>
      </div>
      <Button variant="success" block icon={CheckCircle2} style={{ marginTop: 24 }} onClick={onAccept}>Accepter le Défi ({sc(c.amount)} SC)</Button>
      <Button variant="outline" block style={{ marginTop: 12, color: 'var(--text-grey)', borderColor: 'var(--border-dark)' }} onClick={onCancel}>Annuler</Button>
    </div>
  )
}

function MyChallengeCard({ c, index, onOpen }: { c: Challenge; index: number; onOpen: () => void }) {
  const { run, busy } = useAction()
  const [confirm, setConfirm] = useState(false)
  const s = STATUS_META[c.status]
  return (
    <div className="anim-up" style={{ ...glass, border: `1px solid color-mix(in srgb, ${s.color} 40%, transparent)`, padding: 20, marginBottom: 16, animationDelay: `${index * 50}ms` }}>
      <button type="button" className="row" onClick={onOpen} style={{ width: '100%', gap: 16, background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
        <span style={{ padding: 16, borderRadius: 16, background: `color-mix(in srgb, ${s.color} 20%, transparent)` }}><SoccerBall size={32} color={s.color} /></span>
        <span className="grow">
          <span className="title-lg bold" style={{ display: 'block' }}>{c.matchType}</span>
          <span className="row body-sm grey mt-4" style={{ gap: 4 }}><Gamepad2 size={14} />{c.platform}</span>
          <span className="pill mt-8" style={{ background: `color-mix(in srgb, ${s.color} 20%, transparent)`, color: s.color }}>{s.label}</span>
        </span>
        <AmountBadge amount={c.amount} />
      </button>
      {c.status === 'pending' && (
        <Button variant="outline" block sm icon={XCircle} style={{ marginTop: 16, color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => setConfirm(true)}>Annuler le défi</Button>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <h3 className="headline-sm">Annuler le défi</h3>
        <p className="body-md mt-12">Êtes-vous sûr de vouloir annuler ce défi ? Votre mise sera remboursée.</p>
        <div className="dialog-actions">
          <Button variant="text" onClick={() => setConfirm(false)}>Non</Button>
          <Button variant="danger" sm loading={busy} onClick={async () => {
            await run(() => challengeService.cancel(c.id), 'Défi annulé avec succès !')
            setConfirm(false)
          }}>Oui, annuler</Button>
        </div>
      </Dialog>
    </div>
  )
}

function MyChallengeSheet({ c, onClose }: { c: Challenge; onClose: () => void }) {
  const navigate = useNavigate()
  const opponent = userService.getById(c.opponentId)
  return (
    <div>
      <h3 className="headline-sm">Mon Défi</h3>
      <div className="mt-16">
        <DetailRow icon={Gamepad2} label="Type de match" value={c.matchType} />
        <DetailRow icon={Coins} label="Montant" value={`${sc(c.amount)} SC`} />
        <DetailRow icon={Gamepad2} label="Plateforme" value={c.platform} />
        <DetailRow icon={BarChart3} label="Niveau requis" value={`Niveau ${c.requiredLevel}+`} />
        <DetailRow icon={Info} label="Statut" value={STATUS_META[c.status].label} />
        <DetailRow icon={Calendar} label="Créé" value={timeAgo(c.createdAt)} />
        {c.expiresAt && <DetailRow icon={Timer} label="Expire" value={expiresIn(c.expiresAt)} />}
      </div>
      {opponent && (
        <>
          <hr style={{ border: 0, borderTop: '1px solid var(--border-dark)', margin: '16px 0' }} />
          <p className="title-md green">Adversaire trouvé !</p>
          <div className="row mt-12"><Avatar name={opponent.pseudo} size={40} /><span className="bold">{opponent.pseudo}</span><span className="body-sm">Niveau {opponent.stats.level}</span></div>
        </>
      )}
      {(c.status === 'accepted' || c.status === 'inProgress') && (
        <Button block icon={Gamepad2} style={{ marginTop: 24 }} onClick={() => { onClose(); navigate(`/match/${c.id}/${c.status === 'inProgress' ? 'live' : 'lobby'}`) }}>Rejoindre le Match Lobby</Button>
      )}
      <Button variant="text" block style={{ marginTop: 8 }} onClick={() => { onClose(); navigate(`/challenges/${c.id}`) }}>Voir la fiche complète</Button>
    </div>
  )
}

// ================= Création =================
const MATCH_TYPES = ['Défi 1v1', 'Défi 2v2', 'Défi 3v3']
const PLATFORMS = ['PS5', 'Xbox', 'PC', 'Mobile']

export function CreateChallengeScreen() {
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const [amount, setAmount] = useState(10)
  const [matchType, setMatchType] = useState(MATCH_TYPES[0])
  const [platform, setPlatform] = useState('Mobile')
  const [requiredLevel, setRequiredLevel] = useState(1)
  const [challengeType, setChallengeType] = useState<ChallengeType>('public')
  const [expirationHours, setExpirationHours] = useState(24)
  const { run, busy } = useAction()

  async function submit() {
    if (amount > user.walletBalance.available) return snack('Erreur: Solde insuffisant', 'error')
    const c = await run(() => challengeService.create({ amount, matchType, platform, requiredLevel, challengeType, expirationHours }), 'Défi créé avec succès !')
    if (c) navigate('/defis', { replace: true })
  }

  return (
    <div className="screen">
      <AppBar title="Créer un Défi" back />
      <div className="screen-body">
        <p className="title-md mb-8">SkillCoins en jeu</p>
        <div className="center-col" style={{ padding: 20, borderRadius: 12, background: 'rgba(0,229,255,.1)', border: '1px solid rgba(0,229,255,.3)' }}>
          <p className="display-sm cyan">{amount} Tokens</p>
          <input type="range" min={5} max={500} step={5} value={amount} onChange={(e) => setAmount(+e.target.value)} style={{ width: '100%', accentColor: 'var(--cyan)', marginTop: 12 }} aria-label="Montant" />
          <p className="body-sm mt-8">Disponible : {sc(user.walletBalance.available)} SC</p>
        </div>
        <p className="title-md mt-24 mb-8">Type de défi</p>
        <SelectField label="Format" icon={Gamepad2} value={matchType} options={MATCH_TYPES.map((v) => ({ value: v, label: v }))} onChange={setMatchType} />
        <p className="title-md mb-8">Plateforme</p>
        <SelectField label="Plateforme" icon={Gamepad2} value={platform} options={PLATFORMS.map((v) => ({ value: v, label: v }))} onChange={setPlatform} />
        <p className="title-md mb-8">Niveau minimum requis</p>
        <SelectField label="Niveau" icon={BarChart3} value={requiredLevel} options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `Niveau ${i + 1}+` }))} onChange={setRequiredLevel} />
        <p className="title-md mb-8">Type de défi</p>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {([['public', 'Public'], ['friends', 'Amis'], ['private', 'Privé']] as const).map(([v, l]) => (
            <button key={v} type="button" className={`chip${challengeType === v ? ' selected' : ''}`} onClick={() => setChallengeType(v)}>{l}</button>
          ))}
        </div>
        <p className="title-md mt-16 mb-8">Expiration</p>
        <SelectField label="Durée" icon={Clock} value={expirationHours} options={[[1, '1 heure'], [6, '6 heures'], [24, '24 heures'], [48, '48 heures']].map(([v, l]) => ({ value: v as number, label: l as string }))} onChange={setExpirationHours} />
        <Button block loading={busy} style={{ marginTop: 16 }} onClick={submit}>Créer le défi</Button>
      </div>
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
          <div><p className="grey" style={{ fontSize: 13 }}>Montant</p><p className="headline-lg yellow">{sc(c.amount)} SC</p></div>
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
