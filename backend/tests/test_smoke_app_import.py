"""Smoke test garantissant que l'application FastAPI s'importe et expose ses routes.

Ce test attrape tres tot toute ImportError ou erreur de configuration dans
`app.main` (router manquant, schema casse, import circulaire, etc.). Il
correspond au minimum vital qu'on attend a chaque deploiement en prod.
"""


def test_app_import_and_routes_registered():
    from app.main import app

    routes = [r for r in app.routes if hasattr(r, 'path')]
    paths = {r.path for r in routes}

    # FastAPI expose toujours ces routes systeme
    assert '/openapi.json' in paths
    # On doit avoir au moins une cinquantaine de routes metier
    assert len(routes) > 50, f"Trop peu de routes enregistrees: {len(routes)}"


def test_critical_endpoints_present():
    """Quelques endpoints critiques doivent absolument exister."""
    from app.main import app

    paths = {r.path for r in app.routes if hasattr(r, 'path')}
    critical = [
        '/auth/login',
        '/employees/',
        '/api/workflow/boite/{matricule}',
    ]
    for path in critical:
        assert path in paths, f"Endpoint critique manquant: {path}"


def test_health_endpoint(client):
    resp = client.get('/health')
    assert resp.status_code == 200
