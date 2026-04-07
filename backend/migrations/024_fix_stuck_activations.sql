-- Migration 024: Fix activations/clôtures bloquées pour RH/PCA/AG
-- Les opérations créées avant Round 3 ont pu rester avec demandeur_fait=1 / rh_fait=0
-- car la logique one-step n'existait pas encore.

-- 1. Compléter les activations PCA/AG bloquées en AttenteRH
UPDATE Activation a
JOIN OPERATIONS o ON a.id_operation = o.id_operation
JOIN UTILISATEUR u ON o.matricule = u.matricule
JOIN roles r ON u.role_id = r.id
SET a.rh_fait = 1,
    a.date_rh = NOW(),
    a.statut_final = 'COMPLETE'
WHERE a.type_action = 'ACTIVATION'
  AND a.demandeur_fait = 1
  AND a.rh_fait = 0
  AND a.statut_final != 'COMPLETE'
  AND UPPER(r.name) IN ('PCA', 'AG');

-- 2. Compléter les clôtures RH/PCA/AG bloquées en ClotureDemandee
UPDATE Activation a
JOIN OPERATIONS o ON a.id_operation = o.id_operation
JOIN UTILISATEUR u ON o.matricule = u.matricule
JOIN roles r ON u.role_id = r.id
SET a.rh_fait = 1,
    a.date_rh = NOW(),
    a.statut_final = 'COMPLETE'
WHERE a.type_action = 'CLOTURE'
  AND a.demandeur_fait = 1
  AND a.rh_fait = 0
  AND a.statut_final != 'COMPLETE'
  AND UPPER(r.name) IN ('RH', 'PCA', 'AG');
