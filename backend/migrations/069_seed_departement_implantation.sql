-- Migration 069 : Peupler DEPARTEMENT_IMPLANTATION
-- Lie chaque département à sa (ses) ville(s) selon la logique métier :
--   1. Départements AVEC direction → héritent de Direction.id_localisation
--   2. Département ECG sans direction → Yaoundé uniquement (ECG est uniquement à Yaoundé)
--   3. Départements ELCAM/EXCA sans direction ET nom contenant "velop" ou "ommercial"
--      → Douala, Libreville, Brazzaville (agences commerciales)
--   4. Autres ELCAM/EXCA sans direction → Yaoundé uniquement
-- Note: INSERT IGNORE fonctionne sur MySQL. En SQLite (tests), les erreurs sont ignorées.

-- 1. Départements liés via Direction.id_localisation
INSERT IGNORE INTO DEPARTEMENT_IMPLANTATION (dept_id, id_localisation)
SELECT d.dept_id, dir.id_localisation
FROM DEPARTEMENT d
JOIN DIRECTION dir ON d.id_direction = dir.id_direction
WHERE dir.id_localisation IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT_IMPLANTATION di
    WHERE di.dept_id = d.dept_id AND di.id_localisation = dir.id_localisation
);

-- 2. Départements ECG sans direction → Yaoundé
INSERT IGNORE INTO DEPARTEMENT_IMPLANTATION (dept_id, id_localisation)
SELECT d.dept_id, l.id_localisation
FROM DEPARTEMENT d
JOIN ENTITE e ON d.id_entite = e.id_entite
JOIN LOCALISATION l ON l.ville = 'Yaoundé'
WHERE d.id_direction IS NULL
  AND e.nom = 'ECG'
  AND NOT EXISTS (
      SELECT 1 FROM DEPARTEMENT_IMPLANTATION di
      WHERE di.dept_id = d.dept_id AND di.id_localisation = l.id_localisation
  );

-- 3. Départements ELCAM/EXCA commerciaux → villes hors Yaoundé où l'entité est implantée
INSERT IGNORE INTO DEPARTEMENT_IMPLANTATION (dept_id, id_localisation)
SELECT d.dept_id, imp.id_localisation
FROM DEPARTEMENT d
JOIN ENTITE e ON d.id_entite = e.id_entite
JOIN Implantation imp ON imp.id_entite = e.id_entite
JOIN LOCALISATION l ON l.id_localisation = imp.id_localisation
WHERE d.id_direction IS NULL
  AND e.nom IN ('ELCAM', 'EXCA')
  AND (d.nom LIKE '%velop%' OR d.nom LIKE '%ommercial%')
  AND l.ville <> 'Yaoundé'
  AND NOT EXISTS (
      SELECT 1 FROM DEPARTEMENT_IMPLANTATION di
      WHERE di.dept_id = d.dept_id AND di.id_localisation = imp.id_localisation
  );

-- 4. ELCAM/EXCA non commerciaux sans direction → Yaoundé
INSERT IGNORE INTO DEPARTEMENT_IMPLANTATION (dept_id, id_localisation)
SELECT d.dept_id, l.id_localisation
FROM DEPARTEMENT d
JOIN ENTITE e ON d.id_entite = e.id_entite
JOIN LOCALISATION l ON l.ville = 'Yaoundé'
WHERE d.id_direction IS NULL
  AND e.nom IN ('ELCAM', 'EXCA')
  AND d.nom NOT LIKE '%velop%'
  AND d.nom NOT LIKE '%ommercial%'
  AND NOT EXISTS (
      SELECT 1 FROM DEPARTEMENT_IMPLANTATION di
      WHERE di.dept_id = d.dept_id AND di.id_localisation = l.id_localisation
  );
