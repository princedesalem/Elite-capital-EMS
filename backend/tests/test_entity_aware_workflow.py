"""
Tests for entity-aware role storage in Validation records.

Business rule: when PCA validates an operation for an ECG employee, the
Validation record must store role_validateur='AG' (not 'PCA'), so that
the progression endpoint — which looks up validations by the sequence role —
finds the correct record and marks the step as completed.

Similarly, when PCA validates for an ELCAM/EXCA employee, it stores 'PCA'.
The same person holds both PCA and AG authority; the label shown in the
progression / notifications must match the employee's entity.
"""
import pytest
from datetime import date

from app import models
from app.utils import workflow as wf_utils
from app.utils.security import hash_password, create_access_token


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _add_pca_user(db, matricule, role_pca, entite, departement, direction):
    emp = models.Employe(
        matricule=matricule, nom='Pca', prenom='User',
        email=f'{matricule}@example.com', date_embauche=date(2024, 1, 1),
        dept_id=departement.dept_id, id_direction=direction.id_direction,
        id_entite=entite.id_entite, id_role=role_pca.id, fonction='PCA', sexe='M',
    )
    db.add(emp)
    db.flush()
    user = models.Utilisateur(
        matricule=matricule, email=f'{matricule}@example.com', role_id=role_pca.id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False, mfa_enabled=False, mfa_active=False,
    )
    db.add(user)
    db.flush()
    return emp, user


def _advance_to_terminal(db, operation, refs):
    """Insert DIRECTEUR / RH / DG validation records so only the terminal step remains."""
    for role_name, mat in [
        ('DIRECTEUR', refs['directeur'].matricule),
        ('RH', refs['rh'].matricule),
        ('DG', refs['dg'].matricule),
    ]:
        db.add(models.Validation(
            id_operation=operation.id_operation,
            matricule_validateur=mat,
            role_validateur=role_name,
            statut_validation='validé',
            commentaire='ok',
        ))
    db.commit()


@pytest.fixture()
def seed_entity_roles(db_session, seed_reference_data):
    refs = seed_reference_data

    role_pca = models.Role(name='PCA', description='PCA')
    role_ag  = models.Role(name='AG',  description='AG')
    role_dfc = models.Role(name='DFC', description='DFC')
    db_session.add_all([role_pca, role_ag, role_dfc])
    db_session.flush()

    pca_emp, _ = _add_pca_user(
        db_session, 6002, role_pca, refs['entite'], refs['departement'], refs['direction']
    )

    # ECG entity
    ecg = models.Entite(nom='ECG')
    db_session.add(ecg)
    db_session.flush()

    # ELCAM entity already exists as refs['entite']
    elcam = refs['entite']  # nom='ELCAM'

    db_session.commit()
    return {**refs, 'role_pca': role_pca, 'role_ag': role_ag,
            'pca_emp': pca_emp, 'ecg': ecg, 'elcam': elcam}


# ---------------------------------------------------------------------------
# Tests: stored role label is entity-aware
# ---------------------------------------------------------------------------

class TestEntityAwareRoleStorage:
    """The role stored in Validation must match the sequence role (AG vs PCA),
    not the PCA user's own role."""

    def test_elcam_operation_stores_pca(self, db_session, seed_entity_roles):
        """PCA validates an ELCAM employee's operation → role_validateur stored == 'PCA'."""
        refs = seed_entity_roles
        # Ensure employe is in ELCAM entity (default)
        refs['employe'].id_entite = refs['elcam'].id_entite
        db_session.commit()

        _advance_to_terminal(db_session, refs['operation'], refs)

        prochain_role, _ = wf_utils.obtenir_prochain_validateur(
            refs['operation'].id_operation, db_session
        )
        assert prochain_role == 'PCA', f"Expected PCA sequence, got {prochain_role}"

        success, msg = wf_utils.valider_operation(
            refs['operation'].id_operation, refs['pca_emp'].matricule,
            'validé', 'ok', db_session
        )
        assert success, msg

        val = db_session.query(models.Validation).filter(
            models.Validation.id_operation == refs['operation'].id_operation,
            models.Validation.matricule_validateur == refs['pca_emp'].matricule,
        ).first()
        assert val is not None
        assert val.role_validateur == 'PCA', (
            f"ELCAM op should store 'PCA', got '{val.role_validateur}'"
        )

    def test_ecg_operation_stores_ag(self, db_session, seed_entity_roles):
        """PCA validates an ECG employee's operation → role_validateur stored == 'AG'."""
        refs = seed_entity_roles
        # Move employe to ECG entity
        refs['employe'].id_entite = refs['ecg'].id_entite
        db_session.commit()

        _advance_to_terminal(db_session, refs['operation'], refs)

        prochain_role, _ = wf_utils.obtenir_prochain_validateur(
            refs['operation'].id_operation, db_session
        )
        assert prochain_role == 'AG', f"Expected AG sequence for ECG, got {prochain_role}"

        success, msg = wf_utils.valider_operation(
            refs['operation'].id_operation, refs['pca_emp'].matricule,
            'validé', 'ok', db_session
        )
        assert success, msg

        val = db_session.query(models.Validation).filter(
            models.Validation.id_operation == refs['operation'].id_operation,
            models.Validation.matricule_validateur == refs['pca_emp'].matricule,
        ).first()
        assert val is not None
        assert val.role_validateur == 'AG', (
            f"ECG op should store 'AG' (entity-aware), got '{val.role_validateur}'"
        )


# ---------------------------------------------------------------------------
# Tests: progression endpoint shows correct statut_final after entity-aware save
# ---------------------------------------------------------------------------

class TestProgressionCompletesForECG:
    """After PCA validates an ECG op (stores 'AG'), the progression endpoint
    must return statut_final == 'APPROUVÉE' and progression == 100."""

    def test_progression_shows_approved_for_ecg_operation(
        self, client, db_session, seed_entity_roles, auth_headers
    ):
        refs = seed_entity_roles
        refs['employe'].id_entite = refs['ecg'].id_entite
        db_session.commit()

        _advance_to_terminal(db_session, refs['operation'], refs)

        # PCA validates → stores 'AG'
        success, _ = wf_utils.valider_operation(
            refs['operation'].id_operation, refs['pca_emp'].matricule,
            'validé', 'ok', db_session
        )
        assert success

        headers = auth_headers(refs['pca_emp'].matricule, 'PCA')
        resp = client.get(
            f'/api/workflow/progression/{refs["operation"].id_operation}',
            headers=headers
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data['progression'] == 100, (
            f"Progression should be 100 after full validation, got {data['progression']}"
        )
        assert data['statut_final'] == 'APPROUVÉE', (
            f"statut_final should be APPROUVÉE, got '{data['statut_final']}'"
        )

    def test_progression_shows_approved_for_elcam_operation(
        self, client, db_session, seed_entity_roles, auth_headers
    ):
        refs = seed_entity_roles
        refs['employe'].id_entite = refs['elcam'].id_entite
        db_session.commit()

        _advance_to_terminal(db_session, refs['operation'], refs)

        success, _ = wf_utils.valider_operation(
            refs['operation'].id_operation, refs['pca_emp'].matricule,
            'validé', 'ok', db_session
        )
        assert success

        headers = auth_headers(refs['pca_emp'].matricule, 'PCA')
        resp = client.get(
            f'/api/workflow/progression/{refs["operation"].id_operation}',
            headers=headers
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data['progression'] == 100
        assert data['statut_final'] == 'APPROUVÉE'


def test_ecg_sequence_skips_dg_for_standard_requests(db_session, seed_entity_roles):
    refs = seed_entity_roles
    refs['employe'].id_entite = refs['ecg'].id_entite
    db_session.commit()

    sequence = wf_utils.obtenir_sequence_operation(refs['operation'].id_operation, db_session)
    assert 'DG' not in sequence
    assert sequence[-1] in {'AG', 'PCA'}


def test_ecg_frais_sequence_routes_rh_then_dfc_then_dg_then_ag(db_session, seed_entity_roles):
    """Règle métier : toute opération avec des Frais doit passer par le DFC
    puis la DG (la DG valide après le DFC) avant le validateur terminal
    (PCA/AG), quelle que soit l'entité, y compris ECG."""
    refs = seed_entity_roles
    refs['employe'].id_entite = refs['ecg'].id_entite
    db_session.add(models.Frais(id_frais=90001, id_operation=refs['operation'].id_operation))
    db_session.commit()

    sequence = wf_utils.obtenir_sequence_operation(refs['operation'].id_operation, db_session)
    assert 'DG' in sequence
    assert 'RH' in sequence
    assert 'DFC' in sequence
    assert sequence.index('RH') < sequence.index('DFC') < sequence.index('DG')
    assert sequence[-1] in {'AG', 'PCA'}

    def test_progression_role_label_in_etapes_matches_entity(
        self, client, db_session, seed_entity_roles, auth_headers
    ):
        """The last etape's role label must be 'AG' for ECG and 'PCA' for ELCAM."""
        refs = seed_entity_roles

        for entite, expected_label in [
            (refs['ecg'], 'AG'),
            (refs['elcam'], 'PCA'),
        ]:
            # Reset — reset DB (autouse fixture handles this on next test,
            # but we just check the progression BEFORE any validation here)
            refs['employe'].id_entite = entite.id_entite
            db_session.commit()

            headers = auth_headers(refs['pca_emp'].matricule, 'PCA')
            resp = client.get(
                f'/api/workflow/progression/{refs["operation"].id_operation}',
                headers=headers
            )
            assert resp.status_code == 200, resp.text
            etapes = resp.json()['etapes']
            assert etapes, "etapes should not be empty"
            # sequence is reversed in the endpoint: terminal role (AG/PCA) is etapes[0]
            terminal_role = etapes[0]['role']
            assert terminal_role == expected_label, (
                f"Entity '{entite.nom}': terminal etape role should be '{expected_label}', got '{terminal_role}'"
            )


# ---------------------------------------------------------------------------
# Tests: backward compatibility (old data stored as wrong alias)
# ---------------------------------------------------------------------------

class TestBackwardCompatProgression:
    """Old data: PCA validated an ECG op but 'PCA' was stored (pre-fix).
    The progression endpoint must still show the step as validated via
    backward-compat cross-lookup."""

    def test_old_pca_stored_for_ag_sequence_still_shows_approved(
        self, client, db_session, seed_entity_roles, auth_headers
    ):
        refs = seed_entity_roles
        refs['employe'].id_entite = refs['ecg'].id_entite
        db_session.commit()

        _advance_to_terminal(db_session, refs['operation'], refs)

        # Manually insert old-style validation: sequence expects 'AG' but 'PCA' was stored
        db_session.add(models.Validation(
            id_operation=refs['operation'].id_operation,
            matricule_validateur=refs['pca_emp'].matricule,
            role_validateur='PCA',   # wrong label, old data
            statut_validation='validé',
            commentaire='old data',
        ))
        db_session.commit()

        headers = auth_headers(refs['pca_emp'].matricule, 'PCA')
        resp = client.get(
            f'/api/workflow/progression/{refs["operation"].id_operation}',
            headers=headers
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Backward-compat cross-lookup must find 'PCA' for the 'AG' step
        assert data['statut_final'] == 'APPROUVÉE', (
            f"Backward-compat: old 'PCA' data should still produce APPROUVÉE for ECG; "
            f"got '{data['statut_final']}'"
        )
        assert data['progression'] == 100, (
            f"Backward-compat: progression should be 100, got {data['progression']}"
        )


# ---------------------------------------------------------------------------
# Tests: notification message contains entity-correct role label
# ---------------------------------------------------------------------------

class TestNotificationEntityLabel:
    def test_notification_says_ag_for_ecg_operation(self, db_session, seed_entity_roles):
        """After PCA validates an ECG operation, the notification should mention 'AG'."""
        refs = seed_entity_roles
        refs['employe'].id_entite = refs['ecg'].id_entite
        db_session.commit()
        _advance_to_terminal(db_session, refs['operation'], refs)

        success, _ = wf_utils.valider_operation(
            refs['operation'].id_operation, refs['pca_emp'].matricule,
            'validé', None, db_session
        )
        assert success

        notif = db_session.query(models.Notification).filter(
            models.Notification.matricule == refs['employe'].matricule,
            models.Notification.id_operation == refs['operation'].id_operation,
        ).order_by(models.Notification.date_creation.desc()).first()

        # The final validation creates TWO notifications to the employee:
        # 1. "Votre opération a été validé par le AG."  ← contains entity role
        # 2. "Validation complète ... approuvée."          ← generic message
        # Check that at least one references the entity-correct label.
        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == refs['employe'].matricule,
            models.Notification.id_operation == refs['operation'].id_operation,
        ).all()
        assert notifs, "Notifications should be created for the employee"
        all_text = ' '.join((n.titre or '') + ' ' + (n.message or '') for n in notifs)
        assert 'AG' in all_text, (
            f"ECG notifications should mention 'AG' somewhere; combined text: '{all_text}'"
        )

    def test_notification_says_pca_for_elcam_operation(self, db_session, seed_entity_roles):
        """After PCA validates an ELCAM operation, the notification should mention 'PCA'."""
        refs = seed_entity_roles
        refs['employe'].id_entite = refs['elcam'].id_entite
        db_session.commit()
        _advance_to_terminal(db_session, refs['operation'], refs)

        success, _ = wf_utils.valider_operation(
            refs['operation'].id_operation, refs['pca_emp'].matricule,
            'validé', None, db_session
        )
        assert success

        notif = db_session.query(models.Notification).filter(
            models.Notification.matricule == refs['employe'].matricule,
            models.Notification.id_operation == refs['operation'].id_operation,
        ).order_by(models.Notification.date_creation.desc()).first()

        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == refs['employe'].matricule,
            models.Notification.id_operation == refs['operation'].id_operation,
        ).all()
        assert notifs, "Notifications should be created for the employee"
        all_text = ' '.join((n.titre or '') + ' ' + (n.message or '') for n in notifs)
        assert 'PCA' in all_text, (
            f"ELCAM notifications should mention 'PCA' somewhere; combined text: '{all_text}'"
        )
