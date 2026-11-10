// Éléments de la nouvelle interface (maquette v2)
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleDollarSign } from 'lucide-react'
import { Avatar, Button, Dialog, goBack } from './ui'
import { useUser } from '../services/auth'
import { challengeService, COMMISSION_RATE } from '../services/challenges'
import { userService } from '../services/users'
import { useAction } from './ui'
import { sc } from '../lib/format'
import type { Challenge } from '../lib/types'

export function TopBar({ title, back, right }: { title?: ReactNode; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="k-top">
      {back && <button type="button" className="k-icon" aria-label="Retour" onClick={() => goBack(navigate)}><ArrowLeft size={22} /></button>}
      {typeof title === 'string' ? <h1 className="grow k-ellipsis">{title}</h1> : <div className="grow">{title}</div>}
      {right}
    </header>
  )
}

export function Coins({ value, onClick }: { value: number; onClick?: () => void }) {
  return (
    <button type="button" className="k-coins" onClick={onClick} style={{ border: 0, cursor: onClick ? 'pointer' : 'default' }} aria-label={`${sc(value)} XOF`}>
      <CircleDollarSign size={16} />{sc(value)}
    </button>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="k-seg" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export function Section({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="k-section"><h3>{title}</h3>{action}</div>
}

export function minutesAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m} min`
  if (m < 1440) return `${Math.floor(m / 60)} h`
  return `${Math.floor(m / 1440)} j`
}

export const prizeOf = (amount: number) => Math.round(amount * 2 * (1 - COMMISSION_RATE))

/** Ligne d'un défi disponible, avec confirmation avant d'accepter. */
export function ChallengeRow({ c }: { c: Challenge }) {
  const me = useUser()
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const [confirm, setConfirm] = useState(false)
  const creator = userService.getById(c.creatorId)
  const tooLow = !c.invitedUserId && me.stats.level < c.requiredLevel
  const isFriend = me.friendIds.includes(c.creatorId)
  const tooPoor = me.walletBalance.available < c.amount

  async function accept() {
    if (await run(async () => { await challengeService.accept(c.id); return true }, 'Défi accepté ! Retrouve ton adversaire 🎮')) {
      setConfirm(false)
      navigate(`/match/${c.id}`)
    }
  }

  return (
    <div className="k-item">
      <button type="button" onClick={() => navigate(`/joueur/${c.creatorId}`)} aria-label={`Profil de ${creator?.pseudo}`} style={{ all: 'unset', cursor: 'pointer' }}>
        <Avatar name={creator?.pseudo ?? '?'} photo={creator?.profilePhoto} size={44} />
      </button>
      <div className="grow" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/joueur/${c.creatorId}`)}>
        <div className="row" style={{ gap: 6 }}>
          <b className="k-ellipsis">{creator?.pseudo ?? 'Joueur'}</b>
          {c.invitedUserId ? <span className="k-pill" style={{ background: 'rgba(0,229,255,.14)', color: 'var(--cyan)' }}>pour toi</span>
            : isFriend ? <span className="k-pill" style={{ background: 'rgba(46,229,157,.14)', color: 'var(--k-green)' }}>ami</span> : null}
        </div>
        <div className="k-dim k-small k-ellipsis">{tooLow ? `Niv. ${c.requiredLevel} requis` : `Niv. ${creator?.stats.level ?? 1}`} · {c.platform} · {minutesAgo(c.createdAt)}</div>
      </div>
      <span className="k-amount">{sc(c.amount)}</span>
      {tooLow ? <button type="button" className="k-btn ghost sm" disabled>Niv. {c.requiredLevel}</button>
        : <button type="button" className="k-btn primary sm" onClick={() => setConfirm(true)}>Jouer</button>}
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <h3 className="headline-sm">Jouer contre {creator?.pseudo} ?</h3>
        <p className="body-md mt-12">Ta mise : <b style={{ color: '#fff' }}>{sc(c.amount)} XOF</b>. Le gagnant reçoit <b className="yellow">{sc(prizeOf(c.amount))} XOF</b>.</p>
        {tooPoor && <p className="mt-8" style={{ color: 'var(--k-red)' }}>Solde insuffisant : tu as {sc(me.walletBalance.available)} XOF.</p>}
        <div className="dialog-actions">
          <Button variant="text" onClick={() => setConfirm(false)}>Annuler</Button>
          <Button sm loading={busy} disabled={tooPoor} onClick={accept}>Accepter le défi</Button>
        </div>
      </Dialog>
    </div>
  )
}
