// Transposé de stream_list_screen, live_stream_screen, watch_stream_screen (.dart) et stream_service.dart
// Comme dans l'original, la diffusion vidéo vers les spectateurs est SIMULÉE (il faudra un serveur
// vidéo pour la rendre réelle). Le streamer voit cependant sa vraie caméra en aperçu.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Coins, Eye, MessageCircle, Radio, Send, Square, Users, Video, VideoOff } from 'lucide-react'
import { AppBar, Avatar, BottomSheet, Button, Dialog, Empty, TextField, useAction, useSnack } from '../components/ui'
import { SoccerBall } from '../components/icons'
import { useUser } from '../services/auth'
import { db, useDb } from '../lib/db'
import { rpc } from '../lib/api'
import { challengeService, STATUS_META } from '../services/challenges'
import { userService } from '../services/users'
import { sc } from '../lib/format'
import type { Stream } from '../lib/types'

const streamService = {
  live: () => db.list('streams').filter((x) => x.status === 'live').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  start: (challengeId: string) => rpc<Stream>('stream.start', { challengeId }),
  end: (id: string) => rpc('stream.end', { id }),
  join: (id: string) => rpc('stream.join', { id }),
  leave: (id: string) => rpc('stream.leave', { id }),
  chat: (id: string, message: string) => rpc('stream.chat', { id, message }),
  tip: (id: string, amount: number, message: string | null) => rpc('stream.tip', { id, amount, message }),
}

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

function useElapsed(since: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
}

// ================= Liste =================
export function StreamListScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const { run } = useAction()
  const [tab, setTab] = useState(0)
  const [picking, setPicking] = useState(false)
  const live = streamService.live()
  const active = challengeService.getActive(user.id)

  return (
    <div className="screen with-nav" style={{ background: 'linear-gradient(180deg, #5C0A33, var(--dark-navy))' }}>
      <div style={{ padding: 16 }}>
        <h1 className="display-sm black anim-fade">Diffusion en direct</h1>
        <p className="body-md mt-4" style={{ color: 'rgba(255,255,255,.7)' }}>Regardez les défis en direct</p>
        <div className="row mt-16" style={{ padding: 4, borderRadius: 14, background: 'rgba(0,0,0,.25)' }}>
          {['Matchs en Direct', 'Diffuser'].map((l, i) => (
            <button key={l} type="button" onClick={() => setTab(i)} className="grow" style={{ padding: 12, borderRadius: 10, border: 0, cursor: 'pointer', fontWeight: 700, background: tab === i ? 'var(--pink)' : 'transparent', color: tab === i ? '#fff' : 'var(--text-grey)' }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        {tab === 0 && (live.length === 0 ? <Empty icon={VideoOff} title="Aucun stream en direct" text="Revenez plus tard pour regarder des défis en direct !" /> : live.map((s) => {
          const streamer = userService.getById(s.streamerId)
          const c = challengeService.getById(s.challengeId)
          return (
            <button key={s.id} type="button" onClick={() => navigate(s.streamerId === user.id ? `/stream/${s.id}/live` : `/stream/${s.id}/watch`)} className="card anim-up"
              style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 16, padding: 0, overflow: 'hidden', border: '1px solid rgba(255,0,110,.4)' }}>
              <div style={{ position: 'relative', aspectRatio: '16/9', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #1a0b2e, #3b0d2b)' }}>
                <SoccerBall size={56} color="rgba(255,255,255,.3)" />
                <span className="pill row" style={{ position: 'absolute', top: 12, left: 12, background: 'var(--error)', color: '#fff' }}><Radio size={12} />EN DIRECT</span>
                <span className="pill row" style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,.6)', color: '#fff' }}><Eye size={12} />{s.viewCount}</span>
              </div>
              <div className="row" style={{ padding: 14 }}>
                <Avatar name={streamer?.pseudo ?? '?'} size={40} />
                <div className="grow"><p className="bold">{streamer?.pseudo}</p><p className="body-sm">{c ? `${c.matchType} - ${sc(c.amount)} SC` : 'Match en direct'}</p></div>
              </div>
            </button>
          )
        }))}
        {tab === 1 && (
          <div className="center-col card" style={{ padding: 32, border: '1px solid rgba(255,0,110,.4)' }}>
            <span style={{ padding: 24, borderRadius: '50%', background: 'rgba(255,0,110,.15)' }}><Video size={56} color="var(--pink)" /></span>
            <h2 className="headline-sm mt-16">Diffuser votre Match</h2>
            <p className="body-md mt-8">{active.length === 0 ? 'Créez ou acceptez un défi pour diffuser' : 'Choisissez un défi actif pour commencer la diffusion'}</p>
            <Button block icon={Video} style={{ marginTop: 24, background: 'var(--pink)', color: '#fff' }} disabled={active.length === 0}
              onClick={() => (active.length ? setPicking(true) : snack('Créez ou acceptez un défi pour diffuser', 'warning'))}>
              {active.length === 0 ? 'Aucun défi actif' : `Diffuser (${active.length} défis actifs)`}
            </Button>
          </div>
        )}
      </div>
      <BottomSheet open={picking} onClose={() => setPicking(false)}>
        <h3 className="headline-sm mb-16">Choisir un défi à diffuser</h3>
        {active.map((c) => (
          <button key={c.id} type="button" className="list-tile" onClick={async () => { const s = await run(() => streamService.start(c.id)); setPicking(false); if (s) navigate(`/stream/${s.id}/live`) }}>
            <SoccerBall size={28} color="var(--cyan)" />
            <div className="grow"><p className="bold">{c.matchType} - {sc(c.amount)} SC</p><p className="body-sm">{c.platform} • Niveau {c.requiredLevel}+</p></div>
            <span className="pill" style={{ background: `color-mix(in srgb, ${STATUS_META[c.status].color} 20%, transparent)`, color: STATUS_META[c.status].color }}>{STATUS_META[c.status].label}</span>
          </button>
        ))}
      </BottomSheet>
    </div>
  )
}

function StreamStats({ s }: { s: Stream }) {
  const tips = s.tips.reduce((a, t) => a + t.amount, 0)
  return (
    <div className="row mt-12" style={{ justifyContent: 'space-around' }}>
      {[[Users, `${s.viewCount}`, 'Spectateurs'], [MessageCircle, `${s.chatMessages.length}`, 'Messages'], [Coins, `${sc(tips)} SC`, 'Tips']].map(([I, v, l]) => {
        const Icon = I as typeof Users
        return <div key={l as string} className="center-col"><Icon size={20} color="var(--pink)" /><span className="bold">{v as string}</span><span className="label-sm">{l as string}</span></div>
      })}
    </div>
  )
}

function StreamChat({ s, empty }: { s: Stream; userId?: string; empty: string }) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }) }, [s.chatMessages.length, s.tips.length])
  const items = [
    ...s.chatMessages.map((m) => ({ at: m.timestamp, who: m.senderId, text: m.message, tip: 0 })),
    ...s.tips.map((t) => ({ at: t.timestamp, who: t.senderId, text: t.message ?? '', tip: t.amount })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  return (
    <div className="card mt-12">
      <div ref={ref} style={{ height: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 ? <p className="body-sm center-col" style={{ margin: 'auto' }}>{empty}</p> : items.map((m, i) => (
          <p key={i} style={{ fontSize: 14, padding: m.tip ? '6px 10px' : 0, borderRadius: 10, background: m.tip ? 'rgba(255,214,10,.15)' : 'transparent' }}>
            <b style={{ color: m.who === s.streamerId ? 'var(--pink)' : 'var(--cyan)' }}>{userService.getById(m.who)?.username ?? 'Utilisateur'}</b>{' '}
            {m.tip ? <span className="yellow bold">💰 a envoyé {sc(m.tip)} SC </span> : null}{m.text}
          </p>
        ))}
      </div>
      <form className="row mt-8" onSubmit={(e) => { e.preventDefault(); const m = text.trim(); if (m) { setText(''); streamService.chat(s.id, m).catch(() => setText(m)) } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Envoyer un message..." aria-label="Message"
          style={{ flex: 1, height: 44, padding: '0 14px', borderRadius: 22, border: '1px solid var(--border-dark)', background: 'var(--deep-blue)', outline: 0 }} />
        <button type="submit" className="icon-btn" aria-label="Envoyer" style={{ background: 'var(--pink)' }}><Send size={20} /></button>
      </form>
    </div>
  )
}

// ================= Diffuser (streamer) =================
export function LiveStreamScreen() {
  useDb()
  const { id = '' } = useParams()
  const user = useUser()
  const { run } = useAction()
  const navigate = useNavigate()
  const s = db.get('streams', id)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camError, setCamError] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const elapsed = useElapsed(s?.createdAt ?? new Date().toISOString())

  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((m) => { stream = m; if (videoRef.current) videoRef.current.srcObject = m })
      .catch(() => setCamError(true))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  if (!s) return <div className="screen"><AppBar title="Stream" back /><Empty icon={VideoOff} title="Stream introuvable" /></div>
  return (
    <div className="screen" style={{ background: '#000' }}>
      <AppBar title={<span className="row" style={{ justifyContent: 'center' }}><span className="pill row" style={{ background: 'var(--error)', color: '#fff' }}><Radio size={12} />LIVE</span>{clock(elapsed)}</span>} back
        actions={s.status === 'live' ? <Button sm variant="danger" icon={Square} onClick={() => setConfirmEnd(true)}>Fin</Button> : null} />
      <div className="screen-body" style={{ paddingTop: 0 }}>
        <div style={{ position: 'relative', aspectRatio: '9/12', borderRadius: 16, overflow: 'hidden', background: '#111', display: 'grid', placeItems: 'center' }}>
          {camError ? <p className="body-md center-col" style={{ padding: 24 }}><VideoOff size={40} />Caméra indisponible. Autorisez l'accès à la caméra pour l'aperçu.</p>
            : <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <p className="body-sm mt-8">ℹ️ Aperçu local : la diffusion vers les spectateurs est simulée dans cette version.</p>
        <StreamStats s={s} />
        <StreamChat s={s} userId={user.id} empty="Aucun message pour le moment" />
      </div>
      <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)}>
        <h3 className="headline-sm">Terminer le stream</h3>
        <p className="body-md mt-12">Êtes-vous sûr de vouloir terminer ce stream ?</p>
        <div className="dialog-actions">
          <Button variant="text" onClick={() => setConfirmEnd(false)}>Annuler</Button>
          <Button variant="danger" sm onClick={async () => { await run(() => streamService.end(s.id)); navigate('/streaming', { replace: true }) }}>Terminer</Button>
        </div>
      </Dialog>
    </div>
  )
}

// ================= Regarder (spectateur) =================
export function WatchStreamScreen() {
  useDb()
  const { id = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const { run } = useAction()
  const s = db.get('streams', id)
  const [tipOpen, setTipOpen] = useState(false)
  const [tipAmount, setTipAmount] = useState('50')
  const [tipMsg, setTipMsg] = useState('')
  const elapsed = useElapsed(s?.createdAt ?? new Date().toISOString())

  useEffect(() => {
    if (!id) return
    streamService.join(id).catch(() => {})
    return () => { streamService.leave(id).catch(() => {}) }
  }, [id])

  if (!s) return <div className="screen"><AppBar title="Stream" back /><Empty icon={VideoOff} title="Stream introuvable" /></div>
  const streamer = userService.getById(s.streamerId)
  const c = challengeService.getById(s.challengeId)

  async function sendTip() {
    const n = parseFloat(tipAmount)
    if (!n || n <= 0) return
    if (await run(async () => { await streamService.tip(s!.id, n, tipMsg.trim() || null); return true }, `Tip de ${sc(n)} SC envoyé !`)) { setTipOpen(false); setTipMsg('') }
  }

  return (
    <div className="screen" style={{ background: '#000' }}>
      <AppBar title={streamer?.pseudo ?? 'Stream'} back />
      <div className="screen-body" style={{ paddingTop: 0 }}>
        <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 16, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #1a0b2e, #3b0d2b)' }}>
          <SoccerBall size={72} color="rgba(255,255,255,.25)" className="pulse" />
          <span className="pill row" style={{ position: 'absolute', top: 12, left: 12, background: s.status === 'live' ? 'var(--error)' : 'var(--text-muted)', color: '#fff' }}><Radio size={12} />{s.status === 'live' ? 'EN DIRECT' : 'TERMINÉ'}</span>
          <span className="pill" style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,.6)', color: '#fff' }}>{clock(elapsed)}</span>
          <p className="body-sm" style={{ position: 'absolute', bottom: 12 }}>Vidéo simulée</p>
        </div>
        <div className="row mt-12">
          <Avatar name={streamer?.pseudo ?? '?'} size={44} />
          <div className="grow"><p className="bold">{streamer?.pseudo}</p><p className="body-sm">{c ? `${c.matchType} • ${sc(c.amount)} SC` : 'Match en cours'}</p></div>
          <Button sm variant="yellow" icon={Coins} onClick={() => setTipOpen(true)}>Tip</Button>
        </div>
        <StreamStats s={s} />
        <StreamChat s={s} userId={user.id} empty="Soyez le premier à envoyer un message !" />
      </div>
      <BottomSheet open={tipOpen} onClose={() => setTipOpen(false)}>
        <h3 className="headline-sm mb-16">Envoyer un tip</h3>
        <div className="row gap-8 mb-16">{[25, 50, 100, 250].map((n) => <button key={n} type="button" className={`chip${tipAmount === String(n) ? ' selected' : ''}`} onClick={() => setTipAmount(String(n))}>{n} SC</button>)}</div>
        <TextField label="Montant" icon={Coins} inputMode="decimal" value={tipAmount} onChange={(e) => setTipAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        <TextField label="Message" placeholder="Ajouter un message..." value={tipMsg} onChange={(e) => setTipMsg(e.target.value)} />
        <div className="row"><Button variant="text" style={{ flex: 1 }} onClick={() => setTipOpen(false)}>Annuler</Button><Button style={{ flex: 1 }} onClick={sendTip}>Envoyer</Button></div>
      </BottomSheet>
      <Dialog open={s.status === 'ended'} onClose={() => navigate('/streaming', { replace: true })} dismissible={false}>
        <h3 className="headline-sm">Stream terminé</h3>
        <p className="body-md mt-12">Le streamer a terminé cette diffusion.</p>
        <div className="dialog-actions"><Button sm onClick={() => navigate('/streaming', { replace: true })}>OK</Button></div>
      </Dialog>
    </div>
  )
}
