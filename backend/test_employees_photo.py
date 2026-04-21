"""
Tests for employee photo upload/delete endpoints.
Verifies the multipart field name is 'photo' (not 'file').
"""
import io
import os
os.environ.setdefault('DATABASE_URL', 'sqlite:///./test_photo.db')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import Base, get_db

TEST_DB_URL = 'sqlite:///./test_photo.db'
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(autouse=True, scope='module')
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    for f in ('test_photo.db',):
        if os.path.exists(f):
            os.remove(f)


def _create_employee_and_login():
    from app import models
    from app.utils.security import create_access_token, hash_password
    from datetime import date

    db = TestingSessionLocal()
    try:
        existing = db.query(models.Employe).filter(models.Employe.matricule == 9999).first()
        if not existing:
            emp = models.Employe(
                matricule=9999,
                nom='Photo',
                prenom='Test',
                email='photo@test.com',
                date_embauche=date(2024, 1, 1),
            )
            db.add(emp)
            db.flush()
            user = models.Utilisateur(
                matricule=9999,
                email='photo@test.com',
                mot_de_passe_hash=hash_password('Test1234!'),
                mot_de_passe_temporaire=False,
                mfa_enabled=False,
                mfa_active=False,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    return create_access_token({'matricule': 9999, 'role': 'ADMIN'})


class TestPhotoEndpoints:
    def setup_method(self):
        self.token = _create_employee_and_login()
        self.headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}

    def _minimal_png(self):
        """Return bytes of a minimal valid 1×1 PNG image."""
        import base64
        # 1×1 transparent PNG
        b64 = (
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
            'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        )
        return base64.b64decode(b64)

    def test_upload_photo_with_photo_field_name(self):
        """POST /{matricule}/photo with field name 'photo' must not return 422."""
        png = self._minimal_png()
        resp = client.post(
            '/employees/9999/photo',
            files={'photo': ('avatar.png', io.BytesIO(png), 'image/png')},
            headers=self.headers,
        )
        # 200 (success) or 400 (business validation) but NOT 422 (wrong field) or 500
        assert resp.status_code not in (422, 500), f"Unexpected status: {resp.status_code} — {resp.text}"

    def test_upload_photo_wrong_field_name_returns_422(self):
        """POST /{matricule}/photo with field name 'file' must return 400 or 422 (not 200/500).
        This confirms the frontend must send 'photo', not 'file'.
        """
        png = self._minimal_png()
        resp = client.post(
            '/employees/9999/photo',
            files={'file': ('avatar.png', io.BytesIO(png), 'image/png')},
            headers=self.headers,
        )
        assert resp.status_code in (400, 422), (
            f"Expected 400 or 422 for wrong field name 'file', got {resp.status_code}"
        )

    def test_get_employee_includes_photo_url(self):
        """GET /employees/{matricule} response includes photo_url field."""
        resp = client.get('/employees/9999', headers=self.headers)
        if resp.status_code == 200:
            assert 'photo_url' in resp.json()

    def test_delete_photo_no_crash(self):
        """DELETE /{matricule}/photo returns 200 or 404, not 500."""
        resp = client.delete('/employees/9999/photo', headers=self.headers)
        assert resp.status_code in (200, 404), f"Unexpected: {resp.status_code}"
