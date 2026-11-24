begin;

alter table public.companion_devices
    add column draft_sync_enabled boolean not null default false,
    add column draft_sync_revision uuid,
    add column draft_sync_state text check (draft_sync_state in ('pending', 'applied', 'blocked'));

create or replace function public.pair_companion_device(p_pairing_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid := auth.uid();
begin
    if owner_id is null or p_pairing_code is null or p_pairing_code !~ '^[0-9a-f]{64}$' then
        raise exception 'Invalid Companion pairing request' using errcode = '22023';
    end if;
    insert into public.companion_devices as device (user_id, pairing_hash) values (owner_id, p_pairing_code)
    on conflict (user_id) do update set pairing_hash = excluded.pairing_hash, seen_at = null,
        engine_online = false, preview_ready = false, preview_id = null, preview_state = null,
        preview_updated_at = null, survivor_configured = null,
        draft_sync_enabled = false, draft_sync_revision = null, draft_sync_state = null
    where device.pairing_hash is distinct from excluded.pairing_hash;
end;
$$;

create function public.read_companion_sync_draft(p_device_secret text, p_known_revision uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
    select coalesce((
        select jsonb_build_object('account', device.user_id, 'revision', draft.revision,
            'draft', case when draft.revision is distinct from p_known_revision then draft.draft end)
        from public.companion_devices as device
        left join public.companion_drafts as draft on draft.user_id = device.user_id
        where p_device_secret ~ '^[0-9a-f]{64}$' and device.survivor_configured is not null
            and device.pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
    ), '{}'::jsonb);
$$;

create function public.report_companion_draft_sync(p_device_secret text, p_account uuid, p_enabled boolean, p_revision uuid, p_state text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' or p_enabled is null
        or (p_state is not null and p_state not in ('pending', 'applied', 'blocked')) then return false; end if;

    update public.companion_devices as device set draft_sync_enabled = p_enabled,
        draft_sync_revision = case when p_enabled then p_revision end,
        draft_sync_state = case when p_enabled then p_state end
    where device.user_id = p_account and device.survivor_configured is not null
        and device.pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        and (p_revision is null or exists (select 1 from public.companion_drafts
            where user_id = p_account and revision = p_revision));
    return found;
end;
$$;

create function public.get_companion_draft_sync()
returns jsonb language sql stable security definer set search_path = ''
as $$
    select coalesce((
        select jsonb_build_object('enabled', device.draft_sync_enabled,
            'online', coalesce(device.seen_at > pg_catalog.statement_timestamp() - interval '25 seconds', false),
            'revision', draft.revision,
            'state', case when draft.revision is null or not device.draft_sync_enabled then null
                when draft.revision = device.draft_sync_revision then coalesce(device.draft_sync_state, 'pending')
                else 'pending' end)
        from public.companion_devices as device
        left join public.companion_drafts as draft on draft.user_id = device.user_id
        where device.user_id = auth.uid()
    ), '{}'::jsonb);
$$;

revoke execute on function public.read_companion_sync_draft(text, uuid),
    public.report_companion_draft_sync(text, uuid, boolean, uuid, text), public.get_companion_draft_sync()
    from public, anon, authenticated;
grant execute on function public.read_companion_sync_draft(text, uuid),
    public.report_companion_draft_sync(text, uuid, boolean, uuid, text) to anon;
grant execute on function public.get_companion_draft_sync() to authenticated;

commit;
