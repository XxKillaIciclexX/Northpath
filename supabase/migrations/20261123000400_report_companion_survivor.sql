begin;

alter table public.companion_devices add column survivor_configured boolean;
grant select (survivor_configured) on public.companion_devices to authenticated;

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
        preview_updated_at = null, survivor_configured = null
    where device.pairing_hash is distinct from excluded.pairing_hash;
end;
$$;

create function public.report_companion_survivor(p_device_secret text, p_engine_online boolean, p_survivor_configured boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then
        return jsonb_build_object('paired', false);
    end if;
    update public.companion_devices set seen_at = pg_catalog.clock_timestamp(),
        engine_online = coalesce(p_engine_online, false), preview_ready = false,
        survivor_configured = coalesce(p_engine_online and p_survivor_configured, false)
    where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex');
    return jsonb_build_object('paired', found);
end;
$$;

revoke execute on function public.report_companion_survivor(text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.report_companion_survivor(text, boolean, boolean) to anon;

commit;
