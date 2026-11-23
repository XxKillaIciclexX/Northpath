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

- Use Bolt Database and its built-in authentication for the new website accounts. The old external Supabase project was removed.
- The `development` branch contains the refreshed website and is the branch for account work. Verify the active GitHub branch in Bolt before generating changes.
- The website in `development` has no active account integration. Check the project's database panel in Bolt for the provisioning status.
- Start with email sign-in, account confirmation, password recovery, and sign-out. Add Google sign-in after the email flow works on the test URL.
- Companion's local bridge and ARK engine are separate from website authentication. Scope the first account integration to the website in `src/`.

## Open questions & assumptions

- Confirm the Bolt Database opens and the test account appears in User Management before building additional account features.
- Check the deployed test URL and its authentication redirects before publishing the updated site to `northpath.ai`.
