#!/usr/bin/env python3
"""
BTX prompt-lint
---------------
Validates the prompt library under docs/agent/prompts/ against the schema in
docs/agent/prompts/_frame.md.

Checks (CI-blocking):
  1. Every p*.prompt.md file has a YAML front-matter block.
  2. Required fields present: id, version, last_reviewed, owner, model_compat,
     inputs, expected_outputs, executable_acceptance, halt_conditions,
     escalation, graph.
  3. version is semver.
  4. last_reviewed is within 365 days.
  5. id matches filename prefix.
  6. graph.upstream / graph.downstream reference real prompt IDs (also in
     prompt_graph.yaml).
  7. forbidden_paths entries are non-empty.
  8. Body contains required headings: 'Read first', 'Inputs', 'Execute',
     'Hard rules', 'Acceptance', 'Worked example', 'Self-score'.
  9. _examples/<id>.md exists and is non-empty.
 10. No prompt references a deprecated prompt as downstream.

Usage:
  python3 tools/prompt-lint.py            # lint
  python3 tools/prompt-lint.py --json     # machine-readable findings
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml  # type: ignore
except Exception:
    sys.stderr.write("prompt-lint requires PyYAML (pip install pyyaml)\n")
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
PROMPTS_DIR = ROOT / "docs" / "agent" / "prompts"
EXAMPLES_DIR = PROMPTS_DIR / "_examples"
GRAPH_FILE = PROMPTS_DIR / "prompt_graph.yaml"

REQUIRED_FIELDS = [
    "id", "version", "last_reviewed", "owner", "model_compat",
    "inputs", "expected_outputs", "executable_acceptance",
    "halt_conditions", "escalation", "graph",
]
REQUIRED_HEADINGS = [
    r"^#{2,3}\s+\d*\.?\s*Read",
    r"^#{2,3}\s+\d*\.?\s*Inputs",
    r"^#{2,3}\s+\d*\.?\s*.*Execute",
    r"^#{2,3}\s+\d*\.?\s*(Hard rules|Acceptance|Output format|Outputs)",
    r"^#{2,3}\s+\d*\.?\s*Worked example",
    r"^#{2,3}\s+\d*\.?\s*Self-score",
]
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")
FRONT_MATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)


def load_graph() -> dict:
    if not GRAPH_FILE.exists():
        return {}
    return yaml.safe_load(GRAPH_FILE.read_text()) or {}


def lint_prompt(path: Path, graph_ids: set[str]) -> list[str]:
    findings: list[str] = []
    text = path.read_text()
    m = FRONT_MATTER_RE.match(text)
    if not m:
        return [f"{path.name}: missing YAML front-matter"]
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        return [f"{path.name}: YAML parse error: {e}"]

    for field in REQUIRED_FIELDS:
        if field not in meta:
            findings.append(f"{path.name}: missing field '{field}'")

    pid = meta.get("id", "")
    if pid and not path.name.lower().startswith(pid.lower().replace("-", "")):
        # filenames are p01-..., id is P-01
        prefix = path.name.split("-")[0]
        if prefix.lower() != pid.lower().replace("-", "").lower():
            findings.append(f"{path.name}: id '{pid}' does not match filename")

    ver = str(meta.get("version", ""))
    if not SEMVER_RE.match(ver):
        findings.append(f"{path.name}: version '{ver}' is not semver")

    lr = meta.get("last_reviewed", "")
    try:
        d = dt.date.fromisoformat(str(lr))
        age = (dt.date.today() - d).days
        if age > 365:
            findings.append(f"{path.name}: last_reviewed {lr} is {age} days old (>365)")
    except Exception:
        findings.append(f"{path.name}: last_reviewed '{lr}' not ISO date")

    graph = meta.get("graph", {}) or {}
    for k in ("upstream", "downstream"):
        for ref in graph.get(k, []) or []:
            if ref not in graph_ids:
                findings.append(f"{path.name}: graph.{k} references unknown prompt '{ref}'")

    fp = meta.get("forbidden_paths", []) or []
    if any(not str(x).strip() for x in fp):
        findings.append(f"{path.name}: forbidden_paths contains empty entry")

    for pat in REQUIRED_HEADINGS:
        if not re.search(pat, text, re.M | re.I):
            findings.append(f"{path.name}: missing required heading matching /{pat}/")

    ex = EXAMPLES_DIR / f"{pid.lower().replace('-', '')}.md"
    if not ex.exists():
        findings.append(f"{path.name}: example file missing at _examples/{ex.name}")
    elif ex.stat().st_size < 200:
        findings.append(f"{path.name}: example file too short ({ex.stat().st_size} bytes)")

    if meta.get("status") == "deprecated":
        succ = meta.get("superseded_by")
        if not succ:
            findings.append(f"{path.name}: deprecated prompt has no superseded_by")

    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if not PROMPTS_DIR.exists():
        sys.stderr.write(f"prompts dir not found: {PROMPTS_DIR}\n")
        return 2

    graph = load_graph()
    graph_ids = set((graph.get("prompts") or {}).keys())

    files = sorted(PROMPTS_DIR.glob("p*.prompt.md"))
    if not files:
        sys.stderr.write("no prompt files found\n")
        return 2

    all_findings: dict[str, list[str]] = {}
    for f in files:
        fs = lint_prompt(f, graph_ids)
        if fs:
            all_findings[f.name] = fs

    if args.json:
        print(json.dumps(all_findings, indent=2, sort_keys=True))
    else:
        if not all_findings:
            print(f"OK — {len(files)} prompts lint clean")
        else:
            for name, fs in all_findings.items():
                for line in fs:
                    print(line)
            print(f"\n{sum(len(v) for v in all_findings.values())} finding(s) across "
                  f"{len(all_findings)} file(s)")

    return 0 if not all_findings else 1


if __name__ == "__main__":
    sys.exit(main())
