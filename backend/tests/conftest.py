import os
import sys
from pathlib import Path
import tempfile

TEST_DB_PATH = Path(tempfile.gettempdir()) / 'extranet_test_suite.db'
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ['DATABASE_URL'] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ['SECRET_KEY'] = 'test-secret-key'
os.environ['TESTING'] = '1'

import pytest
from fastapi.testclient import TestClient
from datetime import date
from sqlalchemy.exc import SAWarning
import warnings

warnings.filterwarnings(
    'ignore',
    category=SAWarning,
)

from app.main import app
from app.db import Base, SessionLocal, engine
from app import models
from app.utils.security import create_access_token, hash_password


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def seed_reference_data(db_session):
    entite = models.Entite(nom='ELCAM')
    db_session.add(entite)
    db_session.flush()

    pays_cm = models.Pays(nom_pays='Cameroun', code_pays='CM')
    db_session.add(pays_cm)
    db_session.flush()

    localisation_douala = models.Localisation(ville='Douala', id_pays=pays_cm.id_pays)
    db_session.add(localisation_douala)
    db_session.flush()

    direction = models.Direction(
        nom='Direction Generale',
        id_entite=entite.id_entite,
        id_localisation=localisation_douala.id_localisation,
    )
    db_session.add(direction)
    db_session.flush()

    departement = models.Departement(nom='Operations', id_entite=entite.id_entite, id_direction=direction.id_direction)
    db_session.add(departement)
    db_session.flush()

    role_names = ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'ADMIN']
    roles = {}
    for name in role_names:
        role = models.Role(name=name, description=f'Role {name}')
        db_session.add(role)
        db_session.flush()
        roles[name] = role

    def add_user(matricule, nom, prenom, role_name, sexe='M', n1=None):
        employe = models.Employe(
            matricule=matricule,
            nom=nom,
            prenom=prenom,
            email=f'{matricule}@example.com',
            date_embauche=date(2024, 1, 1),
            dept_id=departement.dept_id,
            id_direction=direction.id_direction,
            id_entite=entite.id_entite,
            id_role=roles[role_name].id,
            fonction=role_name,
            n1=n1,
            sexe=sexe,
        )
        db_session.add(employe)
        db_session.flush()
        user = models.Utilisateur(
            matricule=matricule,
            email=f'{matricule}@example.com',
            role_id=roles[role_name].id,
            mot_de_passe_hash=hash_password('PasswordTemp123!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False,
            mfa_active=False,
        )
        db_session.add(user)
        db_session.flush()
        return employe, user

    responsable, _ = add_user(2001, 'Resp', 'One', 'RESPONSABLE', sexe='M')
    employe, _ = add_user(1001, 'Emp', 'One', 'EMPLOYE', sexe='F', n1=responsable.matricule)
    directeur, _ = add_user(3001, 'Dir', 'One', 'DIRECTEUR', sexe='M')
    dg, _ = add_user(4001, 'Dg', 'One', 'DG', sexe='M')
    rh, _ = add_user(5001, 'Rh', 'One', 'RH', sexe='F')
    admin, _ = add_user(9001, 'Admin', 'Root', 'ADMIN', sexe='M')

    direction.id_directeur = directeur.matricule
    departement.id_responsable = responsable.matricule

    operation = models.Operation(
        matricule=employe.matricule,
        type_demande='CONGE',
        titre='Demande conge',
        statut='en attente',
        date_debut=date(2026, 3, 25),
        date_fin=date(2026, 3, 27),
        duree_jours=3,
        motif='Repos',
    )
    db_session.add(operation)
    db_session.commit()
    db_session.refresh(operation)

    return {
        'entite': entite,
        'pays': pays_cm,
        'localisation': localisation_douala,
        'direction': direction,
        'departement': departement,
        'roles': roles,
        'employe': employe,
        'responsable': responsable,
        'directeur': directeur,
        'dg': dg,
        'rh': rh,
        'admin': admin,
        'operation': operation,
    }


@pytest.fixture()
def auth_headers():
    def _build(matricule, role):
        token = create_access_token({'matricule': matricule, 'role': role}, expires_minutes=120)
        return {'Authorization': f'Bearer {token}'}

    return _build
