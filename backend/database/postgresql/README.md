# PostgreSQL / Supabase database files

This directory contains the converted PostgreSQL dump and the verification SQL used to prepare this Laravel project for Supabase.

## Files

- `plant_simulation_game_supabase.sql` — PostgreSQL-compatible schema and data export.
- `verify_supabase_import.sql` — read-only checks for tables, row counts, foreign keys, sequences, and important application data.
- `supabase_laravel_api_lockdown.sql` — optional database hardening when Laravel is the only public API.
- `conversion_manifest.json` — conversion metadata and row-count summary.

## Import safely

1. Create or reset the destination Supabase project.
2. Copy the Session Pooler connection details from **Supabase Dashboard > Connect**.
3. Put the connection values in a local environment variable or an untracked `.env` file. Never commit a database password or service-role key.
4. Run the import from PowerShell:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "C:\ProjectEND\backend\database\postgresql\plant_simulation_game_supabase.sql"
```

5. Run the verification script:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "C:\ProjectEND\backend\database\postgresql\verify_supabase_import.sql"
```

6. Run Laravel migrations so newer application changes, including soft-delete columns, are applied:

```powershell
php artisan migrate --force
```

## Laravel configuration

Use `.env.supabase.example` locally or `.env.render.example` for deployment. Keep all real credentials in local `.env` files or Render secrets. For deployed model and media uploads, configure a public Supabase Storage bucket and set `MEDIA_DRIVER=supabase`.

## Security note

This repository must contain placeholders only. If a real database password or Supabase service-role key was ever committed, rotate it in Supabase immediately and remove it from the repository history before sharing the repository.

## Media files

The SQL dump stores only media references. Model bundles, textures, images, and other uploaded files must also be copied to the configured storage provider. Do not write directly to Supabase's internal `storage` schema; use the Storage API.
