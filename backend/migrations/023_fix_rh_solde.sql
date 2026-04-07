-- Migration 023: Corriger le solde de congés des employés RH
-- Problème: pour les demandeurs RH dont l'activation se complète automatiquement,
--   la déduction du solde n'était pas toujours déclenchée → solde trop élevé.
-- Solution: Pour toutes les opérations de congé dont l'activation est COMPLETE
--   et solde_deduit = 0, on déduit la durée du solde de l'employé et on marque solde_deduit = 1.
-- Périmètre: Tous les employés ayant le rôle RH.

-- Étape 1: Identifier les matricules RH
-- Étape 2: Trouver leurs opérations de congé dont l'activation est complète mais solde non déduit
-- Étape 3: Mettre à jour solde_conges et marquer les opérations

-- Marquer les opérations concernées et déduire du solde en une seule passe
-- En MySQL, on ne peut pas mettre à jour la même table dans une sous-requête directe,
-- donc on utilise une table temporaire intermédiaire.

-- Table temporaire: opérations RH à corriger
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_rh_conges_a_corriger AS
SELECT
    o.id_operation,
    o.matricule,
    o.duree,
    o.type_demande
FROM OPERATION o
INNER JOIN UTILISATEUR u ON u.matricule = o.matricule
INNER JOIN ROLE r ON r.id = u.role_id
INNER JOIN ACTIVATION a ON a.id_operation = o.id_operation
    AND a.type_action = 'ACTIVATION'
    AND a.statut_final = 'COMPLETE'
    AND a.demandeur_fait = 1
    AND a.rh_fait = 1
WHERE r.name IN ('RH')
  AND o.solde_deduit = 0
  AND LOWER(COALESCE(o.type_demande, '')) IN ('congé', 'conge');

-- Déduire le solde pour chaque employé RH concerné
UPDATE EMPLOYE e
INNER JOIN (
    SELECT matricule, SUM(duree) AS total_a_deduire
    FROM tmp_rh_conges_a_corriger
    GROUP BY matricule
) totaux ON totaux.matricule = e.matricule
SET e.solde_conges = e.solde_conges - totaux.total_a_deduire;

-- Marquer les opérations comme solde déduit
UPDATE OPERATION o
INNER JOIN tmp_rh_conges_a_corriger t ON t.id_operation = o.id_operation
SET o.solde_deduit = 1;

-- Faire de même pour les permissions non-conventionnelles des RH
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_rh_perms_a_corriger AS
SELECT
    o.id_operation,
    o.matricule,
    o.duree,
    o.type_demande
FROM OPERATION o
INNER JOIN UTILISATEUR u ON u.matricule = o.matricule
INNER JOIN ROLE r ON r.id = u.role_id
INNER JOIN ACTIVATION a ON a.id_operation = o.id_operation
    AND a.type_action = 'ACTIVATION'
    AND a.statut_final = 'COMPLETE'
    AND a.demandeur_fait = 1
    AND a.rh_fait = 1
WHERE r.name IN ('RH')
  AND o.solde_deduit = 0
  AND LOWER(COALESCE(o.type_demande, '')) = 'permission'
  AND NOT EXISTS (
      SELECT 1 FROM PERM_CONVENTIONNELLE pc WHERE pc.id_perm_conv = o.id_operation
  );

UPDATE EMPLOYE e
INNER JOIN (
    SELECT matricule, SUM(duree) AS total_a_deduire
    FROM tmp_rh_perms_a_corriger
    GROUP BY matricule
) totaux ON totaux.matricule = e.matricule
SET e.solde_conges = e.solde_conges - totaux.total_a_deduire;

UPDATE OPERATION o
INNER JOIN tmp_rh_perms_a_corriger t ON t.id_operation = o.id_operation
SET o.solde_deduit = 1;

DROP TEMPORARY TABLE IF EXISTS tmp_rh_conges_a_corriger;
DROP TEMPORARY TABLE IF EXISTS tmp_rh_perms_a_corriger;
