-- Migration 018: enforce single-day semantics for Sortie operations
-- Sorties are single-day requests; align historical records accordingly.

UPDATE OPERATIONS
SET
  date_fin = date_debut,
  date_retour = date_debut,
  duree_jours = 1
WHERE LOWER(COALESCE(type_demande, '')) = 'sortie';
