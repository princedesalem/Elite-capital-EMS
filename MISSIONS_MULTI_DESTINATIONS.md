# Système de Missions Multi-Destinations

## 📋 Vue d'ensemble

Le système de missions a été amélioré pour supporter les missions avec plusieurs destinations. Cela permet de gérer des missions complexes comme une mission de 18 jours avec 9 jours à Douala et 9 jours à Kribi.

## ✨ Nouvelles fonctionnalités

### 1. **Validation de chevauchement de dates** ✅
- Le système vérifie automatiquement si un employé a déjà une mission prévue pendant la même période
- Un message d'erreur s'affiche : "Une mission est déjà prévue pendant cette période"
- Empêche l'activation simultanée de deux missions pour le même employé

### 2. **Mission multi-destinations** 🗺️
- Possibilité d'ajouter plusieurs destinations pour une même mission
- Chaque destination (segment) contient :
  - Pays et ville
  - Dates de début et fin spécifiques
  - Heures d'arrivée et de départ
  - Frais d'hôtel unitaire (par nuit)
- Calcul automatique des nuits et du total des frais d'hôtel par destination

### 3. **Interface utilisateur améliorée** 🎨
- Bouton "➕ Ajouter une destination" pour créer un nouveau segment
- Chaque segment peut être supprimé individuellement (minimum 1 segment requis)
- Affichage en temps réel du nombre de nuits et du total des frais par destination
- Vue récapitulative avec le nombre total de destinations

## 🔧 Modifications techniques

### Backend

#### Nouveaux modèles
```python
class MissionSegment(Base):
    id_segment: int (PK, auto-increment)
    id_mission: int (FK → Mission.id_mission)
    pays: str
    ville: str
    date_debut: date
    date_fin: date
    heure_arrivee: time
    heure_depart: time
    frais_hotel_unitaire: decimal(12,2)
    frais_hotel_total: decimal(12,2)
    nombre_nuits: int
    ordre: int
```

#### Nouveaux endpoints

1. **GET** `/api/missions/verifier-chevauchement/{matricule}`
   - Paramètres: `date_debut`, `date_fin`, `id_operation_exclure` (optionnel)
   - Retourne: `{ conflit: bool, message: str, missions_existantes: [] }`

2. **POST** `/api/missions/creer-multi-segments`
   - Body: `MissionMultiSegments` (Pydantic model)
   - Crée une mission avec plusieurs segments
   - Valide le chevauchement de dates
   - Retourne: ID opération, nombre de segments, dates limites

3. **GET** `/api/missions/{id_mission}/segments`
   - Retourne tous les segments d'une mission triés par ordre chronologique

#### Validation améliorée
- Vérification de chevauchement dans l'endpoint `/creer`
- Message d'erreur HTTP 400 si conflit détecté

### Frontend

#### Nouveaux states
```javascript
const [missionSegments, setMissionSegments] = useState([...])
```

#### Nouvelles fonctions
- `ajouterSegmentMission()`: Ajoute un nouveau segment
- `supprimerSegmentMission(id)`: Supprime un segment (minimum 1)
- `updateSegmentMission(id, field, value)`: Met à jour un champ d'un segment
- `cancelEditMission()`: Réinitialise le formulaire

#### Calculs automatiques
- Durée de chaque segment (jours)
- Nombre de nuits par segment
- Total frais d'hôtel par segment (nuits × prix unitaire)
- Validation des segments avant soumission

### Base de données

#### Migration SQL
Fichier: `backend/migrations/001_add_mission_segments.sql`

Pour appliquer la migration :
```sql
-- Exécuter dans MySQL
SOURCE backend/migrations/001_add_mission_segments.sql;
```

Ou via Docker :
```bash
docker exec -i extranet-db-1 mysql -u root -proot EMS_DB < backend/migrations/001_add_mission_segments.sql
```

## 📖 Guide d'utilisation

### Créer une mission multi-destinations

1. **Accéder au formulaire**
   - Onglet "Accueil" → Section "Demande"
   - Sélectionner "Mission"

2. **Remplir les informations générales**
   - Email du missionnaire
   - Moyen de transport (aérien, routier, ferroviaire, maritime)
   - Motif/objet de la mission

3. **Ajouter les destinations**
   - Destination 1 (obligatoire) :
     - Pays et ville
     - Dates début/fin
     - Heures arrivée/départ
     - Frais hôtel par nuit
   
   - Cliquer sur "➕ Ajouter une destination" pour ajouter d'autres segments
   
   - Pour chaque destination, le système calcule automatiquement :
     - Durée en jours
     - Nombre de nuits
     - Total frais d'hôtel = nuits × prix unitaire

4. **Soumettre la mission**
   - Bouton "Soumettre (X destinatio n(s))"
   - Vérification automatique des chevauchements
   - Message de confirmation si aucun conflit

### Exemple concret

**Mission de 18 jours : Douala + Kribi**

**Destination 1 - Douala**
- Pays: Cameroun
- Ville: Douala
- Du: 2026-03-10 au 2026-03-18 (9 jours)
- Arrivée: 14:00, Départ: 08:00
- Hôtel: 50 000 FCFA/nuit
- → Calcul: 8 nuits × 50 000 = 400 000 FCFA

**Destination 2 - Kribi** (après clic sur "Ajouter une destination")
- Pays: Cameroun
- Ville: Kribi
- Du: 2026-03-19 au 2026-03-27 (9 jours)
- Arrivée: 12:00, Départ: 09:00
- Hôtel: 65 000 FCFA/nuit
- → Calcul: 8 nuits × 65 000 = 520 000 FCFA

**Total mission**: 18 jours, 2 destinations, frais hôtel: 920 000 FCFA

## ⚠️ Contraintes et validations

1. **Chevauchement de dates**
   - Un employé ne peut pas avoir deux missions actives simultanément
   - Vérification sur les dates globales de la mission (min date_debut → max date_fin)
   - Statuts exclus: "refusé", "annulé"

2. **Segments obligatoires**
   - Au moins 1 segment requis
   - Impossible de supprimer le dernier segment

3. **Champs requis par segment**
   - Pays ✓
   - Ville ✓
   - Date début ✓
   - Date fin ✓

4. **Modification**
   - Les missions non clôturées peuvent être modifiées
   - L'édition multi-segments n'est pas encore implémentée (TODO)
   - Pour l'instant, l'édition utilise uniquement le premier segment

## 🚀 Déploiement

### Étapes effectuées

1. ✅ Ajout du modèle `MissionSegment` dans `models.py`
2. ✅ Création des endpoints backend
3. ✅ Refonte du formulaire frontend
4. ✅ Ajout de la validation de chevauchement
5. ✅ Création du fichier de migration SQL
6. ✅ Redémarrage des services

### Vérification

```bash
# Backend opérationnel
curl http://localhost:8000/docs
# → Status 200

# Frontend opérationnel
curl http://localhost:5173
# → Status 200

# Tester l'endpoint de vérification
curl "http://localhost:8000/api/missions/verifier-chevauchement/1?date_debut=2026-03-10&date_fin=2026-03-20"
```

## 📝 TODO / Améliorations futures

1. **Édition multi-segments**
   - Charger les segments existants lors de l'édition
   - Permettre la modification/suppression/ajout de segments

2. **Affichage dans les listes**
   - Montrer "X destinations" dans la colonne destination
   - Tooltip avec détails des segments

3. **Rapport et frais**
   - Adapter le système de rapport pour les missions multi-segments
   - Frais de mission par segment

4. **Permissions et rôles**
   - Limiter le nombre de segments selon le rôle
   - Validation supplémentaire pour missions complexes

5. **Export et impression**
   - PDF de la mission avec tous les segments
   - Itinéraire visuel (carte)

## 📞 Support

Pour toute question ou problème :
- Vérifier les logs Docker : `docker compose logs backend`
- Vérifier la base de données : `docker exec -it extranet-db-1 mysql -u root -proot EMS_DB`
- Consulter la documentation API : http://localhost:8000/docs

---

**Dernière mise à jour**: 6 mars 2026  
**Version**: 2.0 - Multi-destinations
