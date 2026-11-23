# Northpath website database setup

Use a fresh Supabase project for the Northpath website on `development`. This setup adds private profiles for Supabase Auth users. It gives us a single account flow to test before adding Google sign-in or site forms.

## 1. Create the development project

1. Open the Supabase dashboard and choose **New project**.
2. Select your organization, name the project **Northpath Development**, and pick a region near the intended users. Store the generated database password in your password manager.
3. When provisioning finishes, click **Connect**. Keep the **Project URL** and **publishable key** for the website connection. The browser client will use only those two values. [Supabase dashboard](https://supabase.com/dashboard/projects) · [Project keys](https://supabase.com/docs/guides/getting-started/api-keys)

## 2. Apply the schema

1. Open **SQL Editor → New query** inside **Northpath Development**.
2. Copy the full contents of [the website profiles migration](migrations/20261123000100_create_website_profiles.sql) into the editor and click **Run** once.
3. Open **Table Editor → profiles**. Use the query below to check that row-level security is enabled.

```sql
select rowsecurity
from pg_catalog.pg_tables
where schemaname = 'public' and tablename = 'profiles';
```

Expect one row with `rowsecurity` equal to `true`. Signed-in users can read their own profile and update their own display name. Supabase Auth creates the profile when a user is created. The migration also creates profiles for any users already in the development project. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data) · [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

### If `profiles` already exists

Error `42P07` means PostgreSQL found an existing relation named `public.profiles`. This can happen if you ran the migration successfully before. Open a **new query** in the **Northpath Development** project and run this read-only check. It reports schema information without returning any user records.

```sql
select
    exists (
        select 1 from pg_catalog.pg_tables
        where schemaname = 'public' and tablename = 'profiles' and rowsecurity
    ) as rls_enabled,
    array(
        select column_name::text || ' ' || udt_name::text
        from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles'
        order by ordinal_position
    ) as profile_columns,
    array(
        select policyname::text
        from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'profiles'
        order by policyname
    ) as profile_policies,
    exists (
        select 1 from pg_catalog.pg_trigger
        where tgrelid = to_regclass('auth.users')
          and tgname = 'create_website_profile_after_signup'
          and tgfoid = to_regprocedure('public.create_website_profile()')
          and tgenabled in ('O', 'A')
    ) as northpath_signup_trigger;
```

If both status columns say `true`, the columns are `id uuid`, `display_name text`, and `created_at timestamptz`, and the two policies are `Read own profile` and `Update own profile`, continue with the test account in step 3. If the result differs, keep the existing table and share the output of the check so we can plan a migration for that schema.

## 3. Verify profiles before wiring up the website

1. In **Authentication → Users**, use **Add user → Create new user** with an address you control. This is a dashboard test of profile creation.
2. Return to **Table Editor → profiles** and match the new row's `id` to the user's UID under **Authentication → Users**. Its `display_name` starts blank.
3. If you already had users, confirm the following query returns `0`.

```sql
select count(*) as users_without_profiles
from auth.users as users
where not exists (
    select 1 from public.profiles where id = users.id
);
```

## 4. Connect and test website authentication

From the `Northpath` checkout on Windows, run the following in PowerShell.

```powershell
git switch development
git pull --ff-only origin development
if (-not (Test-Path -LiteralPath '.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
notepad .env.local
```

In Supabase, use **Connect** to copy the **Project URL** into `VITE_SUPABASE_URL`. Then open **Settings → API Keys → Publishable and secret API keys** and copy the full **publishable key** beginning with `sb_publishable_` into `VITE_SUPABASE_PUBLISHABLE_KEY`. If you are using the legacy **anon** key, set `VITE_SUPABASE_ANON_KEY` instead. Save `.env.local` in the checkout root, then close Notepad. Keep the database password and server-side keys in private tooling. [React configuration](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) · [Project keys](https://supabase.com/docs/guides/getting-started/api-keys)

If Vite reports a missing key, check that the file is named `.env.local` and that its key line has a value. If it reports an invalid key, copy the full public value again. PowerShell environment variables with the same names take precedence over `.env.local`. [Vite environment settings](https://vite.dev/guide/env-and-mode)

In **Supabase → Authentication → URL Configuration**, set **Site URL** to `http://localhost:5175`, and add these two entries under **Redirect URLs**.

- `http://localhost:5175/?account=confirm`
- `http://localhost:5175/?account=recovery`

In the email provider settings, enable email/password, user sign-ups, and email confirmation for testing. Start the website with a current Node.js LTS release. [Email/password settings](https://supabase.com/docs/guides/auth/passwords) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

```powershell
npm ci
npm run dev -- --host localhost --port 5175 --strictPort
```

Open `http://localhost:5175` and click **Sign in** in the header. Sign in with the confirmed test user from step 3, check that **Your account** shows its email, then sign out. Test **Create an account** and **Forgot password** using an address that can receive mail from your project. Open the email links in the same browser profile where you requested them. After changing the password, sign out and sign in with the new password.

For staging, set the same two build variables on the staging deploy and add both callback URLs for its exact origin in Supabase. Add Google as a second provider after the email flow works. [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google)

If you want Bolt to manage the project connection directly, configure it for **Northpath Development** using Bolt's Supabase integration. The Northpath website can also connect directly using its own build settings. [Connect Supabase in Bolt](https://support.bolt.new/integrations/supabase#connect-a-supabase-database)

## 5. Set up signup and password reset email

**Create an account** uses Supabase's **Confirm signup** email. **Invite user** in the Supabase dashboard uses its separate invitation email. An already confirmed address can receive the same generic signup response because Supabase masks whether an account exists. For a quick test with the built-in mail service, use **Forgot password** on an existing test user whose address is also a member of your Supabase organization. The built-in service sends only to team addresses and is limited to two auth emails per hour. [Supabase Auth mail](https://supabase.com/docs/guides/auth/auth-smtp) · [Signup API](https://supabase.com/docs/reference/javascript/auth-signup)

Set up custom SMTP to send confirmations and password resets to external testers. Use your existing SMTP provider if you have one. For Resend, follow these steps.

1. In **Resend → Domains**, add a sending domain you own, such as `notify.northpath.ai`. Add the DNS records Resend provides and wait for the domain to show **Verified**. Create an API key with sending access for that domain. [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction) · [Resend SMTP settings](https://resend.com/docs/send-with-smtp)
2. In **Supabase → Authentication → Emails → SMTP Settings**, enable **Custom SMTP**. Use the settings below and save.

   | Field | Resend example |
   | --- | --- |
   | Sender name | `Northpath` |
   | Sender email | `accounts@notify.northpath.ai` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | The Resend sending API key |

   Use a sender email on the domain you verified. Keep the sending key in Supabase's SMTP password field. Keep email confirmation enabled in the email provider settings. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp#how-to-set-up-a-custom-smtp-server)
3. With the Northpath preview running at `http://localhost:5175`, choose **Create an account** using an address that has never been used in this Auth project. Open the confirmation link in the same browser profile. Expect **Your account** in Northpath and a confirmed email in **Authentication → Users**. Then test **Forgot password**, change the password from the email link, sign out, and sign in with the new password.
4. If mail is missing, check **Logs Explorer → Auth** in Supabase at the time of the request. For Resend also check **Emails** for delivery, bounce, or rejection status. If mail arrives but the callback fails, check the exact redirect URLs under **URL Configuration** and turn off click tracking for the authentication sender if it is enabled. [Troubleshoot Auth mail](https://supabase.com/kb/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw) · [Email link handling](https://supabase.com/docs/guides/deployment/going-into-prod#email-link-validity)
