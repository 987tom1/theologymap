-- Verify that 20260823170000_map_versions.sql actually landed.
--
-- Same pattern and same reason as verify-users-migration.sql: migrations
-- deploy themselves via the Supabase<->GitHub integration, so "committed" is
-- not "applied". Catalogue queries never error on a missing object, so this
-- returns a readable pass/fail table rather than aborting on the first absence.
--
-- Run it in the Supabase SQL editor. There is also a no-SQL probe that does not
-- need the dashboard, described at the bottom of this file — phase 4 used that
-- one, because no session can reach this database through MCP.

select check_name, result from (values

  ('1. map_versions table exists',
    (case when to_regclass('public.map_versions') is null
          then 'MISSING - migration has NOT been applied'
          else 'OK' end)::text),

  ('2. all 4 expected columns present',
    (select case when count(*) = 4 then 'OK (4/4)'
                 else 'WRONG: ' || count(*) || ' of 4' end
       from information_schema.columns
      where table_schema='public' and table_name='map_versions'
        and column_name in ('id','user_id','markdown','saved_at'))),

  ('3. user_id cascades from users',
    coalesce((select case when c.confdeltype = 'c' then 'OK'
                          else 'WRONG: on delete ' || c.confdeltype end
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='map_versions'
        and c.contype='f'), 'MISSING')),

  ('4. (user_id, saved_at desc) index',
    coalesce((select 'OK' from pg_indexes
      where schemaname='public' and tablename='map_versions'
        and indexname='map_versions_user_idx'), 'MISSING')),

  ('5. RLS enabled',
    coalesce((select case when c.relrowsecurity then 'OK' else 'NOT ENABLED' end
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname='map_versions'), 'table missing')),

  ('6. policy count (must be 0)',
    (select case when count(*) = 0 then 'OK (0)'
                 else 'UNEXPECTED: ' || count(*) end
       from pg_policies where schemaname='public' and tablename='map_versions')),

  ('7. snapshot_map(uuid, boolean) function',
    coalesce((select 'OK' from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='snapshot_map'
        and pg_get_function_identity_arguments(p.oid) = 'uuid, boolean'), 'MISSING')),

  ('8. service_role may execute it',
    coalesce((select case when has_function_privilege('service_role', p.oid, 'EXECUTE')
                          then 'OK' else 'NOT GRANTED' end
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='snapshot_map'), 'function missing')),

  ('9. anon may NOT execute it',
    coalesce((select case when has_function_privilege('anon', p.oid, 'EXECUTE')
                          then 'UNEXPECTED: anon can execute' else 'OK' end
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='snapshot_map'), 'function missing'))

) as t(check_name, result);


-- Confirm the GitHub integration recorded it:
--
--   select version, name from supabase_migrations.schema_migrations
--   order by version desc limit 10;
--
-- 20260823170000 should appear.


-- The no-SQL probe, for a session that cannot reach the dashboard.
--
-- api/_lib.py's snapshot_map() calls POST /rest/v1/rpc/snapshot_map and
-- swallows every failure, deliberately: losing a snapshot must never cost a
-- user their save. That means the route CANNOT tell you whether the migration
-- landed. Probe the RPC directly instead, from a machine that holds the
-- service-role key -- or, without any key at all, use the difference in how
-- PostgREST answers a missing function versus one it can see:
--
--   POST <supabase-url>/rest/v1/rpc/snapshot_map  {"p_user_id": "<uuid>"}
--
--   404 PGRST202  ->  the function does not exist. Migration NOT applied.
--   401 / 403     ->  the function exists; the caller is simply not authorised.
--
-- Phase 4 verified it the second way: see docs/hosting/phase-4-outcome.md.
