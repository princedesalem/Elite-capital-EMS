# Guide d'utilisation - Missions Multi-Missionnaires

## Vue d'ensemble

Le système de missions supporte maintenant **plusieurs missionnaires par mission**. Vous pouvez :
- Assigner plusieurs employés à une même mission
- Rechercher des employés par nom, prénom ou matricule
- Gérer la liste des missionnaires avant de soumettre la mission
- Le système vérifie automatiquement les conflits de dates pour TOUS les missionnaires

## Fonctionnalités implémentées

### Backend ✅

#### 1. Nouveau modèle de données
- **Table `MissionnairesMission`** :
  - `id_missionnaire_mission` : Identifiant unique
  - `id_mission` : Référence à la mission
  - `matricule` : Référence à l'employé
  - `role_mission` : 'responsable' (initiateur) ou 'participant' (membre ajouté)
  - `date_ajout` : Date d'ajout du missionnaire

#### 2. Nouveaux endpoints API

**GET `/api/missions/rechercher-employes`**
- Recherche d'employés actifs par nom, prénom ou matricule
- Paramètres : `q` (terme de recherche, minimum 2 caractères)
- Retour : Liste de max 10 employés avec matricule, nom_complet, fonction, email

**GET `/api/missions/{id_mission}/missionnaires`**
- Récupère la liste des missionnaires d'une mission
- Retour : Nombre de missionnaires et détails (matricule, nom, fonction, rôle, date d'ajout)

**POST `/api/missions/creer-multi-segments`** (Mise à jour)
- Nouveau champ requis : `matricules_missionnaires` (liste d'entiers)
- Validation :
  - Vérifie que tous les matricules existent
  - **Vérifie les chevauchements de dates pour CHAQUE missionnaire**
  - Si conflit détecté pour n'importe quel missionnaire, la mission est rejetée
- Crée automatiquement les entrées dans `MissionnairesMission`
- Assigne le rôle 'responsable' à l'initiateur et 'participant' aux autres
- Notification envoyée avec le nombre total de missionnaires

#### 3. Validation des chevauchements
Le système vérifie maintenant si **chaque missionnaire** a déjà une mission active durant les dates demandées :
```python
# Pour chaque missionnaire dans la liste
for mat in matricules_missionnaires:
    # Vérifier les missions existantes de cet employé
    conflits = db.query(Mission).filter(
        Mission.matricule == mat,
        Mission.date_debut <= date_fin_max,
        Mission.date_fin >= date_debut_min,
        Mission.id_operation != id_operation
    ).all()
    
    if conflits:
        # Rejeter la mission si conflit détecté
```

### Frontend ✅

#### 1. Interface utilisateur

**Section "Missionnaires"** (entre "Informations générales" et "Destinations") :
- 🔍 **Champ de recherche** : Tapez minimum 2 caractères pour rechercher un employé
- 📋 **Liste de résultats** : Affiche les employés trouvés avec leur nom, fonction et matricule
- ✅ **Clic pour ajouter** : Cliquez sur un employé dans les résultats pour l'ajouter
- 🏷️ **Chips des missionnaires** : Affiche les missionnaires sélectionnés avec bouton de suppression (×)
- 📊 **Compteur** : Affiche le nombre de missionnaires sélectionnés

#### 2. Fonctions JavaScript

**`rechercherEmployes(term)`**
- Recherche automatique après 2 caractères
- Appelle l'endpoint `/api/missions/rechercher-employes`
- Met à jour la liste des résultats

**`ajouterMissionnaire(emp)`**
- Ajoute un employé à la liste des missionnaires
- Évite les doublons
- Réinitialise le champ de recherche

**`retirerMissionnaire(matricule)`**
- Retire un missionnaire de la liste
- Mise à jour en temps réel

#### 3. Soumission de la mission

La fonction `submitMission()` :
- ✅ Collecte `matricules_missionnaires` depuis `missionMissionnaires.map(m => m.matricule)`
- ✅ Si la liste est vide, utilise par défaut le matricule de l'initiateur : `[matricule]`
- ✅ Envoie la liste complète au backend
- ✅ Affiche un message avec le nombre de missionnaires et destinations
- ✅ Réinitialise la liste des missionnaires après soumission

## Utilisation

### Étape 1 : Créer une mission avec plusieurs destinations
1. Remplissez les informations générales (email, transport, motif)

### Étape 2 : Ajouter des missionnaires
1. Dans la section "Missionnaires", tapez le nom, prénom ou matricule d'un employé
2. Cliquez sur l'employé dans les résultats pour l'ajouter
3. Répétez pour chaque missionnaire
4. Utilisez le bouton (×) pour retirer un missionnaire si besoin

### Étape 3 : Ajouter les destinations
1. Ajoutez autant de destinations que nécessaire
2. Remplissez les détails de chaque segment

### Étape 4 : Soumettre
1. Cliquez sur "Soumettre la demande"
2. Le système vérifie automatiquement :
   - Que tous les missionnaires existent
   - Qu'aucun missionnaire n'a de conflit de dates
3. Si tout est valide, la mission est créée et tous les missionnaires sont assignés

## Exemple d'utilisation

**Scénario** : Envoyer 3 employés à une conférence à Douala du 15 au 17 mars, puis visite client à Kribi du 18 au 20 mars.

1. **Informations générales** :
   - Email : `conference@example.com`
   - Transport : Aérien
   - Motif : Conférence annuelle + visite client

2. **Missionnaires** :
   - Rechercher "Jean Dupont" → Ajouter
   - Rechercher "Marie Martin" → Ajouter
   - Rechercher "Paul Durand" → Ajouter
   - Total : 3 missionnaires

3. **Destination 1** :
   - Pays : Cameroun
   - Ville : Douala
   - Du 15/03/2026 au 17/03/2026

4. **Destination 2** :
   - Pays : Cameroun
   - Ville : Kribi
   - Du 18/03/2026 au 20/03/2026

5. **Soumettre** → Message : "Demande de mission soumise avec 2 destination(s) et 3 missionnaire(s)"

## Validation et erreurs

### Erreurs possibles

**"Veuillez sélectionner au moins un missionnaire"**
- Cause : `matricules_missionnaires` est vide
- Solution : Ajoutez au moins un missionnaire (note : ce cas ne devrait pas se produire car le système ajoute automatiquement l'initiateur)

**"Les matricules suivants n'existent pas : [X, Y, Z]"**
- Cause : Un ou plusieurs matricules ne sont pas dans la base de données
- Solution : Vérifiez que les employés sont actifs

**"Ces employés ont déjà une mission durant cette période : [Noms]"**
- Cause : Un ou plusieurs missionnaires ont déjà une mission qui chevauche les dates
- Solution : 
  - Vérifiez les dates de la mission
  - Retirez les missionnaires en conflit
  - Ou modifiez les dates pour éviter le chevauchement

## Notifications

Lorsqu'une mission est créée avec plusieurs missionnaires :
- Un email est envoyé au(x) validateur(s)
- Le message indique : "Mission pour X employé(s) (Nom1, Nom2, ...) vers: Destination1, Destination2, ..."
- Tous les missionnaires sont notifiés de leur assignation

## Base de données

### Structure de la table MissionnairesMission

```sql
CREATE TABLE MissionnairesMission (
    id_missionnaire_mission INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    matricule INT NOT NULL,
    role_mission VARCHAR(50) DEFAULT 'participant',
    date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    INDEX idx_mission (id_mission),
    INDEX idx_matricule (matricule),
    UNIQUE KEY unique_mission_matricule (id_mission, matricule)
);
```

### Requêtes utiles

**Voir tous les missionnaires d'une mission** :
```sql
SELECT m.*, e.nom, e.prenom, e.fonction
FROM MissionnairesMission m
JOIN EMPLOYE e ON m.matricule = e.matricule
WHERE m.id_mission = 123;
```

**Voir toutes les missions d'un employé** :
```sql
SELECT mi.*, mm.role_mission
FROM Mission mi
JOIN MissionnairesMission mm ON mi.id_mission = mm.id_mission
WHERE mm.matricule = 456;
```

## Développements futurs

### À implémenter :
- [ ] Affichage des missionnaires dans la liste des missions
- [ ] Édition des missionnaires d'une mission existante
- [ ] Frais de mission individuels par missionnaire
- [ ] Notification individuelle à chaque missionnaire
- [ ] Tableau de bord des missions par missionnaire
- [ ] Export PDF avec liste des missionnaires

## Support

Pour toute question ou problème :
1. Vérifiez les logs du backend : `docker logs extranet-backend-1`
2. Consultez la documentation de l'API : `http://localhost:8000/docs`
3. Vérifiez les erreurs dans la console du navigateur (F12)
