from datetime import date
from io import BytesIO

import pandas as pd

from app.routers.employees import AccessImportError


def test_import_employees_csv(client, seed_reference_data, auth_headers):
    csv_content = (
        "matricule,nom,prenom,email,sexe,date_embauche,entite,direction,departement,role,fonction,contact_urgence\n"
        "8888,Doe,John,8888@example.com,M,2026-02-01,ELCAM,Direction Generale,Operations,EMPLOYE,Analyste,+237699000000\n"
    )
    files = {
        'file': ('employees.csv', csv_content.encode('utf-8'), 'text/csv')
    }

    response = client.post('/employees/import', files=files, headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200

    payload = response.json()
    assert payload['total_rows'] == 1
    assert payload['imported_rows'] == 1
    assert payload['failed_rows'] == 0

    check = client.get('/employees/8888')
    assert check.status_code == 200
    assert check.json()['nom'] == 'Doe'
    assert check.json()['contact_urgence'] == '+237699000000'


def test_import_employees_xlsx(client, seed_reference_data, auth_headers):
    df = pd.DataFrame([
        {
            'matricule': 8889,
            'nom': 'Smith',
            'prenom': 'Jane',
            'email': '8889@example.com',
            'sexe': 'F',
            'date_embauche': date(2026, 2, 2),
            'entite': 'ELCAM',
            'direction': 'Direction Generale',
            'departement': 'Operations',
            'role': 'EMPLOYE',
            'fonction': 'Analyste',
            'contact_urgence': '+237688000000',
        }
    ])

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    output.seek(0)

    files = {
        'file': ('employees.xlsx', output.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    }

    response = client.post('/employees/import', files=files, headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200
    assert response.json()['imported_rows'] == 1

    check = client.get('/employees/8889')
    assert check.status_code == 200
    assert check.json()['contact_urgence'] == '+237688000000'


def test_export_employees_csv(client, seed_reference_data, auth_headers):
    response = client.get('/employees/export?format=csv', headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200
    assert 'text/csv' in response.headers.get('content-type', '')
    assert 'attachment; filename=employees_export.csv' == response.headers.get('content-disposition')
    text = response.content.decode('utf-8')
    assert 'matricule,nom,prenom,email' in text
    assert 'contact_urgence' in text


def test_export_employees_xlsx(client, seed_reference_data, auth_headers):
    response = client.get('/employees/export?format=xlsx', headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200
    assert response.headers.get('content-disposition') == 'attachment; filename=employees_export.xlsx'
    assert len(response.content) > 100


def test_import_employees_mdb(client, seed_reference_data, auth_headers, monkeypatch):
    from app.routers import employees as employees_router

    def fake_access_reader(content, filename, table_name=None):
        assert filename == 'employees.mdb'
        assert table_name is None
        return pd.DataFrame([
            {
                'matricule': 8890,
                'nom': 'Access',
                'prenom': 'User',
                'email': '8890@example.com',
                'sexe': 'M',
                'date_embauche': date(2026, 2, 3),
                'entite': 'ELCAM',
                'direction': 'Direction Generale',
                'departement': 'Operations',
                'role': 'EMPLOYE',
                'fonction': 'Analyste',
            }
        ]), 'Employees'

    monkeypatch.setattr(employees_router, 'read_access_dataframe', fake_access_reader)

    files = {
        'file': ('employees.mdb', b'fake-access-db', 'application/octet-stream')
    }

    response = client.post('/employees/import', files=files, headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200
    assert response.json()['table'] == 'Employees'
    assert response.json()['imported_rows'] == 1


def test_import_employees_accdb_requires_table_selection(client, seed_reference_data, auth_headers, monkeypatch):
    from app.routers import employees as employees_router

    def fake_access_reader(content, filename, table_name=None):
        raise AccessImportError(
            code='access_table_required',
            message='Plusieurs tables Access detectees. Selectionnez une table.',
            available_tables=['Employes', 'Archives'],
            status_code=400,
        )

    monkeypatch.setattr(employees_router, 'read_access_dataframe', fake_access_reader)

    files = {
        'file': ('employees.accdb', b'fake-access-db', 'application/octet-stream')
    }

    response = client.post('/employees/import', files=files, headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 400
    payload = response.json()['detail']
    assert payload['code'] == 'access_table_required'
    assert payload['available_tables'] == ['Employes', 'Archives']


def test_import_employees_accdb_with_selected_table(client, seed_reference_data, auth_headers, monkeypatch):
    from app.routers import employees as employees_router

    def fake_access_reader(content, filename, table_name=None):
        assert table_name == 'Employes'
        return pd.DataFrame([
            {
                'matricule': 8891,
                'nom': 'Access',
                'prenom': 'Selected',
                'email': '8891@example.com',
                'sexe': 'F',
                'date_embauche': date(2026, 2, 4),
                'entite': 'ELCAM',
                'direction': 'Direction Generale',
                'departement': 'Operations',
                'role': 'EMPLOYE',
                'fonction': 'Analyste',
            }
        ]), 'Employes'

    monkeypatch.setattr(employees_router, 'read_access_dataframe', fake_access_reader)

    files = {
        'file': ('employees.accdb', b'fake-access-db', 'application/octet-stream')
    }

    response = client.post('/employees/import?table=Employes', files=files, headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200
    assert response.json()['table'] == 'Employes'
    assert response.json()['imported_rows'] == 1


def test_import_employees_access_driver_error(client, seed_reference_data, auth_headers, monkeypatch):
    from app.routers import employees as employees_router

    def fake_access_reader(content, filename, table_name=None):
        raise AccessImportError(
            code='access_driver_unavailable',
            message='Aucun pilote ODBC Access compatible n est disponible sur ce serveur.',
            status_code=500,
        )

    monkeypatch.setattr(employees_router, 'read_access_dataframe', fake_access_reader)

    files = {
        'file': ('employees.accdb', b'fake-access-db', 'application/octet-stream')
    }

    response = client.post('/employees/import', files=files, headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 500
    payload = response.json()['detail']
    assert payload['code'] == 'access_driver_unavailable'


def test_employee_localisation_and_geo_filters(client, seed_reference_data, auth_headers):
    payload = {
        'matricule': 8892,
        'nom': 'Geo',
        'prenom': 'Filter',
        'email': '8892@example.com',
        'sexe': 'M',
        'date_embauche': '2026-02-05',
        'entite': 'ELCAM',
        'direction': 'Direction Generale',
        'departement': 'Operations',
        'role': 'EMPLOYE',
        'fonction': 'Analyste',
        'ville': 'Douala',
        'contact_urgence': '+237677000000',
    }

    create = client.post('/employees/', json=payload)
    assert create.status_code == 200

    emp = create.json()
    assert emp['ville'] == 'Douala'
    assert emp['pays'] == 'Cameroun'
    assert emp['id_localisation'] is not None
    assert emp['id_pays'] == seed_reference_data['pays'].id_pays
    assert emp['contact_urgence'] == '+237677000000'

    by_country = client.get(f"/employees/?id_pays={seed_reference_data['pays'].id_pays}")
    assert by_country.status_code == 200
    assert any(int(row['matricule']) == 8892 for row in by_country.json())

    by_city = client.get(f"/employees/?id_localisation={seed_reference_data['localisation'].id_localisation}")
    assert by_city.status_code == 200
    assert any(int(row['matricule']) == 8892 for row in by_city.json())
