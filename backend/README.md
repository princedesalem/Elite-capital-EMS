# Backend (FastAPI)

Minimal FastAPI scaffold powering the extranet API.

## Environment variables

The application reads configuration from environment variables (and a `.env` file when using `python-dotenv`). Important variables include:

- `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://user:pass@db:5432/extranet`).
- `SECRET_KEY` – JWT signing secret.
- `APP_URL` – URL where frontend is served (used to build links in emails).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` – settings for sending mail. If you don't have an SMTP account you can run a local mail catcher or print to console using `backend/app/utils/email.py`.

> **Note:** if you modify the database schema (e.g. add the `email` column) you should recreate the database or run migrations. Alembic is not yet configured; for development you can simply drop the `extranet` database and let it be re-initialized by `init_db.py`.

## Fonctions de reference (autocomplete)

L'autocomplete du champ `fonction` utilise maintenant la table `FONCTION_REFERENCE`.

1. Executer la migration SQL (depuis la racine du repo):

```powershell
Get-Content .\backend\migrations\011_add_fonction_reference.sql | docker compose exec -T db mysql -uextranet -pextranet EMS_DB
```

2. Endpoint lecture autocomplete:
- `GET /employees/autocomplete/fonctions`

3. Endpoints admin gestion du referentiel:
- `GET /employees/admin/fonctions-reference`
- `POST /employees/admin/fonctions-reference` avec body JSON: `{ "libelle": "Nouvelle fonction" }`
- `PUT /employees/admin/fonctions-reference/{id_fonction}` avec body JSON: `{ "libelle": "Libelle modifie" }`
- `DELETE /employees/admin/fonctions-reference/{id_fonction}`

## Setup (Windows):

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# export variables or copy .env.example to .env and edit
```