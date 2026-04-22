"""
Tests pour la migration des notifications mal routées.

Scénario concret : Samuel Ngoula (dept Projets / Direction Organisation et Projet)
avait sa demande notifiée à Serge Tchoua (Directeur de l'Audit) à cause d'un
`employe.id_direction` incohérent. Après le correctif, la migration doit :
  - archiver l'ancienne notification envoyée à Serge
  - créer une nouvelle notification pour le bon directeur (Organisation et Projet)
"""
from datetime import date, datetime

import pytest

from app import models
from app.utils.security import hash_password
from app.utils.workflow import rerouter_notifications_validation_en_attente


@pytest.fixture()
def setup_samuel_serge(db_session):
    """Met en place le scénario bug : Samuel dept Projets (Dir A),
    mais notification déjà routée à Serge (directeur Dir B)."""
    entite = models.Entite(nom='ELCAM')
    db_session.add(entite)
    db_session.flush()

    roles = {}
    for name in ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'PCA', 'ADMIN']:
        r = models.Role(name=name, description=name)
        db_session.add(r)
        db_session.flush()
        roles[name] = r

    def add_emp(matricule, prenom, nom, role_name, dept_id=None, id_direction=None):
        emp = models.Employe(
            matricule=matricule, nom=nom, prenom=prenom,
            email=f'{matricule}@example.com',
            date_embauche=date(2024, 1, 1),
            dept_id=dept_id, id_direction=id_direction,
            id_entite=entite.id_entite,
            id_role=roles[role_name].id,
            fonction=role_name, sexe='M',
        )
        db_session.add(emp)
        db_session.flush()
        db_session.add(models.Utilisateur(
            matricule=matricule, email=f'{matricule}@example.com',
            role_id=roles[role_name].id,
            mot_de_passe_hash=hash_password('Pw123!'),
            mot_de_passe_temporaire=False, mfa_enabled=False, mfa_active=False,
        ))
        db_session.flush()
        return emp

    # Les deux directeurs
    directeur_org = add_emp(3001, 'Cedric', 'Dir-OrgProjet', 'DIRECTEUR')
    serge = add_emp(3002, 'Serge', 'Tchoua', 'DIRECTEUR')

    # Direction A : Organisation et Projet (le bon directeur)
    dir_org = models.Direction(
        nom='Organisation et Projet',
        id_entite=entite.id_entite,
        id_directeur=directeur_org.matricule,
    )
    db_session.add(dir_org)
    db_session.flush()

    # Direction B : Audit (Serge)
    dir_audit = models.Direction(
        nom='Audit',
        id_entite=entite.id_entite,
        id_directeur=serge.matricule,
    )
    db_session.add(dir_audit)
    db_session.flush()

    # Dept Projets rattaché à Direction Organisation et Projet
    dept_projets = models.Departement(
        nom='Projets',
        id_entite=entite.id_entite,
        id_direction=dir_org.id_direction,
    )
    db_session.add(dept_projets)
    db_session.flush()

    # Samuel : dept correct (Projets), mais id_direction stale pointant vers Audit
    samuel = add_emp(
        1001, 'Samuel', 'Ngoula', 'EMPLOYE',
        dept_id=dept_projets.dept_id,
        id_direction=dir_audit.id_direction,  # ← bug historique : stale
    )

    # RH + DG + PCA pour boucler la séquence
    add_emp(5001, 'Rh', 'User', 'RH')
    add_emp(4001, 'Dg', 'User', 'DG')
    add_emp(7001, 'Pca', 'User', 'PCA')

    # Opération en attente créée par Samuel
    op = models.Operation(
        matricule=samuel.matricule,
        type_demande='Congé',
        titre='Congé annuel',
        statut='en attente',
        date_debut=date(2026, 5, 1),
        date_fin=date(2026, 5, 5),
        duree_jours=5,
        duree=5,
        motif='Repos',
    )
    db_session.add(op)
    db_session.flush()

    # Notification historique ENVOYÉE À SERGE (mauvais directeur)
    notif_serge = models.Notification(
        matricule=serge.matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre="Nouvelle demande à valider",
        message=f"Samuel Ngoula demande un congé.",
        id_operation=op.id_operation,
        lue=False,
        date_creation=datetime.utcnow(),
    )
    db_session.add(notif_serge)
    db_session.commit()

    return {
        'samuel': samuel,
        'serge': serge,
        'directeur_org': directeur_org,
        'dept_projets': dept_projets,
        'operation': op,
        'notif_serge': notif_serge,
    }


def test_rerouter_detecte_operation_mal_routee(db_session, setup_samuel_serge):
    """La migration détecte que l'opération de Samuel a une notif chez Serge
    au lieu du directeur Organisation et Projet."""
    data = setup_samuel_serge

    stats = rerouter_notifications_validation_en_attente(db_session)

    assert stats['operations_examinees'] == 1
    assert stats['operations_corrigees'] == 1
    assert stats['notifications_reassignees'] == 1
    assert stats['notifications_creees_pour_nouveau_validateur'] == 1


def test_notif_serge_archivee_apres_migration(db_session, setup_samuel_serge):
    """L'ancienne notification de Serge est marquée comme lue (disparait de la boîte)."""
    data = setup_samuel_serge

    rerouter_notifications_validation_en_attente(db_session)

    db_session.refresh(data['notif_serge'])
    assert data['notif_serge'].lue is True


def test_nouvelle_notif_creee_pour_bon_directeur(db_session, setup_samuel_serge):
    """Une nouvelle notification pointe vers le directeur Organisation et Projet."""
    data = setup_samuel_serge

    rerouter_notifications_validation_en_attente(db_session)

    notifs_bon_directeur = db_session.query(models.Notification).filter(
        models.Notification.matricule == data['directeur_org'].matricule,
        models.Notification.id_operation == data['operation'].id_operation,
        models.Notification.type_notification == models.TypeNotificationEnum.VALIDATION,
    ).all()

    assert len(notifs_bon_directeur) == 1
    assert notifs_bon_directeur[0].lue is False


def test_serge_naura_plus_cette_demande_dans_sa_boite(db_session, setup_samuel_serge):
    """Après migration, la boîte de Serge (notifications non lues liées à cette op) est vide."""
    data = setup_samuel_serge

    rerouter_notifications_validation_en_attente(db_session)

    notifs_serge_non_lues = db_session.query(models.Notification).filter(
        models.Notification.matricule == data['serge'].matricule,
        models.Notification.id_operation == data['operation'].id_operation,
        models.Notification.lue == False,  # noqa: E712
    ).all()

    assert len(notifs_serge_non_lues) == 0


def test_migration_idempotente(db_session, setup_samuel_serge):
    """Relancer la migration ne crée pas de doublons."""
    rerouter_notifications_validation_en_attente(db_session)
    stats2 = rerouter_notifications_validation_en_attente(db_session)

    # Second passage : plus aucune correction nécessaire
    assert stats2['operations_corrigees'] == 0
    assert stats2['notifications_reassignees'] == 0
    assert stats2['notifications_creees_pour_nouveau_validateur'] == 0


def test_operations_deja_validees_ignorees(db_session, setup_samuel_serge):
    """Les opérations déjà validées/refusées ne sont pas retouchées."""
    data = setup_samuel_serge
    data['operation'].statut = 'validé'
    db_session.commit()

    stats = rerouter_notifications_validation_en_attente(db_session)

    assert stats['operations_examinees'] == 0
    # La notification de Serge reste en l'état (non lue)
    db_session.refresh(data['notif_serge'])
    assert data['notif_serge'].lue is False


def test_notification_deja_bien_routee_nest_pas_modifiee(db_session, setup_samuel_serge):
    """Si la notification est DÉJÀ chez le bon validateur, rien n'est modifié."""
    data = setup_samuel_serge
    # Supprimer la notif mal routée et en ajouter une correcte
    db_session.delete(data['notif_serge'])
    bonne_notif = models.Notification(
        matricule=data['directeur_org'].matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre="Nouvelle demande à valider",
        message="Samuel Ngoula demande un congé.",
        id_operation=data['operation'].id_operation,
        lue=False,
    )
    db_session.add(bonne_notif)
    db_session.commit()

    stats = rerouter_notifications_validation_en_attente(db_session)

    assert stats['operations_corrigees'] == 0
    db_session.refresh(bonne_notif)
    assert bonne_notif.lue is False
