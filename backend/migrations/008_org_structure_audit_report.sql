-- Audit report: ville -> entité -> direction -> département
-- Usage (from extranet folder):
-- Get-Content .\backend\migrations\008_org_structure_audit_report.sql | docker compose exec -T db mysql -uextranet -pextranet EMS_DB

-- 1) Summary counts by city/entity
SELECT
  l.ville,
  e.nom AS entite,
  COUNT(DISTINCT d.id_direction) AS directions_count,
  COUNT(DISTINCT dep.dept_id) AS departements_count
FROM Implantation i
JOIN LOCALISATION l ON l.id_localisation = i.id_localisation
JOIN ENTITE e ON e.id_entite = i.id_entite
LEFT JOIN DIRECTION d
  ON d.id_entite = e.id_entite
 AND d.id_localisation = l.id_localisation
LEFT JOIN DEPARTEMENT dep
  ON dep.id_entite = e.id_entite
 AND dep.id_localisation = l.id_localisation
GROUP BY l.ville, e.nom
ORDER BY l.ville, e.nom;

-- 2) Detailed directions list
SELECT
  l.ville,
  e.nom AS entite,
  d.id_direction,
  d.nom AS direction
FROM DIRECTION d
JOIN ENTITE e ON e.id_entite = d.id_entite
JOIN LOCALISATION l ON l.id_localisation = d.id_localisation
ORDER BY l.ville, e.nom, d.nom;

-- 3) Detailed departments list
SELECT
  l.ville,
  e.nom AS entite,
  COALESCE(dir.nom, '(Sans direction)') AS direction,
  dep.dept_id,
  dep.nom AS departement
FROM DEPARTEMENT dep
JOIN ENTITE e ON e.id_entite = dep.id_entite
JOIN LOCALISATION l ON l.id_localisation = dep.id_localisation
LEFT JOIN DIRECTION dir ON dir.id_direction = dep.id_direction
ORDER BY l.ville, e.nom, direction, dep.nom;

-- 4) Data integrity checks
-- Departments without localisation
SELECT COUNT(*) AS departements_without_localisation
FROM DEPARTEMENT
WHERE id_localisation IS NULL;

-- Directions without localisation
SELECT COUNT(*) AS directions_without_localisation
FROM DIRECTION
WHERE id_localisation IS NULL;

-- Departments linked to a direction from another city (should be 0)
SELECT COUNT(*) AS cross_city_departement_direction_links
FROM DEPARTEMENT dep
JOIN DIRECTION dir ON dir.id_direction = dep.id_direction
WHERE dep.id_localisation IS NOT NULL
  AND dir.id_localisation IS NOT NULL
  AND dep.id_localisation <> dir.id_localisation;
