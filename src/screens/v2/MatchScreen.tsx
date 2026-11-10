// Match en 3 étapes + résultat (maquette v2, écrans 3, 4 et 5)
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Camera, Check, Clock, Copy, Flag, Hourglass, MessageCircle, Scale, Send, Share2, Trophy } from 'lucide-react'
import { Avatar, Empty, useAction, useSnack } from '../../components/ui'
import { ChallengeRow, TopBar, prizeOf } from '../../components/kit'
import { useUser } from '../../services/auth'
import { useDb } from '../../lib/db'
import { uploadImage } from '../../lib/api'
import { canDispute, challengeService, DISPUTE_WINDOW_MINUTES, START_DEADLINE_MINUTES } from '../../services/challenges'
import { useOnline } from '../../lib/presence'
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
  const navigate = useNavigate()
  return (
    <div className="row between" style={{ padding: '0 4px 14px' }}>
      <div className="row" style={{ gap: 10, minWidth: 0 }}><Avatar name={me.pseudo} photo={me.profilePhoto} size={44} /><div style={{ minWidth: 0 }}><b className="k-ellipsis" style={{ display: 'block' }}>{me.pseudo}</b><span className="k-dim k-xs">toi</span></div></div>
      <span style={{ font: '800 18px var(--font-title)', color: 'var(--k-muted)' }}>VS</span>
      <button type="button" className="row" disabled={!opp} onClick={() => opp && navigate(`/joueur/${opp.id}`)} aria-label={opp ? `Voir le profil de ${opp.pseudo}` : undefined}
        style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: opp ? 'pointer' : 'default' }}>
        <div style={{ textAlign: 'right', minWidth: 0 }}><b className="k-ellipsis" style={{ display: 'block' }}>{opp?.pseudo ?? '…'}</b><span className="k-dim k-xs">{opp ? `Niv. ${opp.stats.level} · voir le profil` : 'en attente'}</span></div>
        <Avatar name={opp?.pseudo ?? '?'} photo={opp?.profilePhoto} size={44} />
      </button>
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
  const { run, busy } = useAction()
  const d = c.matchDetails
  const [cs, setCs] = useState('')
  const [os, setOs] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Nouveau match nul déclaré : on repart de cases vides pour la manche décisive
  useEffect(() => { if (d?.lastDraw?.at) { setCs(''); setOs(''); setShot(null) } }, [d?.lastDraw?.at])

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
      {accepted ? <PreMatch c={c} me={me} opp={opp} /> : <Started c={c} />}

      {/* Étape 3 */}
      {!accepted && <div className="k-step now" style={{ marginTop: 10 }}>
        <div className="row"><span className={`k-num${accepted ? '' : ' now'}`}>3</span><b className={`grow${accepted ? ' k-muted' : ''}`}>Déclarez le score final</b></div>
        {!accepted && d?.lastDraw && !myReport && (
          <div className="k-card" style={{ marginTop: 14, borderColor: 'rgba(255,169,77,.6)', background: 'rgba(255,169,77,.08)' }}>
            <b style={{ color: 'var(--k-orange)' }}>🤝 Match nul {isCreator ? d.lastDraw.creatorScore : d.lastDraw.opponentScore} – {isCreator ? d.lastDraw.opponentScore : d.lastDraw.creatorScore}{(d.drawCount ?? 1) > 1 ? ` (${d.drawCount}e fois)` : ''}</b>
            <p className="k-small" style={{ margin: '6px 0 0' }}>Un défi doit avoir un vainqueur. Rejouez une <b>manche décisive</b> dans eFootball (ou un match avec prolongations et tirs au but), puis déclarez ici le score de cette manche.</p>
            <p className="k-dim k-xs" style={{ margin: '6px 0 0' }}>Vous ne voulez pas rejouer ? Proposez plutôt l'annulation d'un commun accord plus bas : chacun récupère sa mise.</p>
          </div>
        )}
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
      </div>}

      <CancelAgreement c={c} me={me} opp={opp} />

      {!accepted && !myReport && oppReport && (
        <div className="k-card row" style={{ marginTop: 12, padding: '12px 14px', gap: 10 }}>
          <Avatar name={opp.pseudo} size={32} /><span className="grow k-muted k-small">{opp.pseudo} a déjà déclaré son score</span>
          <span className="k-pill" style={{ background: 'rgba(46,229,157,.14)', color: 'var(--k-green)' }}>reçu</span>
        </div>
      )}
    </>
  )
}

// ----- Avant le match : rôles, présence, confirmation des deux joueurs -----
function PlayerStatus({ u, label, role, ready, online }: { u: User; label: string; role: string; ready: boolean; online: boolean }) {
  return (
    <div className="col" style={{ alignItems: 'center', gap: 6, flex: 1, minWidth: 0, textAlign: 'center' }}>
      <div style={{ position: 'relative' }}>
        <Avatar name={u.pseudo} photo={u.profilePhoto} size={52} />
        <span title={online ? 'en ligne' : 'hors ligne'} style={{ position: 'absolute', right: 0, bottom: 2, width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--k-now)', background: online ? 'var(--k-green)' : 'var(--k-dim)' }} />
      </div>
      <b className="k-small k-ellipsis" style={{ maxWidth: '100%' }}>{label}</b>
      <span className="k-dim k-xs">{role} · {online ? 'en ligne' : 'hors ligne'}</span>
      <span className="k-pill" style={{ background: ready ? 'rgba(46,229,157,.14)' : 'var(--k-s2)', color: ready ? 'var(--k-green)' : 'var(--k-muted)' }}>{ready ? '✓ dans la partie' : '… pas encore'}</span>
    </div>
  )
}

function PreMatch({ c, me, opp }: { c: Challenge; me: User; opp: User }) {
  const snack = useSnack()
  const navigate = useNavigate()
  const { run, busy } = useAction()
  const now = useNow(true)
  const d = c.matchDetails
  const isHost = c.creatorId === me.id
  const host = isHost ? me : opp
  const inRoom = d?.inRoom ?? []
  const meIn = inRoom.includes(me.id)
  const oppIn = inRoom.includes(opp.id)
  const oppOnline = useOnline(opp.id)
  const deadline = new Date(d?.acceptedAt ?? c.createdAt).getTime() + START_DEADLINE_MINUTES * 60000
  const left = Math.max(0, Math.floor((deadline - now) / 1000))
  const expired = left === 0
  const clock = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
  const [room, setRoom] = useState(d?.roomCode ?? '')
  useEffect(() => { setRoom(d?.roomCode ?? '') }, [d?.roomCode])
  const [myId, setMyId] = useState('')

  async function confirmIn(value: boolean) {
    const r = await run(() => challengeService.setInRoom(c.id, value))
    if (r?.state === 'started') snack('⚽ Le match a commencé, bon match !', 'success')
    else if (r && value) snack(`C'est noté. Le match démarre dès que ${opp.pseudo} confirme aussi.`, 'success')
  }

  return (
    <div className="k-step now">
      <div className="row between">
        <b style={{ fontSize: 17 }}>Avant le match</b>
        <span className="k-pill" style={{ background: expired ? 'rgba(255,107,133,.16)' : 'var(--k-s2)', color: expired ? 'var(--k-red)' : 'var(--k-text)', fontSize: 14 }}>
          <Clock size={14} />{expired ? 'Délai dépassé' : clock}
        </span>
      </div>
      <p className="k-dim k-xs" style={{ margin: '4px 0 0' }}>
        {expired ? `Le match n'a pas commencé dans les ${START_DEADLINE_MINUTES} minutes.` : `Temps restant pour commencer le match. Sinon, chacun pourra annuler et récupérer sa mise.`}
      </p>

      <div className="row" style={{ margin: '16px 0 4px', alignItems: 'flex-start' }}>
        <PlayerStatus u={me} label="Toi" role={isHost ? 'hôte' : 'invité'} ready={meIn} online />
        <PlayerStatus u={opp} label={opp.pseudo} role={isHost ? 'invité' : 'hôte'} ready={oppIn} online={oppOnline} />
      </div>
      {!oppOnline && !oppIn && <p className="k-dim k-xs" style={{ textAlign: 'center', margin: '6px 0 0' }}>{opp.pseudo} n'a pas l'appli ouverte : il a reçu une notification.</p>}

      {!me.efootballId && (
        <div className="k-card" style={{ marginTop: 14, borderColor: 'rgba(255,214,10,.5)' }}>
          <b className="k-small">Ajoute ton ID eFootball</b>
          <p className="k-dim k-xs" style={{ margin: '4px 0 8px' }}>{opp.pseudo} en a besoin pour t'ajouter en ami dans le jeu.</p>
          <div className="row" style={{ gap: 8 }}>
            <label className="k-field grow" style={{ minHeight: 44 }}><input value={myId} onChange={(e) => setMyId(e.target.value)} placeholder="Ton ID eFootball" aria-label="Ton ID eFootball" maxLength={40} style={{ height: 42 }} /></label>
            <button type="button" className="k-btn primary sm" disabled={busy || !myId.trim()} onClick={() => run(() => userService.updateProfile({ efootballId: myId.trim() }), 'ID eFootball enregistré')}>OK</button>
          </div>
        </div>
      )}

      <p className="k-label" style={{ margin: '18px 0 8px', color: 'var(--cyan)' }}>{isHost ? 'Ton rôle : tu crées la partie' : 'Ton rôle : tu rejoins la partie'}</p>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }} className="k-small">
        <li>
          {isHost ? <>Dans eFootball, ajoute <b>{opp.pseudo}</b> en ami avec son ID :</> : <>Dans eFootball, accepte la demande d'ami de <b>{host.pseudo}</b> (ou ajoute-le avec son ID) :</>}
          <div className="k-field" style={{ marginTop: 6, minHeight: 46 }}>
            {opp.efootballId ? (
              <>
                <span className="k-mono grow k-ellipsis">{opp.efootballId}</span>
                <button type="button" className="k-icon" style={{ background: 'transparent', color: 'var(--cyan)', width: 38, height: 38 }} aria-label="Copier l'ID" onClick={() => copy(opp.efootballId!, snack, 'ID copié')}><Copy size={18} /></button>
              </>
            ) : <span className="grow k-dim k-xs" style={{ padding: '12px 0' }}>{opp.pseudo} n'a pas encore renseigné son ID : demande-le dans les messages.</span>}
          </div>
        </li>
        <li>{isHost ? <>Va dans <b>Match amical</b>, crée la partie et <b>invite {opp.pseudo}</b>.</> : <>Attends l'<b>invitation de {host.pseudo}</b> dans eFootball et accepte-la.</>}</li>
        <li>Quand tu es <b>dans la partie</b>, confirme ici. Le match démarre automatiquement dès que vous avez confirmé tous les deux.</li>
      </ol>

      <label className="k-field" style={{ marginTop: 14 }}>
        <span className="k-dim k-xs">Code de salle</span>
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder={isHost ? 'Optionnel' : 'Partagé par l\'hôte'} aria-label="Code de salle" maxLength={40} />
        {room && room === (d?.roomCode ?? '') ? (
          <button type="button" className="k-icon" style={{ background: 'transparent', color: 'var(--cyan)' }} aria-label="Copier le code" onClick={() => copy(room, snack, 'Code copié')}><Copy size={20} /></button>
        ) : room.trim() ? (
          <button type="button" className="k-btn primary sm" disabled={busy} onClick={() => run(() => challengeService.setRoomCode(c.id, room), 'Code partagé')}>Partager</button>
        ) : null}
      </label>

      {meIn ? (
        <>
          <div className="k-card" style={{ marginTop: 14, textAlign: 'center', borderColor: 'rgba(46,229,157,.5)', background: 'rgba(46,229,157,.06)' }}>
            <b style={{ color: 'var(--k-green)' }}>✓ Tu es dans la partie</b>
            <p className="k-small k-muted" style={{ margin: '4px 0 0' }}>En attente de la confirmation de {opp.pseudo}…</p>
          </div>
          <button type="button" className="k-link k-small" style={{ width: '100%', textAlign: 'center' }} disabled={busy} onClick={() => confirmIn(false)}>Je ne suis plus dans la partie</button>
        </>
      ) : (
        <button type="button" className="k-btn primary block" style={{ marginTop: 14 }} disabled={busy || !me.efootballId} onClick={() => confirmIn(true)}>
          <Check size={20} />Je suis dans la partie
        </button>
      )}
      {!me.efootballId && <p className="k-dim k-xs" style={{ textAlign: 'center', margin: '6px 0 0' }}>Ajoute d'abord ton ID eFootball ci-dessus.</p>}
      {oppIn && !meIn && <p className="k-small" style={{ textAlign: 'center', margin: '8px 0 0', color: 'var(--k-green)' }}>{opp.pseudo} est déjà dans la partie et t'attend !</p>}

      {expired && (
        <button type="button" className="k-btn danger block" style={{ marginTop: 12 }} disabled={busy}
          onClick={async () => { if (await run(async () => { await challengeService.cancelNoShow(c.id); return true }, 'Match annulé, ta mise est rendue')) navigate('/', { replace: true }) }}>
          Annuler et récupérer ma mise
        </button>
      )}
    </div>
  )
}

/** Bandeau affiché dès que les deux joueurs ont confirmé. */
function Started({ c }: { c: Challenge }) {
  const now = useNow(true)
  const start = c.matchDetails?.matchStartedAt ? new Date(c.matchDetails.matchStartedAt).getTime() : now
  const sec = Math.max(0, Math.floor((now - start) / 1000))
  return (
    <div className="k-card" style={{ textAlign: 'center', borderColor: 'rgba(46,229,157,.55)', background: 'rgba(46,229,157,.07)' }}>
      <b style={{ color: 'var(--k-green)', fontSize: 18 }}>⚽ Le match a commencé</b>
      <div style={{ font: '800 40px var(--font-title)', fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}>{String(Math.floor(sec / 60)).padStart(2, '0')}:{String(sec % 60).padStart(2, '0')}</div>
      <p className="k-small k-muted" style={{ margin: 0 }}>Bon match ! Reviens ici à la fin pour déclarer le score.</p>
    </div>
  )
}

// ----- Annulation d'un commun accord -----
function CancelAgreement({ c, me, opp }: { c: Challenge; me: User; opp?: User }) {
  const { run, busy } = useAction()
  const [confirm, setConfirm] = useState(false)
  const votes = c.matchDetails?.cancelVotes ?? []
  const mine = votes.includes(me.id)
  const theirs = !!opp && votes.includes(opp.id)
  return (
    <div className="k-card" style={{ marginTop: 16, borderStyle: 'dashed' }}>
      {theirs && !mine ? (
        <>
          <p className="k-small"><b>{opp?.pseudo}</b> propose d'annuler le match : chacun récupère sa mise de {sc(c.amount)} SC.</p>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button type="button" className="k-btn primary sm grow" disabled={busy} onClick={() => run(() => challengeService.agreeCancel(c.id), 'Match annulé, mise rendue')}>Accepter l'annulation</button>
          </div>
        </>
      ) : mine ? (
        <div className="row">
          <span className="grow k-small k-muted">Tu as proposé d'annuler. En attente de l'accord de {opp?.pseudo}.</span>
          <button type="button" className="k-link k-small" disabled={busy} onClick={() => run(() => challengeService.agreeCancel(c.id, true), 'Demande retirée')}>Retirer</button>
        </div>
      ) : (
        <button type="button" className="k-link k-small" style={{ width: '100%', textAlign: 'center', color: 'var(--k-muted)' }} onClick={() => setConfirm(true)}>
          Un problème ? Proposer d'annuler le match d'un commun accord
        </button>
      )}
      {confirm && (
        <div className="mt-12">
          <p className="k-small">Si {opp?.pseudo} accepte aussi, le match est annulé et chacun récupère sa mise. Personne ne gagne ni ne perd.</p>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button type="button" className="k-btn ghost sm grow" onClick={() => setConfirm(false)}>Non</button>
            <button type="button" className="k-btn primary sm grow" disabled={busy} onClick={async () => { await run(() => challengeService.agreeCancel(c.id), `Demande envoyée à ${opp?.pseudo}`); setConfirm(false) }}>Proposer l'annulation</button>
          </div>
        </div>
      )}
    </div>
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
        {(c.creatorId === me.id || c.opponentId === me.id) && <div style={{ textAlign: 'left' }}><CancelAgreement c={c} me={me} opp={opp} /></div>}
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
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
function Chat({ c, me }: { c: Challenge; me: User }) {
  const snack = useSnack()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const msgs = c.chatMessages.filter((m) => !SYSTEM.test(m.message))
  const [open, setOpen] = useState(msgs.length > 0)
  const oppId = c.creatorId === me.id ? c.opponentId : c.creatorId
  const opp = userService.getById(oppId)
  const last = msgs[msgs.length - 1]
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
      <button type="button" className="row" style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 0', width: '100%' }} onClick={() => setOpen(!open)}>
        <MessageCircle size={16} />
        <b className="k-small">Messages avec {opp?.pseudo ?? 'ton adversaire'}</b>
        <span className="grow" />
        <span className="k-dim k-xs">{open ? 'masquer' : msgs.length ? `${msgs.length} · afficher` : 'afficher'}</span>
      </button>
      {!open && last && (
        <p className="k-small k-ellipsis" style={{ margin: '0 0 8px', color: 'var(--k-muted)' }}>
          <b style={{ color: last.senderId === me.id ? 'var(--cyan)' : 'var(--k-text)' }}>{last.senderId === me.id ? 'Toi' : opp?.pseudo}</b> : {last.message}
        </p>
      )}
      {open && (
        <div ref={listRef} className="col" style={{ gap: 2, maxHeight: 240, overflowY: 'auto', margin: '6px 0 8px' }}>
          {msgs.length === 0 && <p className="k-dim k-small">Aucun message. Écris à {opp?.pseudo ?? 'ton adversaire'} pour vous retrouver dans eFootball.</p>}
          {msgs.map((m, i) => {
            const mine = m.senderId === me.id
            const sender = mine ? me : userService.getById(m.senderId)
            const firstOfGroup = i === 0 || msgs[i - 1].senderId !== m.senderId
            const lastOfGroup = i === msgs.length - 1 || msgs[i + 1].senderId !== m.senderId
            return (
              <div key={i} className="row" style={{ alignItems: 'flex-end', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: firstOfGroup ? 8 : 0 }}>
                {!mine && (lastOfGroup
                  ? <button type="button" onClick={() => navigate(`/joueur/${m.senderId}`)} aria-label={`Profil de ${sender?.pseudo}`} style={{ all: 'unset', cursor: 'pointer' }}><Avatar name={sender?.pseudo ?? '?'} photo={sender?.profilePhoto} size={28} /></button>
                  : <span style={{ width: 28, flex: 'none' }} />)}
                <div className="col" style={{ alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                  {firstOfGroup && <span className="k-xs" style={{ color: mine ? 'var(--cyan)' : 'var(--k-muted)', fontWeight: 600, margin: '0 4px 2px' }}>{mine ? 'Toi' : sender?.pseudo ?? 'Joueur'}</span>}
                  <span className={`k-msg ${mine ? 'me' : 'them'}`} style={{ maxWidth: '100%' }}>{m.message}</span>
                  {lastOfGroup && <span className="k-dim" style={{ fontSize: 11, margin: '2px 4px 0' }}>{hhmm(m.timestamp)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); send() }}>
        <label className="k-field grow" style={{ minHeight: 44, borderRadius: 22 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setOpen(true)} placeholder={`Écrire à ${opp?.pseudo ?? 'ton adversaire'}…`} aria-label="Message" maxLength={500} style={{ height: 42 }} />
        </label>
        <button type="submit" className="k-icon primary" aria-label="Envoyer"><Send size={20} /></button>
      </form>
    </div>
  )
}
