-- Table PARCOURS_EMPLOYE : historise les événements de carrière
-- (promotions, mutations, transferts, embauche, congédiement).

CREATE TABLE IF NOT EXISTS PARCOURS_EMPLOYE (
    id_parcours INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT NOT NULL,
    type_action ENUM('PROMOTION','MUTATION','TRANSFERT','EMBAUCHE','CONGEDIEMENT','AUTRE') NOT NULL,
    champ_modifie VARCHAR(64) NULL,
    ancienne_valeur VARCHAR(255) NULL,
    nouvelle_valeur VARCHAR(255) NULL,
    libelle TEXT NULL,
    actor VARCHAR(64) NULL,
    date_action DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_parcours_employe FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
    INDEX idx_parcours_matricule (matricule),
    INDEX idx_parcours_date (date_action)
);
