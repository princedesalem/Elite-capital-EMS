-- Migration 062 : Refonte workflow évaluation
-- Rend id_fiche optionnel et ajoute les champs nécessaires au nouveau workflow

-- 1) Rendre id_fiche nullable (la fiche template est maintenant dans id_template)
ALTER TABLE Evaluation MODIFY id_fiche INT NULL;

-- 2) Lien vers la fiche de poste template (nouveau modèle)
ALTER TABLE Evaluation ADD COLUMN id_template INT NULL AFTER id_fiche;
ALTER TABLE Evaluation ADD CONSTRAINT fk_eval_template
    FOREIGN KEY (id_template) REFERENCES Fiche_poste_template(id_template) ON DELETE SET NULL;

-- 3) Évaluateur déterminé automatiquement par le système de routage
ALTER TABLE Evaluation ADD COLUMN evaluateur_matricule VARCHAR(32) NULL AFTER matricule;
ALTER TABLE Evaluation ADD COLUMN evaluateur_role VARCHAR(50) NULL AFTER evaluateur_matricule;
ALTER TABLE Evaluation ADD CONSTRAINT fk_eval_evaluateur
    FOREIGN KEY (evaluateur_matricule) REFERENCES EMPLOYE(matricule) ON DELETE SET NULL;

-- 4) Évaluation du N+1 (JSON séparé, format identique à auto_evaluation)
ALTER TABLE Evaluation ADD COLUMN evaluation_n1 JSON NULL AFTER evaluations;

-- 5) Dates de soumission pour le suivi du workflow
ALTER TABLE Evaluation ADD COLUMN date_soumission_auto DATETIME NULL AFTER date_creation;
ALTER TABLE Evaluation ADD COLUMN date_evaluation_n1 DATETIME NULL AFTER date_soumission_auto;

-- 6) Rendre id_periode optionnel (pas toujours défini à l'initiation)
ALTER TABLE Evaluation MODIFY id_periode INT NULL;
