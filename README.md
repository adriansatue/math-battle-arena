This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Re-engagement email

Optional return-to-play email is delivered through Resend. Existing and new users are opted out until they enable reminders in Profile.

Required production variables:

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Math Battle Arena <play@updates.your-domain.example>
RESEND_REPLY_TO=support@your-domain.example
RESEND_WEBHOOK_SECRET=whsec_...
RESEND_NEWSLETTER_SEGMENT_ID=00000000-0000-0000-0000-000000000000
REENGAGEMENT_EMAIL_ENABLED=false
REENGAGEMENT_BATCH_SIZE=10
CRON_SECRET=...
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

Before setting `REENGAGEMENT_EMAIL_ENABLED=true`:

1. Apply the email preference migration.
2. Verify the sending subdomain in Resend and configure SPF, DKIM, and DMARC.
3. Keep the first batch small and inspect delivery, bounce, and complaint rates.
4. Confirm the sender address uses the verified domain.
5. Configure a signed Resend webhook at `/api/webhooks/resend` for `email.bounced`,
   `email.complained`, `email.suppressed`, `contact.updated`, and `suppression.added`.

Newsletter subscribers are managed separately from re-engagement reminders. Create a
Resend Segment for the newsletter, set `RESEND_NEWSLETTER_SEGMENT_ID`, and compose
Broadcasts for that segment in Resend. Existing accounts remain opted out by default.
Registered players who have not decided see a non-blocking consent prompt in Lobby;
acceptance, decline, source, consent-copy version, and first prompt time are recorded.
Always create a Broadcast as a draft, review its recipients and unsubscribe footer, send
a test email, and only then schedule or send it from the Resend dashboard.

To upload the August 2026 HTML newsletter as a draft without sending it:

```bash
npm run newsletter:draft
```

The command has no send operation. Open the resulting draft in the Resend Broadcasts
dashboard, send a test email, review the selected Segment, and confirm the final send there.

The daily cron targets only confirmed, registered users who explicitly opted in, have been inactive for at least seven days, and have not received a successful reminder in the previous 30 days. With sending disabled, it returns only an aggregate dry-run count.
