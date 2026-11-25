begin;

alter table public.icepack_relay_servers add column allowed_reward_ids text[] not null default '{}'
    check (allowed_reward_ids <@ array['rose-stone','wild-dodo','starter-kit']::text[]
        and array_position(allowed_reward_ids, null) is null and cardinality(allowed_reward_ids) <= 3);
update public.icepack_relay_servers set allowed_reward_ids = array['rose-stone'] where rose_whitelisted;

alter table public.icepack_relay_deliveries
    add column reward_id text not null default 'rose-stone' check (reward_id in ('rose-stone','wild-dodo','starter-kit')),
    add column survivor_at_reserve text,
    add column acknowledged_commands integer not null default 0 check (acknowledged_commands between 0 and 2);

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
                'allowedRewardIds', case when s.reward_policy = 'all_supported'
                    then array['rose-stone','wild-dodo','starter-kit']::text[] else s.allowed_reward_ids end) order by s.name)
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

create function public.icepack_relay_catalog_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text)
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
    if server.reward_policy = 'whitelist' and not (p_reward = any(server.allowed_reward_ids)) then
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

-- Existing website and Windows Rose routes use the same policy and rate limits.
create or replace function public.icepack_relay_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text)
returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_catalog_delivery(p_actor, p_server, p_request, p_phase, 'rose-stone')
$$;

create function public.icepack_relay_finish_catalog(
    p_actor uuid, p_server uuid, p_request uuid, p_reward text, p_state text, p_acknowledged integer
) returns void language sql security definer set search_path = '' as $$
    update public.icepack_relay_deliveries set state = p_state, acknowledged_commands = p_acknowledged
    where server_id = p_server and streamer_id = p_actor and request_id = p_request and reward_id = p_reward
        and p_acknowledged between 0 and (case when p_reward = 'starter-kit' then 2 else 1 end)
        and ((state = 'pending' and p_state = 'cancelled') or
             (state in ('sending','unconfirmed') and p_state in ('acknowledged','unconfirmed')))
$$;

create function public.icepack_relay_catalog_policy(p_actor uuid, p_server uuid, p_policy text, p_rewards text[])
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
            delete from public.companion_relay_tests where server_id = p_server;
        end if;
        update public.icepack_relay_deliveries
            set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
            where server_id = p_server and not (reward_id = any(p_rewards))
                and (state = 'pending' or (reward_id = 'starter-kit' and state = 'sending'));
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.icepack_relay_live_rose_policy(p_actor uuid, p_server uuid, p_policy text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rewards text[];
begin
    select array_remove(allowed_reward_ids, 'rose-stone') into rewards
        from public.icepack_relay_servers where id = p_server and owner_id = p_actor for update;
    if not found then return jsonb_build_object('error', 'Server owner access is required.', 'status', 403); end if;
    if p_enabled then rewards := array_append(rewards, 'rose-stone'); end if;
    return public.icepack_relay_catalog_policy(p_actor, p_server, p_policy, rewards);
end;
$$;

create function public.stop_icepack_relay_kit_on_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if old.state is distinct from new.state or old.survivor_id is distinct from new.survivor_id then
        update public.icepack_relay_deliveries set state = 'unconfirmed'
            where server_id = old.server_id and streamer_id = old.streamer_id
                and reward_id = 'starter-kit' and state = 'sending';
    end if;
    return new;
end;
$$;
create trigger stop_icepack_relay_kit_on_access_change after update of state, survivor_id on public.icepack_relay_access
    for each row execute function public.stop_icepack_relay_kit_on_access_change();

revoke execute on function public.icepack_relay_catalog_delivery(uuid,uuid,uuid,text,text),
    public.icepack_relay_finish_catalog(uuid,uuid,uuid,text,text,integer),
    public.icepack_relay_catalog_policy(uuid,uuid,text,text[]),
    public.stop_icepack_relay_kit_on_access_change() from public, anon, authenticated;
grant execute on function public.icepack_relay_catalog_delivery(uuid,uuid,uuid,text,text),
    public.icepack_relay_finish_catalog(uuid,uuid,uuid,text,text,integer),
    public.icepack_relay_catalog_policy(uuid,uuid,text,text[]) to service_role;

commit;
