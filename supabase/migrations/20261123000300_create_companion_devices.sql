begin;

create table public.companion_devices (
    user_id uuid primary key references auth.users (id) on delete cascade,
    pairing_hash text not null unique check (pairing_hash ~ '^[0-9a-f]{64}$'),
    seen_at timestamptz,
    engine_online boolean not null default false,
    preview_ready boolean not null default false,
    preview_id uuid,
    preview_state text check (preview_state in ('queued', 'running', 'passed', 'failed')),
    preview_updated_at timestamptz
);

alter table public.companion_devices enable row level security;
revoke all on table public.companion_devices from public, anon, authenticated;
grant select (user_id, seen_at, engine_online, preview_ready, preview_state, preview_updated_at), delete
    on table public.companion_devices to authenticated;

create policy "Read own Companion device" on public.companion_devices
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Disconnect own Companion device" on public.companion_devices
    for delete to authenticated using ((select auth.uid()) = user_id);

create function public.pair_companion_device(p_pairing_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid := auth.uid();
begin
    if owner_id is null or p_pairing_code is null or p_pairing_code !~ '^[0-9a-f]{64}$' then
        raise exception 'Invalid Companion pairing request' using errcode = '22023';
    end if;
    insert into public.companion_devices as device (user_id, pairing_hash) values (owner_id, p_pairing_code)
    on conflict (user_id) do update set pairing_hash = excluded.pairing_hash, seen_at = null,
        engine_online = false, preview_ready = false, preview_id = null, preview_state = null, preview_updated_at = null
    where device.pairing_hash is distinct from excluded.pairing_hash;
end;
$$;

create function public.queue_companion_preview()
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    update public.companion_devices set preview_id = pg_catalog.gen_random_uuid(), preview_state = 'queued',
        preview_updated_at = pg_catalog.clock_timestamp()
    where user_id = auth.uid() and engine_online and preview_ready
        and seen_at > pg_catalog.clock_timestamp() - interval '25 seconds'
        and (preview_state is null or preview_state in ('passed', 'failed')
            or preview_updated_at < pg_catalog.clock_timestamp() - interval '45 seconds');
    return found;
end;
$$;

create function public.companion_device_heartbeat(p_device_secret text, p_engine_online boolean, p_preview_ready boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare linked_user uuid;
declare queued_preview uuid;
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then
        return jsonb_build_object('paired', false);
    end if;
    update public.companion_devices set seen_at = pg_catalog.clock_timestamp(),
        engine_online = coalesce(p_engine_online, false),
        preview_ready = coalesce(p_engine_online and p_preview_ready, false)
    where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
    returning user_id into linked_user;
    if linked_user is null then return jsonb_build_object('paired', false); end if;

    if p_engine_online and p_preview_ready then
        update public.companion_devices set preview_state = 'running', preview_updated_at = pg_catalog.clock_timestamp()
        where user_id = linked_user and preview_state = 'queued'
            and preview_updated_at > pg_catalog.clock_timestamp() - interval '45 seconds'
        returning preview_id into queued_preview;
    end if;
    return jsonb_build_object('paired', true, 'preview_id', queued_preview);
end;
$$;

create function public.finish_companion_preview(p_device_secret text, p_preview_id uuid, p_passed boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then return false; end if;
    update public.companion_devices set preview_state = case when p_passed then 'passed' else 'failed' end,
        preview_updated_at = pg_catalog.clock_timestamp()
    where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        and preview_id = p_preview_id and preview_state = 'running';
    return found;
end;
$$;

revoke execute on function public.pair_companion_device(text), public.queue_companion_preview(),
    public.companion_device_heartbeat(text, boolean, boolean), public.finish_companion_preview(text, uuid, boolean)
    from public, anon, authenticated;
grant execute on function public.pair_companion_device(text), public.queue_companion_preview() to authenticated;
grant execute on function public.companion_device_heartbeat(text, boolean, boolean),
    public.finish_companion_preview(text, uuid, boolean) to anon;

commit;
