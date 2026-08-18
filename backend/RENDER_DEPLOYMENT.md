# Deploy Laravel API to Render (Google-only authentication)

The repository includes a production Docker image and a root-level `render.yaml` Blueprint. The frontend remains on Vercel; Render runs only the Laravel API. Persistent data and uploaded media remain in Supabase, because Render's local filesystem is ephemeral.

## 1. Prepare accounts

You need:

- This repository pushed to GitHub, GitLab, or Bitbucket.
- A Render account connected to that Git provider.
- The existing Supabase PostgreSQL project and public `plant-media` Storage bucket.
- A Google Cloud OAuth **Web application** client. Google Cloud is used only for Google identity credentials, not for hosting.

No SMTP, Gmail App Password, Resend key, email OTP, registration password, or password-reset configuration is required.

## 2. Prepare secure values

Copy these from the existing local backend `.env` without committing them:

- `APP_KEY` — must be a valid Laravel key such as `base64:...`. Generate one locally with `php artisan key:generate --show` if needed.
- Supabase pooler `DB_HOST`, `DB_USERNAME`, and `DB_PASSWORD` from **Supabase Dashboard > Connect > Session pooler**.
- `SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Do not use the Supabase anon key as `SUPABASE_SECRET_KEY`, and never put any secret in Vercel variables that start with `VITE_`.

## 3. Create the Render Blueprint

1. Open Render Dashboard.
2. Select **New + > Blueprint**.
3. Connect this repository.
4. Render detects `render.yaml` at the repository root and creates `plantgrow-api` in Singapore with the Docker runtime.
5. Enter every value marked `sync: false`:

| Variable | Value |
| --- | --- |
| `APP_KEY` | Existing valid `base64:...` Laravel app key |
| `APP_URL` | `https://plantgrow-api.onrender.com` (use the actual Render URL if Render changes the name) |
| `ASSET_URL` | Same value as `APP_URL` |
| `DB_HOST` | Supabase Session Pooler host |
| `DB_USERNAME` | Usually `postgres.<project-ref>` |
| `DB_PASSWORD` | Supabase database password |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase server-only secret key |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `https://plantgrow-api.onrender.com/api/auth/google/callback` using the actual Render URL |
| `NOMINATIM_USER_AGENT` | `PlantGrowthAcademy/1.0 (contact: your-real-email@example.com)` |

6. Apply the Blueprint and wait for the Docker build.
7. Open `https://<your-render-service>/up`. A successful response confirms the API process is healthy.

The container binds to Render's `PORT` automatically. On the Free plan, `RUN_MIGRATIONS=true` runs idempotent Laravel migrations during startup because Free services do not provide pre-deploy jobs. If you move to a paid plan, set `RUN_MIGRATIONS=false` and configure this Render Pre-deploy Command instead:

```bash
php artisan migrate --force --no-interaction
```

## 4. Configure Google OAuth

Open **Google Cloud Console > APIs & Services > Credentials**, then edit the OAuth 2.0 Web client:

### Authorized JavaScript origins

```text
https://project-end-teal.vercel.app
```

### Authorized redirect URIs

```text
https://plantgrow-api.onrender.com/api/auth/google/callback
```

Use the actual Render hostname in all three places: Google Console, `GOOGLE_REDIRECT_URI`, and `APP_URL`. They must match exactly, including HTTPS and the `/api/auth/google/callback` path.

Google verifies the account email during OAuth. Laravel then creates a new learner profile automatically, or links an existing local account whose email matches the Google email. Existing role, inventory, history, and progress are preserved.

## 5. Point Vercel to Render

In **Vercel > Project > Settings > Environment Variables**, set:

```text
VITE_API_BASE_URL=https://plantgrow-api.onrender.com/api
```

Apply it to Production (and Preview only if desired), then redeploy the frontend. Also verify that Render has:

```text
FRONTEND_URL=https://project-end-teal.vercel.app
CORS_ALLOWED_ORIGINS=https://project-end-teal.vercel.app
```

The OAuth popup callback uses `FRONTEND_URL` as the only allowed `postMessage` target, so an incorrect value causes Google sign-in to appear to finish without logging the frontend in.

## 6. Acceptance checks

1. Visit `/up` on Render.
2. Open the Vercel site in a private browser window.
3. Confirm the auth page contains only **Continue with Google**.
4. Sign in with a new Google account and confirm the learner profile and starter inventory are created.
5. Sign out and use the same Google account again; data must remain unchanged.
6. Use an old account whose email matches Google; it must link without losing role or game data.
7. Upload a profile image and confirm the URL points to Supabase Storage, not the Render filesystem.

## Free plan limitation

Render Free web services spin down after 15 minutes without inbound traffic and can take roughly one minute to wake. Their local filesystem is also ephemeral. This configuration therefore stores OAuth state/cache in PostgreSQL and uploads media to Supabase. For a responsive production login experience, upgrade the API service to a paid Starter instance so it does not sleep.
