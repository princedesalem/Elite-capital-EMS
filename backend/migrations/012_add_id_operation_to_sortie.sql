-- Migration 012: Add id_operation column to SORTIE table
-- This column links a sortie to its corresponding workflow operation

ALTER TABLE SORTIE ADD COLUMN id_operation INT NULL;
ALTER TABLE SORTIE ADD CONSTRAINT fk_sortie_operations
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation) ON DELETE SET NULL;
