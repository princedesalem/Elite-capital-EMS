-- Migration 060: Ajouter le rendu HTML fidèle (mammoth) à FICHE_POSTE_TEMPLATE
-- + ajouter les notes par section sur EVALUATION

ALTER TABLE Fiche_poste_template ADD COLUMN html_content LONGTEXT NULL;

ALTER TABLE Evaluation ADD COLUMN notes_par_section JSON NULL;
