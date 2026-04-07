# TODO Implementation RH & Dashboard

Date: 2026-03-24
Statut global: EN COURS

## Lot 1 - Fondations fonctionnelles (en cours)
- [x] Formaliser une todo list actionnable par lots.
- [x] Demande de conge depuis l'accueil: afficher formulaire au clic "Demander un conge".
- [x] Utiliser le meme formulaire comme entree par defaut pour toute nouvelle demande de conge.
- [x] Formulaire employe: ordre strict des champs Entite -> Direction -> Departement -> Role -> Fonction.
- [x] Formulaire employe: listes dynamiques (Direction selon Entite, Departement selon Direction, Fonction selon Departement).
- [x] Creation employe: persistance complete en base + affichage immediat en liste.

## Lot 2 - Workflow metier et notifications
- [ ] Couvrir workflows conges/permissions/sorties/missions selon rattachement direction/non-direction.
- [x] Cas speciaux roles: Directeur, RH, DG, AG/PCA.
- [x] Interdiction stricte de l'auto-validation (saut automatique d'etape).
- [x] Notification a chaque etape vers le validateur cible.
- [x] Onglets "Envoye" et "Recu" pour validateurs dans les listes de demandes.
- [x] Vue detaillee workflow au clic sur une demande (etapes, statuts, validateurs).

## Lot 3 - Visibilite role-based UI
- [x] Sidebar adapte par role (Employe, Responsable, Directeur, DG, RH, ADMIN/PCA/AG).
- [x] Section Employes: scope par role (self/departement/direction/entite/global).
- [x] Dashboard: onglets "Mes operations personnelles" et "Dashboard RH" avec perimetres role-based.
- [x] Interface adaptative globale selon role (menus, dashboards, listes, formulaires).

## Lot 4 - Analytics RH
- [x] Afficher nombre et pourcentage hommes/femmes dans Analytics RH.
- [x] Verifier cohérence des KPIs RH selon perimetre role.

## Lot 5 - Separation EMPLOYE / UTILISATEUR
- [ ] Verifier et corriger separation metier fiche RH vs compte utilisateur.
- [x] Ajouter UI de gestion des utilisateurs (login, MFA, activation/desactivation, droits).
- [x] Assurer gestion independante des droits et comptes.

## Lot 6 - Qualite, audit, backup, securite
- [ ] Audit log complet sur actions critiques.
- [ ] Procedure backup/restore documentee et testee.
- [ ] Export logs (fichier + table AuditLog) sans donnees sensibles.
- [ ] Revue securite/conformite (RGPD, ISO 27001, PCI DSS) et documentation.

## Lot 7 - Tests automatises et CI/CD
- [ ] Backend: tests unitaires routes/modeles/workflows (pytest).
- [ ] Frontend: tests formulaires/navigation/roles/validations (Jest + RTL).
- [ ] Cas erreurs (age, email, droits, champs obligatoires).
- [x] Integrer execution tests dans Docker.

## Lot 8 - Deploiement et documentation
- [ ] Scripts de deploiement (Docker Compose + cibles hebergement).
- [ ] Documentation installation/mise a jour/backup/restore/rollback.
- [ ] Validation en preproduction.
- [ ] Guides techniques + utilisateur + FAQ.

## Lot 9 - Extensions metier
- [ ] Rapports avances operations (PDF, graphiques, exports).
- [ ] Demarrer modules Achats, Commercial, Marketing selon priorites.

## Journal d'avancement
- 2026-03-24: Creation de la todo list et demarrage du Lot 1 (backend + frontend).
- 2026-03-24: Lot 1 implemente (formulaire conge accueil + formulaire conge mutualise + hiérarchie formulaire employe + endpoints backend dynamiques).
- 2026-03-24: Lot 3 demarre (sidebar par role + endpoint employees scope + ouverture page employes pour tous les roles authentifies).
- 2026-03-24: Lot 2 avance (workflow unifie via endpoint /api/workflow/boite, clarifications Envoye/Recu dans Operations, correction notifications vers prochain validateur, routes workflow dedoublonnees).
- 2026-03-24: Dashboard aligne sur 2 onglets role-based (Mes operations personnelles / Dashboard RH) et KPI H/F fiabilises (gestion Enum sexe + pourcentages).
- 2026-03-24: Sidebar adaptee par role jusqu'au niveau module/sous-module + normalisation KPI operations/type et scope explicite (personnel/departement/direction/entite/global).
- 2026-03-24: Lot 5 demarre (endpoints admin comptes utilisateurs + onglet Utilisateurs dans Administration pour role, activation, MFA et reset mot de passe temporaire).
- 2026-03-24: Socle qualite ajoute (pytest backend + vitest frontend), execution des tests via Docker Compose validee, scripts PowerShell backup/restore et doc TESTING_AND_BACKUP.md ajoutes.