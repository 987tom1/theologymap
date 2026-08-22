-- Phase 1a — the one table the hosted app needs.
-- One map per user, per hosting-brief.md. No maps table, no versioning.

create extension if not exists pgcrypto;

create table public.users (
    id         uuid        primary key default gen_random_uuid(),
    name       text        not null,
    pin        text        not null,
    markdown   text        not null default '',
    is_admin   boolean     not null default false,
    is_public  boolean     not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Names are the login identifier, so they must be unique, and
-- "thomas" must collide with "Thomas".
create unique index users_name_lower_key on public.users (lower(name));

-- The gallery's only query: public rows, most recently edited first.
create index users_gallery_idx on public.users (updated_at desc) where is_public;

-- Cheap sanity rails. Not security — security is out of scope per the brief.
alter table public.users add constraint users_name_len
    check (char_length(name) between 1 and 60);
alter table public.users add constraint users_pin_len
    check (char_length(pin) between 4 and 12);
alter table public.users add constraint users_markdown_len
    check (char_length(markdown) <= 524288);   -- 512 KB; Thomas's own map is 27 KB

-- updated_at is the optimistic-concurrency token for autosave (design §8),
-- so it must be maintained by the database, never by the caller.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger users_touch_updated_at
    before update on public.users
    for each row execute function public.touch_updated_at();

-- Row-level security ON with NO policies. Under PostgREST this means the
-- anon and authenticated roles can read and write exactly nothing. All access
-- goes through the serverless functions in api/, which use the service-role
-- key and bypass RLS by design. See design §2 for why.
alter table public.users enable row level security;
