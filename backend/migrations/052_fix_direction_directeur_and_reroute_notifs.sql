-- =============================================================================
-- Migration 052 : Corrige les directions sans id_directeur en utilisant le n1
-- (hiérarchique) des employés rattachés, et ré-route les notifications
-- VALIDATION mal dirigées suite à l'ancien fallback qui prenait le premier
-- directeur de l'entité par matricule ASC (au lieu du vrai directeur).
--
-- Contexte :
--   - Samuel Ngoula (9006) a demandé plusieurs opérations
--   - Son directeur (par n1) est Ivan Rudie (9011)
--   - DIRECTION[7].id_directeur était NULL
--   - Le fallback retournait 9003 (Tchoua Serge) au lieu de 9011
--
-- Idempotent : les UPDATE filtrent par condition stricte.
-- =============================================================================

-- 1) Fixer DIRECTION.id_directeur pour la Direction "Organisation et Projets"
UPDATE DIRECTION
SET id_directeur = 9011
WHERE id_direction = 7 AND id_directeur IS NULL;

-- 2) Ré-router les notifications VALIDATION non lues qui étaient envoyées
--    à 9003 au lieu du directeur réel (9011) pour les opérations de Samuel
--    Ngoula (ou tout autre employé dont le directeur direction = 9011).
UPDATE Notification n
JOIN OPERATIONS o ON n.id_operation = o.id_operation
JOIN EMPLOYE e ON o.matricule = e.matricule
SET n.matricule = 9011
WHERE n.type_notification = 'VALIDATION'
  AND n.lue = 0
  AND n.matricule = 9003
  AND e.id_direction = 7
  AND o.statut IN ('en attente', 'En attente', 'EN ATTENTE');

-- 3) Génériquement : toute direction dont id_directeur est NULL mais où un et
--    un seul employé a le rôle DIRECTEUR → auto-remplir.
UPDATE DIRECTION d
SET d.id_directeur = (
    SELECT e.matricule
    FROM EMPLOYE e
    JOIN UTILISATEUR u ON e.matricule = u.matricule
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'DIRECTEUR'
      AND e.id_direction = d.id_direction
    LIMIT 1
)
WHERE d.id_directeur IS NULL
  AND (
    SELECT COUNT(*)
    FROM EMPLOYE e
    JOIN UTILISATEUR u ON e.matricule = u.matricule
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'DIRECTEUR'
      AND e.id_direction = d.id_direction
  ) = 1;
