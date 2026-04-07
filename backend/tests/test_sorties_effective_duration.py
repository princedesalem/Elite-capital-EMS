"""
Tests for sortie effective duration (lunch deduction 12:00-14:00)
and the 4-hour maximum enforcement on both POST and GET.
"""
from app.routers.sorties_router import _effective_duration_hours


# ─── Unit tests for the helper ────────────────────────────────────────────────

def test_effective_duration_no_lunch_overlap():
    """Morning sortie with no lunch overlap: brute == effective."""
    assert _effective_duration_hours('08:00', '11:00') == 3.0


def test_effective_duration_full_lunch_overlap():
    """Sortie spanning the full lunch window → 1h deducted."""
    # 09:00-15:00 = 6h brute, overlap=[12:00-14:00] → deduction=1 → 5.0h
    assert _effective_duration_hours('09:00', '15:00') == 5.0


def test_effective_duration_starts_inside_lunch():
    """Start at 13:00 (inside lunch window) → 1h deducted."""
    # 13:00-18:00 = 5h brute, overlap=[13:00-14:00]=60min > 0 → deduction=1 → 4.0h
    assert _effective_duration_hours('13:00', '18:00') == 4.0


def test_effective_duration_ends_at_lunch_boundary():
    """Sortie ending exactly at 14:00 also touches the window → 1h deducted."""
    # 09:00-14:00 = 5h brute, overlap=[12:00-14:00] → deduction=1 → 4.0h
    assert _effective_duration_hours('09:00', '14:00') == 4.0


def test_effective_duration_afternoon_no_overlap():
    """Afternoon sortie that starts at 14:00 → no overlap → no deduction."""
    # 14:00-19:00 = 5h brute, overlap=max(14*60,12*60)=840, min(19*60,14*60)=840 → overlap=0
    assert _effective_duration_hours('14:00', '19:00') == 5.0


def test_effective_duration_exact_lunch_window():
    """Sortie exactly 12:00-14:00 → 2h brute, deduction=1 → 1.0h effective."""
    assert _effective_duration_hours('12:00', '14:00') == 1.0


def test_effective_duration_short_overlap():
    """Sortie ending at 12:30 → 30-min overlap, but deduction is still 1h flat."""
    # 10:00-12:30 = 2.5h brute, overlap=[12:00-12:30]=30min > 0 → deduction=1 → 1.5h
    assert _effective_duration_hours('10:00', '12:30') == 1.5


# ─── Integration tests via API ────────────────────────────────────────────────

def test_post_sortie_returns_effective_duration(client, seed_reference_data):
    """POST returns duree_heures computed with the effective (deduction) formula."""
    matricule = seed_reference_data['employe'].matricule
    response = client.post(
        '/api/sorties/',
        json={
            'matricule': matricule,
            'date_sortie': '2026-05-10',
            'heure_sortie': '13:00',
            'heure_retour': '18:00',
            'commentaire': 'Test effective',
        },
    )
    assert response.status_code == 200
    data = response.json()
    # 13:00-18:00 = 5h brute − 1h lunch = 4.0h effective
    assert data['duree_heures'] == 4.0


def test_post_sortie_rejects_above_four_effective_hours(client, seed_reference_data):
    """POST must reject a sortie whose effective duration exceeds 4h."""
    matricule = seed_reference_data['employe'].matricule
    # 08:00-14:00 = 6h brute − 1h lunch = 5.0h effective → must be rejected
    response = client.post(
        '/api/sorties/',
        json={
            'matricule': matricule,
            'date_sortie': '2026-05-10',
            'heure_sortie': '08:00',
            'heure_retour': '14:00',
            'commentaire': 'Trop longue',
        },
    )
    assert response.status_code == 422
    assert '4' in response.json()['detail']


def test_get_sorties_returns_effective_duration(client, seed_reference_data):
    """GET /api/sorties returns duree_heures with deduction applied."""
    matricule = seed_reference_data['employe'].matricule

    # Create a sortie spanning the lunch window
    create_response = client.post(
        '/api/sorties/',
        json={
            'matricule': matricule,
            'date_sortie': '2026-05-12',
            'heure_sortie': '09:00',
            'heure_retour': '13:30',
            'commentaire': 'Matin + debut dejeuner',
        },
    )
    assert create_response.status_code == 200

    # GET the sortie list
    get_response = client.get(f'/api/sorties/?matricule={matricule}')
    assert get_response.status_code == 200

    sorties = get_response.json()
    # Find the sortie just created
    target = next(
        (s for s in sorties if s.get('heure_sortie') == '09:00' or s.get('duree_heures') is not None),
        None,
    )
    assert target is not None
    # 09:00-13:30 = 4.5h brute, overlap=[12:00-13:30]=90min > 0 → deduction=1 → 3.5h effective
    assert target['duree_heures'] == 3.5
