-- Migration 030 : corriger les notifications existantes qui affichaient 'mission'
-- au lieu de 'permission' pour les opérations de type Permission.
-- Cause : 'mission' est une sous-chaîne de 'per-MISSION-', donc le bloc
-- elif 'mission' in raw_type matchait en premier dans notifications.py.

UPDATE notifications n
JOIN operations o ON n.id_operation = o.id_operation
SET
  n.titre = REPLACE(REPLACE(n.titre,
    'Mission validée', 'Permission validée'),
    'Mission refusée', 'Permission refusée'),
  n.message = REPLACE(REPLACE(REPLACE(REPLACE(
    n.message,
    'La mission de ', 'La permission de '),
    'Le mission de ', 'La permission de '),
    'Votre mission a été', 'Votre permission a été'),
    'votre mission a été', 'votre permission a été')
WHERE LOWER(o.type_demande) LIKE '%permission%'
  AND LOWER(o.type_demande) NOT LIKE '%frais%'
  AND (
    n.titre LIKE '%Mission%'
    OR n.message LIKE '%mission de%'
    OR n.message LIKE '%Votre mission%'
    OR n.message LIKE '%votre mission%'
  );
