-- Migration 013: Link SORTIE to OPERATIONS for workflow tracking

ALTER TABLE SORTIE
ADD COLUMN id_operation INT NULL;

ALTER TABLE SORTIE
ADD CONSTRAINT fk_sortie_operation
FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation);
