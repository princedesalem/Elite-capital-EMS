-- Migration 055 — Salaire confidentiel (D backlog Phase 1)
-- Ajoute les colonnes salaire_brut et salaire_devise à la table EMPLOYE.
-- Visibilité gérée côté API : RH/ADMIN/PCA/AG voient tous, chaque
-- employé voit le sien, les autres reçoivent NULL.

ALTER TABLE EMPLOYE
    ADD COLUMN salaire_brut DECIMAL(12,2) NULL,
    ADD COLUMN salaire_devise VARCHAR(3) NULL DEFAULT 'XAF';
