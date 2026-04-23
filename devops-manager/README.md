# EMS DevOps Manager

Application locale autonome pour gérer le CI/CD, les backups, les tests E2E,
le versioning et les déploiements de l'extranet EMS.

## Lancement

Double-cliquez sur `start.bat`. L'interface s'ouvre sur `http://127.0.0.1:9000`.

Au premier lancement, un venv Python est créé et les dépendances installées
(FastAPI, Uvicorn, httpx).

## Configuration

Onglet **Paramètres** :

- **GitHub Owner / Repo / Branch / PAT** — pour le repo privé, générez un
  Personal Access Token avec les scopes `repo` + `workflow` sur
  https://github.com/settings/tokens
- **Services** — URL backend (8000) et frontend (5173) pour les health checks

La configuration est stockée dans `config.json` (gitignored). Le PAT n'est
jamais renvoyé en clair par l'API (masqué `***xxxx`).

## Fonctionnalités

| Onglet | Description |
|---|---|
| Tableau de bord | KPI : dernière CI, dernier backup, version, services |
| CI/CD | Runs des workflows `ci.yml` et `backup-db.yml` + déclenchement manuel |
| Sauvegardes | Lance `backup-db.ps1`, liste les fichiers, streaming de l'output |
| Tests E2E | Exécute `e2e_seed.py` et les specs Playwright |
| Versioning | Bump SemVer + tag + push + GitHub Release en 1 clic |
| Déploiements | `git pull` + `docker compose up --build`, rollback sur ref git |
| Santé | Ping backend/frontend + `docker compose ps` |

## Pipeline de release

L'onglet Versioning exécute séquentiellement :
1. `git pull origin <branch>`
2. Calcul SemVer (patch/minor/major) depuis le dernier tag
3. Écriture du fichier `VERSION`
4. `git add VERSION && git commit`
5. `git tag -a vX.Y.Z`
6. `git push origin <branch> --tags`
7. Création de la GitHub Release via API (changelog auto depuis les commits)

La CI sur GitHub se déclenche automatiquement après le push.

## Sécurité

- Écoute sur `127.0.0.1:9000` uniquement (pas accessible depuis le réseau)
- Validation anti path-traversal sur tous les endpoints fichiers
- PAT masqué dans toutes les réponses API
- `config.json` et `history.json` sont gitignored

## Git

Cette app utilise le CLI `git` standard. Elle ne modifie aucune configuration
git. Vous pouvez continuer à utiliser git normalement en parallèle depuis
votre terminal.
