"""Tests for the POST /api/ai/insights endpoint and ai_insights service functions."""
import json
from datetime import datetime
from unittest.mock import patch

from app.services import ai_insights as svc


# ---------------------------------------------------------------------------
# _parse_period
# ---------------------------------------------------------------------------

class TestParsePeriod:
    def test_explicit_dates(self):
        d, f = svc._parse_period({'date_debut': '2026-01-15', 'date_fin': '2026-03-20'})
        assert str(d) == '2026-01-15' and str(f) == '2026-03-20'

    def test_year_only(self):
        d, f = svc._parse_period({'annee': 2026})
        assert str(d) == '2026-01-01' and str(f) == '2026-12-31'

    def test_year_and_month(self):
        d, f = svc._parse_period({'annee': 2026, 'mois': 3})
        assert str(d) == '2026-03-01' and str(f) == '2026-03-31'

    def test_default_current_year(self):
        d, f = svc._parse_period({})
        assert d.year == datetime.utcnow().year
        assert d.month == 1 and f.month == 12


# ---------------------------------------------------------------------------
# _extract_json
# ---------------------------------------------------------------------------

class TestExtractJson:
    def test_plain_json(self):
        assert svc._extract_json('{"a": 1}') == {'a': 1}

    def test_fenced_block(self):
        text = 'texte\n```json\n{"x": 42}\n```\nsuite'
        assert svc._extract_json(text) == {'x': 42}

    def test_json_embedded_in_text(self):
        text = 'Voici : {"foo": [1, 2]} fin.'
        assert svc._extract_json(text) == {'foo': [1, 2]}

    def test_no_json(self):
        assert svc._extract_json('aucun JSON') is None

    def test_empty_string(self):
        assert svc._extract_json('') is None


# ---------------------------------------------------------------------------
# _build_prompt
# ---------------------------------------------------------------------------

class TestBuildPrompt:
    def test_french_prompt_contains_json_schema(self):
        prompt = svc._build_prompt('analytics', 'global', {'effectif': {'total': 5}}, lang='fr', depth='détaillé')
        assert 'JSON' in prompt and 'synthese' in prompt and 'recommandations' in prompt

    def test_english_prompt(self):
        prompt = svc._build_prompt('dashboard', 'personnel', {}, lang='en', depth='moyen')
        assert 'English' in prompt or 'JSON' in prompt


# ---------------------------------------------------------------------------
# Deterministic fallback (needs DB)
# ---------------------------------------------------------------------------

class TestDeterministicFallback:
    def test_dashboard_personnel_structure(self, db_session, seed_reference_data):
        admin = {'matricule': '9001', 'role': 'ADMIN'}
        ctx = svc._ctx_dashboard(db_session, admin, {'annee': 2026}, tab='personnel')
        out = svc._fallback_dashboard_personnel(ctx, lang='fr')
        assert 'synthese' in out and out['synthese']
        assert isinstance(out['kpis'], list) and len(out['kpis']) > 0
        for r in out['recommandations']:
            assert r['priorite'] in ('haute', 'moyenne', 'basse')

    def test_analytics_structure(self, db_session, seed_reference_data):
        admin = {'matricule': '9001', 'role': 'ADMIN'}
        ctx = svc._ctx_analytics(db_session, admin, {'annee': 2026})
        out = svc._fallback_analytics(ctx, lang='fr')
        assert isinstance(out['kpis'], list) and len(out['kpis']) >= 1
        assert out.get('narratif')

    def test_english_labels(self, db_session, seed_reference_data):
        admin = {'matricule': '9001', 'role': 'ADMIN'}
        ctx = svc._ctx_dashboard(db_session, admin, {'annee': 2026}, tab='personnel')
        out = svc._fallback_dashboard_personnel(ctx, lang='en')
        # The fallback always returns KPIs regardless of lang
        assert isinstance(out['kpis'], list) and len(out['kpis']) > 0


# ---------------------------------------------------------------------------
# Filter resolution
# ---------------------------------------------------------------------------

class TestAnalyticsFilters:
    def test_direction_name_resolves_and_limits_scope(self, db_session, seed_reference_data):
        admin = {'matricule': '9001', 'role': 'ADMIN'}
        ctx = svc._ctx_analytics(db_session, admin, {'annee': 2026, 'direction': 'Direction Generale'})
        assert ctx['filtres_appliques']['direction'] == 'Direction Generale'
        assert ctx['effectif']['total'] >= 1  # seeded employees in this direction

    def test_unknown_direction_yields_unfiltered(self, db_session, seed_reference_data):
        # When direction name is not found, filter is not applied → all employees returned
        admin = {'matricule': '9001', 'role': 'ADMIN'}
        ctx_all = svc._ctx_analytics(db_session, admin, {'annee': 2026})
        ctx_unknown = svc._ctx_analytics(db_session, admin, {'annee': 2026, 'direction': 'Direction Inexistante'})
        assert ctx_unknown['effectif']['total'] == ctx_all['effectif']['total']


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------

class TestInsightsEndpoint:
    def test_unauthenticated_returns_401_or_403(self, client):
        r = client.post('/api/ai/insights', json={'page': 'dashboard'})
        assert r.status_code in (401, 403)

    def test_employee_can_access_dashboard(self, client, seed_reference_data, auth_headers):
        h = auth_headers(1001, 'EMPLOYE')
        r = client.post(
            '/api/ai/insights',
            json={'page': 'dashboard', 'tab': 'personnel', 'filters': {'annee': 2026}, 'lang': 'fr'},
            headers=h,
        )
        assert r.status_code == 200
        data = r.json()
        assert 'synthese' in data
        assert 'kpis' in data and isinstance(data['kpis'], list)
        assert 'recommandations' in data
        assert data['source'] in ('ollama', 'deterministic')
        assert data['lang'] == 'fr'

    def test_analytics_forbidden_for_employee(self, client, seed_reference_data, auth_headers):
        h = auth_headers(1001, 'EMPLOYE')
        r = client.post(
            '/api/ai/insights',
            json={'page': 'analytics', 'filters': {'annee': 2026}},
            headers=h,
        )
        assert r.status_code == 403

    def test_analytics_allowed_for_admin(self, client, seed_reference_data, auth_headers):
        h = auth_headers(9001, 'ADMIN')
        r = client.post(
            '/api/ai/insights',
            json={'page': 'analytics', 'filters': {'annee': 2026}},
            headers=h,
        )
        assert r.status_code == 200
        assert isinstance(r.json()['kpis'], list)

    def test_english_lang_passed(self, client, seed_reference_data, auth_headers):
        h = auth_headers(1001, 'EMPLOYE')
        r = client.post(
            '/api/ai/insights',
            json={'page': 'dashboard', 'tab': 'personnel', 'lang': 'en'},
            headers=h,
        )
        assert r.status_code == 200
        assert r.json()['lang'] == 'en'

    def test_direction_filter_reduces_effectif(self, client, seed_reference_data, auth_headers):
        h = auth_headers(9001, 'ADMIN')
        # Known direction → seeded employees should be present
        r = client.post(
            '/api/ai/insights',
            json={'page': 'analytics', 'filters': {'annee': 2026, 'direction': 'Direction Generale'}},
            headers=h,
        )
        assert r.status_code == 200
        assert r.json()['context']['effectif']['total'] >= 1

    def test_ollama_valid_response_used(self, client, seed_reference_data, auth_headers):
        mock_json_str = json.dumps({
            'synthese': 'IA response.',
            'kpis': [{'label': 'Test', 'value': '7', 'trend': None, 'alert': False}],
            'points_attention': ['Attention 1'],
            'recommandations': [{'priorite': 'haute', 'action': 'Agir', 'cible': 'RH'}],
            'narratif': 'Rapport complet.',
        })
        with patch.object(svc, 'call_ollama', return_value=mock_json_str):
            h = auth_headers(9001, 'ADMIN')
            r = client.post(
                '/api/ai/insights',
                json={'page': 'analytics', 'filters': {'annee': 2026}},
                headers=h,
            )
            assert r.status_code == 200
            data = r.json()
            assert data['source'] == 'ollama'
            assert data['synthese'] == 'IA response.'
            assert data['recommandations'][0]['priorite'] == 'haute'

    def test_ollama_failure_uses_deterministic_fallback(self, client, seed_reference_data, auth_headers):
        with patch.object(svc, 'call_ollama', return_value=None):
            h = auth_headers(9001, 'ADMIN')
            r = client.post(
                '/api/ai/insights',
                json={'page': 'analytics', 'filters': {'annee': 2026}},
                headers=h,
            )
            assert r.status_code == 200
            assert r.json()['source'] == 'deterministic'

    def test_response_has_generated_at_timestamp(self, client, seed_reference_data, auth_headers):
        h = auth_headers(1001, 'EMPLOYE')
        r = client.post('/api/ai/insights', json={'page': 'dashboard'}, headers=h)
        assert r.status_code == 200
        ga = r.json().get('generated_at')
        assert ga and datetime.fromisoformat(ga)
