-- Phase 3 task 8 — "start from someone else's map" provenance.
--
-- Option A of phase-3-design.md section 5.3, locked by Thomas in
-- docs/hosting/decisions.md ("Amendments — 2026-08-18, after the phase 3 design
-- review"): two columns on users, deliberately NOT a marker line in the
-- markdown, so theology-map.md's file format stays untouched and render.py /
-- editor-core.js need no lockstep parser change.
--
-- Both columns are cleared by api/map.py's save the first time the copier's
-- markdown differs from what they copied. "Started from Sarah's map" is
-- therefore only ever shown about an unedited copy.

alter table public.users
    add column copied_from uuid references public.users(id) on delete set null,
    add column copied_at   timestamptz;

-- on delete set null: if the source account is deleted the attribution quietly
-- disappears rather than the copy going with it. Noted as the accepted cost of
-- Option A in the design.
