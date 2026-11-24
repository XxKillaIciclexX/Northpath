begin;

create table public.icepack_relay_servers (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null unique references auth.users on delete cascade,
    name text not null check (char_length(name) between 2 and 60),
    listed boolean not null,
    hourly_limit integer not null check (hourly_limit between 1 and 10)
);
create table public.icepack_relay_vault (
    server_id uuid primary key references public.icepack_relay_servers on delete cascade,
    envelope text not null
);
create table public.icepack_relay_access (
    server_id uuid references public.icepack_relay_servers on delete cascade,
    streamer_id uuid references auth.users on delete cascade,
    survivor_id text not null check (survivor_id ~ '^[1-9][0-9]{0,9}$' and survivor_id::bigint <= 4294967295),
    state text not null check (state in ('requested', 'approved', 'revoked')),
    primary key (server_id, streamer_id)
);
create table public.icepack_relay_deliveries (
    server_id uuid references public.icepack_relay_servers on delete cascade,
    streamer_id uuid not null,
    request_id uuid not null,
    created_at timestamptz not null default clock_timestamp(),
    state text not null check (state in ('pending','sending','cancelled','unconfirmed','acknowledged')),
    primary key (server_id, streamer_id, request_id)
);
create index icepack_relay_delivery_history on public.icepack_relay_deliveries (server_id, created_at desc);

alter table public.icepack_relay_servers enable row level security;
alter table public.icepack_relay_vault enable row level security;
alter table public.icepack_relay_access enable row level security;
alter table public.icepack_relay_deliveries enable row level security;
revoke all on public.icepack_relay_servers, public.icepack_relay_vault,
    public.icepack_relay_access, public.icepack_relay_deliveries from public, anon, authenticated, service_role;

create function public.icepack_relay_dashboard(p_actor uuid, p_search text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'owned', (
            select jsonb_build_object('id', s.id, 'name', s.name, 'listed', s.listed, 'hourlyLimit', s.hourly_limit,
                'access', coalesce((
                    select jsonb_agg(jsonb_build_object('streamerId', a.streamer_id, 'survivorId', a.survivor_id,
                        'state', a.state, 'email', u.email) order by a.state, u.email)
                    from public.icepack_relay_access a join auth.users u on u.id = a.streamer_id
                    where a.server_id = s.id
                ), '[]'::jsonb),
                'history', coalesce((
                    select jsonb_agg(history order by history."createdAt" desc)
                    from (select d.request_id as "requestId", d.created_at as "createdAt", d.state,
                            coalesce(u.email, 'Former streamer') as streamer
                        from public.icepack_relay_deliveries d left join auth.users u on u.id = d.streamer_id
                        where d.server_id = s.id order by d.created_at desc limit 20) as history
                ), '[]'::jsonb))
            from public.icepack_relay_servers s where s.owner_id = p_actor
        ),
        'linked', coalesce((
            select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'state', a.state, 'survivorId', a.survivor_id) order by s.name)
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

create function public.icepack_relay_register(p_actor uuid, p_name text, p_listed boolean, p_limit integer, p_envelope text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare server uuid;
begin
    insert into public.icepack_relay_servers (owner_id, name, listed, hourly_limit)
        values (p_actor, p_name, p_listed, p_limit) returning id into server;
    insert into public.icepack_relay_vault (server_id, envelope) values (server, p_envelope);
    return jsonb_build_object('ok', true, 'id', server);
exception when unique_violation then
    return jsonb_build_object('error', 'This account already owns a relay server.', 'status', 409);
end;
$$;

create function public.icepack_relay_manage(p_actor uuid, p_server uuid, p_action text, p_streamer uuid, p_value text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare server public.icepack_relay_servers;
begin
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    if p_action = 'request' then
        if server.owner_id = p_actor then
            return jsonb_build_object('error', 'Use a separate streamer account for the relay test.', 'status', 400);
        end if;
        -- An unlisted server can be joined from its owner-provided ID.
        insert into public.icepack_relay_access as a (server_id, streamer_id, survivor_id, state)
            values (p_server, p_actor, p_value, 'requested')
        on conflict (server_id, streamer_id) do update set survivor_id = excluded.survivor_id, state = 'requested'
            where a.state <> 'approved' or a.survivor_id is distinct from excluded.survivor_id;
        if found then
            update public.icepack_relay_deliveries set state = 'cancelled'
                where server_id = p_server and streamer_id = p_actor and state = 'pending';
        end if;
    elsif server.owner_id <> p_actor then
        return jsonb_build_object('error', 'Server owner access is required.', 'status', 403);
    elsif p_action = 'limit' then
        update public.icepack_relay_servers set hourly_limit = p_value::integer where id = p_server;
    elsif p_action in ('approve', 'revoke') then
        update public.icepack_relay_access set state = case p_action when 'approve' then 'approved' else 'revoked' end
          where server_id = p_server and streamer_id = p_streamer
            and (p_action = 'revoke' or (state = 'requested' and survivor_id = p_value));
        if not found then return jsonb_build_object('error', 'The access request changed. Refresh and review it again.', 'status', 409); end if;
        if p_action = 'revoke' then
            update public.icepack_relay_deliveries set state = 'cancelled'
                where server_id = p_server and streamer_id = p_streamer and state = 'pending';
        end if;
    else
        return jsonb_build_object('error', 'Unknown action.', 'status', 400);
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

create function public.icepack_relay_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare server public.icepack_relay_servers;
declare access public.icepack_relay_access;
declare previous text;
begin
    -- All admission, approval and revocation decisions use this same per-server lock.
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
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
        return jsonb_build_object('error', 'Wait 15 seconds between server tests.', 'status', 429);
    end if;
    if (select count(*) from public.icepack_relay_deliveries where server_id = p_server
        and created_at > clock_timestamp() - interval '1 hour') >= server.hourly_limit then
        return jsonb_build_object('error', 'This server reached its hourly test limit.', 'status', 429);
    end if;
    insert into public.icepack_relay_deliveries (server_id, streamer_id, request_id, state)
        values (p_server, p_actor, p_request, 'pending');
    return jsonb_build_object('envelope', (select envelope from public.icepack_relay_vault where server_id = p_server));
end;
$$;

create function public.icepack_relay_finish(p_actor uuid, p_server uuid, p_request uuid, p_state text)
returns void language sql security definer set search_path = '' as $$
    update public.icepack_relay_deliveries set state = p_state
    where server_id = p_server and streamer_id = p_actor and request_id = p_request
        and ((state = 'pending' and p_state = 'cancelled') or
             (state = 'sending' and p_state in ('acknowledged', 'unconfirmed')))
$$;

revoke execute on function public.icepack_relay_dashboard(uuid,text),
    public.icepack_relay_register(uuid,text,boolean,integer,text),
    public.icepack_relay_manage(uuid,uuid,text,uuid,text),
    public.icepack_relay_delivery(uuid,uuid,uuid,text),
    public.icepack_relay_finish(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.icepack_relay_dashboard(uuid,text),
    public.icepack_relay_register(uuid,text,boolean,integer,text),
    public.icepack_relay_manage(uuid,uuid,text,uuid,text),
    public.icepack_relay_delivery(uuid,uuid,uuid,text),
    public.icepack_relay_finish(uuid,uuid,uuid,text) to service_role;

commit;
