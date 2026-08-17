import { readFile } from 'node:fs/promises'
import { Resend } from 'resend'

const requiredVariables = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_NEWSLETTER_SEGMENT_ID',
]
const missingVariables = requiredVariables.filter(name => !process.env[name])

if (missingVariables.length > 0) {
  console.error(`Missing required variables: ${missingVariables.join(', ')}`)
  process.exitCode = 1
} else {
  const html = await readFile(
    new URL('../emails/newsletter-2026-08-product-update.html', import.meta.url),
    'utf8',
  )
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.broadcasts.create({
    segmentId: process.env.RESEND_NEWSLETTER_SEGMENT_ID,
    from: process.env.RESEND_FROM_EMAIL,
    replyTo: process.env.RESEND_REPLY_TO,
    name: 'Math Battle Arena - August 2026 product update',
    subject: 'Six new ways to play Math Battle Arena',
    previewText: 'Daily objectives, weekly divisions, sharper results, focused practice, and collection goals are live.',
    html,
    send: false,
  })

  if (error) {
    console.error(`Could not create Broadcast draft: ${error.message}`)
    process.exitCode = 1
  } else {
    console.log(`Broadcast draft created: ${data.id}`)
    console.log('Review and send it from https://resend.com/broadcasts')
  }
}
