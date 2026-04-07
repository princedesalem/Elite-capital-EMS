"""
Tests pour le router de preuves de permissions conventionnelles.
Vérifie notamment que l'URL renvoyée utilise chemin_fichier (correct)
et non pas nom_fichier (incorrect).
"""
import pytest
from datetime import date
from app import models


@pytest.fixture()
def seed_preuve(db_session, seed_reference_data):
    """Crée une opération, Permission, PermConventionelle et une PreuvePermission de test."""
    refs = seed_reference_data
    op = refs['operation']
    op.type_demande = 'PERMISSION'
    db_session.flush()

    perm = models.Permission(id_permission=op.id_operation)
    db_session.add(perm)
    db_session.flush()

    perm_c = models.PermConventionelle(id_perm_c=op.id_operation)
    db_session.add(perm_c)
    db_session.flush()

    preuve = models.PreuvePermission(
        id_perm_c=op.id_operation,
        chemin_fichier=f'uploads/preuves_permissions/{op.id_operation}_justificatif.pdf',
        nom_fichier='justificatif.pdf',
    )
    db_session.add(preuve)
    db_session.commit()
    db_session.refresh(preuve)

    return {**refs, 'perm': perm, 'perm_c': perm_c, 'preuve': preuve}


class TestPreuvesRouter:
    def test_lister_preuves_retourne_liste(self, client, seed_preuve):
        op = seed_preuve['operation']
        resp = client.get(f'/api/permissions/{op.id_operation}/preuves')
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_url_preuve_utilise_chemin_fichier(self, client, seed_preuve):
        """L'URL renvoyée doit contenir le chemin_fichier (avec l'id_operation comme préfixe).
        Elle ne doit PAS contenir juste nom_fichier sans préfixe.
        """
        op = seed_preuve['operation']
        preuve = seed_preuve['preuve']
        resp = client.get(f'/api/permissions/{op.id_operation}/preuves')
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        url = data[0]['url']
        # L'URL doit contenir le chemin complet (chemin_fichier), pas juste nom_fichier
        assert preuve.nom_fichier in url, 'nom_fichier doit apparaître dans l\'URL'
        assert f'{op.id_operation}_' in url, \
            f"L'URL '{url}' doit contenir le préfixe id_operation_{op.id_operation}_"

    def test_url_ne_utilise_pas_seulement_nom_fichier(self, client, seed_preuve):
        """Régression: avant la correction, l'URL était /uploads/.../nom_fichier sans id_op préfixe.
        Ce test vérifie que ce bug n'est pas revenu.
        """
        op = seed_preuve['operation']
        preuve = seed_preuve['preuve']
        resp = client.get(f'/api/permissions/{op.id_operation}/preuves')
        data = resp.json()
        url = data[0]['url']
        # L'URL incorrecte serait /uploads/preuves_permissions/justificatif.pdf
        bad_url = f'/uploads/preuves_permissions/{preuve.nom_fichier}'
        assert url != bad_url, \
            f"L'URL utilise encore nom_fichier seul ('{url}') au lieu de chemin_fichier"

    def test_lister_preuves_vide(self, client, seed_reference_data):
        """Aucune preuve — retourne une liste vide, pas une 404."""
        op = seed_reference_data['operation']
        # Pas de PermConventionelle créée pour cette opération dans ce test
        resp = client.get(f'/api/permissions/{op.id_operation}/preuves')
        assert resp.status_code == 200
        assert resp.json() == []

    def test_supprimer_preuve_inexistante_404(self, client, seed_preuve):
        op = seed_preuve['operation']
        resp = client.delete(f'/api/permissions/{op.id_operation}/preuves/99999')
        assert resp.status_code == 404

    def test_supprimer_preuve_existante(self, client, db_session, seed_preuve):
        op = seed_preuve['operation']
        preuve = seed_preuve['preuve']
        resp = client.delete(f'/api/permissions/{op.id_operation}/preuves/{preuve.id_preuve}')
        assert resp.status_code == 200
        # Vérifier suppression effective
        reste = client.get(f'/api/permissions/{op.id_operation}/preuves')
        assert reste.json() == []

    def test_nom_fichier_dans_reponse(self, client, seed_preuve):
        """Le champ nom_fichier doit être renvoyé dans la réponse."""
        op = seed_preuve['operation']
        preuve = seed_preuve['preuve']
        resp = client.get(f'/api/permissions/{op.id_operation}/preuves')
        data = resp.json()
        assert data[0]['nom_fichier'] == preuve.nom_fichier

    def test_id_preuve_dans_reponse(self, client, seed_preuve):
        """Chaque entrée doit contenir id_preuve."""
        op = seed_preuve['operation']
        preuve = seed_preuve['preuve']
        resp = client.get(f'/api/permissions/{op.id_operation}/preuves')
        data = resp.json()
        assert data[0]['id_preuve'] == preuve.id_preuve
