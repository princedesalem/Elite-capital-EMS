from app.utils import world_geo_service
import httpx


def test_validate_country_city_success(monkeypatch):
    monkeypatch.setattr(
        world_geo_service,
        '_countries_index',
        lambda: [
            {
                'code': 'CM',
                'name': 'Cameroun',
                'official_name': 'Republique du Cameroun',
                'flag': 'CM',
            }
        ],
    )
    monkeypatch.setattr(world_geo_service, '_cities_for_country', lambda country: ['Douala', 'Yaounde'])

    ok, message, normalized = world_geo_service.validate_country_city('Cameroun', 'Douala', 'CM')

    assert ok is True
    assert message == 'ok'
    assert normalized == {
        'country_code': 'CM',
        'country_name': 'Cameroun',
        'city_name': 'Douala',
    }


def test_validate_country_city_rejects_city_not_in_country(monkeypatch):
    monkeypatch.setattr(
        world_geo_service,
        '_countries_index',
        lambda: [
            {
                'code': 'CM',
                'name': 'Cameroun',
                'official_name': 'Republique du Cameroun',
                'flag': 'CM',
            }
        ],
    )
    monkeypatch.setattr(world_geo_service, '_cities_for_country', lambda country: ['Douala', 'Yaounde'])

    ok, message, normalized = world_geo_service.validate_country_city('Cameroun', 'Paris', 'CM')

    assert ok is False
    assert 'Ville invalide' in message
    assert normalized is None


def test_search_countries_uses_french_display_name(monkeypatch):
    monkeypatch.setattr(
        world_geo_service,
        '_countries_index',
        lambda: [
            {
                'code': 'CM',
                'name': 'Cameroun',
                'official_name': 'Republique du Cameroun',
                'lookup_name': 'Cameroon',
                'flag': 'CM',
            }
        ],
    )

    results = world_geo_service.search_countries('cameroon')

    assert len(results) == 1
    assert results[0]['code'] == 'CM'
    assert results[0]['name'] == 'Cameroun'


def test_validate_country_city_uses_lookup_name_for_city_provider(monkeypatch):
    monkeypatch.setattr(
        world_geo_service,
        '_countries_index',
        lambda: [
            {
                'code': 'CM',
                'name': 'Cameroun',
                'official_name': 'Republique du Cameroun',
                'lookup_name': 'Cameroon',
                'flag': 'CM',
            }
        ],
    )

    called_with = {'country': None}

    def fake_cities(country_name):
        called_with['country'] = country_name
        return ['Douala']

    monkeypatch.setattr(world_geo_service, '_cities_for_country', fake_cities)

    ok, message, normalized = world_geo_service.validate_country_city('Cameroun', 'Douala', 'CM')

    assert ok is True
    assert message == 'ok'
    assert normalized == {
        'country_code': 'CM',
        'country_name': 'Cameroun',
        'city_name': 'Douala',
    }
    assert called_with['country'] == 'Cameroon'


def test_cities_for_country_returns_empty_on_provider_error(monkeypatch):
    world_geo_service._cities_for_country.cache_clear()
    monkeypatch.setattr(world_geo_service, '_request_json', lambda *args, **kwargs: (None, httpx.ConnectError('boom')))

    assert world_geo_service._cities_for_country('Cameroon') == []


def test_validate_country_city_returns_unavailable_when_geo_provider_fails(monkeypatch):
    monkeypatch.setattr(
        world_geo_service,
        '_countries_index',
        lambda: [
            {
                'code': 'CM',
                'name': 'Cameroun',
                'official_name': 'Republique du Cameroun',
                'lookup_name': 'Cameroon',
                'flag': 'CM',
            }
        ],
    )
    monkeypatch.setattr(world_geo_service, '_cities_for_country', lambda country: [])

    ok, message, normalized = world_geo_service.validate_country_city('Cameroun', 'Douala', 'CM')

    assert ok is False
    assert message == world_geo_service.GEO_VALIDATION_UNAVAILABLE_MESSAGE
    assert normalized is None


def test_request_json_enables_redirect_following(monkeypatch):
    called = {'follow_redirects': None}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return []

    class FakeClient:
        def __init__(self, timeout, follow_redirects):
            called['follow_redirects'] = follow_redirects

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def request(self, method, url, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(world_geo_service.httpx, 'Client', FakeClient)
    payload, error = world_geo_service._request_json('GET', 'https://example.com')

    assert error is None
    assert payload == []
    assert called['follow_redirects'] is True
