-- Read-only verification for plant_simulation_game_supabase.sql
-- Every row should report status = OK.

WITH counts AS (
    SELECT 'achievements' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."achievements" UNION ALL
    SELECT 'admin_activity_logs' AS table_name, 20::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."admin_activity_logs" UNION ALL
    SELECT 'cache' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."cache" UNION ALL
    SELECT 'cache_locks' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."cache_locks" UNION ALL
    SELECT 'comments' AS table_name, 7::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."comments" UNION ALL
    SELECT 'comment_likes' AS table_name, 6::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."comment_likes" UNION ALL
    SELECT 'contents' AS table_name, 4::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."contents" UNION ALL
    SELECT 'daily_logins' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."daily_logins" UNION ALL
    SELECT 'friends' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."friends" UNION ALL
    SELECT 'friendships' AS table_name, 2::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."friendships" UNION ALL
    SELECT 'friend_requests' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."friend_requests" UNION ALL
    SELECT 'items' AS table_name, 4::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."items" UNION ALL
    SELECT 'item_usages' AS table_name, 40::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."item_usages" UNION ALL
    SELECT 'leaderboards' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."leaderboards" UNION ALL
    SELECT 'migrations' AS table_name, 22::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."migrations" UNION ALL
    SELECT 'model_assets' AS table_name, 4::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."model_assets" UNION ALL
    SELECT 'password_reset_otps' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."password_reset_otps" UNION ALL
    SELECT 'pests' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."pests" UNION ALL
    SELECT 'pest_condition_rules' AS table_name, 6::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."pest_condition_rules" UNION ALL
    SELECT 'pest_treatments' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."pest_treatments" UNION ALL
    SELECT 'plants' AS table_name, 1::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."plants" UNION ALL
    SELECT 'plant_condition_rules' AS table_name, 7::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."plant_condition_rules" UNION ALL
    SELECT 'plant_growth_stages' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."plant_growth_stages" UNION ALL
    SELECT 'plant_histories' AS table_name, 7::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."plant_histories" UNION ALL
    SELECT 'plant_visual_variants' AS table_name, 8::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."plant_visual_variants" UNION ALL
    SELECT 'posts' AS table_name, 6::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."posts" UNION ALL
    SELECT 'post_likes' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."post_likes" UNION ALL
    SELECT 'quests' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."quests" UNION ALL
    SELECT 'seasons' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."seasons" UNION ALL
    SELECT 'season_events' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."season_events" UNION ALL
    SELECT 'sessions' AS table_name, 1::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."sessions" UNION ALL
    SELECT 'shop_items' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."shop_items" UNION ALL
    SELECT 'simulation_logs' AS table_name, 18087::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."simulation_logs" UNION ALL
    SELECT 'simulation_pests' AS table_name, 4::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."simulation_pests" UNION ALL
    SELECT 'simulators' AS table_name, 55::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."simulators" UNION ALL
    SELECT 'simulator_comments' AS table_name, 3::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."simulator_comments" UNION ALL
    SELECT 'social_notifications' AS table_name, 1::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."social_notifications" UNION ALL
    SELECT 'users' AS table_name, 6::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."users" UNION ALL
    SELECT 'user_achievements' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."user_achievements" UNION ALL
    SELECT 'user_items' AS table_name, 24::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."user_items" UNION ALL
    SELECT 'user_quests' AS table_name, 0::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."user_quests" UNION ALL
    SELECT 'wallet_transactions' AS table_name, 5::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM public."wallet_transactions"
)
SELECT table_name, expected_rows, actual_rows,
       CASE WHEN expected_rows = actual_rows THEN 'OK' ELSE 'MISMATCH' END AS status
FROM counts
ORDER BY table_name;

SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions')) AS actual_tables,
    42 AS expected_tables,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions')) AS actual_columns,
    418 AS expected_columns,
    (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND c.contype = 'p') AS actual_primary_keys,
    42 AS expected_primary_keys,
    (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND c.contype = 'f') AS actual_foreign_keys,
    53 AS expected_foreign_keys,
    (SELECT COUNT(*) FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND i.indisunique AND NOT i.indisprimary) AS actual_unique_non_primary_indexes,
    20 AS expected_unique_non_primary_indexes,
    (SELECT COUNT(*) FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND NOT i.indisunique) AS actual_secondary_indexes,
    69 AS expected_secondary_indexes,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND is_identity = 'YES') AS actual_identity_columns,
    39 AS expected_identity_columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND data_type = 'jsonb') AS actual_jsonb_columns,
    5 AS expected_jsonb_columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND data_type = 'boolean') AS actual_boolean_columns,
    10 AS expected_boolean_columns,
    (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ('achievements', 'admin_activity_logs', 'cache', 'cache_locks', 'comments', 'comment_likes', 'contents', 'daily_logins', 'friends', 'friendships', 'friend_requests', 'items', 'item_usages', 'leaderboards', 'migrations', 'model_assets', 'password_reset_otps', 'pests', 'pest_condition_rules', 'pest_treatments', 'plants', 'plant_condition_rules', 'plant_growth_stages', 'plant_histories', 'plant_visual_variants', 'posts', 'post_likes', 'quests', 'seasons', 'season_events', 'sessions', 'shop_items', 'simulation_logs', 'simulation_pests', 'simulators', 'simulator_comments', 'social_notifications', 'users', 'user_achievements', 'user_items', 'user_quests', 'wallet_transactions') AND c.contype = 'c') AS actual_check_constraints,
    183 AS expected_check_constraints;

WITH sequences AS (
    SELECT 'achievements' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."achievements_id_seq" UNION ALL
    SELECT 'admin_activity_logs' AS table_name, 21::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."admin_activity_logs_id_seq" UNION ALL
    SELECT 'comments' AS table_name, 8::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."comments_id_seq" UNION ALL
    SELECT 'comment_likes' AS table_name, 7::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."comment_likes_id_seq" UNION ALL
    SELECT 'contents' AS table_name, 6::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."contents_id_seq" UNION ALL
    SELECT 'daily_logins' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."daily_logins_id_seq" UNION ALL
    SELECT 'friends' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."friends_id_seq" UNION ALL
    SELECT 'friendships' AS table_name, 3::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."friendships_id_seq" UNION ALL
    SELECT 'friend_requests' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."friend_requests_id_seq" UNION ALL
    SELECT 'items' AS table_name, 7::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."items_id_seq" UNION ALL
    SELECT 'item_usages' AS table_name, 42::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."item_usages_id_seq" UNION ALL
    SELECT 'leaderboards' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."leaderboards_id_seq" UNION ALL
    SELECT 'migrations' AS table_name, 23::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."migrations_id_seq" UNION ALL
    SELECT 'model_assets' AS table_name, 6::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."model_assets_id_seq" UNION ALL
    SELECT 'password_reset_otps' AS table_name, 5::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."password_reset_otps_id_seq" UNION ALL
    SELECT 'pests' AS table_name, 4::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."pests_id_seq" UNION ALL
    SELECT 'pest_condition_rules' AS table_name, 13::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."pest_condition_rules_id_seq" UNION ALL
    SELECT 'pest_treatments' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."pest_treatments_id_seq" UNION ALL
    SELECT 'plants' AS table_name, 2::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."plants_id_seq" UNION ALL
    SELECT 'plant_condition_rules' AS table_name, 15::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."plant_condition_rules_id_seq" UNION ALL
    SELECT 'plant_growth_stages' AS table_name, 4::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."plant_growth_stages_id_seq" UNION ALL
    SELECT 'plant_histories' AS table_name, 12::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."plant_histories_id_seq" UNION ALL
    SELECT 'plant_visual_variants' AS table_name, 17::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."plant_visual_variants_id_seq" UNION ALL
    SELECT 'posts' AS table_name, 7::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."posts_id_seq" UNION ALL
    SELECT 'post_likes' AS table_name, 15::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."post_likes_id_seq" UNION ALL
    SELECT 'quests' AS table_name, 2::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."quests_id_seq" UNION ALL
    SELECT 'seasons' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."seasons_id_seq" UNION ALL
    SELECT 'season_events' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."season_events_id_seq" UNION ALL
    SELECT 'shop_items' AS table_name, 7::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."shop_items_id_seq" UNION ALL
    SELECT 'simulation_logs' AS table_name, 18154::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."simulation_logs_id_seq" UNION ALL
    SELECT 'simulation_pests' AS table_name, 13::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."simulation_pests_id_seq" UNION ALL
    SELECT 'simulators' AS table_name, 63::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."simulators_id_seq" UNION ALL
    SELECT 'simulator_comments' AS table_name, 6::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."simulator_comments_id_seq" UNION ALL
    SELECT 'social_notifications' AS table_name, 3::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."social_notifications_id_seq" UNION ALL
    SELECT 'users' AS table_name, 19::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."users_id_seq" UNION ALL
    SELECT 'user_achievements' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."user_achievements_id_seq" UNION ALL
    SELECT 'user_items' AS table_name, 73::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."user_items_id_seq" UNION ALL
    SELECT 'user_quests' AS table_name, 1::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."user_quests_id_seq" UNION ALL
    SELECT 'wallet_transactions' AS table_name, 6::bigint AS expected_next_value, (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value FROM public."wallet_transactions_id_seq"
)
SELECT table_name, expected_next_value, actual_next_value,
       CASE WHEN expected_next_value = actual_next_value THEN 'OK' ELSE 'MISMATCH' END AS status
FROM sequences
ORDER BY table_name;
