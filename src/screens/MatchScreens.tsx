// Transposé de match_lobby_screen.dart et live_match_screen.dart
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, BarChart3, Camera, Check, CheckCircle2, Copy, ExternalLink, Gamepad2, Hourglass, Play, ShieldCheck, Trophy,
} from 'lucide-react'
import { AppBar, Avatar, Button, Empty, useAction, useSnack } from '../components/ui'
import { uploadImage } from '../lib/api'
import { SoccerBall } from '../components/icons'
import { ChallengeChat } from '../components/ChallengeChat'
import { useUser } from '../services/auth'
import { useDb } from '../lib/db'
import { challengeService } from '../services/challenges'
import { userService } from '../services/users'
import { readImage, sc } from '../lib/format'
import type { Challenge, User } from '../lib/types'

function PlayerCard({ user, ready, isMe }: { user?: User; ready: boolean; isMe: boolean }) {
  return (
    <div className="center-col" style={{ gap: 8, flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <Avatar name={user?.pseudo ?? '?'} photo={user?.profilePhoto} size={72} />
        {ready && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: '50%', background: 'var(--success)', display: 'grid', placeItems: 'center' }}><Check size={16} color="#fff" /></span>}
      </div>
      <span className="title-md ellipsis" style={{ maxWidth: 130 }}>{user?.pseudo ?? 'En attente'}{isMe ? ' (vous)' : ''}</span>
      {user && <span className="body-sm">Niveau {user.stats.level}</span>}
    </div>
  )
}

function MatchHeader({ c, me }: { c: Challenge; me: string }) {
  const creator = userService.getById(c.creatorId)
  const opponent = userService.getById(c.opponentId)
  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,.18), rgba(255,0,110,.18))', border: '1px solid rgba(0,229,255,.3)' }}>
      <div className="row">
        <PlayerCard user={creator} ready={!!c.matchDetails?.creatorReady} isMe={c.creatorId === me} />
        <div className="center-col">
          <span className="display-sm black" style={{ color: 'var(--yellow)' }}>VS</span>
          <span className="pill mt-8" style={{ background: 'rgba(255,214,10,.2)', color: 'var(--yellow)' }}>{sc(c.amount)} SC</span>
        </div>
        <PlayerCard user={opponent} ready={!!c.matchDetails?.opponentReady} isMe={c.opponentId === me} />
      </div>
    </div>
  )
}

function useChallenge() {
  useDb()
  const { id = '' } = useParams()
  return challengeService.getById(id)
}

// ================= Lobby =================
export function MatchLobbyScreen() {
  const c = useChallenge()
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()

  const { run, busy } = useAction()
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null)
  useEffect(() => { if (c?.status === 'inProgress') navigate(`/match/${c.id}/live`, { replace: true }) }, [c?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) {
    return <div className="screen"><AppBar title="Match Lobby" back /><Empty icon={AlertCircle} title="Impossible de charger le match" /></div>
  }
  if (!c.opponentId) {
    return (
      <div className="screen">
        <AppBar title="Match Lobby" back />
        <div className="screen-body center-col">
          <Hourglass size={72} color="var(--cyan)" className="pulse" />
          <h2 className="headline-md mt-24">En attente de l'adversaire...</h2>
          <p className="body-md mt-8">Le match se prépare</p>
        </div>
      </div>
    )
  }

  const isCreator = c.creatorId === user.id
  const meReady = optimisticReady ?? !!(isCreator ? c.matchDetails?.creatorReady : c.matchDetails?.opponentReady)
  const otherReady = !!(isCreator ? c.matchDetails?.opponentReady : c.matchDetails?.creatorReady)
  const statusText = c.status === 'inProgress' ? '🎮 Match en cours' : meReady && otherReady ? '✅ Tous les joueurs sont prêts !' : '⏳ En attente des joueurs...'

  return (
    <div className="screen gradient">
      <AppBar title="Match Lobby" back />
      <div className="screen-body">
        <MatchHeader c={c} me={user.id} />
        <p className="center-col mt-16 title-md" style={{ padding: 12, borderRadius: 14, background: 'var(--card-dark)' }}>{statusText}</p>

        <div className="card mt-16">
          <p className="title-md">Informations du match</p>
          <div className="col mt-8" style={{ gap: 10 }}>
            <span className="row grey"><SoccerBall size={18} color="var(--cyan)" />Type<span className="grow" /><span className="bold" style={{ color: '#fff' }}>{c.matchType}</span></span>
            <span className="row grey"><Gamepad2 size={18} color="var(--cyan)" />Plateforme<span className="grow" /><span className="bold" style={{ color: '#fff' }}>{c.platform}</span></span>
            <span className="row grey"><BarChart3 size={18} color="var(--cyan)" />Niveau requis<span className="grow" /><span className="bold" style={{ color: '#fff' }}>Niveau {c.requiredLevel}</span></span>
          </div>
        </div>

        <div className="card mt-16">
          <p className="title-md">État de préparation</p>
          <label className="row mt-12" style={{ padding: 14, borderRadius: 14, background: meReady ? 'rgba(0,255,135,.12)' : 'var(--deep-blue)', cursor: 'pointer' }}>
            <input type="checkbox" checked={meReady} onChange={(e) => { const v = e.target.checked; setOptimisticReady(v); run(() => challengeService.setReady(c.id, v)).finally(() => setOptimisticReady(null)) }} style={{ width: 22, height: 22, accentColor: 'var(--success)' }} />
            <span className="bold">Je suis prêt</span>
          </label>
          <p className="row mt-12" style={{ color: otherReady ? 'var(--success)' : 'var(--text-grey)' }}>
            {otherReady ? <CheckCircle2 size={20} /> : <Hourglass size={20} />}
            {otherReady ? "L'adversaire est prêt" : "En attente de l'adversaire..."}
          </p>
        </div>

        <ChallengeChat c={c} userId={user.id} />

        <Button block icon={Play} style={{ marginTop: 24 }} disabled={!meReady || !otherReady} loading={busy}
          onClick={async () => {
            if (!meReady) return snack('Vous devez être prêt pour commencer', 'warning')
            if (await run(async () => { await challengeService.start(c.id); return true })) navigate(`/match/${c.id}/live`)
          }}>
          {meReady && otherReady ? 'Lancer le match' : 'En attente des deux joueurs'}
        </Button>
      </div>
    </div>
  )
}

// ================= Match en direct =================
export function LiveMatchScreen() {
  const c = useChallenge()
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const [now, setNow] = useState(Date.now())
  const [exits, setExits] = useState(0)
  const [creatorScore, setCreatorScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { run, busy } = useAction()

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    // Surveillance : compte les sorties de l'application pendant le match (informatif)
    const onVis = () => { if (document.visibilityState === 'hidden') setExits((n) => n + 1) }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!c || !c.opponentId) {
    return <div className="screen"><AppBar title="Match" back /><Empty icon={AlertCircle} title="Impossible de charger le match" /></div>
  }

  const creator = userService.getById(c.creatorId)
  const opponent = userService.getById(c.opponentId)
  const d = c.matchDetails
  const started = d?.matchStartedAt ? new Date(d.matchStartedAt).getTime() : null
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const myReport = d?.reports?.[user.id]
  const otherId = user.id === c.creatorId ? c.opponentId : c.creatorId
  const otherReport = d?.reports?.[otherId]
  const finished = c.status === 'completed' || c.status === 'disputed' || c.status === 'cancelled'
  const level = exits >= 3 ? 'critical' : exits >= 1 ? 'warning' : 'ok'

  async function copyCode() {
    if (!d?.matchCode) return
    try { await navigator.clipboard.writeText(d.matchCode) } catch { /* ignore */ }
    snack(`Code copié : ${d.matchCode}`, 'success')
  }

  function launchEfootball() {
    const ua = navigator.userAgent
    const url = /android/i.test(ua) ? 'intent://#Intent;package=jp.konami.pesam;end'
      : /iphone|ipad/i.test(ua) ? 'efootball://' : 'https://www.konami.com/efootball/'
    window.location.href = url
    snack(`eFootball lancé ! Utilisez le code: ${d?.matchCode}`, 'success')
  }

  async function pickScreenshot(file?: File) {
    if (!file) return
    await run(async () => {
      const url = await uploadImage(await readImage(file))
      await challengeService.addScreenshot(c!.id, url)
      setScreenshot(url)
    }, "📸 Capture d'écran enregistrée !")
  }

  async function submit() {
    const a = parseInt(creatorScore, 10)
    const b = parseInt(opponentScore, 10)
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) return snack('⚠️ Entrez les deux scores.', 'warning')
    const r = await run(() => challengeService.reportScore(c!.id, a, b, screenshot))
    if (!r) return
    if (r.state === 'waiting') snack('✅ Score envoyé. En attente de la confirmation de votre adversaire.', 'success')
    if (r.state === 'completed') snack('✅ Résultat validé par les deux joueurs !', 'success')
    if (r.state === 'draw') { snack('Match nul ! Rejouez une manche décisive.', 'warning'); setCreatorScore(''); setOpponentScore('') }
    if (r.state === 'disputed') snack('⚖️ Les scores ne concordent pas : litige ouvert, un arbitre va trancher.', 'error')
  }

  return (
    <div className="screen gradient">
      <AppBar title="Match en direct" back onBack={() => navigate('/defis')} />
      <div className="screen-body">
        <MatchHeader c={c} me={user.id} />

        <div className="center-col card mt-16">
          <p className="title-sm" style={{ color: started ? 'var(--success)' : 'var(--yellow)' }}>{started && !finished ? '⚽ MATCH EN COURS' : finished ? '🏁 MATCH TERMINÉ' : '⏳ PRÉPARATION DU MATCH'}</p>
          <p className="display-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</p>
        </div>

        {finished ? (
          <ResultCard c={c} userId={user.id} onDetails={() => navigate(`/challenges/${c.id}`)} />
        ) : (
          <>
            <div className="card mt-16" style={{ border: '1px solid rgba(255,214,10,.4)' }}>
              <p className="label-md">CODE DU MATCH</p>
              <div className="row mt-8">
                <span className="display-sm grow" style={{ letterSpacing: 3, color: 'var(--yellow)' }}>{d?.matchCode ?? 'KF-XXXXX'}</span>
                <button type="button" className="icon-btn" aria-label="Copier le code" title="Copier le code" onClick={copyCode} style={{ color: 'var(--yellow)' }}><Copy /></button>
              </div>
              <p className="body-sm mt-8">📋 Partagez ce code avec votre adversaire pour créer la partie amicale dans eFootball</p>
            </div>

            <div className="card mt-16">
              <Button block icon={ExternalLink} variant="yellow" onClick={launchEfootball}>Ouvrir eFootball</Button>
              <p className="body-md mt-12" style={{ whiteSpace: 'pre-line' }}>{'✅ Instructions:\n1. Cliquez sur "Ouvrir eFootball"\n2. Allez dans "Match Amical"\n3. Entrez le code ci-dessus\n4. Jouez le match\n5. Revenez ici et déclarez le score final'}</p>
            </div>

            <div className="card mt-16" style={{ border: `1px solid ${level === 'ok' ? 'var(--success)' : level === 'warning' ? 'var(--warning)' : 'var(--error)'}` }}>
              <p className="row title-sm"><ShieldCheck size={20} color={level === 'ok' ? 'var(--success)' : 'var(--warning)'} />
                {level === 'critical' ? '❌ VIOLATIONS CRITIQUES' : level === 'warning' ? '⚠️ SORTIES DÉTECTÉES' : '✅ SURVEILLANCE ACTIVE'}</p>
              <p className="body-sm mt-4">Sorties de KickFlow pendant le match : {exits} (normal si vous jouez sur le même téléphone)</p>
            </div>

            <div className="card mt-16">
              <p className="title-md">Déclarer le score final</p>
              <p className="body-sm mt-4" style={{ whiteSpace: 'pre-line' }}>{'1. Prenez un screenshot du résultat final dans eFootball\n2. Entrez les scores de chaque joueur\n3. Votre adversaire fait de même\n4. Si les deux déclarations concordent, le gagnant est payé\n5. Sinon, un arbitre examine les captures'}</p>
              {myReport ? (
                <div className="mt-16 center-col" style={{ padding: 16, borderRadius: 14, background: 'rgba(0,255,135,.1)' }}>
                  <CheckCircle2 color="var(--success)" size={32} />
                  <p className="bold mt-8">Vous avez déclaré {myReport.creatorScore} - {myReport.opponentScore}</p>
                  <p className="body-sm mt-4">{otherReport ? 'Votre adversaire a aussi déclaré.' : "En attente de la déclaration de l'adversaire..."}</p>
                </div>
              ) : (
                <>
                  <div className="row mt-16" style={{ alignItems: 'flex-end' }}>
                    {[[creator, creatorScore, setCreatorScore], [opponent, opponentScore, setOpponentScore]].map(([p, v, set], i) => (
                      <label key={i} className="center-col grow" style={{ gap: 6 }}>
                        <span className="label-md ellipsis" style={{ maxWidth: '100%' }}>{(p as User | undefined)?.pseudo}</span>
                        <input inputMode="numeric" value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          aria-label={`Score de ${(p as User | undefined)?.pseudo}`}
                          style={{ width: 80, height: 64, textAlign: 'center', fontSize: 32, fontWeight: 800, borderRadius: 16, border: '2px solid var(--border-dark)', background: 'var(--deep-blue)', outline: 0 }} />
                      </label>
                    ))}
                  </div>
                  {otherReport && <p className="body-sm mt-12 center-col">Votre adversaire a déjà déclaré son score.</p>}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickScreenshot(e.target.files?.[0])} />
                  <Button variant="outline" block icon={Camera} style={{ marginTop: 16 }} onClick={() => fileRef.current?.click()}>
                    {screenshot ? 'Changer la capture du score' : 'Ajouter la capture du score'}
                  </Button>
                  <p className="body-sm mt-8 center-col">{d?.screenshotUrls.length ?? 0} capture(s) enregistrée(s)</p>
                  {screenshot && <img src={screenshot} alt="Capture du score" style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />}
                  <Button block loading={busy} style={{ marginTop: 16 }} onClick={submit}>Soumettre le Résultat</Button>
                </>
              )}
            </div>
          </>
        )}

        <ChallengeChat c={c} userId={user.id} title="Chat du match" />
      </div>
    </div>
  )
}

function ResultCard({ c, userId, onDetails }: { c: Challenge; userId: string; onDetails: () => void }) {
  const won = c.matchDetails?.winnerId === userId
  const d = c.matchDetails
  if (c.status === 'disputed') {
    return (
      <div className="card mt-16 center-col" style={{ border: '1px solid var(--orange)' }}>
        <span style={{ fontSize: 48 }}>⚖️</span>
        <p className="headline-sm mt-8">Litige en cours</p>
        <p className="body-md mt-8">{c.dispute?.reason}</p>
        <p className="body-sm mt-8">Un arbitre va examiner les captures et trancher.</p>
        <Button variant="text" onClick={onDetails}>Voir le détail</Button>
      </div>
    )
  }
  if (c.status === 'cancelled') {
    return <div className="card mt-16 center-col"><p className="headline-sm">Match annulé</p><p className="body-md mt-8">Les mises ont été remboursées.</p></div>
  }
  return (
    <div className="card mt-16 center-col anim-scale" style={{ border: `1px solid ${won ? 'var(--yellow)' : 'var(--border-dark)'}` }}>
      {won ? <Trophy size={56} color="var(--yellow)" /> : <span style={{ fontSize: 48 }}>😔</span>}
      <p className="headline-md mt-8">{won ? 'Victoire !' : 'Défaite'}</p>
      {d?.creatorScore != null && <p className="display-sm mt-8">{d.creatorScore} - {d.opponentScore}</p>}
      <p className="body-md mt-8">{won ? `Vous avez gagné ${sc(c.amount * 2 * 0.8)} SC !` : 'Vous avez 5 minutes pour contester le résultat si nécessaire.'}</p>
      <Button variant="text" onClick={onDetails}>{won ? 'Voir le détail' : 'Voir le détail / Contester'}</Button>
    </div>
  )
}
