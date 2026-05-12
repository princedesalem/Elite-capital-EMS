"""Tests pour le routeur Elite Academy : auto-gen QCM, shuffle deterministe
par employe, scoring quiz robuste au melange, certificat PDF."""
import pytest
from app import models


def _make_formation(db_session, titre='Formation Test', categorie='Test'):
    f = models.Formation(
        titre=titre,
        description='Desc de test',
        categorie=categorie,
        niveau=models.NiveauFormationEnum.DEBUTANT,
        est_publie=True,
        cree_par='9999',
    )
    db_session.add(f)
    db_session.commit()
    db_session.refresh(f)
    return f


def _inscrire(client, formation_id, employe_id='1001'):
    r = client.post(f'/api/academy/inscriptions/{formation_id}?employe_id={employe_id}')
    assert r.status_code == 200, r.text
    return r.json()


# ─── Auto-gen QCM ─────────────────────────────────────────────────────────────

def test_create_formation_auto_generates_quiz(client, db_session, seed_reference_data):
    payload = {
        'titre': 'Formation Achats',
        'description': 'Procedures achats',
        'categorie': 'Achats',
        'niveau': 'Débutant',
        'est_publie': True,
        'cree_par': '9999',
    }
    r = client.post('/api/academy/formations', json=payload)
    assert r.status_code == 200, r.text
    formation_id = r.json()['id']

    # Doit avoir un module Validation + lecon Quiz final + questions
    formation = db_session.query(models.Formation).get(formation_id)
    assert formation is not None
    modules = list(formation.modules)
    assert any(m.titre == 'Validation' for m in modules)
    quiz_lecons = [l for m in modules for l in m.lecons if l.type == models.TypeLeconEnum.QUIZ]
    assert len(quiz_lecons) >= 1
    n_questions = (
        db_session.query(models.QuizQuestion)
        .filter(models.QuizQuestion.lecon_id == quiz_lecons[0].id)
        .count()
    )
    assert n_questions >= 5


# ─── Shuffle deterministe ─────────────────────────────────────────────────────

def test_get_questions_shuffle_is_deterministic_per_employee(client, db_session, seed_reference_data):
    f = _make_formation(db_session)
    quiz = _ensure_quiz(client, db_session, f)

    # Meme employe → meme ordre
    r1 = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=5')
    r2 = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=5')
    assert r1.status_code == 200
    ids1 = [q['id'] for q in r1.json()]
    ids2 = [q['id'] for q in r2.json()]
    assert ids1 == ids2


def test_get_questions_shuffle_differs_between_employees(client, db_session, seed_reference_data):
    f = _make_formation(db_session)
    quiz = _ensure_quiz(client, db_session, f)

    r1 = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=8')
    r2 = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=2001&nb=8')
    j1, j2 = r1.json(), r2.json()
    # Au moins un melange diffe (ordre des questions OU options)
    diff = (
        [q['id'] for q in j1] != [q['id'] for q in j2]
        or any(j1[i]['options'] != j2[i]['options'] for i in range(min(len(j1), len(j2))))
    )
    assert diff


def test_shuffled_bonne_reponse_points_to_correct_option(client, db_session, seed_reference_data):
    """Apres shuffle, l'indice bonne_reponse retourne doit pointer sur le bon
    texte (la bonne reponse originale)."""
    f = _make_formation(db_session)
    quiz = _ensure_quiz(client, db_session, f)

    # Recuperer pool original
    pool = db_session.query(models.QuizQuestion).filter(
        models.QuizQuestion.lecon_id == quiz.id
    ).all()
    correct_texts = {q.id: q.options[q.bonne_reponse] for q in pool}

    r = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=5')
    for q in r.json():
        assert q['options'][q['bonne_reponse']] == correct_texts[q['id']]


# ─── Submit quiz avec reponses_detaillees ─────────────────────────────────────

def test_submit_quiz_all_correct_via_text(client, db_session, seed_reference_data):
    f = _make_formation(db_session)
    quiz = _ensure_quiz(client, db_session, f)
    inscription = _inscrire(client, f.id, '1001')

    q_payload = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=5').json()
    answers = [
        {'question_id': q['id'], 'option_text': q['options'][q['bonne_reponse']]}
        for q in q_payload
    ]
    r = client.post('/api/academy/quiz/submit', json={
        'inscription_id': inscription['id'],
        'lecon_id': quiz.id,
        'reponses_detaillees': answers,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['score'] == 100
    assert body['badge'] is True
    assert body['correct'] == body['total']


def test_submit_quiz_partial(client, db_session, seed_reference_data):
    f = _make_formation(db_session)
    quiz = _ensure_quiz(client, db_session, f)
    inscription = _inscrire(client, f.id, '1001')

    q_payload = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=5').json()
    # Toujours choisir la mauvaise (premiere option != bonne)
    answers = []
    for q in q_payload:
        opts = q['options']
        wrong_idx = (q['bonne_reponse'] + 1) % len(opts)
        answers.append({'question_id': q['id'], 'option_text': opts[wrong_idx]})
    r = client.post('/api/academy/quiz/submit', json={
        'inscription_id': inscription['id'],
        'lecon_id': quiz.id,
        'reponses_detaillees': answers,
    })
    assert r.status_code == 200
    body = r.json()
    assert body['score'] == 0
    assert body['badge'] is False


# ─── Catalogue + inscription ──────────────────────────────────────────────────

def test_catalogue_endpoint_returns_published_formations(client, db_session, seed_reference_data):
    _make_formation(db_session, titre='F1', categorie='Achats')
    _make_formation(db_session, titre='F2', categorie='Commercial')
    r = client.get('/api/academy/catalogue?employe_id=1001')
    assert r.status_code == 200
    titres = [f['titre'] for f in r.json()]
    assert 'F1' in titres and 'F2' in titres


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_quiz(client, db_session, formation):
    """Garantit qu'une lecon quiz existe avec >= 5 questions."""
    from app.routers.academy_router import _ensure_quiz_questions
    quiz = _ensure_quiz_questions(formation, db_session)
    db_session.refresh(quiz)
    return quiz


# ─── Nouveaux scénarios ────────────────────────────────────────────────────────

def test_submit_without_inscription_id_returns_score(client, db_session, seed_reference_data):
    """422 corrigé : inscription_id optionnel, le score est toujours retourné."""
    f = _make_formation(db_session)
    quiz = _ensure_quiz(client, db_session, f)

    q_payload = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=1001&nb=5').json()
    answers = [
        {'question_id': q['id'], 'option_text': q['options'][q['bonne_reponse']]}
        for q in q_payload
    ]
    r = client.post('/api/academy/quiz/submit', json={
        # inscription_id absent
        'lecon_id': quiz.id,
        'reponses_detaillees': answers,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert 'score' in body
    assert body['score'] == 100


def test_submit_all_correct_score_100_badge_true(client, db_session, seed_reference_data):
    """Toutes les bonnes réponses → score 100 %, badge True."""
    f = _make_formation(db_session, titre='Formation 100%', categorie='Audit')
    quiz = _ensure_quiz(client, db_session, f)
    inscription = _inscrire(client, f.id, '3001')

    q_payload = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=3001&nb=5').json()
    answers = [
        {'question_id': q['id'], 'option_text': q['options'][q['bonne_reponse']]}
        for q in q_payload
    ]
    r = client.post('/api/academy/quiz/submit', json={
        'inscription_id': inscription['id'],
        'lecon_id': quiz.id,
        'reponses_detaillees': answers,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['score'] == 100
    assert body['badge'] is True
    assert body['correct'] == body['total']


def test_submit_unknown_question_id_ignored(client, db_session, seed_reference_data):
    """Un question_id inconnu dans reponses_detaillees est ignoré gracieusement."""
    f = _make_formation(db_session, titre='Formation Ignore', categorie='CRM')
    quiz = _ensure_quiz(client, db_session, f)
    inscription = _inscrire(client, f.id, '4001')

    q_payload = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=4001&nb=5').json()
    answers = [
        {'question_id': q['id'], 'option_text': q['options'][q['bonne_reponse']]}
        for q in q_payload
    ]
    # Ajouter un ID inexistant
    answers.append({'question_id': 999999, 'option_text': 'Réponse fantôme'})
    r = client.post('/api/academy/quiz/submit', json={
        'inscription_id': inscription['id'],
        'lecon_id': quiz.id,
        'reponses_detaillees': answers,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    # Score calculé uniquement sur les questions valides
    assert body['total'] == len(q_payload)
    assert body['score'] == 100  # toutes les vraies questions sont correctes


def test_shuffle_different_between_two_employees(client, db_session, seed_reference_data):
    """Anti-triche : deux employés voient un ordre différent (options ou questions)."""
    f = _make_formation(db_session, titre='Formation Shuffle2', categorie='Projets')
    quiz = _ensure_quiz(client, db_session, f)

    r_a = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=5001&nb=8').json()
    r_b = client.get(f'/api/academy/lecons/{quiz.id}/questions?employe_id=6001&nb=8').json()

    diff = (
        [q['id'] for q in r_a] != [q['id'] for q in r_b]
        or any(r_a[i]['options'] != r_b[i]['options'] for i in range(min(len(r_a), len(r_b))))
    )
    assert diff, "Le shuffle doit différer entre deux employés distincts"
