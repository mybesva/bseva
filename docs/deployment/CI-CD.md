# B-Seva CI/CD and release process

| Branch | Deploys to | How |
|---|---|---|
| `feature/*`, `fix/*` | nothing | PR into `develop`; CI must pass |
| `develop` | AWS QA — https://qa.b-seva.com | `.github/workflows/qa-deploy.yml`, automatically on every push/merge |
| `main` | AWS Production — https://b-seva.com | `.github/workflows/production-deploy.yml`, starts on merge, waits for `aws-production` approval |
| `staging` | Vercel | Vercel Git integration (Production Branch = `staging`); `main` and `develop` are disabled in `vercel.json` |

## Normal flow

1. Branch from `develop` (`feature/…` or `fix/…`), open a PR into `develop`.
2. CI (`ci.yml` → `checks.yml`) runs: backend tests, migrations on a fresh PostgreSQL 17 (strict), migration
   policy, static checks, Docker image builds. All are required by the `develop` ruleset.
3. Merge → **QA deploy** runs by itself: checks → arm64 images → migrations on the QA database → deploy → health
   checks. A failed migration stops before any container changes; a failed health check rolls the app back.
4. Test and approve the change on QA.
5. Open a PR **`develop` → `main`**. Required: CI checks, the `Release source` check (source must be `develop`),
   one approval, and a successful `qa` deployment of the PR's head commit. Merge with a merge commit.
6. **Production deploy** starts automatically:
   - `QA-passed gate`: the release commit's git tree must equal a `develop` commit whose QA deploy succeeded.
     That run's image tag (`sha-<develop sha>`) is what Production runs.
   - `checks`: the same checks as CI.
   - `Deploy to Production` waits for a reviewer to approve the `aws-production` environment, then:
     promotes the QA API image (same digest) → builds the web image from the same code with Production build
     values (SSM `/bseva/prod/build/`) → preflight on the host (database target guard + migration plan,
     read-only) → verified RDS snapshot `bseva-prod-predeploy-<tag>-<run>` → migrations → deploy → public
     checks (`b-seva.com/api/ready` reports the new version; `www` and `app` 301 to `b-seva.com`).

Never push to `main` or `develop` directly; the rulesets block it for everyone, admins included.

## Emergency hotfix

1. Branch `hotfix/<name>` from `main`; PR into `develop` first and let QA deploy it (this is the fast path —
   it keeps the QA gate intact).
2. If `develop` holds unreleased work that must not ship, open a PR `hotfix/<name>` → `main` with the label
   `emergency-hotfix` (the `Release source` check allows it only with that label). It still needs CI and one
   approval.
3. The merge starts Production deploy, whose gate will fail because QA never ran this exact code. A maintainer
   then runs **Production deploy** manually on `main` with `emergency_reason` filled in (incident/ticket). The
   API image is rebuilt from source; `aws-production` approval, snapshot, migrations and checks still apply.
4. Merge `main` back into `develop` the same day.

## Database migrations

Runner: `python -m app.db_bootstrap` in the `migrate` container (`deploy/host/deploy.sh`), before the new
release starts.

- **Target guard**: `deploy.sh` passes `REQUIRE_TARGET_GUARD=1`, `EXPECTED_DB_HOST_PREFIX=bseva-<qa|prod>-db.`
  and `EXPECTED_ENVIRONMENT=<qa|production>`; any mismatch exits 3 before a connection is used for writes.
  Separately, each host reads only its own `/bseva/<env>/` SSM path and each RDS security group accepts only its
  own app host.
- **Files** (`supabase/migrations/NNN_*.sql`): each runs in its own transaction with `lock_timeout 30s` and is
  recorded in `schema_migrations`; a failure rolls that file back, stops later files, and fails the deploy.
- **`ensure_schema()`** (`backend/app/schema_migrate.py` and the modules it calls) runs strict: any failed
  statement rolls the whole DDL transaction back and fails the deploy. It runs when files were applied, when
  its code changed (fingerprint in `schema_migrations_meta`), or with `RUN_ENSURE_SCHEMA=always`.
- **Policy** (`deploy/ci/check_migrations.py`, required in CI): released files are immutable; new files are
  numbered above the base; destructive statements (DROP TABLE/COLUMN, RENAME, column type change, SET NOT NULL,
  TRUNCATE, unqualified DELETE) fail unless the file has `-- migration-safety: reviewed <reason>`.
- **Compatibility rule**: the previous release keeps running while migrations apply, and a failed health check
  rolls the *application* back but never the database. Every migration must work with both the old and the
  new code: add columns nullable or with defaults, backfill separately, and remove old columns only in a later
  release (expand → migrate → contract).
- Production only: a manual RDS snapshot must reach `available` before any migration runs (5 kept).

Check state without changing anything (on a host):
`docker exec $(docker ps -qf name=api) python -m app.db_bootstrap --status`

## Recovery

**Bad release, database fine** — redeploy the previous tag:
`aws ssm send-command … /opt/bseva/bin/deploy.sh --rollback` on the host (or re-run Production deploy for an
older QA-passed commit). Migrations are not reverted; this is why they must stay backward compatible.

**Bad migration / data damage** — restore the pre-deploy snapshot to a new instance, never over the live one:

```bash
aws rds restore-db-instance-from-db-snapshot --db-instance-identifier bseva-prod-db-restore-<date> \
  --db-snapshot-identifier bseva-prod-predeploy-<tag>-<run> --db-instance-class db.t4g.micro \
  --db-subnet-group-name <prod subnet group> --vpc-security-group-ids <bseva-prod-db sg> --no-publicly-accessible
```

Then: put the app in read-only mode (`READ_ONLY_MODE`), compare/copy the needed data or point
`/bseva/prod/app/DATABASE_URL` at the restored endpoint, run `deploy.sh --rollback`, and verify `/api/ready`.
Keep the original instance until the incident is closed. Rehearse this on QA (`bseva-qa-db`) before relying on it.

## One-time configuration (outside the repo)

- **AWS** (`infra/aws/bseva_qa.py --env production plan` then `apply`): the Production deploy role trusts
  `…:environment:aws-production` only, can read the QA ECR repositories (promotion), read `/bseva/prod/build/*`,
  and create/prune `bseva-prod-predeploy-*` snapshots.
- **GitHub** (`.github/rulesets/apply.sh --apply`, as a repository admin; without `--apply` it only shows the
  current state): environment `aws-production` (required reviewers, `main` only, admins cannot bypass) and the
  rulesets in `.github/rulesets/` — `main` (PR only, 1 approval, merge commits, CI + `Release source` checks,
  successful `qa` deployment, no force-push/deletion, no bypass), `develop` (PR only, CI checks), `staging`
  (no force-push/deletion). Environment `qa` stays limited to `develop`.
- **Vercel**: Project → Settings → Git → Production Branch = `staging`.
