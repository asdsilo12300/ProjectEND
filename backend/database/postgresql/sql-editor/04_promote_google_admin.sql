-- Optional Step 4: FIRST sign in through the website with your Google account.
-- In Supabase SQL Editor, replace the email below with that SAME account email.
-- Never use someone else's email. This file contains no password or secret.

DO $promote_admin$
DECLARE
    target_email text := 'CHANGE_ME_TO_YOUR_GOOGLE_EMAIL@example.com';
    affected_rows integer;
BEGIN
    IF target_email LIKE 'CHANGE_ME_%' THEN
        RAISE EXCEPTION 'Replace target_email with your Google account email first';
    END IF;

    UPDATE public.users
    SET role = 'admin', updated_at = CURRENT_TIMESTAMP
    WHERE lower(email) = lower(target_email)
      AND google_id IS NOT NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
        RAISE EXCEPTION 'Expected one Google-linked account, found %. Sign in first and check the email.', affected_rows;
    END IF;
END
$promote_admin$;

SELECT COUNT(*) AS google_admin_accounts
FROM public.users
WHERE role = 'admin' AND google_id IS NOT NULL;
