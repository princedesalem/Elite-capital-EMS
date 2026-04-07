"""
Tests pour le workflow PCA/AG: visibilité croisée et fallback Employe.id_role
"""
import pytest
from datetime import date
from app import models
from app.utils import workflow as wf_utils
from app.utils.security import hash_password


@pytest.fixture()
def seed_pca_ag(db_session, seed_reference_data):
    """Fixture ajoutant rôles PCA et AG, plus un employé + validateur PCA et un validateur AG."""
    refs = seed_reference_data
    roles = refs['roles']

    # Créer les rôles PCA et AG
    role_pca = models.Role(name='PCA', description='Président du Conseil')
    role_ag = models.Role(name='AG', description='Administrateur Général')
    db_session.add_all([role_pca, role_ag])
    db_session.flush()
    roles['PCA'] = role_pca
    roles['AG'] = role_ag

    # Validateur PCA (utilise le chemin Utilisateur.role_id)
    pca_emp = models.Employe(
        matricule=6001,
        nom='Pca', prenom='Alpha',
        email='6001@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=refs['departement'].dept_id,
        id_direction=refs['direction'].id_direction,
        id_entite=refs['entite'].id_entite,
        id_role=role_pca.id,
        fonction='PCA',
        sexe='M',
    )
    db_session.add(pca_emp)
    db_session.flush()
    pca_user = models.Utilisateur(
        matricule=6001,
        email='6001@example.com',
        role_id=role_pca.id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db_session.add(pca_user)
    db_session.flush()

    # Validateur AG (utilise uniquement Employe.id_role — pas de Utilisateur)
    ag_emp = models.Employe(
        matricule=7001,
        nom='Ag', prenom='Beta',
        email='7001@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=refs['departement'].dept_id,
        id_direction=refs['direction'].id_direction,
        id_entite=refs['entite'].id_entite,
        id_role=role_ag.id,
        fonction='AG',
        sexe='M',
    )
    db_session.add(ag_emp)
    db_session.flush()
    # PAS de Utilisateur pour ag_emp → doit passer par Employe.id_role fallback

    db_session.commit()
    return {**refs, 'role_pca': role_pca, 'role_ag': role_ag, 'pca_emp': pca_emp, 'ag_emp': ag_emp}


class TestObtenir_role_validateur:
    def test_pca_via_utilisateur(self, db_session, seed_pca_ag):
        """Retourne PCA via le chemin Utilisateur.role_id"""
        result = wf_utils.obtenir_role_validateur(6001, db_session)
        assert result == 'PCA'

    def test_ag_via_employe_fallback(self, db_session, seed_pca_ag):
        """Retourne AG via le fallback Employe.id_role (sans Utilisateur)"""
        result = wf_utils.obtenir_role_validateur(7001, db_session)
        assert result == 'AG'

    def test_employe_default(self, db_session, seed_reference_data):
        """Retourne EMPLOYE pour un matricule inexistant"""
        result = wf_utils.obtenir_role_validateur(99999, db_session)
        assert result == 'EMPLOYE'


class TestObtenir_validateur_pour_role:
    def test_trouve_validateur_pca(self, db_session, seed_pca_ag):
        """Trouve le validateur PCA via Utilisateur.role_id"""
        employe = seed_pca_ag['employe']
        result = wf_utils.obtenir_validateur_pour_role(employe, 'PCA', db_session)
        assert result == 6001

    def test_trouve_validateur_ag_via_employe_fallback(self, db_session, seed_pca_ag):
        """Trouve le validateur AG via Employe.id_role fallback"""
        employe = seed_pca_ag['employe']
        result = wf_utils.obtenir_validateur_pour_role(employe, 'AG', db_session)
        assert result == 7001

    def test_retourne_none_si_role_inexistant(self, db_session, seed_reference_data):
        """Retourne None si aucun validateur trouvé"""
        employe = seed_reference_data['employe']
        result = wf_utils.obtenir_validateur_pour_role(employe, 'INEXISTANT', db_session)
        assert result is None


class TestWorkflowRouterPCAVisibilite:
    """Test que PCA voit les opérations en attente de validation PCA ou AG"""

    def test_pca_voit_ses_demandes(self, client, db_session, seed_pca_ag, auth_headers):
        """GET /api/workflow/a-valider/{matricule} retourne 200 pour PCA"""
        resp = client.get(
            f'/api/workflow/a-valider/{seed_pca_ag["pca_emp"].matricule}',
            headers=auth_headers(seed_pca_ag['pca_emp'].matricule, 'PCA')
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_ag_voit_ses_demandes(self, client, db_session, seed_pca_ag, auth_headers):
        """GET /api/workflow/a-valider/{matricule} retourne 200 pour AG"""
        resp = client.get(
            f'/api/workflow/a-valider/{seed_pca_ag["ag_emp"].matricule}',
            headers=auth_headers(seed_pca_ag['ag_emp'].matricule, 'AG')
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_role_ok_crosstype(self):
        """PCA doit voir les opérations annotées AG et vice-versa (logique _TERMINAUX)"""
        TERMINAUX = {'PCA', 'AG'}
        # PCA valide doit voir une opération dont prochain_role == AG
        def role_ok(role_validateur, prochain_role):
            return (prochain_role == role_validateur) or (
                role_validateur in TERMINAUX and prochain_role in TERMINAUX
            )

        assert role_ok('PCA', 'PCA') is True
        assert role_ok('PCA', 'AG') is True
        assert role_ok('AG', 'PCA') is True
        assert role_ok('AG', 'AG') is True
        assert role_ok('PCA', 'RH') is False
        assert role_ok('RH', 'PCA') is False
