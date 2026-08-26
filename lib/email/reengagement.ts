import { Resend } from 'resend'

export type ReengagementCandidate = {
  user_id: string
  email: string
  username: string
  unsubscribe_token: string
  last_activity_at: string
  inactive_days: number
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

export function buildReengagementEmail(candidate: ReengagementCandidate, appUrl: string, campaignKey: string) {
  const baseUrl = appUrl.replace(/\/$/, '')
  const clickUrl = `${baseUrl}/api/email/re-engagement/click?token=${encodeURIComponent(candidate.unsubscribe_token)}&campaign=${encodeURIComponent(campaignKey)}`
  const unsubscribeUrl = `${baseUrl}/email/unsubscribe?token=${encodeURIComponent(candidate.unsubscribe_token)}`
  const oneClickUnsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(candidate.unsubscribe_token)}`
  const username = escapeHtml(candidate.username)

  return {
    subject: `${candidate.username}, your next maths challenge is ready`,
    text: `Hi ${candidate.username},\n\nYour daily objectives and weekly competition are ready. Return to Math Battle Arena: ${clickUrl}\n\nYou are receiving this because you enabled occasional game reminders. Unsubscribe: ${unsubscribeUrl}`,
    html: `<!doctype html><html><body style="margin:0;background:#130b24;color:#ffffff;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 24px"><p style="color:#f7c948;font-size:12px;font-weight:700;text-transform:uppercase">Math Battle Arena</p><h1 style="font-size:28px;line-height:1.2">Your next challenge is ready, ${username}</h1><p style="color:#d8cfea;line-height:1.6">Build today’s streak, complete three focused objectives, and see where you stand in your weekly division.</p><a href="${clickUrl}" style="display:inline-block;margin:18px 0;background:#f7c948;color:#171020;padding:13px 20px;text-decoration:none;font-weight:800">Return to the arena</a><p style="color:#9a8cae;font-size:12px;line-height:1.5">You enabled occasional game reminders in your profile. <a href="${unsubscribeUrl}" style="color:#c7b7dc">Unsubscribe</a> at any time.</p></div></body></html>`,
    unsubscribeUrl,
    oneClickUnsubscribeUrl,
  }
}

export async function sendReengagementEmail(candidate: ReengagementCandidate, campaignKey: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!apiKey || !from || !appUrl) return { data: null, error: { name: 'configuration_error', message: 'Email provider is not configured' } }

  const content = buildReengagementEmail(candidate, appUrl, campaignKey)
  const resend = new Resend(apiKey)
  return resend.emails.send({
    from,
    to: candidate.email,
    replyTo: process.env.RESEND_REPLY_TO ?? 'support@mathbattle.es',
    subject: content.subject,
    html: content.html,
    text: content.text,
    headers: {
      'List-Unsubscribe': `<${content.oneClickUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'campaign', value: campaignKey.replace(/[^a-zA-Z0-9_-]/g, '_') }],
  }, {
    idempotencyKey: `${campaignKey}/${candidate.user_id}`,
  })
}
