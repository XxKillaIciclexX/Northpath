begin;

alter table public.icepack_relay_servers add column reward_policy text not null default 'all_supported'
    check (reward_policy in ('whitelist','all_supported'));
alter table public.icepack_relay_servers add column rose_whitelisted boolean not null default false;
alter table public.icepack_relay_deliveries add column source text not null default 'test' check (source in ('test','live_rose'));
alter table public.companion_relay_tests add column source text not null default 'test' check (source in ('test','live_rose'));

create or replace function public.icepack_relay_dashboard(p_actor uuid, p_search text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'owned', (
            select jsonb_build_object('id', s.id, 'name', s.name, 'listed', s.listed, 'hourlyLimit', s.hourly_limit, 'rewardPolicy', s.reward_policy, 'roseWhitelisted', s.rose_whitelisted,
                'access', coalesce((
                    select jsonb_agg(jsonb_build_object('streamerId', a.streamer_id, 'survivorId', a.survivor_id,
                        'state', a.state, 'email', u.email) order by a.state, u.email)
                    from public.icepack_relay_access a join auth.users u on u.id = a.streamer_id
                    where a.server_id = s.id
                ), '[]'::jsonb),
                'history', coalesce((
                    select jsonb_agg(history order by history."createdAt" desc)
                    from (select d.request_id as "requestId", d.created_at as "createdAt", d.state, d.source,
                            coalesce(u.email, 'Former streamer') as streamer
                        from public.icepack_relay_deliveries d left join auth.users u on u.id = d.streamer_id
                        where d.server_id = s.id order by d.created_at desc limit 20) as history
                ), '[]'::jsonb))
            from public.icepack_relay_servers s where s.owner_id = p_actor
        ),
        'linked', coalesce((
            select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'state', a.state, 'survivorId', a.survivor_id,
                'roseAllowed', (s.reward_policy = 'all_supported' or s.rose_whitelisted)) order by s.name)
            from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
            where a.streamer_id = p_actor
        ), '[]'::jsonb),
        'results', coalesce((
            select jsonb_agg(results order by results.name)
            from (select s.id, s.name from public.icepack_relay_servers s where s.listed and s.owner_id <> p_actor
                and char_length(p_search) >= 2 and strpos(lower(s.name), lower(p_search)) > 0
                order by s.name limit 20) as results
        ), '[]'::jsonb)
    )
$$;

create or replace function public.get_companion_relay_test_target(p_device_secret text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce((
        select jsonb_build_object('paired', true, 'targets', coalesce((
            select jsonb_agg(jsonb_build_object('serverId', s.id, 'serverName', s.name, 'survivorId', a.survivor_id, 'liveRoseEnabled', (s.reward_policy = 'all_supported' or s.rose_whitelisted)))
            from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
            where a.streamer_id = d.user_id and a.state = 'approved'
        ), '[]'::jsonb))
        from public.companion_devices d
        where p_device_secret ~ '^[0-9a-f]{64}$'
          and d.pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
    ), '{"paired":false,"targets":[]}'::jsonb)
$$;

create or replace function public.icepack_relay_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare server public.icepack_relay_servers;
declare access public.icepack_relay_access;
declare previous text;
begin
    -- All admission, approval and revocation decisions use this same per-server lock.
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    if server.reward_policy = 'whitelist' and not server.rose_whitelisted then
        return jsonb_build_object('error', 'The owner whitelist does not allow this reward.', 'status', 403);
    end if;
    select * into access from public.icepack_relay_access where server_id = p_server and streamer_id = p_actor;
    if access.state is distinct from 'approved' then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    select state into previous from public.icepack_relay_deliveries
        where server_id = p_server and streamer_id = p_actor and request_id = p_request;
    if p_phase = 'dispatch' then
        update public.icepack_relay_deliveries set state = 'sending'
            where server_id = p_server and streamer_id = p_actor and request_id = p_request
                and state = 'pending' and created_at > clock_timestamp() - interval '30 seconds';
        if not found then return jsonb_build_object('error', 'The test expired or was cancelled.', 'status', 409); end if;
        return jsonb_build_object('survivorId', access.survivor_id);
    end if;
    if p_phase <> 'reserve' then return jsonb_build_object('error', 'Invalid delivery phase.', 'status', 400); end if;
    if previous is not null then return jsonb_build_object('error', 'This test was already submitted.', 'status', 409); end if;

    update public.icepack_relay_deliveries
        set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
        where server_id = p_server and state in ('pending','sending') and created_at <= clock_timestamp() - interval '30 seconds';

    if exists (select 1 from public.icepack_relay_deliveries where server_id = p_server and created_at > clock_timestamp() - interval '15 seconds') then
        return jsonb_build_object('error', 'Wait 15 seconds between server rewards.', 'status', 429);
    end if;
    if (select count(*) from public.icepack_relay_deliveries where server_id = p_server
        and created_at > clock_timestamp() - interval '1 hour') >= server.hourly_limit then
        return jsonb_build_object('error', 'This server reached its hourly reward limit.', 'status', 429);
    end if;
    insert into public.icepack_relay_deliveries (server_id, streamer_id, request_id, state)
        values (p_server, p_actor, p_request, 'pending');
    return jsonb_build_object('envelope', (select envelope from public.icepack_relay_vault where server_id = p_server));
end;
$$;

create function public.icepack_relay_paired_delivery(p_token_hash text, p_owner uuid, p_phase text, p_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare arm public.companion_relay_tests;
declare result jsonb;
begin
    select * into arm from public.companion_relay_tests where token_hash = p_token_hash and source = p_source;
    if not found then return jsonb_build_object('error', 'Reward permission changed or expired.', 'status', 403); end if;
    -- The pairing row and server row share the same lock order as the arming function.
    perform 1 from public.companion_devices
        where user_id = arm.streamer_id and pairing_hash = arm.pairing_hash for share;
    if not found then return jsonb_build_object('error', 'Pair Companion with Northpath again.', 'status', 403); end if;
    perform 1 from public.icepack_relay_servers where id = arm.server_id and owner_id = p_owner for update;
    if not found or not exists (select 1 from public.companion_relay_tests
        where token_hash = p_token_hash and source = p_source and expires_at > clock_timestamp()) then
        return jsonb_build_object('error', 'Test access changed or expired. Arm a new hosted test in Companion.', 'status', 403);
    end if;
    if not exists (select 1 from public.icepack_relay_access where server_id = arm.server_id
        and streamer_id = arm.streamer_id and state = 'approved' and survivor_id = arm.survivor_id) then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    result := public.icepack_relay_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase);
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = p_source
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id);
    end if;
    return result;
end;
$$;

create or replace function public.icepack_relay_desktop_delivery(p_token_hash text, p_owner uuid, p_phase text)
returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_paired_delivery(p_token_hash, p_owner, p_phase, 'test')
$$;

create function public.icepack_relay_live_rose_policy(p_actor uuid, p_server uuid, p_policy text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    update public.icepack_relay_servers set reward_policy = p_policy, rose_whitelisted = p_enabled
        where id = p_server and owner_id = p_actor;
    if not found then return jsonb_build_object('error', 'Server owner access is required.', 'status', 403); end if;
    if p_policy = 'whitelist' and not p_enabled then
        delete from public.companion_relay_tests where server_id = p_server;
        update public.icepack_relay_deliveries set state = 'cancelled'
            where server_id = p_server and state = 'pending';
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

create function public.authorize_companion_live_rose(
    p_device_secret text, p_server uuid, p_survivor text, p_token_hash text, p_event_hash text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare device public.companion_devices;
declare event_id uuid;
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then return false; end if;
    select * into device from public.companion_devices
        where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        for share;
    if not found then return false; end if;
    perform 1 from public.icepack_relay_servers where id = p_server for update;
    if not found then return false; end if;

    -- A stop request cancels the account's outstanding live credential for this server.
    if p_token_hash is null and p_event_hash is null then
        delete from public.companion_relay_tests
            where server_id = p_server and streamer_id = device.user_id and source = 'live_rose';
        update public.icepack_relay_deliveries set state = 'cancelled'
            where server_id = p_server and streamer_id = device.user_id and source = 'live_rose' and state = 'pending';
        return true;
    end if;

    if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_event_hash is null or p_event_hash !~ '^[0-9a-f]{64}$'
       or not exists (select 1 from public.icepack_relay_servers where id = p_server and (reward_policy = 'all_supported' or rose_whitelisted))
       or not exists (select 1 from public.icepack_relay_access where server_id = p_server
           and streamer_id = device.user_id and state = 'approved' and survivor_id = p_survivor)
    then return false; end if;
    event_id := substr(p_event_hash, 1, 32)::uuid;
    insert into public.companion_relay_tests (token_hash, pairing_hash, server_id, streamer_id, survivor_id, request_id, source)
        values (p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor, event_id, 'live_rose')
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at, source = excluded.source;
    return true;
end;
$$;

-- Preserve the test RPC and reset the scope when a one-off test replaces a live credential.
create or replace function public.arm_companion_relay_test(
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
    perform 1 from public.icepack_relay_servers where id = p_server
        and (reward_policy = 'all_supported' or rose_whitelisted) for update;
    if not found or not exists (select 1 from public.icepack_relay_access
        where server_id = p_server and streamer_id = device.user_id and state = 'approved' and survivor_id = p_survivor)
    then return false; end if;

    insert into public.companion_relay_tests (token_hash, pairing_hash, server_id, streamer_id, survivor_id)
        values (p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor)
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at, source = 'test';
    return true;
end;
$$;

revoke execute on function public.icepack_relay_paired_delivery(text,uuid,text,text),
    public.icepack_relay_live_rose_policy(uuid,uuid,text,boolean), public.authorize_companion_live_rose(text,uuid,text,text,text)
    from public, anon, authenticated;
grant execute on function public.icepack_relay_paired_delivery(text,uuid,text,text),
    public.icepack_relay_live_rose_policy(uuid,uuid,text,boolean) to service_role;
grant execute on function public.authorize_companion_live_rose(text,uuid,text,text,text) to anon;

commit;
