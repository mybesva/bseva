#!/usr/bin/env python3
"""B-Seva QA and Production infrastructure on AWS (Mumbai) — idempotent boto3 automation (--env qa|production, default qa).

    python3 infra/aws/bseva_qa.py plan                  # read-only: what would be created / kept
    python3 infra/aws/bseva_qa.py apply --yes           # create only what is missing (billable)
    python3 infra/aws/bseva_qa.py status                # read-only inventory of managed resources
    python3 infra/aws/bseva_qa.py set-params --from-file F   # store QA app settings/secrets in SSM (values never printed)
    python3 infra/aws/bseva_qa.py health                # HTTPS /api/ready + instance/RDS state
    python3 infra/aws/bseva_qa.py backup-check          # RDS automated backups / restore window
    python3 infra/aws/bseva_qa.py teardown --confirm qa-472238087252   # delete QA (final RDS snapshot kept)

Safety: every command verifies the caller's AWS account, the region (ap-south-1) and environment (qa)
from config/qa.json before doing anything. Resources are found by name + tags
(Project=bseva, Environment=qa, ManagedBy=bseva-infra), so re-running never creates duplicates and
never touches resources this tool did not create. Credentials: the default boto3 chain, or
--env-file aws-script/aws.env (loaded into memory only).
"""
from __future__ import annotations

import argparse
import json
import secrets
import string
import sys
import time
import urllib.request
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ENVIRONMENTS = ("qa", "production")


def _selected_env() -> str:
    # Read before argparse: the config decides every resource name below.
    for i, a in enumerate(sys.argv):
        if a == "--env" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith("--env="):
            return a.split("=", 1)[1]
    return "qa"


ENV_NAME = _selected_env()
if ENV_NAME not in ENVIRONMENTS:
    sys.exit(f"--env must be one of {', '.join(ENVIRONMENTS)}")
CFG = json.loads((HERE / "config" / f"{ENV_NAME}.json").read_text(encoding="utf-8"))
QA_CFG = json.loads((HERE / "config" / "qa.json").read_text(encoding="utf-8"))
ENV = CFG["environment"]
LABEL = {"qa": "QA", "production": "Production"}[ENV]  # QA wording is unchanged for existing resources
ACCOUNT = CFG["account_id"]
REGION = CFG["region"]
NAME_ENV = CFG.get("name_env", ENV)  # short name used in resource names and paths: qa | prod
P = f"{CFG['project']}-{NAME_ENV}"  # name prefix: bseva-qa | bseva-prod
TAGS = {"Project": CFG["project"], "Environment": ENV, "ManagedBy": "bseva-infra"}
BOTO = Config(retries={"max_attempts": 5, "mode": "standard"}, connect_timeout=15, read_timeout=60)

BUCKET = f"{P}-files-{ACCOUNT}"
TRAIL_BUCKET = f"{CFG['project']}-audit-{ACCOUNT}"
LOG_GROUP = f"/bseva/{NAME_ENV}/app"
REPOS = tuple(CFG.get("ecr_repositories", ["bseva-api", "bseva-web"]))
EC2_ROLE = f"{P}-ec2"
DEPLOY_ROLE = f"{P}-github-deploy"
OIDC_URL = "token.actions.githubusercontent.com"
DB_ID = f"{P}-db"
PARAM_PREFIX = f"/bseva/{NAME_ENV}"


# ------------------------------------------------------------------ session and guards

class Ctx:
    def __init__(self, env_file: str | None):
        kwargs = {"region_name": REGION}
        if env_file:
            values = {}
            for line in Path(env_file).read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    values[k.strip()] = v.strip().strip('"').strip("'")
            kwargs.update(
                aws_access_key_id=values.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=values.get("AWS_SECRET_ACCESS_KEY"),
                aws_session_token=values.get("AWS_SESSION_TOKEN") or None,
            )
        self.session = boto3.Session(**kwargs)
        self._clients: dict[str, object] = {}

    def c(self, service: str, region: str | None = None):
        key = f"{service}@{region or REGION}"
        if key not in self._clients:
            self._clients[key] = self.session.client(service, region_name=region or REGION, config=BOTO)
        return self._clients[key]

    def guard(self) -> str:
        ident = self.c("sts").get_caller_identity()
        if ENV != ENV_NAME or REGION != "ap-south-1":
            sys.exit(f"Refusing: config/{ENV_NAME}.json must describe the {ENV_NAME} environment in ap-south-1")
        if not ACCOUNT.isdigit():
            sys.exit(f"Refusing: set account_id in config/{ENV_NAME}.json first")
        problems = isolation_problems()
        if problems:
            sys.exit("Refusing: " + "; ".join(problems))
        if ident["Account"] != ACCOUNT:
            sys.exit(f"Refusing: caller account {ident['Account']} is not the {ENV} account {ACCOUNT}")
        return ident["Arn"]


def isolation_problems() -> list[str]:
    """Production may share QA's AWS account only with fully separate identifiers and network ranges."""
    if ENV != "production":
        return []
    qa_prefix = f"{QA_CFG['project']}-{QA_CFG.get('name_env', QA_CFG['environment'])}"
    qa_repos = set(QA_CFG.get("ecr_repositories", ["bseva-api", "bseva-web"]))
    checks = [
        (NAME_ENV != QA_CFG.get("name_env", QA_CFG["environment"]), "production name_env must differ from QA's"),
        (P != qa_prefix, f"resource prefix {P} collides with QA"),
        (not set(REPOS) & qa_repos, "production ECR repositories must differ from QA's"),
        (CFG["network"]["vpc_cidr"] != QA_CFG["network"]["vpc_cidr"], "production VPC CIDR must differ from QA's"),
        (CFG["domain"] != QA_CFG["domain"], "production domain must differ from QA's"),
        (CFG["github_environment"] != QA_CFG["github_environment"], "production GitHub environment must differ from QA's"),
        (not any(k.startswith("OTP_TEST") or k in ("EMAIL_ALLOWLIST", "SEED_PASSWORD") for k in CFG["app_parameters"]),
         "QA-only settings (OTP_TEST_*, EMAIL_ALLOWLIST, SEED_PASSWORD) must not be in production app_parameters"),
    ]
    return [msg for ok, msg in checks if not ok]


def tag_list(extra: dict | None = None) -> list[dict]:
    return [{"Key": k, "Value": v} for k, v in {**TAGS, **(extra or {})}.items()]


def tag_spec(resource: str, name: str) -> list[dict]:
    return [{"ResourceType": resource, "Tags": tag_list({"Name": name})}]


def ignore(codes: tuple[str, ...]):
    def wrap(fn):
        try:
            return fn()
        except ClientError as e:
            if e.response["Error"]["Code"] in codes:
                return None
            raise
    return wrap


def out(action: str, kind: str, name: str, note: str = "") -> None:
    print(f"  {action:7} {kind:22} {name}{('  — ' + note) if note else ''}")


# ------------------------------------------------------------------ discovery helpers

def find_vpc(ctx):
    r = ctx.c("ec2").describe_vpcs(Filters=[{"Name": "tag:Name", "Values": [f"{P}-vpc"]}, {"Name": "tag:ManagedBy", "Values": ["bseva-infra"]}])
    return r["Vpcs"][0]["VpcId"] if r["Vpcs"] else None


def find_by_name(ctx, describe: str, key: str, name: str, vpc: str | None = None, id_key: str | None = None):
    filters = [{"Name": "tag:Name", "Values": [name]}]
    if vpc:
        filters.append({"Name": "vpc-id", "Values": [vpc]})
    items = getattr(ctx.c("ec2"), describe)(Filters=filters)[key]
    return items[0][id_key] if items and id_key else (items[0] if items else None)


def find_instance(ctx):
    r = ctx.c("ec2").describe_instances(Filters=[
        {"Name": "tag:Name", "Values": [f"{P}-app"]},
        {"Name": "tag:ManagedBy", "Values": ["bseva-infra"]},
        {"Name": "instance-state-name", "Values": ["pending", "running", "stopping", "stopped"]},
    ])
    for res in r["Reservations"]:
        for inst in res["Instances"]:
            return inst
    return None


def find_db(ctx):
    try:
        return ctx.c("rds").describe_db_instances(DBInstanceIdentifier=DB_ID)["DBInstances"][0]
    except ClientError as e:
        if e.response["Error"]["Code"] == "DBInstanceNotFound":
            return None
        raise


def bucket_exists(ctx, name: str) -> bool:
    try:
        ctx.c("s3").head_bucket(Bucket=name)
        return True
    except ClientError:
        return False


def role_exists(ctx, name: str) -> bool:
    return bool(ignore(("NoSuchEntity",))(lambda: ctx.c("iam", "us-east-1").get_role(RoleName=name)))


def oidc_arn() -> str:
    return f"arn:aws:iam::{ACCOUNT}:oidc-provider/{OIDC_URL}"


def oidc_exists(ctx) -> bool:
    return bool(ignore(("NoSuchEntity",))(lambda: ctx.c("iam", "us-east-1").get_open_id_connect_provider(OpenIDConnectProviderArn=oidc_arn())))


def param_exists(ctx, name: str) -> bool:
    return bool(ignore(("ParameterNotFound",))(lambda: ctx.c("ssm").get_parameter(Name=name)))


def random_secret(n: int = 48) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


# ------------------------------------------------------------------ steps (each: plan + apply)

ACCOUNT_GUARDRAILS = False  # account-wide settings need separate approval (--account-guardrails)


def step_guardrails(ctx, apply: bool):
    if not ACCOUNT_GUARDRAILS:
        out("skip", "account setting", "EBS default encryption / account S3 BPA", f"needs separate approval; set per {LABEL} resource instead")
        return
    ec2 = ctx.c("ec2")
    if ec2.get_ebs_encryption_by_default()["EbsEncryptionByDefault"]:
        out("keep", "account setting", "EBS encryption by default (ap-south-1)")
    else:
        out("create", "account setting", "EBS encryption by default (ap-south-1)", "free")
        if apply:
            ec2.enable_ebs_encryption_by_default()
    s3c = ctx.c("s3control")
    bpa = ignore(("NoSuchPublicAccessBlockConfiguration",))(lambda: s3c.get_public_access_block(AccountId=ACCOUNT))
    full = bpa and all(bpa["PublicAccessBlockConfiguration"].values())
    out("keep" if full else "create", "account setting", "S3 Block Public Access (account)", "" if full else "free")
    if apply and not full:
        s3c.put_public_access_block(AccountId=ACCOUNT, PublicAccessBlockConfiguration={
            "BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True})


def step_budget(ctx, apply: bool):
    bud = ctx.c("budgets", "us-east-1")
    name = f"{P}-monthly"
    existing = {b["BudgetName"] for b in bud.describe_budgets(AccountId=ACCOUNT).get("Budgets", [])}
    emails = CFG["alert_emails"]
    if name in existing:
        out("keep", "budget", name)
    else:
        out("create", "budget", name, f"${CFG['budget_usd']}/month; actual 50/80/100%, forecast 100%; free")
        if apply:
            if not emails:
                sys.exit(f"Set alert_emails in infra/aws/config/{ENV_NAME}.json before apply (budget/alarm recipients)")
            subs = [{"SubscriptionType": "EMAIL", "Address": e} for e in emails]
            notes = [("ACTUAL", 50), ("ACTUAL", 80), ("ACTUAL", 100), ("FORECASTED", 100)]
            budget = {"BudgetName": name, "BudgetType": "COST", "TimeUnit": "MONTHLY",
                      "BudgetLimit": {"Amount": str(CFG["budget_usd"]), "Unit": "USD"}}
            if CFG.get("budget_tag_filter"):
                # Counts only resources tagged Environment=<env>; needs the Environment cost-allocation tag activated.
                budget["CostFilters"] = {"TagKeyValue": [f"user:Environment${ENV}"]}
            bud.create_budget(
                AccountId=ACCOUNT,
                Budget=budget,
                NotificationsWithSubscribers=[
                    {"Notification": {"NotificationType": t, "ComparisonOperator": "GREATER_THAN",
                                      "Threshold": th, "ThresholdType": "PERCENTAGE"}, "Subscribers": subs}
                    for t, th in notes],
            )
    if not CFG.get("anomaly_monitor", True):
        out("skip", "cost anomaly monitor", f"{P}-services", "the account-wide monitor already covers every service")
        return
    ce = ctx.c("ce", "us-east-1")
    monitors = [m for m in ce.get_anomaly_monitors().get("AnomalyMonitors", []) if m["MonitorName"] == f"{P}-services"]
    if monitors:
        out("keep", "cost anomaly monitor", f"{P}-services")
    else:
        out("create", "cost anomaly monitor", f"{P}-services", f"alert above ${CFG['anomaly_threshold_usd']}; free")
        if apply:
            arn = ce.create_anomaly_monitor(AnomalyMonitor={"MonitorName": f"{P}-services", "MonitorType": "DIMENSIONAL",
                                                            "MonitorDimension": "SERVICE"})["MonitorArn"]
            ce.create_anomaly_subscription(AnomalySubscription={
                "SubscriptionName": f"{P}-anomalies", "MonitorArnList": [arn], "Frequency": "DAILY",
                "Subscribers": [{"Type": "EMAIL", "Address": e} for e in emails],
                "ThresholdExpression": {"Dimensions": {"Key": "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
                                                       "MatchOptions": ["GREATER_THAN_OR_EQUAL"],
                                                       "Values": [str(CFG["anomaly_threshold_usd"])]}}})


def step_trail(ctx, apply: bool):
    ct = ctx.c("cloudtrail")
    trails = [t for t in ct.describe_trails().get("trailList", []) if t["Name"] == f"{CFG['project']}-audit"]
    if trails:
        out("keep", "cloudtrail", f"{CFG['project']}-audit")
        return
    out("create", "cloudtrail", f"{CFG['project']}-audit", f"management events → s3://{TRAIL_BUCKET} (90-day expiry); ≈$0")
    if not apply:
        return
    s3 = ctx.c("s3")
    if not bucket_exists(ctx, TRAIL_BUCKET):
        s3.create_bucket(Bucket=TRAIL_BUCKET, CreateBucketConfiguration={"LocationConstraint": REGION})
    s3.put_public_access_block(Bucket=TRAIL_BUCKET, PublicAccessBlockConfiguration={
        "BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True})
    s3.put_bucket_tagging(Bucket=TRAIL_BUCKET, Tagging={"TagSet": tag_list({"Name": TRAIL_BUCKET})})
    s3.put_bucket_lifecycle_configuration(Bucket=TRAIL_BUCKET, LifecycleConfiguration={"Rules": [
        {"ID": "expire-90d", "Status": "Enabled", "Filter": {}, "Expiration": {"Days": 90}}]})
    trail_arn = f"arn:aws:cloudtrail:{REGION}:{ACCOUNT}:trail/{CFG['project']}-audit"
    s3.put_bucket_policy(Bucket=TRAIL_BUCKET, Policy=json.dumps({"Version": "2012-10-17", "Statement": [
        {"Sid": "AclCheck", "Effect": "Allow", "Principal": {"Service": "cloudtrail.amazonaws.com"},
         "Action": "s3:GetBucketAcl", "Resource": f"arn:aws:s3:::{TRAIL_BUCKET}",
         "Condition": {"StringEquals": {"aws:SourceArn": trail_arn}}},
        {"Sid": "Write", "Effect": "Allow", "Principal": {"Service": "cloudtrail.amazonaws.com"},
         "Action": "s3:PutObject", "Resource": f"arn:aws:s3:::{TRAIL_BUCKET}/AWSLogs/{ACCOUNT}/*",
         "Condition": {"StringEquals": {"s3:x-amz-acl": "bucket-owner-full-control", "aws:SourceArn": trail_arn}}},
        {"Sid": "TLSOnly", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
         "Resource": [f"arn:aws:s3:::{TRAIL_BUCKET}", f"arn:aws:s3:::{TRAIL_BUCKET}/*"],
         "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}))
    ct.create_trail(Name=f"{CFG['project']}-audit", S3BucketName=TRAIL_BUCKET, IsMultiRegionTrail=True,
                    IncludeGlobalServiceEvents=True, TagsList=tag_list())
    ct.start_logging(Name=f"{CFG['project']}-audit")


def step_network(ctx, apply: bool) -> dict:
    ec2 = ctx.c("ec2")
    net = CFG["network"]
    ids: dict = {}
    vpc = find_vpc(ctx)
    out("keep" if vpc else "create", "vpc", f"{P}-vpc", net["vpc_cidr"] + ("" if vpc else "; free"))
    if not vpc and apply:
        vpc = ec2.create_vpc(CidrBlock=net["vpc_cidr"], TagSpecifications=tag_spec("vpc", f"{P}-vpc"))["Vpc"]["VpcId"]
        ec2.get_waiter("vpc_available").wait(VpcIds=[vpc])
        ec2.modify_vpc_attribute(VpcId=vpc, EnableDnsSupport={"Value": True})
        ec2.modify_vpc_attribute(VpcId=vpc, EnableDnsHostnames={"Value": True})
    ids["vpc"] = vpc

    igw = find_by_name(ctx, "describe_internet_gateways", "InternetGateways", f"{P}-igw", id_key="InternetGatewayId")
    out("keep" if igw else "create", "internet gateway", f"{P}-igw", "" if igw else "free")
    if not igw and apply:
        igw = ec2.create_internet_gateway(TagSpecifications=tag_spec("internet-gateway", f"{P}-igw"))["InternetGateway"]["InternetGatewayId"]
        ec2.attach_internet_gateway(InternetGatewayId=igw, VpcId=vpc)

    for tier, subnets in (("public", net["public_subnets"]), ("private", net["private_subnets"])):
        for az, cidr in subnets.items():
            name = f"{P}-{tier}-{az[-1]}"
            sid = find_by_name(ctx, "describe_subnets", "Subnets", name, vpc, "SubnetId") if vpc else None
            out("keep" if sid else "create", f"subnet ({tier})", name, cidr)
            if not sid and apply:
                sid = ec2.create_subnet(VpcId=vpc, CidrBlock=cidr, AvailabilityZone=az,
                                        TagSpecifications=tag_spec("subnet", name))["Subnet"]["SubnetId"]
            ids[f"{tier}-{az}"] = sid

    for tier in ("public", "private"):
        name = f"{P}-rt-{tier}"
        rt = find_by_name(ctx, "describe_route_tables", "RouteTables", name, vpc, "RouteTableId") if vpc else None
        out("keep" if rt else "create", "route table", name, "0.0.0.0/0 → IGW" if tier == "public" else "no internet route")
        if not rt and apply:
            rt = ec2.create_route_table(VpcId=vpc, TagSpecifications=tag_spec("route-table", name))["RouteTable"]["RouteTableId"]
            if tier == "public":
                ec2.create_route(RouteTableId=rt, DestinationCidrBlock="0.0.0.0/0", GatewayId=igw)
            for az in net[f"{tier}_subnets"]:
                ec2.associate_route_table(RouteTableId=rt, SubnetId=ids[f"{tier}-{az}"])
        ids[f"rt-{tier}"] = rt

    ep_name = f"{P}-s3-endpoint"
    ep = find_by_name(ctx, "describe_vpc_endpoints", "VpcEndpoints", ep_name, vpc, "VpcEndpointId") if vpc else None
    out("keep" if ep else "create", "vpc endpoint (gateway)", ep_name, "S3, free")
    if not ep and apply:
        ec2.create_vpc_endpoint(VpcId=vpc, ServiceName=f"com.amazonaws.{REGION}.s3", VpcEndpointType="Gateway",
                                RouteTableIds=[ids["rt-public"], ids["rt-private"]],
                                TagSpecifications=tag_spec("vpc-endpoint", ep_name))

    web = find_by_name(ctx, "describe_security_groups", "SecurityGroups", f"{P}-web", vpc, "GroupId") if vpc else None
    out("keep" if web else "create", "security group", f"{P}-web", "inbound 80, 443 only; no SSH")
    if not web and apply:
        web = ec2.create_security_group(GroupName=f"{P}-web", Description=f"B-Seva {LABEL} web host: HTTP/HTTPS only",
                                        VpcId=vpc, TagSpecifications=tag_spec("security-group", f"{P}-web"))["GroupId"]
        ec2.authorize_security_group_ingress(GroupId=web, IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": p, "ToPort": p, "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": d}]}
            for p, d in ((80, "HTTP (ACME + redirect)"), (443, "HTTPS"))])
    ids["sg-web"] = web

    db = find_by_name(ctx, "describe_security_groups", "SecurityGroups", f"{P}-db", vpc, "GroupId") if vpc else None
    out("keep" if db else "create", "security group", f"{P}-db", f"5432 from {P}-web only; no egress")
    if not db and apply:
        db = ec2.create_security_group(GroupName=f"{P}-db", Description=f"B-Seva {LABEL} PostgreSQL: app host only",
                                       VpcId=vpc, TagSpecifications=tag_spec("security-group", f"{P}-db"))["GroupId"]
        ec2.authorize_security_group_ingress(GroupId=db, IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432,
             "UserIdGroupPairs": [{"GroupId": web, "Description": "QA app host"}]}])
        ec2.revoke_security_group_egress(GroupId=db, IpPermissions=[
            {"IpProtocol": "-1", "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}])
    ids["sg-db"] = db
    return ids


def step_storage(ctx, apply: bool):
    s3 = ctx.c("s3")
    if bucket_exists(ctx, BUCKET):
        out("keep", "s3 bucket", BUCKET)
    else:
        out("create", "s3 bucket", BUCKET, "private, SSE-S3, TLS-only, BPA; ≈$0.03")
        if apply:
            s3.create_bucket(Bucket=BUCKET, CreateBucketConfiguration={"LocationConstraint": REGION})
            s3.put_public_access_block(Bucket=BUCKET, PublicAccessBlockConfiguration={
                "BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True})
            s3.put_bucket_encryption(Bucket=BUCKET, ServerSideEncryptionConfiguration={"Rules": [
                {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}, "BucketKeyEnabled": True}]})
            s3.put_bucket_ownership_controls(Bucket=BUCKET, OwnershipControls={"Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]})
            s3.put_bucket_tagging(Bucket=BUCKET, Tagging={"TagSet": tag_list({"Name": BUCKET})})
            s3.put_bucket_lifecycle_configuration(Bucket=BUCKET, LifecycleConfiguration={"Rules": [
                {"ID": "abort-incomplete-uploads", "Status": "Enabled", "Filter": {},
                 "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}}]})
            s3.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps({"Version": "2012-10-17", "Statement": [
                {"Sid": "TLSOnly", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
                 "Resource": [f"arn:aws:s3:::{BUCKET}", f"arn:aws:s3:::{BUCKET}/*"],
                 "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}))

    ecr = ctx.c("ecr")
    for repo in REPOS:
        exists = ignore(("RepositoryNotFoundException",))(lambda r=repo: ecr.describe_repositories(repositoryNames=[r]))
        out("keep" if exists else "create", "ecr repository", repo, "" if exists else f"immutable tags, scan on push, keep {CFG['ecr_keep_images']}; ≈$0.10/GB")
        if not exists and apply:
            ecr.create_repository(repositoryName=repo, imageTagMutability="IMMUTABLE",
                                  imageScanningConfiguration={"scanOnPush": True},
                                  encryptionConfiguration={"encryptionType": "AES256"}, tags=tag_list())
            ecr.put_lifecycle_policy(repositoryName=repo, lifecyclePolicyText=json.dumps({"rules": [
                {"rulePriority": 1, "description": f"keep last {CFG['ecr_keep_images']} images",
                 "selection": {"tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": CFG["ecr_keep_images"]},
                 "action": {"type": "expire"}}]}))

    logs = ctx.c("logs")
    groups = logs.describe_log_groups(logGroupNamePrefix=LOG_GROUP)["logGroups"]
    exists = any(g["logGroupName"] == LOG_GROUP for g in groups)
    out("keep" if exists else "create", "log group", LOG_GROUP, f"{CFG['log_retention_days']}-day retention")
    if not exists and apply:
        logs.create_log_group(logGroupName=LOG_GROUP, tags=TAGS)
        logs.put_retention_policy(logGroupName=LOG_GROUP, retentionInDays=CFG["log_retention_days"])


def step_iam(ctx, apply: bool):
    iam = ctx.c("iam", "us-east-1")
    param_arn = f"arn:aws:ssm:{REGION}:{ACCOUNT}:parameter{PARAM_PREFIX}/*"
    repo_arns = [f"arn:aws:ecr:{REGION}:{ACCOUNT}:repository/{r}" for r in REPOS]
    ec2_policy = {"Version": "2012-10-17", "Statement": [
        {"Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
        {"Sid": "EcrPull", "Effect": "Allow", "Action": ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"], "Resource": repo_arns},
        {"Sid": "ReadOwnParameters", "Effect": "Allow", "Action": ["ssm:GetParametersByPath", "ssm:GetParameter", "ssm:GetParameters"], "Resource": [param_arn, f"arn:aws:ssm:{REGION}:{ACCOUNT}:parameter{PARAM_PREFIX}"]},
        {"Sid": "DecryptViaSsm", "Effect": "Allow", "Action": "kms:Decrypt", "Resource": "*", "Condition": {"StringEquals": {"kms:ViaService": f"ssm.{REGION}.amazonaws.com"}}},
        {"Sid": "OwnBucketObjects", "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": f"arn:aws:s3:::{BUCKET}/*"},
        {"Sid": "OwnBucketList", "Effect": "Allow", "Action": "s3:ListBucket", "Resource": f"arn:aws:s3:::{BUCKET}"},
        {"Sid": "OwnLogs", "Effect": "Allow", "Action": ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"], "Resource": f"arn:aws:logs:{REGION}:{ACCOUNT}:log-group:{LOG_GROUP}:*"},
        # AmazonSSMManagedInstanceCore allows ssm:GetParameter on every parameter; QA and Production share the
        # account, so each host is explicitly denied every parameter outside its own path.
        {"Sid": "DenyOtherEnvironmentParameters", "Effect": "Deny",
         "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath", "ssm:GetParameterHistory"],
         "NotResource": [param_arn, f"arn:aws:ssm:{REGION}:{ACCOUNT}:parameter{PARAM_PREFIX}"]},
    ]}
    if role_exists(ctx, EC2_ROLE):
        current = iam.get_role_policy(RoleName=EC2_ROLE, PolicyName=f"{P}-app")["PolicyDocument"] if ignore(("NoSuchEntity",))(
            lambda: iam.get_role_policy(RoleName=EC2_ROLE, PolicyName=f"{P}-app")) else {}
        if current.get("Statement") == ec2_policy["Statement"]:
            out("keep", "iam role", EC2_ROLE)
        else:
            out("update", "iam role policy", f"{EC2_ROLE}/{P}-app", "deny parameters outside the environment's own path")
            if apply:
                iam.put_role_policy(RoleName=EC2_ROLE, PolicyName=f"{P}-app", PolicyDocument=json.dumps(ec2_policy))
    else:
        out("create", "iam role + profile", EC2_ROLE, "SSM core, ECR pull (2 repos), own SSM path, own bucket, own log group")
        if apply:
            iam.create_role(RoleName=EC2_ROLE, Tags=tag_list(), Description=f"B-Seva {ENV} app host",
                            AssumeRolePolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [
                                {"Effect": "Allow", "Principal": {"Service": "ec2.amazonaws.com"}, "Action": "sts:AssumeRole"}]}))
            iam.attach_role_policy(RoleName=EC2_ROLE, PolicyArn="arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore")
            iam.put_role_policy(RoleName=EC2_ROLE, PolicyName=f"{P}-app", PolicyDocument=json.dumps(ec2_policy))
            iam.create_instance_profile(InstanceProfileName=EC2_ROLE, Tags=tag_list())
            iam.add_role_to_instance_profile(InstanceProfileName=EC2_ROLE, RoleName=EC2_ROLE)

    if oidc_exists(ctx):
        out("keep", "iam oidc provider", OIDC_URL)
    else:
        out("create", "iam oidc provider", OIDC_URL, "GitHub Actions, audience sts.amazonaws.com")
        if apply:
            iam.create_open_id_connect_provider(Url=f"https://{OIDC_URL}", ClientIDList=["sts.amazonaws.com"], Tags=tag_list())

    # GitHub issues immutable subjects for this repository (owner and repo IDs), e.g.
    # repo:mybesva@317075826/bseva@1334798281:environment:qa; see GET /repos/{repo}/actions/oidc/customization/sub.
    sub = f"{CFG.get('github_oidc_subject_prefix') or 'repo:' + CFG['github_repo']}:environment:{CFG['github_environment']}"
    trust = {"Version": "2012-10-17", "Statement": [{
        "Effect": "Allow", "Principal": {"Federated": oidc_arn()}, "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {"StringEquals": {f"{OIDC_URL}:aud": "sts.amazonaws.com", f"{OIDC_URL}:sub": sub}}}]}
    deploy_policy = {"Version": "2012-10-17", "Statement": [
        {"Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
        {"Sid": "EcrPush", "Effect": "Allow", "Action": ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
                                                        "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:DescribeImages"], "Resource": repo_arns},
        {"Sid": "RunDeployOnOwnHostOnly", "Effect": "Allow", "Action": "ssm:SendCommand",
         "Resource": f"arn:aws:ec2:{REGION}:{ACCOUNT}:instance/*",
         "Condition": {"StringEquals": {"ssm:resourceTag/Project": "bseva", "ssm:resourceTag/Environment": ENV}}},
        {"Sid": "ShellDocument", "Effect": "Allow", "Action": "ssm:SendCommand", "Resource": f"arn:aws:ssm:{REGION}::document/AWS-RunShellScript"},
        {"Sid": "ReadResults", "Effect": "Allow", "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ec2:DescribeInstances"], "Resource": "*"},
    ]}
    if role_exists(ctx, DEPLOY_ROLE):
        current = iam.get_role(RoleName=DEPLOY_ROLE)["Role"]["AssumeRolePolicyDocument"]
        if current.get("Statement") == trust["Statement"]:
            out("keep", "iam role", DEPLOY_ROLE)
        else:
            out("update", "iam role trust", DEPLOY_ROLE, f"OIDC subject {sub}")
            if apply:
                iam.update_assume_role_policy(RoleName=DEPLOY_ROLE, PolicyDocument=json.dumps(trust))
    else:
        out("create", "iam role", DEPLOY_ROLE, f"OIDC trust only for {sub}; ECR push + SSM deploy to the {ENV} host")
        if apply:
            iam.create_role(RoleName=DEPLOY_ROLE, Tags=tag_list(), MaxSessionDuration=3600, Description=f"GitHub Actions {ENV} deploy (OIDC)",
                            AssumeRolePolicyDocument=json.dumps(trust))
            iam.put_role_policy(RoleName=DEPLOY_ROLE, PolicyName=f"{P}-deploy", PolicyDocument=json.dumps(deploy_policy))


def step_database(ctx, apply: bool, ids: dict):
    rds = ctx.c("rds")
    r = CFG["rds"]
    sng = f"{P}-db-subnets"
    exists = ignore(("DBSubnetGroupNotFoundFault",))(lambda: rds.describe_db_subnet_groups(DBSubnetGroupName=sng))
    out("keep" if exists else "create", "rds subnet group", sng, "private subnets a/b")
    if not exists and apply:
        rds.create_db_subnet_group(DBSubnetGroupName=sng, DBSubnetGroupDescription=f"B-Seva {LABEL} private DB subnets",
                                   SubnetIds=[ids[f"private-{az}"] for az in CFG["network"]["private_subnets"]], Tags=tag_list())
    pg = f"{P}-pg{r['engine_major']}"
    exists = ignore(("DBParameterGroupNotFound",))(lambda: rds.describe_db_parameter_groups(DBParameterGroupName=pg))
    out("keep" if exists else "create", "rds parameter group", pg, "rds.force_ssl=1, slow-query log ≥1s")
    if not exists and apply:
        rds.create_db_parameter_group(DBParameterGroupName=pg, DBParameterGroupFamily=f"postgres{r['engine_major']}",
                                      Description="B-Seva QA", Tags=tag_list())
        rds.modify_db_parameter_group(DBParameterGroupName=pg, Parameters=[
            {"ParameterName": "rds.force_ssl", "ParameterValue": "1", "ApplyMethod": "pending-reboot"},
            {"ParameterName": "log_min_duration_statement", "ParameterValue": "1000", "ApplyMethod": "immediate"}])

    db = find_db(ctx)
    if db:
        out("keep", "rds instance", DB_ID, f"{db['DBInstanceClass']} {db['Engine']} {db['EngineVersion']} {db['DBInstanceStatus']}")
        return
    versions = sorted(
        (v["EngineVersion"] for v in rds.describe_db_engine_versions(Engine="postgres", Filters=[{"Name": "engine-mode", "Values": ["provisioned"]}])["DBEngineVersions"]
         if v["EngineVersion"].split(".")[0] == r["engine_major"]),
        key=lambda s: [int(x) for x in s.split(".")])
    version = versions[-1] if versions else r["engine_major"]
    multi_az = bool(r.get("multi_az", False))
    out("create", "rds instance", DB_ID, f"{r['instance_class']} PostgreSQL {version}, {r['storage_gb']} GB gp3 encrypted, "
        f"{'Multi-AZ' if multi_az else 'Single-AZ'}, private, {r['backup_retention_days']}-day backups, deletion protection; {r.get('cost_note', '')}")
    if not apply:
        return
    master_param = f"{PARAM_PREFIX}/admin/DB_MASTER_PASSWORD"
    if not param_exists(ctx, master_param):
        ctx.c("ssm").put_parameter(Name=master_param, Value=random_secret(40), Type="SecureString", Tier="Standard",
                                   Description=f"B-Seva {ENV} RDS master password", Tags=tag_list())
    password = ctx.c("ssm").get_parameter(Name=master_param, WithDecryption=True)["Parameter"]["Value"]
    rds.create_db_instance(
        DBInstanceIdentifier=DB_ID, DBInstanceClass=r["instance_class"], Engine="postgres", EngineVersion=version,
        DBName=r["db_name"], MasterUsername=r["master_username"], MasterUserPassword=password,
        AllocatedStorage=r["storage_gb"], MaxAllocatedStorage=r["max_storage_gb"], StorageType="gp3", StorageEncrypted=True,
        DBSubnetGroupName=sng, VpcSecurityGroupIds=[ids["sg-db"]], DBParameterGroupName=pg, PubliclyAccessible=False,
        MultiAZ=multi_az, **({} if multi_az else {"AvailabilityZone": CFG["ec2"]["availability_zone"]}),
        BackupRetentionPeriod=r["backup_retention_days"],
        PreferredBackupWindow="20:30-21:00", PreferredMaintenanceWindow="sun:21:30-sun:22:00", AutoMinorVersionUpgrade=True,
        CopyTagsToSnapshot=True, DeletionProtection=True, EnablePerformanceInsights=bool(r.get("performance_insights", False)), Tags=tag_list({"Name": DB_ID}))
    print("    waiting for RDS to become available (typically 5–10 minutes)…")
    rds.get_waiter("db_instance_available").wait(DBInstanceIdentifier=DB_ID, WaiterConfig={"Delay": 30, "MaxAttempts": 60})


def user_data() -> str:
    return (REPO / "deploy" / "host" / "bootstrap.sh").read_text(encoding="utf-8")


def step_compute(ctx, apply: bool, ids: dict):
    ec2 = ctx.c("ec2")
    e = CFG["ec2"]
    inst = find_instance(ctx)
    if inst:
        out("keep", "ec2 instance", f"{P}-app", f"{inst['InstanceId']} {inst['InstanceType']} {inst['State']['Name']}")
    else:
        out("create", "ec2 instance", f"{P}-app", f"{e['instance_type']} arm64 AL2023, {e['root_volume_gb']} GB gp3 encrypted, IMDSv2, "
            "CPU credits standard, no SSH key; ≈$8.2/month")
        if apply:
            ami = ctx.c("ssm").get_parameter(Name=e["ami_parameter"])["Parameter"]["Value"]
            for attempt in range(12):  # a newly created instance profile takes a few seconds to propagate
                try:
                    inst = ec2.run_instances(
                        ImageId=ami, InstanceType=e["instance_type"], MinCount=1, MaxCount=1,
                        SubnetId=ids[f"public-{e['availability_zone']}"], SecurityGroupIds=[ids["sg-web"]],
                        IamInstanceProfile={"Name": EC2_ROLE}, UserData=user_data(),
                        CreditSpecification={"CpuCredits": "standard"},
                        MetadataOptions={"HttpTokens": "required", "HttpPutResponseHopLimit": 2, "HttpEndpoint": "enabled"},
                        BlockDeviceMappings=[{"DeviceName": "/dev/xvda", "Ebs": {"VolumeSize": e["root_volume_gb"], "VolumeType": "gp3",
                                                                                 "Encrypted": True, "DeleteOnTermination": True}}],
                        DisableApiTermination=True,
                        TagSpecifications=tag_spec("instance", f"{P}-app") + tag_spec("volume", f"{P}-app-root"),
                    )["Instances"][0]
                    break
                except ClientError as exc:
                    if exc.response["Error"]["Code"] != "InvalidParameterValue" or attempt == 11:
                        raise
                    time.sleep(10)
            ec2.get_waiter("instance_running").wait(InstanceIds=[inst["InstanceId"]])

    addrs = ec2.describe_addresses(Filters=[{"Name": "tag:Name", "Values": [f"{P}-eip"]}])["Addresses"]
    out("keep" if addrs else "create", "elastic ip", f"{P}-eip", addrs[0]["PublicIp"] if addrs else "public IPv4 $0.005/h ≈ $3.65/month")
    if not addrs and apply:
        alloc = ec2.allocate_address(Domain="vpc", TagSpecifications=tag_spec("elastic-ip", f"{P}-eip"))
        ec2.associate_address(AllocationId=alloc["AllocationId"], InstanceId=inst["InstanceId"])
        print(f"    Elastic IP {alloc['PublicIp']} → create DNS A record: {CFG['domain']} → {alloc['PublicIp']}")


def step_alarms(ctx, apply: bool):
    sns = ctx.c("sns")
    cw = ctx.c("cloudwatch")
    topic_name = f"{P}-alerts"
    topics = [t["TopicArn"] for t in sns.list_topics().get("Topics", []) if t["TopicArn"].endswith(f":{topic_name}")]
    out("keep" if topics else "create", "sns topic", topic_name, "" if topics else "email alerts (each recipient must confirm); free")
    if not topics and apply:
        arn = sns.create_topic(Name=topic_name, Tags=tag_list())["TopicArn"]
        for email in CFG["alert_emails"]:
            sns.subscribe(TopicArn=arn, Protocol="email", Endpoint=email)
        topics = [arn]
    existing = {a["AlarmName"] for a in cw.describe_alarms(AlarmNamePrefix=P)["MetricAlarms"]}
    inst = find_instance(ctx) if apply else None
    alarms = [
        (f"{P}-ec2-system-check", "auto-recover on host failure"),
        (f"{P}-ec2-instance-check", "instance status check failed"),
        (f"{P}-rds-free-storage", "free storage < 2 GB"),
        (f"{P}-rds-cpu", "CPU > 80% for 15 min"),
    ]
    if CFG.get("capacity_alarms"):
        alarms += [(f"{P}-ec2-cpu-credits", "burst credits < 30 for 15 min (host would slow to baseline)"),
                   (f"{P}-rds-free-memory", "freeable memory < 64 MB for 15 min")]
    for name, note in alarms:
        out("keep" if name in existing else "create", "cloudwatch alarm", name, note + ("" if name in existing else "; free tier"))
    if not apply:
        return
    topic = topics[0]
    iid = inst["InstanceId"] if inst else None
    specs = {
        f"{P}-ec2-system-check": dict(Namespace="AWS/EC2", MetricName="StatusCheckFailed_System", Dimensions=[{"Name": "InstanceId", "Value": iid}],
                                      Statistic="Maximum", Period=60, EvaluationPeriods=2, Threshold=1, ComparisonOperator="GreaterThanOrEqualToThreshold",
                                      AlarmActions=[f"arn:aws:automate:{REGION}:ec2:recover", topic]),
        f"{P}-ec2-instance-check": dict(Namespace="AWS/EC2", MetricName="StatusCheckFailed_Instance", Dimensions=[{"Name": "InstanceId", "Value": iid}],
                                        Statistic="Maximum", Period=60, EvaluationPeriods=3, Threshold=1, ComparisonOperator="GreaterThanOrEqualToThreshold",
                                        AlarmActions=[topic]),
        f"{P}-rds-free-storage": dict(Namespace="AWS/RDS", MetricName="FreeStorageSpace", Dimensions=[{"Name": "DBInstanceIdentifier", "Value": DB_ID}],
                                      Statistic="Minimum", Period=300, EvaluationPeriods=1, Threshold=2 * 1024 ** 3, ComparisonOperator="LessThanThreshold",
                                      AlarmActions=[topic]),
        f"{P}-rds-cpu": dict(Namespace="AWS/RDS", MetricName="CPUUtilization", Dimensions=[{"Name": "DBInstanceIdentifier", "Value": DB_ID}],
                             Statistic="Average", Period=300, EvaluationPeriods=3, Threshold=80, ComparisonOperator="GreaterThanThreshold",
                             AlarmActions=[topic]),
        f"{P}-ec2-cpu-credits": dict(Namespace="AWS/EC2", MetricName="CPUCreditBalance", Dimensions=[{"Name": "InstanceId", "Value": iid}],
                                     Statistic="Minimum", Period=300, EvaluationPeriods=3, Threshold=30, ComparisonOperator="LessThanThreshold",
                                     AlarmActions=[topic]),
        f"{P}-rds-free-memory": dict(Namespace="AWS/RDS", MetricName="FreeableMemory", Dimensions=[{"Name": "DBInstanceIdentifier", "Value": DB_ID}],
                                     Statistic="Minimum", Period=300, EvaluationPeriods=3, Threshold=64 * 1024 ** 2, ComparisonOperator="LessThanThreshold",
                                     AlarmActions=[topic]),
    }
    specs = {k: v for k, v in specs.items() if k in dict(alarms)}
    for name, spec in specs.items():
        if name not in existing and (iid or "rds" in name):
            cw.put_metric_alarm(AlarmName=name, TreatMissingData="notBreaching", Tags=tag_list(), **spec)


def step_parameters(ctx, apply: bool):
    ssm = ctx.c("ssm")
    base = f"{PARAM_PREFIX}/app"
    wanted = dict(CFG["app_parameters"])
    wanted.update({"S3_BUCKET": BUCKET, "AWS_REGION": REGION})
    # Production never seeds demo data; its JWT_SECRET may later be replaced by the Vercel one to keep sessions.
    generated = ("JWT_SECRET",) if ENV == "production" else ("JWT_SECRET", "SEED_PASSWORD")
    missing = [k for k in list(wanted) + list(generated) + ["DATABASE_URL"] if not param_exists(ctx, f"{base}/{k}")]
    out("keep" if not missing else "create", "ssm parameters", f"{base}/*",
        f"{len(missing)} to create (secrets generated, DATABASE_URL from RDS); Standard tier, free" if missing else "")
    if not apply:
        return
    for k, v in wanted.items():
        if k in missing:
            ssm.put_parameter(Name=f"{base}/{k}", Value=v, Type="String", Tier="Standard", Tags=tag_list())
    for k in generated:
        if k in missing:
            ssm.put_parameter(Name=f"{base}/{k}", Value=random_secret(48), Type="SecureString", Tier="Standard", Tags=tag_list())
    if "DATABASE_URL" in missing:
        db = find_db(ctx)
        password = ssm.get_parameter(Name=f"{PARAM_PREFIX}/admin/DB_MASTER_PASSWORD", WithDecryption=True)["Parameter"]["Value"]
        url = f"postgresql://{CFG['rds']['master_username']}:{password}@{db['Endpoint']['Address']}:5432/{CFG['rds']['db_name']}"
        ssm.put_parameter(Name=f"{base}/DATABASE_URL", Value=url, Type="SecureString", Tier="Standard", Tags=tag_list())


STEPS = ("guardrails", "budget", "trail", "network", "storage", "iam", "database", "compute", "parameters", "alarms")


def run_steps(ctx, apply: bool) -> None:
    ids: dict = {}
    for name in STEPS:
        print(f"[{name}]")
        if name == "network":
            ids = step_network(ctx, apply)
        elif name == "database":
            step_database(ctx, apply, ids)
        elif name == "compute":
            step_compute(ctx, apply, ids)
        else:
            globals()[f"step_{name}"](ctx, apply)


# ------------------------------------------------------------------ commands

def cmd_plan(ctx, _args):
    print(f"Plan for {P} in {ACCOUNT}/{REGION} (read-only)\n")
    run_steps(ctx, apply=False)
    print("\nNo NAT gateway, load balancer, EKS, ElastiCache or extra instances are part of this plan.")


def cmd_apply(ctx, args):
    if not args.yes:
        sys.exit("apply creates billable resources; re-run with --yes after reviewing `plan`")
    print(f"Applying {P} in {ACCOUNT}/{REGION}\n")
    run_steps(ctx, apply=True)
    print("\nApply complete. Next: DNS A record, `set-params`, GitHub environment, first deploy.")


def cmd_status(ctx, _args):
    inst = find_instance(ctx)
    db = find_db(ctx)
    eip = ctx.c("ec2").describe_addresses(Filters=[{"Name": "tag:Name", "Values": [f"{P}-eip"]}])["Addresses"]
    print(json.dumps({
        "vpc": find_vpc(ctx),
        "instance": inst and {"id": inst["InstanceId"], "type": inst["InstanceType"], "state": inst["State"]["Name"]},
        "elastic_ip": eip[0]["PublicIp"] if eip else None,
        "rds": db and {"id": DB_ID, "class": db["DBInstanceClass"], "status": db["DBInstanceStatus"], "version": db["EngineVersion"],
                       "public": db["PubliclyAccessible"], "encrypted": db["StorageEncrypted"], "multi_az": db["MultiAZ"]},
        "bucket": BUCKET if bucket_exists(ctx, BUCKET) else None,
        "ecr": [r for r in REPOS if ignore(("RepositoryNotFoundException",))(lambda x=r: ctx.c("ecr").describe_repositories(repositoryNames=[x]))],
        "roles": [r for r in (EC2_ROLE, DEPLOY_ROLE) if role_exists(ctx, r)],
        "oidc_provider": oidc_exists(ctx),
    }, indent=2, default=str))


def cmd_set_params(ctx, args):
    """KEY=VALUE lines; names ending in _JSON or listed under [files] go to /files/. Values are never printed."""
    ssm = ctx.c("ssm")
    count = 0
    for raw in Path(args.from_file).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not key.replace("_", "").isalnum() or not value:
            continue
        kind = "files" if key.endswith("_JSON_FILE") else "app"
        name = key[: -len("_JSON_FILE")] + ".json" if kind == "files" else key
        if kind == "files":
            value = Path(value).expanduser().read_text(encoding="utf-8")
            value = json.dumps(json.loads(value), separators=(",", ":"))
        ssm.put_parameter(Name=f"{PARAM_PREFIX}/{kind}/{name}", Value=value, Type="SecureString", Tier="Standard", Overwrite=True)
        count += 1
        print(f"  stored {PARAM_PREFIX}/{kind}/{name} (SecureString, {len(value)} chars)")
    print(f"{count} parameters stored")


def cmd_health(ctx, _args):
    url = f"https://{CFG['domain']}/api/ready"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            body = json.loads(resp.read().decode())
            print(f"{url}: {resp.status} {body}")
    except Exception as exc:
        print(f"{url}: FAILED ({type(exc).__name__}: {exc})")
    inst = find_instance(ctx)
    db = find_db(ctx)
    print(f"instance: {inst and inst['State']['Name']}   rds: {db and db['DBInstanceStatus']}")


def cmd_backup_check(ctx, _args):
    db = find_db(ctx)
    if not db:
        sys.exit(f"no {LABEL} database")
    snaps = ctx.c("rds").describe_db_snapshots(DBInstanceIdentifier=DB_ID, SnapshotType="automated")["DBSnapshots"]
    latest = max((s["SnapshotCreateTime"] for s in snaps), default=None)
    print(json.dumps({"backup_retention_days": db["BackupRetentionPeriod"], "latest_restorable_time": db.get("LatestRestorableTime"),
                      "automated_snapshots": len(snaps), "latest_snapshot": latest}, indent=2, default=str))


def cmd_teardown(ctx, args):
    if ENV != "qa":
        sys.exit("Refusing: teardown is only supported for QA. Production resources are removed by hand after separate approval.")
    expected = f"qa-{ACCOUNT}"
    if args.confirm != expected:
        sys.exit(f"teardown deletes the QA environment; pass --confirm {expected}")
    ec2, rds = ctx.c("ec2"), ctx.c("rds")
    inst = find_instance(ctx)
    if inst:
        ec2.modify_instance_attribute(InstanceId=inst["InstanceId"], DisableApiTermination={"Value": False})
        ec2.terminate_instances(InstanceIds=[inst["InstanceId"]])
        ec2.get_waiter("instance_terminated").wait(InstanceIds=[inst["InstanceId"]])
        print("terminated", inst["InstanceId"])
    for a in ec2.describe_addresses(Filters=[{"Name": "tag:Name", "Values": [f"{P}-eip"]}])["Addresses"]:
        ec2.release_address(AllocationId=a["AllocationId"])
        print("released", a["PublicIp"])
    db = find_db(ctx)
    if db:
        rds.modify_db_instance(DBInstanceIdentifier=DB_ID, DeletionProtection=False, ApplyImmediately=True)
        snap = f"{DB_ID}-final-{time.strftime('%Y%m%d%H%M')}"
        rds.delete_db_instance(DBInstanceIdentifier=DB_ID, SkipFinalSnapshot=False, FinalDBSnapshotIdentifier=snap, DeleteAutomatedBackups=False)
        print(f"deleting {DB_ID}; final snapshot {snap} is kept (≈$0.095/GB-month beyond free backup storage)")
    print("Kept: VPC, security groups, S3 bucket, ECR images, IAM roles, SSM parameters, budget, CloudTrail (all ≈$0). "
          "Remove them manually if QA is retired permanently.")


def main() -> int:
    parser = argparse.ArgumentParser(description="B-Seva AWS infrastructure (ap-south-1)")
    parser.add_argument("--env", choices=ENVIRONMENTS, default="qa", help="environment config to manage (default qa)")
    parser.add_argument("--env-file", help="credentials file (e.g. aws-script/aws.env); default boto3 chain otherwise")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("plan")
    p_apply = sub.add_parser("apply")
    p_apply.add_argument("--yes", action="store_true")
    sub.add_parser("status")
    p_params = sub.add_parser("set-params")
    p_params.add_argument("--from-file", required=True)
    sub.add_parser("health")
    sub.add_parser("backup-check")
    p_down = sub.add_parser("teardown")
    p_down.add_argument("--confirm", default="")
    parser.add_argument("--account-guardrails", action="store_true",
                        help="also enable account-wide EBS default encryption and S3 Block Public Access (separately approved)")
    args = parser.parse_args()
    global ACCOUNT_GUARDRAILS
    ACCOUNT_GUARDRAILS = args.account_guardrails
    ctx = Ctx(args.env_file)
    caller = ctx.guard()
    print(f"caller: {caller}  account: {ACCOUNT}  region: {REGION}  env: {ENV}")
    {"plan": cmd_plan, "apply": cmd_apply, "status": cmd_status, "set-params": cmd_set_params, "health": cmd_health,
     "backup-check": cmd_backup_check, "teardown": cmd_teardown}[args.cmd](ctx, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
