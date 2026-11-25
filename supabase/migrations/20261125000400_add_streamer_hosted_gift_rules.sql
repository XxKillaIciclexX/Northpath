begin;

alter table public.companion_relay_tests
    drop constraint companion_relay_tests_source_check,
    add constraint companion_relay_tests_source_check check (source in ('test','live_rose','live_draft')),
    add column draft_revision uuid,
    add column reward_id text not null default 'rose-stone' check (reward_id in ('rose-stone','wild-dodo','starter-kit'));
alter table public.icepack_relay_deliveries
    drop constraint icepack_relay_deliveries_source_check,
    add constraint icepack_relay_deliveries_source_check check (source in ('test','live_rose','live_draft'));

create function public.icepack_effective_rewards(p_policy text, p_rewards text[])
returns text[] language sql immutable set search_path = '' as $$
    select case when p_policy = 'all_supported' then array['rose-stone','wild-dodo','starter-kit']::text[]
        when array['rose-stone','wild-dodo']::text[] <@ p_rewards then p_rewards
        else array_remove(p_rewards, 'starter-kit') end
$$;

create or replace function public.icepack_relay_dashboard(p_actor uuid, p_search text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'owned', (
            select jsonb_build_object('id', s.id, 'name', s.name, 'listed', s.listed, 'hourlyLimit', s.hourly_limit, 'rewardPolicy', s.reward_policy, 'roseWhitelisted', s.rose_whitelisted,
                'allowedRewardIds', s.allowed_reward_ids,
                'access', coalesce((
                    select jsonb_agg(jsonb_build_object('streamerId', a.streamer_id, 'survivorId', a.survivor_id,
                        'state', a.state, 'email', u.email) order by a.state, u.email)
                    from public.icepack_relay_access a join auth.users u on u.id = a.streamer_id
                    where a.server_id = s.id
                ), '[]'::jsonb),
                'history', coalesce((
                    select jsonb_agg(history order by history."createdAt" desc)
                    from (select d.request_id as "requestId", d.created_at as "createdAt", d.state, d.source, d.reward_id as "rewardId",
                            case when d.reward_id = 'rose-stone' and d.state = 'acknowledged' then 1
                                else d.acknowledged_commands end as "acknowledgedCommands",
                            coalesce(u.email, 'Former streamer') as streamer
                        from public.icepack_relay_deliveries d left join auth.users u on u.id = d.streamer_id
                        where d.server_id = s.id order by d.created_at desc limit 20) as history
                ), '[]'::jsonb))
            from public.icepack_relay_servers s where s.owner_id = p_actor
        ),
        'linked', coalesce((
            select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'state', a.state, 'survivorId', a.survivor_id,
                'roseAllowed', (s.reward_policy = 'all_supported' or s.rose_whitelisted),
                'allowedRewardIds', public.icepack_effective_rewards(s.reward_policy, s.allowed_reward_ids)) order by s.name)
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

create or replace function public.icepack_relay_catalog_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare server public.icepack_relay_servers;
declare access public.icepack_relay_access;
declare previous public.icepack_relay_deliveries;
begin
    -- All admission, approval and revocation decisions use this same per-server lock.
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    if p_reward is null or p_reward not in ('rose-stone','wild-dodo','starter-kit') then
        return jsonb_build_object('error', 'Unknown hosted reward.', 'status', 400);
    end if;
    if not (p_reward = any(public.icepack_effective_rewards(server.reward_policy, server.allowed_reward_ids))) then
        return jsonb_build_object('error', 'The owner whitelist does not allow this reward.', 'status', 403);
    end if;
    select * into access from public.icepack_relay_access where server_id = p_server and streamer_id = p_actor;
    if access.state is distinct from 'approved' then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    select * into previous from public.icepack_relay_deliveries
        where server_id = p_server and streamer_id = p_actor and request_id = p_request;
    if p_phase = 'continue' then
        if p_reward <> 'starter-kit' or previous.reward_id is distinct from p_reward or previous.state is distinct from 'sending'
           or previous.survivor_at_reserve is distinct from access.survivor_id
           or previous.created_at <= clock_timestamp() - interval '30 seconds' then
            return jsonb_build_object('error', 'The remaining Kit step was stopped.', 'status', 409);
        end if;
        return jsonb_build_object('survivorId', access.survivor_id);
    end if;
    if p_phase = 'dispatch' then
        update public.icepack_relay_deliveries set state = 'sending'
            where server_id = p_server and streamer_id = p_actor and request_id = p_request
                and state = 'pending' and reward_id = p_reward and created_at > clock_timestamp() - interval '30 seconds'
                and (survivor_at_reserve is null or survivor_at_reserve = access.survivor_id);
        if not found then return jsonb_build_object('error', 'The test expired or was cancelled.', 'status', 409); end if;
        return jsonb_build_object('survivorId', access.survivor_id);
    end if;
    if p_phase <> 'reserve' then return jsonb_build_object('error', 'Invalid delivery phase.', 'status', 400); end if;
    if previous.request_id is not null then return jsonb_build_object('error', 'This test was already submitted.', 'status', 409); end if;

    update public.icepack_relay_deliveries
        set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
        where server_id = p_server and state in ('pending','sending') and created_at <= clock_timestamp() - interval '30 seconds';

    if exists (select 1 from public.icepack_relay_deliveries where server_id = p_server and state in ('pending','sending')) then
        return jsonb_build_object('error', 'Wait for the active server reward to finish.', 'status', 429);
    end if;
    if exists (select 1 from public.icepack_relay_deliveries where server_id = p_server and created_at > clock_timestamp() - interval '15 seconds') then
        return jsonb_build_object('error', 'Wait 15 seconds between server rewards.', 'status', 429);
    end if;
    if (select count(*) from public.icepack_relay_deliveries where server_id = p_server
        and created_at > clock_timestamp() - interval '1 hour') >= server.hourly_limit then
        return jsonb_build_object('error', 'This server reached its hourly reward limit.', 'status', 429);
    end if;
    insert into public.icepack_relay_deliveries (server_id, streamer_id, request_id, state, reward_id, survivor_at_reserve)
        values (p_server, p_actor, p_request, 'pending', p_reward, access.survivor_id);
    return jsonb_build_object('envelope', (select envelope from public.icepack_relay_vault where server_id = p_server));
end;
$$;

create or replace function public.icepack_relay_catalog_policy(p_actor uuid, p_server uuid, p_policy text, p_rewards text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    if p_policy is null or p_policy not in ('whitelist','all_supported') or p_rewards is null
       or array_position(p_rewards, null) is not null
       or (p_rewards <@ array['rose-stone','wild-dodo','starter-kit']::text[]) is not true
       or cardinality(p_rewards) <> (select count(distinct id) from unnest(p_rewards) id)
    then return jsonb_build_object('error', 'Choose a valid reward whitelist.', 'status', 400); end if;
    update public.icepack_relay_servers set reward_policy = p_policy, allowed_reward_ids = p_rewards,
        rose_whitelisted = 'rose-stone' = any(p_rewards)
        where id = p_server and owner_id = p_actor;
    if not found then return jsonb_build_object('error', 'Server owner access is required.', 'status', 403); end if;
    if p_policy = 'whitelist' then
        if not ('rose-stone' = any(p_rewards)) then
            delete from public.companion_relay_tests where server_id = p_server and source <> 'live_draft';
        end if;
        delete from public.companion_relay_tests where server_id = p_server and source = 'live_draft'
            and not (reward_id = any(public.icepack_effective_rewards(p_policy, p_rewards)));
        update public.icepack_relay_deliveries
            set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
            where server_id = p_server and not (reward_id = any(public.icepack_effective_rewards(p_policy, p_rewards)))
                and (state = 'pending' or (reward_id = 'starter-kit' and state = 'sending'));
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

-- Match supported recipes by the saved rule's contents. A Kit name is presentation only.
create function public.icepack_hosted_recipe(p_action jsonb, p_kits jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare entries jsonb;
declare first_reward text;
declare second_reward text;
begin
    if p_action ->> 'announcement' is distinct from '' then return null; end if;
    if p_action ->> 'type' = 'item' and p_action ->> 'catalogId' = 'Stone'
       and p_action -> 'quantity' = '5'::jsonb and p_action -> 'quality' = '0'::jsonb then return 'rose-stone'; end if;
    if p_action ->> 'type' = 'dinosaur' and p_action ->> 'catalogId' = 'Dodo'
       and p_action -> 'quantity' = '1'::jsonb and p_action -> 'level' = '25'::jsonb
       and p_action -> 'tamed' = 'false'::jsonb then return 'wild-dodo'; end if;
    if p_action ->> 'type' is distinct from 'kit' or coalesce(p_action ->> 'kitId', '') = ''
       or jsonb_typeof(p_kits) is distinct from 'array' then return null; end if;

    select case when count(*) = 1 then min((kit -> 'entries')::text)::jsonb end into entries
        from jsonb_array_elements(p_kits) kit where kit ->> 'id' = p_action ->> 'kitId';
    if jsonb_typeof(entries) is distinct from 'array' then return null; end if;
    if jsonb_array_length(entries) <> 2 then return null; end if;
    first_reward := public.icepack_hosted_recipe(entries -> 0 -> 'action', '[]');
    second_reward := public.icepack_hosted_recipe(entries -> 1 -> 'action', '[]');
    if first_reward = 'rose-stone' and second_reward = 'wild-dodo' then return 'starter-kit'; end if;
    return null;
end;
$$;

create function public.icepack_hosted_draft_rules(p_draft jsonb)
returns table (gift_id text, reward_id text) language sql immutable set search_path = '' as $$
    select rule ->> 'giftId', public.icepack_hosted_recipe(rule -> 'action', p_draft -> 'kits')
    from jsonb_array_elements(case when jsonb_typeof(p_draft -> 'rules') = 'array' then p_draft -> 'rules' else '[]'::jsonb end) rule
    where rule -> 'enabled' = 'true'::jsonb and jsonb_typeof(rule -> 'giftId') = 'string'
      and rule ->> 'giftId' ~ '^[1-9][0-9]{0,19}$'
$$;

create or replace function public.get_companion_relay_test_target(p_device_secret text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce((
        select jsonb_build_object('paired', true, 'targets', coalesce((
            select jsonb_agg(jsonb_build_object('serverId', s.id, 'serverName', s.name, 'survivorId', a.survivor_id,
                'liveRoseEnabled', s.reward_policy = 'all_supported' or s.rose_whitelisted,
                'hostedGiftIds', coalesce((
                    select jsonb_agg(gift_id order by gift_id)
                    from (
                        select r.gift_id
                        from public.icepack_hosted_draft_rules(draft.draft) r
                        group by r.gift_id
                        having count(*) = 1 and min(r.reward_id) is not null
                    ) eligible
                ), '[]'::jsonb)))
            from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
            where a.streamer_id = d.user_id and a.state = 'approved'
        ), '[]'::jsonb))
        from public.companion_devices d left join public.companion_drafts draft on draft.user_id = d.user_id
        where p_device_secret ~ '^[0-9a-f]{64}$'
          and d.pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
    ), '{"paired":false,"targets":[]}'::jsonb)
$$;

create function public.authorize_companion_draft_gift(
    p_device_secret text, p_server uuid, p_survivor text, p_gift text, p_token_hash text, p_event_hash text
) returns text language plpgsql security definer set search_path = '' as $$
declare device public.companion_devices;
declare server public.icepack_relay_servers;
declare saved public.companion_drafts;
declare reward text;
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then return 'stopped'; end if;
    select * into device from public.companion_devices
        where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        for share;
    if not found then return 'stopped'; end if;
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return 'stopped'; end if;
    if p_token_hash is null and p_event_hash is null and p_gift is null then
        delete from public.companion_relay_tests
            where server_id = p_server and streamer_id = device.user_id and source = 'live_draft';
        update public.icepack_relay_deliveries
            set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
            where server_id = p_server and streamer_id = device.user_id and source = 'live_draft'
                and (state = 'pending' or (reward_id = 'starter-kit' and state = 'sending'));
        return 'stopped';
    end if;
    if not exists (select 1 from public.icepack_relay_access where server_id = p_server
        and streamer_id = device.user_id and state = 'approved' and survivor_id = p_survivor)
    then return 'stopped'; end if;
    if p_gift is null or p_gift !~ '^[1-9][0-9]{0,19}$' or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
       or p_event_hash is null or p_event_hash !~ '^[0-9a-f]{64}$' then return 'ignored'; end if;
    select * into saved from public.companion_drafts where user_id = device.user_id;
    if not found then return 'ignored'; end if;

    select case when count(*) = 1 then min(reward_id) end into reward
        from public.icepack_hosted_draft_rules(saved.draft) where gift_id = p_gift;
    if reward is null or not (reward = any(public.icepack_effective_rewards(server.reward_policy, server.allowed_reward_ids)))
    then return 'ignored'; end if;

    insert into public.companion_relay_tests (token_hash, pairing_hash, server_id, streamer_id, survivor_id, request_id, source, draft_revision, reward_id)
        values (p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor,
            substr(p_event_hash, 1, 32)::uuid, 'live_draft', saved.revision, reward)
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at, source = excluded.source,
        draft_revision = excluded.draft_revision, reward_id = excluded.reward_id;
    return 'ready';
end;
$$;

create function public.icepack_relay_draft_delivery(p_token_hash text, p_owner uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare arm public.companion_relay_tests;
declare result jsonb;
begin
    select * into arm from public.companion_relay_tests where token_hash = p_token_hash and source = 'live_draft';
    if not found then return jsonb_build_object('error', 'Gift authorization changed or expired.', 'status', 403); end if;
    perform 1 from public.companion_devices
        where user_id = arm.streamer_id and pairing_hash = arm.pairing_hash for share;
    if not found then return jsonb_build_object('error', 'Pair Companion with Northpath again.', 'status', 403); end if;
    perform 1 from public.icepack_relay_servers where id = arm.server_id and owner_id = p_owner for update;
    if not found or not exists (select 1 from public.companion_relay_tests
        where token_hash = p_token_hash and source = 'live_draft' and expires_at > clock_timestamp())
       or not exists (select 1 from public.icepack_relay_access where server_id = arm.server_id
        and streamer_id = arm.streamer_id and state = 'approved' and survivor_id = arm.survivor_id)
    then return jsonb_build_object('error', 'Gift approval changed or expired.', 'status', 403); end if;
    perform 1 from public.companion_drafts where user_id = arm.streamer_id and revision = arm.draft_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Gift Rules changed during delivery.', 'status', 409); end if;
    result := public.icepack_relay_catalog_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id);
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = 'live_draft'
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id, 'rewardId', arm.reward_id);
    end if;
    return result;
end;
$$;

revoke execute on function public.icepack_effective_rewards(text,text[]), public.icepack_hosted_recipe(jsonb,jsonb),
    public.icepack_hosted_draft_rules(jsonb), public.authorize_companion_draft_gift(text,uuid,text,text,text,text),
    public.icepack_relay_draft_delivery(text,uuid,text) from public, anon, authenticated;
grant execute on function public.authorize_companion_draft_gift(text,uuid,text,text,text,text) to anon;
grant execute on function public.icepack_relay_draft_delivery(text,uuid,text) to service_role;

commit;
