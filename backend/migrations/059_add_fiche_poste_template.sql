-- Migration 059: Création de la table Fiche_poste_template
-- Stocke les fiches de poste par fonction, alimentées par import .docx

CREATE TABLE IF NOT EXISTS Fiche_poste_template (
    id_template       INT AUTO_INCREMENT PRIMARY KEY,
    fonction          VARCHAR(200) NOT NULL,
    fichier_nom       VARCHAR(300),
    sections          JSON,
    cree_par          VARCHAR(32),
    date_creation     DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME,
    CONSTRAINT uq_fpt_fonction UNIQUE (fonction),
    CONSTRAINT fk_fpt_cree_par FOREIGN KEY (cree_par)
        REFERENCES EMPLOYE(matricule) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
