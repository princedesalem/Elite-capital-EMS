"""Tests pour notifications d'un nouveau post Espace Équipe."""
from app import models


def _create_post(client, payload):
    res = client.post('/api/team-space/posts', json=payload)
    assert res.status_code == 200, res.text
    return res.json()


def test_create_shoutout_notifies_all_active_employees(client, db_session, seed_reference_data):
    author = seed_reference_data['rh']
    payload = {
        'type': 'shoutout',
        'from': f'{author.prenom} {author.nom}',
        'from_matricule': author.matricule,
        'destinataire': 'Equipe Operations',
        'message': 'Bravo à toute l’équipe pour le lancement !',
        'audience': {'type': 'all', 'selected': []},
    }
    _create_post(client, payload)

    notes = db_session.query(models.Notification).all()
    # 6 seeded active employees minus the author → 5 recipients
    matricules = {n.matricule for n in notes}
    assert author.matricule not in matricules
    assert len(matricules) == 5
    assert all(n.type_notification == models.TypeNotificationEnum.AUTRE for n in notes)
    titles = {n.titre for n in notes}
    assert any('shout-out' in t.lower() for t in titles)


def test_create_kudos_notifies_destinataire_even_if_restricted_audience(client, db_session, seed_reference_data):
    author = seed_reference_data['responsable']
    target = seed_reference_data['employe']  # prénom="One", nom="Emp"
    payload = {
        'type': 'kudos',
        'from': f'{author.prenom} {author.nom}',
        'from_matricule': author.matricule,
        'destinataire': f'{target.prenom} {target.nom}',
        'valeur': 'Excellence',
        'raison': 'Livraison impeccable',
        # Restrict to a direction nobody belongs to → only destinataire should remain
        'audience': {'type': 'directions', 'selected': ['Inexistante']},
    }
    _create_post(client, payload)

    notes = db_session.query(models.Notification).all()
    matricules = {n.matricule for n in notes}
    assert target.matricule in matricules
    assert author.matricule not in matricules
    # No one else should receive it
    assert matricules == {target.matricule}
    assert notes[0].message.startswith('Excellence')


def test_create_poll_notifies_direction_audience(client, db_session, seed_reference_data):
    author = seed_reference_data['rh']
    direction_nom = seed_reference_data['direction'].nom
    payload = {
        'type': 'poll',
        'from': f'{author.prenom} {author.nom}',
        'from_matricule': author.matricule,
        'question': 'Préférez-vous le télétravail le vendredi ?',
        'options': [{'texte': 'Oui', 'votes': 0}, {'texte': 'Non', 'votes': 0}],
        'audience': {'type': 'directions', 'selected': [direction_nom]},
    }
    _create_post(client, payload)

    notes = db_session.query(models.Notification).all()
    matricules = {n.matricule for n in notes}
    # All 6 seeded employees share the same direction; author excluded → 5
    assert author.matricule not in matricules
    assert len(matricules) == 5
    assert notes[0].titre.startswith('Nouveau sondage')
    assert 'télétravail' in notes[0].message


def test_like_and_vote_do_not_create_notifications(client, db_session, seed_reference_data):
    author = seed_reference_data['rh']
    payload = {
        'type': 'poll',
        'from': f'{author.prenom} {author.nom}',
        'from_matricule': author.matricule,
        'question': 'Test ?',
        'options': [{'texte': 'A', 'votes': 0}, {'texte': 'B', 'votes': 0}],
        'audience': {'type': 'all', 'selected': []},
    }
    post = _create_post(client, payload)
    count_after_create = db_session.query(models.Notification).count()

    res_like = client.post(f"/api/team-space/posts/{post['id']}/like", json={'matricule': str(author.matricule)})
    assert res_like.status_code == 200
    res_vote = client.patch(
        f"/api/team-space/posts/{post['id']}/vote",
        json={'voter_matricule': str(seed_reference_data['employe'].matricule), 'option_index': 0},
    )
    assert res_vote.status_code == 200

    assert db_session.query(models.Notification).count() == count_after_create
