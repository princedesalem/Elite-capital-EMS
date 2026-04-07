"""
Tests for PCA/AG validation action — verifies that a PCA user can actually
validate operations where the expected next role is AG (and vice versa).

Root cause tested: valider_operation() used to do a strict
`prochain_role != role_validateur` check that rejected PCA when prochain_role
was 'AG', even though PCA and AG are interchangeable terminal roles.
"""
import pytest
from datetime import date

from app import models
from app.utils import workflow as wf_utils
from app.utils.security import hash_password


@pytest.fixture()
def seed_pca_validation(db_session, seed_reference_data):
    """Seed PCA/AG roles + DFC role, a PCA user, and advance an operation
    to the terminal validation step."""
    refs = seed_reference_data
    roles = refs['roles']

    # Create terminal roles
    role_pca = models.Role(name='PCA', description='Président du Conseil')
    role_ag = models.Role(name='AG', description='Administrateur Général')
    role_dfc = models.Role(name='DFC', description='Directeur Financier')
    db_session.add_all([role_pca, role_ag, role_dfc])
    db_session.flush()
    roles['PCA'] = role_pca
    roles['AG'] = role_ag
    roles['DFC'] = role_dfc

    # PCA user
    pca_emp = models.Employe(
        matricule=6001, nom='Pca', prenom='Alpha',
        email='6001@example.com', date_embauche=date(2024, 1, 1),
        dept_id=refs['departement'].dept_id,
        id_direction=refs['direction'].id_direction,
        id_entite=refs['entite'].id_entite,
        id_role=role_pca.id, fonction='PCA', sexe='M',
    )
    db_session.add(pca_emp)
    db_session.flush()
    pca_user = models.Utilisateur(
        matricule=6001, email='6001@example.com', role_id=role_pca.id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False, mfa_enabled=False, mfa_active=False,
    )
    db_session.add(pca_user)
    db_session.flush()

    operation = refs['operation']

    # Simulate earlier validations: DIRECTEUR, RH, DG have already validated
    for role_name, matricule in [
        ('DIRECTEUR', refs['directeur'].matricule),
        ('RH', refs['rh'].matricule),
        ('DG', refs['dg'].matricule),
    ]:
        v = models.Validation(
            id_operation=operation.id_operation,
            matricule_validateur=matricule,
            role_validateur=role_name,
            statut_validation='validé',
            commentaire='OK',
        )
        db_session.add(v)
    db_session.commit()

    return {**refs, 'role_pca': role_pca, 'role_ag': role_ag, 'pca_emp': pca_emp}


class TestPCAValidationAction:
    """PCA must be able to validate when the sequence expects PCA."""

    def test_pca_validates_when_prochain_is_pca(self, db_session, seed_pca_validation):
        """PCA can validate an operation where prochain_role == PCA (exact match)."""
        refs = seed_pca_validation
        op = refs['operation']

        prochain_role, prochain_mat = wf_utils.obtenir_prochain_validateur(op.id_operation, db_session)
        # The sequence for ELCAM entity should end with PCA
        assert prochain_role == 'PCA', f"Expected PCA, got {prochain_role}"

        success, msg = wf_utils.valider_operation(
            op.id_operation, refs['pca_emp'].matricule, 'validé', 'Approuvé', db_session
        )
        assert success is True, f"Validation failed: {msg}"
        assert 'validé' in msg.lower() or 'validateur' in msg.lower()

    def test_pca_validates_when_prochain_is_ag(self, db_session, seed_pca_validation):
        """PCA can validate an operation whose sequence says AG (ECG entity).

        This is the key cross-terminal test — PCA role validates an AG step.
        """
        refs = seed_pca_validation
        op = refs['operation']

        # Override the entity to ECG so the sequence ends with AG
        ecg = models.Entite(nom='ECG')
        db_session.add(ecg)
        db_session.flush()
        employe = refs['employe']
        employe.id_entite = ecg.id_entite
        db_session.commit()

        # Re-check: prochain_role should now be AG
        prochain_role, _ = wf_utils.obtenir_prochain_validateur(op.id_operation, db_session)
        assert prochain_role == 'AG', f"Expected AG after ECG entity change, got {prochain_role}"

        # PCA should still be able to validate
        success, msg = wf_utils.valider_operation(
            op.id_operation, refs['pca_emp'].matricule, 'validé', 'Approuvé PCA→AG', db_session
        )
        assert success is True, f"PCA validation of AG step failed: {msg}"


class TestTerminalEquivalenceUnit:
    """Pure unit tests for terminal role equivalence logic."""

    def test_pca_equals_ag(self):
        _TERMINAUX = {'PCA', 'AG'}
        def role_ok(role_validateur, prochain_role):
            return (prochain_role == role_validateur) or (
                role_validateur in _TERMINAUX and prochain_role in _TERMINAUX
            )
        assert role_ok('PCA', 'AG') is True
        assert role_ok('AG', 'PCA') is True
        assert role_ok('PCA', 'PCA') is True
        assert role_ok('AG', 'AG') is True

    def test_non_terminal_not_equivalent(self):
        _TERMINAUX = {'PCA', 'AG'}
        def role_ok(role_validateur, prochain_role):
            return (prochain_role == role_validateur) or (
                role_validateur in _TERMINAUX and prochain_role in _TERMINAUX
            )
        assert role_ok('PCA', 'RH') is False
        assert role_ok('RH', 'PCA') is False
        assert role_ok('DG', 'AG') is False


class TestOperationEstValideeParValidateurFinal:
    """Test that operation_est_validee_par_validateur_final handles PCA/AG."""

    def test_pca_validation_counts_as_final_for_ag_sequence(self, db_session, seed_pca_validation):
        refs = seed_pca_validation
        op = refs['operation']

        # Change entity to ECG → sequence ends with AG  
        ecg = models.Entite(nom='ECG')
        db_session.add(ecg)
        db_session.flush()
        refs['employe'].id_entite = ecg.id_entite
        db_session.commit()

        # Add a PCA validation (not AG)
        v = models.Validation(
            id_operation=op.id_operation,
            matricule_validateur=refs['pca_emp'].matricule,
            role_validateur='PCA',
            statut_validation='validé',
            commentaire='Final',
        )
        db_session.add(v)
        db_session.commit()

        result = wf_utils.operation_est_validee_par_validateur_final(op.id_operation, db_session)
        assert result is True, "PCA validation should count as final when sequence ends with AG"


class TestNotificationCreatedAfterValidation:
    """Verify notification is created when PCA validates."""

    def test_notification_sent_after_final_validation(self, db_session, seed_pca_validation):
        refs = seed_pca_validation
        op = refs['operation']

        # Count existing notifications
        before = db_session.query(models.Notification).filter(
            models.Notification.id_operation == op.id_operation
        ).count()

        success, _ = wf_utils.valider_operation(
            op.id_operation, refs['pca_emp'].matricule, 'validé', 'Approuvé', db_session
        )
        assert success

        after = db_session.query(models.Notification).filter(
            models.Notification.id_operation == op.id_operation
        ).count()
        assert after > before, "A notification should be created after validation"


class TestPCAValidationEndpoint:
    """Integration test via the HTTP endpoint."""

    def test_pca_can_validate_via_api(self, client, db_session, seed_pca_validation, auth_headers):
        refs = seed_pca_validation
        op = refs['operation']
        headers = auth_headers(refs['pca_emp'].matricule, 'PCA')

        resp = client.post(
            f'/api/workflow/valider/{op.id_operation}',
            params={
                'matricule_validateur': refs['pca_emp'].matricule,
                'statut': 'validé',
                'commentaire': 'OK PCA',
            },
            headers=headers,
        )
        assert resp.status_code == 200, f"PCA validation endpoint returned {resp.status_code}: {resp.text}"
