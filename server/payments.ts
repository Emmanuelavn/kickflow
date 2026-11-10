import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { AppError, pool, tx } from './db.ts'
import { broadcast } from './realtime.ts'
import type { Transaction, User } from '../src/lib/types.ts'

type PaymentKind = 'deposit' | 'withdraw'
type PaymentState = 'pending' | 'completed' | 'failed'
interface PaymentIntent {
  id: string
  user_id: string
  kind: PaymentKind
  amount: string | number
  status: PaymentState
  provider_token: string | null
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new AppError(`Configuration serveur manquante : ${name}`, 503)
  return value
}

function paymentAmount(value: unknown) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2_000_000_000) {
    throw new AppError('Saisis un montant entier positif en XOF.')
  }
  return amount
}

function signatureFor(id: string) {
  return createHmac('sha256', requiredEnv('JWT_SECRET')).update(`payplus:${id}`).digest('hex')
}

function signatureMatches(id: string, supplied: string) {
  const expected = Buffer.from(signatureFor(id), 'hex')
  const received = Buffer.from(supplied, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

function callbackUrl(id: string) {
  const url = new URL('/api/payments/callback', requiredEnv('APP_URL'))
  url.searchParams.set('id', id)
  url.searchParams.set('signature', signatureFor(id))
  return url.toString()
}

function returnUrl(id: string) {
  const url = new URL('/api/payments/return', requiredEnv('APP_URL'))
  url.searchParams.set('id', id)
  url.searchParams.set('signature', signatureFor(id))
  return url.toString()
}

async function gatewayRequest(path: string, init?: RequestInit) {
  const base = requiredEnv('PAYPLUS_BASE_URL').replace(/\/+$/, '')
  const response = await fetch(`${base}${path}`, {
    ...init,
    signal: AbortSignal.timeout(25_000),
    headers: {
      Authorization: `Bearer ${requiredEnv('PAYPLUS_API_TOKEN')}`,
      Apikey: requiredEnv('PAYPLUS_API_KEY'),
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const data = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !data) throw new AppError('PayPlus est momentanément indisponible.', 502)
  return data
}

function refusalMessage(response: Record<string, unknown>, action: string) {
  const description = typeof response.description === 'string' ? response.description.trim() : ''
  const code = String(response.response_code ?? '').trim()
  return description || `PayPlus a refusé ${action}${code ? ` (code ${code})` : ''}.`
}

async function createIntent(me: User, amount: number, kind: PaymentKind) {
  const id = randomUUID()
  const timestamp = new Date().toISOString()
  const result = await tx(async (t) => {
    const user = await t.get<User>('users', me.id, true)
    if (!user) throw new AppError('Compte introuvable', 404)

    if (kind === 'withdraw') {
      if (user.walletBalance.withdrawable < amount) throw new AppError('Solde retirable insuffisant.')
      await t.put('users', {
        ...user,
        walletBalance: { ...user.walletBalance, withdrawable: user.walletBalance.withdrawable - amount },
        updatedAt: timestamp,
      })
    }

    const transaction: Transaction = {
      id,
      userId: me.id,
      type: kind,
      amount,
      status: 'pending',
      timestamp,
      description: kind === 'deposit' ? `Recharge PayPlus de ${amount} XOF` : `Retrait PayPlus de ${amount} XOF`,
    }
    await t.put('transactions', transaction)
    await t.client.query(
      `insert into payment_intents (id, user_id, kind, amount, currency, status)
       values ($1, $2, $3, $4, 'XOF', 'pending')`,
      [id, me.id, kind, amount],
    )
  })
  broadcast(result.changes)
  return id
}

async function setProviderToken(id: string, token: string) {
  await pool.query(
    `update payment_intents set provider_token = $2, updated_at = now() where id = $1 and status = 'pending'`,
    [id, token],
  )
}

async function settle(id: string, state: Exclude<PaymentState, 'pending'>) {
  const result = await tx(async (t) => {
    const result = await t.client.query<PaymentIntent>(
      'select id, user_id, kind, amount, status, provider_token from payment_intents where id = $1 for update',
      [id],
    )
    const intent = result.rows[0]
    if (!intent || intent.status !== 'pending') return intent?.status ?? 'missing'

    const transaction = await t.get<Transaction>('transactions', id, true)
    if (!transaction) throw new AppError('Transaction introuvable', 404)

    if (intent.kind === 'deposit' && state === 'completed') {
      const user = await t.get<User>('users', intent.user_id, true)
      if (!user) throw new AppError('Compte introuvable', 404)
      await t.put('users', {
        ...user,
        walletBalance: { ...user.walletBalance, available: user.walletBalance.available + Number(intent.amount) },
        updatedAt: new Date().toISOString(),
      })
    }

    if (intent.kind === 'withdraw' && state === 'failed') {
      const user = await t.get<User>('users', intent.user_id, true)
      if (!user) throw new AppError('Compte introuvable', 404)
      await t.put('users', {
        ...user,
        walletBalance: { ...user.walletBalance, withdrawable: user.walletBalance.withdrawable + Number(intent.amount) },
        updatedAt: new Date().toISOString(),
      })
    }

    await t.put('transactions', {
      ...transaction,
      status: state,
      timestamp: new Date().toISOString(),
    })
    await t.client.query(
      'update payment_intents set status = $2, updated_at = now() where id = $1',
      [id, state],
    )
    return state
  })
  broadcast(result.changes)
  return result.result
}

export async function startDeposit(me: User, rawAmount: unknown) {
  const amount = paymentAmount(rawAmount)
  const id = await createIntent(me, amount, 'deposit')
  const callback = callbackUrl(id)
  const response = await gatewayRequest('/pay/v01/redirect/checkout-invoice/create', {
      method: 'POST',
      body: JSON.stringify({
        commande: {
          invoice: {
            items: [{ name: 'Recharge KickFlow', description: 'Recharge du portefeuille en XOF', quantity: 1, unit_price: amount, total_price: amount }],
            total_amount: amount,
            devise: 'XOF',
            description: `Recharge KickFlow ${id}`,
            customer: me.phone ?? '',
            customer_firstname: me.username ?? '',
            customer_lastname: '',
            customer_email: me.email ?? '',
            external_id: id,
            otp: '',
          },
          actions: {
            cancel_url: returnUrl(id),
            return_url: returnUrl(id),
            callback_url: callback,
            callback_url_method: 'post_json',
          },
          custom_data: { transaction_id: id },
        },
      }),
  })
  if (String(response.response_code) !== '00') {
    await settle(id, 'failed')
    throw new AppError(refusalMessage(response, 'le paiement'), 502)
  }
  const checkoutUrl = typeof response.response_text === 'string' ? new URL(response.response_text) : null
  if (!response.token || !checkoutUrl || checkoutUrl.protocol !== 'https:') {
    // La réponse est ambiguë : conserver l'intention en attente pour éviter de créditer ou d'annuler à tort.
    throw new AppError('PayPlus n’a pas renvoyé de lien de paiement valide. Contacte le support avant de réessayer.', 502)
  }
  await setProviderToken(id, String(response.token))
  return { id, checkoutUrl: checkoutUrl.toString() }
}

export async function startWithdrawal(me: User, rawAmount: unknown) {
  const amount = paymentAmount(rawAmount)
  const phone = String(me.phone ?? '').replace(/[^\d]/g, '')
  if (phone.length < 8 || phone.length > 15) throw new AppError('Ajoute un numéro Mobile Money valide à ton profil.')
  const id = await createIntent(me, amount, 'withdraw')
  const callback = callbackUrl(id)
  const response = await gatewayRequest('/pay/v01/straight/payout', {
    method: 'POST',
    body: JSON.stringify({
      commande: {
        amount,
        customer: phone,
        custom_data: { transaction_id: id },
        callback_url: callback,
        callback_url_method: 'post_json',
        external_id: id,
        network: '',
      },
    }),
  })
  if (String(response.response_code) !== '00') {
    await settle(id, 'failed')
    throw new AppError(refusalMessage(response, 'le retrait'), 502)
  }
  if (!response.token) {
    // PayPlus a pu accepter l'ordre : garder les fonds réservés en attendant une vérification.
    throw new AppError('PayPlus n’a pas renvoyé le jeton du retrait. Le statut reste en attente de vérification.', 502)
  }
  await setProviderToken(id, String(response.token))
  const status = await confirmPayment(id, signatureFor(id))
  return { id, status }
}

export async function confirmPayment(id: string, signature: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !signatureMatches(id, signature)) throw new AppError('Transaction invalide', 400)
  const result = await pool.query<PaymentIntent>(
    'select id, user_id, kind, amount, status, provider_token from payment_intents where id = $1',
    [id],
  )
  const intent = result.rows[0]
  if (!intent) throw new AppError('Transaction introuvable', 404)
  if (intent.status !== 'pending') return intent.status
  if (!intent.provider_token) return 'pending'

  const token = encodeURIComponent(intent.provider_token)
  const path = intent.kind === 'withdraw'
    ? `/pay/v01/withdrawal/confirm/?withdrawalToken=${token}`
    : `/pay/v01/redirect/checkout-invoice/confirm?invoiceToken=${token}`
  const response = await gatewayRequest(path)
  const state = String(response.description ?? '').toLowerCase()
  if (state === 'completed') {
    await settle(id, 'completed')
    return 'completed'
  }
  if (state === 'notcompleted') {
    await settle(id, 'failed')
    return 'failed'
  }
  return 'pending'
}

export function verifyPaymentCallback(id: string, signature: string) {
  return Boolean(id && signature && signatureMatches(id, signature))
}
