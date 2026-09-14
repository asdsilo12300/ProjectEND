-- Step 2: run AFTER `php artisan migrate` and the reference-data seeders.
-- This project sends all browser requests through Laravel, not Supabase Data API.
-- Use only in a dedicated Supabase project. Re-run after future migrations.
-- Do not use if browser clients need direct anon/authenticated table access.

BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;

DO $secure_public_tables$
DECLARE
    app_table record;
BEGIN
    FOR app_table IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table.tablename);
    END LOOP;
END
$secure_public_tables$;

COMMIT;
