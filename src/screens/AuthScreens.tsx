// Transposé de splash_screen, onboarding_screen, login_screen, register_screen (.dart)
// Connexion par email + mot de passe uniquement pour le pilote.
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, Gift, Globe, Lock, Mail, Phone, User as UserIcon, Gamepad2, Wallet, Video } from 'lucide-react'
import { AppBar, Button, Dialog, SelectField, TextField, useSnack } from '../components/ui'
import { SoccerBall } from '../components/icons'
import { authService } from '../services/auth'
import { COUNTRIES } from '../lib/countries'

// ---------------- Splash ----------------
export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="screen center-col" style={{ background: 'linear-gradient(135deg, var(--cyan), var(--cyan))', color: '#fff' }}>
      <SoccerBall size={120} className="anim-scale" />
      <h1 className="display-lg mt-24 anim-fade" style={{ animationDelay: '.3s' }}>KickFlow</h1>
      <p className="title-lg mt-8 anim-fade" style={{ color: 'rgba(255,255,255,.7)', animationDelay: '.5s' }}>L'arène des défis foot</p>
      <span className="spinner lg mt-48 anim-fade" style={{ animationDelay: '.7s' }} />
    </div>
  )
}

// ---------------- Onboarding ----------------
const PAGES = [
  { icon: Gamepad2, title: 'Défiez les Meilleurs', description: 'Créez des défis eFootball et affrontez des joueurs du monde entier', color: 'var(--cyan)' },
  { icon: Wallet, title: 'Grimpez au Classement', description: 'Gagnez des SkillCoins et des points de niveau à chaque victoire', color: 'var(--yellow)' },
  { icon: Video, title: 'Partagez vos Lives', description: 'Diffusez vos matchs sur TikTok ou YouTube et faites-les voir à la communauté', color: 'var(--cyan)' },
]

export function OnboardingScreen() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const p = PAGES[page]
  const last = page === PAGES.length - 1
  const Icon = p.icon
  return (
    <div className="screen">
      <div className="screen-body center-col" style={{ padding: 32 }} key={page}>
        <div className="anim-scale" style={{ padding: 40, borderRadius: '50%', background: `color-mix(in srgb, ${p.color} 10%, transparent)` }}>
          <Icon size={100} color={p.color} />
        </div>
        <h2 className="display-sm mt-48 anim-fade" style={{ animationDelay: '.3s' }}>{p.title}</h2>
        <p className="body-lg grey mt-16 anim-fade" style={{ animationDelay: '.5s' }}>{p.description}</p>
      </div>
      <div style={{ padding: 32 }}>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          {PAGES.map((_, i) => (
            <span key={i} style={{ width: i === page ? 32 : 8, height: 8, borderRadius: 4, transition: 'all .3s', background: i === page ? 'var(--cyan)' : 'var(--border-dark)' }} />
          ))}
        </div>
        <Button block style={{ marginTop: 32 }} onClick={() => (last ? navigate('/login', { replace: true }) : setPage(page + 1))}>
          {last ? 'Commencer' : 'Suivant'}
        </Button>
        {!last && (
          <div className="center-col mt-16">
            <Button variant="text" onClick={() => navigate('/login', { replace: true })}>Passer</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Login ----------------
export function LoginScreen() {
  const navigate = useNavigate()
  const snack = useSnack()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!email) errs.email = 'Email requis'
    else if (!email.includes('@')) errs.email = 'Email invalide'
    if (!password) errs.password = 'Mot de passe requis'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await authService.login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      snack((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <form className="screen-body pad-lg" onSubmit={submit} noValidate>
        <div className="center-col mt-48"><SoccerBall size={80} color="var(--cyan)" className="anim-scale" /></div>
        <h1 className="display-sm mt-24 anim-fade" style={{ animationDelay: '.2s' }}>Bienvenue !</h1>
        <p className="body-lg grey mt-8 anim-fade" style={{ animationDelay: '.3s' }}>Connectez-vous pour continuer</p>
        <div className="mt-48 anim-fade" style={{ animationDelay: '.4s' }}>
          <TextField label="Email" icon={Mail} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <TextField label="Mot de passe" icon={Lock} password autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: -8 }}>
          <Button variant="text" onClick={() => setForgot(true)}>Mot de passe oublié ?</Button>
        </div>
        <Button type="submit" block loading={loading} style={{ marginTop: 8 }}>Se connecter</Button>
        <div className="row mt-32" style={{ justifyContent: 'center', gap: 0 }}>
          <span className="body-md">Pas encore de compte ? </span>
          <Button variant="text" onClick={() => navigate('/register')}>S'inscrire</Button>
        </div>
      </form>
      <Dialog open={forgot} onClose={() => setForgot(false)}>
        <h3 className="headline-sm">Mot de passe oublié</h3>
        <p className="body-md mt-12">Contactez l'administrateur de KickFlow avec l'email de votre compte : il vous donnera un nouveau mot de passe. La réinitialisation par email arrivera bientôt.</p>
        <div className="dialog-actions"><Button sm onClick={() => setForgot(false)}>Compris</Button></div>
      </Dialog>
    </div>
  )
}

// ---------------- Register ----------------
export function RegisterScreen() {
  const navigate = useNavigate()
  const snack = useSnack()
  const [params] = useSearchParams()
  const [f, setF] = useState({ username: '', pseudo: '', email: '', phone: '', password: '', referral: params.get('ref') ?? '', country: 'Bénin', birthDate: '2000-01-01' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.username.trim()) errs.username = 'Nom requis'
    if (!f.pseudo.trim()) errs.pseudo = 'Pseudo requis'
    if (!f.email) errs.email = 'Email requis'
    else if (!f.email.includes('@')) errs.email = 'Email invalide'
    if (!f.phone.trim()) errs.phone = 'Téléphone requis'
    if (!f.password) errs.password = 'Mot de passe requis'
    else if (f.password.length < 6) errs.password = 'Minimum 6 caractères'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await authService.register({
        username: f.username.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password,
        country: f.country, birthDate: f.birthDate, pseudo: f.pseudo.trim(), referralCode: f.referral.trim() || null,
      })
      navigate('/', { replace: true })
    } catch (err) {
      snack((err as Error).message || "Erreur lors de l'inscription", 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <AppBar back />
      <form className="screen-body pad-lg" onSubmit={submit} noValidate>
        <h1 className="display-sm anim-fade">Créer un compte</h1>
        <p className="body-lg grey mt-8 anim-fade" style={{ animationDelay: '.1s' }}>Rejoignez la communauté KickFlow</p>
        <div className="mt-32" />
        <TextField label="Nom d'utilisateur" icon={UserIcon} value={f.username} onChange={set('username')} error={errors.username} autoComplete="username" />
        <TextField label="Pseudonyme eFootball" icon={Gamepad2} value={f.pseudo} onChange={set('pseudo')} error={errors.pseudo} />
        <TextField label="Email" icon={Mail} type="email" inputMode="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <TextField label="Téléphone" icon={Phone} type="tel" inputMode="tel" placeholder="+229 01 23 45 67 89" value={f.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
        <SelectField label="Pays" icon={Globe} value={f.country} options={COUNTRIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setF({ ...f, country: v })} />
        <TextField label="Date de naissance" icon={Calendar} type="date" min="1950-01-01" max={new Date().toISOString().slice(0, 10)} value={f.birthDate} onChange={set('birthDate')} help="Vous devez avoir au moins 18 ans" />
        <TextField label="Mot de passe" icon={Lock} password autoComplete="new-password" value={f.password} onChange={set('password')} error={errors.password} />
        <TextField label="Code de parrainage (optionnel)" icon={Gift} placeholder="Entrez le code si vous en avez un" value={f.referral} onChange={set('referral')} />
        <Button type="submit" block loading={loading} style={{ marginTop: 16 }}>S'inscrire</Button>
        <div className="row mt-16" style={{ justifyContent: 'center', gap: 0 }}>
          <span className="body-md">Déjà inscrit ? </span>
          <Button variant="text" onClick={() => navigate('/login', { replace: true })}>Se connecter</Button>
        </div>
      </form>
    </div>
  )
}
