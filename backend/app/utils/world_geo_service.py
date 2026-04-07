from functools import lru_cache
from typing import Dict, List, Optional, Tuple
import unicodedata
import logging

import httpx

RESTCOUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=cca2,name,translations,flag'
COUNTRIESNOW_CITIES_URL = 'https://countriesnow.space/api/v0.1/countries/cities'
REQUEST_TIMEOUT_SECONDS = 8.0
GEO_VALIDATION_UNAVAILABLE_MESSAGE = 'Service de validation geographique temporairement indisponible. Veuillez reessayer.'


logger = logging.getLogger(__name__)


def _normalize(value: str) -> str:
    value = str(value or '').strip().lower()
    return ''.join(ch for ch in unicodedata.normalize('NFD', value) if unicodedata.category(ch) != 'Mn')


def _request_json(method: str, url: str, **kwargs):
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True) as client:
            response = client.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json(), None
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning('Geo provider call failed %s %s: %s', method, url, exc)
        return None, exc


@lru_cache(maxsize=1)
def _countries_index() -> List[Dict[str, str]]:
    payload, error = _request_json('GET', RESTCOUNTRIES_URL)
    if error or not isinstance(payload, list):
        return []

    countries: List[Dict[str, str]] = []
    for item in payload:
        code = str(item.get('cca2') or '').upper().strip()
        name_data = item.get('name') or {}
        common_name = str(name_data.get('common') or '').strip()
        official_name = str(name_data.get('official') or '').strip()
        translations = item.get('translations') or {}
        french_translation = translations.get('fra') or {}
        french_common_name = str(french_translation.get('common') or '').strip()
        french_official_name = str(french_translation.get('official') or '').strip()
        flag = str(item.get('flag') or '').strip() or '🏳️'
        if not code or not common_name:
            continue
        countries.append({
            'code': code,
            'name': french_common_name or common_name,
            'official_name': french_official_name or official_name,
            'lookup_name': common_name,
            'flag': flag,
        })

    countries.sort(key=lambda c: c['name'])
    return countries


@lru_cache(maxsize=400)
def _cities_for_country(country_name: str) -> List[str]:
    payload, error = _request_json('POST', COUNTRIESNOW_CITIES_URL, json={'country': country_name})
    if error or not isinstance(payload, dict):
        return []

    if payload.get('error'):
        return []

    cities_raw = payload.get('data') or []
    cities = sorted({str(city).strip() for city in cities_raw if str(city).strip()})
    return cities


def search_countries(query: str) -> List[Dict[str, str]]:
    query_norm = _normalize(query)
    if not query_norm:
        return []

    results: List[Dict[str, str]] = []
    for country in _countries_index():
        code = country['code']
        name = country['name']
        official_name = country['official_name']
        lookup_name = country.get('lookup_name', name)
        if (
            query_norm in _normalize(code)
            or query_norm in _normalize(name)
            or query_norm in _normalize(official_name)
            or query_norm in _normalize(lookup_name)
        ):
            results.append({
                'code': code,
                'name': name,
                'flag': country['flag'],
            })
            if len(results) >= 20:
                break
    return results


def search_cities(country_code: str, query: str) -> List[Dict[str, str]]:
    country = find_country(country_code=country_code)
    if not country:
        return []

    query_norm = _normalize(query)
    if not query_norm:
        return []

    lookup_name = country.get('lookup_name', country['name'])
    cities = _cities_for_country(lookup_name)
    results: List[Dict[str, str]] = []
    for city in cities:
        if query_norm in _normalize(city):
            results.append({'name': city, 'country_code': country['code']})
            if len(results) >= 20:
                break
    return results


def find_country(country_code: Optional[str] = None, country_name: Optional[str] = None) -> Optional[Dict[str, str]]:
    code_norm = str(country_code or '').upper().strip()
    name_norm = _normalize(country_name or '')

    for country in _countries_index():
        lookup_name = country.get('lookup_name', country['name'])
        if code_norm and country['code'] == code_norm:
            return country
        if name_norm and (
            name_norm == _normalize(country['name'])
            or name_norm == _normalize(country['official_name'])
            or name_norm == _normalize(lookup_name)
        ):
            return country
    return None


def validate_country_city(country_name: str, city_name: str, country_code: Optional[str] = None) -> Tuple[bool, str, Optional[Dict[str, str]]]:
    if not _countries_index():
        return False, GEO_VALIDATION_UNAVAILABLE_MESSAGE, None

    country = find_country(country_code=country_code, country_name=country_name)
    if not country:
        return False, 'Pays invalide. Veuillez sélectionner un pays depuis la liste.', None

    city_input = str(city_name or '').strip()
    if not city_input:
        return False, 'Ville invalide. Veuillez sélectionner une ville depuis la liste.', None

    lookup_name = country.get('lookup_name', country['name'])
    cities = _cities_for_country(lookup_name)
    if not cities:
        return False, GEO_VALIDATION_UNAVAILABLE_MESSAGE, None

    city_norm = _normalize(city_input)
    selected_city = next((city for city in cities if _normalize(city) == city_norm), None)
    if not selected_city:
        return False, 'Ville invalide pour ce pays. Veuillez sélectionner une ville depuis la liste.', None

    return True, 'ok', {
        'country_code': country['code'],
        'country_name': country['name'],
        'city_name': selected_city,
    }
