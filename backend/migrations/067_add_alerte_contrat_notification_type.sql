-- Migration 067 : Ajouter ALERTE_CONTRAT au type ENUM de la table Notification
ALTER TABLE `Notification`
  MODIFY COLUMN type_notification
    ENUM(
      'VALIDATION',
      'REFUS',
      'ALERTE_CONGES',
      'RAPPEL_DEPART',
      'RAPPEL_RETOUR',
      'DEMANDE_MISSION',
      'DEMANDE_EXPLICATION',
      'EVALUATION',
      'CLOTURE_REQUISE',
      'RELANCE_VALIDATION',
      'RETARD_POINTAGE',
      'ALERTE_CONTRAT',
      'AUTRE'
    );
