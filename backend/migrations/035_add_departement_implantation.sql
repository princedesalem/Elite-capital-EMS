-- Migration 035: Create DEPARTEMENT_IMPLANTATION junction table
-- Explicit per-city presence of departments. Replaces implicit filtering
-- via ENTITE → Implantation chain.
-- A department only appears in Organisation for a given city if there is
-- a row (dept_id, id_localisation) in this table.

CREATE TABLE IF NOT EXISTS DEPARTEMENT_IMPLANTATION (
    dept_id         INT NOT NULL,
    id_localisation INT NOT NULL,
    PRIMARY KEY (dept_id, id_localisation),
    CONSTRAINT fk_di_dept FOREIGN KEY (dept_id)
        REFERENCES DEPARTEMENT(dept_id) ON DELETE CASCADE,
    CONSTRAINT fk_di_loc  FOREIGN KEY (id_localisation)
        REFERENCES LOCALISATION(id_localisation) ON DELETE CASCADE
);
