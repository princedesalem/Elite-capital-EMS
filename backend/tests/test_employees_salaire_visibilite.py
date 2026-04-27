"""Phase F — D : visibilité salaire confidentielle."""
import pytest
from datetime import date
from app import models


@pytest.fixture()
def seed_with_salary(db_session):
    entite = models.Entite(nom='ENT'); db_session.add(entite); db_session.flush()
    rh_role = models.Role(name='RH'); db_session.add(rh_role); db_session.flush()
    emp_role = models.Role(name='EMPLOYE'); db_session.add(emp_role); db_session.flush()
    rh = models.Employe(matricule='RH001', nom='RH', prenom='Boss',
                        email='rh@e.x', date_embauche=date(2024,1,1),
                        id_entite=entite.id_entite, id_role=rh_role.id,
                        fonction='RH', sexe='F',
                        salaire_brut=900000, salaire_devise='XAF')
    target = models.Employe(matricule='EMP100', nom='Doe', prenom='John',
                            email='john@e.x', date_embauche=date(2024,1,1),
                            id_entite=entite.id_entite, id_role=emp_role.id,
                            fonction='EMPLOYE', sexe='M',
                            salaire_brut=500000, salaire_devise='XAF')
    other = models.Employe(matricule='EMP200', nom='Other', prenom='Pers',
                           email='oth@e.x', date_embauche=date(2024,1,1),
                           id_entite=entite.id_entite, id_role=emp_role.id,
                           fonction='EMPLOYE', sexe='M',
                           salaire_brut=400000, salaire_devise='XAF')
    db_session.add_all([rh, target, other]); db_session.commit()


def test_rh_voit_salaire(client, auth_headers, seed_with_salary):
    h = auth_headers('RH001', 'RH')
    resp = client.get('/employees/EMP100', headers=h)
    assert resp.status_code == 200
    data = resp.json()
    assert data['salaire_brut'] is not None
    assert float(data['salaire_brut']) == 500000.0


def test_employe_voit_son_propre_salaire(client, auth_headers, seed_with_salary):
    h = auth_headers('EMP100', 'EMPLOYE')
    resp = client.get('/employees/EMP100', headers=h)
    assert resp.status_code == 200
    data = resp.json()
    assert data['salaire_brut'] is not None


def test_employe_ne_voit_pas_salaire_dautrui(client, auth_headers, seed_with_salary):
    h = auth_headers('EMP200', 'EMPLOYE')
    resp = client.get('/employees/EMP100', headers=h)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get('salaire_brut') is None
    assert data.get('salaire_devise') is None
