#!/usr/bin/env python3
"""Ship the compose file + host scripts to the QA or Production host and run deploy.sh through SSM Run Command.

Env: TAG (sha-…), REGISTRY (ECR registry host), AWS_REGION, DEPLOY_ENV (qa|production), DOMAIN. Credentials: the OIDC role.
The instance is found by tags (Project=bseva, Environment=<env>, Name=bseva-<env>-app). Exits non-zero
if the remote deploy (including its automatic rollback) fails.
"""
from __future__ import annotations

import base64
import os
import sys
import time
from pathlib import Path

import boto3

REPO = Path(__file__).resolve().parents[2]
TAG = os.environ["TAG"]
REGISTRY = os.environ["REGISTRY"]
REGION = os.environ.get("AWS_REGION", "ap-south-1")
ENV_NAME = os.environ.get("DEPLOY_ENV", "qa")
if ENV_NAME not in ("qa", "production"):
    sys.exit(f"DEPLOY_ENV must be qa or production, not {ENV_NAME!r}")
DOMAIN = os.environ.get("DOMAIN") or os.environ.get("QA_DOMAIN", "qa.b-seva.com")

FILES = {
    "/opt/bseva/compose/compose.yml": REPO / "deploy/compose/compose.yml",
    "/opt/bseva/bin/deploy.sh": REPO / "deploy/host/deploy.sh",
    "/opt/bseva/bin/render-env.sh": REPO / "deploy/host/render-env.sh",
    "/opt/bseva/bin/issue-cert.sh": REPO / "deploy/host/issue-cert.sh",
}

ec2 = boto3.client("ec2", region_name=REGION)
ssm = boto3.client("ssm", region_name=REGION)

reservations = ec2.describe_instances(Filters=[
    {"Name": "tag:Name", "Values": [f"bseva-{ENV_NAME}-app"]},
    {"Name": "tag:Project", "Values": ["bseva"]},
    {"Name": "tag:Environment", "Values": [ENV_NAME]},
    {"Name": "instance-state-name", "Values": ["running"]},
])["Reservations"]
instances = [i["InstanceId"] for r in reservations for i in r["Instances"]]
if len(instances) != 1:
    sys.exit(f"expected exactly one running {ENV_NAME} host, found {instances}")
instance_id = instances[0]

commands = ["set -euo pipefail", "install -d -m 0755 /opt/bseva/bin /opt/bseva/compose"]
for dest, src in FILES.items():
    payload = base64.b64encode(src.read_bytes()).decode()
    mode = "0755" if dest.endswith(".sh") else "0644"
    commands.append(f"echo '{payload}' | base64 -d > '{dest}.new' && chmod {mode} '{dest}.new' && mv '{dest}.new' '{dest}'")
commands.append(
    "printf 'ENV_NAME=%s\\nREGISTRY=%s\\nDOMAIN=%s\\nAWS_REGION=%s\\n' "
    f"'{ENV_NAME}' '{REGISTRY}' '{DOMAIN}' '{REGION}' > /opt/bseva/.env && chmod 0644 /opt/bseva/.env"
)
commands.append(f"/opt/bseva/bin/deploy.sh '{TAG}'")

cmd = ssm.send_command(
    InstanceIds=[instance_id],
    DocumentName="AWS-RunShellScript",
    Comment=f"bseva {ENV_NAME} deploy {TAG}"[:100],
    Parameters={"commands": commands, "executionTimeout": ["1500"]},
    TimeoutSeconds=600,
)["Command"]["CommandId"]
print(f"SSM command {cmd} on {instance_id} for {TAG}")

deadline = time.time() + 1600
status = "Pending"
while time.time() < deadline:
    time.sleep(10)
    try:
        inv = ssm.get_command_invocation(CommandId=cmd, InstanceId=instance_id)
    except ssm.exceptions.InvocationDoesNotExist:
        continue
    status = inv["Status"]
    if status not in ("Pending", "InProgress", "Delayed"):
        print(inv.get("StandardOutputContent", "")[-6000:])
        err = inv.get("StandardErrorContent", "")
        if err:
            print("--- stderr ---\n" + err[-4000:])
        break
print(f"remote status: {status}")
sys.exit(0 if status == "Success" else 1)
