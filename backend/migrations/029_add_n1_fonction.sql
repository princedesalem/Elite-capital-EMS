-- Migration 029: Add n1_fonction column for function-based N1 hierarchy
-- n1_fonction stores the function/role of the superior rather than a fixed person.
-- n1 (matricule FK) is auto-resolved from n1_fonction at save time.
ALTER TABLE "EMPLOYE" ADD COLUMN IF NOT EXISTS n1_fonction VARCHAR(255);

-- Back-fill: populate n1_fonction from the existing n1 holder's fonction
UPDATE "EMPLOYE" SET n1_fonction = (
    SELECT e2.fonction FROM "EMPLOYE" e2 WHERE e2.matricule = "EMPLOYE".n1
) WHERE n1 IS NOT NULL AND n1_fonction IS NULL;
