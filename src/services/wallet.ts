// Portefeuille XOF : les dépôts et retraits sont confirmés par PayPlus côté serveur.
import { db } from '../lib/db'
import { http } from '../lib/api'
import type { Transaction } from '../lib/types'

export const walletService = {
  getTransactions(userId: string): Transaction[] {
    return db.list('transactions').filter((t) => t.userId === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  },
  deposit: (amount: number) => http<{ id: string; checkoutUrl: string }>('/api/payments/deposit', { amount }),
  withdraw: (amount: number) => http<{ id: string; status: 'pending' }>('/api/payments/withdraw', { amount }),
}
