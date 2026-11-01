#!/usr/bin/env python3
"""Production gate: find the successful QA deploy of exactly the code being released.

A develop → main merge commit has a new SHA but the same tree as the develop commit QA deployed, so the
match is on the git tree: the release commit's tree must equal the tree of a `develop` commit whose
"QA deploy" run (tests, build, migrations, deploy, health checks) succeeded. That run's image tag is the
artifact Production promotes.

Env: GITHUB_TOKEN, GITHUB_REPOSITORY, RELEASE_SHA (default HEAD), QA_WORKFLOW (default qa-deploy.yml),
GITHUB_OUTPUT (optional). Needs the full git history (actions/checkout fetch-depth: 0).
Exits 1 when no QA-passed commit matches.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request

REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GITHUB_TOKEN"]
RELEASE = os.environ.get("RELEASE_SHA") or "HEAD"
WORKFLOW = os.environ.get("QA_WORKFLOW", "qa-deploy.yml")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout.strip()


def tree_of(sha: str) -> str | None:
    try:
        return git("rev-parse", f"{sha}^{{tree}}")
    except subprocess.CalledProcessError:
        return None


def qa_runs() -> list[dict]:
    url = (f"https://api.github.com/repos/{REPO}/actions/workflows/{WORKFLOW}/runs"
           "?branch=develop&status=success&per_page=50")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}",
                                               "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)["workflow_runs"]


def main() -> int:
    release_sha = git("rev-parse", RELEASE)
    release_tree = tree_of(release_sha)
    for run in qa_runs():  # newest first
        if run.get("conclusion") != "success" or run.get("head_branch") != "develop":
            continue
        sha = run["head_sha"]
        if tree_of(sha) == release_tree:
            out = {"qa_sha": sha, "tag": f"sha-{sha[:12]}", "qa_run": run["html_url"]}
            print(json.dumps({"event": "qa_gate_pass", "release_sha": release_sha, **out}))
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
                    for key, value in out.items():
                        fh.write(f"{key}={value}\n")
            return 0
    print(json.dumps({"event": "qa_gate_fail", "release_sha": release_sha, "release_tree": release_tree,
                      "reason": "no successful QA deploy of develop has this exact code; merge to develop and let QA pass first"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
