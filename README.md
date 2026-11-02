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

## Administrator invitations

Keep the browser Supabase client on its default PKCE flow. Administrator
invitations must use the link format in `supabase/templates/invite.html`.
Supabase's default mailer cannot customize invitation templates. Use the
supported `auth.admin.generateLink({ type: "invite", email, options: { data } })`
API and the existing verified email provider to deliver the invitation, without
changing global SMTP, signup, or recovery settings.

The invitation link sends Supabase's single-use token hash to `/auth/invite`.
This server-only endpoint verifies `type=invite`, establishes the normal SSR
session cookies, and redirects to `/change-password?first=1`. It does not accept
implicit access-token fragments or arbitrary redirect destinations.

Include `data: { first_name, last_name, must_change_password: true }`. Render
`.SiteURL` as the trusted application's HTTPS origin and `.TokenHash` as the
returned `properties.hashed_token`; never send the default `action_link`, which
uses an implicit callback. Never log invitation tokens. Do not supply a
password: the invitee creates their own password after accepting the email.
Check the email provider's send result separately from link generation; a send
success does not prove inbox delivery.

Run invitation tests with `npx tsx --test lib/auth/invitation-flow.test.ts`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
