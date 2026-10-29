#!/usr/bin/env python3
"""Verified RDS checkpoint before Production migrations: create a manual snapshot, wait until it is
`available`, then keep only the newest KEEP pre-deploy snapshots this job created.

Env: DB_INSTANCE (e.g. bseva-prod-db), TAG (sha-…), AWS_REGION, KEEP (default 5), GITHUB_RUN_ID, GITHUB_OUTPUT.
Credentials: the Production OIDC role (snapshot names are limited to <DB prefix>-predeploy-*).
Exits non-zero if the snapshot does not become available, which stops the deploy before any migration.
"""
from __future__ import annotations

import os
import sys
import time

import boto3

DB = os.environ["DB_INSTANCE"]
TAG = os.environ["TAG"]
REGION = os.environ.get("AWS_REGION", "ap-south-1")
KEEP = int(os.environ.get("KEEP", "5"))
PREFIX = DB.removesuffix("-db") + "-predeploy-"
RUN = os.environ.get("GITHUB_RUN_ID", str(int(time.time())))
NAME = f"{PREFIX}{TAG}-{RUN}".replace("_", "-")[:255]

rds = boto3.client("rds", region_name=REGION)

instance = rds.describe_db_instances(DBInstanceIdentifier=DB)["DBInstances"][0]
if instance["DBInstanceStatus"] != "available":
    sys.exit(f"{DB} is {instance['DBInstanceStatus']}, not available; refusing to snapshot or migrate")

rds.create_db_snapshot(DBSnapshotIdentifier=NAME, DBInstanceIdentifier=DB,
                       Tags=[{"Key": "Project", "Value": "bseva"}, {"Key": "Purpose", "Value": "predeploy"},
                             {"Key": "ReleaseTag", "Value": TAG}])
print(f"snapshot {NAME} requested for {DB}")
rds.get_waiter("db_snapshot_available").wait(DBSnapshotIdentifier=NAME, WaiterConfig={"Delay": 20, "MaxAttempts": 90})
snap = rds.describe_db_snapshots(DBSnapshotIdentifier=NAME)["DBSnapshots"][0]
if snap["Status"] != "available" or snap.get("PercentProgress") != 100:
    sys.exit(f"snapshot {NAME} is {snap['Status']} ({snap.get('PercentProgress')}%)")
print(f"snapshot {NAME} available: {snap['AllocatedStorage']} GB, created {snap['SnapshotCreateTime']}")
if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
        fh.write(f"snapshot={NAME}\n")

ours = [s for s in rds.describe_db_snapshots(DBInstanceIdentifier=DB, SnapshotType="manual")["DBSnapshots"]
        if s["DBSnapshotIdentifier"].startswith(PREFIX) and s["Status"] == "available"]
ours.sort(key=lambda s: s["SnapshotCreateTime"], reverse=True)
for old in ours[KEEP:]:
    rds.delete_db_snapshot(DBSnapshotIdentifier=old["DBSnapshotIdentifier"])
    print(f"pruned old pre-deploy snapshot {old['DBSnapshotIdentifier']}")
