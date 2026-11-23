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

Once the website account page is wired to the new project, use its local URL as the development **Site URL** in **Authentication → URL Configuration**, then add the exact confirmation and recovery URLs used by the app to **Redirect URLs**. Repeat that configuration for the staging site. Use the **Project URL** and **publishable key** in the website build settings. Keep the database password and secret or service-role keys in private tooling. [React configuration](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

Test email confirmation, sign-in, sign-out, and password recovery in staging. Supabase's default email service limits who can receive auth mail. Configure custom SMTP before invitations or confirmation emails go to people outside the Supabase organization. Add Google as a second provider after the email flow works. [Auth email delivery](https://supabase.com/docs/guides/auth/auth-smtp) · [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google)

If you want Bolt to manage the project connection directly, configure it for **Northpath Development** using Bolt's Supabase integration. The Northpath website can also connect directly using its own build settings. [Connect Supabase in Bolt](https://support.bolt.new/integrations/supabase#connect-a-supabase-database)
