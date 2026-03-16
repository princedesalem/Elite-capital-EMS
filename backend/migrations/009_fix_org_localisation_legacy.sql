-- Normalize legacy organisation rows with NULL localisation

-- Default localisation id used as fallback (first available city)
SET @yaounde_id := (SELECT MIN(id_localisation) FROM LOCALISATION);

-- 1) Directions: fill missing localisation for the 3 target entities
UPDATE DIRECTION d
JOIN ENTITE e ON e.id_entite = d.id_entite
SET d.id_localisation = @yaounde_id
WHERE d.id_localisation IS NULL
  AND e.nom IN ('ELCAM', 'EXCA', 'ECG');

-- 2) Departments: fill missing localisation for the 3 target entities
UPDATE DEPARTEMENT dep
JOIN ENTITE e ON e.id_entite = dep.id_entite
SET dep.id_localisation = @yaounde_id
WHERE dep.id_localisation IS NULL
  AND e.nom IN ('ELCAM', 'EXCA', 'ECG');

-- 2b) Global fallback for any remaining legacy NULL localisation rows
UPDATE DIRECTION
SET id_localisation = @yaounde_id
WHERE id_localisation IS NULL;

UPDATE DEPARTEMENT
SET id_localisation = @yaounde_id
WHERE id_localisation IS NULL;

-- 3) Keep department city aligned with linked direction city when possible
UPDATE DEPARTEMENT dep
JOIN DIRECTION d ON d.id_direction = dep.id_direction
SET dep.id_localisation = d.id_localisation
WHERE dep.id_direction IS NOT NULL
  AND d.id_localisation IS NOT NULL
  AND (dep.id_localisation IS NULL OR dep.id_localisation <> d.id_localisation);

-- 4) Remove duplicate directions by (nom, entite, localisation), keep smallest id_direction
UPDATE DEPARTEMENT dep
JOIN DIRECTION d1 ON dep.id_direction = d1.id_direction
JOIN DIRECTION d2
  ON d1.id_entite = d2.id_entite
 AND d1.id_localisation <=> d2.id_localisation
 AND d1.nom = d2.nom
 AND d1.id_direction > d2.id_direction
SET dep.id_direction = d2.id_direction;

DELETE d1 FROM DIRECTION d1
JOIN DIRECTION d2
  ON d1.id_entite = d2.id_entite
 AND d1.id_localisation <=> d2.id_localisation
 AND d1.nom = d2.nom
 AND d1.id_direction > d2.id_direction;

-- 5) Remove duplicate departments by (nom, entite, localisation), keep smallest dept_id
DELETE dep1 FROM DEPARTEMENT dep1
JOIN DEPARTEMENT dep2
  ON dep1.id_entite = dep2.id_entite
 AND dep1.id_localisation <=> dep2.id_localisation
 AND dep1.nom = dep2.nom
 AND dep1.dept_id > dep2.dept_id;
