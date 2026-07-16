#!/usr/bin/env python3
"""Convert a phpMyAdmin MariaDB dump into portable PostgreSQL SQL.

The converter is intentionally dependency-free. It parses MySQL string literals
instead of applying regex replacements, so JSON, HTML, Unicode and escaped
characters survive the conversion unchanged.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Sequence


JSON_COLUMNS = {
    ("contents", "references"),
    ("model_assets", "metadata"),
    ("plant_histories", "game_state"),
    ("simulation_logs", "visual_overrides"),
    ("simulators", "visual_overrides"),
}


@dataclass(frozen=True)
class SqlValue:
    kind: str
    value: str | None


@dataclass
class Column:
    name: str
    mysql_type: str
    pg_type: str
    nullable: bool
    default: str | None
    unsigned: bool = False
    boolean: bool = False
    jsonb: bool = False
    enum_values: list[str] = field(default_factory=list)
    identity: bool = False


@dataclass
class Table:
    name: str
    columns: list[Column]

    @property
    def by_name(self) -> dict[str, Column]:
        return {column.name: column for column in self.columns}


@dataclass(frozen=True)
class Index:
    table: str
    name: str
    columns: tuple[str, ...]
    kind: str  # primary, unique, index


@dataclass(frozen=True)
class ForeignKey:
    table: str
    name: str
    columns: tuple[str, ...]
    referenced_table: str
    referenced_columns: tuple[str, ...]
    on_delete: str | None
    on_update: str | None


def quote_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def qualified_table(value: str) -> str:
    return f'public.{quote_ident(value)}'


def pg_string(value: str) -> str:
    if "\x00" in value:
        raise ValueError("PostgreSQL text cannot store a NUL byte")
    return "'" + value.replace("'", "''") + "'"


def strip_sql_comments_and_split(text: str) -> list[str]:
    """Split statements while removing comments outside quoted values."""
    statements: list[str] = []
    current: list[str] = []
    i = 0
    state = "normal"

    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if state == "normal":
            if char == "'":
                current.append(char)
                state = "single"
                i += 1
                continue
            if char == '"':
                current.append(char)
                state = "double"
                i += 1
                continue
            if char == "`":
                current.append(char)
                state = "backtick"
                i += 1
                continue
            if char == "#":
                state = "line_comment"
                i += 1
                continue
            if char == "-" and nxt == "-" and (i + 2 >= len(text) or text[i + 2].isspace()):
                state = "line_comment"
                i += 2
                continue
            if char == "/" and nxt == "*":
                state = "block_comment"
                i += 2
                continue
            if char == ";":
                statement = "".join(current).strip()
                if statement:
                    statements.append(statement)
                current = []
                i += 1
                continue
            current.append(char)
            i += 1
            continue

        if state == "line_comment":
            if char in "\r\n":
                current.append("\n")
                state = "normal"
            i += 1
            continue

        if state == "block_comment":
            if char == "*" and nxt == "/":
                state = "normal"
                current.append("\n")
                i += 2
            else:
                i += 1
            continue

        current.append(char)
        if state in {"single", "double"} and char == "\\":
            if i + 1 < len(text):
                current.append(text[i + 1])
                i += 2
                continue
        if state == "single" and char == "'":
            if nxt == "'":
                current.append(nxt)
                i += 2
                continue
            state = "normal"
        elif state == "double" and char == '"':
            if nxt == '"':
                current.append(nxt)
                i += 2
                continue
            state = "normal"
        elif state == "backtick" and char == "`":
            if nxt == "`":
                current.append(nxt)
                i += 2
                continue
            state = "normal"
        i += 1

    trailing = "".join(current).strip()
    if trailing:
        statements.append(trailing)
    if state not in {"normal", "line_comment"}:
        raise ValueError(f"Unterminated SQL construct: {state}")
    return statements


def split_top_level(value: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    i = 0
    state = "normal"
    while i < len(value):
        char = value[i]
        nxt = value[i + 1] if i + 1 < len(value) else ""
        if state == "normal":
            if char == "'":
                state = "single"
            elif char == '"':
                state = "double"
            elif char == "`":
                state = "backtick"
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            elif char == "," and depth == 0:
                parts.append(value[start:i].strip())
                start = i + 1
            i += 1
            continue
        if state in {"single", "double"} and char == "\\":
            i += 2
            continue
        if state == "single" and char == "'":
            if nxt == "'":
                i += 2
                continue
            state = "normal"
        elif state == "double" and char == '"':
            if nxt == '"':
                i += 2
                continue
            state = "normal"
        elif state == "backtick" and char == "`":
            state = "normal"
        i += 1
    parts.append(value[start:].strip())
    return [part for part in parts if part]


def parse_mysql_string(text: str, start: int = 0) -> tuple[str, int]:
    if start >= len(text) or text[start] != "'":
        raise ValueError("Expected a MySQL string literal")
    result: list[str] = []
    i = start + 1
    escapes = {
        "0": "\x00",
        "b": "\b",
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "Z": "\x1a",
        "\\": "\\",
        "'": "'",
        '"': '"',
    }
    while i < len(text):
        char = text[i]
        if char == "\\":
            if i + 1 >= len(text):
                raise ValueError("Trailing backslash in MySQL string")
            escaped = text[i + 1]
            if escaped in {"%", "_"}:
                result.append("\\" + escaped)
            else:
                result.append(escapes.get(escaped, escaped))
            i += 2
            continue
        if char == "'":
            if i + 1 < len(text) and text[i + 1] == "'":
                result.append("'")
                i += 2
                continue
            return "".join(result), i + 1
        result.append(char)
        i += 1
    raise ValueError("Unterminated MySQL string literal")


def parse_insert_rows(values: str) -> Iterator[list[SqlValue]]:
    i = 0
    length = len(values)
    while True:
        while i < length and (values[i].isspace() or values[i] == ","):
            i += 1
        if i >= length:
            return
        if values[i] != "(":
            raise ValueError(f"Expected '(' at values offset {i}: {values[i:i+30]!r}")
        i += 1
        row: list[SqlValue] = []
        while True:
            while i < length and values[i].isspace():
                i += 1
            if i >= length:
                raise ValueError("Unterminated INSERT tuple")
            if values[i] == "'":
                decoded, i = parse_mysql_string(values, i)
                row.append(SqlValue("string", decoded))
            else:
                start = i
                while i < length and values[i] not in ",)":
                    i += 1
                raw = values[start:i].strip()
                if not raw:
                    raise ValueError(f"Empty INSERT value at offset {start}")
                row.append(SqlValue("null" if raw.upper() == "NULL" else "raw", None if raw.upper() == "NULL" else raw))
            while i < length and values[i].isspace():
                i += 1
            if i >= length:
                raise ValueError("Unterminated INSERT tuple")
            if values[i] == ",":
                i += 1
                continue
            if values[i] == ")":
                i += 1
                yield row
                break
            raise ValueError(f"Expected ',' or ')' at values offset {i}")


def default_to_postgres(raw: str | None, column: Column) -> str | None:
    if raw is None or raw.upper() == "NULL":
        return None
    if raw.lower() == "current_timestamp()":
        return "CURRENT_TIMESTAMP"
    if raw.startswith("'"):
        value, end = parse_mysql_string(raw, 0)
        if end != len(raw):
            raise ValueError(f"Unexpected text after default string: {raw!r}")
        if column.boolean:
            return "TRUE" if value not in {"", "0"} else "FALSE"
        return pg_string(value)
    if column.boolean:
        if raw == "1":
            return "TRUE"
        if raw == "0":
            return "FALSE"
        raise ValueError(f"Unsupported boolean default: {raw}")
    return raw


def parse_enum_values(mysql_type: str) -> list[str]:
    inner = mysql_type[mysql_type.index("(") + 1 : -1]
    values: list[str] = []
    for token in split_top_level(inner):
        decoded, end = parse_mysql_string(token, 0)
        if end != len(token):
            raise ValueError(f"Invalid ENUM value: {token}")
        values.append(decoded)
    return values


TYPE_PATTERN = re.compile(
    r"^(enum\((?:[^'\\]|\\.|'(?:\\.|[^'])*')*\)|"
    r"(?:bigint|int|tinyint|smallint)\(\d+\)|decimal\(\d+\s*,\s*\d+\)|"
    r"varchar\(\d+\)|mediumtext|longtext|text|datetime|timestamp|date)(?=\s|$)",
    re.IGNORECASE | re.DOTALL,
)


def parse_column(table: str, definition: str, identity_tables: set[str]) -> Column:
    match = re.match(r"^`([^`]+)`\s+(.+)$", definition, re.DOTALL)
    if not match:
        raise ValueError(f"Unsupported column definition in {table}: {definition}")
    name, remainder = match.groups()
    type_match = TYPE_PATTERN.match(remainder.strip())
    if not type_match:
        raise ValueError(f"Unsupported MySQL type in {table}.{name}: {remainder}")
    mysql_type = type_match.group(1)
    options = remainder.strip()[type_match.end() :]
    lower_type = mysql_type.lower()
    unsigned = bool(re.search(r"\bUNSIGNED\b", options, re.IGNORECASE))
    boolean = lower_type == "tinyint(1)"
    jsonb = (table, name) in JSON_COLUMNS
    enum_values = parse_enum_values(mysql_type) if lower_type.startswith("enum(") else []

    if jsonb:
        pg_type = "jsonb"
    elif enum_values:
        pg_type = "text"
    elif lower_type.startswith("bigint"):
        pg_type = "bigint"
    elif lower_type.startswith("tinyint(1)"):
        pg_type = "boolean"
    elif lower_type.startswith("tinyint") or lower_type.startswith("smallint"):
        pg_type = "smallint"
    elif lower_type.startswith("int"):
        pg_type = "integer"
    elif lower_type.startswith("decimal"):
        pg_type = re.sub(r"^decimal", "numeric", lower_type)
    elif lower_type.startswith("varchar"):
        pg_type = lower_type
    elif lower_type in {"mediumtext", "longtext", "text"}:
        pg_type = "text"
    elif lower_type in {"datetime", "timestamp"}:
        pg_type = "timestamp without time zone"
    elif lower_type == "date":
        pg_type = "date"
    else:
        raise ValueError(f"No PostgreSQL mapping for {table}.{name}: {mysql_type}")

    nullable = not bool(re.search(r"\bNOT\s+NULL\b", options, re.IGNORECASE))
    default_match = re.search(
        r"\bDEFAULT\s+(current_timestamp\(\)|NULL|'(?:\\.|''|[^'])*'|-?\d+(?:\.\d+)?)",
        options,
        re.IGNORECASE | re.DOTALL,
    )
    identity = table in identity_tables and name == "id"
    column = Column(
        name=name,
        mysql_type=mysql_type,
        pg_type=pg_type,
        nullable=nullable,
        default=None,
        unsigned=unsigned,
        boolean=boolean,
        jsonb=jsonb,
        enum_values=enum_values,
        identity=identity,
    )
    column.default = default_to_postgres(default_match.group(1) if default_match else None, column)
    return column


def render_column(column: Column) -> str:
    parts = [quote_ident(column.name), column.pg_type]
    if column.identity:
        parts.append("GENERATED BY DEFAULT AS IDENTITY")
    if not column.nullable:
        parts.append("NOT NULL")
    if column.default is not None and not column.identity:
        parts.extend(["DEFAULT", column.default])
    if column.enum_values:
        allowed = ", ".join(pg_string(value) for value in column.enum_values)
        parts.append(f"CHECK ({quote_ident(column.name)} IN ({allowed}))")
    if column.unsigned and not column.boolean:
        parts.append(f"CHECK ({quote_ident(column.name)} >= 0)")
    return " ".join(parts)


def parse_ident_list(value: str) -> tuple[str, ...]:
    return tuple(re.findall(r"`([^`]+)`(?:\(\d+\))?", value))


def parse_auto_increments(alters: Sequence[str]) -> dict[str, int]:
    identities: dict[str, int] = {}
    for statement in alters:
        table_match = re.match(r"ALTER\s+TABLE\s+`([^`]+)`\s+(.+)$", statement, re.IGNORECASE | re.DOTALL)
        if not table_match or not re.search(r"\bAUTO_INCREMENT\b", statement, re.IGNORECASE):
            continue
        table, body = table_match.groups()
        modify = re.search(r"\bMODIFY\s+`id`\s+.+?\bAUTO_INCREMENT\b", body, re.IGNORECASE | re.DOTALL)
        if not modify:
            raise ValueError(f"Unsupported AUTO_INCREMENT statement: {statement[:200]}")
        next_match = re.search(r"\bAUTO_INCREMENT\s*=\s*(\d+)", body, re.IGNORECASE)
        identities[table] = int(next_match.group(1)) if next_match else 1
    return identities


def parse_tables(create_statements: Sequence[str], identities: dict[str, int]) -> list[Table]:
    tables: list[Table] = []
    identity_tables = set(identities)
    for statement in create_statements:
        match = re.match(
            r"CREATE\s+TABLE\s+`([^`]+)`\s*\((.*)\)\s*ENGINE\s*=.+$",
            statement,
            re.IGNORECASE | re.DOTALL,
        )
        if not match:
            raise ValueError(f"Unsupported CREATE TABLE statement: {statement[:200]}")
        name, body = match.groups()
        definitions = split_top_level(body)
        columns = [parse_column(name, definition, identity_tables) for definition in definitions]
        tables.append(Table(name=name, columns=columns))
    return tables


def parse_indexes(alters: Sequence[str]) -> list[Index]:
    indexes: list[Index] = []
    for statement in alters:
        table_match = re.match(r"ALTER\s+TABLE\s+`([^`]+)`\s+(.+)$", statement, re.IGNORECASE | re.DOTALL)
        if not table_match or "ADD" not in table_match.group(2).upper():
            continue
        table, body = table_match.groups()
        for clause in split_top_level(body):
            primary = re.match(r"ADD\s+PRIMARY\s+KEY\s*\((.+)\)$", clause, re.IGNORECASE | re.DOTALL)
            unique = re.match(r"ADD\s+UNIQUE\s+KEY\s+`([^`]+)`\s*\((.+)\)$", clause, re.IGNORECASE | re.DOTALL)
            ordinary = re.match(r"ADD\s+KEY\s+`([^`]+)`\s*\((.+)\)$", clause, re.IGNORECASE | re.DOTALL)
            if primary:
                indexes.append(Index(table, f"{table}_pkey", parse_ident_list(primary.group(1)), "primary"))
            elif unique:
                indexes.append(Index(table, unique.group(1), parse_ident_list(unique.group(2)), "unique"))
            elif ordinary:
                indexes.append(Index(table, ordinary.group(1), parse_ident_list(ordinary.group(2)), "index"))
    return indexes


def parse_foreign_keys(alters: Sequence[str]) -> list[ForeignKey]:
    foreign_keys: list[ForeignKey] = []
    pattern = re.compile(
        r"ADD\s+CONSTRAINT\s+`([^`]+)`\s+FOREIGN\s+KEY\s*\((.+?)\)\s+"
        r"REFERENCES\s+`([^`]+)`\s*\((.+?)\)"
        r"(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?"
        r"(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?$",
        re.IGNORECASE | re.DOTALL,
    )
    for statement in alters:
        table_match = re.match(r"ALTER\s+TABLE\s+`([^`]+)`\s+(.+)$", statement, re.IGNORECASE | re.DOTALL)
        if not table_match or "FOREIGN KEY" not in table_match.group(2).upper():
            continue
        table, body = table_match.groups()
        for clause in split_top_level(body):
            match = pattern.match(clause)
            if not match:
                raise ValueError(f"Unsupported foreign key clause: {clause}")
            name, columns, referenced_table, referenced_columns, on_delete, on_update = match.groups()
            foreign_keys.append(
                ForeignKey(
                    table=table,
                    name=name,
                    columns=parse_ident_list(columns),
                    referenced_table=referenced_table,
                    referenced_columns=parse_ident_list(referenced_columns),
                    on_delete=re.sub(r"\s+", " ", on_delete.upper()) if on_delete else None,
                    on_update=re.sub(r"\s+", " ", on_update.upper()) if on_update else None,
                )
            )
    return foreign_keys


def render_value(value: SqlValue, column: Column) -> str:
    if value.kind == "null":
        return "NULL"
    if column.boolean:
        normalized = value.value.strip().lower() if value.value is not None else ""
        if normalized in {"1", "true"}:
            return "TRUE"
        if normalized in {"0", "false"}:
            return "FALSE"
        raise ValueError(f"Invalid boolean value for {column.name}: {value.value!r}")
    if value.kind == "string":
        rendered = pg_string(value.value or "")
        return rendered + "::jsonb" if column.jsonb else rendered
    if value.kind == "raw":
        return value.value or "NULL"
    raise ValueError(f"Unknown SQL value kind: {value.kind}")


def convert_insert(statement: str, tables: dict[str, Table]) -> tuple[str, str, int]:
    match = re.match(
        r"INSERT\s+INTO\s+`([^`]+)`\s*\((.*?)\)\s*VALUES\s*(.+)$",
        statement,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        raise ValueError(f"Unsupported INSERT statement: {statement[:200]}")
    table_name, raw_columns, raw_values = match.groups()
    columns = list(parse_ident_list(raw_columns))
    table = tables[table_name]
    metadata = table.by_name
    missing = [name for name in columns if name not in metadata]
    if missing:
        raise ValueError(f"INSERT into {table_name} references missing columns: {missing}")

    rendered_rows: list[str] = []
    for row in parse_insert_rows(raw_values):
        if len(row) != len(columns):
            raise ValueError(f"Tuple/column mismatch in {table_name}: {len(row)} != {len(columns)}")
        rendered = ", ".join(render_value(value, metadata[column]) for value, column in zip(row, columns))
        rendered_rows.append(f"({rendered})")
    column_sql = ", ".join(quote_ident(column) for column in columns)
    sql = f"INSERT INTO {qualified_table(table_name)} ({column_sql}) VALUES\n" + ",\n".join(rendered_rows) + ";"
    return table_name, sql, len(rendered_rows)


def render_index(index: Index) -> str:
    columns = ", ".join(quote_ident(column) for column in index.columns)
    if index.kind == "primary":
        return (
            f"ALTER TABLE {qualified_table(index.table)} ADD CONSTRAINT {quote_ident(index.name)} "
            f"PRIMARY KEY ({columns});"
        )
    unique = "UNIQUE " if index.kind == "unique" else ""
    return f"CREATE {unique}INDEX {quote_ident(index.name)} ON {qualified_table(index.table)} ({columns});"


def render_foreign_key(key: ForeignKey) -> str:
    columns = ", ".join(quote_ident(column) for column in key.columns)
    referenced = ", ".join(quote_ident(column) for column in key.referenced_columns)
    sql = (
        f"ALTER TABLE {qualified_table(key.table)} ADD CONSTRAINT {quote_ident(key.name)} "
        f"FOREIGN KEY ({columns}) REFERENCES {qualified_table(key.referenced_table)} ({referenced})"
    )
    if key.on_delete:
        sql += f" ON DELETE {key.on_delete}"
    if key.on_update:
        sql += f" ON UPDATE {key.on_update}"
    return sql + ";"


def write_verification_sql(
    path: Path,
    row_counts: dict[str, int],
    identities: dict[str, int],
    expected_counts: dict[str, int],
) -> None:
    row_selects = [
        f"SELECT {pg_string(table)} AS table_name, {expected}::bigint AS expected_rows, COUNT(*)::bigint AS actual_rows FROM {qualified_table(table)}"
        for table, expected in row_counts.items()
    ]
    sequence_selects = []
    for table, next_value in identities.items():
        sequence_name = quote_ident(f"{table}_id_seq")
        sequence_selects.append(
            f"SELECT {pg_string(table)} AS table_name, {next_value}::bigint AS expected_next_value, "
            f"(last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::bigint AS actual_next_value "
            f"FROM public.{sequence_name}"
        )
    sql = f"""-- Read-only verification for plant_simulation_game_supabase.sql
-- Every row should report status = OK.

WITH counts AS (
    {(' UNION ALL' + chr(10) + '    ').join(row_selects)}
)
SELECT table_name, expected_rows, actual_rows,
       CASE WHEN expected_rows = actual_rows THEN 'OK' ELSE 'MISMATCH' END AS status
FROM counts
ORDER BY table_name;

SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name IN ({', '.join(pg_string(name) for name in row_counts)})) AS actual_tables,
    {expected_counts['tables']} AS expected_tables,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ({', '.join(pg_string(name) for name in row_counts)})) AS actual_columns,
    {expected_counts['columns']} AS expected_columns,
    (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ({', '.join(pg_string(name) for name in row_counts)}) AND c.contype = 'p') AS actual_primary_keys,
    {expected_counts['primary_keys']} AS expected_primary_keys,
    (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ({', '.join(pg_string(name) for name in row_counts)}) AND c.contype = 'f') AS actual_foreign_keys,
    {expected_counts['foreign_keys']} AS expected_foreign_keys,
    (SELECT COUNT(*) FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ({', '.join(pg_string(name) for name in row_counts)}) AND i.indisunique AND NOT i.indisprimary) AS actual_unique_non_primary_indexes,
    {expected_counts['unique_indexes_from_source'] + expected_counts['compatibility_indexes']} AS expected_unique_non_primary_indexes,
    (SELECT COUNT(*) FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ({', '.join(pg_string(name) for name in row_counts)}) AND NOT i.indisunique) AS actual_secondary_indexes,
    {expected_counts['secondary_indexes']} AS expected_secondary_indexes,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ({', '.join(pg_string(name) for name in row_counts)}) AND is_identity = 'YES') AS actual_identity_columns,
    {expected_counts['identity_sequences']} AS expected_identity_columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ({', '.join(pg_string(name) for name in row_counts)}) AND data_type = 'jsonb') AS actual_jsonb_columns,
    {expected_counts['jsonb_columns']} AS expected_jsonb_columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ({', '.join(pg_string(name) for name in row_counts)}) AND data_type = 'boolean') AS actual_boolean_columns,
    {expected_counts['boolean_columns']} AS expected_boolean_columns,
    (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname IN ({', '.join(pg_string(name) for name in row_counts)}) AND c.contype = 'c') AS actual_check_constraints,
    {expected_counts['check_constraints']} AS expected_check_constraints;

WITH sequences AS (
    {(' UNION ALL' + chr(10) + '    ').join(sequence_selects)}
)
SELECT table_name, expected_next_value, actual_next_value,
       CASE WHEN expected_next_value = actual_next_value THEN 'OK' ELSE 'MISMATCH' END AS status
FROM sequences
ORDER BY table_name;
"""
    path.write_text(sql, encoding="utf-8", newline="\n")


def convert(input_path: Path, output_dir: Path) -> dict[str, object]:
    source_bytes = input_path.read_bytes()
    source_text = source_bytes.decode("utf-8-sig")
    statements = strip_sql_comments_and_split(source_text)
    creates = [statement for statement in statements if re.match(r"^CREATE\s+TABLE\b", statement, re.IGNORECASE)]
    inserts = [statement for statement in statements if re.match(r"^INSERT\s+INTO\b", statement, re.IGNORECASE)]
    alters = [statement for statement in statements if re.match(r"^ALTER\s+TABLE\b", statement, re.IGNORECASE)]

    identities = parse_auto_increments(alters)
    tables = parse_tables(creates, identities)
    table_map = {table.name: table for table in tables}
    indexes = parse_indexes(alters)
    foreign_keys = parse_foreign_keys(alters)

    row_counts = {table.name: 0 for table in tables}
    rendered_inserts: list[str] = []
    for statement in inserts:
        table_name, rendered, count = convert_insert(statement, table_map)
        row_counts[table_name] += count
        rendered_inserts.append(rendered)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "plant_simulation_game_supabase.sql"
    verification_path = output_dir / "verify_supabase_import.sql"
    manifest_path = output_dir / "conversion_manifest.json"

    sql_parts = [
        "-- PostgreSQL/Supabase conversion of the Plant Growth Academy MariaDB dump",
        "-- Generated by backend/scripts/convert_mysql_dump_to_postgres.py",
        "-- Import into an EMPTY public schema. No Supabase-managed schemas or roles are modified.",
        "SET client_encoding = 'UTF8';",
        "SET standard_conforming_strings = on;",
        "SET TIME ZONE 'UTC';",
        "SET lock_timeout = 0;",
        "SET statement_timeout = 0;",
        "BEGIN;",
        "",
        "-- Tables",
    ]
    for table in tables:
        definitions = ",\n".join(f"    {render_column(column)}" for column in table.columns)
        sql_parts.append(f"CREATE TABLE {qualified_table(table.name)} (\n{definitions}\n);")
    sql_parts.extend(["", "-- Data", *rendered_inserts, "", "-- Primary, unique and secondary indexes"])
    sql_parts.extend(render_index(index) for index in indexes)
    sql_parts.append(
        f"CREATE UNIQUE INDEX {quote_ident('uq_users_email_ci')} ON {qualified_table('users')} ((lower({quote_ident('email')})));"
    )
    sql_parts.extend(["", "-- Foreign keys"])
    sql_parts.extend(render_foreign_key(key) for key in foreign_keys)
    sql_parts.extend(["", "-- Restore the exact next AUTO_INCREMENT values from MariaDB"])
    for table, next_value in identities.items():
        sequence = f"pg_get_serial_sequence({pg_string('public.' + table)}, 'id')"
        if next_value <= 1:
            sql_parts.append(f"SELECT setval({sequence}, 1, false);")
        else:
            sql_parts.append(f"SELECT setval({sequence}, {next_value - 1}, true);")
    sql_parts.extend(["", "COMMIT;", ""])
    output_path.write_text("\n".join(sql_parts), encoding="utf-8", newline="\n")

    expected_counts = {
        "tables": len(tables),
        "columns": sum(len(table.columns) for table in tables),
        "rows": sum(row_counts.values()),
        "primary_keys": sum(index.kind == "primary" for index in indexes),
        "unique_indexes_from_source": sum(index.kind == "unique" for index in indexes),
        "secondary_indexes": sum(index.kind == "index" for index in indexes),
        "foreign_keys": len(foreign_keys),
        "identity_sequences": len(identities),
        "enum_columns": sum(bool(column.enum_values) for table in tables for column in table.columns),
        "boolean_columns": sum(column.boolean for table in tables for column in table.columns),
        "jsonb_columns": sum(column.jsonb for table in tables for column in table.columns),
        "unsigned_columns": sum(column.unsigned for table in tables for column in table.columns),
        "check_constraints": sum(
            bool(column.enum_values) + (column.unsigned and not column.boolean)
            for table in tables
            for column in table.columns
        ),
        "compatibility_indexes": 1,
    }
    write_verification_sql(verification_path, row_counts, identities, expected_counts)

    output_bytes = output_path.read_bytes()
    manifest: dict[str, object] = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": {
            "file": input_path.name,
            "bytes": len(source_bytes),
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
            "format": "phpMyAdmin MariaDB/MySQL SQL dump",
        },
        "output": {
            "file": output_path.name,
            "bytes": len(output_bytes),
            "sha256": hashlib.sha256(output_bytes).hexdigest(),
            "format": "PostgreSQL plain SQL (Supabase compatible)",
        },
        "counts": expected_counts,
        "rows_by_table": row_counts,
        "identity_next_values": identities,
        "jsonb_columns": [f"{table}.{column}" for table, column in sorted(JSON_COLUMNS)],
        "intentional_compatibility_changes": [
            "MySQL ENUM columns are PostgreSQL text columns with CHECK constraints.",
            "MySQL UNSIGNED columns have non-negative CHECK constraints.",
            "MySQL tinyint(1) columns are PostgreSQL boolean columns.",
            "Five validated JSON text columns are PostgreSQL jsonb columns.",
            "users.email has an additional unique lower(email) index for case-insensitive login safety.",
            "MySQL ON UPDATE current_timestamp clauses are omitted; Laravel maintains updated_at.",
            "password_reset_otps.expires_at is not auto-updated because expiry is set by application logic.",
        ],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Path to the phpMyAdmin MariaDB dump")
    parser.add_argument("--output-dir", required=True, type=Path, help="Directory for converted SQL and verification files")
    args = parser.parse_args()
    manifest = convert(args.input.resolve(), args.output_dir.resolve())
    print(json.dumps(manifest["counts"], indent=2))
    print(f"Output: {args.output_dir.resolve() / str(manifest['output']['file'])}")


if __name__ == "__main__":
    main()
