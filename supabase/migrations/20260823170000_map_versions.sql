-- Phase 4, task 0 — map_versions: the undo the wizard makes necessary.
--
-- Locked in docs/hosting/decisions.md ("Amendments — 2026-08-23, after the
-- phase 2 review"). The wizard is the first feature that can replace a whole
-- map in one action, and it is the case the four empty-save guards do not
-- cover: `force: true` walks past all of them.
--
-- Shape is fixed by that decision: map_versions(id, user_id, markdown,
-- saved_at). users.markdown stays the head pointer, so the editor, gallery,
-- render route and export are untouched — this table is write-only from the
-- app's point of view until something is built to read it.
--
-- Two rules the decision adds, both from phase 2's latency and autosave
-- findings:
--   * throttle to at most one snapshot per user per hour, BUT always snapshot
--     a `force: true` save. Autosave's 1200 ms debounce would otherwise fill
--     the table with near-identical rows.
--   * retention: keep the last 20 per user.
--
-- Both rules live in the SQL function below rather than in api/*.py, for two
-- reasons: they cannot drift between the two call sites (api/map.py's save and
-- api/admin.py's save_map), and the whole snapshot is one round trip on a path
-- that autosave hits constantly. The function reads users.markdown itself, so
-- the markdown is never sent over the wire a second time.

create table public.map_versions (
    id       uuid        primary key default gen_random_uuid(),
    user_id  uuid        not null references public.users(id) on delete cascade,
    markdown text        not null,
    saved_at timestamptz not null default now()
);

-- The only query shape: this user's snapshots, newest first. Serves the
-- throttle check, the retention prune, and whatever eventually reads them.
create index map_versions_user_idx on public.map_versions (user_id, saved_at desc);

-- Same posture as users: RLS on with NO policies, so the anon key can read and
-- write exactly nothing. Access control lives in api/, not in RLS.
alter table public.map_versions enable row level security;


-- Snapshot the CURRENT stored map for one user, before it is overwritten.
-- Returns true if a row was written, false if it was skipped (nothing stored
-- yet, or throttled). Never raises on the ordinary paths, so a caller can treat
-- a snapshot as best-effort.
create or replace function public.snapshot_map(
    p_user_id uuid,
    p_force   boolean default false
) returns boolean
language plpgsql
as $$
declare
    v_markdown text;
    v_last     timestamptz;
begin
    select markdown into v_markdown from public.users where id = p_user_id;

    -- No user, or nothing stored yet: there is no previous state to preserve.
    if v_markdown is null or v_markdown = '' then
        return false;
    end if;

    select max(saved_at) into v_last
      from public.map_versions
     where user_id = p_user_id;

    -- The throttle, and its one exception.
    if not p_force and v_last is not null and v_last > now() - interval '1 hour' then
        return false;
    end if;

    insert into public.map_versions (user_id, markdown)
    values (p_user_id, v_markdown);

    -- Retention: the newest 20, counting the row just inserted.
    delete from public.map_versions
     where user_id = p_user_id
       and id not in (
             select id from public.map_versions
              where user_id = p_user_id
              order by saved_at desc
              limit 20
           );

    return true;
end;
$$;

-- Only the service role calls this, from api/_lib.py. Postgres grants EXECUTE
-- to PUBLIC by default, and this repo is public, so say who may run it.
revoke all on function public.snapshot_map(uuid, boolean) from public;
grant execute on function public.snapshot_map(uuid, boolean) to service_role;

-- PostgREST caches the schema; a new function is invisible to /rpc until it
-- reloads.
notify pgrst, 'reload schema';
