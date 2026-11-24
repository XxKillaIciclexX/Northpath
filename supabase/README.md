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

For staging, set the same two build variables on the staging deploy and add both callback URLs for its exact origin in Supabase. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

If you want Bolt to manage the project connection directly, configure it for **Northpath Development** using Bolt's Supabase integration. The Northpath website can also connect directly using its own build settings. [Connect Supabase in Bolt](https://support.bolt.new/integrations/supabase#connect-a-supabase-database)

## 5. Set up signup and password reset email

**Create an account** uses Supabase's **Confirm signup** email. **Invite user** in the Supabase dashboard uses its separate invitation email. An already confirmed address can receive the same generic signup response because Supabase masks whether an account exists. For a quick test with the built-in mail service, use **Forgot password** on an existing test user whose address is also a member of your Supabase organization. The built-in service sends only to team addresses and is limited to two auth emails per hour. [Supabase Auth mail](https://supabase.com/docs/guides/auth/auth-smtp) · [Signup API](https://supabase.com/docs/reference/javascript/auth-signup)

Set up custom SMTP to send confirmations and password resets to external testers.

### Google Workspace SMTP

1. Sign in to the Google account for your Workspace Gmail mailbox. Enable **2-Step Verification** if needed, then create an **App password** named `Northpath Supabase`. [Google App Passwords](https://myaccount.google.com/apppasswords) · [Google setup instructions](https://support.google.com/accounts/answer/185833)
2. In **Supabase → Authentication → Emails → SMTP Settings**, turn on **Custom SMTP**. Use the same primary mailbox address for both the sender and the SMTP username. `hello@northpath.ai` is an example if it is the address you sign in with. Enter the new app password in the SMTP password field and save.

   | Field | Google Workspace value |
   | --- | --- |
   | Sender name | `Northpath` |
   | Sender email | Full primary Workspace mailbox address |
   | Host | `smtp.gmail.com` |
   | Port | `465` (SSL/TLS) |
   | Username | Full primary Workspace mailbox address |
   | Password | The Google app password for that mailbox |

   Keep the app password in Supabase. If **App Passwords** is unavailable for the mailbox, check with your Workspace admin or use the Resend option below. [Google Workspace SMTP](https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app) · [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp#how-to-set-up-a-custom-smtp-server)

#### Send from `noreply@northpath.ai`

1. Open Gmail for the Workspace mailbox that owns the alias. Go to **Settings → See all settings → Accounts** (or **Accounts and Import**). Under **Send mail as**, add `noreply@northpath.ai` and complete verification if prompted. Compose a test email to an inbox you control and choose the alias in the **From** field. [Workspace aliases](https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias) · [Gmail Send mail as](https://support.google.com/mail/answer/22370)
2. In the Supabase project used by `northpath.ai`, open **Authentication → Emails → SMTP Settings**. Set **Sender email** to `noreply@northpath.ai` and **Sender name** to `Northpath`. Use the primary Workspace mailbox and its app password for SMTP authentication. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)
3. Request a fresh magic link to an inbox you control. In Gmail, use **More → Show original** to check that `From` contains `noreply@northpath.ai`. Check `Sender` and `Return-Path` for the primary mailbox if those headers are present. Google notes that some recipients may see the primary account when using an alias. If Google rewrites the From address or exposes the primary mailbox, use a dedicated Workspace sending mailbox or a verified transactional sender at `northpath.ai`. [Inspect message headers](https://support.google.com/mail/answer/29436) · [Gmail sender display](https://support.google.com/mail/answer/22370)

### Resend SMTP

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

### Verify delivery

Keep email confirmation enabled in the email provider settings. With the Northpath preview running at `http://localhost:5175`, choose **Create an account** with a new address. Open the confirmation link in the same browser profile. Expect **Your account** in Northpath and a confirmed email in **Authentication → Users**. Then test **Forgot password**, change the password from the email link, sign out, and sign in with the new password.

If mail is missing, check **Logs Explorer → Auth** in Supabase at the time of the request. For Resend also check **Emails** for delivery, bounce, or rejection status. If mail arrives but the callback fails, check the exact redirect URLs under **URL Configuration** and turn off click tracking for the authentication sender if it is enabled. [Troubleshoot Auth mail](https://supabase.com/kb/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw) · [Email link handling](https://supabase.com/docs/guides/deployment/going-into-prod#email-link-validity)

## 6. Test Google sign-in on development

1. In the Supabase project used by the preview, open **Authentication → Sign In / Providers → Google** and copy the callback URL ending in `/auth/v1/callback`. [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
2. In **Google Auth Platform**, configure the app branding and use the **External** audience to test with Google accounts outside your Workspace. While the app is in **Testing**, add the Google account you will use under **Audience → Test users**. [Google OAuth consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent)
3. Under **Clients**, create a **Web application** OAuth client. Add each test website origin under **Authorized JavaScript origins**, such as `http://localhost:5175` and the exact HTTPS origin of your preview. Under **Authorized redirect URIs**, paste the **Supabase callback URL** from step 1. Copy the client ID and secret into Supabase's Google provider settings, then enable Google and save. [Google OAuth clients](https://console.cloud.google.com/auth/clients)
4. Under **Supabase → Authentication → URL Configuration → Redirect URLs**, add `http://localhost:5175/?account=google` for local testing and the exact preview origin followed by `/?account=google` for a hosted preview. Set `VITE_SUPABASE_GOOGLE_ENABLED=true` in `.env.local` or in the preview's build environment, then restart the dev server or rebuild the preview. The client secret goes in Supabase's Google provider settings. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
5. Open **Sign in → Continue with Google**. Confirm Google returns you to **Your account** with the expected email. Sign out, then cancel a second Google sign-in and confirm you can still use email sign-in. Before publishing the Google button, add `https://northpath.ai` to Google's origins, add `https://northpath.ai/?account=google` to Supabase's redirects, and update the Google app's **Audience** to support your intended users. [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 7. Save Companion drafts to streamer accounts

1. In the Supabase project used by your preview, open **SQL Editor → New query**, paste [the Companion drafts migration](migrations/20261123000200_create_companion_drafts.sql), and run it once. In **Table Editor**, confirm `companion_drafts` exists with RLS enabled. Each signed-in user has one saved draft and can read and change only their own row. [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
2. In the Northpath build environment for `development`, add `VITE_SUPABASE_COMPANION_DRAFTS_ENABLED=true` alongside the existing Supabase URL and publishable key. Restart the preview. Open `/companion` and sign in with your existing Northpath account. For Google sign-in, the existing callback returns to the homepage. From there, reopen Companion.
3. In Companion, edit a Gift Rule and Kit. Open **Settings → Account draft → Save to account** and wait for confirmation. In a private window or on another device, sign in to the same account and choose **Load account draft**. Confirm the two edits appear. A second account should see **There is no draft saved to this account yet** until it makes its own save.
4. To bring over a draft saved as a guest, choose **Settings → Export JSON** before signing in. After signing in, choose **Import JSON**, review the draft, then **Save to account**. Account saves include Gift Rules and Kits. The browser workspace keeps server preferences and the player target outside the account draft.

Run the migration in the production Supabase project before enabling the flag for a published build. When the preview and live site use the same Supabase project, the migration only needs to run once.

## 8. Connect the Windows Companion to the website

1. In the Supabase project used by Northpath, run [the Companion device migration](migrations/20261123000300_create_companion_devices.sql) once in **SQL Editor**.
2. In the existing Northpath Bolt project on `development`, set `VITE_SUPABASE_COMPANION_LINK_ENABLED=true` alongside the current Supabase settings. Restart the preview and open **Connections**. Verify that it offers **Website pairing code** after sign-in, then publish when ready. The published Windows pilot reads its connection settings from `https://northpath.ai/companion-agent.json`.
3. Pull `development` on Windows and rebuild with `node .\scripts\Build-IcePackPilotSetup.mjs --local --out "$env:USERPROFILE\Downloads\IcePackCompanionPilot-Website"`. Close and uninstall the older pilot before installing the rebuilt setup. Launch **Ice Pack Companion Pilot 5.6** from Start.
4. Sign in to [Northpath Companion](https://northpath.ai/companion#connections) and paste the **Website pairing code** printed by the Windows launcher. Click **Pair Windows app**, wait for **Preview ready**, then click **Run Heart Me Preview**. Expect **The engine planned 25 Stone** in the website. Stop the Windows app and confirm the site reports **Windows app offline** within about 30 seconds. **Disconnect** removes this app from your account.

The Windows app checks in over HTTPS and runs the sample preview locally. The website receives connection status and the result of that sample. The pilot still needs a separate test-server pass for live gift delivery.

### Link the regular Operations Center

1. Run [the Survivor status migration](migrations/20261123000400_report_companion_survivor.sql) in the same Supabase project's **SQL Editor**. Then publish the updated Northpath project from Bolt with the Connections flag already enabled.
2. Pull `development` in your Northpath checkout on Windows. Close the Pilot if it is running. Stop and restart the regular Companion from Operations Center to load the updated bridge, then open the updated Operations Center.
3. If your Survivor ID is already saved and loaded, keep it. To set or change it, turn off the reward lanes, then select **Operational readiness → Set Survivor ID** and enter your numeric Specimen Implant ID. The local engine saves the target after the bridge takes a configuration snapshot.
4. Select **Northpath website → Copy website pairing code**, then **Open website Connections**. Sign in, paste the code, and select **Pair Windows app**. Approve the replacement prompt if your account is still paired with the Pilot. Expect **Survivor linked** if the engine has loaded your saved target. Stop Companion and confirm the website reports it offline within about 30 seconds.

The regular app reports engine availability and whether the target is configured. It keeps your Survivor ID and ARK credentials on Windows.

### Apply one website Gift Rule from Windows

1. In the same Supabase project, run [the paired draft migration](migrations/20261123000500_read_paired_companion_draft.sql) in **SQL Editor**. Pull `development` in Northpath on Windows, restart Companion through Operations Center, and reopen Operations Center. Use the regular app paired in **Connections**.
2. In the hosted dashboard's **Gift Rules**, set the existing **Rose** rule to give **5 Stone** at quality `0`, clear any announcement text, and leave the gift ID or name and **Enabled** setting in place. Select **Settings → Account draft → Save to account**.
3. In Operations Center, turn off active reward lanes before applying. Choose **Northpath website → Review website rule**, enter `Rose`, and check the current and proposed rewards in the dialog. Approve the change and look for **Rule applied and loaded**. Save the displayed recovery snapshot name. The review applies one direct item or dinosaur rule and preserves the other local rules and Kits.
4. In **Operational readiness**, choose **Enable Live Custom Rules** and confirm. Check your Stone count in ARK, send a single Rose through the current TikFinity and Streamer.bot setup, and verify the count increases by exactly five. Use **Stop Custom Rules** after the test.

Applying a rule takes a local recovery snapshot, checks that the approved website draft and local files are current, and verifies which files the running engine loaded. Live mode requires a separate confirmation in Operations Center and starts off after a restart.
