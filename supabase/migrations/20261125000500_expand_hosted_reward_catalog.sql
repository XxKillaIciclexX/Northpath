begin;

create function public.icepack_hosted_reward_ids()
returns text[] language sql immutable set search_path = '' as $$
    select array['rose-stone','wood-5','thatch-5','wild-dodo','wild-raptor','wild-rex','starter-kit']::text[]
$$;

alter table public.icepack_relay_servers
    drop constraint icepack_relay_servers_allowed_reward_ids_check,
    add constraint icepack_relay_servers_allowed_reward_ids_check
        check (allowed_reward_ids <@ public.icepack_hosted_reward_ids()
            and array_position(allowed_reward_ids, null) is null
            and cardinality(allowed_reward_ids) <= cardinality(public.icepack_hosted_reward_ids()));

alter table public.icepack_relay_deliveries
    drop constraint icepack_relay_deliveries_reward_id_check,
    add constraint icepack_relay_deliveries_reward_id_check check (reward_id = any(public.icepack_hosted_reward_ids()));
alter table public.companion_relay_tests
    drop constraint companion_relay_tests_reward_id_check,
    add constraint companion_relay_tests_reward_id_check check (reward_id = any(public.icepack_hosted_reward_ids()));

create or replace function public.icepack_effective_rewards(p_policy text, p_rewards text[])
returns text[] language sql immutable set search_path = '' as $$
    select case when p_policy = 'all_supported' then public.icepack_hosted_reward_ids()
        when array['rose-stone','wild-dodo']::text[] <@ p_rewards then p_rewards
        else array_remove(p_rewards, 'starter-kit') end
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
    if p_reward is null or not (p_reward = any(public.icepack_hosted_reward_ids())) then
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
       or (p_rewards <@ public.icepack_hosted_reward_ids()) is not true
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

create or replace function public.icepack_hosted_recipe(p_action jsonb, p_kits jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare entries jsonb;
declare first_reward text;
declare second_reward text;
begin
    if p_action ->> 'announcement' is distinct from '' then return null; end if;
    if p_action ->> 'type' = 'item' and p_action -> 'quantity' = '5'::jsonb and p_action -> 'quality' = '0'::jsonb then
        return case p_action ->> 'catalogId' when 'Stone' then 'rose-stone' when 'Wood' then 'wood-5' when 'Thatch' then 'thatch-5' end;
    end if;
    if p_action ->> 'type' = 'dinosaur' and p_action -> 'quantity' = '1'::jsonb and p_action -> 'level' = '25'::jsonb
       and p_action -> 'tamed' = 'false'::jsonb then
        return case p_action ->> 'catalogId' when 'Dodo' then 'wild-dodo' when 'Raptor' then 'wild-raptor' when 'Rex' then 'wild-rex' end;
    end if;
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

revoke execute on function public.icepack_hosted_reward_ids() from public, anon, authenticated;

commit;
