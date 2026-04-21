"""
Tests for mission-related endpoints.

Key scenarios:
- televerser-rapport: any assigned missionnaire can upload (not just the initiator)
- televerser-rapport: non-missionnaire is blocked with 403
- en-tant-que-missionnaire: returns all missions where user is assigned (no self-filter)
- statut-paiement-frais: response includes id_frais field
"""
import io
import os
import shutil
from datetime import date, timedelta

os.environ.setdefault('DATABASE_URL', 'sqlite:///./test_missions.db')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import Base, get_db

# ── In-memory SQLite test DB ────────────────────────────────────────────────
TEST_DB_URL = 'sqlite:///./test_missions.db'
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True, scope='module')
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists('test_missions.db'):
        os.remove('test_missions.db')
    # Clean up any uploaded files created during tests
    if os.path.exists('uploads/rapports_missions'):
        shutil.rmtree('uploads/rapports_missions', ignore_errors=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_token(client: TestClient, matricule: int, password: str = 'Test1234!') -> str | None:
    resp = client.post(
        '/auth/login',
        data={'matricule': str(matricule), 'password': password},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    if resp.status_code == 200:
        return resp.json().get('access_token')
    return None


def create_employee(db, matricule: int, role: str = 'EMPLOYE') -> None:
    from app import models
    from app.utils.security import hash_password

    existing = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not existing:
        emp = models.Employe(
            matricule=matricule,
            nom=f'Employe{matricule}',
            prenom='Test',
            email=f'employe{matricule}@test.com',
            date_embauche=date.today(),
        )
        db.add(emp)
        db.flush()

    existing_u = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not existing_u:
        utilisateur = models.Utilisateur(
            matricule=matricule,
            mot_de_passe_hash=hash_password('Test1234!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False,
            mfa_secret=None,
        )
        db.add(utilisateur)
    db.commit()


def create_mission_with_missionnaire(
    db,
    op_id_hint: int,
    initiateur_matricule: int,
    missionnaire_matricule: int,
) -> int:
    """Create an Operation + Mission + MissionnairesMission. Returns id_operation."""
    from app import models

    op = models.Operation(
        matricule=initiateur_matricule,
        type_demande='Mission',
        statut='validé',
        date_debut=date.today(),
        date_fin=date.today() + timedelta(days=3),
        motif='Mission test',
    )
    db.add(op)
    db.flush()

    mission = models.Mission(
        id_mission=op.id_operation,
        pays='Cameroun',
        ville='Douala',
        date_limite_rapport=date.today() + timedelta(days=10),
    )
    db.add(mission)

    mm = models.MissionnairesMission(
        id_mission=op.id_operation,
        matricule=missionnaire_matricule,
        role_mission='participant',
    )
    db.add(mm)
    db.commit()

    return op.id_operation


client = TestClient(app)

INITIATEUR = 9100
MISSIONNAIRE = 9101
TIERS = 9102


@pytest.fixture(scope='module', autouse=True)
def seed_data(setup_db):
    db = TestingSessionLocal()
    try:
        create_employee(db, INITIATEUR)
        create_employee(db, MISSIONNAIRE)
        create_employee(db, TIERS)
    finally:
        db.close()


# ── Tests: televerser-rapport ────────────────────────────────────────────────

class TestTeleverserRapport:
    """
    After removing the operation.matricule != matricule guard from
    televerser_rapport_mission(), any assigned missionnaire can upload.
    """

    def _op_id(self) -> int:
        db = TestingSessionLocal()
        try:
            return create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
        finally:
            db.close()

    def test_assigned_missionnaire_can_upload_rapport(self):
        """Missionnaire (non-initiator) must get 200, not 400."""
        op_id = self._op_id()
        token = get_token(client, MISSIONNAIRE)
        assert token, 'Could not get token for missionnaire'

        dummy_file = io.BytesIO(b'dummy rapport content')
        resp = client.post(
            f'/api/missions/{op_id}/televerser-rapport?matricule={MISSIONNAIRE}',
            headers={'Authorization': f'Bearer {token}'},
            files={'fichier': ('rapport.pdf', dummy_file, 'application/pdf')},
        )
        assert resp.status_code == 200, resp.text
        assert 'succès' in resp.json().get('message', '').lower()

    def test_non_missionnaire_is_rejected_403(self):
        """A user not assigned as missionnaire must get 403."""
        op_id = self._op_id()
        token = get_token(client, TIERS)
        assert token, 'Could not get token for tiers'

        dummy_file = io.BytesIO(b'dummy rapport content')
        resp = client.post(
            f'/api/missions/{op_id}/televerser-rapport?matricule={TIERS}',
            headers={'Authorization': f'Bearer {token}'},
            files={'fichier': ('rapport.pdf', dummy_file, 'application/pdf')},
        )
        assert resp.status_code == 403, resp.text

    def test_inexistent_operation_returns_404(self):
        """Non-existent id_operation must return 404."""
        token = get_token(client, MISSIONNAIRE)
        dummy_file = io.BytesIO(b'dummy')
        resp = client.post(
            f'/api/missions/999999/televerser-rapport?matricule={MISSIONNAIRE}',
            headers={'Authorization': f'Bearer {token}'},
            files={'fichier': ('rapport.pdf', dummy_file, 'application/pdf')},
        )
        assert resp.status_code == 404


# ── Tests: en-tant-que-missionnaire ─────────────────────────────────────────

class TestEnTantQueMissionnaire:
    """
    After removing the matricule != matricule filter, the endpoint must return
    all missions where this user is assigned — including self-initiated missions.
    """

    def test_returns_missions_for_assigned_user(self):
        """Endpoint returns list including the mission where MISSIONNAIRE is assigned."""
        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
        finally:
            db.close()

        token = get_token(client, MISSIONNAIRE)
        resp = client.get(
            f'/api/missions/en-tant-que-missionnaire/{MISSIONNAIRE}',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(m['id_operation'] == op_id for m in data), (
            f'Expected mission {op_id} in response, got: {[m["id_operation"] for m in data]}'
        )

    def test_self_initiated_missionnaire_is_included(self):
        """User can appear as missionnaire on their own mission (no self-filter)."""
        db = TestingSessionLocal()
        try:
            # INITIATEUR is both initiator AND missionnaire
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, INITIATEUR)
        finally:
            db.close()

        token = get_token(client, INITIATEUR)
        resp = client.get(
            f'/api/missions/en-tant-que-missionnaire/{INITIATEUR}',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert any(m['id_operation'] == op_id for m in data), (
            f'Expected self-initiated mission {op_id} in response'
        )


# ── Tests: statut-paiement-frais ─────────────────────────────────────────────

class TestStatutPaiementFrais:
    """
    statut-paiement-frais must include id_frais field (was missing before fix).
    """

    def _create_mission_with_frais(self) -> tuple[int, int]:
        """Returns (id_operation, id_frais)."""
        from app import models

        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)

            frais = models.Frais(
                id_operation=op_id,
                id_mission=op_id,
                frais_transport_voyage=50000,
                frais_hotel=20000,
                frais_deplacement=10000,
                frais_nutrition=5000,
                total_frais=85000,
            )
            db.add(frais)
            db.commit()
            db.refresh(frais)
            return op_id, frais.id_frais
        finally:
            db.close()

    def test_statut_paiement_includes_id_frais(self):
        """Response must include id_frais when frais exist."""
        op_id, frais_id = self._create_mission_with_frais()

        token = get_token(client, MISSIONNAIRE)
        resp = client.get(
            f'/api/missions/{op_id}/statut-paiement-frais',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 'id_frais' in data, 'id_frais key missing from response'
        assert data['id_frais'] == frais_id

    def test_statut_paiement_id_frais_is_null_when_no_frais(self):
        """id_frais must be null when no frais record exists."""
        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
        finally:
            db.close()

        token = get_token(client, MISSIONNAIRE)
        resp = client.get(
            f'/api/missions/{op_id}/statut-paiement-frais',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 'id_frais' in data
        assert data['id_frais'] is None

    def test_statut_paiement_404_for_unknown_mission(self):
        """Non-existent mission must return 404."""
        token = get_token(client, MISSIONNAIRE)
        resp = client.get(
            '/api/missions/999999/statut-paiement-frais',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 404


# ── Tests: supprimer-rapport ─────────────────────────────────────────────────

class TestSupprimerRapport:
    """DELETE /{id_operation}/supprimer-rapport"""

    def _upload_rapport(self, op_id: int) -> None:
        """Upload a rapport so it can later be deleted."""
        token = get_token(client, MISSIONNAIRE)
        dummy = io.BytesIO(b'rapport content for deletion test')
        resp = client.post(
            f'/api/missions/{op_id}/televerser-rapport?matricule={MISSIONNAIRE}',
            headers={'Authorization': f'Bearer {token}'},
            files={'fichier': ('del_rapport.pdf', dummy, 'application/pdf')},
        )
        assert resp.status_code == 200, f'Upload failed: {resp.text}'

    def test_missionnaire_can_delete_rapport(self):
        """Assigned missionnaire gets 200 when deleting an existing rapport."""
        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
        finally:
            db.close()
        self._upload_rapport(op_id)

        token = get_token(client, MISSIONNAIRE)
        resp = client.delete(
            f'/api/missions/{op_id}/supprimer-rapport?matricule={MISSIONNAIRE}',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 200, resp.text
        assert 'supprimé' in resp.json().get('message', '').lower()

    def test_non_missionnaire_cannot_delete_rapport(self):
        """Non-missionnaire gets 403 when attempting to delete."""
        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
        finally:
            db.close()
        self._upload_rapport(op_id)

        token = get_token(client, TIERS)
        resp = client.delete(
            f'/api/missions/{op_id}/supprimer-rapport?matricule={TIERS}',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 403, resp.text

    def test_delete_rapport_when_none_returns_404(self):
        """Deleting rapport when none exists returns 404."""
        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
        finally:
            db.close()

        token = get_token(client, MISSIONNAIRE)
        resp = client.delete(
            f'/api/missions/{op_id}/supprimer-rapport?matricule={MISSIONNAIRE}',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 404, resp.text


# ── Tests: supprimer-preuve ──────────────────────────────────────────────────

class TestSupprimerPreuve:
    """DELETE /frais/{id_frais}/supprimer-preuve"""

    def _create_frais_with_preuve(self) -> tuple[int, int]:
        """Create mission + frais, upload one preuve. Returns (op_id, id_frais)."""
        from app import models

        db = TestingSessionLocal()
        try:
            op_id = create_mission_with_missionnaire(db, 0, INITIATEUR, MISSIONNAIRE)
            frais = models.Frais(
                id_operation=op_id,
                id_mission=op_id,
                frais_transport_voyage=10000,
                total_frais=10000,
            )
            db.add(frais)
            db.commit()
            db.refresh(frais)
            frais_id = frais.id_frais
        finally:
            db.close()

        token = get_token(client, MISSIONNAIRE)
        dummy = io.BytesIO(b'facture content for deletion test')
        resp = client.post(
            f'/api/missions/frais/{frais_id}/televerser-preuves?matricule={MISSIONNAIRE}&type_preuve=facture',
            headers={'Authorization': f'Bearer {token}'},
            files={'fichier': ('del_facture.pdf', dummy, 'application/pdf')},
        )
        assert resp.status_code == 200, f'Preuve upload failed: {resp.text}'
        return op_id, frais_id

    def test_missionnaire_can_delete_preuve(self):
        """Assigned missionnaire gets 200 when deleting preuve at index 0."""
        _, frais_id = self._create_frais_with_preuve()

        token = get_token(client, MISSIONNAIRE)
        resp = client.delete(
            f'/api/missions/frais/{frais_id}/supprimer-preuve?matricule={MISSIONNAIRE}&index=0',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 200, resp.text
        assert 'supprimée' in resp.json().get('message', '').lower()

    def test_bad_index_returns_404(self):
        """Index out of range returns 404."""
        _, frais_id = self._create_frais_with_preuve()

        token = get_token(client, MISSIONNAIRE)
        resp = client.delete(
            f'/api/missions/frais/{frais_id}/supprimer-preuve?matricule={MISSIONNAIRE}&index=99',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 404, resp.text

    def test_non_missionnaire_cannot_delete_preuve(self):
        """Non-missionnaire gets 403."""
        _, frais_id = self._create_frais_with_preuve()

        token = get_token(client, TIERS)
        resp = client.delete(
            f'/api/missions/frais/{frais_id}/supprimer-preuve?matricule={TIERS}&index=0',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 403, resp.text
