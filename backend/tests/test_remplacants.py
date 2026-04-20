"""
Tests pour le système de remplaçants automatiques.
"""
import pytest
from datetime import date, timedelta
from app import models
from app.utils import remplacants as rempl_utils
from app.utils.security import hash_password


@pytest.fixture()
def seed_remplacants(db_session, seed_reference_data):
    """Fixture ajoutant des employés collègues pour les tests remplaçants."""
    refs = seed_reference_data

    def _add(matricule, nom):
        emp = models.Employe(
            matricule=matricule,
            nom=nom, prenom='Test',
            email=f'{matricule}@example.com',
            date_embauche=date(2024, 1, 1),
            dept_id=refs['departement'].dept_id,
            id_direction=refs['direction'].id_direction,
            id_entite=refs['entite'].id_entite,
            id_role=refs['roles']['EMPLOYE'].id,
            fonction='Agent',
            sexe='M',
            statut_employe=models.StatutEmployeEnum.ACTIF,
            absent=False,
        )
        db_session.add(emp)
        db_session.flush()
        return emp

    c1 = _add(2101, 'Collegue1')
    c2 = _add(2102, 'Collegue2')
    # c1 est subordonné direct de l'employé (n1 requis par l'algo) ; c2 reste sans lien hiérarchique
    c1.n1 = refs['employe'].matricule
    db_session.commit()
    return {**refs, 'c1': c1, 'c2': c2}


class TestTrouverRemplacants:
    def test_retourne_liste_de_dicts(self, db_session, seed_remplacants):
        employe = seed_remplacants['employe']
        result = rempl_utils.trouver_remplacants_automatiques(employe, db_session, limite=5)
        assert isinstance(result, list)
        for r in result:
            assert isinstance(r, dict)
            assert 'matricule' in r
            assert 'nom' in r
            assert 'prenom' in r

    def test_exclut_employe_lui_meme(self, db_session, seed_remplacants):
        employe = seed_remplacants['employe']
        result = rempl_utils.trouver_remplacants_automatiques(employe, db_session)
        matricules = [r['matricule'] for r in result]
        assert employe.matricule not in matricules

    def test_limite_respectee(self, db_session, seed_remplacants):
        employe = seed_remplacants['employe']
        result = rempl_utils.trouver_remplacants_automatiques(employe, db_session, limite=1)
        assert len(result) <= 1


class TestEnregistrerRemplacants:
    def test_retourne_tuple(self, db_session, seed_remplacants):
        op = seed_remplacants['operation']
        remplacants = [
            {'matricule': seed_remplacants['c1'].matricule, 'nom': 'C', 'prenom': 'T', 'fonction': 'X'},
        ]
        result = rempl_utils.enregistrer_remplacants_proposes(op.id_operation, remplacants, db_session)
        assert isinstance(result, tuple)
        assert len(result) == 2
        success, message = result
        assert success is True
        assert isinstance(message, str)

    def test_sans_ordre_proposition(self, db_session, seed_remplacants):
        """Fonctionne sans la clé ordre_proposition dans les dicts"""
        op = seed_remplacants['operation']
        remplacants = [
            {'matricule': seed_remplacants['c2'].matricule, 'nom': 'C2', 'prenom': 'T'},
        ]
        success, _ = rempl_utils.enregistrer_remplacants_proposes(op.id_operation, remplacants, db_session)
        assert success is True

    def test_enregistre_en_base(self, db_session, seed_remplacants):
        op = seed_remplacants['operation']
        remplacants = [
            {'matricule': seed_remplacants['c1'].matricule, 'nom': 'C', 'prenom': 'T'},
        ]
        rempl_utils.enregistrer_remplacants_proposes(op.id_operation, remplacants, db_session)
        db_session.expire_all()
        props = db_session.query(models.RemplacantPropose).filter(
            models.RemplacantPropose.id_operation == op.id_operation
        ).all()
        assert len(props) >= 1


class TestAccepterRemplacant:
    def test_retourne_tuple_success(self, db_session, seed_remplacants):
        op = seed_remplacants['operation']
        remplacants = [{'matricule': seed_remplacants['c1'].matricule, 'nom': 'C', 'prenom': 'T'}]
        rempl_utils.enregistrer_remplacants_proposes(op.id_operation, remplacants, db_session)
        db_session.expire_all()

        result = rempl_utils.accepter_remplacant(op.id_operation, seed_remplacants['c1'].matricule, db_session)
        assert isinstance(result, tuple)
        success, message = result
        assert success is True
        assert isinstance(message, str)

    def test_retourne_tuple_failure_introuvable(self, db_session, seed_remplacants):
        op = seed_remplacants['operation']
        result = rempl_utils.accepter_remplacant(op.id_operation, 99999, db_session)
        assert isinstance(result, tuple)
        success, message = result
        assert success is False
        assert isinstance(message, str)


class TestVerifierDisponibilite:
    def test_disponible_avec_objets_date(self, db_session, seed_remplacants):
        """Accepte des objets date (pas seulement des chaînes)"""
        c1 = seed_remplacants['c1']
        today = date.today()
        result = rempl_utils.verifier_disponibilite_remplacant(
            c1.matricule, today + timedelta(days=30), today + timedelta(days=35), db_session
        )
        assert isinstance(result, tuple)
        assert len(result) == 2
        disponible, raison = result
        assert isinstance(disponible, bool)

    def test_disponible_avec_chaines_date(self, db_session, seed_remplacants):
        """Accepte des chaînes de date en format %Y-%m-%d"""
        c1 = seed_remplacants['c1']
        result = rempl_utils.verifier_disponibilite_remplacant(
            c1.matricule, '2026-08-01', '2026-08-05', db_session
        )
        disponible, raison = result
        assert disponible is True
        assert raison is None

    def test_employe_inexistant(self, db_session, seed_remplacants):
        result = rempl_utils.verifier_disponibilite_remplacant(99999, '2026-08-01', '2026-08-05', db_session)
        disponible, raison = result
        assert disponible is False
        assert raison is not None

    def test_employe_absent(self, db_session, seed_remplacants):
        c1 = seed_remplacants['c1']
        c1.absent = True
        db_session.commit()
        result = rempl_utils.verifier_disponibilite_remplacant(c1.matricule, '2026-08-01', '2026-08-05', db_session)
        disponible, _ = result
        assert disponible is False


class TestRemplacantsAPI:
    def test_propositions_vide(self, client, seed_remplacants):
        op = seed_remplacants['operation']
        resp = client.get(f'/api/remplacants/propositions/{op.id_operation}')
        assert resp.status_code == 200
        assert resp.json() == []

    def test_generer_remplacants(self, client, seed_remplacants):
        op = seed_remplacants['operation']
        resp = client.post(f'/api/remplacants/generer/{op.id_operation}')
        assert resp.status_code == 200
        data = resp.json()
        assert 'remplacants' in data

    def test_propositions_apres_generation(self, client, seed_remplacants):
        op = seed_remplacants['operation']
        client.post(f'/api/remplacants/generer/{op.id_operation}')
        resp = client.get(f'/api/remplacants/propositions/{op.id_operation}')
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_mes_remplacements(self, client, seed_remplacants):
        c1 = seed_remplacants['c1']
        resp = client.get(f'/api/remplacants/mes-remplacements/{c1.matricule}')
        assert resp.status_code == 200
        assert resp.json() == []

    def test_disponibilite(self, client, seed_remplacants):
        c1 = seed_remplacants['c1']
        resp = client.get(
            f'/api/remplacants/disponibilite/{c1.matricule}',
            params={'date_debut': '2026-09-01', 'date_fin': '2026-09-05'}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 'disponible' in data

    def test_operations_disponibles_sans_auth(self, client, seed_remplacants):
        resp = client.get('/api/remplacants/operations-disponibles')
        assert resp.status_code == 401

    def test_operations_disponibles_avec_auth(self, client, seed_remplacants, auth_headers):
        rh = seed_remplacants['rh']
        resp = client.get(
            '/api/remplacants/operations-disponibles',
            headers=auth_headers(rh.matricule, 'RH')
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_accepter_remplacant_apres_generation(self, client, seed_remplacants):
        op = seed_remplacants['operation']
        c1 = seed_remplacants['c1']

        # Générer d'abord
        gen_resp = client.post(f'/api/remplacants/generer/{op.id_operation}')
        assert gen_resp.status_code == 200

        # Obtenir les propositions
        props = client.get(f'/api/remplacants/propositions/{op.id_operation}').json()
        if not props:
            pytest.skip('Aucun remplaçant proposé dans ce contexte')

        matricule_prop = props[0]['matricule']
        accept_resp = client.post(f'/api/remplacants/{op.id_operation}/accepter/{matricule_prop}')
        assert accept_resp.status_code == 200


class TestNouveauxComportements:
    def test_n1_pairs_inclus_quand_n1_defini(self, db_session, seed_remplacants):
        """Les subordonnés directs (dont n1 == matricule de l'employé) sont proposés avec raison 'Subordonné direct'."""
        employe = seed_remplacants['employe']
        c1 = seed_remplacants['c1']
        # c1 est un subordonné direct de l'employé
        c1.n1 = employe.matricule
        db_session.commit()

        result = rempl_utils.trouver_remplacants_automatiques(employe, db_session, limite=10)
        raisons = [r.get('raison', '') for r in result]
        assert any('Subordonné direct' in r for r in raisons), "Aucun subordonné direct trouvé"

    def test_pas_de_doublon_double_generation(self, db_session, seed_remplacants):
        """Appeler enregistrer deux fois ne crée pas de doublons."""
        op = seed_remplacants['operation']
        employe = seed_remplacants['employe']
        remplacants = rempl_utils.trouver_remplacants_automatiques(employe, db_session, limite=5)
        # Première génération
        rempl_utils.enregistrer_remplacants_proposes(op.id_operation, remplacants, db_session)
        # Deuxième génération (doit écraser la première)
        rempl_utils.enregistrer_remplacants_proposes(op.id_operation, remplacants, db_session)
        db_session.expire_all()

        count = db_session.query(models.RemplacantPropose).filter(
            models.RemplacantPropose.id_operation == op.id_operation
        ).count()
        assert count <= len(remplacants), f"Doublon détecté : {count} lignes pour {len(remplacants)} remplaçants"

    def test_operations_disponibles_statut_en_attente(self, client, seed_remplacants, auth_headers):
        """operations-disponibles inclut les opérations 'en attente'."""
        rh = seed_remplacants['rh']
        op = seed_remplacants['operation']
        # La fixture seed_reference_data crée l'opération avec statut 'en attente'

        resp = client.get(
            '/api/remplacants/operations-disponibles',
            headers=auth_headers(rh.matricule, 'RH')
        )
        assert resp.status_code == 200
        data = resp.json()
        ids = [o['id_operation'] for o in data]
        assert op.id_operation in ids, f"L'opération 'en attente' {op.id_operation} absente de la liste"

    def test_operations_refusees_exclues(self, client, db_session, seed_remplacants, auth_headers):
        """operations-disponibles exclut les opérations avec statut 'refusé'."""
        rh = seed_remplacants['rh']
        op = seed_remplacants['operation']
        op.statut = 'refusé'
        db_session.commit()

        resp = client.get(
            '/api/remplacants/operations-disponibles',
            headers=auth_headers(rh.matricule, 'RH')
        )
        assert resp.status_code == 200
        ids = [o['id_operation'] for o in resp.json()]
        assert op.id_operation not in ids, f"L'opération refusée {op.id_operation} est dans la liste"

    def test_operations_valide_incluses(self, client, db_session, seed_remplacants, auth_headers):
        """operations-disponibles inclut les opérations avec statut 'validé' ou 'validée'."""
        rh = seed_remplacants['rh']
        op = seed_remplacants['operation']
        op.statut = 'validé'
        db_session.commit()

        resp = client.get(
            '/api/remplacants/operations-disponibles',
            headers=auth_headers(rh.matricule, 'RH')
        )
        assert resp.status_code == 200
        ids = [o['id_operation'] for o in resp.json()]
        assert op.id_operation in ids, f"L'opération validée {op.id_operation} absente de la liste"
