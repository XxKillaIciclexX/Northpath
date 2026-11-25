begin;

create table public.companion_relay_tests (
    token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
    pairing_hash text not null,
    server_id uuid not null,
    streamer_id uuid not null,
    survivor_id text not null,
    request_id uuid not null default gen_random_uuid(),
    expires_at timestamptz not null default (clock_timestamp() + interval '2 minutes'),
    foreign key (server_id, streamer_id) references public.icepack_relay_access on delete cascade,
    unique (server_id, streamer_id)
);
alter table public.companion_relay_tests enable row level security;
revoke all on public.companion_relay_tests from public, anon, authenticated, service_role;

create function public.invalidate_companion_relay_test()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if old.state is distinct from new.state or old.survivor_id is distinct from new.survivor_id then
        delete from public.companion_relay_tests where server_id = old.server_id and streamer_id = old.streamer_id;
    end if;
    return new;
end;
$$;
revoke execute on function public.invalidate_companion_relay_test() from public, anon, authenticated, service_role;
create trigger invalidate_companion_relay_test after update of state, survivor_id on public.icepack_relay_access
    for each row execute function public.invalidate_companion_relay_test();

create function public.invalidate_companion_relay_pairing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'DELETE' then
        delete from public.companion_relay_tests where streamer_id = old.user_id;
        return old;
    end if;
    if old.pairing_hash is distinct from new.pairing_hash then
        delete from public.companion_relay_tests where streamer_id = old.user_id;
    end if;
    return new;
end;
$$;
revoke execute on function public.invalidate_companion_relay_pairing() from public, anon, authenticated, service_role;
create trigger invalidate_companion_relay_pairing after delete or update of pairing_hash on public.companion_devices
    for each row execute function public.invalidate_companion_relay_pairing();

create function public.get_companion_relay_test_target(p_device_secret text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce((
        select jsonb_build_object('paired', true, 'targets', coalesce((
            select jsonb_agg(jsonb_build_object('serverId', s.id, 'serverName', s.name, 'survivorId', a.survivor_id))
            from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
            where a.streamer_id = d.user_id and a.state = 'approved'
        ), '[]'::jsonb))
        from public.companion_devices d
        where p_device_secret ~ '^[0-9a-f]{64}$'
          and d.pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
    ), '{"paired":false,"targets":[]}'::jsonb)
$$;

create function public.arm_companion_relay_test(
    p_device_secret text, p_server uuid, p_survivor text, p_token_hash text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare device public.companion_devices;
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$'
       or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;
    select * into device from public.companion_devices
        where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        for share;
    if not found then return false; end if;
    perform 1 from public.icepack_relay_servers where id = p_server for update;
    if not found or not exists (select 1 from public.icepack_relay_access
        where server_id = p_server and streamer_id = device.user_id and state = 'approved' and survivor_id = p_survivor)
    then return false; end if;

    insert into public.companion_relay_tests (token_hash, pairing_hash, server_id, streamer_id, survivor_id)
        values (p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor)
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at;
    return true;
end;
$$;

create function public.icepack_relay_desktop_delivery(p_token_hash text, p_owner uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare arm public.companion_relay_tests;
declare result jsonb;
begin
    select * into arm from public.companion_relay_tests where token_hash = p_token_hash;
    if not found then return jsonb_build_object('error', 'Test access changed. Arm a new hosted test in Companion.', 'status', 403); end if;
    -- The pairing row and server row share the same lock order as the arming function.
    perform 1 from public.companion_devices
        where user_id = arm.streamer_id and pairing_hash = arm.pairing_hash for share;
    if not found then return jsonb_build_object('error', 'Pair Companion with Northpath again.', 'status', 403); end if;
    perform 1 from public.icepack_relay_servers where id = arm.server_id and owner_id = p_owner for update;
    if not found or not exists (select 1 from public.companion_relay_tests
        where token_hash = p_token_hash and expires_at > clock_timestamp()) then
        return jsonb_build_object('error', 'Test access changed or expired. Arm a new hosted test in Companion.', 'status', 403);
    end if;
    if not exists (select 1 from public.icepack_relay_access where server_id = arm.server_id
        and streamer_id = arm.streamer_id and state = 'approved' and survivor_id = arm.survivor_id) then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    result := public.icepack_relay_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase);
    if p_phase = 'reserve' and not (result ? 'error') then
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id);
    end if;
    return result;
end;
$$;

revoke execute on function public.get_companion_relay_test_target(text),
    public.arm_companion_relay_test(text,uuid,text,text), public.icepack_relay_desktop_delivery(text,uuid,text)
    from public, anon, authenticated;
grant execute on function public.get_companion_relay_test_target(text),
    public.arm_companion_relay_test(text,uuid,text,text) to anon;
grant execute on function public.icepack_relay_desktop_delivery(text,uuid,text) to service_role;
commit;
