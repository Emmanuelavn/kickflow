// Tournois, Classement, Notifications + annonces, Portefeuille, Parrainage, Lives, Profil (maquette v2, écrans 6, 8, 10–14)
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown, ArrowUp, BellOff, ChevronRight, CircleDollarSign, Clock, Copy, Edit3, Gift, History, Megaphone, Plus, Radio,
  Scale, Settings, Share2, Swords, Trophy, Users, Wallet, type LucideIcon,
} from 'lucide-react'
import { Avatar, BottomSheet, Dialog, Empty, SelectField, TextField, useAction, useSnack } from '../../components/ui'
import { Section, Seg, TopBar, minutesAgo } from '../../components/kit'
import { useUser } from '../../services/auth'
import { db, useDb } from '../../lib/db'
import { uploadImage } from '../../lib/api'
import { tournamentService, TOURNAMENT_STATUS } from '../../services/tournaments'
import { notificationService } from '../../services/notifications'
import { announcementService, ANNOUNCEMENT_TYPE } from '../../services/announcements'
import { walletService } from '../../services/wallet'
import { userService } from '../../services/users'
import { platformOf, streamService } from '../../services/streams'
import { COUNTRIES } from '../../lib/countries'
import { formatShort, readImage, sc } from '../../lib/format'
import { tournamentPrizes, type NotificationType, type User } from '../../lib/types'

// ================= 8. Tournois =================
export function TournoisV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const list = tournamentService.list().sort((a, b) => ['registration', 'ongoing', 'completed'].indexOf(a.status) - ['registration', 'ongoing', 'completed'].indexOf(b.status))

  return (
    <div className="screen with-nav">
      <TopBar title="Tournois" right={<button type="button" className="k-btn outline sm" onClick={() => navigate('/tournaments/create')}><Plus size={16} />Créer</button>} />
      <div className="k-body">
        {list.length === 0 && <Empty icon={Trophy} title="Aucun tournoi" text="Crée le premier tournoi entre amis." />}
        {list.map((t) => {
          const s = TOURNAMENT_STATUS[t.status]
          const joined = t.participants.includes(me.id)
          const full = t.participants.length >= t.maxPlayers
          const myMatch = t.status === 'ongoing' ? t.matches.find((m) => !m.winnerId && m.player2Id && (m.player1Id === me.id || m.player2Id === me.id)) : undefined
          const p = tournamentPrizes(t)
          return (
            <div key={t.id} className={`k-card${t.status === 'registration' ? ' k-tournament' : ''}`}>
              <div className="row between">
                <span className="k-pill" style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}>{s.label}</span>
                <span className="k-dim k-xs">{t.status === 'completed' && t.winnerId ? `Vainqueur : ${userService.getById(t.winnerId)?.pseudo}` : formatShort(t.startDate)}</span>
              </div>
              <h3 style={{ font: '700 19px var(--font-title)', margin: '12px 0 0' }}>{t.name}</h3>
              <div className="k-muted k-small">{t.type === 'singleElimination' ? 'Élimination directe' : 'Double élimination'}{joined ? ' · tu es inscrit' : ''}</div>
              <div className="row k-small" style={{ marginTop: 12, gap: 14, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 6 }}><Users size={16} color="var(--cyan)" />{t.participants.length}/{t.maxPlayers}</span>
                <span className="row" style={{ gap: 6 }}><CircleDollarSign size={16} color="var(--yellow)" />{sc(t.entryFee)} SC l'entrée</span>
                <span className="row" style={{ gap: 6 }}><Trophy size={16} color="var(--yellow)" />{t.status === 'registration' ? `jusqu'à ${sc(t.entryFee * t.maxPlayers * 0.8)}` : sc(p.prizePool)} SC à gagner</span>
              </div>
              {t.status === 'registration' && <div className="k-progress" style={{ marginTop: 12 }}><span style={{ width: `${(t.participants.length / t.maxPlayers) * 100}%`, background: '#A98BFF' }} /></div>}
              {myMatch && <div className="k-small" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--k-s2)' }}>Ton prochain match : <b>{userService.getById(myMatch.player1Id)?.pseudo} vs {userService.getById(myMatch.player2Id)?.pseudo}</b></div>}
              <div className="row" style={{ marginTop: 14, gap: 8 }}>
                <button type="button" className="k-btn ghost sm grow" onClick={() => navigate(`/tournaments/${t.id}`)}>{t.status === 'registration' ? 'Détails' : 'Voir le tableau'}</button>
                {t.status === 'registration' && !joined && (
                  <button type="button" className="k-btn primary sm grow" disabled={full || busy} onClick={() => run(() => tournamentService.join(t.id), 'Inscription réussie !')}>{full ? 'Complet' : `S'inscrire · ${sc(t.entryFee)} SC`}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ================= 10. Classement =================
export function ClassementV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const [scope, setScope] = useState<'all' | 'wins' | 'friends' | 'country'>('all')
  let players: User[] = db.list('users').filter((u) => u.username !== 'compte_supprime')
  if (scope === 'friends') players = [me, ...userService.getFriends(me.id)]
  if (scope === 'country') players = players.filter((u) => u.country && u.country === me.country)
  const key = (u: User) => (scope === 'wins' ? u.stats.wins : u.stats.totalEarned)
  players = [...players].sort((a, b) => key(b) - key(a) || b.stats.wins - a.stats.wins)
  const myRank = players.findIndex((u) => u.id === me.id) + 1
  const podium = players.slice(0, 3)
  const rest = players.slice(3, 20)
  const value = (u: User) => (scope === 'wins' ? `${u.stats.wins} V` : `${sc(u.stats.totalEarned)} SC`)
  const order = [1, 0, 2]
  const heights = [100, 70, 52]
  const colors = ['var(--yellow)', '#C9D1DA', '#D9A27A']

  return (
    <div className="screen with-nav">
      <TopBar title="Classement" />
      <div className="k-body">
        <div className="k-chips">
          {([['all', 'Général'], ['wins', 'Victoires'], ['friends', 'Amis'], ['country', me.country || 'Mon pays']] as const).map(([v, l]) => (
            <button key={v} type="button" className={`k-chip sm${scope === v ? ' on' : ''}`} onClick={() => setScope(v)}>{l}</button>
          ))}
        </div>
        {players.length === 0 ? <Empty icon={Trophy} title="Classement vide" text="Joue pour apparaître ici." /> : (
          <>
            <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 10, margin: '20px 0 16px' }}>
              {order.map((i) => podium[i] && (
                <div key={podium[i].id} className="col" style={{ alignItems: 'center', gap: 6, width: 104, cursor: 'pointer' }} onClick={() => navigate(podium[i].id === me.id ? '/profil' : `/joueur/${podium[i].id}`)}>
                  <Avatar name={podium[i].pseudo} photo={podium[i].profilePhoto} size={i === 0 ? 54 : 44} />
                  <b className="k-small k-ellipsis" style={{ maxWidth: 100 }}>{podium[i].pseudo}</b>
                  <span className="k-dim k-xs">{value(podium[i])}</span>
                  <div style={{ width: '100%', height: heights[i], borderRadius: '12px 12px 0 0', background: i === 0 ? 'rgba(255,214,10,.16)' : 'var(--k-s2)', display: 'grid', placeItems: 'center', font: '800 24px var(--font-title)', color: colors[i] }}>{i + 1}</div>
                </div>
              ))}
            </div>
            {rest.length > 0 && (
              <div className="k-card k-list">
                {rest.map((u, i) => (
                  <button key={u.id} type="button" className="k-item" onClick={() => navigate(u.id === me.id ? '/profil' : `/joueur/${u.id}`)}><span className="k-dim" style={{ width: 22 }}>{i + 4}</span><Avatar name={u.pseudo} photo={u.profilePhoto} size={36} /><span className="grow k-ellipsis" style={{ fontWeight: 600 }}>{u.pseudo}{u.id === me.id ? ' (toi)' : ''}</span><span className="k-muted k-small">{value(u)}</span></button>
                ))}
              </div>
            )}
            {myRank > 0 && (
              <div className="k-card now row" style={{ marginTop: 10 }}>
                <b style={{ width: 22 }}>{myRank}</b><Avatar name={me.pseudo} photo={me.profilePhoto} size={36} /><b className="grow">Toi · {me.pseudo}</b><span className="k-small">{value(me)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ================= 11. Notifications + annonces =================
const NOTIF_ICON: Partial<Record<NotificationType, [LucideIcon, string]>> = {
  challenge: [Swords, 'var(--cyan)'], match: [Trophy, 'var(--yellow)'], dispute: [Scale, 'var(--k-orange)'],
  referral: [Gift, 'var(--k-green)'], tournament: [Trophy, '#C9B6FF'], social: [Users, 'var(--cyan)'], wallet: [Wallet, 'var(--yellow)'],
}

export function NotificationsV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'annonces' ? 'annonces' : 'toi'
  const { run } = useAction()
  const [openAnn, setOpenAnn] = useState<string | null>(null)
  const list = notificationService.list(me.id)
  const unread = list.filter((n) => !n.isRead).length
  const anns = announcementService.getAll()
  const annUnread = announcementService.getUnreadCount()
  const current = anns.find((a) => a.id === openAnn)

  return (
    <div className="screen">
      <TopBar back title="Notifications" right={tab === 'toi' && unread > 0 ? <button type="button" className="k-link" onClick={() => run(notificationService.markAllAsRead)}>Tout lire</button>
        : tab === 'annonces' && annUnread > 0 ? <button type="button" className="k-link" onClick={() => announcementService.markAllAsRead()}>Tout lire</button> : null} />
      <div className="k-body">
        <Seg value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={[['toi', `Pour toi${unread ? ` · ${unread}` : ''}`], ['annonces', `Annonces${annUnread ? ` · ${annUnread}` : ''}`]]} />
        <div className="mt-12">
          {tab === 'toi' && (list.length === 0 ? <Empty icon={BellOff} title="Aucune notification" /> : (
            <div className="k-card k-list">
              {list.map((n) => {
                const [Icon, color] = NOTIF_ICON[n.type] ?? [Megaphone, 'var(--k-muted)']
                return (
                  <button key={n.id} type="button" className="k-item" style={{ alignItems: 'flex-start' }} onClick={() => {
                    if (!n.isRead) run(() => notificationService.markAsRead(n.id))
                    if (n.relatedId && ['challenge', 'match', 'dispute'].includes(n.type)) navigate(`/match/${n.relatedId}`)
                    else if (n.relatedId && n.type === 'tournament') navigate(`/tournaments/${n.relatedId}`)
                  }}>
                    <Icon size={22} color={color} style={{ marginTop: 2 }} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', color: n.isRead ? 'var(--k-muted)' : 'var(--k-text)' }}>{n.title.replace(/^\P{L}+/u, '')}</b>
                      <span className="k-muted k-small" style={{ display: 'block' }}>{n.message}</span>
                      <span className="k-dim k-xs">{minutesAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--k-red)', marginTop: 6, flex: 'none' }} />}
                  </button>
                )
              })}
            </div>
          ))}
          {tab === 'annonces' && (anns.length === 0 ? <Empty icon={Megaphone} title="Aucune annonce" /> : (
            <div className="k-card k-list">
              {anns.map((a) => {
                const t = ANNOUNCEMENT_TYPE[a.type]
                const read = announcementService.isRead(a.id)
                return (
                  <button key={a.id} type="button" className="k-item" style={{ alignItems: 'flex-start' }} onClick={() => { announcementService.markAsRead(a.id); setOpenAnn(a.id) }}>
                    <Megaphone size={22} color={t.color} style={{ marginTop: 2 }} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', color: read ? 'var(--k-muted)' : 'var(--k-text)' }}>{a.title.replace(/^\P{L}+/u, '')}</b>
                      <span className="k-muted k-small k-ellipsis" style={{ display: 'block' }}>{a.description}</span>
                      <span className="k-dim k-xs">{t.label} · {minutesAgo(a.createdAt)}</span>
                    </span>
                    {!read && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--k-red)', marginTop: 6, flex: 'none' }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <BottomSheet open={!!current} onClose={() => setOpenAnn(null)}>
        {current && (
          <>
            <span className="k-pill" style={{ background: `${ANNOUNCEMENT_TYPE[current.type].color}26`, color: ANNOUNCEMENT_TYPE[current.type].color }}>{ANNOUNCEMENT_TYPE[current.type].label}</span>
            <h3 className="headline-sm mt-12">{current.title.replace(/^\P{L}+/u, '')}</h3>
            <p className="body-lg grey mt-12">{current.description}</p>
            {current.actionLabel && current.actionRoute && <button type="button" className="k-btn primary block mt-24" onClick={() => { setOpenAnn(null); navigate(current.actionRoute!) }}>{current.actionLabel}</button>}
          </>
        )}
      </BottomSheet>
    </div>
  )
}

// ================= 12. Portefeuille =================
export function WalletV2() {
  useDb()
  const me = useUser()
  const { run, busy } = useAction()
  const [dialog, setDialog] = useState<'deposit' | 'withdraw' | null>(null)
  const [amount, setAmount] = useState('')
  const b = me.walletBalance
  const txs = walletService.getTransactions(me.id)

  async function confirm() {
    const n = Math.round(Number(amount))
    if (!n || n <= 0) return
    const ok = await run(async () => { await (dialog === 'deposit' ? walletService.deposit(n) : walletService.withdraw(n)); return true }, dialog === 'deposit' ? 'SkillCoins chargés' : 'Retrait demandé')
    if (ok) { setDialog(null); setAmount('') }
  }

  return (
    <div className="screen">
      <TopBar back title="Portefeuille" />
      <div className="k-body">
        <div className="k-card" style={{ background: 'linear-gradient(135deg, #3A2E06, #1A2739)', borderColor: '#5A4A12' }}>
          <p className="k-label" style={{ color: 'var(--yellow)' }}>Disponible pour jouer</p>
          <div style={{ font: '800 40px var(--font-title)', marginTop: 4 }}>{sc(b.available)} <span style={{ fontSize: 18, color: 'var(--yellow)' }}>SC</span></div>
          <div className="row k-small" style={{ marginTop: 10, gap: 18, flexWrap: 'wrap' }}>
            <span className="k-muted">En jeu : <b style={{ color: 'var(--k-text)' }}>{sc(b.pending)}</b></span>
            <span className="k-muted">Gains retirables : <b style={{ color: 'var(--k-text)' }}>{sc(b.withdrawable)}</b></span>
          </div>
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            <button type="button" className="k-btn primary sm grow" onClick={() => setDialog('deposit')}>Charger</button>
            <button type="button" className="k-btn ghost sm grow" onClick={() => setDialog('withdraw')}>Retirer</button>
          </div>
        </div>
        <p className="k-dim k-xs" style={{ margin: '8px 4px 0' }}>SkillCoins fictifs pendant le pilote : aucun argent réel n'est échangé.</p>
        <Section title="Mouvements" />
        {txs.length === 0 ? <Empty icon={Wallet} title="Aucun mouvement" /> : (
          <div className="k-card k-list">
            {txs.map((t) => {
              const pos = t.amount > 0 && t.type !== 'withdraw'
              const Icon = t.status === 'pending' ? Clock : pos ? ArrowUp : ArrowDown
              return (
                <div key={t.id} className="k-item">
                  <Icon size={22} color={t.status === 'pending' ? 'var(--k-dim)' : pos ? 'var(--k-green)' : 'var(--k-red)'} />
                  <span className="grow" style={{ minWidth: 0 }}><b className="k-ellipsis" style={{ display: 'block', fontWeight: 600 }}>{t.description}</b><span className="k-dim k-xs">{formatShort(t.timestamp)}{t.status === 'pending' ? ' · en attente' : ''}</span></span>
                  <b style={{ color: pos ? 'var(--k-green)' : 'var(--k-red)' }}>{pos ? '+' : '−'}{sc(Math.abs(t.amount))}</b>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Dialog open={!!dialog} onClose={() => setDialog(null)}>
        <h3 className="headline-sm">{dialog === 'deposit' ? 'Charger des SkillCoins' : 'Retirer des gains'}</h3>
        <div className="mt-16"><TextField label="Montant (SC)" icon={CircleDollarSign} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} autoFocus /></div>
        {dialog === 'withdraw' && <p className="body-sm">Retirable : {sc(b.withdrawable)} SC</p>}
        <div className="dialog-actions">
          <button type="button" className="k-btn ghost sm" onClick={() => setDialog(null)}>Annuler</button>
          <button type="button" className="k-btn primary sm" disabled={busy} onClick={confirm}>{dialog === 'deposit' ? 'Charger' : 'Retirer'}</button>
        </div>
      </Dialog>
    </div>
  )
}

// ================= 13. Parrainage =================
const TIERS = [{ label: 'Bronze', min: 0 }, { label: 'Argent', min: 10 }, { label: 'Or', min: 50 }, { label: 'Platine', min: 100 }, { label: 'Diamant', min: 250 }]
export function ReferralV2() {
  useDb()
  const me = useUser()
  const snack = useSnack()
  const referred = db.list('users').filter((u) => u.referredBy && u.referredBy.toUpperCase() === me.referralCode.toUpperCase())
  const active = referred.filter((u) => u.stats.wins + u.stats.losses > 0)
  const earned = db.list('referrals').filter((r) => r.referrerId === me.id).reduce((s, r) => s + r.commission, 0)
  const tier = [...TIERS].reverse().find((t) => referred.length >= t.min)!
  const next = TIERS.find((t) => t.min > referred.length)
  const link = `${location.origin}/register?ref=${me.referralCode}`

  async function share() {
    const text = `Rejoins-moi sur KickFlow pour des défis eFootball ! Inscris-toi avec mon code ${me.referralCode} : ${link}`
    if (navigator.share) { try { await navigator.share({ title: 'KickFlow', text }) } catch { /* annulé */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="screen">
      <TopBar back title="Parrainage" />
      <div className="k-body">
        <div className="k-card now" style={{ textAlign: 'center' }}>
          <div className="k-muted k-small">Ton code</div>
          <div className="k-mono" style={{ fontSize: 30, letterSpacing: '.2em', margin: '6px 0 14px' }}>{me.referralCode}</div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="k-btn ghost sm grow" onClick={async () => { try { await navigator.clipboard.writeText(link) } catch { /* ignore */ } snack("Lien d'invitation copié", 'success') }}><Copy size={16} />Copier le lien</button>
            <button type="button" className="k-btn primary sm grow" onClick={share}><Share2 size={16} />Partager</button>
          </div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <div className="k-card k-stat"><b>{referred.length}</b><span className="k-dim k-xs">Filleuls</span></div>
          <div className="k-card k-stat" style={{ marginTop: 0 }}><b>{active.length}</b><span className="k-dim k-xs">Actifs</span></div>
          <div className="k-card k-stat" style={{ marginTop: 0 }}><b className="yellow">{sc(earned)}</b><span className="k-dim k-xs">SC gagnés</span></div>
        </div>
        <div className="k-card">
          <div className="row between"><b>Palier {tier.label}</b><span className="k-dim k-small">{next ? `${next.min - referred.length} filleul(s) avant ${next.label}` : 'Palier maximum'}</span></div>
          <div className="k-progress" style={{ marginTop: 10 }}><span style={{ width: `${next ? (referred.length / next.min) * 100 : 100}%` }} /></div>
        </div>
        <Section title="Comment ça marche" />
        <div className="k-card col" style={{ gap: 10 }}>
          {['Partage ton code à tes amis', "Ils s'inscrivent avec ton code", 'Tu montes de palier à chaque filleul actif'].map((t, i) => (
            <div key={t} className="row"><span className="k-num now">{i + 1}</span>{t}</div>
          ))}
        </div>
        {referred.length > 0 && (
          <>
            <Section title="Mes filleuls" />
            <div className="k-card k-list">
              {referred.map((u) => <div key={u.id} className="k-item"><Avatar name={u.pseudo} size={36} /><span className="grow">{u.pseudo}</span><span className="k-dim k-small">{u.stats.wins + u.stats.losses} matchs</span></div>)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ================= 14. Lives =================
export function LivesV2() {
  useDb()
  const me = useUser()
  const { run, busy } = useAction()
  const [url, setUrl] = useState('')
  const lives = streamService.live()
  const mine = lives.find((s) => s.streamerId === me.id)

  return (
    <div className="screen">
      <TopBar back title="Lives" />
      <div className="k-body">
        {lives.length === 0 && <div className="k-card k-muted k-small" style={{ textAlign: 'center' }}>Aucun live en ce moment.</div>}
        {lives.map((s) => {
          const who = userService.getById(s.streamerId)
          return (
            <div key={s.id} className="k-card row">
              <Avatar name={who?.pseudo ?? '?'} photo={who?.profilePhoto} size={40} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}><span className="k-pill" style={{ background: 'var(--k-red)', color: '#fff' }}><Radio size={12} />LIVE</span><b className="k-ellipsis">{s.title ?? who?.pseudo}</b></div>
                <span className="k-dim k-xs">sur {platformOf(s.url)} · {minutesAgo(s.createdAt)}</span>
              </div>
              {s.streamerId === me.id
                ? <button type="button" className="k-btn danger sm" disabled={busy} onClick={() => run(() => streamService.end(s.id), 'Live terminé')}>Terminer</button>
                : <a className="k-btn primary sm" href={s.url} target="_blank" rel="noopener noreferrer">Regarder</a>}
            </div>
          )
        })}
        {!mine && (
          <div className="k-card" style={{ borderStyle: 'dashed', marginTop: 16 }}>
            <b>Diffuser mon match</b>
            <p className="k-muted k-small" style={{ margin: '6px 0 10px' }}>Lance ton live sur TikTok, YouTube ou Facebook, puis colle le lien ici : il apparaît pour tous les joueurs.</p>
            <label className="k-field"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@toi/live" aria-label="Lien de mon live" inputMode="url" /></label>
            <button type="button" className="k-btn primary block" style={{ marginTop: 10, height: 46 }} disabled={busy || !url.trim()}
              onClick={async () => { if (await run(async () => { await streamService.publish(url.trim()); return true }, 'Ton live est publié')) setUrl('') }}>Publier mon live</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ================= 6. Profil =================
export function ProfilV2() {
  useDb()
  const me = useUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const editing = params.get('edit') === '1'
  const games = me.stats.wins + me.stats.losses
  const rate = games ? Math.round((me.stats.wins / games) * 100) : 0
  const friends = me.friendIds.length
  const referred = db.list('users').filter((u) => u.referredBy && u.referredBy.toUpperCase() === me.referralCode.toUpperCase()).length
  const menu: [LucideIcon, string, string, string?][] = [
    [History, 'Historique des matchs', '/defis?tab=histo'],
    [Users, 'Mes amis', '/friends', friends ? String(friends) : undefined],
    [Gift, 'Parrainage', '/referral', referred ? `${referred} filleul${referred > 1 ? 's' : ''}` : undefined],
    [Scale, me.isAdmin ? 'Litiges et arbitrage' : 'Mes litiges', '/disputes'],
    [Radio, 'Lives', '/lives'],
    [Megaphone, 'Annonces', '/notifications?tab=annonces'],
  ]

  return (
    <div className="screen with-nav">
      <TopBar title="Profil" right={<button type="button" className="k-icon" aria-label="Paramètres" onClick={() => navigate('/settings')}><Settings size={22} /></button>} />
      <div className="k-body">
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={me.pseudo} photo={me.profilePhoto} size={72} />
          <div className="grow" style={{ minWidth: 0 }}>
            <h2 className="k-ellipsis" style={{ font: '700 21px var(--font-title)', margin: 0 }}>{me.pseudo}</h2>
            <div className="k-muted k-small">Niveau {me.stats.level} · {me.stats.xp} XP{me.isAdmin ? ' · arbitre' : ''}</div>
            <button type="button" className="row" style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }} onClick={() => setParams({ edit: '1' })}>
              <span className="k-dim k-xs">ID eFootball</span>
              <span className="k-mono" style={{ fontSize: 13, color: me.efootballId ? 'var(--k-text)' : 'var(--yellow)' }}>{me.efootballId || 'à renseigner'}</span>
              <Edit3 size={14} color="var(--cyan)" />
            </button>
          </div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <div className="k-card k-stat"><b>{me.stats.wins}</b><span className="k-dim k-xs">Victoires</span></div>
          <div className="k-card k-stat" style={{ marginTop: 0 }}><b>{me.stats.losses}</b><span className="k-dim k-xs">Défaites</span></div>
          <div className="k-card k-stat" style={{ marginTop: 0 }}><b style={{ color: 'var(--k-green)' }}>{rate} %</b><span className="k-dim k-xs">Réussite</span></div>
        </div>
        <button type="button" className="k-card row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', color: 'inherit' }} onClick={() => navigate('/wallet')}>
          <Wallet size={22} color="var(--yellow)" />
          <span className="grow"><b style={{ display: 'block' }}>{sc(me.walletBalance.available)} SkillCoins</b><span className="k-dim k-xs">{sc(me.walletBalance.pending)} en jeu · {sc(me.walletBalance.withdrawable)} de gains</span></span>
          <ChevronRight size={18} className="k-dim" />
        </button>
        <div className="k-card k-list">
          {menu.map(([Icon, label, to, extra]) => (
            <button key={to} type="button" className="k-item" style={{ padding: '14px 0' }} onClick={() => navigate(to)}>
              <Icon size={22} /><span className="grow">{label}</span>{extra && <span className="k-dim k-small">{extra}</span>}<ChevronRight size={18} className="k-dim" />
            </button>
          ))}
        </div>
        <button type="button" className="k-btn ghost block" style={{ marginTop: 12 }} onClick={() => setParams({ edit: '1' })}><Edit3 size={18} />Modifier mon profil</button>
      </div>
      <EditProfile open={editing} onClose={() => setParams({}, { replace: true })} me={me} />
    </div>
  )
}

function EditProfile({ open, onClose, me }: { open: boolean; onClose: () => void; me: User }) {
  const { run, busy } = useAction()
  const [f, setF] = useState({ pseudo: me.pseudo, efootballId: me.efootballId ?? '', country: me.country || 'Bénin', phone: me.phone })
  async function save() {
    if (await run(async () => { await userService.updateProfile(f); return true }, 'Profil mis à jour')) onClose()
  }
  async function photo(file?: File) {
    if (!file) return
    await run(async () => { await userService.updateProfile({ profilePhoto: await uploadImage(await readImage(file, 256)) }) }, 'Photo mise à jour')
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className="headline-sm mb-16">Modifier mon profil</h3>
      <label className="row mb-16" style={{ cursor: 'pointer' }}>
        <Avatar name={me.pseudo} photo={me.profilePhoto} size={56} /><span className="k-link">Changer la photo</span>
        <input type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} />
      </label>
      <TextField label="Pseudo" value={f.pseudo} onChange={(e) => setF({ ...f, pseudo: e.target.value })} maxLength={30} />
      <TextField label="ID eFootball" placeholder="Ton identifiant dans eFootball" value={f.efootballId} onChange={(e) => setF({ ...f, efootballId: e.target.value })} maxLength={40}
        help="Tes adversaires l'utilisent pour t'ajouter en ami dans eFootball." />
      <SelectField label="Pays" value={f.country} options={COUNTRIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setF({ ...f, country: v })} />
      <TextField label="Téléphone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="k-btn ghost grow" onClick={onClose}>Annuler</button>
        <button type="button" className="k-btn primary grow" disabled={busy} onClick={save}>Enregistrer</button>
      </div>
    </BottomSheet>
  )
}
