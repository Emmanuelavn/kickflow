// Envoi d'emails par SMTP (Brevo, Resend, Gmail, hébergeur…).
// Variables : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (ex. « KickFlow <noreply@kickflow.bj> »).
import nodemailer from 'nodemailer'

const host = process.env.SMTP_HOST ?? ''
export const mailEnabled = !!(host && process.env.SMTP_USER && process.env.SMTP_PASS)
const from = process.env.MAIL_FROM || `KickFlow <${process.env.SMTP_USER ?? 'noreply@kickflow.app'}>`

const transport = mailEnabled
  ? nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null

if (!mailEnabled) console.warn('⚠️  Emails désactivés : SMTP_HOST / SMTP_USER / SMTP_PASS manquants (les liens sont écrits dans les logs).')

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export async function sendMail(to: string, subject: string, text: string, button?: { label: string; url: string }) {
  if (!transport) {
    console.log(`[email non envoyé, SMTP non configuré] à ${to} — ${subject} — ${button?.url ?? ''}`)
    return
  }
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#0A1628;font-family:Arial,sans-serif;color:#F3F6FA">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;font-weight:bold;color:#00E5FF;margin:0 0 24px">KickFlow</p>
${text.split('\n').map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${esc(l)}</p>`).join('')}
${button ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#00E5FF;color:#04202A;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">${esc(button.label)}</a></p>
<p style="font-size:12px;color:#9AA7B8">Si le bouton ne marche pas, copie ce lien : ${esc(button.url)}</p>` : ''}
</div></body></html>`
  await transport.sendMail({ from, to, subject, text: button ? `${text}\n\n${button.label} : ${button.url}` : text, html })
}
