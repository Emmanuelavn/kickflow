// Portefeuille (SkillCoins fictifs) — les soldes ne sont modifiés que par le serveur.
import { db } from '../lib/db'
import { rpc } from '../lib/api'
import type { Transaction } from '../lib/types'

export const walletService = {
  getTransactions(userId: string): Transaction[] {
    return db.list('transactions').filter((t) => t.userId === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  },
  deposit: (amount: number) => rpc('wallet.deposit', { amount }),
  withdraw: (amount: number) => rpc('wallet.withdraw', { amount }),
}
