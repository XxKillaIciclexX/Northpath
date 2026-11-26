begin;

create or replace function public.icepack_hosted_reward_ids()
returns text[] language sql immutable set search_path = '' as $$
    select array['rose-stone','wood-5','thatch-5','wild-dodo','wild-raptor','wild-rex','starter-kit','custom-kit']::text[]
$$;

-- Retain the exact approved Kit recipe in delivery history independently of future draft edits.
alter table public.icepack_relay_deliveries
    add column kit_reward_ids text[],
    add column kit_name text,
    add column kit_draft_revision uuid,
    drop constraint icepack_relay_deliveries_acknowledged_commands_check,
    add constraint icepack_relay_deliveries_acknowledged_commands_check check (acknowledged_commands between 0 and 4);

alter table public.companion_relay_tests
    add column kit_reward_ids text[],
    add column kit_name text;

-- A custom Kit may contain up to three distinct material stacks and one wild creature.
-- Keep the existing named Starter Kit on its existing recipe and permission.
create function public.icepack_saved_hosted_kits(p_kits jsonb)
returns table (kit_id text, kit_name text, reward_ids text[])
language sql immutable set search_path = '' as $$
    with unique_kits as (
        select kit, count(*) over (partition by kit ->> 'id') as matches
        from jsonb_array_elements(case when jsonb_typeof(p_kits) = 'array' then p_kits else '[]'::jsonb end) kit
    )
    select kit ->> 'id',
        coalesce(nullif(left(btrim(kit ->> 'name'), 120), ''), 'Custom Kit'),
        steps.ids
    from unique_kits
    cross join lateral (
        select array_agg(reward_id order by position) as ids, count(*) as step_count,
            count(distinct reward_id) as distinct_count,
            count(*) filter (where reward_id like 'wild-%') as creatures
        from jsonb_array_elements(case when jsonb_typeof(kit -> 'entries') = 'array' then
            case when jsonb_array_length(kit -> 'entries') between 2 and 4 then kit -> 'entries' else '[]'::jsonb end
            else '[]'::jsonb end) with ordinality as entry(value, position)
        cross join lateral (select public.icepack_hosted_recipe(entry.value -> 'action', '[]'::jsonb) as reward_id) recipe
    ) steps
    where matches = 1 and jsonb_typeof(kit -> 'id') = 'string' and char_length(kit ->> 'id') between 1 and 120
        and steps.step_count between 2 and 4 and steps.distinct_count = steps.step_count and steps.creatures <= 1
        and steps.ids <> array['rose-stone','wild-dodo']::text[]
$$;

create function public.icepack_reward_allowed(p_policy text, p_rewards text[], p_reward text, p_kit_rewards text[])
returns boolean language sql immutable set search_path = '' as $$
    select coalesce(p_reward = any(effective.ids) and (
        p_reward <> 'custom-kit' or (p_kit_rewards is not null and p_kit_rewards <@ effective.ids)
    ), false)
    from (select public.icepack_effective_rewards(p_policy, p_rewards) as ids) effective
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
                            d.kit_name as "kitName", d.kit_reward_ids as "kitRewardIds",
                            coalesce(cardinality(d.kit_reward_ids), case when d.reward_id = 'starter-kit' then 2 else 1 end) as "totalCommands",
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
        'savedKits', coalesce((
            select jsonb_agg(jsonb_build_object('id', kit.kit_id, 'name', kit.kit_name, 'rewardIds', kit.reward_ids, 'revision', draft.revision)
                order by kit.kit_name, kit.kit_id)
            from public.companion_drafts draft
            cross join lateral public.icepack_saved_hosted_kits(draft.draft -> 'kits') kit
            where draft.user_id = p_actor and exists (
                select 1 from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
                where a.streamer_id = p_actor and a.state = 'approved'
                  and public.icepack_reward_allowed(s.reward_policy, s.allowed_reward_ids, 'custom-kit', kit.reward_ids)
            )
        ), '[]'::jsonb),
        'results', coalesce((
            select jsonb_agg(results order by results.name)
            from (select s.id, s.name from public.icepack_relay_servers s where s.listed and s.owner_id <> p_actor
                and char_length(p_search) >= 2 and strpos(lower(s.name), lower(p_search)) > 0
                order by s.name limit 20) as results
        ), '[]'::jsonb)
    )
$$;

create function public.icepack_relay_reward_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text,
    p_kit_rewards text[], p_kit_name text, p_kit_revision uuid
)
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
    if not public.icepack_reward_allowed(server.reward_policy, server.allowed_reward_ids, p_reward, p_kit_rewards) then
        return jsonb_build_object('error', 'The owner whitelist does not allow this reward.', 'status', 403);
    end if;
    select * into access from public.icepack_relay_access where server_id = p_server and streamer_id = p_actor;
    if access.state is distinct from 'approved' then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    select * into previous from public.icepack_relay_deliveries
        where server_id = p_server and streamer_id = p_actor and request_id = p_request;
    if p_phase in ('dispatch','continue') and p_reward = 'custom-kit'
       and (previous.kit_draft_revision is distinct from p_kit_revision
            or previous.kit_reward_ids is distinct from p_kit_rewards) then
        return jsonb_build_object('error', 'The saved Kit changed during delivery.', 'status', 409);
    end if;
    if p_phase = 'continue' then
        if p_reward not in ('starter-kit','custom-kit') or previous.reward_id is distinct from p_reward or previous.state is distinct from 'sending'
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
    insert into public.icepack_relay_deliveries (
        server_id, streamer_id, request_id, state, reward_id, survivor_at_reserve,
        kit_reward_ids, kit_name, kit_draft_revision
    ) values (
        p_server, p_actor, p_request, 'pending', p_reward, access.survivor_id,
        p_kit_rewards, p_kit_name, p_kit_revision
    );
    return jsonb_build_object('envelope', (select envelope from public.icepack_relay_vault where server_id = p_server),
        'kitRewardIds', p_kit_rewards, 'kitName', p_kit_name);
end;
$$;

create or replace function public.icepack_relay_catalog_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text)
returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, p_reward, null, null, null)
$$;

-- Select the plan from the signed-in streamer's saved draft on every delivery phase.
create function public.icepack_relay_saved_kit_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_kit_id text, p_revision uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.companion_drafts;
declare kit record;
begin
    -- Use the same lock order as live delivery and owner policy changes.
    perform 1 from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    select * into saved from public.companion_drafts where user_id = p_actor and revision = p_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Kits changed. Refresh access and select the Kit again.', 'status', 409); end if;
    select * into kit from public.icepack_saved_hosted_kits(saved.draft -> 'kits') where kit_id = p_kit_id;
    if not found then return jsonb_build_object('error', 'Save a supported custom Kit to your Northpath account first.', 'status', 409); end if;
    return public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, 'custom-kit',
        kit.reward_ids, kit.kit_name, saved.revision);
end;
$$;

create or replace function public.icepack_relay_finish_catalog(
    p_actor uuid, p_server uuid, p_request uuid, p_reward text, p_state text, p_acknowledged integer
) returns void language sql security definer set search_path = '' as $$
    update public.icepack_relay_deliveries set state = p_state, acknowledged_commands = p_acknowledged
    where server_id = p_server and streamer_id = p_actor and request_id = p_request and reward_id = p_reward
        and p_acknowledged between 0 and coalesce(cardinality(kit_reward_ids),
            case when p_reward = 'starter-kit' then 2 else 1 end)
        and (p_state <> 'acknowledged' or p_acknowledged = coalesce(cardinality(kit_reward_ids),
            case when p_reward = 'starter-kit' then 2 else 1 end))
        and ((state = 'pending' and p_state = 'cancelled') or
             (state in ('sending','unconfirmed') and p_state in ('acknowledged','unconfirmed')))
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
            and not public.icepack_reward_allowed(p_policy, p_rewards, reward_id, kit_reward_ids);
        update public.icepack_relay_deliveries
            set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
            where server_id = p_server and not public.icepack_reward_allowed(p_policy, p_rewards, reward_id, kit_reward_ids)
                and (state = 'pending' or (reward_id in ('starter-kit','custom-kit') and state = 'sending'));
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.stop_icepack_relay_kit_on_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if old.state is distinct from new.state or old.survivor_id is distinct from new.survivor_id then
        update public.icepack_relay_deliveries set state = 'unconfirmed'
            where server_id = old.server_id and streamer_id = old.streamer_id
                and reward_id in ('starter-kit','custom-kit') and state = 'sending';
    end if;
    return new;
end;
$$;

create function public.icepack_hosted_gift_recipes(p_draft jsonb)
returns table (gift_id text, reward_id text, kit_rewards text[], kit_name text) language sql immutable set search_path = '' as $$
    with kits as materialized (select * from public.icepack_saved_hosted_kits(p_draft -> 'kits'))
    select rule ->> 'giftId',
        case when kit.kit_id is not null then 'custom-kit'
            else public.icepack_hosted_recipe(rule -> 'action', p_draft -> 'kits') end,
        kit.reward_ids, kit.kit_name
    from jsonb_array_elements(case when jsonb_typeof(p_draft -> 'rules') = 'array' then p_draft -> 'rules' else '[]'::jsonb end) rule
    left join kits kit on kit.kit_id = rule -> 'action' ->> 'kitId'
        and rule -> 'action' ->> 'type' = 'kit' and rule -> 'action' ->> 'announcement' = ''
    where rule -> 'enabled' = 'true'::jsonb and jsonb_typeof(rule -> 'giftId') = 'string'
      and rule ->> 'giftId' ~ '^[1-9][0-9]{0,19}$'
$$;

create or replace function public.icepack_hosted_draft_rules(p_draft jsonb)
returns table (gift_id text, reward_id text) language sql immutable set search_path = '' as $$
    select recipes.gift_id, recipes.reward_id from public.icepack_hosted_gift_recipes(p_draft) recipes
$$;

create or replace function public.authorize_companion_draft_gift(
    p_device_secret text, p_server uuid, p_survivor text, p_gift text, p_token_hash text, p_event_hash text
) returns text language plpgsql security definer set search_path = '' as $$
declare device public.companion_devices;
declare server public.icepack_relay_servers;
declare saved public.companion_drafts;
declare recipe record;
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
                and (state = 'pending' or (reward_id in ('starter-kit','custom-kit') and state = 'sending'));
        return 'stopped';
    end if;
    if not exists (select 1 from public.icepack_relay_access where server_id = p_server
        and streamer_id = device.user_id and state = 'approved' and survivor_id = p_survivor)
    then return 'stopped'; end if;
    if p_gift is null or p_gift !~ '^[1-9][0-9]{0,19}$' or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
       or p_event_hash is null or p_event_hash !~ '^[0-9a-f]{64}$' then return 'ignored'; end if;
    select * into saved from public.companion_drafts where user_id = device.user_id;
    if not found then return 'ignored'; end if;

    select r.reward_id, r.kit_rewards, r.kit_name into recipe from (
        select recipes.*, count(*) over () as matches
        from public.icepack_hosted_gift_recipes(saved.draft) recipes where gift_id = p_gift
    ) r where r.matches = 1;
    if not found or not public.icepack_reward_allowed(server.reward_policy, server.allowed_reward_ids, recipe.reward_id, recipe.kit_rewards)
    then return 'ignored'; end if;

    insert into public.companion_relay_tests (
        token_hash, pairing_hash, server_id, streamer_id, survivor_id, request_id,
        source, draft_revision, reward_id, kit_reward_ids, kit_name
    ) values (
        p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor, substr(p_event_hash, 1, 32)::uuid,
        'live_draft', saved.revision, recipe.reward_id, recipe.kit_rewards, recipe.kit_name
    )
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at, source = excluded.source,
        draft_revision = excluded.draft_revision, reward_id = excluded.reward_id,
        kit_reward_ids = excluded.kit_reward_ids, kit_name = excluded.kit_name;
    return 'ready';
end;
$$;

create function public.icepack_relay_hosted_gift_delivery(p_token_hash text, p_owner uuid, p_phase text, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare arm public.companion_relay_tests;
declare result jsonb;
begin
    select * into arm from public.companion_relay_tests where token_hash = p_token_hash and source = 'live_draft';
    if not found or (p_phase <> 'reserve' and arm.request_id is distinct from p_request) then
        return jsonb_build_object('error', 'Gift authorization changed or expired.', 'status', 403);
    end if;
    perform 1 from public.companion_devices
        where user_id = arm.streamer_id and pairing_hash = arm.pairing_hash for share;
    if not found then return jsonb_build_object('error', 'Pair Companion with Northpath again.', 'status', 403); end if;
    perform 1 from public.icepack_relay_servers where id = arm.server_id and owner_id = p_owner for update;
    if not found or not exists (select 1 from public.companion_relay_tests t
        where t.token_hash = p_token_hash and t is not distinct from arm and t.expires_at > clock_timestamp())
       or not exists (select 1 from public.icepack_relay_access where server_id = arm.server_id
        and streamer_id = arm.streamer_id and state = 'approved' and survivor_id = arm.survivor_id)
    then return jsonb_build_object('error', 'Gift approval changed or expired.', 'status', 403); end if;
    perform 1 from public.companion_drafts where user_id = arm.streamer_id and revision = arm.draft_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Gift Rules changed during delivery.', 'status', 409); end if;
    if arm.reward_id = 'custom-kit' then
        result := public.icepack_relay_reward_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id,
            arm.kit_reward_ids, arm.kit_name, arm.draft_revision);
    else
        result := public.icepack_relay_catalog_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id);
    end if;
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = 'live_draft'
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id, 'rewardId', arm.reward_id);
    end if;
    return result;
end;
$$;

revoke execute on function public.icepack_saved_hosted_kits(jsonb), public.icepack_reward_allowed(text,text[],text,text[]),
    public.icepack_relay_reward_delivery(uuid,uuid,uuid,text,text,text[],text,uuid),
    public.icepack_relay_saved_kit_delivery(uuid,uuid,uuid,text,text,uuid),
    public.icepack_hosted_gift_recipes(jsonb), public.icepack_relay_hosted_gift_delivery(text,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.icepack_relay_saved_kit_delivery(uuid,uuid,uuid,text,text,uuid),
    public.icepack_relay_hosted_gift_delivery(text,uuid,text,uuid) to service_role;

commit;
