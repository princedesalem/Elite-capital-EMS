# Système EMS - Documentation des Fonctionnalités Implémentées

## 📋 Vue d'ensemble

Système complet de gestion des employés, congés, permissions, missions et évaluations avec workflow hiérarchique automatisé.

---

## ✅ Modules Backend Implémentés

### 1. **Gestion des Congés** (`business_logic.py`)

#### Fonctionnalités:
- ✅ **Calcul jours ouvrables**: Exclut vendredi et samedi (Convention Collective)
- ✅ **Vérification éligibilité**: 1 an d'ancienneté requis
- ✅ **Vérification solde**: Validation solde suffisant avant demande
- ✅ **Augmentation mensuelle**: +2 jours/mois automatique
- ✅ **Renouvellement annuel**: 24 jours/an selon date d'embauche
- ✅ **Déduction/Rajout solde**: Avec demande d'explication si négatif
- ✅ **Retour anticipé**: Réintègre les jours non utilisés
- ✅ **Détection chevauchement**: Évite les conflits de planning

#### Fonctions principales:
```python
calculer_jours_ouvrables(date_debut, date_fin)
verifier_eligibilite_conges(employe)
verifier_solde_conges(employe, duree_demandee)
calculer_augmentation_solde_mensuel(employe, db)
renouveler_solde_annuel(employe, db)
deduire_solde_conges(employe, duree, db)
rajouter_solde_conges(employe, duree, db)
```

---

### 2. **Remplaçants Automatiques** (`remplacants.py`)

#### Ordre de priorité:
1. Subordonnés directs du même département
2. Collègues du même département  
3. Employés de la même direction
4. Employés de la même entité

#### Fonctionnalités:
- ✅ Propose automatiquement jusqu'à 5 remplaçants
- ✅ Exclut employés congédiés/suspendus/absents
- ✅ Vérification disponibilité selon planning
- ✅ Enregistrement des propositions en BDD
- ✅ Acceptation/refus de remplaçants

#### Fonctions principales:
```python
trouver_remplacants_automatiques(employe, db, limite=5)
enregistrer_remplacants_proposes(id_operation, remplacants, db)
accepter_remplacant(id_operation, matricule_remplacant, db)
verifier_disponibilite_remplacant(matricule, date_debut, date_fin, db)
```

---

### 3. **Permissions Conventionnelles/Non-Conventionnelles** (`permissions.py`)

#### Convention Collective Commerce:

**Permissions conventionnelles** (NE déduit PAS du solde):
- Maternelle: 90 jours max
- Décès: 1-3 jours selon lien
- Maladie: 90 jours max (certificat médical)
- Baptême: 1 jour
- Mariage: 4 jours (propre) / 2 jours (enfant)

**Maximum**: 10 jours (sauf exceptions médicales)  
**Preuves**: Obligation de téléverser dans **60 jours**

**Permissions non-conventionnelles**: DEDUIT du solde de congés

#### Fonctions principales:
```python
verifier_type_permission_conventionnelle(type_permission, sous_type)
creer_permission_conventionnelle(id_operation, type_permission, duree, db)
creer_permission_non_conventionnelle(id_operation, duree, employe, db)
televerser_preuves_permission(id_operation, chemin_preuve, db)
verifier_delai_preuves_permission(id_operation, db)
```

---

### 4. **Activation/Clôture Double Validation** (`activation_cloture.py`)

#### Règles:
- ✅ **Validation double**: Demandeur ET RH doivent valider
- ✅ **Activation**: Déduction solde à l'activation RH
- ✅ **Clôture**: Prérequis selon type (preuves/rapport)
- ✅ **Retour anticipé**: Récupération jours non utilisés
- ✅ **Alertes 48h**: 3 jours d'alertes si non clôturé
- ✅ **Pénalité**: -1 jour si pas clôturé après 3 jours

#### Workflow:
1. **Demandeur** active/clôture → EN_ATTENTE
2. **RH** valide → COMPLETE
3. Déduction solde (si applicable)
4. Notifications automatiques

#### Fonctions principales:
```python
activer_operation_demandeur(id_operation, matricule_demandeur, db)
activer_operation_rh(id_operation, matricule_rh, db)
cloturer_operation_demandeur(id_operation, matricule_demandeur, db, retour_anticipe, date_retour_anticipe)
cloturer_operation_rh(id_operation, matricule_rh, db)
verifier_delai_cloture(db)  # Cron job quotidien
```

---

### 5. **Missions avec Rapports et Frais** (`missions.py`)

#### Fonctionnalités:
- ✅ **Moyens de transport**: Routière, maritime, aérien, ferroviaire (JSON)
- ✅ **Rapport obligatoire**: 48h après retour
- ✅ **Demandes de frais**: Transport, hôtel, déplacement, nutrition
- ✅ **Preuves de paiement**: Tickets, reçus (JSON)
- ✅ **Email notification**: Lorsqu'un supérieur crée une mission
- ✅ **Alertes automatiques**: Rappels 24h avant deadline

#### Fonctions principales:
```python
creer_mission(id_operation, pays, ville, moyens_transport, heure_depart, heure_retour, email_mission, db)
televerser_rapport_mission(id_operation, rapport, matricule, db)
verifier_rapport_mission(id_operation, db)
creer_demande_frais(id_operation, matricule, frais_*, preuves_paiement, justificatif, db)
televerser_preuves_frais(id_operation, type_preuve, chemin_fichier, db)
```

---

### 6. **Système de Notifications** (`notifications.py`)

#### Types de notifications:
- `VALIDATION` / `REFUS`: Statut opération
- `ALERTE_CONGES`: Fin d'année (3 derniers mois)
- `RAPPEL_DEPART` / `RAPPEL_RETOUR`: Pour le RH
- `DEMANDE_MISSION`: Mission assignée par supérieur
- `DEMANDE_EXPLICATION`: Solde négatif
- `EVALUATION`: Période d'évaluation
- `CLOTURE_REQUISE`: Opération pas clôturée

#### Alertes automatiques:
- ✅ **Alertes hebdomadaires** congés restants (Oct-Déc)
- ✅ **Rappels quotidiens** départ/retour au RH
- ✅ **Demandes d'explication** solde négatif
- ✅ **Nettoyage automatique** notifications >90 jours

#### Fonctions principales:
```python
envoyer_alerte_conges_fin_annee(db)
envoyer_rappel_depart_conges(db)
envoyer_rappel_retour_conges(db)
notifier_validation_operation(id_operation, statut, validateur_role, commentaire, db)
obtenir_notifications_non_lues(matricule, db)
marquer_notification_comme_lue(id_notification, db)
```

---

### 7. **Fiches de Poste et Évaluations** (`evaluations.py`)

#### Workflow d'évaluation:
1. **RH crée fiche de poste** avec objectifs pondérés (total 100%)
2. **RH fixe période d'évaluation**
3. **Employé fait auto-évaluation** (10%)
4. **Évaluation hiérarchique**:
   - Responsable: 25%
   - Directeur: 25%
   - RH: 20%
   - DG: 20%
5. **Calcul note finale** pondérée sur 100

#### Fonctions principales:
```python
creer_fiche_de_poste(matricule, objectifs, cree_par, db)
creer_periode_evaluation(date_debut, date_fin, cree_par, db)
soumettre_auto_evaluation(id_evaluation, matricule, reponses, db)
soumettre_evaluation_hierarchique(id_evaluation, evaluateur_matricule, evaluateur_role, notes, commentaire, db)
calculer_note_finale(evaluation, db)
obtenir_evaluation_complete(id_evaluation, db)
```

---

### 8. **Workflow Hiérarchique** (`workflow.py`)

#### Règles de séquence:

**Si département AVEC direction**:
```
DIRECTEUR → RH → DG → PCA/AG
```
(RESPONSABLE skippé)

**Si département SANS direction**:
```
RESPONSABLE → RH → DG → PCA/AG
```

**Si demandeur = DG**:
```
RH → PCA/AG
```

**Si entité = ECG**:
```
... → AG  (au lieu de PCA)
```

#### Visibilité opérations:
- **EMPLOYE**: Ses propres opérations
- **RESPONSABLE**: Département
- **DIRECTEUR**: Direction
- **DG**: Entité
- **RH/PCA/AG**: Toutes les opérations

#### Fonctions principales:
```python
determiner_sequence_validation(employe, db)
obtenir_validateur_pour_role(employe, role, db)
obtenir_prochain_validateur(id_operation, db)
valider_operation(id_operation, matricule_validateur, statut, commentaire, db)
peut_creer_demande_pour_autrui(matricule, db)
obtenir_operations_visibles(matricule, db)
```

---

### 9. **Tâches Planifiées (Cron)** (`scheduler.py`)

#### Configuration APScheduler:

**Quotidien (8h00)**:
- Vérifier délais de clôture
- Envoyer rappels départ/retour
- Vérifier rapports de mission
- Rappels preuves permissions

**Hebdomadaire (Lundi 9h00)**:
- Alertes congés fin d'année (Oct-Déc)
- Nettoyage anciennes notifications

**Mensuel (1er du mois 00h30)**:
- Mise à jour soldes (+2 jours/mois)

#### Utilisation:
```python
from app.scheduler import configurer_scheduler

scheduler = configurer_scheduler()
```

Ou manuellement:
```bash
python -m app.scheduler quotidien
python -m app.scheduler hebdomadaire
python -m app.scheduler mensuel
```

---

## 🗄️ Schéma Base de Données

### Tables principales modifiées:

**EMPLOYE**:
- `date_embauche` (DATE, NOT NULL)
- `solde_conges` (DECIMAL(5,2))
- `date_derniere_maj_solde` (DATE)
- `annee_experience` (INT, AUTO-CALCULÉ)
- `sexe` (ENUM: M/F/Autre)
- `statut_employe` (ENUM: ACTIF/CONGEDIE/SUSPENDU)

**DIRECTION**:
- `id_directeur` (INT) → Foreign key EMPLOYE

**DEPARTEMENT**:
- `id_responsable` (INT) → Foreign key EMPLOYE

**OPERATIONS**:
- `cree_par`, `est_modifie`, `date_modification`
- `retour_anticipe`, `date_retour_anticipe`
- `alerte_non_cloture`, `date_alerte_envoyee`

**UTILISATEUR**:
- `mot_de_passe_temporaire` (BOOLEAN)

**Perm_conventionelle**:
- `preuves_televersees`, `date_telechargement_preuves`, `date_limite_preuves`

**Mission**:
- `moyens_transport` (JSON)
- `rapport_televerse`, `date_telechargement_rapport`, `date_limite_rapport`

**Frais**:
- `preuves_paiement` (JSON)

### Nouvelles tables:

1. **Remplacant_propose**: Remplaçants proposés automatiquement
2. **Notification**: Système de notifications centralisé
3. **Demande_explication**: Explications soldes négatifs
4. **Alerte_conges_annuelle**: Alertes fin d'année
5. **Periode_evaluation**: Périodes d'évaluation RH
6. **Activation**: Validation double (demandeur + RH)

---

## 🚧 À Implémenter (Priorités)

### Backend:
1. **Endpoints API REST**:
   - `/api/conges/*` - CRUD congés avec toutes les règles
   - `/api/permissions/*` - Conventionnelles/non-conventionnelles
   - `/api/missions/*` - Missions + rapports + frais
   - `/api/remplacants/*` - Proposition/acceptation
   - `/api/notifications/*` - Liste/lecture/compteur
   - `/api/evaluations/*` - Fiches + auto-éval + hiérarchie
   - `/api/workflow/*` - Validation + visibilité

2. **Authentification**:
   - Blocage 5 min après 3 tentatives échouées
   - Forcer changement mot de passe temporaire

3. **Emails**:
   - SMTP configuration
   - Templates HTML
   - Envois asynchrones (Celery?)

### Frontend:
1. **Formulaire CRUD Employé**:
   - Auto-complétion (sexe, entité, département, direction, catégorie, fonction, diplôme)
   - Matricule auto-affiché selon login
   - Solde congés en lecture seule
   - Année expérience calculée automatiquement

2. **Interface Workflow Style Teams**:
   - Colonnes: En attente (orange) | Validé (vert) | Refusé (rouge)
   - Vue détaillée opération avec workflow visuel
   - Bouton d'action selon rôle

3. **Gestion Remplaçants**:
   - Liste remplaçants proposés
   - Accepter/Refuser

4. **Activation/Clôture**:
   - Boutons demandeur/RH
   - Bouton retour anticipé avec sélecteur date
   - Téléversement preuves/rapport

5. **Centre Notifications**:
   - Badge compteur non lues
   - Liste notifications avec filtres
   - Marquer comme lu

6. **Fiches Évaluation**:
   - Création fiche poste (RH)
   - Formulaire auto-évaluation
   - Formulaire évaluation hiérarchique
   - Affichage note finale pondérée

---

## 📦 Dépendances Requises

Ajouter à `requirements.txt`:
```txt
apscheduler>=3.10.0  # Tâches planifiées
celery>=5.3.0  # Tasks asynchrones (optionnel)
redis>=4.5.0  # Cache + Celery backend (optionnel)
```

---

## 🔧 Configuration

### Démarrage Scheduler:
Dans `main.py`:
```python
from app.scheduler import configurer_scheduler

@app.on_event("startup")
async def startup_event():
    scheduler = configurer_scheduler()
```

### Variables d'environnement:
```env
# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-password

# Notifications
ALERT_CONGES_MOIS_DEBUT=10  # Octobre
DELAI_CLOTURE_JOURS=2  # 48h
DELAI_RAPPORT_MISSION_JOURS=2  # 48h
DELAI_PREUVES_PERMISSION_JOURS=60  # 60 jours
```

---

## 📖 Exemples d'Utilisation

### Création congé avec vérifications:
```python
from app.utils.business_logic import (
    verifier_eligibilite_conges,
    verifier_solde_conges,
    calculer_jours_ouvrables
)

# Vérifier éligibilité (1 an ancienneté)
eligible, message = verifier_eligibilite_conges(employe)

# Calculer durée
duree = calculer_jours_ouvrables(date_debut, date_fin)

# Vérifier solde
solde_ok, message, solde = verifier_solde_conges(employe, duree)

if eligible and solde_ok:
    # Créer l'opération congé
    pass
```

### Proposition remplaçants:
```python
from app.utils.remplacants import (
    trouver_remplacants_automatiques,
    enregistrer_remplacants_proposes
)

remplacants = trouver_remplacants_automatiques(employe, db, limite=5)
enregistrer_remplacants_proposes(id_operation, remplacants, db)
```

### Workflow validation:
```python
from app.utils.workflow import (
    determiner_sequence_validation,
    obtenir_prochain_validateur,
    valider_operation
)

# Déterminer séquence
sequence = determiner_sequence_validation(employe, db)

# Valider
valider_operation(id_operation, matricule_validateur, 'validé', commentaire, db)

# Prochain validateur
role, matricule = obtenir_prochain_validateur(id_operation, db)
```

---

## 📝 Notes Importantes

1. **Weekends**: Vendredi + Samedi (Convention Collective Commerce)
2. **Année expérience**: Calculée automatiquement (année courante - année embauche)
3. **Solde congés**: DECIMAL pour supporter demi-journées
4. **Matricule**: Changé de VARCHAR(50) → INT (migration requise)
5. **Tables**: Noms en majuscules (EMPLOYE, OPERATIONS, etc.)
6. **JSON**: Utilisé pour moyens_transport, preuves_paiement, objectifs, évaluations
7. **Double validation**: Activation/Clôture nécessitent demandeur ET RH

---

## 🐛 Points d'Attention

- ⚠️ Migration base de données requise (VARCHAR → INT pour matricule)
- ⚠️ Tester le scheduler en environnement de développement avant production
- ⚠️ Configurer correctement les fuseaux horaires pour les cron jobs
- ⚠️ Implémenter les retry policies pour les emails
- ⚠️ Ajouter des indices sur les colonnes fréquemment interrogées
- ⚠️ Implémenter la pagination pour les grandes listes (opérations, notifications)

---

**Date de dernière mise à jour**: 4 Mars 2026
