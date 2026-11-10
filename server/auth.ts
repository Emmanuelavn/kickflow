// Comptes : inscription / connexion par email + mot de passe (mots de passe hachés avec bcrypt), jetons JWT.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AppError, pool, tx, type Tx } from './db.ts'
import { notify, str } from './logic.ts'
import { sendMail } from './mail.ts'
import type { Referral, User } from '../src/lib/types.ts'

const JWT_SECRET = process.env.JWT_SECRET ?? ''
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET absent ou trop court (32 caractères minimum). Définissez-le dans les variables d\'environnement.')
}
const secret = () => JWT_SECRET || 'dev-only-secret-change-me-dev-only-secret'

// Tolérant aux erreurs de saisie : guillemets, espaces, « ; » comme séparateur, variable ADMIN_EMAIL au singulier
const ADMIN_EMAILS = `${process.env.ADMIN_EMAILS ?? ''},${process.env.ADMIN_EMAIL ?? ''}`
  .split(/[,;\s]+/).map((e) => e.replace(/["'<>]/g, '').trim().toLowerCase()).filter((e) => e.includes('@'))
  // Domaines réservés aux tests : n'importe qui pourrait créer ces adresses, elles ne donnent jamais le rôle d'arbitre
  .filter((e) => !/\.(test|example|invalid|localhost)$/.test(e))
console.log(`Arbitres configurés : ${ADMIN_EMAILS.length}`)
const SIGNUP_BONUS = Number(process.env.SIGNUP_BONUS ?? 100)
const DUMMY_HASH = bcrypt.hashSync('compte-inexistant', 10)

export const signToken = (userId: string) => jwt.sign({ sub: userId }, secret(), { expiresIn: '30d' })

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null
  try {
    const p = jwt.verify(token, secret()) as { sub?: string }
    return p.sub ?? null
  } catch {
    return null
  }
}

function referralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)

export async function register(a: Record<string, unknown>) {
  const email = str(a.email, 'Email', 120).toLowerCase()
  if (!emailOk(email)) throw new AppError('Email invalide')
  const password = typeof a.password === 'string' ? a.password : ''
  if (password.length < 6) throw new AppError('Mot de passe : minimum 6 caractères')
  if (password.length > 200) throw new AppError('Mot de passe trop long')
  const username = str(a.username, "Nom d'utilisateur", 30)
  const pseudo = str(a.pseudo, 'Pseudonyme eFootball', 30)
  const phone = str(a.phone, 'Téléphone', 30)
  const country = str(a.country, 'Pays', 60)
  const birth = new Date(String(a.birthDate))
  if (Number.isNaN(birth.getTime())) throw new AppError('Date de naissance invalide')
  const ageYears = (Date.now() - birth.getTime()) / (365.25 * 86400000)
  if (ageYears < 18) throw new AppError('Vous devez avoir au moins 18 ans pour vous inscrire')
  const refCode = typeof a.referralCode === 'string' && a.referralCode.trim() ? a.referralCode.trim().toUpperCase() : null

  const hash = await bcrypt.hash(password, 10)
  return tx(async (t) => {
    const exists = await t.client.query('select 1 from accounts where email = $1', [email])
    if (exists.rowCount) throw new AppError('Un compte existe déjà avec cet email')
    let referrer: User | undefined
    if (refCode) {
      referrer = await t.findBy<User>('users', 'referralCode', refCode)
      if (!referrer) throw new AppError('Code de parrainage inconnu')
    }
    let code = referralCode()
    while (await t.findBy<User>('users', 'referralCode', code)) code = referralCode()
    const id = randomUUID()
    const ts = new Date().toISOString()
    const u: User = {
      id, username, email, phone, country, birthDate: birth.toISOString(), pseudo, profilePhoto: null,
      referralCode: code, referredBy: referrer ? refCode : null,
      stats: { wins: 0, losses: 0, totalEarned: 0, totalLost: 0, level: 1, xp: 0 },
      walletBalance: { available: SIGNUP_BONUS, pending: 0, withdrawable: 0 },
      friendIds: [], badges: [], createdAt: ts, updatedAt: ts, isAdmin: ADMIN_EMAILS.includes(email),
      efootballId: typeof a.efootballId === 'string' ? a.efootballId.trim().slice(0, 40) : '',
    }
    await t.client.query('insert into accounts (user_id, email, password_hash) values ($1, $2, $3)', [id, email, hash])
    await t.put('users', u)
    if (referrer) {
      const r: Referral = { id: randomUUID(), referrerId: referrer.id, referredUserId: id, commission: 0, createdAt: ts, tier: 'bronze', lifetimeEarnings: 0 }
      await t.put('referrals', r)
      await notify(t, { userId: referrer.id, type: 'referral', title: '🎁 Nouveau filleul', message: `${pseudo} s'est inscrit avec votre code !`, relatedId: id })
    }
    await notify(t, { userId: id, type: 'progression', title: '🎮 Bienvenue sur KickFlow !', message: `Vous recevez ${SIGNUP_BONUS} SkillCoins pour vos premiers défis.` })
    return { token: signToken(id), user: u }
  })
}

export async function login(a: Record<string, unknown>) {
  const email = typeof a.email === 'string' ? a.email.trim().toLowerCase() : ''
  const password = typeof a.password === 'string' ? a.password : ''
  const r = await pool.query('select user_id, password_hash from accounts where email = $1', [email])
  const row = r.rows[0]
  // Comparaison même si le compte n'existe pas, pour ne pas révéler quels emails sont inscrits
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH)
  if (!row || !ok) throw new AppError('Email ou mot de passe incorrect', 401)
  // Met à jour le rôle arbitre selon ADMIN_EMAILS
  const { result: user } = await tx(async (t) => {
    const u = await t.get<User>('users', row.user_id, true)
    if (!u) throw new AppError('Compte introuvable', 401)
    const isAdmin = ADMIN_EMAILS.includes(email)
    return u.isAdmin === isAdmin ? u : t.put('users', { ...u, isAdmin })
  })
  return { token: signToken(row.user_id), user }
}

export async function changePassword(t: Tx, me: User, a: Record<string, unknown>) {
  const oldPw = typeof a.old === 'string' ? a.old : ''
  const next = typeof a.next === 'string' ? a.next : ''
  if (next.length < 6) throw new AppError('Le nouveau mot de passe doit contenir au moins 6 caractères')
  const r = await t.client.query('select password_hash from accounts where user_id = $1', [me.id])
  if (!r.rows[0] || !(await bcrypt.compare(oldPw, r.rows[0].password_hash))) throw new AppError('Ancien mot de passe incorrect')
  await t.client.query('update accounts set password_hash = $2 where user_id = $1', [me.id, await bcrypt.hash(next, 10)])
}

/** Suppression : on efface les identifiants et on anonymise le profil (l'historique des matchs reste cohérent). */
export async function deleteAccount(t: Tx, me: User) {
  await t.client.query('delete from accounts where user_id = $1', [me.id])
  const u = await t.get<User>('users', me.id, true)
  if (u) {
    await t.put('users', {
      ...u, username: 'compte_supprime', pseudo: 'Compte supprimé', email: '', phone: '', profilePhoto: null,
      friendIds: [], isAdmin: false, updatedAt: new Date().toISOString(),
    })
  }
}

/** Réinitialisation par un administrateur (en attendant l'envoi d'emails). */
export async function adminResetPassword(email: string, newPassword: string) {
  const r = await pool.query('update accounts set password_hash = $2 where email = $1', [email.toLowerCase(), await bcrypt.hash(newPassword, 10)])
  return r.rowCount === 1
}

// ---------- Mot de passe oublié ----------
const APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '')
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

/** Envoie un lien de réinitialisation (valable 1 h). Répond pareil que l'email existe ou non. */
export async function forgotPassword(a: Record<string, unknown>, origin: string) {
  const email = typeof a.email === 'string' ? a.email.trim().toLowerCase() : ''
  if (!emailOk(email)) throw new AppError('Email invalide')
  const r = await pool.query('select user_id from accounts where email = $1', [email])
  if (!r.rows[0]) return
  const userId = r.rows[0].user_id as string
  // Limite : 3 demandes par heure et par compte
  const recent = await pool.query(`select count(*)::int as n from password_resets where user_id = $1 and expires_at > now()`, [userId])
  if (recent.rows[0].n >= 3) return
  const token = randomBytes(32).toString('base64url')
  await pool.query(`insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')`, [hashToken(token), userId])
  const link = `${APP_URL || origin}/reset?token=${token}`
  await sendMail(email, 'Réinitialise ton mot de passe KickFlow',
    "Tu as demandé à changer ton mot de passe KickFlow.\nCe lien est valable 1 heure. Si ce n'est pas toi, ignore simplement cet email.",
    { label: 'Choisir un nouveau mot de passe', url: link }).catch((e) => console.error('email de réinitialisation', e.message))
}

export async function resetPassword(a: Record<string, unknown>) {
  const token = typeof a.token === 'string' ? a.token : ''
  const password = typeof a.password === 'string' ? a.password : ''
  if (password.length < 6) throw new AppError('Mot de passe : minimum 6 caractères')
  if (password.length > 200) throw new AppError('Mot de passe trop long')
  const hash = await bcrypt.hash(password, 10)
  return tx(async (t) => {
    const r = await t.client.query('select user_id from password_resets where token_hash = $1 and not used and expires_at > now() for update', [hashToken(token)])
    if (!r.rows[0]) throw new AppError('Lien invalide ou expiré. Refais une demande.')
    const userId = r.rows[0].user_id as string
    await t.client.query('update password_resets set used = true where user_id = $1', [userId])
    await t.client.query('update accounts set password_hash = $2 where user_id = $1', [userId, hash])
    const u = await t.get<User>('users', userId)
    if (!u) throw new AppError('Compte introuvable')
    return { token: signToken(userId), user: u }
  })
}
