begin;

create function public.read_paired_companion_draft(p_device_secret text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then
        return jsonb_build_object('paired', false);
    end if;

    select jsonb_build_object('paired', true, 'revision', draft.revision, 'draft', draft.draft)
    into result
    from public.companion_devices as device
    left join public.companion_drafts as draft on draft.user_id = device.user_id
    where device.pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        and device.survivor_configured is not null;

    return coalesce(result, jsonb_build_object('paired', false));
end;
$$;

revoke execute on function public.read_paired_companion_draft(text) from public, anon, authenticated;
grant execute on function public.read_paired_companion_draft(text) to anon;

commit;
