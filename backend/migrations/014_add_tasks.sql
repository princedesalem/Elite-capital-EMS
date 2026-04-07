CREATE TABLE IF NOT EXISTS TASK (
    id_task INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    description TEXT NULL,
    priorite VARCHAR(20) NOT NULL DEFAULT 'moyenne',
    statut VARCHAR(20) NOT NULL DEFAULT 'a_faire',
    date_echeance DATE NULL,
    assigne_a INT NULL,
    cree_par INT NOT NULL,
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigne_a) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (cree_par) REFERENCES EMPLOYE(matricule)
);