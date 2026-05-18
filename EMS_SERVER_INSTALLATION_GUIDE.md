# Documentation Complète - EMS Server Installation & Management

## Vue d'ensemble

L'installateur `Installer EMS Server.exe` automatise complètement le déploiement d'EMS sur un serveur Windows local avec :

- ✅ Activation WSL 2 + Docker Desktop
- ✅ Installation Git + Clonage repo GitHub
- ✅ Génération sécurisée des fichiers .env (backend + frontend)
- ✅ Initialisation base de données MySQL avec schéma + admin user
- ✅ Vérification de santé des 3 services (backend FastAPI, frontend Vite, database)
- ✅ Configuration CI/CD GitHub Actions (auto-deploy on push)
- ✅ Backup automatique quotidien à minuit
- ✅ Redémarrage automatique des services au boot serveur

## Installation (Première fois)

### Prérequis
- Windows 10/11 Pro (ou Server 2019+) avec droits administrateur
- 16 GB RAM minimum
- 50 GB espace disque
- Connexion Internet (pour Docker Desktop et GitHub Actions runner)

### Étapes d'installation

1. **Lancer l'installateur** :
   ```
   Installer EMS Server.exe
   ```
   - L'installateur demandera confirmation UAC (droits admin)
   - Console blanche s'affichera pendant ~1-2h (premier build télécharge beaucoup de composants)
   - Affiche progression pour chaque phase

2. **Phases automatiques** (durée totale : 60-120 minutes selon connexion) :
   - **Phase 1** (5 min) : Activation WSL 2 + reboot
   - **Phase 2** (10 min) : Téléchargement + installation Docker Desktop
   - **Phase 3** (5 min) : Installation Git 2.44
   - **Phase 4** (5 min) : Clone/Pull repository depuis GitHub
   - **Phase 5** (2 min) : Génération .env files + clés secrètes
   - **Phase 6** (30-40 min) : Docker compose up (télécharge images Python, Node, MySQL)
   - **Phase 6.5** (1 min) : Ouverture ports Firewall (8000, 5173)
   - **Phase 7** (5 min) : Installation GitHub Actions runner self-hosted
   - **Phase 7.5** (1 min) : Configuration deploy job dans CI/CD
   - **Phase 8** (2 min) : Configuration services Windows (backup + auto-start)

3. **Affichage final** :
   ```
   INSTALLATION TERMINEE AVEC SUCCES !
   
   Accès à l'application:
   - Sur ce serveur  : http://localhost:5173
   - Réseau local    : http://192.168.x.x:5173  
   - API Backend     : http://localhost:8000/docs
   ```

### Fichiers générés

Après installation, les fichiers suivants sont créés dans `C:\EMS\extranet` :

```
C:\EMS\extranet\
  frontend\
    .env                    (VITE_API_URL=http://localhost:8000)
  backend\
    .env                    (DATABASE_URL, SECRET_KEY, SMTP, etc.)
  .github\workflows\
    ci.yml                  (avec job deploy auto-added)
  manage-ems.ps1            (gestion des services)
  backup-db-auto.ps1        (script backup quotidien)

C:\EMS\backups\             (répertoire créé pour backups)
```

## Gestion Post-Installation

### Scripts de contrôle

Tous les scripts doivent être exécutés dans PowerShell **EN TANT QU'ADMINISTRATEUR**.

#### Démarrage manuel
```powershell
# Depuis C:\EMS\extranet :
.\manage-ems.ps1 start

# Ou via docker compose directement:
docker compose up -d
```
**Durée** : 30-60 secondes avant disponibilité

#### Arrêt
```powershell
.\manage-ems.ps1 stop

# Ou directement :
docker compose down
```

#### Status (voir tous les containers)
```powershell
.\manage-ems.ps1 status

# Output exemple:
# NAME                    COMMAND                  SERVICE     STATUS      PORTS
# ems-backend-1           "python -m uvicorn..."   backend     Up 2 hours  0.0.0.0:8000->8000/tcp
# ems-frontend-1          "npm run dev"            frontend    Up 2 hours  0.0.0.0:5173->5173/tcp
# ems-db-1                "docker-entrypoint..."   db          Up 2 hours  0.0.0.0:3307->3306/tcp
```

#### Logs en direct (suivi des erreurs)
```powershell
.\manage-ems.ps1 logs

# Ctrl+C pour quitter
```
Logs utiles pour debugger issues backend/frontend/database.

#### Redémarrage
```powershell
.\manage-ems.ps1 restart
```

### Configuration des services Windows

#### ✅ Backup automatique (quotidien à minuit)

La tâche `EMS-Daily-Backup` est programmée automatiquement par l'installateur.

**Vérifier l'état** :
```powershell
schtasks /query /tn "\EMS\EMS-Daily-Backup" /v
```

**Backups stockés** : `C:\EMS\backups\ems-db-YYYY-MM-DD-HHMMSS.sql`

**Restaurer un backup** :
```powershell
# Copier le fichier SQL et restaurer :
docker compose exec db mysql -u extranet -pextranet EMS_DB < C:\EMS\backups\ems-db-2026-05-15-000000.sql
```

**Nettoyer les anciens backups** (>30 jours) :
```powershell
# Le script de backup le fait automatiquement
# Ou manuellement :
Get-ChildItem C:\EMS\backups -Filter "ems-db-*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

#### ✅ Redémarrage automatique au boot

La clé Registry `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\EMS-AutoStart` lance `manage-ems.ps1 start` au démarrage du serveur.

**Vérifier l'état** :
```powershell
Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "EMS-AutoStart"
```

**Désactiver temporairement** :
```powershell
Remove-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "EMS-AutoStart"
```

**Réactiver** :
```powershell
# Relancer l'installateur ou redémarrer un script qui l'ajoute
```

## Configuration des Environnements

### Frontend (`frontend\.env`)
```
VITE_API_URL=http://localhost:8000
```

**Modification** : Editer le fichier, puis redémarrer frontend :
```powershell
docker compose restart frontend
```

### Backend (`backend\.env`)

Fichier généré automatiquement avec les valeurs suivantes :

| Variable | Valeur | Modification |
|----------|--------|-------------|
| `DATABASE_URL` | `mysql+pymysql://extranet:extranet@db:3306/EMS_DB` | Ne pas modifier en prod |
| `SECRET_KEY` | `<64 caractères aléatoires>` | ⚠️ CRITIQUE - Change à chaque installation |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Durée session JWT (en minutes) |
| `APP_URL` | `http://localhost:5173` | URL frontend pour emails |
| `INIT_ADMIN_PW` | `ChangeMe123!@#` | ⚠️ CHANGE AU PREMIER LOGIN ! |
| `SMTP_ENABLED` | `false` | Mettre à `true` si vous configurez email |
| `SMTP_HOST` | `smtp.gmail.com` | À adapter pour votre provider email |
| `SMTP_PORT` | `587` | Port SMTP de votre provider |

**Apres modification** :
```powershell
docker compose restart backend
# Attendre 10 secondes pour redémarrage
```

## CI/CD - Auto-deploy via GitHub

### Configuration (Automatique après installation)

L'installateur configure automatiquement :

1. **GitHub Actions Runner** (self-hosted) enregistré sur la machine
2. **Workflow CI/CD** (`.github/workflows/ci.yml`) avec job deploy

### Processus de déploiement automatique

**Développeur** → `git push origin main` 

**GitHub** → Lance CI/CD :
1. ✅ Tests backend (pytest) sur ubuntu-latest
2. ✅ Tests frontend (vitest) sur ubuntu-latest  
3. ✅ Lint backend sur ubuntu-latest
4. ✅ Si tous tests OK : **Deploy job sur self-hosted (cette machine)**

**Deploy job** :
- Pull latest code depuis main
- `docker compose up --build -d` (rebuild si Dockerfile changed)
- Vérification health backend (30 secondes timeout)

**Résultat** :
- ✅ Application redéployée automatiquement sans intervention manuelle
- ❌ Si tests échouent : pas de déploiement (sécurité)

**Logs du deploy** : https://github.com/princedusalem/Elite-capital-EMS/actions

## Accès à l'Application

### Utilisateur final

| Contexte | URL |
|----------|-----|
| **Local sur serveur** | http://localhost:5173 |
| **Autre PC réseau local** | http://192.168.x.x:5173 (voir manage-ems.ps1 status pour IP) |
| **API Documentation** | http://localhost:8000/docs |
| **Health Check** | http://localhost:8000/health |

### Identifiants par défaut (PREMIER LOGIN UNIQUEMENT)

```
Username: admin
Temporaire : (mot de passe initial dans backend/.env - INIT_ADMIN_PW=ChangeMe123!@#)
```

⚠️ **IMPORTANT** : L'admin doit changer le mot de passe lors du premier login !

### Accès base de données (MySQL)

```powershell
# Connexion directe au container :
docker compose exec db mysql -u extranet -pextranet

# Puis dans MySQL :
USE EMS_DB;
SHOW TABLES;
SELECT * FROM users LIMIT 5;
```

**Credentials** :
- User : `extranet`
- Password : `extranet`
- Database : `EMS_DB`
- Host (interne) : `db:3306`
- Host (externe - depuis hôte Windows) : `localhost:3307`

## Troubleshooting

### 1. Application ne démarre pas

```powershell
# 1. Vérifier status
.\manage-ems.ps1 status

# 2. Voir les logs (surtout erreurs backend)
.\manage-ems.ps1 logs

# 3. Si containers pas up, vérifier Docker Desktop
Get-Process dockerd -ErrorAction SilentlyContinue
# Si rien, relancer Docker : Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 4. Recréer les containers
docker compose down
docker compose up --build -d
```

### 2. Port 5173 ou 8000 déjà utilisé

```powershell
# Trouver le processus
netstat -ano | findstr ":5173"
# puis killer avec taskkill
taskkill /PID <PID> /F

# Ou simplement redémarrer Docker :
.\manage-ems.ps1 stop
.\manage-ems.ps1 start
```

### 3. Base de données ne connecte pas

```powershell
# Vérifier que container DB est UP
.\manage-ems.ps1 status

# Test connexion :
docker compose exec db mysql -u extranet -pextranet -e "SELECT VERSION();"

# Si erreur, vérifier logs DB :
docker compose logs db
```

### 4. GitHub Actions runner ne se lance pas

```powershell
# Le runner s'installe en Phase 7, vérifier son status :
Get-Service | grep -i "actions"

# Logs du runner :
dir "C:\actions-runner\_diag\"

# Relancer manuellement :
cd C:\actions-runner
.\run.cmd
```

### 5. Performance lente

```powershell
# 1. Vérifier ressources utilisées
docker stats

# 2. Si base de données lente, vérifier son utilisation disque
docker compose exec db du -sh /var/lib/mysql

# 3. Nettoyer backups anciens :
Remove-Item C:\EMS\backups\ems-db-*.sql -Filter "*{old date}*"

# 4. Nettoyer images Docker orphelines
docker image prune -f
```

## Maintenance Régulière

### Quotidienne ✅
- Aucune action manuelle requise
- Backup automatique à minuit
- Services redémarrent au boot

### Hebdomadaire 📋

1. Vérifier logs erreurs backend :
   ```powershell
   .\manage-ems.ps1 logs | head -100
   ```

2. Valider health check :
   ```powershell
   Invoke-RestMethod http://localhost:8000/health -UseBasicParsing | ConvertFrom-Json
   ```

### Mensuellement 📊

1. Nettoyer les backups >30 jours (fait automatiquement)
2. Vérifier espace disque `C:\EMS\backups\`
3. Mettre à jour le code via GitHub (git pull)
4. Redéployer si changements importants :
   ```powershell
   docker compose down
   git -C "C:\EMS\extranet" pull origin main
   docker compose up --build -d
   ```

## Support

### Logs centralisés

```
C:\ems-install-log.txt       # Log installation (gardé après install)
C:\ems-install-state.txt     # État courant (effacé si installation OK)
C:\EMS\backup.log            # Logs scripts de backup
docker compose logs           # Logs live tous les services
```

### Recréer l'installation complète

```powershell
# Danger : supprime tout !
docker compose down -v          # -v = supprime volumes y compris DB
Remove-Item -Recurse C:\EMS\extranet
# Puis relancer : Installer EMS Server.exe
```

---

**Version** : 1.0  
**Date** : Mai 2026  
**Support** : support@elitecapital.com
