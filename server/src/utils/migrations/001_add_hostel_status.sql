-- Adds an approval-gate status to HOSTEL. Previously any HOSTEL_MANAGER
-- (including one who just self-registered with zero verification) could
-- create a hostel and have it appear in public listings immediately, with
-- no admin review step — despite the admin frontend already having a
-- "review queue" concept for pending hostels that the backend never
-- actually implemented.
--
-- Run this once against your existing Supabase/Postgres database (this
-- repo has no migration runner — apply manually, e.g. via the Supabase
-- SQL editor). supabase_schema.sql has also been updated so a *fresh*
-- database created from scratch includes this from the start.

DO $$ BEGIN
    CREATE TYPE hostel_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "HOSTEL" ADD COLUMN IF NOT EXISTS status hostel_status NOT NULL DEFAULT 'PENDING';

-- Existing hostels predate this concept — approve them so nothing already
-- live suddenly disappears from listings. Review this default for your
-- situation before running (e.g. you may prefer they start PENDING too).
UPDATE "HOSTEL" SET status = 'APPROVED' WHERE status = 'PENDING';
