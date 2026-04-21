-- Migration 038: Table USER_SETTINGS pour la persistence des paramètres utilisateurs en base de données
-- Remplace le stockage localStorage (perdu si changement de navigateur/device)

CREATE TABLE IF NOT EXISTS USER_SETTINGS (
    matricule   INT PRIMARY KEY,
    settings    JSON NOT NULL DEFAULT (JSON_OBJECT()),
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_settings_employe FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
