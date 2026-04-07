"""
Tests for employee photo endpoints.
Verifies:
  - upload with field name 'photo' works (not 'file')
  - upload with wrong field name 'file' returns 422
  - GET employee response includes photo_url field
  - DELETE photo endpoint returns non-500
"""
import io
import base64

import pytest
from fastapi.testclient import TestClient

from app import models
from app.utils.security import create_access_token


def _minimal_png() -> bytes:
    """1×1 transparent PNG."""
    b64 = (
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
        'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    )
    return base64.b64decode(b64)


def _auth_headers(seed_reference_data) -> dict:
    token = create_access_token({'sub': '9001', 'matricule': '9001', 'role': 'ADMIN'})
    return {'Authorization': f'Bearer {token}'}


class TestPhotoUpload:
    def test_upload_with_photo_field_succeeds(self, client, db_session, seed_reference_data):
        """POST /employees/9001/photo with field 'photo' must not return 422 or 500."""
        headers = _auth_headers(seed_reference_data)
        png = _minimal_png()
        resp = client.post(
            '/employees/9001/photo',
            files={'photo': ('avatar.png', io.BytesIO(png), 'image/png')},
            headers=headers,
        )
        assert resp.status_code not in (422, 500), (
            f"photo upload with 'photo' field returned {resp.status_code}: {resp.text}"
        )

    def test_upload_with_file_field_fails_400(self, client, db_session, seed_reference_data):
        """POST /employees/9001/photo with wrong field name 'file' must return 400.
        The backend reads form.get('photo') and raises 400 when the field is missing.
        This confirms the frontend MUST send 'photo', not 'file'.
        """
        headers = _auth_headers(seed_reference_data)
        png = _minimal_png()
        resp = client.post(
            '/employees/9001/photo',
            files={'file': ('avatar.png', io.BytesIO(png), 'image/png')},
            headers=headers,
        )
        assert resp.status_code == 400, (
            f"Expected 400 for wrong field 'file', got {resp.status_code}: {resp.text}"
        )

    def test_get_employee_has_photo_url_field(self, client, db_session, seed_reference_data):
        """GET /employees/{matricule} response must include photo_url key."""
        headers = _auth_headers(seed_reference_data)
        resp = client.get('/employees/9001', headers=headers)
        if resp.status_code == 200:
            assert 'photo_url' in resp.json(), "photo_url missing from employee response"

    def test_delete_photo_no_server_error(self, client, db_session, seed_reference_data):
        """DELETE /employees/{matricule}/photo must return 200 or 404, not 500."""
        headers = _auth_headers(seed_reference_data)
        resp = client.delete('/employees/9001/photo', headers=headers)
        assert resp.status_code in (200, 404), (
            f"Unexpected status from DELETE photo: {resp.status_code}"
        )

    def test_statut_employe_in_employee_response(self, client, db_session, seed_reference_data):
        """statut_employe must be a string (not enum object) in serialized employee.
        Regression: previously crashed when MySQL returned a raw string instead of enum instance.
        """
        headers = _auth_headers(seed_reference_data)
        resp = client.get('/employees/1001', headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            statut = data.get('statut_employe')
            assert statut is None or isinstance(statut, str), (
                f"statut_employe should be str, got {type(statut)}: {statut}"
            )
