-- Migration 022: Fix stale activation records and missing solde deductions
-- 1) Fix activations where rh_fait=TRUE but statut_final still EN_ATTENTE
UPDATE ACTIVATION
SET statut_final = 'COMPLETE'
WHERE demandeur_fait = TRUE
  AND rh_fait = TRUE
  AND statut_final = 'EN_ATTENTE'
  AND type_action = 'ACTIVATION';

-- 2) Fix cloture records where rh_fait=TRUE but statut_final still EN_ATTENTE
UPDATE ACTIVATION
SET statut_final = 'COMPLETE'
WHERE demandeur_fait = TRUE
  AND rh_fait = TRUE
  AND statut_final = 'EN_ATTENTE'
  AND type_action = 'CLOTURE';

-- 3) Create missing ACTIVATION records for validated operations that have none
-- These are operations with statut 'validé' whose validation chain is complete
-- but no activation record was ever created
INSERT INTO ACTIVATION (id_operation, type_action, demandeur_fait, date_demandeur, rh_fait, date_rh, statut_final)
SELECT o.id_operation, 'ACTIVATION', TRUE, NOW(), TRUE, NOW(), 'COMPLETE'
FROM OPERATION o
WHERE LOWER(o.statut) IN ('validé', 'valide')
  AND NOT EXISTS (
    SELECT 1 FROM ACTIVATION a
    WHERE a.id_operation = o.id_operation
      AND a.type_action = 'ACTIVATION'
  )
  AND EXISTS (
    SELECT 1 FROM VALIDATION v
    WHERE v.id_operation = o.id_operation
      AND LOWER(v.statut) IN ('validé', 'valide')
  );
