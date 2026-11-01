#!/usr/bin/env python3
"""Migration safety policy for a pull request: python3 deploy/ci/check_migrations.py <base-ref>

- Applied migrations are immutable: a file under supabase/migrations that exists on the base may not be
  modified, renamed or deleted (deploys never re-run it, so the change would silently not apply).
- New files are named NNN_description.sql with a number above every file on the base, no duplicates.
- New files must be backward compatible with the release that is still running while they apply (and with
  the release a failed deploy rolls back to). Destructive statements fail the check unless the file
  carries `-- migration-safety: reviewed <reason>` after a deliberate expand/contract plan.
"""
from __future__ import annotations

import re
import subprocess
import sys

DIR = "supabase/migrations/"
NAME = re.compile(r"^\d{3}_[a-z0-9_]+\.sql$")
REVIEWED = re.compile(r"--\s*migration-safety:\s*reviewed\s+\S", re.IGNORECASE)
DESTRUCTIVE = [
    (re.compile(r"\bDROP\s+(TABLE|SCHEMA|TYPE|VIEW|MATERIALIZED\s+VIEW|FUNCTION)\b", re.I), "drops an object"),
    (re.compile(r"\bDROP\s+COLUMN\b", re.I), "drops a column"),
    (re.compile(r"\bTRUNCATE\b", re.I), "truncates data"),
    (re.compile(r"\bRENAME\s+(COLUMN\s+\w+\s+)?TO\b", re.I), "renames (old code still uses the old name)"),
    (re.compile(r"\bALTER\s+COLUMN\s+\w+\s+(SET\s+DATA\s+)?TYPE\b", re.I), "changes a column type"),
    (re.compile(r"\bALTER\s+COLUMN\s+\w+\s+SET\s+NOT\s+NULL\b", re.I), "adds NOT NULL (old code may insert NULL)"),
    (re.compile(r"\bDELETE\s+FROM\s+\w+\s*;", re.I), "deletes every row"),
]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"--[^\n]*", " ", sql)


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/develop"
    merge_base = git("merge-base", base, "HEAD").strip()
    base_files = {p[len(DIR):] for p in git("ls-tree", "-r", "--name-only", merge_base, DIR).split()}
    head_files = {p[len(DIR):] for p in git("ls-tree", "-r", "--name-only", "HEAD", DIR).split()}
    errors: list[str] = []

    for line in git("diff", "--name-status", "-M", merge_base, "HEAD", "--", DIR).splitlines():
        status, *paths = line.split("\t")
        name = paths[0][len(DIR):]
        if status[0] in "MDR" and name in base_files:
            errors.append(f"{name}: already-released migration was {'modified' if status[0] == 'M' else 'deleted or renamed'}; add a new file instead")

    base_max = max((int(n[:3]) for n in base_files if n[:3].isdigit()), default=0)
    numbers: dict[int, list[str]] = {}
    for name in head_files:
        if name[:3].isdigit():
            numbers.setdefault(int(name[:3]), []).append(name)
    for name in sorted(head_files - base_files):
        if not name.endswith(".sql"):
            continue
        if not NAME.match(name):
            errors.append(f"{name}: expected NNN_lowercase_description.sql")
            continue
        if int(name[:3]) <= base_max:
            errors.append(f"{name}: number must be above {base_max:03d} (the highest on {base})")
        if len(numbers.get(int(name[:3]), [])) > 1:
            errors.append(f"{name}: number {name[:3]} is used by {sorted(numbers[int(name[:3])])}")
        sql = git("show", f"HEAD:{DIR}{name}")
        if REVIEWED.search(sql):
            print(f"note: {name} is marked reviewed for destructive changes")
            continue
        body = strip_comments(sql)
        for pattern, why in DESTRUCTIVE:
            if pattern.search(body):
                errors.append(f"{name}: {why}; not backward compatible with the running release "
                              "(use expand/contract, or mark it '-- migration-safety: reviewed <reason>')")

    for e in errors:
        print(f"::error::{e}")
    print(f"migration policy: {len(head_files - base_files)} new file(s) vs {base}, {len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
