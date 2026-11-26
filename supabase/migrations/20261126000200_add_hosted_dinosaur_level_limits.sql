begin;

alter table public.icepack_relay_servers add column max_dinosaur_levels jsonb not null default '{}'::jsonb;
alter table public.icepack_relay_deliveries add column dinosaur_levels jsonb not null default '{}'::jsonb;
alter table public.companion_relay_tests add column dinosaur_levels jsonb not null default '{}'::jsonb;

create function public.icepack_hosted_dinosaur_ids()
returns text[] language sql immutable set search_path = '' as $$
    select array['wild-dodo','wild-raptor','wild-rex']::text[]
$$;

create function public.icepack_hosted_level_valid(p_value jsonb)
returns boolean language sql immutable set search_path = '' as $$
    select case when jsonb_typeof(p_value) = 'number'
        then p_value::numeric between 1 and 150 and p_value::numeric = trunc(p_value::numeric)
        else false end
$$;

-- An empty map represents level 25 for existing drafts, deliveries, and test clients.
create function public.icepack_hosted_levels_allowed(
    p_caps jsonb, p_reward text, p_kit_rewards text[], p_levels jsonb
) returns boolean language sql immutable set search_path = '' as $$
    select not exists (
        select 1 from unnest(case p_reward when 'starter-kit' then array['wild-dodo']::text[]
            when 'custom-kit' then p_kit_rewards else array[p_reward] end) as rewards(id)
        where p_caps ? id and coalesce((p_levels -> id)::numeric, 25) > (p_caps -> id)::numeric
    )
$$;

create function public.icepack_hosted_recipe_allowed(
    p_policy text, p_rewards text[], p_limits jsonb, p_level_caps jsonb,
    p_reward text, p_kit_rewards text[], p_quantities jsonb, p_levels jsonb
) returns boolean language sql immutable set search_path = '' as $$
    select public.icepack_hosted_recipe_allowed(p_policy, p_rewards, p_limits, p_reward, p_kit_rewards, p_quantities)
        and public.icepack_hosted_levels_allowed(p_level_caps, p_reward, p_kit_rewards, p_levels)
$$;

create function public.icepack_hosted_action_plan(p_action jsonb)
returns table (reward_id text, quantity integer, dinosaur_level integer) language sql immutable set search_path = '' as $$
    select item.reward_id, item.quantity, null::integer
        from public.icepack_hosted_action(p_action) item where p_action ->> 'type' = 'item'
    union all
    select 'wild-' || lower(p_action ->> 'catalogId'), null::integer, (p_action -> 'level')::numeric::integer
    where p_action ->> 'type' = 'dinosaur' and p_action ->> 'catalogId' in ('Dodo','Raptor','Rex')
      and p_action ->> 'announcement' = '' and p_action -> 'quantity' = '1'::jsonb and p_action -> 'tamed' = 'false'::jsonb
      and public.icepack_hosted_level_valid(p_action -> 'level')
$$;

create function public.icepack_hosted_kit_recipes(p_kits jsonb)
returns table (kit_id text, kit_name text, reward_ids text[], item_quantities jsonb, dinosaur_levels jsonb)
language sql immutable set search_path = '' as $$
    with unique_kits as (
        select kit, count(*) over (partition by kit ->> 'id') as matches
        from jsonb_array_elements(case when jsonb_typeof(p_kits) = 'array' then p_kits else '[]'::jsonb end) kit
    )
    select kit ->> 'id',
        coalesce(nullif(left(btrim(kit ->> 'name'), 120), ''), 'Custom Kit'),
        steps.ids, steps.quantities, steps.levels
    from unique_kits
    cross join lateral (
        select array_agg(reward_id order by position) as ids, count(*) as step_count,
            count(distinct reward_id) as distinct_count,
            count(*) filter (where reward_id like 'wild-%') as creatures,
            coalesce(jsonb_object_agg(reward_id, quantity) filter (where reward_id is not null and quantity <> 5), '{}'::jsonb) as quantities,
            coalesce(jsonb_object_agg(reward_id, dinosaur_level)
                filter (where reward_id is not null and dinosaur_level <> 25), '{}'::jsonb) as levels
        from jsonb_array_elements(case when jsonb_typeof(kit -> 'entries') = 'array' then
            case when jsonb_array_length(kit -> 'entries') between 2 and 4 then kit -> 'entries' else '[]'::jsonb end
            else '[]'::jsonb end) with ordinality as entry(value, position)
        left join lateral public.icepack_hosted_action_plan(entry.value -> 'action') recipe on true
    ) steps
    where matches = 1 and jsonb_typeof(kit -> 'id') = 'string' and char_length(kit ->> 'id') between 1 and 120
        and steps.step_count between 2 and 4 and steps.distinct_count = steps.step_count and steps.creatures <= 1
        and (steps.ids <> array['rose-stone','wild-dodo']::text[] or steps.quantities <> '{}'::jsonb or steps.levels <> '{}'::jsonb)
$$;

create function public.icepack_hosted_gift_rewards(p_draft jsonb)
returns table (gift_id text, reward_id text, kit_rewards text[], kit_name text, item_quantities jsonb, dinosaur_levels jsonb) language sql immutable set search_path = '' as $$
    with kits as materialized (select * from public.icepack_hosted_kit_recipes(p_draft -> 'kits'))
    select rule ->> 'giftId',
        case when kit.kit_id is not null then 'custom-kit'
            when rule -> 'action' ->> 'type' = 'kit' then public.icepack_hosted_recipe(rule -> 'action', p_draft -> 'kits')
            else direct.reward_id end,
        kit.reward_ids, kit.kit_name,
        coalesce(kit.item_quantities, case when direct.quantity <> 5 then jsonb_build_object(direct.reward_id, direct.quantity)
            else '{}'::jsonb end),
        coalesce(kit.dinosaur_levels, case when direct.dinosaur_level <> 25
            then jsonb_build_object(direct.reward_id, direct.dinosaur_level) else '{}'::jsonb end)
    from jsonb_array_elements(case when jsonb_typeof(p_draft -> 'rules') = 'array' then p_draft -> 'rules' else '[]'::jsonb end) rule
    left join kits kit on kit.kit_id = rule -> 'action' ->> 'kitId'
        and rule -> 'action' ->> 'type' = 'kit' and rule -> 'action' ->> 'announcement' = ''
    left join lateral public.icepack_hosted_action_plan(rule -> 'action') direct on true
    where rule -> 'enabled' = 'true'::jsonb and jsonb_typeof(rule -> 'giftId') = 'string'
      and rule ->> 'giftId' ~ '^[1-9][0-9]{0,19}$'
$$;

create or replace function public.icepack_hosted_draft_rules(p_draft jsonb)
returns table (gift_id text, reward_id text) language sql immutable set search_path = '' as $$
    select recipes.gift_id, recipes.reward_id from public.icepack_hosted_gift_rewards(p_draft) recipes
$$;

create or replace function public.icepack_relay_dashboard(p_actor uuid, p_search text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'owned', (
            select jsonb_build_object('id', s.id, 'name', s.name, 'listed', s.listed, 'hourlyLimit', s.hourly_limit, 'rewardPolicy', s.reward_policy, 'roseWhitelisted', s.rose_whitelisted,
                'allowedRewardIds', s.allowed_reward_ids, 'maxItemQuantities', s.max_item_quantities, 'maxDinosaurLevels', s.max_dinosaur_levels,
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
                            d.item_quantities as "itemQuantities", d.dinosaur_levels as "dinosaurLevels", d.kit_name as "kitName", d.kit_reward_ids as "kitRewardIds",
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
                'maxItemQuantities', s.max_item_quantities, 'maxDinosaurLevels', s.max_dinosaur_levels,
                'allowedRewardIds', public.icepack_effective_rewards(s.reward_policy, s.allowed_reward_ids)) order by s.name)
            from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
            where a.streamer_id = p_actor
        ), '[]'::jsonb),
        'savedKits', coalesce((
            select jsonb_agg(jsonb_build_object('id', kit.kit_id, 'name', kit.kit_name, 'rewardIds', kit.reward_ids,
                'itemQuantities', kit.item_quantities, 'dinosaurLevels', kit.dinosaur_levels, 'revision', draft.revision)
                order by kit.kit_name, kit.kit_id)
            from public.companion_drafts draft
            cross join lateral public.icepack_hosted_kit_recipes(draft.draft -> 'kits') kit
            where draft.user_id = p_actor and exists (
                select 1 from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
                where a.streamer_id = p_actor and a.state = 'approved'
                  and public.icepack_hosted_recipe_allowed(s.reward_policy, s.allowed_reward_ids, s.max_item_quantities, s.max_dinosaur_levels,
                      'custom-kit', kit.reward_ids, kit.item_quantities, kit.dinosaur_levels)
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
    p_kit_rewards text[], p_kit_name text, p_kit_revision uuid, p_quantities jsonb, p_levels jsonb
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
    if not public.icepack_hosted_quantities_allowed(server.max_item_quantities, p_reward, p_kit_rewards, p_quantities) then
        return jsonb_build_object('error', 'The reward exceeds the server owner’s item quantity limit.', 'status', 403);
    end if;
    if not public.icepack_hosted_levels_allowed(server.max_dinosaur_levels, p_reward, p_kit_rewards, p_levels) then
        return jsonb_build_object('error', 'The reward exceeds the server owner’s dinosaur level limit.', 'status', 403);
    end if;
    select * into access from public.icepack_relay_access where server_id = p_server and streamer_id = p_actor;
    if access.state is distinct from 'approved' then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    select * into previous from public.icepack_relay_deliveries
        where server_id = p_server and streamer_id = p_actor and request_id = p_request;
    if p_phase in ('dispatch','continue') and previous.request_id is not null
       and (previous.item_quantities is distinct from p_quantities
            or previous.dinosaur_levels is distinct from p_levels
            or previous.kit_draft_revision is distinct from p_kit_revision
            or previous.kit_reward_ids is distinct from p_kit_rewards) then
        return jsonb_build_object('error', 'The reward changed during delivery.', 'status', 409);
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
        kit_reward_ids, kit_name, kit_draft_revision, item_quantities, dinosaur_levels
    ) values (
        p_server, p_actor, p_request, 'pending', p_reward, access.survivor_id,
        p_kit_rewards, p_kit_name, p_kit_revision, p_quantities, p_levels
    );
    return jsonb_build_object('envelope', (select envelope from public.icepack_relay_vault where server_id = p_server),
        'kitRewardIds', p_kit_rewards, 'kitName', p_kit_name, 'itemQuantities', p_quantities, 'dinosaurLevels', p_levels);
end;
$$;

create or replace function public.icepack_relay_reward_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text,
    p_kit_rewards text[], p_kit_name text, p_kit_revision uuid, p_quantities jsonb
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, p_reward,
        p_kit_rewards, p_kit_name, p_kit_revision, p_quantities, '{}'::jsonb)
$$;

create function public.icepack_relay_catalog_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text, p_quantity integer, p_level integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare quantities jsonb := '{}'::jsonb;
declare levels jsonb := '{}'::jsonb;
begin
    if p_quantity is not null then
        if (p_reward = any(public.icepack_hosted_item_ids())) is not true or p_quantity not between 1 and 100 then
            return jsonb_build_object('error', 'Choose an item quantity between 1 and 100.', 'status', 400);
        end if;
        if p_quantity <> 5 then quantities := jsonb_build_object(p_reward, p_quantity); end if;
    end if;
    if p_level is not null then
        if (p_reward = any(public.icepack_hosted_dinosaur_ids())) is not true or p_level not between 1 and 150 then
            return jsonb_build_object('error', 'Choose a dinosaur level between 1 and 150.', 'status', 400);
        end if;
        if p_level <> 25 then levels := jsonb_build_object(p_reward, p_level); end if;
    end if;
    return public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, p_reward,
        null, null, null, quantities, levels);
end;
$$;

create or replace function public.icepack_relay_catalog_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text, p_quantity integer
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_catalog_delivery(p_actor, p_server, p_request, p_phase, p_reward, p_quantity, null)
$$;

create function public.icepack_relay_saved_kit_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_kit_id text, p_revision uuid, p_supports_quantities boolean, p_supports_levels boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.companion_drafts;
declare kit record;
begin
    -- Use the same lock order as live delivery and owner policy changes.
    perform 1 from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    select * into saved from public.companion_drafts where user_id = p_actor and revision = p_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Kits changed. Refresh access and select the Kit again.', 'status', 409); end if;
    select * into kit from public.icepack_hosted_kit_recipes(saved.draft -> 'kits') where kit_id = p_kit_id;
    if not found then return jsonb_build_object('error', 'Save a supported custom Kit to your Northpath account first.', 'status', 409); end if;
    if (p_supports_levels is not true and kit.dinosaur_levels <> '{}'::jsonb)
        or (p_supports_quantities is not true and not public.icepack_hosted_legacy_plan('custom-kit', kit.reward_ids, kit.item_quantities)) then
        return jsonb_build_object('error', 'The relay needs an update for this Kit.', 'status', 409);
    end if;
    return public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, 'custom-kit',
        kit.reward_ids, kit.kit_name, saved.revision, kit.item_quantities, kit.dinosaur_levels);
end;
$$;

create or replace function public.icepack_relay_saved_kit_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_kit_id text, p_revision uuid, p_supports_quantities boolean
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_saved_kit_delivery(
        p_actor, p_server, p_request, p_phase, p_kit_id, p_revision, p_supports_quantities, false)
$$;

create function public.icepack_relay_catalog_policy(p_actor uuid, p_server uuid, p_policy text, p_rewards text[], p_limits jsonb, p_level_limits jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_limits jsonb;
declare current_level_limits jsonb;
begin
    if p_policy is null or p_policy not in ('whitelist','all_supported') or p_rewards is null
       or array_position(p_rewards, null) is not null
       or (p_rewards <@ public.icepack_hosted_reward_ids()) is not true
       or cardinality(p_rewards) <> (select count(distinct id) from unnest(p_rewards) id)
    then return jsonb_build_object('error', 'Choose a valid reward whitelist.', 'status', 400); end if;
    if p_limits is not null and jsonb_typeof(p_limits) <> 'object' then
        return jsonb_build_object('error', 'Set valid item quantity limits.', 'status', 400);
    end if;
    if exists (select 1 from jsonb_each(p_limits) as limit_entry(id, quantity)
        where not (id = any(public.icepack_hosted_item_ids())) or not public.icepack_hosted_quantity_valid(quantity)) then
        return jsonb_build_object('error', 'Set valid item quantity limits.', 'status', 400);
    end if;

    if p_level_limits is not null and jsonb_typeof(p_level_limits) <> 'object' then
        return jsonb_build_object('error', 'Set valid dinosaur level limits.', 'status', 400);
    end if;
    if exists (select 1 from jsonb_each(p_level_limits) as limit_entry(id, level)
        where not (id = any(public.icepack_hosted_dinosaur_ids())) or not public.icepack_hosted_level_valid(level)) then
        return jsonb_build_object('error', 'Set valid dinosaur level limits.', 'status', 400);
    end if;

    update public.icepack_relay_servers set reward_policy = p_policy, allowed_reward_ids = p_rewards,
        rose_whitelisted = 'rose-stone' = any(p_rewards),
        max_item_quantities = coalesce(p_limits, max_item_quantities),
        max_dinosaur_levels = coalesce(p_level_limits, max_dinosaur_levels)
        where id = p_server and owner_id = p_actor
        returning max_item_quantities, max_dinosaur_levels into current_limits, current_level_limits;
    if not found then return jsonb_build_object('error', 'Server owner access is required.', 'status', 403); end if;
    if not public.icepack_hosted_recipe_allowed(p_policy, p_rewards, current_limits, 'rose-stone', null, '{}'::jsonb) then
        delete from public.companion_relay_tests where server_id = p_server and source <> 'live_draft';
    end if;
    delete from public.companion_relay_tests where server_id = p_server and source = 'live_draft'
        and not public.icepack_hosted_recipe_allowed(p_policy, p_rewards, current_limits, current_level_limits,
            reward_id, kit_reward_ids, item_quantities, dinosaur_levels);
    update public.icepack_relay_deliveries
        set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
        where server_id = p_server and (state = 'pending' or (reward_id in ('starter-kit','custom-kit') and state = 'sending'))
          and not public.icepack_hosted_recipe_allowed(p_policy, p_rewards, current_limits, current_level_limits,
            reward_id, kit_reward_ids, item_quantities, dinosaur_levels);
    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.icepack_relay_catalog_policy(
    p_actor uuid, p_server uuid, p_policy text, p_rewards text[], p_limits jsonb
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_catalog_policy(p_actor, p_server, p_policy, p_rewards, p_limits, null)
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

    select r.reward_id, r.kit_rewards, r.kit_name, r.item_quantities, r.dinosaur_levels into recipe from (
        select recipes.*, count(*) over () as matches
        from public.icepack_hosted_gift_rewards(saved.draft) recipes where gift_id = p_gift
    ) r where r.matches = 1;
    if not found or not public.icepack_hosted_recipe_allowed(server.reward_policy, server.allowed_reward_ids, server.max_item_quantities, server.max_dinosaur_levels,
        recipe.reward_id, recipe.kit_rewards, recipe.item_quantities, recipe.dinosaur_levels)
    then return 'ignored'; end if;

    insert into public.companion_relay_tests (
        token_hash, pairing_hash, server_id, streamer_id, survivor_id, request_id,
        source, draft_revision, reward_id, kit_reward_ids, kit_name, item_quantities, dinosaur_levels
    ) values (
        p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor, substr(p_event_hash, 1, 32)::uuid,
        'live_draft', saved.revision, recipe.reward_id, recipe.kit_rewards, recipe.kit_name, recipe.item_quantities, recipe.dinosaur_levels
    )
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at, source = excluded.source,
        draft_revision = excluded.draft_revision, reward_id = excluded.reward_id,
        kit_reward_ids = excluded.kit_reward_ids, kit_name = excluded.kit_name, item_quantities = excluded.item_quantities,
        dinosaur_levels = excluded.dinosaur_levels;
    return 'ready';
end;
$$;

create function public.icepack_relay_hosted_gift_delivery(p_token_hash text, p_owner uuid, p_phase text, p_request uuid, p_supports_quantities boolean, p_supports_levels boolean)
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
    if (p_supports_levels is not true and arm.dinosaur_levels <> '{}'::jsonb)
        or (p_supports_quantities is not true and not public.icepack_hosted_legacy_plan(arm.reward_id, arm.kit_reward_ids, arm.item_quantities)) then
        return jsonb_build_object('error', 'The relay needs an update for this reward.', 'status', 409);
    end if;
    result := public.icepack_relay_reward_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id,
        arm.kit_reward_ids, arm.kit_name, case when arm.reward_id = 'custom-kit' then arm.draft_revision end,
        arm.item_quantities, arm.dinosaur_levels);
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = 'live_draft'
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id, 'rewardId', arm.reward_id);
    end if;
    return result;
end;
$$;

create or replace function public.icepack_relay_hosted_gift_delivery(
    p_token_hash text, p_owner uuid, p_phase text, p_request uuid, p_supports_quantities boolean
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_hosted_gift_delivery(p_token_hash, p_owner, p_phase, p_request, p_supports_quantities, false)
$$;

create or replace function public.icepack_relay_draft_delivery(p_token_hash text, p_owner uuid, p_phase text)
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
    if arm.dinosaur_levels <> '{}'::jsonb
        or not public.icepack_hosted_legacy_plan(arm.reward_id, arm.kit_reward_ids, arm.item_quantities) then
        return jsonb_build_object('error', 'The relay needs an update for this reward.', 'status', 409);
    end if;
    result := public.icepack_relay_catalog_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id);
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = 'live_draft'
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id, 'rewardId', arm.reward_id);
    end if;
    return result;
end;
$$;

revoke execute on function public.icepack_hosted_dinosaur_ids(), public.icepack_hosted_level_valid(jsonb),
    public.icepack_hosted_levels_allowed(jsonb,text,text[],jsonb),
    public.icepack_hosted_recipe_allowed(text,text[],jsonb,jsonb,text,text[],jsonb,jsonb),
    public.icepack_hosted_action_plan(jsonb), public.icepack_hosted_kit_recipes(jsonb), public.icepack_hosted_gift_rewards(jsonb),
    public.icepack_relay_reward_delivery(uuid,uuid,uuid,text,text,text[],text,uuid,jsonb,jsonb),
    public.icepack_relay_catalog_delivery(uuid,uuid,uuid,text,text,integer,integer),
    public.icepack_relay_saved_kit_delivery(uuid,uuid,uuid,text,text,uuid,boolean,boolean),
    public.icepack_relay_catalog_policy(uuid,uuid,text,text[],jsonb,jsonb),
    public.icepack_relay_hosted_gift_delivery(text,uuid,text,uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function public.icepack_relay_catalog_delivery(uuid,uuid,uuid,text,text,integer,integer),
    public.icepack_relay_saved_kit_delivery(uuid,uuid,uuid,text,text,uuid,boolean,boolean),
    public.icepack_relay_catalog_policy(uuid,uuid,text,text[],jsonb,jsonb),
    public.icepack_relay_hosted_gift_delivery(text,uuid,text,uuid,boolean,boolean) to service_role;

commit;
