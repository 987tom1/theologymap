-- Verify that 20260818120000_users.sql actually landed.
--
-- Migrations deploy themselves: the Supabase<->GitHub integration watches
-- supabase/migrations/ and applies new files on push to the production branch.
-- "Committed" is therefore not the same as "applied" - a push can fail, or the
-- ledger can drift. Run this in the Supabase SQL editor before building on the
-- schema.
--
-- Read it as: all twelve OK means the migration applied cleanly. Checks 10 and
-- 12 are Supabase defaults (RLS on, pgcrypto present) and pass almost anywhere,
-- so checks 2-9 are the discriminating ones. Run it against the WRONG project
-- and check 1 can still say OK if that database has its own users table -
-- checks 2-9 are what catch the mistake.
--
-- Catalogue queries never error on a missing object, so this returns a readable
-- pass/fail table rather than aborting on the first absent column. Copy the
-- pattern for later migrations (phase 3 adds copied_from / copied_at).

select check_name, result from (values

  ('1. users table exists',
    (case when to_regclass('public.users') is null
          then 'MISSING - migration has NOT been applied'
          else 'OK' end)::text),

  ('2. all 8 expected columns present',
    (select case when count(*) = 8 then 'OK (8/8)'
                 else 'WRONG: ' || count(*) || ' of 8' end
       from information_schema.columns
      where table_schema = 'public' and table_name = 'users'
        and column_name in ('id','name','pin','markdown',
                            'is_admin','is_public','created_at','updated_at'))),

  ('3. is_public defaults to true',
    coalesce((select case when column_default like 'true%' then 'OK'
                          else 'WRONG: ' || coalesce(column_default,'no default') end
       from information_schema.columns
      where table_schema='public' and table_name='users'
        and column_name='is_public'), 'column missing')),

  ('4. is_admin defaults to false',
    coalesce((select case when column_default like 'false%' then 'OK'
                          else 'WRONG: ' || coalesce(column_default,'no default') end
       from information_schema.columns
      where table_schema='public' and table_name='users'
        and column_name='is_admin'), 'column missing')),

  ('5. unique index on lower(name)',
    coalesce((select 'OK' from pg_indexes
      where schemaname='public' and tablename='users'
        and indexname='users_name_lower_key'), 'MISSING')),

  ('6. partial gallery index',
    coalesce((select 'OK' from pg_indexes
      where schemaname='public' and tablename='users'
        and indexname='users_gallery_idx'), 'MISSING')),

  ('7. three length check constraints',
    (select case when count(*) = 3 then 'OK (3/3)'
                 else 'WRONG: ' || count(*) || ' of 3' end
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='users' and c.contype='c'
        and c.conname in ('users_name_len','users_pin_len','users_markdown_len'))),

  ('8. touch_updated_at() function',
    coalesce((select 'OK' from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='touch_updated_at'), 'MISSING')),

  ('9. users_touch_updated_at trigger',
    coalesce((select 'OK' from pg_trigger g
       join pg_class t on t.oid = g.tgrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='users'
        and g.tgname='users_touch_updated_at' and not g.tgisinternal), 'MISSING')),

  ('10. RLS enabled',
    coalesce((select case when c.relrowsecurity then 'OK' else 'NOT ENABLED' end
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname='users'), 'table missing')),

  ('11. policy count (must be 0)',
    (select case when count(*) = 0 then 'OK (0)'
                 else 'UNEXPECTED: ' || count(*) end
       from pg_policies where schemaname='public' and tablename='users')),

  ('12. pgcrypto extension',
    coalesce((select 'OK' from pg_extension where extname='pgcrypto'), 'MISSING'))

) as t(check_name, result);


-- Confirm the GitHub integration recorded the migration in its ledger:
--
--   select version, name
--   from supabase_migrations.schema_migrations
--   order by version desc
--   limit 10;
--
-- 20260818120000 should appear. If the table exists but that row does not, the
-- schema and the ledger have diverged - worth fixing before another migration
-- lands on top.
