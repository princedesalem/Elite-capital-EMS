"""
Tests for GET /api/permissions/mes-permissions/{matricule}
verifying that activation_complete, statut_activation, cloture_complete
and statut_cloture fields are present and correct.
"""
from datetime import date, datetime

from app import models


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _create_permission_operation(db_session, employe):
    """Create an Operation of type Permission and its Permission link row."""
    op = models.Operation(
        matricule=employe.matricule,
        type_demande='Permission',
        titre='Permission test',
        statut='validé',
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 3),
        duree_jours=3,
        motif='Raison test',
    )
    db_session.add(op)
    db_session.flush()

    perm = models.Permission(id_permission=op.id_operation)
    db_session.add(perm)

    perm_nc = models.PermNonConventionelle(id_perm_nc=op.id_operation)
    db_session.add(perm_nc)

    db_session.commit()
    db_session.refresh(op)
    return op


def _add_activation(db_session, id_operation, type_action, statut_final):
    activation = models.Activation(
        id_operation=id_operation,
        type_action=type_action,
        demandeur_fait=True,
        rh_fait=True,
        statut_final=statut_final,
        timestamp_action=datetime.utcnow(),
    )
    db_session.add(activation)
    db_session.commit()
    return activation


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_mes_permissions_includes_activation_fields(client, seed_reference_data, db_session):
    """Response contains activation_complete, statut_activation, cloture_complete, statut_cloture."""
    employe = seed_reference_data['employe']
    _create_permission_operation(db_session, employe)

    response = client.get(f'/api/permissions/mes-permissions/{employe.matricule}')
    assert response.status_code == 200

    data = response.json()
    assert len(data) >= 1
    item = data[0]

    assert 'activation_complete' in item
    assert 'statut_activation' in item
    assert 'cloture_complete' in item
    assert 'statut_cloture' in item


def test_statut_activation_en_attente_when_no_activation_record(
    client, seed_reference_data, db_session
):
    """Without any Activation row, statut_activation must be EN_ATTENTE."""
    employe = seed_reference_data['employe']
    _create_permission_operation(db_session, employe)

    response = client.get(f'/api/permissions/mes-permissions/{employe.matricule}')
    assert response.status_code == 200

    item = response.json()[0]
    assert item['activation_complete'] is False
    assert item['statut_activation'] == 'EN_ATTENTE'


def test_statut_activation_active_when_activation_complete(
    client, seed_reference_data, db_session
):
    """When an Activation row with statut_final=COMPLETE exists, statut_activation is ACTIVE."""
    employe = seed_reference_data['employe']
    op = _create_permission_operation(db_session, employe)

    _add_activation(
        db_session, op.id_operation,
        models.TypeActionEnum.ACTIVATION,
        models.StatutFinalEnum.COMPLETE,
    )

    response = client.get(f'/api/permissions/mes-permissions/{employe.matricule}')
    assert response.status_code == 200

    item = response.json()[0]
    assert item['activation_complete'] is True
    assert item['statut_activation'] == 'ACTIVE'


def test_cloture_complete_false_without_cloture_record(
    client, seed_reference_data, db_session
):
    """Without a CLOTURE activation row, cloture_complete must be False."""
    employe = seed_reference_data['employe']
    op = _create_permission_operation(db_session, employe)

    # Add ACTIVATION but no CLOTURE
    _add_activation(
        db_session, op.id_operation,
        models.TypeActionEnum.ACTIVATION,
        models.StatutFinalEnum.COMPLETE,
    )

    response = client.get(f'/api/permissions/mes-permissions/{employe.matricule}')
    assert response.status_code == 200

    item = response.json()[0]
    assert item['cloture_complete'] is False
    assert item['statut_cloture'] is None


def test_cloture_complete_true_when_cloture_activation_complete(
    client, seed_reference_data, db_session
):
    """When a CLOTURE Activation row with statut_final=COMPLETE exists, cloture_complete is True."""
    employe = seed_reference_data['employe']
    op = _create_permission_operation(db_session, employe)

    _add_activation(
        db_session, op.id_operation,
        models.TypeActionEnum.ACTIVATION,
        models.StatutFinalEnum.COMPLETE,
    )
    _add_activation(
        db_session, op.id_operation,
        models.TypeActionEnum.CLOTURE,
        models.StatutFinalEnum.COMPLETE,
    )

    response = client.get(f'/api/permissions/mes-permissions/{employe.matricule}')
    assert response.status_code == 200

    item = response.json()[0]
    assert item['cloture_complete'] is True
    assert item['statut_cloture'] == 'COMPLETE'


def test_mes_permissions_returns_empty_for_no_permissions(client, seed_reference_data):
    """Employee with no Permission operations gets an empty list."""
    # Use admin who has no permissions in seed data
    admin = seed_reference_data['admin']
    response = client.get(f'/api/permissions/mes-permissions/{admin.matricule}')
    assert response.status_code == 200
    assert response.json() == []
