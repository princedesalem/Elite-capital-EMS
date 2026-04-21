"""Tests pour la table PARCOURS_EMPLOYE et son endpoint."""
from app import models
from app.utils import parcours as parcours_utils


def test_parcours_event_is_persisted(db_session, seed_reference_data, client, auth_headers):
    emp = seed_reference_data['employe']
    parcours_utils.record_event(
        db_session,
        matricule=emp.matricule,
        type_action=models.TypeParcoursEnum.PROMOTION,
        champ_modifie='id_role',
        ancienne_valeur='EMPLOYE',
        nouvelle_valeur='RESPONSABLE',
        libelle='Promotion EMPLOYE → RESPONSABLE',
        actor=seed_reference_data['rh'].matricule,
    )
    db_session.commit()

    rows = db_session.query(models.ParcoursEmploye).filter_by(matricule=emp.matricule).all()
    assert len(rows) == 1
    assert rows[0].champ_modifie == 'id_role'
    assert rows[0].libelle.startswith('Promotion')

    rh_matricule = seed_reference_data['rh'].matricule
    headers = auth_headers(rh_matricule, 'RH')
    res = client.get(f'/employees/{emp.matricule}/parcours', headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]['matricule'] == emp.matricule
    assert data[0]['type_action'] == 'PROMOTION'


def test_employee_role_change_creates_promotion_entry(db_session, seed_reference_data, client, auth_headers):
    """Un changement de rôle via l'endpoint admin enregistre un événement PROMOTION."""
    emp = seed_reference_data['employe']
    admin = seed_reference_data['admin']

    headers = auth_headers(admin.matricule, 'ADMIN')
    res = client.put(
        f'/employees/admin/utilisateurs/{emp.matricule}',
        json={'role': 'RESPONSABLE'},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(matricule=emp.matricule).all()
    assert any(r.type_action == models.TypeParcoursEnum.PROMOTION for r in rows)
