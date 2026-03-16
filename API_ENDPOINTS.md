# Configuration Backend - Variables d'environnement

Créer un fichier `.env` à la racine du projet backend :

```env
# Base de données
DATABASE_URL=mysql+pymysql://user:password@localhost/ems_db

# JWT Auth
SECRET_KEY=votre_cle_secrete_tres_longue_et_aleatoire
ALGORITHM=HS256

# SMTP Email
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com  
SMTP_PASS=votre-mot-de-passe-application
EMAIL_FROM=noreply@elitecapital.com

# Application
APP_URL=http://localhost:5173
API_URL=http://localhost:8000

# Scheduler
SCHEDULER_ENABLED=true

# Notifications
ALERT_CONGES_MOIS_DEBUT=10  # Octobre
DELAI_CLOTURE_JOURS=2  # 48h
DELAI_RAPPORT_MISSION_JOURS=2  # 48h
DELAI_PREUVES_PERMISSION_JOURS=60  # 60 jours
```

## Installation des dépendances

Ajouter à `requirements.txt` :

```txt
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
sqlalchemy>=2.0.0
pymysql>=1.1.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6
python-dotenv>=1.0.0
pyotp>=2.9.0
apscheduler>=3.10.0
cryptography>=41.0.0
```

Installation :
```bash
pip install -r requirements.txt
```

## Structure des nouveaux endpoints API

### 1. Congés (`/api/conges`)
- `POST /demande` - Créer demande congé
- `GET /eligibilite/{matricule}` - Vérifier éligibilité  
- `GET /solde/{matricule}` - Obtenir solde
- `POST /calculer-duree` - Calculer jours ouvrables
- `POST /activation/{id}/demandeur` - Activation demandeur
- `POST /activation/{id}/rh` - Activation RH
- `POST /cloture/{id}/demandeur` - Clôture demandeur
- `POST /cloture/{id}/rh` - Clôture RH
- `GET /historique/{matricule}` - Historique

### 2. Permissions (`/api/permissions`)
- `GET /types-conventionnels` - Types disponibles
- `POST /conventionnelle` - Créer permission conventionnelle
- `POST /non-conventionnelle` - Créer permission non-conventionnelle
- `POST /{id}/televerser-preuves` - Upload preuves
- `GET /{id}/verifier-preuves` - Vérifier délai
- `GET /mes-permissions/{matricule}` - Historique

### 3. Missions (`/api/missions`)
- `POST /creer` - Créer mission
- `POST /{id}/televerser-rapport` - Upload rapport
- `GET /{id}/verifier-rapport` - Vérifier délai
- `POST /{id}/demande-frais` - Créer demande frais
- `POST /frais/{id}/televerser-preuves` - Upload preuves frais
- `GET /mes-missions/{matricule}` - Historique
- `GET /stats-missions/{matricule}` - Statistiques

### 4. Remplaçants (`/api/remplacants`)
- `GET /propositions/{id_operation}` - Liste propositions
- `POST /generer/{id_operation}` - Générer automatiquement
- `POST /{id}/accepter/{matricule}` - Accepter remplaçant
- `GET /disponibilite/{matricule}` - Vérifier disponibilité
- `GET /mes-remplacements/{matricule}` - Mes remplacements

### 5. Notifications (`/api/notifications`)
- `GET /non-lues/{matricule}` - Non lues
- `GET /toutes/{matricule}` - Toutes (limite 50)
- `PUT /{id}/marquer-lue` - Marquer comme lue
- `PUT /marquer-toutes-lues/{matricule}` - Tout marquer
- `GET /compteur/{matricule}` - Compteur badge
- `GET /par-type/{matricule}/{type}` - Filtrer par type
- `POST /creer` - Créer manuellement (admin)

### 6. Évaluations (`/api/evaluations`)
- `POST /fiche-poste` - Créer fiche de poste
- `GET /fiche-poste/{matricule}` - Obtenir fiche
- `POST /periode` - Créer période évaluation
- `GET /periodes` - Liste périodes
- `POST /auto-evaluation` - Soumettre auto-éval (10%)
- `POST /evaluation-hierarchique` - Éval hiérarchique
- `GET /{id}` - Évaluation complète
- `POST /{id}/calculer-note-finale` - Calcul note
- `GET /mes-evaluations/{matricule}` - Historique
- `GET /a-evaluer/{matricule}` - À évaluer

### 7. Workflow (`/api/workflow`)
- `GET /sequence/{matricule}` - Séquence validation
- `GET /prochain-validateur/{id}` - Prochain validateur
- `POST /valider/{id}` - Valider/Refuser
- `GET /historique-validations/{id}` - Historique validations
- `GET /mes-demandes/{matricule}` - Mes demandes
- `GET /a-valider/{matricule}` - À valider
- `GET /operations-visibles/{matricule}` - Selon rôle
- `GET /peut-creer-pour-autrui/{matricule}` - Permissions
- `GET /stats-validations/{matricule}` - Statistiques

### 8. Employés - Auto-complétion (`/employees/autocomplete`)
- `GET /sexe` - Options sexe
- `GET /entites` - Liste entités
- `GET /departements` - Liste depts (filtrable)
- `GET /directions` - Liste directions (filtrable)
- `GET /categories` - Catégories employés
- `GET /fonctions` - Fonctions
- `GET /diplomes` - Diplômes
- `GET /statuts` - Statuts employés
- `GET /info-utilisateur/{login}` - Info par login

## Workflow avec DFC

Le **DFC (Directeur Financier et Comptable)** est ajouté automatiquement dans la séquence de validation **UNIQUEMENT si l'opération a des frais de mission**.

### Séquences de validation

**Sans frais :**
```
DIRECTEUR/RESPONSABLE → RH → DG → PCA/AG
```

**Avec frais (table Frais existe) :**
```
DIRECTEUR/RESPONSABLE → RH → DFC → DG → PCA/AG
```

Le DFC valide la demande de frais avant que le DG ne donne son approbation finale.

## Authentification améliorée

### Blocage après échecs
- Après 3 tentatives échouées : compte bloqué 5 minutes
- Champs utilisés : `tentatives_echec`, `bloque_jusqua`
- Réinitialisation automatique après délai

### Mot de passe temporaire
- Champ `mot_de_passe_temporaire` (Boolean)
- À `True` : force changement au premier login
- Endpoint spécial : `POST /auth/password/force-change`
- Ne nécessite pas l'ancien mot de passe

### Réponse login
```json
{
  "access_token": "...",
  "mot_de_passe_temporaire": true,
  "doit_changer_mdp": true,
  "message": "Vous devez changer votre mot de passe temporaire"
}
```

## Emails HTML

Toutes les fonctions d'envoi d'email supportent HTML avec templates :

- `send_validation_email()` - Demande validation avec bouton
- `send_alerte_conges_email()` - Alerte fin d'année
- `send_rappel_depart_email()` - Liste départs du jour (RH)
- `send_rappel_retour_email()` - Liste retours du jour (RH)
- `send_mission_assignment_email()` - Mission assignée
- `send_preuves_permission_rappel_email()` - Rappel preuves (urgence si <10 jours)

Tous les emails incluent :
- Header coloré selon type
- Informations structurées
- Boutons d'action (quand applicable)
- Footer avec logo

## Scheduler (Tâches automatiques)

Configuré dans `main.py` au démarrage :

```python
from .scheduler import configurer_scheduler

@app.on_event("startup")
async def startup_event():
    scheduler = configurer_scheduler()
```

### Jobs configurés

**Quotidien (8h00) :**
- Vérification délais de clôture → Alertes + Pénalités
- Rappels départ/retour congés (RH)
- Vérification rapports missions
- Rappels preuves permissions

**Hebdomadaire (Lundi 9h00) :**
- Alertes congés fin d'année (Oct-Déc)
- Nettoyage notifications >90 jours

**Mensuel (1er 00h30) :**
- Augmentation soldes congés (+2 jours/mois)

## Tests API avec curl

### Créer demande congé
```bash
curl -X POST http://localhost:8000/api/conges/demande \
  -H "Content-Type: application/json" \
  -d '{
    "matricule": 12345,
    "date_debut": "2026-06-01",
    "date_fin": "2026-06-10",
    "motif": "Vacances été"
  }'
```

### Obtenir notifications non lues
```bash
curl http://localhost:8000/api/notifications/non-lues/12345
```

### Valider une opération
```bash
curl -X POST http://localhost:8000/api/workflow/valider/1 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "matricule_validateur=67890&statut=validé&commentaire=Approuvé"
```

### Créer mission avec frais
```bash
curl -X POST http://localhost:8000/api/missions/creer \
  -H "Content-Type: application/json" \
  -d '{
    "matricule": 12345,
    "pays": "France",
    "ville": "Paris",
    "moyens_transport": ["aerien", "routiere"],
    "date_debut": "2026-07-01",
    "date_fin": "2026-07-05"
  }'

# Puis créer demande frais
curl -X POST http://localhost:8000/api/missions/1/demande-frais \
  -H "Content-Type": application/json" \
  -d '{
    "matricule": 12345,
    "frais_transport": 500.00,
    "frais_hotel": 300.00,
    "frais_deplacement": 50.00,
    "frais_nutrition": 100.00
  }'
```

## Migration Base de Données

Nouveaux champs ajoutés :

**Validation :**
- `matricule_validateur` (INT)
- `role_validateur` (VARCHAR(50))
- `commentaire` (TEXT)

SQL d'upgrade :
```sql
ALTER TABLE Validation 
ADD COLUMN matricule_validateur INT,
ADD COLUMN role_validateur VARCHAR(50),
ADD COLUMN commentaire TEXT,
ADD FOREIGN KEY (matricule_validateur) REFERENCES EMPLOYE(matricule);
```

**Nouveau rôle DFC :**
```sql
INSERT INTO roles (name, description) 
VALUES ('DFC', 'Directeur Financier et Comptable');
```

## Prochaines étapes Frontend

Voir [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) pour :
- Composants React avec auto-complétion
- Interface workflow style Teams (Kanban)
- Formulaires de demande
- Centre de notifications avec badge
- Gestion des remplaçants
- Module évaluations

## Démarrage rapide

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configurer les variables
uvicorn app.main:app --reload --port 8000

# Frontend (prochaine étape)
cd frontend
npm install
npm run dev
```

## Documentation API interactive

Une fois le serveur démarré : http://localhost:8000/docs

Swagger UI avec tous les endpoints documentés et testables.

## Support

Pour toute question : support@elitecapital.com
