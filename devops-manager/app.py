"""
DevOps Manager — Application locale autonome pour gérer le CI/CD,
les backups, les tests E2E, le versioning et les déploiements de l'extranet EMS.

Usage :
    python app.py              # démarre sur http://127.0.0.1:9000
    start.bat                  # alternative Windows (crée le venv si absent)

Sécurité : écoute uniquement sur 127.0.0.1 (pas accessible depuis le réseau).
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Chemins
# ---------------------------------------------------------------------------
APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
CONFIG_PATH = APP_DIR / "config.json"
HISTORY_PATH = APP_DIR / "history.json"

# Racine du projet extranet (parent de devops-manager/)
PROJECT_ROOT = APP_DIR.parent
BACKUPS_DIR = PROJECT_ROOT / "backups"
BACKUP_LOG = BACKUPS_DIR / "backup.log"

# ---------------------------------------------------------------------------
# Configuration persistante
# ---------------------------------------------------------------------------
DEFAULT_CONFIG = {
    "github": {
        "owner": "",
        "repo": "",
        "branch": "main",
        "pat": "",
    },
    "paths": {
        "project_root": str(PROJECT_ROOT),
        "backups_dir": str(BACKUPS_DIR),
    },
    "services": {
        "backend_url": "http://localhost:8000",
        "frontend_url": "http://localhost:5173",
    },
}


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return json.loads(json.dumps(DEFAULT_CONFIG))
    try:
        with CONFIG_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        # Merge with defaults so new keys appear
        merged = json.loads(json.dumps(DEFAULT_CONFIG))
        for section, values in data.items():
            if isinstance(values, dict) and section in merged:
                merged[section].update(values)
            else:
                merged[section] = values
        return merged
    except Exception:
        return json.loads(json.dumps(DEFAULT_CONFIG))


def save_config(cfg: dict) -> None:
    with CONFIG_PATH.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def mask_pat(pat: str) -> str:
    if not pat:
        return ""
    if len(pat) <= 4:
        return "***"
    return f"***{pat[-4:]}"


def load_history() -> list[dict]:
    if not HISTORY_PATH.exists():
        return []
    try:
        with HISTORY_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def append_history(entry: dict) -> None:
    hist = load_history()
    entry["timestamp"] = datetime.utcnow().isoformat() + "Z"
    hist.insert(0, entry)
    hist = hist[:50]
    with HISTORY_PATH.open("w", encoding="utf-8") as f:
        json.dump(hist, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Jobs en cours (streaming d'output)
# ---------------------------------------------------------------------------
JOBS: dict[str, dict] = {}


def create_job(label: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "id": job_id,
        "label": label,
        "status": "running",
        "exit_code": None,
        "output": [],
        "started_at": time.time(),
        "finished_at": None,
    }
    return job_id


def finish_job(job_id: str, exit_code: int) -> None:
    job = JOBS.get(job_id)
    if not job:
        return
    job["exit_code"] = exit_code
    job["status"] = "success" if exit_code == 0 else "failure"
    job["finished_at"] = time.time()


async def stream_subprocess(
    job_id: str,
    args: list[str],
    cwd: Optional[Path] = None,
    shell: bool = False,
) -> int:
    job = JOBS[job_id]
    job["output"].append(f"$ {' '.join(args) if isinstance(args, list) else args}")
    try:
        if shell:
            proc = await asyncio.create_subprocess_shell(
                args if isinstance(args, str) else " ".join(args),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(cwd) if cwd else None,
            )
        else:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(cwd) if cwd else None,
            )
        assert proc.stdout is not None
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            try:
                decoded = line.decode("utf-8", errors="replace").rstrip()
            except Exception:
                decoded = repr(line)
            job["output"].append(decoded)
            if len(job["output"]) > 5000:
                job["output"] = job["output"][-2500:]
        rc = await proc.wait()
        finish_job(job_id, rc)
        return rc
    except FileNotFoundError as e:
        job["output"].append(f"[ERROR] Commande introuvable : {e}")
        finish_job(job_id, 127)
        return 127
    except Exception as e:
        job["output"].append(f"[ERROR] {e}")
        finish_job(job_id, 1)
        return 1


# ---------------------------------------------------------------------------
# Helpers GitHub
# ---------------------------------------------------------------------------
def github_headers(pat: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {pat}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def require_github_config() -> dict:
    cfg = load_config()
    gh = cfg.get("github", {})
    if not (gh.get("owner") and gh.get("repo") and gh.get("pat")):
        raise HTTPException(
            status_code=400,
            detail="GitHub non configuré : renseignez owner, repo et PAT dans l'onglet Paramètres.",
        )
    return gh


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="EMS DevOps Manager", version="1.0.0")


# ====================== Config ======================
class ConfigPayload(BaseModel):
    github: Optional[dict] = None
    paths: Optional[dict] = None
    services: Optional[dict] = None


@app.get("/api/config")
def api_get_config():
    cfg = load_config()
    # Mask the PAT
    safe = json.loads(json.dumps(cfg))
    pat = safe.get("github", {}).get("pat", "")
    safe["github"]["pat"] = mask_pat(pat)
    safe["github"]["pat_set"] = bool(pat)
    return safe


@app.put("/api/config")
def api_put_config(payload: ConfigPayload):
    cfg = load_config()
    if payload.github is not None:
        # If PAT is masked (starts with ***), keep the existing one
        new_gh = dict(payload.github)
        if new_gh.get("pat", "").startswith("***"):
            new_gh["pat"] = cfg.get("github", {}).get("pat", "")
        cfg["github"].update(new_gh)
    if payload.paths is not None:
        cfg["paths"].update(payload.paths)
    if payload.services is not None:
        cfg["services"].update(payload.services)
    save_config(cfg)
    safe = json.loads(json.dumps(cfg))
    safe["github"]["pat"] = mask_pat(safe["github"].get("pat", ""))
    safe["github"]["pat_set"] = bool(cfg["github"].get("pat"))
    return safe


# ====================== GitHub Actions ======================
@app.get("/api/github/runs")
def github_runs(workflow: str = Query("ci"), per_page: int = Query(10, le=50)):
    gh = require_github_config()
    wf_file = {
        "ci": "ci.yml",
        "backup": "backup-db.yml",
    }.get(workflow, workflow if workflow.endswith(".yml") else f"{workflow}.yml")
    url = f"https://api.github.com/repos/{gh['owner']}/{gh['repo']}/actions/workflows/{wf_file}/runs"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=github_headers(gh["pat"]), params={"per_page": per_page})
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API: {e.response.status_code} {e.response.text[:200]}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Injoignable: {e}")


class TriggerPayload(BaseModel):
    ref: Optional[str] = None
    inputs: Optional[dict] = None


@app.post("/api/github/trigger/{workflow}")
def github_trigger(workflow: str, payload: TriggerPayload | None = None):
    gh = require_github_config()
    wf_file = {
        "ci": "ci.yml",
        "backup": "backup-db.yml",
    }.get(workflow, workflow if workflow.endswith(".yml") else f"{workflow}.yml")
    ref = (payload.ref if payload else None) or gh.get("branch") or "main"
    body: dict[str, Any] = {"ref": ref}
    if payload and payload.inputs:
        body["inputs"] = payload.inputs
    url = f"https://api.github.com/repos/{gh['owner']}/{gh['repo']}/actions/workflows/{wf_file}/dispatches"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=github_headers(gh["pat"]), json=body)
            if resp.status_code not in (201, 204):
                raise HTTPException(status_code=502, detail=f"GitHub API: {resp.status_code} {resp.text[:200]}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Injoignable: {e}")
    append_history({"type": "ci_trigger", "workflow": wf_file, "ref": ref})
    return {"ok": True, "workflow": wf_file, "ref": ref}


@app.get("/api/github/releases")
def github_releases(per_page: int = Query(20, le=100)):
    gh = require_github_config()
    url = f"https://api.github.com/repos/{gh['owner']}/{gh['repo']}/releases"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=github_headers(gh["pat"]), params={"per_page": per_page})
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Injoignable: {e}")


class ReleasePayload(BaseModel):
    tag_name: str
    name: Optional[str] = None
    body: Optional[str] = None
    target_commitish: Optional[str] = None
    draft: bool = False
    prerelease: bool = False


@app.post("/api/github/releases")
def github_create_release(payload: ReleasePayload):
    gh = require_github_config()
    url = f"https://api.github.com/repos/{gh['owner']}/{gh['repo']}/releases"
    body = payload.model_dump(exclude_none=True)
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, headers=github_headers(gh["pat"]), json=body)
            if resp.status_code not in (200, 201):
                raise HTTPException(status_code=502, detail=f"GitHub API: {resp.status_code} {resp.text[:300]}")
            data = resp.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Injoignable: {e}")
    append_history({"type": "release_created", "tag": payload.tag_name, "url": data.get("html_url")})
    return data


# ====================== Backups ======================
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9._-]+$")


def _validate_backup_filename(filename: str) -> Path:
    if not filename or not SAFE_FILENAME.match(filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")
    path = BACKUPS_DIR / filename
    try:
        path.resolve().relative_to(BACKUPS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Chemin invalide")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return path


@app.get("/api/backups")
def list_backups():
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for p in sorted(BACKUPS_DIR.glob("*.sql*"), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file():
            stat = p.stat()
            files.append({
                "name": p.name,
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return {"count": len(files), "total_mb": round(sum(f["size_mb"] for f in files), 2), "files": files}


@app.get("/api/backups/log")
def backup_log(lines: int = Query(100, le=500)):
    if not BACKUP_LOG.exists():
        return {"lines": [], "path": str(BACKUP_LOG)}
    try:
        with BACKUP_LOG.open("r", encoding="utf-8", errors="replace") as f:
            content = f.readlines()
        return {"lines": [line.rstrip() for line in content[-lines:]], "path": str(BACKUP_LOG)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/backups/trigger")
async def trigger_backup(keep_last: int = Query(30, ge=1, le=365), compress: bool = Query(True)):
    script = PROJECT_ROOT / "backup-db.ps1"
    if not script.exists():
        raise HTTPException(status_code=404, detail=f"backup-db.ps1 introuvable à {script}")
    job_id = create_job(f"backup (keep_last={keep_last}, compress={compress})")
    args = [
        "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", str(script),
        "-KeepLast", str(keep_last),
    ]
    if compress:
        args.append("-Compress")
    asyncio.create_task(stream_subprocess(job_id, args, cwd=PROJECT_ROOT))
    append_history({"type": "backup_trigger", "job_id": job_id})
    return {"job_id": job_id}


@app.get("/api/backups/{filename}/download")
def download_backup(filename: str):
    path = _validate_backup_filename(filename)
    return FileResponse(path, filename=filename, media_type="application/octet-stream")


@app.delete("/api/backups/{filename}")
def delete_backup(filename: str):
    path = _validate_backup_filename(filename)
    path.unlink()
    append_history({"type": "backup_deleted", "filename": filename})
    return {"ok": True}


# ====================== E2E Playwright ======================
@app.post("/api/e2e/seed")
async def e2e_seed():
    job_id = create_job("e2e seed (docker compose)")
    args = ["docker", "compose", "run", "--rm", "backend-test", "python", "e2e_seed.py"]
    asyncio.create_task(stream_subprocess(job_id, args, cwd=PROJECT_ROOT))
    return {"job_id": job_id}


@app.post("/api/e2e/run")
async def e2e_run(spec: str = Query("all")):
    allowed = {"all", "auth", "leave-request", "mission-multi-segments"}
    if spec not in allowed:
        raise HTTPException(status_code=400, detail=f"spec invalide (autorisés: {sorted(allowed)})")
    job_id = create_job(f"playwright test ({spec})")
    frontend_dir = PROJECT_ROOT / "frontend"
    if spec == "all":
        args = ["npx", "playwright", "test"]
    else:
        args = ["npx", "playwright", "test", f"e2e/{spec}.spec.js"]
    # Windows needs shell=True for npx
    asyncio.create_task(stream_subprocess(job_id, args, cwd=frontend_dir, shell=True))
    return {"job_id": job_id}


@app.get("/api/e2e/report")
def e2e_report():
    report = PROJECT_ROOT / "frontend" / "playwright-report" / "index.html"
    results = PROJECT_ROOT / "frontend" / "test-results"
    return {
        "report_exists": report.exists(),
        "report_path": str(report),
        "results_dir": str(results),
    }


# ====================== Git / Versioning / Deploy ======================
def _git_run(args: list[str], cwd: Optional[Path] = None) -> tuple[int, str]:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=str(cwd or PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
        return result.returncode, (result.stdout + result.stderr).strip()
    except FileNotFoundError:
        return 127, "git introuvable dans le PATH"
    except subprocess.TimeoutExpired:
        return 124, "timeout git"


@app.get("/api/git/status")
def git_status():
    info = {}
    rc, head = _git_run(["rev-parse", "HEAD"])
    info["head"] = head if rc == 0 else None
    rc, short = _git_run(["rev-parse", "--short", "HEAD"])
    info["head_short"] = short if rc == 0 else None
    rc, branch = _git_run(["rev-parse", "--abbrev-ref", "HEAD"])
    info["branch"] = branch if rc == 0 else None
    rc, msg = _git_run(["log", "-1", "--pretty=%s"])
    info["last_commit_message"] = msg if rc == 0 else None
    rc, author = _git_run(["log", "-1", "--pretty=%an"])
    info["last_commit_author"] = author if rc == 0 else None
    rc, date = _git_run(["log", "-1", "--pretty=%ci"])
    info["last_commit_date"] = date if rc == 0 else None
    rc, describe = _git_run(["describe", "--tags", "--always"])
    info["describe"] = describe if rc == 0 else None
    rc, status = _git_run(["status", "--porcelain"])
    info["dirty"] = bool(status) if rc == 0 else None
    info["status_lines"] = status.splitlines() if rc == 0 and status else []
    return info


@app.get("/api/git/tags")
def git_tags():
    rc, out = _git_run(["tag", "-l", "--sort=-version:refname", "--format=%(refname:short)|%(objectname:short)|%(creatordate:iso8601)|%(subject)"])
    if rc != 0:
        return {"tags": []}
    tags = []
    for line in out.splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            tags.append({"name": parts[0], "hash": parts[1], "date": parts[2], "message": parts[3]})
    return {"tags": tags}


@app.get("/api/git/commits-since")
def git_commits_since(tag: Optional[str] = None):
    """Liste des commits depuis un tag donné (ou depuis le début si pas de tag)."""
    if tag:
        rng = f"{tag}..HEAD"
    else:
        rc, last_tag = _git_run(["describe", "--tags", "--abbrev=0"])
        rng = f"{last_tag}..HEAD" if rc == 0 and last_tag else "HEAD"
    rc, out = _git_run(["log", rng, "--pretty=%h|%s|%an|%ci", "--no-merges"])
    commits = []
    if rc == 0 and out:
        for line in out.splitlines():
            parts = line.split("|", 3)
            if len(parts) == 4:
                commits.append({"hash": parts[0], "message": parts[1], "author": parts[2], "date": parts[3]})
    return {"range": rng, "commits": commits}


def _bump_version(current: str, kind: str) -> str:
    m = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", current or "")
    if m:
        major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        major, minor, patch = 0, 0, 0
    if kind == "major":
        major, minor, patch = major + 1, 0, 0
    elif kind == "minor":
        minor, patch = minor + 1, 0
    elif kind == "patch":
        patch += 1
    else:
        raise HTTPException(status_code=400, detail="kind doit être major/minor/patch")
    return f"v{major}.{minor}.{patch}"


# Conventional commit pattern : feat!, fix!:, feat(scope):, BREAKING CHANGE
_CC_PATTERN = re.compile(
    r"^(?P<type>[a-z]+)(?P<scope>\([^)]*\))?(?P<breaking>!)?\s*:\s*(?P<desc>.+)",
    re.IGNORECASE,
)

# Labels lisibles par type de commit
_TYPE_LABELS: dict[str, str] = {
    "feat":     "Nouvelles fonctionnalités",
    "fix":      "Correctifs",
    "perf":     "Performances",
    "refactor": "Refactorisation",
    "docs":     "Documentation",
    "style":    "Style / Formatage",
    "test":     "Tests",
    "chore":    "Tâches techniques",
    "ci":       "CI/CD",
    "build":    "Build",
    "revert":   "Reverts",
}

# Poids pour déterminer le bump automatique
_TYPE_WEIGHT: dict[str, int] = {
    "feat": 2,      # → minor
    "fix": 1,       # → patch
    "perf": 1,
    "refactor": 1,
    "docs": 0,
    "style": 0,
    "test": 0,
    "chore": 0,
    "ci": 0,
    "build": 0,
    "revert": 1,
}


def _analyze_commits(commits: list[dict]) -> dict:
    """
    Analyse une liste de commits (champ 'message') selon les Conventional Commits.
    Retourne :
      - suggested_kind : "major" | "minor" | "patch"
      - groups : dict[type_label -> list[str]]  (pour le changelog)
      - commit_message : message de commit généré automatiquement
      - breaking : bool
    """
    groups: dict[str, list[str]] = {}
    max_weight = 0
    breaking = False

    for c in commits:
        msg = c.get("message", "")
        # Detect BREAKING CHANGE anywhere in message
        if "BREAKING CHANGE" in msg or "BREAKING-CHANGE" in msg:
            breaking = True

        m = _CC_PATTERN.match(msg)
        if m:
            ctype = m.group("type").lower()
            if m.group("breaking"):
                breaking = True
            desc = m.group("desc").strip()
            scope = m.group("scope") or ""
            label = _TYPE_LABELS.get(ctype, ctype.capitalize())
            entry = f"{scope} {desc}".strip() if scope else desc
            groups.setdefault(label, []).append(entry)
            weight = _TYPE_WEIGHT.get(ctype, 0)
            if weight > max_weight:
                max_weight = weight
        else:
            # Commit non conventionnel → rangé dans "Autres"
            groups.setdefault("Autres", []).append(msg)
            if max_weight < 1:
                max_weight = 1  # au moins un patch

    if breaking:
        suggested_kind = "major"
    elif max_weight >= 2:
        suggested_kind = "minor"
    elif max_weight >= 1:
        suggested_kind = "patch"
    else:
        suggested_kind = "patch"

    # Génère un message de commit automatique
    parts = []
    if "Nouvelles fonctionnalités" in groups:
        n = len(groups["Nouvelles fonctionnalités"])
        parts.append(f"{n} fonctionnalité{'s' if n > 1 else ''}")
    if "Correctifs" in groups:
        n = len(groups["Correctifs"])
        parts.append(f"{n} correctif{'s' if n > 1 else ''}")
    if breaking:
        parts.insert(0, "BREAKING CHANGE")
    summary = ", ".join(parts) if parts else f"{len(commits)} commit(s)"

    return {
        "suggested_kind": suggested_kind,
        "breaking": breaking,
        "groups": groups,
        "summary": summary,
    }


@app.get("/api/git/suggest-bump")
def git_suggest_bump():
    """
    Analyse les commits depuis le dernier tag et suggère :
    - le type de bump (patch/minor/major)
    - un message de commit automatique
    - le changelog groupé par type
    """
    rc, last_tag = _git_run(["describe", "--tags", "--abbrev=0"])
    current = last_tag if rc == 0 else "v0.0.0"

    rng = f"{current}..HEAD" if rc == 0 else "HEAD"
    rc2, out = _git_run(["log", rng, "--pretty=%h|%s|%an|%ci", "--no-merges"])
    commits = []
    if rc2 == 0 and out:
        for line in out.splitlines():
            parts = line.split("|", 3)
            if len(parts) == 4:
                commits.append({"hash": parts[0], "message": parts[1], "author": parts[2], "date": parts[3]})

    if not commits:
        return {
            "current_version": current,
            "suggested_kind": "patch",
            "breaking": False,
            "groups": {},
            "summary": "Aucun nouveau commit",
            "commit_message": f"chore(release): bump version",
            "commits": [],
            "range": rng,
        }

    analysis = _analyze_commits(commits)
    next_ver = _bump_version(current, analysis["suggested_kind"])
    commit_message = f"chore(release): {next_ver} — {analysis['summary']}"

    # Build markdown changelog
    lines = [f"## {next_ver}\n"]
    for label, items in analysis["groups"].items():
        lines.append(f"\n### {label}\n")
        for item in items:
            lines.append(f"- {item}")
    changelog = "\n".join(lines)

    return {
        "current_version": current,
        "next_version": next_ver,
        "suggested_kind": analysis["suggested_kind"],
        "breaking": analysis["breaking"],
        "groups": analysis["groups"],
        "summary": analysis["summary"],
        "commit_message": commit_message,
        "changelog": changelog,
        "commits": commits,
        "range": rng,
    }


class VersionBumpPayload(BaseModel):
    kind: str  # major | minor | patch
    message: Optional[str] = None
    push: bool = True
    create_release: bool = True


@app.post("/api/pipeline/release")
async def pipeline_release(payload: VersionBumpPayload):
    """
    Pipeline complet de release :
    1. git pull origin <branch>
    2. Calcule la prochaine version (SemVer) depuis le dernier tag
    3. Écrit VERSION
    4. git add/commit VERSION
    5. git tag -a <new_version>
    6. git push origin <branch> --tags (optionnel)
    7. Crée la GitHub Release (optionnel)
    """
    cfg = load_config()
    gh = cfg.get("github", {})
    branch = gh.get("branch") or "main"

    rc, current_tag = _git_run(["describe", "--tags", "--abbrev=0"])
    current = current_tag if rc == 0 else "v0.0.0"
    new_version = _bump_version(current, payload.kind)

    job_id = create_job(f"pipeline release {current} -> {new_version}")
    job = JOBS[job_id]

    async def _run_pipeline():
        # 1. pull
        rc = await stream_subprocess(job_id, ["git", "pull", "origin", branch], cwd=PROJECT_ROOT)
        if rc != 0 and job["status"] != "failure":
            job["output"].append("[WARN] git pull a échoué, abandon.")
            finish_job(job_id, rc)
            return

        # 2. Write VERSION file
        version_file = PROJECT_ROOT / "VERSION"
        version_file.write_text(new_version + "\n", encoding="utf-8")
        job["output"].append(f"[ok] VERSION écrit : {new_version}")

        # 3. git add / commit
        msg = payload.message or f"chore(release): {new_version}"
        rc = await stream_subprocess(job_id, ["git", "add", "VERSION"], cwd=PROJECT_ROOT)
        if rc == 0:
            rc = await stream_subprocess(job_id, ["git", "commit", "-m", msg], cwd=PROJECT_ROOT)
        if rc != 0:
            job["output"].append("[WARN] commit échoué (peut-être rien à committer).")

        # 4. tag
        rc = await stream_subprocess(
            job_id,
            ["git", "tag", "-a", new_version, "-m", msg],
            cwd=PROJECT_ROOT,
        )
        if rc != 0:
            job["output"].append("[ERROR] git tag a échoué.")
            finish_job(job_id, rc)
            return

        # 5. push
        if payload.push:
            rc = await stream_subprocess(job_id, ["git", "push", "origin", branch, "--tags"], cwd=PROJECT_ROOT)
            if rc != 0:
                job["output"].append("[ERROR] git push a échoué.")
                finish_job(job_id, rc)
                return

        # 6. GitHub Release
        if payload.create_release and gh.get("pat"):
            try:
                # Collect commits since previous tag
                rc2, log_out = _git_run(["log", f"{current}..HEAD", "--pretty=- %s (%h)", "--no-merges"])
                release_body = log_out if rc2 == 0 else msg
                url = f"https://api.github.com/repos/{gh['owner']}/{gh['repo']}/releases"
                with httpx.Client(timeout=20.0) as client:
                    resp = client.post(
                        url,
                        headers=github_headers(gh["pat"]),
                        json={
                            "tag_name": new_version,
                            "name": new_version,
                            "body": release_body[:5000],
                            "target_commitish": branch,
                        },
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        job["output"].append(f"[ok] Release GitHub créée : {data.get('html_url')}")
                    else:
                        job["output"].append(f"[WARN] Release GitHub échouée : {resp.status_code} {resp.text[:200]}")
            except Exception as e:
                job["output"].append(f"[WARN] Release GitHub erreur : {e}")

        finish_job(job_id, 0)
        append_history({"type": "release", "from": current, "to": new_version, "job_id": job_id})

    asyncio.create_task(_run_pipeline())
    return {"job_id": job_id, "from": current, "to": new_version}


class DeployPayload(BaseModel):
    pull: bool = True
    rebuild: bool = True


@app.post("/api/pipeline/deploy")
async def pipeline_deploy(payload: DeployPayload):
    """
    Déploiement local : git pull + docker compose up --build -d
    """
    job_id = create_job("deploy local (git pull + docker compose)")

    async def _run():
        cfg = load_config()
        branch = cfg.get("github", {}).get("branch") or "main"
        if payload.pull:
            rc = await stream_subprocess(job_id, ["git", "pull", "origin", branch], cwd=PROJECT_ROOT)
            if rc != 0:
                JOBS[job_id]["output"].append("[ERROR] git pull a échoué.")
                finish_job(job_id, rc)
                return
        if payload.rebuild:
            rc = await stream_subprocess(
                job_id,
                ["docker", "compose", "up", "-d", "--build"],
                cwd=PROJECT_ROOT,
            )
            if rc != 0:
                JOBS[job_id]["output"].append("[ERROR] docker compose a échoué.")
                finish_job(job_id, rc)
                return
        finish_job(job_id, 0)
        append_history({"type": "deploy", "job_id": job_id})

    asyncio.create_task(_run())
    return {"job_id": job_id}


class RollbackPayload(BaseModel):
    ref: str
    rebuild: bool = True


@app.post("/api/pipeline/rollback")
async def pipeline_rollback(payload: RollbackPayload):
    if not re.match(r"^[A-Za-z0-9._/-]+$", payload.ref):
        raise HTTPException(status_code=400, detail="ref invalide")
    job_id = create_job(f"rollback -> {payload.ref}")

    async def _run():
        rc = await stream_subprocess(job_id, ["git", "fetch", "--all", "--tags"], cwd=PROJECT_ROOT)
        if rc != 0:
            finish_job(job_id, rc); return
        rc = await stream_subprocess(job_id, ["git", "checkout", payload.ref], cwd=PROJECT_ROOT)
        if rc != 0:
            JOBS[job_id]["output"].append("[ERROR] checkout échoué. Peut-être modifications locales non commitées.")
            finish_job(job_id, rc); return
        if payload.rebuild:
            rc = await stream_subprocess(job_id, ["docker", "compose", "up", "-d", "--build"], cwd=PROJECT_ROOT)
            if rc != 0:
                finish_job(job_id, rc); return
        finish_job(job_id, 0)
        append_history({"type": "rollback", "ref": payload.ref, "job_id": job_id})

    asyncio.create_task(_run())
    return {"job_id": job_id}


# ====================== Jobs ======================
@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, tail: int = Query(0, ge=0)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job introuvable")
    output = job["output"]
    if tail > 0:
        output = output[tail:]
    return {
        "id": job["id"],
        "label": job["label"],
        "status": job["status"],
        "exit_code": job["exit_code"],
        "started_at": job["started_at"],
        "finished_at": job["finished_at"],
        "total_lines": len(job["output"]),
        "output": output,
    }


@app.get("/api/jobs")
def list_jobs():
    return {
        "jobs": [
            {
                "id": j["id"],
                "label": j["label"],
                "status": j["status"],
                "exit_code": j["exit_code"],
                "started_at": j["started_at"],
                "finished_at": j["finished_at"],
            }
            for j in sorted(JOBS.values(), key=lambda x: x["started_at"], reverse=True)[:30]
        ]
    }


# ====================== History ======================
@app.get("/api/history")
def api_history():
    return {"history": load_history()}


# ====================== Health ======================
@app.get("/api/health")
def api_health():
    cfg = load_config()
    results = {}
    for name, url in [
        ("backend", cfg["services"]["backend_url"]),
        ("frontend", cfg["services"]["frontend_url"]),
    ]:
        start = time.time()
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(url, follow_redirects=True)
                results[name] = {
                    "url": url,
                    "ok": resp.status_code < 500,
                    "status_code": resp.status_code,
                    "latency_ms": int((time.time() - start) * 1000),
                }
        except Exception as e:
            results[name] = {"url": url, "ok": False, "error": str(e)[:120], "latency_ms": int((time.time() - start) * 1000)}

    # Docker compose ps
    try:
        proc = subprocess.run(
            ["docker", "compose", "ps", "--format", "json"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=10,
        )
        raw = proc.stdout.strip()
        containers = []
        if raw:
            # Each line may be a JSON object, or it may be one JSON array
            try:
                parsed = json.loads(raw)
                containers = parsed if isinstance(parsed, list) else [parsed]
            except json.JSONDecodeError:
                for line in raw.splitlines():
                    try:
                        containers.append(json.loads(line))
                    except Exception:
                        pass
        results["docker"] = {
            "ok": proc.returncode == 0,
            "containers": [
                {"name": c.get("Name") or c.get("Service"), "state": c.get("State"), "status": c.get("Status")}
                for c in containers
            ],
        }
    except Exception as e:
        results["docker"] = {"ok": False, "error": str(e)[:120]}

    return results


@app.get("/api/system/info")
def system_info():
    return {
        "python": sys.version.split()[0],
        "platform": sys.platform,
        "cwd": str(APP_DIR),
        "project_root": str(PROJECT_ROOT),
        "backups_dir": str(BACKUPS_DIR),
        "has_backup_script": (PROJECT_ROOT / "backup-db.ps1").exists(),
        "has_docker_compose": (PROJECT_ROOT / "docker-compose.yml").exists(),
        "has_git": shutil.which("git") is not None,
        "has_docker": shutil.which("docker") is not None,
        "has_npx": shutil.which("npx") is not None or shutil.which("npx.cmd") is not None,
    }


# ====================== Static UI ======================
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def root():
    idx = STATIC_DIR / "index.html"
    if idx.exists():
        return HTMLResponse(idx.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>DevOps Manager</h1><p>static/index.html manquant</p>", status_code=500)


# ---------------------------------------------------------------------------
# Entrée
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[DevOps Manager] Projet : {PROJECT_ROOT}")
    print(f"[DevOps Manager] UI     : http://192.168.3.186:9000")
    uvicorn.run(app, host="0.0.0.0", port=9000, log_level="info")
