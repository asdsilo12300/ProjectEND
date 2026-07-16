-- Optional Supabase-only hardening for a Laravel-owned API architecture.
-- Do not run this file if the frontend must query these tables through
-- Supabase Data API. Laravel's postgres owner connection remains unaffected.

BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;

DO $lockdown$
DECLARE
    app_table text;
BEGIN
    FOREACH app_table IN ARRAY ARRAY[
        'achievements', 'admin_activity_logs', 'cache', 'cache_locks',
        'comments', 'comment_likes', 'contents', 'daily_logins', 'friends',
        'friendships', 'friend_requests', 'items', 'item_usages',
        'leaderboards', 'migrations', 'model_assets', 'password_reset_otps',
        'pests', 'pest_condition_rules', 'pest_treatments', 'plants',
        'plant_condition_rules', 'plant_growth_stages', 'plant_histories',
        'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons',
        'season_events', 'sessions', 'shop_items', 'simulation_logs',
        'simulation_pests', 'simulators', 'simulator_comments',
        'social_notifications', 'users', 'user_achievements', 'user_items',
        'user_quests', 'wallet_transactions'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    END LOOP;
END
$lockdown$;

COMMIT;
