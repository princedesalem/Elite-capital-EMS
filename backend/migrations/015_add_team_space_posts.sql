CREATE TABLE IF NOT EXISTS TEAM_SPACE_POST (
    id_post INT AUTO_INCREMENT PRIMARY KEY,
    post_type VARCHAR(20) NOT NULL,
    author_matricule INT NULL,
    author_name VARCHAR(150) NOT NULL,
    destinataire VARCHAR(150) NULL,
    message TEXT NULL,
    valeur VARCHAR(100) NULL,
    raison TEXT NULL,
    question TEXT NULL,
    poll_options JSON NULL,
    voted_by JSON NULL,
    likes INT NOT NULL DEFAULT 0,
    audience_type VARCHAR(30) NOT NULL DEFAULT 'all',
    audience_selected JSON NULL,
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_matricule) REFERENCES EMPLOYE(matricule)
);