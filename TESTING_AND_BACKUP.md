# Testing and Backup

Date: 2026-03-24

## Tests automatiques

### Execution locale
Prerequis:
- Python 3.11+
- Node.js 20+

Backend:
```powershell
cd backend
python -m pip install -r requirements.txt
pytest -q
```

Frontend:
```powershell
cd frontend
npm install
npm run test
npm run check
```

### Execution via Docker Compose
Cette voie est recommandee si Python ou Node.js ne sont pas installes localement.

Backend:
```powershell
docker compose --profile test run --rm backend-test
```

Frontend:
```powershell
docker compose --profile test run --rm frontend-test
```

## Couverture actuelle
- Backend:
  - workflow inbox envoye/recu
  - analytics dashboard scope + KPIs H/F
  - administration comptes utilisateurs
- Frontend:
  - visibilite sidebar par role

## Backup base de donnees
### Backup
```powershell
./backup-db.ps1
```

Option dossier cible:
```powershell
./backup-db.ps1 -OutputDir .\backups
```

### Restore
```powershell
./restore-db.ps1 -BackupFile .\backups\ems-db-20260324-120000.sql
```

## Procedure recommandeee
1. Verifier que les conteneurs `db` et `backend` sont demarres.
2. Executer le backup avant tout changement schema ou restauration.
3. Tester la restauration dans un environnement non production si possible.
4. Conserver plusieurs generations de dumps SQL horodates.

## Notes
- Le service `backend-test` utilise SQLite pour des tests API rapides et isoles.
- Le service `frontend-test` installe les dependances puis execute Vitest en conteneur.
- Les scripts PowerShell utilisent les identifiants MySQL du `docker-compose.yml` courant.
