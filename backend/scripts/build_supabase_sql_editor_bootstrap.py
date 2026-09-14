"""Build a clean SQL Editor bootstrap from the historical PostgreSQL export.

Only table definitions, migration history, indexes, and foreign keys are copied.
Application rows (including users, sessions, and simulation logs) are excluded.
Run from any working directory with Python 3.10+.
"""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "database/postgresql/plant_simulation_game_supabase.sql"
TARGET = ROOT / "database/postgresql/sql-editor/01_schema_baseline.sql"


def section(text: str, start: str, end: str) -> str:
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError(f"Expected one section boundary: {start!r} / {end!r}")
    return text.split(start, 1)[1].split(end, 1)[0].strip()


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(
            "Historical dump not found (it is intentionally gitignored). "
            "New contributors should use the committed 01_schema_baseline.sql file; "
            "this generator is only for maintainers with a trusted local dump."
        )
    source = SOURCE.read_text(encoding="utf-8")
    tables = section(source, "-- Tables\n", "-- Data\n")
    indexes = section(source, "-- Primary, unique and secondary indexes\n", "-- Foreign keys\n")
    foreign_keys = section(source, "-- Foreign keys\n", "-- Restore the exact next AUTO_INCREMENT values from MariaDB\n")
    migration_match = re.search(
        r'INSERT INTO public\."migrations" \("id", "migration", "batch"\) VALUES\n.*?;',
        source,
        flags=re.DOTALL,
    )
    if not migration_match:
        raise ValueError("Could not find the baseline Laravel migration history")

    output = "\n\n".join(
        [
            """-- Step 1: clean baseline for a NEW, EMPTY Supabase project.
-- Paste this entire file into Supabase > SQL Editor > New query, then Run.
-- Do not run on a project that already has application tables in public.
-- Generated from the historical PostgreSQL export; no user or activity rows.
-- New contributors need only this committed file, not the ignored old dump.
-- Maintainers with a trusted local dump can regenerate it with
-- python backend/scripts/build_supabase_sql_editor_bootstrap.py
BEGIN;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL standard_conforming_strings = on;
SET LOCAL lock_timeout = '10s';""",
            "-- Baseline tables\n" + tables,
            "-- Mark only migrations already represented by these baseline tables.\n"
            + migration_match.group(0),
            "-- Baseline primary keys and indexes\n" + indexes,
            "-- Baseline foreign keys\n" + foreign_keys,
            """-- Keep the migration identity above the imported baseline rows.
SELECT setval(
    pg_get_serial_sequence('public.migrations', 'id'),
    (SELECT MAX(id) FROM public.migrations),
    true
);

COMMIT;""",
        ]
    ) + "\n"

    if re.search(r'INSERT INTO public\."(?!migrations")', output):
        raise ValueError("Bootstrap unexpectedly contains application data")
    if len(re.findall(r'^CREATE TABLE public\.', output, flags=re.MULTILINE)) != 42:
        raise ValueError("Bootstrap does not contain the expected 42 baseline tables")

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(output, encoding="utf-8", newline="\n")
    print(f"Wrote {TARGET} ({len(output.encode('utf-8')):,} bytes)")


if __name__ == "__main__":
    main()
