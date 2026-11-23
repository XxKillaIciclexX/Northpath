begin;

create table public.companion_drafts (
    user_id uuid primary key references auth.users (id) on delete cascade,
    draft jsonb not null,
    revision uuid not null default gen_random_uuid(),
    updated_at timestamptz not null default now(),
    constraint companion_draft_format check (
        case
            when jsonb_typeof(draft) = 'object'
                and jsonb_typeof(draft -> 'rules') = 'array'
                and jsonb_typeof(draft -> 'kits') = 'array'
            then (draft -> 'version') is not distinct from '1'::jsonb
                and draft - array['version', 'rules', 'kits'] = '{}'::jsonb
                and jsonb_array_length(draft -> 'rules') <= 500
                and jsonb_array_length(draft -> 'kits') <= 200
                and octet_length(draft::text) <= 2000000
            else false
        end
    )
);

alter table public.companion_drafts enable row level security;

revoke all on table public.companion_drafts from public, anon, authenticated;
grant select, insert (user_id, draft), update (draft) on table public.companion_drafts to authenticated;

create policy "Read own Companion draft" on public.companion_drafts
    for select to authenticated
    using ((select auth.uid()) = user_id);

create policy "Create own Companion draft" on public.companion_drafts
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Update own Companion draft" on public.companion_drafts
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create function public.update_companion_draft_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.revision := pg_catalog.gen_random_uuid();
    new.updated_at := pg_catalog.clock_timestamp();
    return new;
end;
$$;

revoke execute on function public.update_companion_draft_revision() from public, anon, authenticated;

create trigger update_companion_draft_revision
    before update on public.companion_drafts
    for each row execute function public.update_companion_draft_revision();

commit;
