-- Migration 070 : Nettoyage complet des opérations de test
-- Supprime toutes les opérations (missions, congés, permissions, sorties)
-- pour une base de production propre au lancement.

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM `FraisMissionnaire`;
DELETE FROM `Frais`;
DELETE FROM `CommentaireMission`;
DELETE FROM `RelanceMission`;
DELETE FROM `MissionnairesMission`;
DELETE FROM `MissionSegment`;
DELETE FROM `Mission`;
DELETE FROM `PREUVE_PERMISSION`;
DELETE FROM `Perm_non_conventionelle`;
DELETE FROM `Perm_conventionelle`;
DELETE FROM `Permission`;
DELETE FROM `Conges`;
DELETE FROM `Validation`;
DELETE FROM `OPERATION_VUE`;
DELETE FROM `SORTIE`;
DELETE FROM `OPERATIONS`;

SET FOREIGN_KEY_CHECKS = 1;
