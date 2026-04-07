-- Migration 017: Add employee localisation FK + emergency contact

ALTER TABLE EMPLOYE ADD COLUMN id_localisation INT NULL;
ALTER TABLE EMPLOYE ADD COLUMN contact_urgence VARCHAR(30) NULL;

ALTER TABLE EMPLOYE
    ADD CONSTRAINT fk_employe_localisation
    FOREIGN KEY (id_localisation) REFERENCES LOCALISATION(id_localisation) ON DELETE SET NULL;

CREATE INDEX idx_employe_id_localisation ON EMPLOYE(id_localisation);

-- Backfill from direction localisation when available.
UPDATE EMPLOYE e
JOIN DIRECTION d ON d.id_direction = e.id_direction
SET e.id_localisation = d.id_localisation
WHERE e.id_localisation IS NULL
  AND d.id_localisation IS NOT NULL;
