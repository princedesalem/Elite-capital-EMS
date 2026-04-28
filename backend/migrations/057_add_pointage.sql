-- 057_add_pointage.sql
-- Biometric attendance integration: stub table for inbound webhook events.

CREATE TABLE IF NOT EXISTS POINTAGE (
    id_pointage INT AUTO_INCREMENT PRIMARY KEY,
    matricule VARCHAR(32) NOT NULL,
    date_pointage DATE NOT NULL,
    heure_arrivee TIME NULL,
    heure_depart TIME NULL,
    device_id VARCHAR(64) NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'biometrie',
    retard_minutes INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pointage_employe FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    UNIQUE KEY uq_pointage_unique (matricule, date_pointage, device_id)
);

CREATE INDEX idx_pointage_matricule_date
    ON POINTAGE (matricule, date_pointage);
