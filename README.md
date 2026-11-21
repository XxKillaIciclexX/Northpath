# Northpath development-branch Supabase cleanup

Only apply this on `development`, never directly to `main`.

1. Copy `src/App.tsx`, `src/components/ComingSoon.tsx`, and `src/components/Contact.tsx` into the matching locations in the repository.
2. Remove `src/components/Login.tsx` and `src/components/SetPassword.tsx` (they import the deleted Supabase client).
3. Do **not** delete your `src/components` folder or the `src/components/ComingSoon.tsx` referenced above.
4. From your project folder, run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. Commit only on `development` and inspect the preview before merging to `main`.

This is a temporary database-free bridge. The old sign-in, contact submission, and subscription features are disabled rather than pretending to save data. The email CTA opens a mail application.

The dependency `@supabase/supabase-js` may remain in `package.json` until the next dependency/lockfile cleanup. It is not used by the patched components.
