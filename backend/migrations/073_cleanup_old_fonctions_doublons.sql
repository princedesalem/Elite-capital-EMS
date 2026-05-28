-- Migration 073 : Suppression définitive des anciens libellés réinsérés par le seed
-- Ces entrées ont été réinsérées suite à un rechargement uvicorn avec l'ancien DEFAULT_FONCTIONS.
-- Les libellés valides (nouveaux noms) sont déjà présents avec leurs IDs d'origine.

-- Réassigner les employés si des libellés anciens sont encore utilisés
UPDATE EMPLOYE SET fonction = 'Inspecteur Général(IG)'
  WHERE fonction = 'Inspecteur Générale(IG)';
UPDATE EMPLOYE SET n1_fonction = 'Inspecteur Général(IG)'
  WHERE n1_fonction = 'Inspecteur Générale(IG)';

UPDATE EMPLOYE SET fonction = 'Représentants Résidents et responsables de la création et relations d''affaires'
  WHERE fonction = 'Représentants Résidents et responsables de la creation et relation d''affaires';
UPDATE EMPLOYE SET n1_fonction = 'Représentants Résidents et responsables de la création et relations d''affaires'
  WHERE n1_fonction = 'Représentants Résidents et responsables de la creation et relation d''affaires';

UPDATE EMPLOYE SET fonction = 'Responsable comptable contrôle et consolidation'
  WHERE fonction = 'comptable et responsable contrôle et consolidation';
UPDATE EMPLOYE SET n1_fonction = 'Responsable comptable contrôle et consolidation'
  WHERE n1_fonction = 'comptable et responsable contrôle et consolidation';

UPDATE EMPLOYE SET fonction = 'Chargé Trésorerie et financement'
  WHERE fonction = 'responsable Trésorerie et financement';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Trésorerie et financement'
  WHERE n1_fonction = 'responsable Trésorerie et financement';

UPDATE EMPLOYE SET fonction = 'Responsable Ressources Humaines'
  WHERE fonction = 'responsable des resources Humaines';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Ressources Humaines'
  WHERE n1_fonction = 'responsable des resources Humaines';

UPDATE EMPLOYE SET fonction = 'Chargé des Ressources Humaines'
  WHERE fonction = 'chargé des resources humaines';
UPDATE EMPLOYE SET n1_fonction = 'Chargé des Ressources Humaines'
  WHERE n1_fonction = 'chargé des resources humaines';

UPDATE EMPLOYE SET fonction = 'Responsable Communication et Relations Publiques'
  WHERE fonction = 'responsable communication et relation publiques';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Communication et Relations Publiques'
  WHERE n1_fonction = 'responsable communication et relation publiques';

UPDATE EMPLOYE SET fonction = 'Infographiste & Déploiement'
  WHERE fonction = 'infographiste et déploiement';
UPDATE EMPLOYE SET n1_fonction = 'Infographiste & Déploiement'
  WHERE n1_fonction = 'infographiste et déploiement';

UPDATE EMPLOYE SET fonction = 'Directeur Organisations et Projets'
  WHERE fonction = 'Directeur des Organisations et projets';
UPDATE EMPLOYE SET n1_fonction = 'Directeur Organisations et Projets'
  WHERE n1_fonction = 'Directeur des Organisations et projets';

UPDATE EMPLOYE SET fonction = 'Responsable Systèmes d''Information'
  WHERE fonction = 'Responsable des systèmes d''information';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Systèmes d''Information'
  WHERE n1_fonction = 'Responsable des systèmes d''information';

UPDATE EMPLOYE SET fonction = 'Chargé Organisations et projets'
  WHERE fonction = 'chargé des organisations et projets';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Organisations et projets'
  WHERE n1_fonction = 'chargé des organisations et projets';

UPDATE EMPLOYE SET fonction = 'Chargé Marketing digital et Opérationnel'
  WHERE fonction = 'chargé marketing digital opérationnel';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Marketing digital et Opérationnel'
  WHERE n1_fonction = 'chargé marketing digital opérationnel';

-- Supprimer les anciens libellés de FONCTION_REFERENCE (par libellé pour être idempotent)
DELETE FROM FONCTION_REFERENCE WHERE libelle IN (
  'Inspecteur Générale(IG)',
  'Représentants Résidents et responsables de la creation et relation d''affaires',
  'comptable et responsable contrôle et consolidation',
  'responsable Trésorerie et financement',
  'responsable des resources Humaines',
  'chargé des resources humaines',
  'responsable communication et relation publiques',
  'infographiste et déploiement',
  'Directeur des Organisations et projets',
  'Responsable des systèmes d''information',
  'chargé des organisations et projets',
  'chargé marketing digital opérationnel',
  'Responsable Middle & Back office'
);
