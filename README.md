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

### EMS continuing education: Phase 1

`lib/ems/requirements.ts` defines the shared Iowa/National Registry requirement
tables used by Personnel and My Readiness. CCP (`ccp`) has Iowa requirements of
Airway 6, Cardiology 7, Trauma 5, Medical 8, Operations 4, Pediatric 4, and Critical
Care Paramedic 12 (46 total). National Registry Paramedic uses only the first five
categories (30 total); Pediatric and Critical Care Paramedic credit cannot
contribute to that track, including through manual allocations.

Pediatric is selectable in EMS training entry on desktop and mobile, and appears
in every Iowa level's CE progress. Existing Iowa levels retain all current
category minimums and totals; Pediatric has no additional required hours for
those levels in Phase 1. Critical Care Paramedic CE credit applies only to Iowa
CCP. National Registry Paramedic requires 30 hours total, with zero Local/State
and Individual hours; all five category minimums must be met. Other National
Registry levels are unchanged. CCP is an Iowa-only level, not a National Registry option.

Personnel certification creation/editing, new-member onboarding, and Settings
catalog creation/editing expose **Authority** and **Certification Level**.
Choose Iowa EMS → Critical Care Paramedic to save
`certifications.ems_authority = 'iowa'` and
`certifications.ems_certification_level = 'ccp'`. Member credentials reference
that catalog entry through `member_certifications.certification_id`; no new
authority, add-on credential class, or third CE track is introduced. National
Registry Paramedic is independently selectable as authority `nremt`, level
`paramedic`, alongside Iowa CCP for the same member.

Changing one member's level reuses or creates the matching catalog entry and
changes only that member credential's reference. It does not reclassify the
shared Paramedic catalog entry. Editing a catalog entry in Settings intentionally
applies its classification to all assigned members. Conflicting same-name
entries with missing/different metadata must be corrected explicitly in Settings.

Existing authoritative-credential precedence is unchanged: the most recently
issued classified credential per authority supplies the effective level,
number, and expiration to Personnel and My Readiness. Edit the existing member
credential when correcting its level; track-only selections cannot contradict
an assigned authoritative credential. New-member onboarding initializes its
existing authority track's level from the assigned credential.

The local migration `20261102173000_add_ems_ccp_and_pediatric_phase1.sql` expands
the existing level/topic checks and seeds Iowa CCP requirements, optional Iowa
Pediatric topics, and the published `2026-paramedic-30` National Registry Paramedic
requirement version. Historical `2026-initial` rows remain unchanged; the allocator
selects the current published version by effective date. The new Paramedic version
has five national topics totaling 30 and explicit zero-hour Local/State and
Individual components. No NREMT CCP requirement is seeded, and database checks
reject NREMT CCP credentials and profiles. The migration must be reviewed and
applied before using these new values
against a database. This task does not apply it to remote Supabase.

Phase 2 will separately update the other Iowa levels for the November 1, 2026
state changes. No renewal cycles or automatic expiration alerts change here.

Run the focused TypeScript tests with `npm run test:ems`. After applying the
migration to a disposable local database, run `supabase/tests/ems_ccp_phase1.sql`
with `psql -v ON_ERROR_STOP=1` to verify the seeded category hours and totals.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
