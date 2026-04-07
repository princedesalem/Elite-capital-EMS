from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional

import pandas as pd

try:
    import pyodbc
except Exception:
    pyodbc = None


class AccessImportError(Exception):
    def __init__(self, code: str, message: str, available_tables: Optional[list[str]] = None, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.available_tables = available_tables or []
        self.status_code = status_code


def _candidate_drivers(filename: str) -> list[str]:
    if pyodbc is None:
        return []

    suffix = Path(filename).suffix.lower()
    installed = list(pyodbc.drivers())
    preferred = []

    for driver in installed:
        lowered = driver.lower()
        if 'access' in lowered:
            preferred.append(driver)
        elif suffix == '.mdb' and 'mdbtools' in lowered:
            preferred.append(driver)

    return preferred


def _connect_access_database(path: str, filename: str):
    drivers = _candidate_drivers(filename)
    if not drivers:
        raise AccessImportError(
            code='access_driver_unavailable',
            message='Aucun pilote ODBC Access compatible n est disponible sur ce serveur.',
            status_code=500,
        )

    attempts = []
    for driver in drivers:
        connection_string = f"DRIVER={{{driver}}};DBQ={path};"
        try:
            return pyodbc.connect(connection_string, autocommit=True)
        except Exception as exc:
            attempts.append(f'{driver}: {exc}')

    raise AccessImportError(
        code='access_connection_failed',
        message='Connexion impossible a la base Access. ' + ' | '.join(attempts),
        status_code=500,
    )


def _list_tables(connection) -> list[str]:
    tables = []
    cursor = connection.cursor()
    for row in cursor.tables(tableType='TABLE'):
        table_name = str(getattr(row, 'table_name', '') or '').strip()
        if not table_name or table_name.startswith('MSys'):
            continue
        if table_name not in tables:
            tables.append(table_name)
    return tables


def read_access_dataframe(content: bytes, filename: str, table_name: Optional[str] = None) -> tuple[pd.DataFrame, str]:
    temp_path = None
    connection = None
    try:
        suffix = Path(filename).suffix or '.mdb'
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        connection = _connect_access_database(temp_path, filename)
        available_tables = _list_tables(connection)
        if not available_tables:
            raise AccessImportError(
                code='access_no_table',
                message='Aucune table exploitable n a ete trouvee dans la base Access.',
                status_code=400,
            )

        if table_name:
            selected_table = next((name for name in available_tables if name.lower() == table_name.lower()), None)
            if not selected_table:
                raise AccessImportError(
                    code='access_table_not_found',
                    message='La table Access demandee est introuvable.',
                    available_tables=available_tables,
                    status_code=400,
                )
        elif len(available_tables) == 1:
            selected_table = available_tables[0]
        else:
            raise AccessImportError(
                code='access_table_required',
                message='Plusieurs tables Access detectees. Selectionnez une table.',
                available_tables=available_tables,
                status_code=400,
            )

        escaped_table = selected_table.replace(']', ']]')
        dataframe = pd.read_sql(f'SELECT * FROM [{escaped_table}]', connection)
        return dataframe, selected_table
    finally:
        if connection is not None:
            connection.close()
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass