# Project memory

## Product intent & audience

- **Northpath AI** — marketing/services site for AI automation services.
- Primary conversion paths: contact form (also drives sign-up), email newsletter subscription.
- Audience: businesses seeking AI automation services.

## Brand personality & voice

- Professional AI services brand; production-quality, polished presentation expected.

## Visual design & UX direction

- Stack: Vite + React, JSX with Tailwind CSS classes, Lucide React icons.
- No additional UI/icon theme packages unless explicitly requested.

## Decisions, constraints & rationale

- Backend: Supabase (auth + Postgres).
- Auth flows present: login, contact-form-driven sign-up, password reset.
- Existing migration includes `email_subscribers` table.
- Current problem: contact form creates auth accounts but stores inquiry details (name, company, message) only in `auth.users.user_metadata` — unreliable for business data; needs structured tables.
- Planned schema (not yet applied — Supabase connection was unavailable):
  - `profiles` — user name, company, contact info linked to auth account.
  - `contact_inquiries` — structured form submissions (name, email, company, message).
  - `email_subscribers` — already exists; needs RLS policies and grants aligned to skill requirements (4 per-verb policies, explicit grants).
- RLS design: signed-in users see only their own profile and inquiries; contact form can submit inquiries before login.

## Open questions & assumptions

- Supabase connection must be restored from the Bolt Supabase panel before schema can be applied.
- Assumption: contact form should still create auth accounts on submit alongside storing structured inquiry data.
- Assumption: profiles table should sync from `user_metadata` on first login or be populated at inquiry time.