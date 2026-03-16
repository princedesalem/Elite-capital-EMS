# Guide de démarrage local (développeur)

But: démarrer rapidement l'application frontend/backend en local via Docker.

Prérequis
- Docker Desktop installé et démarré
- PowerShell (Windows) ouvert dans le dossier `extranet`

Démarrer l'environnement
```powershell
# depuis le dossier extranet
.\run-dev.ps1
```

Forcer rebuild du frontend (si vous modifiez CSS ou dépendances)
```powershell
docker compose build --no-cache frontend
docker compose up -d frontend
```

Créer ou réinitialiser l'admin avec mot de passe personnalisé
```powershell
# exemple de mot de passe initial recommandé
$env:INIT_ADMIN_PW = "P@ssw0rd!Extranet2026"
# exécute l'init_db dans le conteneur backend
docker compose run --rm -e INIT_ADMIN_PW="$env:INIT_ADMIN_PW" backend python init_db.py
```

Accès
- Frontend : http://localhost:5173
- Backend docs : http://localhost:8000/docs

Dépannage rapide
- Voir logs en temps réel :
```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```
- Réessayer l'init DB si insertion en double :
```powershell
docker compose exec backend python init_db.py
```

Remarques
- Pour des builds reproductibles, générez et commitez `frontend/package-lock.json` (nécessite Node installé localement) :
```powershell
cd frontend
npm install --package-lock-only
git add package-lock.json
git commit -m "Add frontend package-lock.json for Docker builds"
```
