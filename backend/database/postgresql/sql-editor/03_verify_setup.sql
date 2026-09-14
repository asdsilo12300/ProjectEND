-- Step 3: read-only checks after the schema, migrations, seeders and security.
-- Every row should say OK. A non-OK row tells you which setup step to revisit.

WITH checks AS (
    SELECT 'Core tables exist' AS check_name,
           CASE WHEN NOT EXISTS (
               SELECT 1 FROM (VALUES
                   ('users'), ('plants'), ('plant_growth_stages'), ('pests'),
                   ('contents'), ('items'), ('shop_items'), ('simulators'),
                   ('plant_histories'), ('issue_reports'), ('simulation_mode_rewards')
               ) AS required(name)
               WHERE to_regclass(format('public.%I', required.name)) IS NULL
           ) THEN 'OK' ELSE 'MISSING TABLE' END AS status
    UNION ALL
    SELECT 'Laravel migration history',
           CASE WHEN to_regclass('public.migrations') IS NOT NULL
                     AND (SELECT COUNT(*) FROM public.migrations) > 22
                THEN 'OK' ELSE 'RUN php artisan migrate' END
    UNION ALL
    SELECT 'Plant reference data',
           CASE WHEN EXISTS (SELECT 1 FROM public.plants)
                THEN 'OK' ELSE 'RUN GameSimulationSeeder' END
    UNION ALL
    SELECT 'Learning content',
           CASE WHEN EXISTS (SELECT 1 FROM public.contents)
                THEN 'OK' ELSE 'RUN LearningContentSeeder' END
    UNION ALL
    SELECT 'Public table RLS',
           CASE WHEN NOT EXISTS (
               SELECT 1
               FROM pg_class AS tables
               JOIN pg_namespace AS namespaces ON namespaces.oid = tables.relnamespace
               WHERE namespaces.nspname = 'public'
                 AND tables.relkind IN ('r', 'p')
                 AND NOT tables.relrowsecurity
           ) THEN 'OK' ELSE 'RUN 02_secure_public_api.sql' END
)
SELECT check_name, status FROM checks ORDER BY check_name;
