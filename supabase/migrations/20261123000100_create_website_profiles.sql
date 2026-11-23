begin;

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text check (char_length(btrim(display_name)) between 1 and 80),
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select, update (display_name) on table public.profiles to authenticated;

create policy "Read own profile" on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id);

create policy "Update own profile" on public.profiles
    for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

create function public.create_website_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;
    return new;
end;
$$;

revoke execute on function public.create_website_profile() from public, anon, authenticated;

create trigger create_website_profile_after_signup
    after insert on auth.users
    for each row execute function public.create_website_profile();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

commit;
