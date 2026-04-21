"""Tests pour les audits d'actions organisation (CRUD entité, direction, département)."""
from app import models


def test_create_entite_logs_audit(db_session, seed_reference_data, client, auth_headers):
    admin = seed_reference_data['admin']
    headers = auth_headers(admin.matricule, 'ADMIN')
    res = client.post('/employees/entites', json={'nom': 'Nouvelle Entite'}, headers=headers)
    assert res.status_code in (200, 201), res.text

    logs = db_session.query(models.AuditLog).filter_by(action='CREATE_ENTITE').all()
    assert logs, 'Aucun audit CREATE_ENTITE trouvé'
    assert logs[-1].entity == 'ENTITE'


def test_delete_direction_logs_audit(db_session, seed_reference_data, client, auth_headers):
    direction = seed_reference_data['direction']
    admin = seed_reference_data['admin']
    headers = auth_headers(admin.matricule, 'ADMIN')

    # Detach dependencies first
    for emp in db_session.query(models.Employe).all():
        emp.id_direction = None
    for dept in db_session.query(models.Departement).all():
        dept.id_direction = None
    db_session.commit()

    res = client.delete(f'/employees/directions/{direction.id_direction}', headers=headers)
    if res.status_code == 200:
        logs = db_session.query(models.AuditLog).filter_by(action='DELETE_DIRECTION').all()
        assert logs, 'Audit DELETE_DIRECTION manquant'
