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

Once the website account page is wired to the new project, use its local URL as the development **Site URL** in **Authentication → URL Configuration**, then add the exact confirmation and recovery URLs used by the app to **Redirect URLs**. Repeat that configuration for the staging site. Use the **Project URL** and **publishable key** in the website build settings. Keep the database password and secret or service-role keys in private tooling. [React configuration](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) · [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

Test email confirmation, sign-in, sign-out, and password recovery in staging. Supabase's default email service limits who can receive auth mail. Configure custom SMTP before invitations or confirmation emails go to people outside the Supabase organization. Add Google as a second provider after the email flow works. [Auth email delivery](https://supabase.com/docs/guides/auth/auth-smtp) · [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google)

If you want Bolt to manage the project connection directly, configure it for **Northpath Development** using Bolt's Supabase integration. The Northpath website can also connect directly using its own build settings. [Connect Supabase in Bolt](https://support.bolt.new/integrations/supabase#connect-a-supabase-database)
