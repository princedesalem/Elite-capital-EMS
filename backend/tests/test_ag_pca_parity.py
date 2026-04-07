"""
Tests: AG a les mêmes privilèges que PCA dans access_control.py.
"""
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from app.utils.access_control import (
    ensure_can_create_for_matricule,
    is_rh_or_admin_or_pca,
    ensure_employee_crud_role,
    ensure_mission_initiator_role,
    MISSION_INITIATOR_ROLES,
)
from app.utils import security


def _make_mock_request(role: str, matricule: int = 9001):
    """Crée une requête simulée avec un Bearer token valide."""
    token = security.create_access_token({"matricule": matricule, "role": role})
    mock_req = MagicMock()
    mock_req.headers.get.return_value = f"Bearer {token}"
    return mock_req


class TestMissionInitiatorRoles:
    def test_ag_dans_mission_initiator_roles(self):
        assert "AG" in MISSION_INITIATOR_ROLES

    def test_pca_dans_mission_initiator_roles(self):
        assert "PCA" in MISSION_INITIATOR_ROLES

    def test_ag_peut_initier_mission(self):
        # Ne doit pas lever d'exception
        ensure_mission_initiator_role("AG")

    def test_pca_peut_initier_mission(self):
        ensure_mission_initiator_role("PCA")

    def test_employe_ne_peut_pas_initier_mission(self):
        with pytest.raises(HTTPException) as exc_info:
            ensure_mission_initiator_role("EMPLOYE")
        assert exc_info.value.status_code == 403


class TestCreerPourAutrui:
    def test_ag_peut_creer_pour_autrui(self):
        req = _make_mock_request("AG", matricule=9001)
        actor, role = ensure_can_create_for_matricule(req, matricule_cible=1001)
        assert role == "AG"

    def test_pca_peut_creer_pour_autrui(self):
        req = _make_mock_request("PCA", matricule=9001)
        actor, role = ensure_can_create_for_matricule(req, matricule_cible=1001)
        assert role == "PCA"

    def test_rh_peut_creer_pour_autrui(self):
        req = _make_mock_request("RH", matricule=9001)
        actor, role = ensure_can_create_for_matricule(req, matricule_cible=1001)
        assert role == "RH"

    def test_employe_ne_peut_pas_creer_pour_autrui(self):
        req = _make_mock_request("EMPLOYE", matricule=1001)
        with pytest.raises(HTTPException) as exc_info:
            ensure_can_create_for_matricule(req, matricule_cible=9999)
        assert exc_info.value.status_code == 403

    def test_employe_peut_creer_pour_lui_meme(self):
        req = _make_mock_request("EMPLOYE", matricule=1001)
        actor, role = ensure_can_create_for_matricule(req, matricule_cible=1001)
        assert role == "EMPLOYE"


class TestIsRhAdminPca:
    def test_ag_est_considere_admin_pca(self):
        assert is_rh_or_admin_or_pca("AG") is True

    def test_pca_est_considere_admin_pca(self):
        assert is_rh_or_admin_or_pca("PCA") is True

    def test_rh_est_considere_admin_pca(self):
        assert is_rh_or_admin_or_pca("RH") is True

    def test_admin_est_considere_admin_pca(self):
        assert is_rh_or_admin_or_pca("ADMIN") is True

    def test_dg_nest_pas_admin_pca(self):
        assert is_rh_or_admin_or_pca("DG") is False

    def test_employe_nest_pas_admin_pca(self):
        assert is_rh_or_admin_or_pca("EMPLOYE") is False


class TestEmployeeCrudRole:
    def test_ag_peut_gerer_employes(self):
        req = _make_mock_request("AG")
        ensure_employee_crud_role(req)  # Ne doit pas lever d'exception

    def test_pca_peut_gerer_employes(self):
        req = _make_mock_request("PCA")
        ensure_employee_crud_role(req)

    def test_rh_peut_gerer_employes(self):
        req = _make_mock_request("RH")
        ensure_employee_crud_role(req)

    def test_admin_peut_gerer_employes(self):
        req = _make_mock_request("ADMIN")
        ensure_employee_crud_role(req)

    def test_dg_ne_peut_pas_gerer_employes(self):
        req = _make_mock_request("DG")
        with pytest.raises(HTTPException) as exc_info:
            ensure_employee_crud_role(req)
        assert exc_info.value.status_code == 403

    def test_employe_ne_peut_pas_gerer_employes(self):
        req = _make_mock_request("EMPLOYE")
        with pytest.raises(HTTPException) as exc_info:
            ensure_employee_crud_role(req)
        assert exc_info.value.status_code == 403

    def test_directeur_ne_peut_pas_gerer_employes(self):
        req = _make_mock_request("DIRECTEUR")
        with pytest.raises(HTTPException) as exc_info:
            ensure_employee_crud_role(req)
        assert exc_info.value.status_code == 403
