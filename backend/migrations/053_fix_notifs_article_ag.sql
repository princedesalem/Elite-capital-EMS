-- Migration 053 : Correction de l'article devant "AG" et "ADMIN" dans les notifications
-- "le AG" → "l'AG", "le ADMIN" → "l'ADMIN"
-- Appliqué sur la colonne `message` de la table `notification`

UPDATE notification SET message = REPLACE(message, 'par le AG', 'par l''AG')
WHERE message LIKE '%par le AG%';

UPDATE notification SET message = REPLACE(message, 'par le ADMIN', 'par l''ADMIN')
WHERE message LIKE '%par le ADMIN%';

-- Idem dans les emails / titres si jamais stockés avec ce pattern
UPDATE notification SET titre = REPLACE(titre, 'par le AG', 'par l''AG')
WHERE titre LIKE '%par le AG%';

UPDATE notification SET titre = REPLACE(titre, 'par le ADMIN', 'par l''ADMIN')
WHERE titre LIKE '%par le ADMIN%';
