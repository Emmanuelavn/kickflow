// Match en 3 étapes + résultat (maquette v2, écrans 3, 4 et 5)
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Camera, Check, Clock, Copy, Flag, Hourglass, MessageCircle, Scale, Send, Share2, Trophy } from 'lucide-react'
import { Avatar, Empty, useAction, useSnack } from '../../components/ui'
import { ChallengeRow, TopBar, prizeOf } from '../../components/kit'
import { useUser } from '../../services/auth'
import { useDb } from '../../lib/db'
import { uploadImage } from '../../lib/api'
import { canDispute, challengeService, DISPUTE_WINDOW_MINUTES } from '../../services/challenges'
import { userService } from '../../services/users'
import { readImage, sc } from '../../lib/format'
import type { Challenge, User } from '../../lib/types'

async function copy(text: string, snack: (t: string, k?: 'success') => void, label = 'Copié') {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
  snack(`${label} : ${text}`, 'success')
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export function MatchScreenV2() {
  useDb()
  const { id = '' } = useParams()
  const me = useUser()
  const c = challengeService.getById(id)
  const now = useNow(c?.status === 'inProgress')

  if (!c) return <div className="screen"><TopBar back title="Match" /><Empty icon={AlertCircle} title="Match introuvable" /></div>
  const isPlayer = c.creatorId === me.id || c.opponentId === me.id
  const oppId = c.creatorId === me.id ? c.opponentId : c.creatorId
  const opp = userService.getById(oppId)
  const started = c.matchDetails?.matchStartedAt ? new Date(c.matchDetails.matchStartedAt).getTime() : null
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const finished = ['completed', 'disputed', 'cancelled'].includes(c.status)

  const right = c.status === 'inProgress'
    ? <span className="k-pill" style={{ background: 'var(--k-s1)', color: 'var(--k-muted)', fontSize: 14 }}><Clock size={14} />{clock}</span>
    : <span className="k-pill" style={{ background: 'rgba(255,214,10,.12)', color: 'var(--yellow)', fontSize: 14 }}>{sc(c.amount)} SC</span>

  return (
    <div className="screen">
      <TopBar back title={finished ? 'Résultat' : 'Match'} right={right} />
      <div className="k-body" style={{ flex: 1 }}>
        {!finished && <Players me={me} opp={opp} />}
        {c.status === 'pending' && <Waiting c={c} me={me} />}
        {(c.status === 'accepted' || c.status === 'inProgress') && opp && isPlayer && <Steps c={c} me={me} opp={opp} />}
        {finished && <Result c={c} me={me} opp={opp} />}
      </div>
      {(c.status === 'accepted' || c.status === 'inProgress') && isPlayer && <Chat c={c} me={me} />}
    </div>
  )
}

function Players({ me, opp }: { me: User; opp?: User }) {
  return (
    <div className="row between" style={{ padding: '0 4px 14px' }}>
      <div className="row" style={{ gap: 10, minWidth: 0 }}><Avatar name={me.pseudo} photo={me.profilePhoto} size={44} /><div style={{ minWidth: 0 }}><b className="k-ellipsis" style={{ display: 'block' }}>{me.pseudo}</b><span className="k-dim k-xs">toi</span></div></div>
      <span style={{ font: '800 18px var(--font-title)', color: 'var(--k-muted)' }}>VS</span>
      <div className="row" style={{ gap: 10, minWidth: 0 }}><div style={{ textAlign: 'right', minWidth: 0 }}><b className="k-ellipsis" style={{ display: 'block' }}>{opp?.pseudo ?? '…'}</b><span className="k-dim k-xs">{opp ? `Niv. ${opp.stats.level}` : 'en attente'}</span></div><Avatar name={opp?.pseudo ?? '?'} photo={opp?.profilePhoto} size={44} /></div>
    </div>
  )
}

// ----- Défi pas encore accepté -----
function Waiting({ c, me }: { c: Challenge; me: User }) {
  const navigate = useNavigate()
  const snack = useSnack()
  const { run, busy } = useAction()
  const invited = c.invitedUserId ? userService.getById(c.invitedUserId) : undefined
  const mine = c.creatorId === me.id
  async function share() {
    const text = `Je te défie sur KickFlow pour ${sc(c.amount)} SkillCoins ! ${location.origin}/match/${c.id}`
    if (navigator.share) { try { await navigator.share({ title: 'Défi KickFlow', text }) } catch { /* annulé */ } }
    else copy(text, snack, 'Lien copié')
  }
  if (!mine) {
    const forMe = !c.invitedUserId || c.invitedUserId === me.id
    return forMe
      ? <><p className="k-muted k-small mb-8">Ce défi t'attend : accepte-le pour jouer.</p><div className="k-card k-list"><ChallengeRow c={c} /></div></>
      : <div className="k-card" style={{ textAlign: 'center' }}><p className="k-muted">Ce défi est réservé à un autre joueur.</p><button type="button" className="k-btn primary block mt-16" onClick={() => navigate('/defis')}>Voir les défis</button></div>
  }
  return (
    <div className="k-card now" style={{ textAlign: 'center' }}>
      <Hourglass size={48} color="var(--cyan)" className="pulse" />
      <h3 className="headline-sm mt-12">{invited ? `En attente de ${invited.pseudo}` : 'En attente d\'un adversaire'}</h3>
      <p className="k-muted k-small mt-8">Ta mise de {sc(c.amount)} SC est bloquée. Le gagnant recevra {sc(prizeOf(c.amount))} SC. Tu seras prévenu dès qu'un joueur accepte.</p>
      <button type="button" className="k-btn primary block mt-16" onClick={share}><Share2 size={18} />Partager le défi sur WhatsApp</button>
      <button type="button" className="k-btn danger block mt-8" disabled={busy} onClick={async () => { if (await run(async () => { await challengeService.cancel(c.id); return true }, 'Défi annulé, mise rendue')) navigate('/defis', { replace: true }) }}>Annuler le défi</button>
    </div>
  )
}

// ----- Étapes 1 à 3 -----
function Steps({ c, me, opp }: { c: Challenge; me: User; opp: User }) {
  const snack = useSnack()
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const d = c.matchDetails
  const [room, setRoom] = useState(d?.roomCode ?? '')
  const [cs, setCs] = useState('')
  const [os, setOs] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setRoom(d?.roomCode ?? '') }, [d?.roomCode])

  const accepted = c.status === 'accepted'
  const myReport = d?.reports?.[me.id]
  const oppReport = d?.reports?.[opp.id]
  const isCreator = c.creatorId === me.id

  async function pickShot(file?: File) {
    if (!file) return
    await run(async () => {
      const url = await uploadImage(await readImage(file))
      await challengeService.addScreenshot(c.id, url)
      setShot(url)
    }, 'Photo du score ajoutée')
  }

  async function submit() {
    const mine = parseInt(cs, 10), theirs = parseInt(os, 10)
    if (Number.isNaN(mine) || Number.isNaN(theirs)) return snack('Entre les deux scores', 'warning')
    const creatorScore = isCreator ? mine : theirs
    const opponentScore = isCreator ? theirs : mine
    const r = await run(() => challengeService.reportScore(c.id, creatorScore, opponentScore, shot))
    if (!r) return
    if (r.state === 'waiting') snack(`Score envoyé. En attente de ${opp.pseudo}.`, 'success')
    if (r.state === 'draw') { snack('Match nul : rejouez une manche décisive.', 'warning'); setCs(''); setOs('') }
    if (r.state === 'disputed') snack('Vos scores ne concordent pas : un arbitre va trancher.', 'error')
  }

  return (
    <>
      {/* Étape 1 */}
      <div className={`k-step${accepted ? ' now' : ''}`}>
        <div className="row"><span className={`k-num ${accepted ? 'now' : 'done'}`}>{accepted ? 1 : <Check size={16} />}</span><b className={`grow${accepted ? '' : ' k-muted'}`}>{accepted ? 'Retrouvez-vous sur eFootball' : 'Retrouvés sur eFootball'}</b></div>
        {accepted && (
          <>
            <p className="k-muted k-small" style={{ margin: '10px 0 8px' }}>Ajoute {opp.pseudo} en ami dans eFootball avec son ID, puis lancez un match amical.</p>
            <div className="k-field">
              <span className="k-dim k-xs">ID eFootball</span>
              {opp.efootballId ? (
                <>
                  <span className="k-mono grow k-ellipsis">{opp.efootballId}</span>
                  <button type="button" className="k-icon" style={{ background: 'transparent', color: 'var(--cyan)' }} aria-label="Copier l'ID" onClick={() => copy(opp.efootballId!, snack, 'ID copié')}><Copy size={20} /></button>
                </>
              ) : <span className="grow k-dim k-small" style={{ padding: '14px 0' }}>{opp.pseudo} ne l'a pas encore renseigné : demande-le dans le chat</span>}
            </div>
            <label className="k-field" style={{ marginTop: 8 }}>
              <span className="k-dim k-xs">Code de salle</span>
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Optionnel, à coller ici" aria-label="Code de salle" maxLength={40} />
              {room && room === (d?.roomCode ?? '') ? (
                <button type="button" className="k-icon" style={{ background: 'transparent', color: 'var(--cyan)' }} aria-label="Copier le code" onClick={() => copy(room, snack, 'Code copié')}><Copy size={20} /></button>
              ) : room.trim() ? (
                <button type="button" className="k-btn primary sm" disabled={busy} onClick={() => run(() => challengeService.setRoomCode(c.id, room), 'Code partagé')}>Partager</button>
              ) : null}
            </label>
            {!me.efootballId && (
              <button type="button" className="k-link k-small" onClick={() => navigate('/profil?edit=1')}>Ajoute aussi ton ID eFootball pour {opp.pseudo} →</button>
            )}
            <button type="button" className="k-btn primary block" style={{ marginTop: 12, height: 48 }} disabled={busy}
              onClick={() => run(() => challengeService.start(c.id), 'Bon match ! Reviens déclarer le score à la fin.')}>
              <Check size={18} />On joue, le match a commencé
            </button>
          </>
        )}
      </div>

      {/* Étape 2 */}
      <div className="k-step">
        <div className="row"><span className={`k-num${accepted ? '' : ' done'}`}>{accepted ? 2 : <Check size={16} />}</span><b className="grow k-muted">{accepted ? 'Jouez le match' : 'Match en cours dans eFootball'}</b></div>
      </div>

      {/* Étape 3 */}
      <div className={`k-step${accepted ? '' : ' now'}`}>
        <div className="row"><span className={`k-num${accepted ? '' : ' now'}`}>3</span><b className={`grow${accepted ? ' k-muted' : ''}`}>Déclarez le score final</b></div>
        {!accepted && (myReport ? (
          <div className="mt-16" style={{ textAlign: 'center' }}>
            <p>Tu as déclaré <b>{isCreator ? myReport.creatorScore : myReport.opponentScore} – {isCreator ? myReport.opponentScore : myReport.creatorScore}</b></p>
            <p className="k-muted k-small mt-4">{oppReport ? 'Vérification en cours…' : `En attente de la déclaration de ${opp.pseudo}.`}</p>
          </div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'center', gap: 16, margin: '20px 0 6px' }}>
              <label className="col" style={{ alignItems: 'center', gap: 8 }}><span className="k-muted k-small">{me.pseudo}</span>
                <input className="k-score" inputMode="numeric" value={cs} onChange={(e) => setCs(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label={`Score de ${me.pseudo}`} placeholder="0" /></label>
              <span style={{ font: '800 28px var(--font-title)', color: 'var(--k-dim)', marginTop: 24 }}>–</span>
              <label className="col" style={{ alignItems: 'center', gap: 8 }}><span className="k-muted k-small">{opp.pseudo}</span>
                <input className="k-score" inputMode="numeric" value={os} onChange={(e) => setOs(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label={`Score de ${opp.pseudo}`} placeholder="0" /></label>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickShot(e.target.files?.[0])} />
            <button type="button" className="k-btn ghost block" style={{ marginTop: 14, height: 48 }} disabled={busy} onClick={() => fileRef.current?.click()}>
              <Camera size={20} />{shot ? 'Changer la photo du score' : 'Ajouter la photo du score'}
            </button>
            {shot && <img src={shot} alt="Photo du score" style={{ width: '100%', borderRadius: 12, marginTop: 10 }} />}
            <p className="k-dim k-xs" style={{ marginTop: 10 }}>{opp.pseudo} déclare aussi. Si vos deux scores sont identiques, le résultat est validé tout de suite. Sinon, un arbitre tranche avec les photos.</p>
            <button type="button" className="k-btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>Valider le score</button>
          </>
        ))}
      </div>

      {!accepted && !myReport && oppReport && (
        <div className="k-card row" style={{ marginTop: 12, padding: '12px 14px', gap: 10 }}>
          <Avatar name={opp.pseudo} size={32} /><span className="grow k-muted k-small">{opp.pseudo} a déjà déclaré son score</span>
          <span className="k-pill" style={{ background: 'rgba(46,229,157,.14)', color: 'var(--k-green)' }}>reçu</span>
        </div>
      )}
    </>
  )
}

// ----- Résultat -----
function Result({ c, me, opp }: { c: Challenge; me: User; opp?: User }) {
  const navigate = useNavigate()
  const d = c.matchDetails
  const isCreator = c.creatorId === me.id
  const won = d?.winnerId === me.id
  const myScore = isCreator ? d?.creatorScore : d?.opponentScore
  const theirScore = isCreator ? d?.opponentScore : d?.creatorScore
  const contest = canDispute(c, me.id)

  if (c.status === 'disputed') {
    return (
      <div className="k-card" style={{ textAlign: 'center', borderColor: 'var(--k-orange)', marginTop: 12 }}>
        <Scale size={48} color="var(--k-orange)" />
        <h2 className="headline-md mt-12">Litige en cours</h2>
        <p className="k-muted mt-8">{c.dispute?.reason}</p>
        <p className="k-dim k-small mt-8">Un arbitre examine les photos et va trancher. Tu seras notifié.</p>
        <button type="button" className="k-btn ghost block mt-16" onClick={() => navigate(`/disputes/${c.id}/evidence`)}>Voir les preuves</button>
      </div>
    )
  }
  if (c.status === 'cancelled') {
    return (
      <div className="k-card" style={{ textAlign: 'center', marginTop: 12 }}>
        <h2 className="headline-md">Défi annulé</h2>
        <p className="k-muted mt-8">{c.dispute?.resolution ?? 'Personne n\'a joué ce défi.'} Les mises ont été rendues.</p>
        <button type="button" className="k-btn primary block mt-16" onClick={() => navigate('/', { replace: true })}>Retour à l'accueil</button>
      </div>
    )
  }
  return (
    <div className="col" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 12 }}>
      <div style={{ width: 116, height: 116, borderRadius: '50%', display: 'grid', placeItems: 'center', background: won ? 'rgba(255,214,10,.12)' : 'var(--k-s1)' }}>
        {won ? <Trophy size={56} color="var(--yellow)" /> : <Flag size={52} color="var(--k-muted)" />}
      </div>
      <h1 className="display-sm mt-16">{won ? 'Victoire' : 'Défaite'}</h1>
      {myScore != null && <div style={{ font: '800 52px var(--font-title)' }}>{myScore} – {theirScore}</div>}
      <div className="k-muted">contre {opp?.pseudo}</div>
      <div className="k-card" style={{ width: '100%', marginTop: 24, textAlign: 'left' }}>
        <div className="row between"><span className="k-muted">{won ? 'Gain' : 'Mise perdue'}</span><b style={{ color: won ? 'var(--yellow)' : 'var(--k-red)', fontSize: 18 }}>{won ? `+${sc(prizeOf(c.amount))}` : `−${sc(c.amount)}`} SC</b></div>
        <div className="row between" style={{ marginTop: 10 }}><span className="k-muted">Expérience</span><b>+{won ? 50 : 10} XP</b></div>
        <div className="row between" style={{ marginTop: 10 }}><span className="k-muted">Ton solde</span><b>{sc(me.walletBalance.available + me.walletBalance.withdrawable)} SC</b></div>
      </div>
      {opp && <button type="button" className="k-btn primary block" style={{ marginTop: 20 }} onClick={() => navigate(`/challenges/create?to=${opp.id}&amount=${c.amount}`)}>Proposer une revanche</button>}
      <button type="button" className="k-btn ghost block" style={{ marginTop: 10 }} onClick={() => navigate('/', { replace: true })}>Retour à l'accueil</button>
      {contest && !won ? (
        <button type="button" className="k-link mt-16" onClick={() => navigate(`/disputes/new/${c.id}`)}>Contester le résultat ({DISPUTE_WINDOW_MINUTES} min max)</button>
      ) : c.dispute?.resolution ? <p className="k-dim k-small mt-16">Décision de l'arbitre : {c.dispute.resolution}</p> : null}
    </div>
  )
}

// ----- Chat (messages des joueurs uniquement) -----
const SYSTEM = /^(✅ .* est prêt|⏸️ .* n'est plus prêt|🎮 .* lance le match|⚽ Le match commence|📝 .* a déclaré le score|🤝 Match nul)/
function Chat({ c, me }: { c: Challenge; me: User }) {
  const snack = useSnack()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const msgs = c.chatMessages.filter((m) => !SYSTEM.test(m.message))
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) }, [msgs.length, open])
  async function send() {
    const m = text.trim()
    if (!m) return
    setText('')
    try { await challengeService.sendMessage(c.id, m) } catch (e) { setText(m); snack((e as Error).message, 'error') }
  }
  return (
    <div style={{ padding: '8px 20px calc(16px + var(--safe-bottom))', borderTop: '1px solid var(--k-line)', background: 'var(--dark-navy)', position: 'sticky', bottom: 0 }}>
      <button type="button" className="row" style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 0' }} onClick={() => setOpen(!open)}>
        <MessageCircle size={16} /><b className="k-small">Messages{msgs.length ? ` (${msgs.length})` : ''}</b><span className="k-dim k-xs">{open ? 'masquer' : 'afficher'}</span>
      </button>
      {open && (
        <div ref={listRef} className="col" style={{ gap: 6, maxHeight: 200, overflowY: 'auto', margin: '6px 0 8px' }}>
          {msgs.length === 0 && <p className="k-dim k-small">Aucun message. Écris à ton adversaire pour vous retrouver.</p>}
          {msgs.map((m, i) => <span key={i} className={`k-msg ${m.senderId === me.id ? 'me' : 'them'}`}>{m.message}</span>)}
        </div>
      )}
      <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); send() }}>
        <label className="k-field grow" style={{ minHeight: 44, borderRadius: 22 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setOpen(true)} placeholder="Écrire un message…" aria-label="Message" maxLength={500} style={{ height: 42 }} />
        </label>
        <button type="submit" className="k-icon primary" aria-label="Envoyer"><Send size={20} /></button>
      </form>
    </div>
  )
}
