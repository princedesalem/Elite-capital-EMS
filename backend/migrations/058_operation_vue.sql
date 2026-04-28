-- 058_operation_vue.sql
-- Suivi des consultations d'opérations (qui a vu une demande et quand).
-- B2 : on stocke uniquement la PREMIÈRE consultation par paire
-- (operation × utilisateur). Les ré-ouvertures sont ignorées (INSERT IGNORE).

CREATE TABLE IF NOT EXISTS OPERATION_VUE (
    id_vue INT AUTO_INCREMENT PRIMARY KEY,
    id_operation INT NOT NULL,
    matricule_observateur VARCHAR(32) NOT NULL,
    nom_observateur VARCHAR(255) NULL,
    role_observateur VARCHAR(32) NULL,
    date_vue DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_opvue_operation FOREIGN KEY (id_operation)
        REFERENCES OPERATIONS(id_operation) ON DELETE CASCADE,
    CONSTRAINT fk_opvue_employe FOREIGN KEY (matricule_observateur)
        REFERENCES EMPLOYE(matricule),
    UNIQUE KEY uq_opvue_unique (id_operation, matricule_observateur)
);

CREATE INDEX idx_opvue_operation ON OPERATION_VUE (id_operation);
CREATE INDEX idx_opvue_observateur ON OPERATION_VUE (matricule_observateur);
