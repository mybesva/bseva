#!/usr/bin/env python3
"""Reset administrator passwords on AWS QA (never Production).

    python3 scripts/qa_reset_admin_password.py --env-file aws-script/aws.env bka@b-seva.com rrc@b-seva.com
    python3 scripts/qa_reset_admin_password.py --env-file aws-script/aws.env --apply bka@b-seva.com rrc@b-seva.com

Without --apply it only reports each account (exists, role, blocked, sign-in lock, OTP delivery) and changes nothing.
With --apply it generates a new password per account, stores it as a SecureString at
/bseva/qa/admin/LOGIN_PASSWORD_<NAME>, sets it inside the running QA API container, clears the 15-minute failed
sign-in lock and writes an audit row. Passwords are never printed or placed in the SSM command.

bootstrap_admin.py cannot do this: it only creates the first Super Admin and refuses once one exists.
Read a password afterwards with:
    aws ssm get-parameter --region ap-south-1 --with-decryption --name /bseva/qa/admin/LOGIN_PASSWORD_BKA \
      --query Parameter.Value --output text
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import secrets
import string
import sys
import time
from pathlib import Path

import boto3

REGION = "ap-south-1"
EMAIL = re.compile(r"^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$")

# Runs inside the QA API container (python -), so it uses the deployed app's own hashing and settings.
CONTAINER_CODE = r'''
import json, os, sys
from urllib.parse import urlsplit
from sqlalchemy import text
from app import rate_limit
from app.audit import write_audit
from app.config import settings
from app.db import SessionLocal
from app.mail.smtp_client import recipient_allowed
from app.security import hash_password, verify_password

email = os.environ["RESET_EMAIL"]
password = os.environ.get("RESET_PASSWORD", "")
host = urlsplit(settings.database_url.replace("+psycopg", "")).hostname or ""
if (settings.environment or "").strip().lower() != "qa" or not host.startswith("bseva-qa-db."):
    sys.exit("REFUSED: this is not the QA environment and QA database")

db = SessionLocal()
row = db.execute(text("SELECT id, name, role, blocked, email_verified FROM users WHERE lower(email) = :e"), {"e": email}).mappings().first()
if not row:
    print(json.dumps({"email": email, "found": False}))
    sys.exit(4)
out = {"email": email, "found": True, "name": row["name"], "role": row["role"], "blocked": row["blocked"]}
if row["role"] not in ("admin", "super_admin"):
    print(json.dumps({**out, "error": "not an administrator; left unchanged"}))
    sys.exit(5)
if row["role"] == "super_admin":
    out["otp_required_at_login"] = True
    out["otp_email_allowed_on_qa"] = recipient_allowed(email)
    out["otp_test_code_applies"] = bool(settings.otp_test_code_for(email))
if password:
    db.execute(text("UPDATE users SET password_hash = :h, updated_at = NOW() WHERE id = :i"), {"h": hash_password(password), "i": row["id"]})
    rate_limit.reset(db, rate_limit.LOGIN_FAIL_IDENTIFIER, email)
    write_audit(db, str(row["id"]), "admin_password_changed", "user", str(row["id"]), reason="QA reset script")
    db.commit()
    stored = db.execute(text("SELECT password_hash FROM users WHERE id = :i"), {"i": row["id"]}).scalar_one()
    out["password_reset"] = verify_password(password, stored)
    if not out["password_reset"]:
        sys.exit("password did not verify after the update")
print(json.dumps(out))
'''


def session(env_file: str | None) -> boto3.Session:
    kwargs = {"region_name": REGION}
    if env_file:
        values = {}
        for line in Path(env_file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                values[k.strip()] = v.strip().strip('"').strip("'")
        kwargs.update(aws_access_key_id=values.get("AWS_ACCESS_KEY_ID"), aws_secret_access_key=values.get("AWS_SECRET_ACCESS_KEY"),
                      aws_session_token=values.get("AWS_SESSION_TOKEN") or None)
    return boto3.Session(**kwargs)


def qa_instance(ec2) -> str:
    reservations = ec2.describe_instances(Filters=[
        {"Name": "tag:Name", "Values": ["bseva-qa-app"]},
        {"Name": "tag:Project", "Values": ["bseva"]},
        {"Name": "tag:Environment", "Values": ["qa"]},
        {"Name": "instance-state-name", "Values": ["running"]},
    ])["Reservations"]
    ids = [i["InstanceId"] for r in reservations for i in r["Instances"]]
    if len(ids) != 1:
        sys.exit(f"expected exactly one running QA host, found {ids}")
    return ids[0]


def parameter_name(email: str) -> str:
    return "/bseva/qa/admin/LOGIN_PASSWORD_" + re.sub(r"[^A-Z0-9]", "_", email.split("@")[0].upper())


def new_password() -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(20))
        if any(c.islower() for c in value) and any(c.isupper() for c in value) and any(c.isdigit() for c in value):
            return value


def host_commands(emails: list[str], apply: bool) -> list[str]:
    code = base64.b64encode(CONTAINER_CODE.encode()).decode()
    commands = [
        "set -uo pipefail",
        "c=\"$(docker ps -qf label=com.docker.compose.service=api | head -1)\"",
        "[ -n \"$c\" ] || { echo 'QA API container is not running' >&2; exit 1; }",
        "rc=0",
    ]
    for email in emails:
        if apply:
            commands.append(
                f"RESET_PASSWORD=\"$(aws ssm get-parameter --region {REGION} --name '{parameter_name(email)}' "
                "--with-decryption --query Parameter.Value --output text)\" || exit 1"
            )
        else:
            commands.append("RESET_PASSWORD=")
        commands.append(f"export RESET_EMAIL='{email}' RESET_PASSWORD")
        commands.append(f"echo '{code}' | base64 -d | docker exec -i -e RESET_EMAIL -e RESET_PASSWORD \"$c\" python - || rc=1")
    commands.append("unset RESET_PASSWORD; exit $rc")
    return commands


def explain(line: str) -> None:
    try:
        r = json.loads(line)
    except ValueError:
        print(line)
        return
    print(f"\n{r['email']}")
    if not r["found"]:
        print("  NOT FOUND on QA: this account does not exist there, so there is nothing to reset.")
        print("  Create it in the admin console under Administrators, then sign in or reset it there.")
        return
    print(f"  name: {r['name']}  role: {r['role']}  blocked: {r['blocked']}")
    if r.get("error"):
        print(f"  {r['error']}")
    if r["blocked"]:
        print("  BLOCKED: the password alone will not let this account in; unblock it in the admin console.")
    if r.get("password_reset"):
        print(f"  password reset and verified; stored at {parameter_name(r['email'])}")
    if r.get("otp_required_at_login") and not (r["otp_email_allowed_on_qa"] or r["otp_test_code_applies"]):
        print("  SIGN-IN WILL STILL FAIL: Super Admin login needs an emailed OTP, and QA's EMAIL_ALLOWLIST blocks this address.")
        print("  Add it to /bseva/qa/app/EMAIL_ALLOWLIST and redeploy QA.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Reset administrator passwords on AWS QA")
    ap.add_argument("emails", nargs="+")
    ap.add_argument("--apply", action="store_true", help="change the passwords (default: report only)")
    ap.add_argument("--env-file", help="AWS credentials file (e.g. aws-script/aws.env); default boto3 chain otherwise")
    args = ap.parse_args()
    emails = [e.strip().lower() for e in args.emails]
    bad = [e for e in emails if not EMAIL.match(e)]
    if bad:
        sys.exit(f"not valid email addresses: {bad}")

    aws = session(args.env_file)
    ssm = aws.client("ssm")
    instance = qa_instance(aws.client("ec2"))
    print(f"QA host {instance}: {'RESETTING PASSWORDS' if args.apply else 'report only, nothing will change'}")

    if args.apply:
        for email in emails:
            ssm.put_parameter(Name=parameter_name(email), Value=new_password(), Type="SecureString", Tier="Standard", Overwrite=True)

    command = ssm.send_command(
        InstanceIds=[instance], DocumentName="AWS-RunShellScript", Comment="bseva qa admin password reset"[:100],
        Parameters={"commands": host_commands(emails, args.apply), "executionTimeout": ["120"]}, TimeoutSeconds=120,
    )["Command"]["CommandId"]

    deadline = time.time() + 150
    status, output, errors = "Pending", "", ""
    while time.time() < deadline:
        time.sleep(3)
        try:
            inv = ssm.get_command_invocation(CommandId=command, InstanceId=instance)
        except ssm.exceptions.InvocationDoesNotExist:
            continue
        status = inv["Status"]
        if status not in ("Pending", "InProgress", "Delayed"):
            output, errors = inv.get("StandardOutputContent", ""), inv.get("StandardErrorContent", "")
            break
    for line in output.splitlines():
        if line.strip():
            explain(line.strip())
    if errors.strip():
        print("\n--- errors ---\n" + errors[-2000:])
    print(f"\nSSM status: {status}")
    return 0 if status == "Success" else 1


if __name__ == "__main__":
    sys.exit(main())
