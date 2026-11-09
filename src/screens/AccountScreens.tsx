// Transposé de history_screen, wallet_screen, notifications_screen, profile_screen, settings_screen, announcements_screen (.dart)
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowLeftRight, Bell, BellOff, Calendar, CheckCircle2, ChevronRight, CircleHelp, Coins, Gavel, Gift, Globe, Hourglass,
  KeyRound, Lock, LogOut, Mail, Megaphone, Moon, Percent, Phone, PlayCircle, Receipt, Settings, Shield, Swords,
  Trash2, TrendingUp, Trophy, User as UserIcon, Users, Video, Wallet, X, XCircle, AlertTriangle, Edit3, Scale,
  type LucideIcon,
} from 'lucide-react'
import { AppBar, Avatar, BottomSheet, Button, Dialog, Empty, goBack, IconButton, SelectField, TextField, useAction, useSnack } from '../components/ui'
import { uploadImage } from '../lib/api'
import { SoccerBall, Toll } from '../components/icons'
import { authService, useUser } from '../services/auth'
import { kv, useDb } from '../lib/db'
import { challengeService, STATUS_META } from '../services/challenges'
import { userService } from '../services/users'
import { walletService } from '../services/wallet'
import { notificationService } from '../services/notifications'
import { announcementService, ANNOUNCEMENT_TYPE } from '../services/announcements'
import { COUNTRIES } from '../lib/countries'
import { formatShort, readImage, sc, timeAgo } from '../lib/format'
import type { AnnouncementType, Challenge, ChallengeStatus, NotificationType, TransactionType } from '../lib/types'

function GradientHeader({ title, subtitle, back }: { title: string; subtitle: string; back?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="row anim-fade" style={{ padding: 16, alignItems: 'flex-start' }}>
      {back && <IconButton icon={ArrowLeft} label="Retour" onClick={() => goBack(navigate)} />}
      <div>
        <h1 className="display-sm black">{title}</h1>
        <p className="body-md mt-4" style={{ color: 'rgba(255,255,255,.7)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

// ================= Historique =================
const STATUS_ICON: Record<ChallengeStatus, LucideIcon> = {
  pending: Hourglass, accepted: CheckCircle2, inProgress: PlayCircle, completed: Trophy, cancelled: XCircle, disputed: AlertTriangle,
}

export function HistoryScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const [tab, setTab] = useState<0 | 1>(0)
  const all = challengeService.getMine(user.id)
  const ongoing = all.filter((c) => ['pending', 'accepted', 'inProgress', 'disputed'].includes(c.status))
  const done = all.filter((c) => c.status === 'completed' || c.status === 'cancelled')
  const completed = all.filter((c) => c.status === 'completed' && c.matchDetails?.winnerId)
  const wins = completed.filter((c) => c.matchDetails?.winnerId === user.id).length
  const losses = completed.length - wins
  const rate = completed.length ? (wins / completed.length) * 100 : 0
  const list = tab === 0 ? ongoing : done

  return (
    <div className="screen with-nav" style={{ background: 'linear-gradient(180deg, #0D4D0D, #052205)' }}>
      <GradientHeader title="Historique" subtitle="Consultez l'historique de tous vos défis" />
      <div style={{ padding: '0 16px' }}>
        <div className="row anim-fade" style={{ justifyContent: 'space-around', padding: 16, borderRadius: 20, background: 'linear-gradient(135deg, rgba(57,255,20,.2), rgba(0,200,83,.1))', border: '1px solid rgba(57,255,20,.3)', animationDelay: '.2s' }}>
          {([['Total', all.length, SoccerBall], ['Victoires', wins, Trophy], ['Défaites', losses, X], ['Taux', `${rate.toFixed(0)}%`, TrendingUp]] as const).map(([l, v, I]) => (
            <div key={l} className="center-col" style={{ gap: 4 }}><I size={22} color="var(--green)" /><span className="title-lg bold">{v}</span><span className="label-sm">{l}</span></div>
          ))}
        </div>
        <div className="row mt-16" style={{ padding: 4, borderRadius: 14, background: 'rgba(0,0,0,.25)' }}>
          {(['⚡ En Cours', '✅ Terminés'] as const).map((l, i) => (
            <button key={l} type="button" onClick={() => setTab(i as 0 | 1)} className="grow" style={{ padding: 12, borderRadius: 10, border: 0, cursor: 'pointer', fontWeight: 700, background: tab === i ? 'var(--green)' : 'transparent', color: tab === i ? 'var(--dark-navy)' : 'var(--text-grey)' }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        {list.length === 0 ? (
          <Empty icon={tab === 0 ? Swords : Receipt} title={tab === 0 ? 'Aucun défi en cours' : 'Aucun défi terminé'} text={tab === 0 ? 'Créez ou rejoignez un défi pour commencer' : 'Vos défis terminés apparaîtront ici'} />
        ) : list.map((c, i) => <HistoryCard key={c.id} c={c} me={user.id} index={i} onOpen={() => navigate(c.status === 'accepted' ? `/match/${c.id}/lobby` : c.status === 'inProgress' ? `/match/${c.id}/live` : `/challenges/${c.id}`)} />)}
      </div>
    </div>
  )
}

function HistoryCard({ c, me, index, onOpen }: { c: Challenge; me: string; index: number; onOpen: () => void }) {
  const s = STATUS_META[c.status]
  const Icon = STATUS_ICON[c.status]
  const opponentId = c.creatorId === me ? c.opponentId : c.creatorId
  const opponent = userService.getById(opponentId)
  const d = c.matchDetails
  const won = d?.winnerId === me
  const isCreator = c.creatorId === me
  return (
    <button type="button" onClick={onOpen} className="card anim-up" style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid rgba(57,255,20,.2)', marginBottom: 12, cursor: 'pointer', background: 'rgba(26,35,50,.7)', animationDelay: `${index * 50}ms` }}>
      <div className="row">
        <span style={{ padding: 10, borderRadius: 12, background: `color-mix(in srgb, ${s.color} 20%, transparent)`, display: 'grid' }}><Swords size={22} color={s.color} /></span>
        <div className="grow"><p className="title-md">{c.matchType}</p><p className="body-sm">{c.platform}</p></div>
        <span className="pill row" style={{ background: `color-mix(in srgb, ${s.color} 20%, transparent)`, color: s.color }}><Icon size={12} />{s.short}</span>
      </div>
      {opponent && <p className="row mt-12" style={{ gap: 6 }}><UserIcon size={18} color="var(--green)" /><span className="grey">Adversaire : </span><span className="bold">{opponent.pseudo}</span></p>}
      <div className="row between mt-12">
        <div><p className="label-sm">Mise</p><p className="bold yellow">{sc(c.amount)} SC</p></div>
        <div style={{ textAlign: 'right' }}><p className="label-sm">Date</p><p className="bold">{formatShort(c.createdAt).slice(0, 8)}</p></div>
      </div>
      {c.status === 'completed' && d?.winnerId && (
        <p className="row mt-12" style={{ gap: 6, color: won ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
          {won ? <Trophy size={18} /> : <X size={18} />}{won ? 'Victoire' : 'Défaite'}
          {d.creatorScore != null && <><span className="grey">•</span><span>Score : {isCreator ? d.creatorScore : d.opponentScore} - {isCreator ? d.opponentScore : d.creatorScore}</span></>}
        </p>
      )}
    </button>
  )
}

// ================= Portefeuille =================
const TX_META: Record<TransactionType, { label: string; icon: LucideIcon }> = {
  deposit: { label: 'Dépôt', icon: Coins }, withdraw: { label: 'Retrait', icon: Wallet }, loss: { label: 'Perte', icon: Swords },
  win: { label: 'Gain', icon: Trophy }, referralBonus: { label: 'Parrainage', icon: Gift }, transfer: { label: 'Transfert', icon: ArrowLeftRight },
  commission: { label: 'Commission', icon: Percent },
}

export function WalletScreen() {
  useDb()
  const user = useUser()
  const { run, busy } = useAction()
  const [dialog, setDialog] = useState<'deposit' | 'withdraw' | null>(null)
  const [amount, setAmount] = useState('')
  const txs = walletService.getTransactions(user.id)
  const b = user.walletBalance

  async function confirm() {
    const n = parseFloat(amount)
    if (!n || n <= 0) return
    const ok = dialog === 'deposit'
      ? await run(async () => { await walletService.deposit(n); return true }, 'Dépôt effectué !')
      : await run(async () => { await walletService.withdraw(n); return true }, 'Retrait effectué !')
    if (ok) {
      setDialog(null)
      setAmount('')
    }
  }

  return (
    <div className="screen" style={{ background: 'linear-gradient(180deg, #B85C00, #4D2600)' }}>
      <GradientHeader title="Portefeuille" subtitle="Gérez vos SkillCoins et transactions" back />
      <div style={{ padding: '0 16px' }}>
        <div className="anim-scale" style={{ padding: 24, borderRadius: 24, background: 'linear-gradient(135deg, rgba(255,214,10,.3), rgba(255,107,53,.25))', border: '1px solid rgba(255,214,10,.5)' }}>
          <div className="row"><Toll size={28} color="var(--yellow)" /><span className="grey">Solde Disponible</span></div>
          <p className="display-lg mt-8">{Math.trunc(b.available)}</p>
          <p className="yellow bold">SkillCoins</p>
          <div className="row between mt-16 body-sm" style={{ color: 'rgba(255,255,255,.8)' }}>
            <span>🔒 En jeu : {sc(b.pending)}</span><span>💰 Retirable : {sc(b.withdrawable)}</span>
          </div>
          <div className="row mt-16">
            <Button variant="yellow" sm icon={Coins} style={{ flex: 1 }} onClick={() => setDialog('deposit')}>Charger</Button>
            <Button variant="outline" sm icon={Wallet} style={{ flex: 1, color: '#fff', borderColor: 'rgba(255,255,255,.6)' }} onClick={() => setDialog('withdraw')}>Retirer</Button>
          </div>
        </div>
        <p className="body-sm mt-12" style={{ color: 'rgba(255,255,255,.7)' }}>ℹ️ Mode démo : les SkillCoins sont fictifs, aucun argent réel n'est échangé.</p>
        <p className="row section-title"><Receipt size={20} />Historique des Transactions</p>
        {txs.length === 0 ? <Empty icon={Receipt} title="Aucune transaction" text="Vos transactions apparaîtront ici" /> : txs.map((t) => {
          const m = TX_META[t.type]
          const positive = t.amount > 0 && t.type !== 'withdraw'
          return (
            <div key={t.id} className="list-tile" style={{ cursor: 'default', background: 'rgba(26,35,50,.7)' }}>
              <span style={{ padding: 10, borderRadius: 12, background: positive ? 'rgba(0,255,135,.15)' : 'rgba(255,59,109,.15)', display: 'grid' }}><m.icon size={20} color={positive ? 'var(--success)' : 'var(--error)'} /></span>
              <div className="grow"><p className="bold">{m.label}</p><p className="body-sm ellipsis">{t.description}</p><p className="label-sm">{formatShort(t.timestamp)}{t.status === 'pending' ? ' • en attente' : ''}</p></div>
              <span className="bold" style={{ color: positive ? 'var(--success)' : 'var(--error)' }}>{positive ? '+' : '-'}{sc(Math.abs(t.amount))} SC</span>
            </div>
          )
        })}
        <div className="mt-24" />
      </div>
      <Dialog open={!!dialog} onClose={() => setDialog(null)}>
        <h3 className="headline-sm">{dialog === 'deposit' ? 'Charger des SkillCoins' : 'Retirer des SkillCoins'}</h3>
        <div className="mt-16"><TextField label="Montant" icon={Coins} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} suffix={<span className="grey">SC</span>} autoFocus /></div>
        {dialog === 'withdraw' && <p className="body-sm">Retirable : {sc(b.withdrawable)} SC</p>}
        <div className="dialog-actions">
          <Button variant="text" onClick={() => setDialog(null)}>Annuler</Button>
          <Button sm loading={busy} onClick={confirm}>{dialog === 'deposit' ? 'Charger' : 'Retirer'}</Button>
        </div>
      </Dialog>
    </div>
  )
}

// ================= Notifications =================
const NOTIF_ICON: Record<NotificationType, LucideIcon> = {
  challenge: Swords, match: SoccerBall as unknown as LucideIcon, event: Calendar, progression: TrendingUp, social: Users, wallet: Wallet,
  streaming: Video, referral: Gift, security: Shield, support: CircleHelp, tournament: Trophy, dispute: Gavel,
}

export function NotificationsScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const { run } = useAction()
  const list = notificationService.list(user.id)
  return (
    <div className="screen">
      <AppBar title="Notifications" back actions={list.some((n) => !n.isRead) ? <Button variant="text" onClick={() => run(notificationService.markAllAsRead)}>Tout marquer lu</Button> : null} />
      <div className="screen-body">
        {list.length === 0 ? <Empty icon={BellOff} title="Aucune notification" /> : list.map((n) => {
          const Icon = NOTIF_ICON[n.type] ?? Bell
          return (
            <div key={n.id} className="list-tile" style={{ alignItems: 'flex-start', border: n.isRead ? '1px solid transparent' : '1px solid rgba(0,229,255,.3)' }}
              onClick={() => {
                if (!n.isRead) run(() => notificationService.markAsRead(n.id))
                if (n.relatedId && ['challenge', 'match', 'dispute'].includes(n.type)) navigate(`/challenges/${n.relatedId}`)
              }}>
              <span style={{ padding: 10, borderRadius: 12, background: 'rgba(0,229,255,.12)', display: 'grid' }}><Icon size={20} color="var(--cyan)" /></span>
              <div className="grow"><p className="bold">{n.title}</p><p className="body-md">{n.message}</p><p className="label-sm mt-4">{timeAgo(n.createdAt)}</p></div>
              {!n.isRead && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', marginTop: 6 }} />}
              <button type="button" className="icon-btn" aria-label="Supprimer" style={{ width: 36, height: 36, color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); run(() => notificationService.remove(n.id), 'Notification supprimée') }}><Trash2 size={18} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ================= Profil =================
export function ProfileScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const [editing, setEditing] = useState(false)
  const [logout, setLogout] = useState(false)
  const [f, setF] = useState({ pseudo: user.pseudo, country: user.country || 'Bénin', phone: user.phone })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const profit = user.stats.totalEarned - user.stats.totalLost

  async function save() {
    const e: Record<string, string> = {}
    if (!f.pseudo) e.pseudo = 'Pseudo requis'
    if (!f.phone) e.phone = 'Téléphone requis'
    else if (!/^\+?[\d\s\-()]+$/.test(f.phone)) e.phone = 'Format de téléphone invalide'
    setErrors(e)
    if (Object.keys(e).length) return
    if (await run(async () => { await userService.updateProfile(f); return true }, 'Profil mis à jour avec succès !')) setEditing(false)
  }

  async function pickPhoto(file?: File) {
    if (!file) return
    await run(async () => {
      const url = await uploadImage(await readImage(file, 256))
      await userService.updateProfile({ profilePhoto: url })
    }, 'Photo mise à jour')
  }

  const menu: [string, LucideIcon, string][] = [
    ['Mes amis', Users, '/friends'], ['Mes disputes', Scale, '/disputes'], ['Parrainage', Gift, '/referral'],
    ['Portefeuille', Wallet, '/wallet'], ['Classement', Trophy, '/leaderboard'], ['Paramètres', Settings, '/settings'],
  ]

  return (
    <div className="screen gradient with-nav">
      <AppBar title="Mon Profil" actions={<IconButton icon={Settings} label="Paramètres" onClick={() => navigate('/settings')} />} />
      <div className="screen-body">
        <div className="center-col">
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <Avatar name={user.pseudo} photo={user.profilePhoto} size={100} />
            <span style={{ position: 'absolute', right: 0, bottom: 0, padding: 6, borderRadius: '50%', background: 'var(--cyan)', display: 'grid' }}><Edit3 size={16} color="var(--dark-navy)" /></span>
            <input type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
          <h2 className="headline-md mt-12">{user.pseudo}</h2>
          <p className="body-md">@{user.username}</p>
          <span className="pill mt-8" style={{ background: 'rgba(255,214,10,.2)', color: 'var(--yellow)' }}>Niveau {user.stats.level} · {user.stats.xp} XP</span>
          {user.isAdmin && <span className="pill mt-8" style={{ background: 'rgba(157,78,221,.25)', color: '#d7b5ff' }}>⚖️ Arbitre</span>}
        </div>
        <div className="row mt-24" style={{ gap: 12 }}>
          {([['Niveau', `${user.stats.level}`, 'var(--cyan)'], ['Victoires', `${user.stats.wins}`, 'var(--success)'], ['Profit/Perte', `${profit >= 0 ? '+' : '-'}${Math.abs(Math.trunc(profit))}`, profit >= 0 ? 'var(--success)' : 'var(--error)']] as const).map(([l, v, col]) => (
            <div key={l} className="card grow center-col" style={{ padding: 14 }}><span className="headline-sm" style={{ color: col }}>{v}</span><span className="label-sm">{l}</span></div>
          ))}
        </div>

        <div className="card mt-16">
          <div className="row between"><p className="title-md">Informations du Profil</p>
            {!editing && <Button variant="text" icon={Edit3} onClick={() => setEditing(true)}>Modifier</Button>}</div>
          {editing ? (
            <div className="mt-12">
              <TextField label="Pseudo" icon={UserIcon} placeholder="Votre pseudo" value={f.pseudo} onChange={(e) => setF({ ...f, pseudo: e.target.value })} error={errors.pseudo} />
              <SelectField label="Pays" icon={Globe} value={f.country} options={COUNTRIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setF({ ...f, country: v })} />
              <TextField label="Téléphone" icon={Phone} type="tel" placeholder="+229 01 23 45 67 89" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
              <TextField label="Messagerie électronique" icon={Mail} value={user.email} disabled help="L'email ne peut pas être modifié" />
              <Button block loading={busy} onClick={save}>Enregistrer les modifications</Button>
              <Button variant="text" block onClick={() => setEditing(false)}>Annuler</Button>
            </div>
          ) : (
            <div className="col mt-8" style={{ gap: 10 }}>
              <span className="row grey"><Globe size={18} />Pays<span className="grow" /><span style={{ color: '#fff' }}>{user.country || '—'}</span></span>
              <span className="row grey"><Phone size={18} />Téléphone<span className="grow" /><span style={{ color: '#fff' }}>{user.phone || '—'}</span></span>
              <span className="row grey"><Mail size={18} />Email<span className="grow" /><span className="ellipsis" style={{ color: '#fff', maxWidth: 200 }}>{user.email}</span></span>
            </div>
          )}
        </div>

        <div className="mt-16">
          {menu.map(([l, I, to]) => (
            <button key={to} type="button" className="list-tile" onClick={() => navigate(to)}><I size={22} color="var(--cyan)" /><span className="grow bold">{l}</span><ChevronRight size={20} color="var(--text-muted)" /></button>
          ))}
        </div>
        <Button variant="outline" block icon={LogOut} style={{ marginTop: 24, color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => setLogout(true)}>Déconnexion</Button>
      </div>
      <LogoutDialog open={logout} onClose={() => setLogout(false)} />
    </div>
  )
}

function LogoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Dialog open={open} onClose={onClose}>
      <h3 className="headline-sm">Déconnexion</h3>
      <p className="body-md mt-12">Êtes-vous sûr de vouloir vous déconnecter ?</p>
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>Annuler</Button>
        <Button variant="danger" sm onClick={() => { authService.logout(); navigate('/login', { replace: true }) }}>Déconnexion</Button>
      </div>
    </Dialog>
  )
}

// ================= Paramètres =================
function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  useDb()
  return [kv.get(key, fallback), (v: T) => kv.set(key, v)]
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="card mt-16">
      <p className="row title-md mb-8"><Icon size={20} color="var(--cyan)" />{title}</p>
      {children}
    </div>
  )
}

function Switch({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row" style={{ padding: '10px 0', cursor: 'pointer' }}>
      <span className="grow"><span className="bold" style={{ display: 'block' }}>{title}</span>{subtitle && <span className="body-sm">{subtitle}</span>}</span>
      <input type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ width: 44, height: 24, accentColor: 'var(--cyan)' }} />
    </label>
  )
}

function ActionTile({ title, icon: Icon, onTap, danger, trailing }: { title: string; icon: LucideIcon; onTap: () => void; danger?: boolean; trailing?: string }) {
  return (
    <button type="button" className="row" onClick={onTap} style={{ width: '100%', padding: '12px 0', border: 0, background: 'none', cursor: 'pointer', color: danger ? 'var(--error)' : '#fff', textAlign: 'left' }}>
      <Icon size={20} color={danger ? 'var(--error)' : 'var(--text-grey)'} /><span className="grow">{title}</span>
      {trailing && <span className="grey">{trailing}</span>}<ChevronRight size={18} color="var(--text-muted)" />
    </button>
  )
}

export function SettingsScreen() {
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const s = {
    push: useSetting('push_notifications', true), email: useSetting('email_notifications', true), sms: useSetting('sms_notifications', false),
    challenge: useSetting('challenge_notifications', true), tournament: useSetting('tournament_notifications', true), stream: useSetting('stream_notifications', true),
    friend: useSetting('friend_request_notifications', true), publicProfile: useSetting('profile_public', true), online: useSetting('show_online_status', true),
    allowFriends: useSetting('allow_friend_requests', true), dark: useSetting('dark_mode', true),
    language: useSetting('language', 'Français'), currency: useSetting('currency', 'FCFA'),
  }
  const [sheet, setSheet] = useState<'language' | 'currency' | 'password' | 'logout' | 'delete' | null>(null)
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' })
  const { run, busy } = useAction()

  async function changePassword() {
    if (!pw.old) return snack('Ancien mot de passe requis', 'warning')
    if (pw.next.length < 6) return snack('Le nouveau mot de passe doit contenir au moins 6 caractères', 'warning')
    if (pw.next !== pw.confirm) return snack('Les mots de passe ne correspondent pas', 'warning')
    if (await run(async () => { await authService.changePassword(pw.old, pw.next); return true }, 'Mot de passe modifié avec succès')) {
      setSheet(null)
      setPw({ old: '', next: '', confirm: '' })
    }
  }

  async function deleteAccount() {
    if (await run(async () => { await authService.deleteAccount(); return true }, 'Compte supprimé')) navigate('/login', { replace: true })
  }

  return (
    <div className="screen">
      <AppBar title="Paramètres" back />
      <div className="screen-body">
        <Section title="Compte" icon={UserIcon}>
          <ActionTile title="Changer le mot de passe" icon={KeyRound} onTap={() => setSheet('password')} />
          <ActionTile title="Langue" icon={Globe} trailing={s.language[0]} onTap={() => setSheet('language')} />
          <ActionTile title="Devise" icon={Coins} trailing={s.currency[0]} onTap={() => setSheet('currency')} />
        </Section>
        <Section title="Notifications" icon={Bell}>
          <Switch title="Notifications Push" subtitle="Recevoir des notifications sur votre appareil" value={s.push[0]} onChange={s.push[1]} />
          <Switch title="Notifications Email" subtitle="Recevoir des notifications par email" value={s.email[0]} onChange={s.email[1]} />
          <Switch title="Notifications SMS" subtitle="Recevoir des notifications par SMS" value={s.sms[0]} onChange={s.sms[1]} />
          <Switch title="Défis" subtitle="Nouveaux défis et mises à jour" value={s.challenge[0]} onChange={s.challenge[1]} />
          <Switch title="Tournois" subtitle="Inscriptions et résultats" value={s.tournament[0]} onChange={s.tournament[1]} />
          <Switch title="Streams" subtitle="Lives et nouveaux contenus" value={s.stream[0]} onChange={s.stream[1]} />
          <Switch title="Demandes d'amis" subtitle="Nouvelles demandes d'amis" value={s.friend[0]} onChange={s.friend[1]} />
        </Section>
        <Section title="Confidentialité" icon={Lock}>
          <Switch title="Profil public" subtitle="Tout le monde peut voir votre profil" value={s.publicProfile[0]} onChange={s.publicProfile[1]} />
          <Switch title="Statut en ligne" subtitle="Afficher quand vous êtes en ligne" value={s.online[0]} onChange={s.online[1]} />
          <Switch title="Autoriser les demandes d'amis" value={s.allowFriends[0]} onChange={s.allowFriends[1]} />
        </Section>
        <Section title="Apparence" icon={Moon}>
          <Switch title="Mode sombre" subtitle="Utiliser le thème sombre" value={s.dark[0]} onChange={s.dark[1]} />
        </Section>
        <Section title="Arbitrage" icon={Scale}>
          <p className="body-md">{user.isAdmin
            ? '⚖️ Vous êtes arbitre : vous pouvez trancher les litiges depuis Profil → Mes disputes.'
            : "Les arbitres sont désignés par l'administrateur de KickFlow."}</p>
        </Section>
        <Section title="Support" icon={CircleHelp}>
          <ActionTile title="Aide & FAQ" icon={CircleHelp} onTap={() => snack('Bientôt disponible', 'info')} />
          <ActionTile title="Contacter le support" icon={Mail} onTap={() => snack('Bientôt disponible', 'info')} />
          <ActionTile title="Conditions d'utilisation" icon={Receipt} onTap={() => snack('Bientôt disponible', 'info')} />
          <ActionTile title="Politique de confidentialité" icon={Shield} onTap={() => snack('Bientôt disponible', 'info')} />
        </Section>
        <div className="card mt-16">
          <ActionTile title="Déconnexion" icon={LogOut} danger onTap={() => setSheet('logout')} />
          <ActionTile title="Supprimer le compte" icon={Trash2} danger onTap={() => setSheet('delete')} />
        </div>
        <p className="body-sm center-col mt-24">Version 1.0.0</p>
      </div>

      <Dialog open={sheet === 'language' || sheet === 'currency'} onClose={() => setSheet(null)}>
        <h3 className="headline-sm">{sheet === 'language' ? 'Choisir la langue' : 'Choisir la devise'}</h3>
        {(sheet === 'language' ? ['Français', 'English', 'العربية'] : ['FCFA', 'EUR', 'USD']).map((o) => {
          const [val, set] = sheet === 'language' ? s.language : s.currency
          return (
            <label key={o} className="row" style={{ padding: '12px 0', cursor: 'pointer' }}>
              <input type="radio" checked={val === o} onChange={() => { set(o); setSheet(null) }} style={{ accentColor: 'var(--cyan)', width: 18, height: 18 }} />{o}
            </label>
          )
        })}
      </Dialog>
      <BottomSheet open={sheet === 'password'} onClose={() => setSheet(null)}>
        <h3 className="headline-sm mb-16">Changer le mot de passe</h3>
        <TextField label="Ancien mot de passe" icon={Lock} password value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
        <TextField label="Nouveau mot de passe" icon={KeyRound} password value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <TextField label="Confirmer le mot de passe" icon={KeyRound} password value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        <div className="row"><Button variant="text" style={{ flex: 1 }} onClick={() => setSheet(null)}>Annuler</Button><Button style={{ flex: 1 }} loading={busy} onClick={changePassword}>Confirmer</Button></div>
      </BottomSheet>
      <LogoutDialog open={sheet === 'logout'} onClose={() => setSheet(null)} />
      <Dialog open={sheet === 'delete'} onClose={() => setSheet(null)}>
        <h3 className="headline-sm red">Supprimer le compte</h3>
        <p className="body-md mt-12">Cette action est irréversible. Toutes vos données seront définitivement supprimées.</p>
        <div className="dialog-actions">
          <Button variant="text" onClick={() => setSheet(null)}>Annuler</Button>
          <Button variant="danger" sm loading={busy} onClick={deleteAccount}>Supprimer</Button>
        </div>
      </Dialog>
    </div>
  )
}

// ================= Annonces =================
export function AnnouncementsScreen() {
  useDb()
  const navigate = useNavigate()
  const snack = useSnack()
  const [type, setType] = useState<AnnouncementType | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const all = announcementService.getAll()
  const list = type ? all.filter((a) => a.type === type) : all
  const unread = announcementService.getUnreadCount()
  const current = all.find((a) => a.id === open)

  return (
    <div className="screen gradient">
      <AppBar title={<span className="row" style={{ justifyContent: 'center' }}><Megaphone size={20} color="var(--orange)" />Infos & Nouveautés{unread > 0 && <span className="pill" style={{ background: 'var(--pink)', color: '#fff' }}>{unread}</span>}</span>} back
        actions={unread > 0 ? <IconButton icon={CheckCircle2} label="Tout marquer comme lu" onClick={() => { announcementService.markAllAsRead(); snack('Toutes les annonces marquées comme lues', 'success') }} /> : null} />
      <div className="chips" style={{ padding: '8px 16px' }}>
        <button type="button" className={`chip${type === null ? ' selected' : ''}`} onClick={() => setType(null)}>Tout</button>
        {(Object.keys(ANNOUNCEMENT_TYPE) as AnnouncementType[]).map((t) => (
          <button key={t} type="button" className={`chip${type === t ? ' selected' : ''}`} onClick={() => setType(t)}>{ANNOUNCEMENT_TYPE[t].emoji} {ANNOUNCEMENT_TYPE[t].label}</button>
        ))}
      </div>
      <div className="screen-body">
        {list.length === 0 ? <Empty icon={Megaphone} title="Aucune annonce" text="Revenez plus tard pour voir les nouveautés" /> : list.map((a, i) => {
          const t = ANNOUNCEMENT_TYPE[a.type]
          const read = announcementService.isRead(a.id)
          return (
            <button key={a.id} type="button" className="card anim-up" onClick={() => { announcementService.markAsRead(a.id); setOpen(a.id) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 12, border: `1px solid ${read ? 'var(--border-dark)' : t.color}`, animationDelay: `${i * 40}ms` }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className="pill" style={{ background: `${t.color}33`, color: t.color }}>{t.emoji} {t.label}</span>
                {a.isImportant && <span className="pill" style={{ background: 'rgba(255,59,109,.2)', color: 'var(--error)' }}>Important</span>}
                {!read && <span className="pill" style={{ background: 'var(--cyan)', color: 'var(--dark-navy)' }}>NOUVEAU</span>}
                <span className="grow" /><span className="label-sm">{timeAgo(a.createdAt)}</span>
              </div>
              <p className="title-md mt-8">{a.title}</p>
              <p className="body-md mt-4" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.description}</p>
            </button>
          )
        })}
      </div>
      <BottomSheet open={!!current} onClose={() => setOpen(null)}>
        {current && (
          <>
            <span className="pill" style={{ background: `${ANNOUNCEMENT_TYPE[current.type].color}33`, color: ANNOUNCEMENT_TYPE[current.type].color }}>{ANNOUNCEMENT_TYPE[current.type].emoji} {ANNOUNCEMENT_TYPE[current.type].label}</span>
            <h3 className="headline-sm mt-12">{current.title}</h3>
            <p className="label-sm mt-4">{timeAgo(current.createdAt)}</p>
            <p className="body-lg grey mt-16">{current.description}</p>
            {current.actionLabel && <Button block style={{ marginTop: 24 }} onClick={() => { setOpen(null); if (current.actionRoute) navigate(current.actionRoute) }}>{current.actionLabel}</Button>}
          </>
        )}
      </BottomSheet>
    </div>
  )
}
