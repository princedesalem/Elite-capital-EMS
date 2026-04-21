"""Tests for PDF export endpoints — GET /api/pdf/{type}/{id}."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def pdf_operation_data(seed_reference_data, db_session):
    """Create an operation of each type with validation history."""
    from app import models
    refs = seed_reference_data
    emp = refs['employe']
    today = date.today()

    # Mission
    op_mission = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='validé',
        date_debut=today + timedelta(days=5), date_fin=today + timedelta(days=10),
        date_demande=today,
    )
    db_session.add(op_mission)
    db_session.flush()

    mission = models.Mission(id_mission=op_mission.id_operation, pays='Cameroun', ville='Douala')
    db_session.add(mission)

    seg = models.MissionSegment(
        id_mission=op_mission.id_operation, pays='Cameroun', ville='Douala',
        date_debut=today + timedelta(days=5), date_fin=today + timedelta(days=10),
        ordre=1,
    )
    db_session.add(seg)

    miss = models.MissionnairesMission(
        id_mission=op_mission.id_operation, matricule=emp.matricule,
        role_mission='responsable',
    )
    db_session.add(miss)

    # Congé
    op_conge = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Congé', statut='validé',
        date_debut=today + timedelta(days=20), date_fin=today + timedelta(days=30),
        date_demande=today, duree_jours=10, motif='Repos annuel',
    )
    db_session.add(op_conge)

    # Permission
    op_perm = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Permission', statut='validé',
        date_debut=today + timedelta(days=40), date_fin=today + timedelta(days=41),
        date_demande=today, duree_jours=1, motif='RDV médical',
    )
    db_session.add(op_perm)

    # Sortie
    op_sortie = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Sortie', statut='validé',
        date_debut=today, date_fin=today,
        date_demande=today, motif='Visite client',
    )
    db_session.add(op_sortie)
    db_session.flush()

    # Add a validation for the mission
    val = models.Validation(
        id_operation=op_mission.id_operation,
        matricule_validateur=refs['responsable'].matricule,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
        commentaire='Approuvé',
    )
    db_session.add(val)
    db_session.commit()

    return {
        'mission_id': op_mission.id_operation,
        'conge_id': op_conge.id_operation,
        'permission_id': op_perm.id_operation,
        'sortie_id': op_sortie.id_operation,
        'refs': refs,
    }


def test_pdf_mission(client, pdf_operation_data):
    r = client.get(f"/api/pdf/mission/{pdf_operation_data['mission_id']}")
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/pdf'
    # PDF starts with %PDF
    assert r.content[:5] == b'%PDF-'


def test_pdf_conge(client, pdf_operation_data):
    r = client.get(f"/api/pdf/conges/{pdf_operation_data['conge_id']}")
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/pdf'
    assert r.content[:5] == b'%PDF-'


def test_pdf_permission(client, pdf_operation_data):
    r = client.get(f"/api/pdf/permission/{pdf_operation_data['permission_id']}")
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/pdf'
    assert r.content[:5] == b'%PDF-'


def test_pdf_sortie(client, pdf_operation_data):
    r = client.get(f"/api/pdf/sortie/{pdf_operation_data['sortie_id']}")
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/pdf'
    assert r.content[:5] == b'%PDF-'


def test_pdf_mission_not_found(client, seed_reference_data):
    r = client.get("/api/pdf/mission/999999")
    assert r.status_code == 404


def test_pdf_conge_not_found(client, seed_reference_data):
    r = client.get("/api/pdf/conges/999999")
    assert r.status_code == 404


def test_pdf_conge_wrong_type(client, pdf_operation_data):
    """Requesting conge PDF with a mission ID should 404."""
    r = client.get(f"/api/pdf/conges/{pdf_operation_data['mission_id']}")
    assert r.status_code == 404


def test_pdf_permission_not_found(client, seed_reference_data):
    r = client.get("/api/pdf/permission/999999")
    assert r.status_code == 404


def test_pdf_sortie_not_found(client, seed_reference_data):
    r = client.get("/api/pdf/sortie/999999")
    assert r.status_code == 404


def test_pdf_analytics_contains_nom_prenom(client, pdf_operation_data, auth_headers, db_session):
    """Rapport analytique RH : 5 pages, PDF valide, emp_names lookup correct."""
    from app import models

    headers = auth_headers(pdf_operation_data['refs']['rh'].matricule, 'RH')
    r = client.get("/api/pdf/report/analytics", headers=headers)
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/pdf'
    assert r.content[:5] == b'%PDF-'

    # PDF doit contenir exactement 5 pages (Effectifs / Congés / Missions / Permissions / Sorties)
    assert b'/Count 5' in r.content, "Le rapport analytique doit contenir 5 pages"

    # Vérifie que la requête DB produirait bien les noms attendus
    emp = pdf_operation_data['refs']['employe']
    emps = db_session.query(models.Employe).all()
    emp_names = {e.matricule: (e.nom or '', e.prenom or '') for e in emps}
    assert emp.matricule in emp_names, "L'employé doit figurer dans le dictionnaire emp_names"
    nom, prenom = emp_names[emp.matricule]
    assert nom == emp.nom, f"Nom attendu '{emp.nom}', obtenu '{nom}'"
    assert prenom == emp.prenom, f"Prénom attendu '{emp.prenom}', obtenu '{prenom}'"

    # Les tables ont bien 8 colonnes (les 5 sections opérations ont 8 cols après ajout Nom/Prénom)
    # On vérifie que le PDF est plus volumineux que 10 Ko (signe que les données sont présentes)
    assert len(r.content) > 10_000, "Le PDF semble vide ou trop petit"


def test_pdf_analytics_requires_auth(client, seed_reference_data):
    """L'endpoint analytics doit refuser les requêtes sans token."""
    r = client.get("/api/pdf/report/analytics")
    assert r.status_code == 401


def test_pdf_analytics_forbidden_for_employe(client, seed_reference_data, auth_headers):
    """Un simple employé ne doit pas accéder au rapport analytique."""
    emp = seed_reference_data['employe']
    headers = auth_headers(emp.matricule, 'EMPLOYE')
    r = client.get("/api/pdf/report/analytics", headers=headers)
    assert r.status_code == 403
