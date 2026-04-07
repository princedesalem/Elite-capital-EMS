-- Migration 028: Table PREUVE_PERMISSION pour preuves multiples par permission conventionnelle
CREATE TABLE IF NOT EXISTS "PREUVE_PERMISSION" (
    id_preuve   INTEGER PRIMARY KEY AUTOINCREMENT,
    id_perm_c   INTEGER NOT NULL REFERENCES "Perm_conventionelle"(id_perm_c) ON DELETE CASCADE,
    chemin_fichier VARCHAR(500) NOT NULL,
    nom_fichier    VARCHAR(255) NOT NULL,
    date_upload    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill: migrer l'ancienne preuve unique vers la nouvelle table
INSERT OR IGNORE INTO "PREUVE_PERMISSION" (id_perm_c, chemin_fichier, nom_fichier, date_upload)
SELECT
    id_perm_c,
    preuve,
    CASE
        WHEN instr(preuve, '/') > 0
        THEN substr(preuve, length(preuve) - instr(reverse(preuve), '/') + 2)
        ELSE preuve
    END,
    COALESCE(date_telechargement_preuves, CURRENT_TIMESTAMP)
FROM "Perm_conventionelle"
WHERE preuve IS NOT NULL AND preuve != '';
