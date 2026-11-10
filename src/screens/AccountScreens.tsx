// Transposé de history_screen, wallet_screen, notifications_screen, profile_screen, settings_screen, announcements_screen (.dart)
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PushSetting } from '../components/PushCard'
import { Bell, ChevronRight, CircleHelp, Coins, Globe, KeyRound, Lock, LogOut, Mail, Moon, Receipt, Shield, Trash2, User as UserIcon, Scale, type LucideIcon } from 'lucide-react'
import { AppBar, BottomSheet, Button, Dialog, TextField, useAction, useSnack } from '../components/ui'
import { authService, useUser } from '../services/auth'
import { kv, useDb } from '../lib/db'


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
    language: useSetting('language', 'Français'), currency: useSetting('currency', 'XOF'),
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
          <PushSetting />
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
        {(sheet === 'language' ? ['Français', 'English', 'العربية'] : ['XOF']).map((o) => {
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
