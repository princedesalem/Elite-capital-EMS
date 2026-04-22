"""
Tests de persistance des entités organisationnelles créées par l'admin.

Vérifie que les départements, entités et directions ajoutés par un administrateur
sont bien enregistrés en base et restituables par les endpoints GET correspondants.
"""
import pytest
from app import models
from app.utils.security import create_access_token


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _admin_headers():
    token = create_access_token({'sub': '9001', 'matricule': '9001', 'role': 'ADMIN'})
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture()
def geo_setup(seed_reference_data, db_session):
    """Réutilise les données de référence seedées et ajoute l'implantation ELCAM↔Douala."""
    entite = seed_reference_data['entite']
    ville = seed_reference_data['localisation']

    # S'assurer qu'une implantation existe entre l'entité et la ville
    impl = db_session.query(models.Implantation).filter(
        models.Implantation.id_entite == entite.id_entite,
        models.Implantation.id_localisation == ville.id_localisation,
    ).first()
    if not impl:
        db_session.add(models.Implantation(id_entite=entite.id_entite, id_localisation=ville.id_localisation))
        db_session.commit()

    return {
        'pays': seed_reference_data['pays'],
        'ville': ville,
        'entite': entite,
    }


# ──────────────────────────────────────────────────────────────
# ENTITÉS
# ──────────────────────────────────────────────────────────────

class TestEntitePersistence:

    def test_create_entite_returns_201_and_fields(self, client, seed_reference_data, db_session, geo_setup):
        """POST /employees/entites doit créer et renvoyer la nouvelle entité."""
        resp = client.post('/employees/entites',
                           json={'nom': 'Entité Test A', 'id_localisation': geo_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert body['nom'] == 'Entité Test A'
        assert 'id_entite' in body
        assert isinstance(body['id_entite'], int)

    def test_create_entite_is_persisted_in_db(self, client, seed_reference_data, db_session, geo_setup):
        """L'entité créée doit exister en base après le commit."""
        client.post('/employees/entites',
                    json={'nom': 'Entité Persistante'},
                    headers=_admin_headers())

        db_session.expire_all()
        row = db_session.query(models.Entite).filter(models.Entite.nom == 'Entité Persistante').first()
        assert row is not None, "L'entité n'a pas été persistée en base."
        assert row.id_entite is not None

    def test_create_entite_visible_via_get(self, client, seed_reference_data, db_session, geo_setup):
        """L'entité créée doit apparaître dans GET /employees/entites."""
        client.post('/employees/entites',
                    json={'nom': 'Entité Visible GET'},
                    headers=_admin_headers())

        resp = client.get('/employees/entites', headers=_admin_headers())
        assert resp.status_code == 200
        noms = [e['nom'] for e in resp.json()]
        assert 'Entité Visible GET' in noms

    def test_create_entite_duplicate_rejected(self, client, seed_reference_data, db_session, geo_setup):
        """Deux entités portant le même nom doivent être refusées (400)."""
        client.post('/employees/entites', json={'nom': 'Entité Duplicate X'}, headers=_admin_headers())
        resp2 = client.post('/employees/entites', json={'nom': 'Entité Duplicate X'}, headers=_admin_headers())
        assert resp2.status_code == 400

    def test_create_entite_with_localisation_creates_implantation(self, client, seed_reference_data, db_session, geo_setup):
        """Quand id_localisation est fourni, une Implantation doit être créée."""
        resp = client.post('/employees/entites',
                           json={'nom': 'Entité Avec Ville', 'id_localisation': geo_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200
        id_entite = resp.json()['id_entite']

        db_session.expire_all()
        impl = db_session.query(models.Implantation).filter(
            models.Implantation.id_entite == id_entite,
            models.Implantation.id_localisation == geo_setup['ville'].id_localisation,
        ).first()
        assert impl is not None, "L'implantation n'a pas été créée."

    def test_create_entite_name_required(self, client, seed_reference_data):
        """POST sans `nom` doit retourner 400."""
        resp = client.post('/employees/entites', json={}, headers=_admin_headers())
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────
# DIRECTIONS
# ──────────────────────────────────────────────────────────────

class TestDirectionPersistence:

    def test_create_direction_returns_200(self, client, seed_reference_data, db_session, geo_setup):
        """POST /employees/directions doit renvoyer la direction créée."""
        resp = client.post('/employees/directions',
                           json={'nom': 'Direction Test', 'id_entite': geo_setup['entite'].id_entite,
                                 'id_localisation': geo_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert body['nom'] == 'Direction Test'
        assert 'id_direction' in body

    def test_create_direction_is_persisted_in_db(self, client, seed_reference_data, db_session, geo_setup):
        """La direction créée doit exister en base."""
        client.post('/employees/directions',
                    json={'nom': 'Dir Persistante', 'id_entite': geo_setup['entite'].id_entite,
                          'id_localisation': geo_setup['ville'].id_localisation},
                    headers=_admin_headers())

        db_session.expire_all()
        row = db_session.query(models.Direction).filter(models.Direction.nom == 'Dir Persistante').first()
        assert row is not None, "La direction n'a pas été persistée."
        assert row.id_entite == geo_setup['entite'].id_entite

    def test_create_direction_visible_via_get(self, client, seed_reference_data, db_session, geo_setup):
        """La direction créée doit apparaître dans GET /employees/directions."""
        client.post('/employees/directions',
                    json={'nom': 'Dir Visible', 'id_entite': geo_setup['entite'].id_entite,
                          'id_localisation': geo_setup['ville'].id_localisation},
                    headers=_admin_headers())

        resp = client.get('/employees/directions', headers=_admin_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Dir Visible' in noms

    def test_create_direction_auto_resolves_localisation(self, client, seed_reference_data, db_session, geo_setup):
        """Sans id_localisation, la direction doit être créée via l'implantation de l'entité."""
        resp = client.post('/employees/directions',
                           json={'nom': 'Dir Auto Loc', 'id_entite': geo_setup['entite'].id_entite},
                           headers=_admin_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert body['id_localisation'] == geo_setup['ville'].id_localisation

    def test_create_direction_invalid_entite_rejected(self, client, seed_reference_data):
        """Une direction avec id_entite inexistant doit retourner 400."""
        resp = client.post('/employees/directions',
                           json={'nom': 'Dir Invalide', 'id_entite': 999999},
                           headers=_admin_headers())
        assert resp.status_code == 400

    def test_create_direction_linked_to_entite_in_get(self, client, seed_reference_data, db_session, geo_setup):
        """La direction doit apparaître dans la liste de directions de l'entité mère."""
        resp = client.post('/employees/directions',
                           json={'nom': 'Dir Liée Entite', 'id_entite': geo_setup['entite'].id_entite,
                                 'id_localisation': geo_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200
        id_dir = resp.json()['id_direction']

        resp2 = client.get(f'/employees/entites', headers=_admin_headers())
        entite_data = next((e for e in resp2.json() if e['id_entite'] == geo_setup['entite'].id_entite), None)
        assert entite_data is not None
        assert any(d['id_direction'] == id_dir for d in entite_data['directions'])


# ──────────────────────────────────────────────────────────────
# DÉPARTEMENTS
# ──────────────────────────────────────────────────────────────

class TestDepartementPersistence:

    @pytest.fixture()
    def direction_setup(self, db_session, geo_setup):
        """Direction déjà créée pour les tests de département."""
        direction = models.Direction(
            nom='Dir Parent',
            id_entite=geo_setup['entite'].id_entite,
            id_localisation=geo_setup['ville'].id_localisation,
        )
        db_session.add(direction)
        db_session.commit()
        return {**geo_setup, 'direction': direction}

    def test_create_departement_returns_200(self, client, seed_reference_data, db_session, direction_setup):
        """POST /employees/departements doit renvoyer le département créé."""
        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Test', 'id_entite': direction_setup['entite'].id_entite,
                                 'id_direction': direction_setup['direction'].id_direction,
                                 'id_localisation': direction_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert body['nom'] == 'Dept Test'
        assert 'dept_id' in body

    def test_create_departement_is_persisted_in_db(self, client, seed_reference_data, db_session, direction_setup):
        """Le département créé doit exister en base."""
        client.post('/employees/departements',
                    json={'nom': 'Dept Persistant', 'id_entite': direction_setup['entite'].id_entite,
                          'id_direction': direction_setup['direction'].id_direction,
                          'id_localisation': direction_setup['ville'].id_localisation},
                    headers=_admin_headers())

        db_session.expire_all()
        row = db_session.query(models.Departement).filter(models.Departement.nom == 'Dept Persistant').first()
        assert row is not None, "Le département n'a pas été persisté."
        assert row.id_entite == direction_setup['entite'].id_entite
        assert row.id_direction == direction_setup['direction'].id_direction

    def test_create_departement_visible_via_get(self, client, seed_reference_data, db_session, direction_setup):
        """Le département créé doit apparaître dans GET /employees/departements."""
        client.post('/employees/departements',
                    json={'nom': 'Dept Visible', 'id_entite': direction_setup['entite'].id_entite,
                          'id_direction': direction_setup['direction'].id_direction,
                          'id_localisation': direction_setup['ville'].id_localisation},
                    headers=_admin_headers())

        resp = client.get('/employees/departements', headers=_admin_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Dept Visible' in noms

    def test_create_departement_implantation_liaison_created(self, client, seed_reference_data, db_session, direction_setup):
        """Une ligne DepartementImplantation doit être créée pour lier le dept à la ville."""
        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Liaison', 'id_entite': direction_setup['entite'].id_entite,
                                 'id_localisation': direction_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200
        dept_id = resp.json()['dept_id']

        db_session.expire_all()
        liaison = db_session.query(models.DepartementImplantation).filter(
            models.DepartementImplantation.dept_id == dept_id,
            models.DepartementImplantation.id_localisation == direction_setup['ville'].id_localisation,
        ).first()
        assert liaison is not None, "La liaison DepartementImplantation n'a pas été créée."

    def test_create_departement_visible_by_ville_filter(self, client, seed_reference_data, db_session, direction_setup):
        """GET /employees/departements?id_localisation=<id> doit retourner le département."""
        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Ville Filtre', 'id_entite': direction_setup['entite'].id_entite,
                                 'id_localisation': direction_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 200

        resp2 = client.get(f'/employees/departements?id_localisation={direction_setup["ville"].id_localisation}',
                           headers=_admin_headers())
        assert resp2.status_code == 200
        noms = [d['nom'] for d in resp2.json()]
        assert 'Dept Ville Filtre' in noms

    def test_create_departement_invalid_entite_rejected(self, client, seed_reference_data):
        """Un département avec id_entite inexistant doit retourner 400."""
        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Invalide', 'id_entite': 999999},
                           headers=_admin_headers())
        assert resp.status_code == 400

    def test_create_departement_invalid_direction_rejected(self, client, seed_reference_data, geo_setup):
        """Un département avec id_direction inexistant doit retourner 400."""
        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Dir Invalide', 'id_entite': geo_setup['entite'].id_entite,
                                 'id_direction': 999999,
                                 'id_localisation': geo_setup['ville'].id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 400

    def test_create_departement_without_entite_implantation_rejected(self, client, seed_reference_data, db_session, geo_setup):
        """Créer un département dans une ville où l'entité n'est pas implantée doit retourner 400."""
        # Ville sans implantation pour cette entité
        ville2 = models.Localisation(ville='Douala', id_pays=geo_setup['pays'].id_pays)
        db_session.add(ville2)
        db_session.commit()

        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Hors Implantation', 'id_entite': geo_setup['entite'].id_entite,
                                 'id_localisation': ville2.id_localisation},
                           headers=_admin_headers())
        assert resp.status_code == 400

    def test_create_departement_multi_villes(self, client, seed_reference_data, db_session, geo_setup):
        """Un département peut être lié à plusieurs villes via villes_ids."""
        # Deuxième ville avec implantation
        ville2 = models.Localisation(ville='Douala', id_pays=geo_setup['pays'].id_pays)
        db_session.add(ville2)
        db_session.flush()
        db_session.add(models.Implantation(id_entite=geo_setup['entite'].id_entite, id_localisation=ville2.id_localisation))
        db_session.commit()

        resp = client.post('/employees/departements',
                           json={'nom': 'Dept Multi Villes', 'id_entite': geo_setup['entite'].id_entite,
                                 'villes_ids': [geo_setup['ville'].id_localisation, ville2.id_localisation]},
                           headers=_admin_headers())
        assert resp.status_code == 200
        dept_id = resp.json()['dept_id']

        db_session.expire_all()
        liaisons = db_session.query(models.DepartementImplantation).filter(
            models.DepartementImplantation.dept_id == dept_id,
        ).all()
        assert len(liaisons) == 2, f"Attendu 2 liaisons, obtenu {len(liaisons)}"
        loc_ids = {li.id_localisation for li in liaisons}
        assert geo_setup['ville'].id_localisation in loc_ids
        assert ville2.id_localisation in loc_ids

    def test_create_departement_name_required(self, client, seed_reference_data, geo_setup):
        """POST sans `nom` doit retourner 400."""
        resp = client.post('/employees/departements',
                           json={'id_entite': geo_setup['entite'].id_entite},
                           headers=_admin_headers())
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────
# CROSS-ENTITY — structure complète entité → direction → département
# ──────────────────────────────────────────────────────────────

class TestOrganisationFullHierarchy:

    def test_full_hierarchy_creation_and_retrieval(self, client, seed_reference_data, db_session, geo_setup):
        """
        Crée entité → direction → département via l'API et vérifie que la structure
        complète est restituable : le département apparaît imbriqué dans la direction,
        elle-même dans l'entité, filtrée par ville.
        """
        entite_id = geo_setup['entite'].id_entite
        ville_id = geo_setup['ville'].id_localisation

        # 1. Créer la direction
        r_dir = client.post('/employees/directions',
                            json={'nom': 'Dir Hiérarchie', 'id_entite': entite_id,
                                  'id_localisation': ville_id},
                            headers=_admin_headers())
        assert r_dir.status_code == 200
        dir_id = r_dir.json()['id_direction']

        # 2. Créer le département
        r_dept = client.post('/employees/departements',
                             json={'nom': 'Dept Hiérarchie', 'id_entite': entite_id,
                                   'id_direction': dir_id, 'id_localisation': ville_id},
                             headers=_admin_headers())
        assert r_dept.status_code == 200
        dept_id = r_dept.json()['dept_id']

        # 3. Vérifier la structure via GET ville/entites-structure
        r_struct = client.get(f'/employees/villes/{ville_id}/entites-structure', headers=_admin_headers())
        assert r_struct.status_code == 200
        struct = r_struct.json()
        entite_data = next((e for e in struct if e['id_entite'] == entite_id), None)
        assert entite_data is not None
        dir_data = next((d for d in entite_data['directions'] if d['id_direction'] == dir_id), None)
        assert dir_data is not None, "La direction n'apparaît pas dans la structure de la ville."
        assert dir_data['departements_count'] >= 1

        # 4. Vérifier que le département est bien lié à la ville
        r_depts = client.get(f'/employees/villes/{ville_id}/departements', headers=_admin_headers())
        assert r_depts.status_code == 200
        dept_ids_in_ville = [d['dept_id'] for d in r_depts.json()]
        assert dept_id in dept_ids_in_ville, "Le département n'est pas accessible via la vue ville."

        # 5. Vérifier en base directement
        db_session.expire_all()
        db_dept = db_session.query(models.Departement).filter(models.Departement.dept_id == dept_id).first()
        assert db_dept is not None
        assert db_dept.id_direction == dir_id
        assert db_dept.id_entite == entite_id
