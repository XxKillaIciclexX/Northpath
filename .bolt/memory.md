# Project memory

## Product intent & audience

- The public website presents Northpath's services and Ice Pack Companion.
- The website currently uses email links for inquiries.
- The audience includes businesses seeking automation and streamers interested in the Companion.

## Brand personality & voice

- Professional AI services brand; production-quality, polished presentation expected.

## Visual design & UX direction

- Stack is Vite, React with TypeScript, Tailwind CSS, and Lucide icons.
- No additional UI/icon theme packages unless explicitly requested.

## Decisions, constraints & rationale

- The website account rebuild targets a fresh Supabase project. Use the project URL for the new development database when configuring the website.
- The `development` branch contains the refreshed website and is the branch for account work. Verify the active GitHub branch in Bolt before generating changes.
- The website in `development` has no active account integration. The initial schema and setup steps are in `supabase/`.
- Start with email sign-in, account confirmation, password recovery, and sign-out. Add Google sign-in after the email flow works on the test URL.
- Companion's local bridge and ARK engine are separate from website authentication. Scope the first account integration to the website in `src/`.

## Open questions & assumptions

- Verify that a Supabase Auth test account gets a matching profile before testing the website sign-in flow.
- Check the deployed test URL and its authentication redirects before publishing the updated site to `northpath.ai`.
