// Transposé de widgets/challenge_chat_widget.dart
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { challengeService } from '../services/challenges'
import { useSnack } from './ui'
import { userService } from '../services/users'
import type { Challenge } from '../lib/types'

export function ChallengeChat({ c, userId, title = 'Chat pré-match' }: { c: Challenge; userId: string; title?: string }) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [c.chatMessages.length])

  const snack = useSnack()
  async function send() {
    const msg = text.trim()
    if (!msg) return
    setText('')
    try {
      await challengeService.sendMessage(c.id, msg)
    } catch (e) {
      setText(msg)
      snack((e as Error).message, 'error')
    }
  }

  return (
    <div className="card mt-16">
      <p className="row title-md"><MessageCircle color="#FBBF24" />{title}</p>
      <div ref={listRef} style={{ maxHeight: 240, overflowY: 'auto', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {c.chatMessages.length === 0 && <p className="body-sm" style={{ textAlign: 'center', padding: 16 }}>Aucun message. Dites bonjour à votre adversaire 👋</p>}
        {c.chatMessages.map((m, i) => {
          const mine = m.senderId === userId
          return (
            <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {!mine && <p className="label-sm">{userService.getById(m.senderId)?.pseudo}</p>}
              <p style={{
                padding: '8px 12px', borderRadius: 14, fontSize: 14,
                background: mine ? 'var(--cyan)' : 'var(--border-dark)', color: mine ? 'var(--dark-navy)' : '#fff',
              }}>{m.message}</p>
            </div>
          )
        })}
      </div>
      <form className="row mt-12" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message..." aria-label="Message"
          style={{ flex: 1, height: 44, padding: '0 14px', borderRadius: 22, border: '1px solid var(--border-dark)', background: 'var(--deep-blue)', outline: 0 }} />
        <button type="submit" className="icon-btn" aria-label="Envoyer" style={{ background: 'var(--cyan)', color: 'var(--dark-navy)' }}><Send size={20} /></button>
      </form>
    </div>
  )
}
