// Transposé de create_dispute_screen.dart, disputes_screen.dart, dispute_evidence_viewer.dart
// + écran d'arbitrage (absent de l'original) pour que les arbitres puissent trancher.
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, FileImage, Folder, Gavel, Info, Scale, ShieldCheck, Upload, X } from 'lucide-react'
import { AppBar, Avatar, Button, Dialog, Empty, TextArea, useAction, useSnack } from '../components/ui'
import { uploadImage } from '../lib/api'
import { useUser } from '../services/auth'
import { useDb } from '../lib/db'
import { canDispute, challengeService, STATUS_META } from '../services/challenges'
import { userService } from '../services/users'
import { formatShort, readImage, sc } from '../lib/format'
import type { Challenge } from '../lib/types'

const REASONS = [
  "L'adversaire n'a pas payé",
  "L'adversaire a triché",
  'Match non joué',
  'Problème de connexion',
  'Résultat incorrect',
  'Autre (précisez ci-dessous)',
]
const OTHER = REASONS[REASONS.length - 1]

// ================= Ouvrir un litige =================
export function CreateDisputeScreen() {
  useDb()
  const { id = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const snack = useSnack()
  const { run, busy } = useAction()
  const c = challengeService.getById(id)
  const [reason, setReason] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [proofs, setProofs] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  if (!c) return <div className="screen"><AppBar title="Ouvrir une dispute" back /><Empty icon={Info} title="Défi introuvable" /></div>
  const allowed = canDispute(c, user.id)

  async function pick(files: FileList | null) {
    if (!files) return
    try {
      const imgs = await Promise.all(Array.from(files).slice(0, 5 - proofs.length).map((f) => readImage(f)))
      setProofs([...proofs, ...imgs])
    } catch (e) {
      snack(`Erreur lors de la sélection: ${(e as Error).message}`, 'error')
    }
  }

  async function submit() {
    if (!reason) return snack('Veuillez sélectionner une raison', 'warning')
    const finalReason = reason === OTHER ? custom.trim() : reason
    if (!finalReason) return snack('Veuillez préciser la raison', 'warning')
    const ok = await run(async () => {
      const urls = await Promise.all(proofs.map(uploadImage))
      await challengeService.openDispute(c!.id, finalReason, urls)
      return true
    }, 'Dispute ouverte avec succès')
    if (ok) navigate(`/challenges/${c!.id}`, { replace: true })
  }

  const screenshots = c.matchDetails?.screenshotUrls ?? []
  return (
    <div className="screen">
      <AppBar title="Ouvrir une dispute" back />
      <div className="screen-body">
        <div className="card row between">
          <span className="title-md">Match #{c.id.slice(0, 8)}</span>
          <span className="bold yellow">{sc(c.amount)} XOF</span>
        </div>
        {!allowed && <p className="card mt-16" style={{ color: 'var(--warning)' }}>Le délai de 5 minutes pour contester ce match est dépassé, ou un litige existe déjà.</p>}

        <div className="card mt-16">
          <p className="row title-sm"><ShieldCheck size={20} color="var(--cyan)" />Preuves automatiques du match</p>
          {screenshots.length ? <p className="row body-md mt-8"><Camera size={18} />{screenshots.length} capture(s) d'écran</p>
            : <p className="body-sm mt-8">Aucune preuve automatique disponible</p>}
          <p className="body-sm mt-8">Ces preuves seront automatiquement incluses dans votre dispute</p>
        </div>

        <p className="title-md mt-24 mb-8">Raison de la dispute</p>
        {REASONS.map((r) => (
          <label key={r} className="row" style={{ padding: 14, marginBottom: 8, borderRadius: 14, cursor: 'pointer', background: reason === r ? 'rgba(0,229,255,.12)' : 'var(--card-dark)', border: `1px solid ${reason === r ? 'var(--cyan)' : 'var(--border-dark)'}` }}>
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: 'var(--cyan)', width: 18, height: 18 }} />
            {r}
          </label>
        ))}
        {reason === OTHER && <TextArea label="Précisez" value={custom} onChange={setCustom} placeholder="Décrivez le problème..." />}

        <p className="title-md mt-16 mb-8">Preuves additionnelles (captures d'écran)</p>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => pick(e.target.files)} />
        <button type="button" className="center-col" onClick={() => fileRef.current?.click()} disabled={proofs.length >= 5}
          style={{ width: '100%', padding: 24, borderRadius: 16, border: '2px dashed var(--border-dark)', background: 'transparent', cursor: 'pointer' }}>
          <Upload size={32} color="var(--cyan)" />
          <span className="mt-8">Cliquez pour ajouter des preuves</span>
          <span className="body-sm">PNG, JPG (max. 5 fichiers)</span>
        </button>
        {proofs.length > 0 && (
          <div className="row mt-12" style={{ flexWrap: 'wrap', gap: 8 }}>
            {proofs.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={p} alt={`Preuve ${i + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10 }} />
                <button type="button" aria-label="Retirer" onClick={() => setProofs(proofs.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%', border: 0, background: 'var(--error)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="row body-sm mt-16"><Info size={16} />Votre dispute sera traitée sous 24-48h</p>
        <Button block icon={Gavel} style={{ marginTop: 16 }} disabled={!allowed} loading={busy} onClick={submit}>Soumettre la dispute</Button>
      </div>
    </div>
  )
}

// ================= Mes litiges + arbitrage =================
export function DisputesScreen() {
  useDb()
  const user = useUser()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'mine' | 'arbitrage'>(user.isAdmin ? 'arbitrage' : 'mine')
  const all = challengeService.getDisputed()
  const list = tab === 'mine' ? all.filter((c) => c.creatorId === user.id || c.opponentId === user.id) : all.filter((c) => !c.dispute?.resolvedAt)

  return (
    <div className="screen">
      <AppBar title="Mes Disputes" back />
      <div className="screen-body">
        {user.isAdmin && (
          <div className="chips mb-16">
            <button type="button" className={`chip${tab === 'arbitrage' ? ' selected' : ''}`} onClick={() => setTab('arbitrage')}><Scale size={16} />À arbitrer</button>
            <button type="button" className={`chip${tab === 'mine' ? ' selected' : ''}`} onClick={() => setTab('mine')}>Mes disputes</button>
          </div>
        )}
        {list.length === 0 ? (
          <Empty icon={ShieldCheck} title={tab === 'mine' ? 'Aucune dispute en cours' : 'Aucun litige à arbitrer'} text={tab === 'mine' ? 'Toutes vos disputes ont été résolues' : 'Tout est en ordre 👌'} />
        ) : list.map((c) => <DisputeCard key={c.id} c={c} arbitrage={tab === 'arbitrage'} onEvidence={() => navigate(`/disputes/${c.id}/evidence`)} />)}
      </div>
    </div>
  )
}

function DisputeCard({ c, arbitrage, onEvidence }: { c: Challenge; arbitrage: boolean; onEvidence: () => void }) {
  const [deciding, setDeciding] = useState(false)
  const [note, setNote] = useState('')
  const d = c.dispute!
  const resolved = !!d.resolvedAt
  const initiator = userService.getById(d.initiatorId)
  const creator = userService.getById(c.creatorId)
  const opponent = userService.getById(c.opponentId)
  const reports = c.matchDetails?.reports ?? {}

  const { run, busy } = useAction()
  async function decide(winnerId: string | null, label: string) {
    const ok = await run(async () => { await challengeService.resolveDispute(c.id, winnerId, label, note || undefined); return true }, 'Décision enregistrée')
    if (ok) setDeciding(false)
  }

  return (
    <div className="card mb-16" style={{ border: `1px solid ${resolved ? 'var(--success)' : 'var(--orange)'}` }}>
      <div className="row between">
        <span className="pill" style={{ background: resolved ? 'rgba(0,255,135,.15)' : 'rgba(255,107,53,.2)', color: resolved ? 'var(--success)' : 'var(--orange)' }}>{resolved ? 'RÉSOLUE' : 'EN COURS'}</span>
        <span className="bold yellow">{sc(c.amount)} XOF</span>
      </div>
      <p className="title-md mt-12">Match #{c.id.slice(0, 8)}</p>
      <p className="body-sm">{creator?.pseudo} vs {opponent?.pseudo} · {STATUS_META[c.status].short}</p>
      <div className="row mt-12"><Avatar name={initiator?.username ?? '?'} size={32} /><span className="body-md">{initiator?.username ?? 'Utilisateur'}</span></div>
      <p className="mt-8">{d.reason}</p>
      {Object.entries(reports).map(([uid, r]) => (
        <p key={uid} className="body-sm mt-4">📝 {userService.getById(uid)?.pseudo} a déclaré {r.creatorScore} - {r.opponentScore}</p>
      ))}
      {d.proofUrls.length > 0 && <p className="row body-sm mt-8"><FileImage size={16} />{d.proofUrls.length} preuve(s) jointe(s)</p>}
      <p className="body-sm mt-8">{resolved ? `Résolue le ${formatShort(d.resolvedAt!)}` : `Ouverte le ${formatShort(d.timestamp)}`}</p>
      {resolved && d.resolution && <p className="mt-8 green">Décision : {d.resolution}</p>}
      <div className="row mt-12">
        <Button variant="text" icon={Folder} onClick={onEvidence}>Voir les Preuves</Button>
        {arbitrage && !resolved && <Button sm icon={Gavel} onClick={() => setDeciding(true)}>Trancher</Button>}
      </div>

      <Dialog open={deciding} onClose={() => setDeciding(false)}>
        <h3 className="headline-sm">Décision de l'arbitre</h3>
        <p className="body-md mt-8">Qui a gagné ce match ? Les XOF seront versés ou corrigés automatiquement.</p>
        <TextArea label="Note (optionnelle)" value={note} onChange={setNote} rows={2} />
        <Button disabled={busy} block onClick={() => decide(c.creatorId, `Victoire attribuée à ${creator?.pseudo}`)}>🏆 {creator?.pseudo} a gagné</Button>
        <Button disabled={busy} block style={{ marginTop: 8 }} onClick={() => decide(c.opponentId!, `Victoire attribuée à ${opponent?.pseudo}`)}>🏆 {opponent?.pseudo} a gagné</Button>
        <Button disabled={busy} variant="outline" block style={{ marginTop: 8 }} onClick={() => decide(null, 'Match annulé par l\'arbitre')}>Annuler le match et rembourser</Button>
        <Button variant="text" block style={{ marginTop: 8 }} onClick={() => setDeciding(false)}>Fermer</Button>
      </Dialog>
    </div>
  )
}

// ================= Preuves =================
export function DisputeEvidenceScreen() {
  useDb()
  const { id = '' } = useParams()
  const c = challengeService.getById(id)
  const [zoom, setZoom] = useState<string | null>(null)
  if (!c) return <div className="screen"><AppBar title="Preuves du Match" back /><Empty icon={Info} title="Défi introuvable" /></div>
  const shots = c.matchDetails?.screenshotUrls ?? []
  const proofs = (c.dispute?.proofUrls ?? []).filter((p) => !shots.includes(p))
  const Grid = ({ items, label }: { items: string[]; label: string }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {items.map((u, i) => (
        <button key={i} type="button" onClick={() => setZoom(u)} style={{ padding: 0, border: 0, borderRadius: 12, overflow: 'hidden', background: 'var(--card-dark)', cursor: 'zoom-in', textAlign: 'left' }}>
          <img src={u} alt={`${label} ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
          <span className="body-sm" style={{ display: 'block', padding: 8 }}>{label}</span>
        </button>
      ))}
    </div>
  )
  return (
    <div className="screen">
      <AppBar title="Preuves du Match" back />
      <div className="screen-body">
        <div className="card">
          <p className="title-md">Informations du Match</p>
          {[['Match ID', c.id.slice(0, 8)], ['Montant', `${sc(c.amount)} XOF`], ['Statut', c.status.toUpperCase()], ...(c.matchDetails?.matchCode ? [['Code Match', c.matchDetails.matchCode]] : [])].map(([k, v]) => (
            <p key={k} className="row between mt-8"><span className="grey">{k}</span><span className="bold">{v}</span></p>
          ))}
        </div>
        {shots.length > 0 && <><p className="row section-title"><Camera size={20} color="var(--cyan)" />Captures d'Écran ({shots.length})</p><Grid items={shots} label="Capture d'écran" /></>}
        {proofs.length > 0 && <><p className="row section-title"><Folder size={20} color="var(--cyan)" />Preuves Additionnelles ({proofs.length})</p><Grid items={proofs} label="Preuve additionnelle" /></>}
        {shots.length === 0 && proofs.length === 0 && <Empty icon={FileImage} title="Aucune preuve disponible" text="Les captures n'ont pas été enregistrées" />}
      </div>
      {zoom && (
        <div className="overlay" onClick={() => setZoom(null)} style={{ cursor: 'zoom-out' }}>
          <img src={zoom} alt="Preuve agrandie" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}
