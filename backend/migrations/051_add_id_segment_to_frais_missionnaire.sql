-- Migration 051: Lier les frais d'un missionnaire à un segment de mission (optionnel)
-- Motif : permettre d'attribuer chaque poste de frais à une destination précise
-- d'une mission multi-segments. Nullable → rétro-compat : les frais existants
-- restent « non assignés » ; les futurs frais peuvent cibler un segment.
ALTER TABLE FraisMissionnaire
    ADD COLUMN id_segment INT NULL AFTER matricule;

ALTER TABLE FraisMissionnaire
    ADD CONSTRAINT fk_frais_miss_segment
    FOREIGN KEY (id_segment) REFERENCES MissionSegment(id_segment)
    ON DELETE SET NULL;

CREATE INDEX idx_frais_miss_segment ON FraisMissionnaire(id_segment);
