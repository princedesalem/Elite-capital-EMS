"""Phase F — A1/A2 : format des notifications.

Vérifie que les chaînes proscrites n'apparaissent plus comme **titre ou message**
de notification (chaînes utilisateur), tout en tolérant leur présence dans des
commentaires/docstrings ou identifiants techniques.

Heuristique : on cherche un littéral string contenant le motif accompagné d'un
préfixe typique de notif : `titre=`, `message=`, `'titre':`, `'message':`,
`f"...` produisant le texte.
"""
import re
from pathlib import Path


BACKEND_APP = Path(__file__).resolve().parents[1] / 'app'

# Motifs techniques tolérés (commentaires, identifiants de code).
USER_TEXT_HINTS = ('titre', 'message', 'detail', 'subject', 'body')


def _scan_user_text(needle: str):
    pattern = re.compile(
        r'(titre|message|detail|subject|body)\s*[=:]\s*[fr]?["\'][^"\']*'
        + re.escape(needle),
        re.IGNORECASE,
    )
    hits = []
    for p in BACKEND_APP.rglob('*.py'):
        try:
            text = p.read_text(encoding='utf-8')
        except Exception:
            continue
        if pattern.search(text):
            hits.append(str(p))
    return hits


def test_no_multi_destinations_in_notification_user_text():
    hits = _scan_user_text('multi-destinations')
    assert hits == [], f"'multi-destinations' subsiste dans titres/messages : {hits}"


def test_no_en_tant_que_in_notification_user_text():
    hits = _scan_user_text('en tant que ')
    assert hits == [], f"'en tant que' subsiste dans titres/messages : {hits}"


def test_nouvelle_mission_present_dans_router():
    missions = (BACKEND_APP / 'routers' / 'missions_router.py').read_text(encoding='utf-8')
    assert 'Nouvelle mission' in missions
