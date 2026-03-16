ALTER TABLE DIRECTION
  ADD COLUMN id_localisation INT NULL,
  ADD INDEX idx_direction_localisation (id_localisation),
  ADD CONSTRAINT fk_direction_localisation
    FOREIGN KEY (id_localisation) REFERENCES LOCALISATION(id_localisation);

ALTER TABLE DEPARTEMENT
  ADD COLUMN id_localisation INT NULL,
  ADD INDEX idx_departement_localisation (id_localisation),
  ADD CONSTRAINT fk_departement_localisation
    FOREIGN KEY (id_localisation) REFERENCES LOCALISATION(id_localisation);

-- Backfill: align existing records to Yaoundé by default when localisation is missing
UPDATE DIRECTION d
JOIN LOCALISATION l ON l.ville = 'Yaoundé'
SET d.id_localisation = l.id_localisation
WHERE d.id_localisation IS NULL;

UPDATE DEPARTEMENT dep
JOIN LOCALISATION l ON l.ville = 'Yaoundé'
SET dep.id_localisation = l.id_localisation
WHERE dep.id_localisation IS NULL;