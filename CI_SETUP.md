# CI/CD — GitHub Actions

Ce dépôt utilise deux workflows GitHub Actions (dossier [.github/workflows/](../.github/workflows/)) :

| Workflow | Fichier | Déclencheur |
|---|---|---|
| **CI** (tests + lint + e2e) | `ci.yml` | `push` sur `main`/`develop`, `pull_request` vers `main` |
| **Backup DB** (planifié) | `backup-db.yml` | `cron 0 2 * * *` (quotidien 02:00 UTC) + `workflow_dispatch` |

## Activation

### 1. CI (`ci.yml`)

Aucun secret requis. Les jobs actifs :
- `backend-tests` : `pytest -q` sur SQLite in-memory (fixtures `conftest.py`).
- `backend-lint` : `ruff check backend/app` (non-bloquant au rollout ; seules les erreurs critiques E9/F63/F7/F82 bloquent).
- `frontend-tests` : `npm run test` (Vitest).
- `frontend-lint` : `npm run lint` (ESLint — non-bloquant pour l'instant, ajouter un script `lint` dans [frontend/package.json](../frontend/package.json) pour l'activer réellement).
- `e2e-playwright` : uniquement sur PR vers `main`, en `continue-on-error: true` le temps de stabiliser — lance la stack Docker complète puis les 3 specs Playwright ajoutées en Phase 5.

### 2. Backup planifié (`backup-db.yml`)

Configurer dans **Settings → Secrets and variables → Actions** :

**Variables** (`Variables` onglet) :
| Nom | Valeur |
|---|---|
| `BACKUP_ENABLED` | `true` pour activer le job (sinon no-op silencieux) |

**Secrets** (`Secrets` onglet) :
| Nom | Rôle |
|---|---|
| `PROD_DB_HOST` | Hôte MySQL de production |
| `PROD_DB_PORT` | Optionnel — défaut `3306` |
| `PROD_DB_USER` | User avec droit `SELECT, LOCK TABLES, PROCESS, RELOAD` |
| `PROD_DB_PASS` | Mot de passe |
| `PROD_DB_NAME` | `EMS_DB` |

Le dump est compressé (`gzip -9`) et uploadé comme artifact (rétention 30 jours). En cas d'échec, une issue GitHub taguée `backup, urgent` est automatiquement créée.

## Test local avant push

```powershell
# Backend
docker compose --profile test run --rm backend-test pytest tests/ -q

# Frontend unit
docker compose --profile test run --rm frontend-test

# Frontend E2E (après docker compose up -d db backend frontend)
docker compose --profile test run --rm frontend-e2e-test `
  sh -c "npx playwright test auth.spec.js leave-request.spec.js mission-multi-segments.spec.js"
```

## Désactivation temporaire

- CI : ajouter `if: false` au top d'un job dans `ci.yml`.
- Backup : `BACKUP_ENABLED=false` dans les variables (le job skip proprement).
