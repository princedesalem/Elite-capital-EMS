from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from ..db import get_db
from .. import crud, schemas, models
from ..utils import security
from ..utils.world_data import WORLD_COUNTRIES, WORLD_CITIES
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from io import BytesIO
import pandas as pd
from ..utils.access_parser import AccessImportError, read_access_dataframe
from ..utils import notifications as notifications_utils
from ..utils import email as email_utils

router = APIRouter(prefix='/employees', tags=['employees'])

DEFAULT_FONCTIONS = [
    'Administrateur Général',
    'PCA',
    'Directeur Audit Interne et Inspection Générale',
    'Inspecteur Générale(IG)',
    'Auditeur',
    "Représentants Résidents et responsables de la creation et relation d'affaires",
    'Directeur financier et Comptable(DFC)',
    'comptable et responsable contrôle et consolidation',
    'responsable Trésorerie et financement',
    'contrôleur de gestion',
    'comptable',
    'responsable des resources Humaines',
    'chargé des resources humaines',
    'responsable communication et relation publiques',
    'chargé community management accueil et courrier',
    'infographiste et déploiement',
    'Responsable affaires juridiques & fiscalité',
    'chargé de la fiscalité',
    'Directeur des Organisations et projets',
    "Responsable des systèmes d'information",
    'chargé des organisations et projets',
    'chargé marketing digital opérationnel',
    'chargé des moyens généraux',
    'Administrateur Directeur Général',
    'Directeur Général Adjoint',
    'Responsable conformité et contrôle interne',
    'Directeur Développement et investissement',
    'Responsable développement Pool Grande Entreprise & Fortunes',
    'Chargé développement Pool Grande Entreprise & Fortunes',
    'Responsable développement Pool Particuliers & PME',
    'Chargé développement Pool Particuliers & PMEs',
    'Responsable Middle & Back Office',
    'Responsable Trésorerie(ALM)',
    'Chargé de négociation',
    'Directeur Conseil et Financement structurés',
    'Responsable Financement et structuration',
    'Analyste Financement et structuration',
    'Responsable du Développement',
    'Chargé du développement portefeuille Grandes entreprise et Fortune',
    'Chargé du développement portefeuille particulier et PME',
    'Directeur Conformité et Contrôle interne',
    'Directeur Distribution',
    'Responsable Distribution Grandes Entreprises Institutions et Fortunes',
    'Responsable Distribution Particuliers et PME',
    'Responsable Gestion et Analyste de portefeuille',
    'chargé de Gestions de portefeuille',
    'chargé Analyste de portefeuille',
    'Responsable Middle & Back office',
    'chargé Back Office & operations',
    'Stagiaire professionnel',
    'Stagiaire académique'
]


def _is_stagiaire_profile(fonction: Optional[str], categorie: Optional[str]) -> bool:
    f = str(fonction or '').strip().lower()
    c = str(categorie or '').strip().lower()
    return ('stagiaire' in f) or ('stagiaire' in c)


def _notify_admin_employee_creation(
    db: Session,
    created: models.Employe,
    creator_role: str,
    creator_matricule: Optional[int],
    background_tasks: Optional[BackgroundTasks],
):
    if str(creator_role or '').upper() != 'RH':
        return

    admin_role_ids = [
        role.id
        for role in db.query(models.Role).all()
        if str(role.name or '').strip().upper() in {'ADMIN', 'ADMINISTRATEUR'}
    ]
    if not admin_role_ids:
        return

    admin_users = db.query(models.Utilisateur).filter(models.Utilisateur.role_id.in_(admin_role_ids)).all()
    if not admin_users:
        return

    creator_emp = None
    if creator_matricule:
        creator_emp = db.query(models.Employe).filter(models.Employe.matricule == creator_matricule).first()

    creator_label = (
        f"{creator_emp.prenom} {creator_emp.nom}" if creator_emp else f"RH {creator_matricule or ''}"
    ).strip()
    new_emp_label = f"{created.prenom} {created.nom}".strip()

    for admin in admin_users:
        notifications_utils.creer_notification(
            matricule=admin.matricule,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre='Nouvel employé créé',
            message=(
                f"{creator_label} a créé l'employé {new_emp_label} (matricule {created.matricule})."
            ),
            id_operation=None,
            db=db,
        )

    to_admin = next((u.email for u in admin_users if u.email), None)
    if not to_admin:
        return

    cc_emails = []

    role_ag_pca_ids = [
        role.id
        for role in db.query(models.Role).all()
        if str(role.name or '').strip().upper() in {'AG', 'PCA'}
    ]
    if role_ag_pca_ids:
        ag_pca_users = db.query(models.Utilisateur).filter(models.Utilisateur.role_id.in_(role_ag_pca_ids)).all()
        cc_emails.extend([u.email for u in ag_pca_users if u.email])

    directeur_op = db.query(models.Employe).filter(
        func.lower(models.Employe.fonction) == 'directeur des organisations et projets'
    ).first()
    if directeur_op and directeur_op.email:
        cc_emails.append(directeur_op.email)

    # Keep CC deduplicated and exclude primary recipient
    cc_emails = [e for e in sorted(set(cc_emails)) if e != to_admin]

    subject = '[EMS] Création d\'un nouvel employé'
    body = (
        f"Bonjour,\n\n"
        f"Un employé vient d'être créé dans EMS.\n"
        f"Créé par: {creator_label}\n"
        f"Employé: {new_emp_label}\n"
        f"Matricule: {created.matricule}\n"
        f"Fonction: {created.fonction or 'Non renseigné'}\n"
        f"Entité: {created.id_entite or 'Non renseignée'}\n\n"
        f"Cordialement,\nEMS"
    )

    reply_to = creator_emp.email if creator_emp and creator_emp.email else None
    if background_tasks is not None:
        background_tasks.add_task(
            email_utils.send_email,
            to_admin,
            subject,
            body,
            False,
            cc_emails,
            reply_to,
        )
    else:
        email_utils.send_email(to_admin, subject, body, False, cc_emails, reply_to)


def _role_names_set(db: Session):
    return {
        str(r.name or '').strip().lower()
        for r in db.query(models.Role).all()
        if str(r.name or '').strip()
    }


def _seed_default_fonctions(db: Session):
    existing = {
        str(f.libelle or '').strip().lower()
        for f in db.query(models.FonctionReference).all()
        if str(f.libelle or '').strip()
    }
    role_names = _role_names_set(db)
    to_create = []
    for libelle in DEFAULT_FONCTIONS:
        key = str(libelle or '').strip().lower()
        if not key or key in existing or key in role_names:
            continue
        existing.add(key)
        to_create.append(models.FonctionReference(libelle=libelle))
    if to_create:
        db.add_all(to_create)
        db.commit()

def _check_authenticated(request: Request):
    """Vérifie uniquement qu'un token JWT valide est présent (tous rôles acceptés)."""
    auth = request.headers.get('authorization')
    if not auth or not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Token manquant')
    token = auth.split(None, 1)[1]
    try:
        payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        return str(payload.get('role') or '').strip().upper()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail='Token invalide')


def _check_admin_role(request: Request, allowed_roles=['RH', 'DG', 'PCA', 'ADMIN', 'AG']):
    """Vérifier que l'utilisateur a un rôle administrateur autorisé"""
    auth = request.headers.get('authorization')
    if not auth or not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Token manquant')
    
    token = auth.split(None, 1)[1]
    try:
        payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        role = str(payload.get('role') or '').strip().upper()
        allowed = [str(r).strip().upper() for r in allowed_roles]
        if role not in allowed:
            raise HTTPException(status_code=403, detail=f'Accès refusé. Rôles autorisés: {allowed_roles}')
        return role
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail='Token invalide')


def _get_token_context(request: Request):
    auth = request.headers.get('authorization')
    if not auth or not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Token manquant')

    token = auth.split(None, 1)[1]
    try:
        payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail='Token invalide')

    role = str(payload.get('role') or '').strip().upper()
    matricule = payload.get('matricule') or payload.get('sub')
    try:
        matricule = int(matricule)
    except Exception:
        raise HTTPException(status_code=401, detail='Token sans matricule valide')

    return matricule, role


def _serialize_employee(e: models.Employe, db: Session):
    data = schemas.EmployeOut.model_validate(e).model_dump()
    role = db.query(models.Role).filter(models.Role.id == e.id_role).first() if e.id_role else None
    entite = db.query(models.Entite).filter(models.Entite.id_entite == e.id_entite).first() if e.id_entite else None
    direction = db.query(models.Direction).filter(models.Direction.id_direction == e.id_direction).first() if e.id_direction else None
    departement = db.query(models.Departement).filter(models.Departement.dept_id == e.dept_id).first() if e.dept_id else None
    data['role'] = role.name if role else None
    data['entite'] = entite.nom if entite else None
    data['direction'] = direction.nom if direction else None
    data['departement'] = departement.nom if departement else None
    data['id_entite'] = e.id_entite
    data['id_direction'] = e.id_direction
    data['dept_id'] = e.dept_id
    data['photo_url'] = e.photo_url
    localisation = _resolve_employee_localisation(e, db)
    data['id_localisation'] = localisation.id_localisation if localisation else None
    data['ville'] = localisation.ville if localisation else None
    pays = db.query(models.Pays).filter(models.Pays.id_pays == localisation.id_pays).first() if localisation else None
    data['id_pays'] = pays.id_pays if pays else None
    data['pays'] = pays.nom_pays if pays else None
    sv = e.statut_employe
    data['statut_employe'] = (sv.value if hasattr(sv, 'value') else str(sv)) if sv else 'ACTIF'
    return data


def _resolve_employee_localisation(e: models.Employe, db: Session):
    if e.id_localisation:
        localisation = db.query(models.Localisation).filter(models.Localisation.id_localisation == e.id_localisation).first()
        if localisation:
            return localisation

    if e.id_direction:
        direction = db.query(models.Direction).filter(models.Direction.id_direction == e.id_direction).first()
        if direction and direction.id_localisation:
            return db.query(models.Localisation).filter(models.Localisation.id_localisation == direction.id_localisation).first()

    return None


def _employee_matches_geo_filters(e: models.Employe, db: Session, id_pays: Optional[int], id_localisation: Optional[int]) -> bool:
    if not id_pays and not id_localisation:
        return True

    localisation = _resolve_employee_localisation(e, db)
    if not localisation:
        return False

    if id_localisation and localisation.id_localisation != id_localisation:
        return False

    if id_pays and localisation.id_pays != id_pays:
        return False

    return True


def _prepare_employee_payload(payload: schemas.EmployeBase, db: Session):
    source = payload.model_dump()
    role_name = source.pop('role', None)
    entite_input = source.pop('entite', None)
    direction_input = source.pop('direction', None)
    departement_input = source.pop('departement', None)
    ville_input = source.pop('ville', None)
    id_localisation_input = source.pop('id_localisation', None)
    categorie_input = source.pop('categorie', None)
    anciennete = source.pop('anciennete', None)  # read-only, ignore on write

    valid_fields = {
        'matricule', 'nom', 'prenom', 'date_naissance', 'sexe', 'telephone', 'email',
        'diplome', 'solde_conges', 'date_embauche', 'fonction', 'annee_experience', 'n1', 'n1_fonction',
        'statut_employe', 'photo_url', 'contact_urgence', 'statut_matrimonial', 'nombre_enfants'
    }
    cleaned = {k: v for k, v in source.items() if k in valid_fields}

    # Validation de l'âge minimum: 18 ans, sauf stagiaire (pas de minimum)
    from datetime import date
    date_naissance = cleaned.get('date_naissance')
    is_stagiaire = _is_stagiaire_profile(cleaned.get('fonction'), categorie_input)
    if date_naissance:
        today = date.today()
        age = today.year - date_naissance.year - ((today.month, today.day) < (date_naissance.month, date_naissance.day))
        if (not is_stagiaire) and age < 18:
            raise HTTPException(status_code=400, detail="L'âge de l'employé doit être au moins 18 ans (hors stagiaires).")

    if cleaned.get('matricule') is not None and cleaned.get('matricule') != '':
        cleaned['matricule'] = int(cleaned['matricule'])
    if cleaned.get('n1') is not None and cleaned.get('n1') != '':
        cleaned['n1'] = int(cleaned['n1'])
    elif 'n1' in cleaned and not cleaned['n1']:
        cleaned['n1'] = None
    # Resolve n1 from function: find the active holder of n1_fonction
    if cleaned.get('n1_fonction') and not cleaned.get('n1'):
        nf = cleaned['n1_fonction'].strip()
        holder = db.query(models.Employe).filter(
            models.Employe.fonction == nf,
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        ).first()
        if holder:
            cleaned['n1'] = holder.matricule
    elif not cleaned.get('n1_fonction') and 'n1_fonction' in cleaned:
        cleaned['n1_fonction'] = None
    if cleaned.get('sexe') is not None:
        sexe_raw = str(cleaned.get('sexe') or '').strip().lower()
        if sexe_raw in {'m', 'masculin', 'homme'}:
            cleaned['sexe'] = 'M'
        elif sexe_raw in {'f', 'féminin', 'feminin', 'femme'}:
            cleaned['sexe'] = 'F'
        elif sexe_raw in {'autre', 'other'}:
            cleaned['sexe'] = 'Autre'

    if cleaned.get('statut_matrimonial') is not None:
        raw = str(cleaned.get('statut_matrimonial') or '').strip().lower()
        if raw in {'celibataire', 'célibataire', 'c'}:
            cleaned['statut_matrimonial'] = 'Celibataire'
        elif raw in {'marie', 'marié', 'm'}:
            cleaned['statut_matrimonial'] = 'Marie'
        elif raw:
            raise HTTPException(status_code=400, detail='Statut matrimonial invalide (Celibataire ou Marie).')
        else:
            cleaned['statut_matrimonial'] = None

    if cleaned.get('nombre_enfants') is not None and cleaned.get('nombre_enfants') != '':
        try:
            nombre_enfants = int(cleaned.get('nombre_enfants'))
        except Exception:
            raise HTTPException(status_code=400, detail='Le nombre d\'enfants doit être un entier.')
        if nombre_enfants < 0:
            raise HTTPException(status_code=400, detail='Le nombre d\'enfants ne peut pas être négatif.')
        cleaned['nombre_enfants'] = nombre_enfants
    elif 'nombre_enfants' in cleaned:
        cleaned['nombre_enfants'] = None

    if role_name:
        role = db.query(models.Role).filter(models.Role.name == role_name).first()
        if not role:
            raise HTTPException(status_code=400, detail='Rôle invalide')
        cleaned['id_role'] = role.id

    if entite_input:
        entite = db.query(models.Entite).filter(models.Entite.nom == entite_input).first()
        if not entite and str(entite_input).isdigit():
            entite = db.query(models.Entite).filter(models.Entite.id_entite == int(entite_input)).first()
        if not entite:
            raise HTTPException(status_code=400, detail='Entité invalide')
        cleaned['id_entite'] = entite.id_entite

    if direction_input:
        direction = db.query(models.Direction).filter(models.Direction.nom == direction_input).first()
        if not direction and str(direction_input).isdigit():
            direction = db.query(models.Direction).filter(models.Direction.id_direction == int(direction_input)).first()
        if not direction:
            raise HTTPException(status_code=400, detail='Direction invalide')
        cleaned['id_direction'] = direction.id_direction

    if departement_input:
        departement = db.query(models.Departement).filter(models.Departement.nom == departement_input).first()
        if not departement and str(departement_input).isdigit():
            departement = db.query(models.Departement).filter(models.Departement.dept_id == int(departement_input)).first()
        if not departement:
            raise HTTPException(status_code=400, detail='Département invalide')
        cleaned['dept_id'] = departement.dept_id

    # Harmoniser automatiquement la hiérarchie si un département est fourni
    if cleaned.get('dept_id'):
        dept = db.query(models.Departement).filter(models.Departement.dept_id == cleaned['dept_id']).first()
        if dept:
            cleaned['id_direction'] = dept.id_direction
            cleaned['id_entite'] = dept.id_entite
    elif cleaned.get('id_direction'):
        # Si seule la direction est fournie, déduire l'entité
        dir_obj = db.query(models.Direction).filter(models.Direction.id_direction == cleaned['id_direction']).first()
        if dir_obj and not cleaned.get('id_entite'):
            cleaned['id_entite'] = dir_obj.id_entite

    if categorie_input:
        cleaned['categorie'] = categorie_input

    if id_localisation_input not in (None, ''):
        localisation = db.query(models.Localisation).filter(models.Localisation.id_localisation == int(id_localisation_input)).first()
        if not localisation:
            raise HTTPException(status_code=400, detail='Ville invalide')
        cleaned['id_localisation'] = localisation.id_localisation
    elif ville_input:
        ville_norm = str(ville_input).strip().lower()
        localisation = db.query(models.Localisation).filter(func.lower(models.Localisation.ville) == ville_norm).first()
        if not localisation:
            raise HTTPException(status_code=400, detail='Ville invalide')
        cleaned['id_localisation'] = localisation.id_localisation
    elif cleaned.get('id_direction'):
        direction = db.query(models.Direction).filter(models.Direction.id_direction == cleaned['id_direction']).first()
        if direction and direction.id_localisation:
            cleaned['id_localisation'] = direction.id_localisation

    return cleaned


def _clean_import_value(value):
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, str):
        v = value.strip()
        return v if v else None
    return value


def _normalize_import_row(raw_row: dict):
    aliases = {
        'matricule': 'matricule',
        'nom': 'nom',
        'prenom': 'prenom',
        'date_naissance': 'date_naissance',
        'date de naissance': 'date_naissance',
        'sexe': 'sexe',
        'telephone': 'telephone',
        'téléphone': 'telephone',
        'email': 'email',
        'departement': 'departement',
        'département': 'departement',
        'fonction': 'fonction',
        'ville': 'ville',
        'contact_urgence': 'contact_urgence',
        'contact urgence': 'contact_urgence',
        'diplome': 'diplome',
        'diplôme': 'diplome',
        'solde_conges': 'solde_conges',
        'solde congés': 'solde_conges',
        'date_embauche': 'date_embauche',
        'date embauche': 'date_embauche',
        'entite': 'entite',
        'entité': 'entite',
        'role': 'role',
        'rôle': 'role',
        'direction': 'direction',
        'categorie': 'categorie',
        'catégorie': 'categorie',
        'n1': 'n1',
        'n1_fonction': 'n1_fonction',
        'annee_experience': 'annee_experience',
        'année_experience': 'annee_experience',
        'statut_employe': 'statut_employe',
        'statut employe': 'statut_employe',
        'statut_matrimonial': 'statut_matrimonial',
        'statut matrimonial': 'statut_matrimonial',
        'nombre_enfants': 'nombre_enfants',
        'nombre d\'enfants': 'nombre_enfants',
    }
    result = {}
    for key, value in (raw_row or {}).items():
        normalized_key = str(key or '').strip().lower()
        mapped = aliases.get(normalized_key)
        if not mapped:
            continue
        cleaned_value = _clean_import_value(value)
        if mapped in {'contact_urgence', 'telephone'} and cleaned_value is not None:
            cleaned_value = str(cleaned_value).strip()
        result[mapped] = cleaned_value
    return result


def _read_import_dataframe(upload: UploadFile, table: Optional[str] = None):
    filename = (upload.filename or '').lower()
    if not filename:
        raise HTTPException(status_code=400, detail='Nom de fichier manquant')

    content = upload.file.read()
    if not content:
        raise HTTPException(status_code=400, detail='Fichier vide')

    try:
        if filename.endswith('.csv'):
            return pd.read_csv(BytesIO(content), sep=None, engine='python', dtype=str, keep_default_na=False), None
        if filename.endswith('.xlsx'):
            return pd.read_excel(BytesIO(content), engine='openpyxl', dtype=str, keep_default_na=False), None
        if filename.endswith('.xls'):
            return pd.read_excel(BytesIO(content), engine='xlrd', dtype=str, keep_default_na=False), None
        if filename.endswith('.mdb') or filename.endswith('.accdb'):
            dataframe, resolved_table = read_access_dataframe(content, filename, table_name=table)
            return dataframe, resolved_table
    except AccessImportError as exc:
        detail = {'code': exc.code, 'message': exc.message}
        if exc.available_tables:
            detail['available_tables'] = exc.available_tables
        raise HTTPException(status_code=exc.status_code, detail=detail)

    raise HTTPException(status_code=400, detail='Format non supporté. Utiliser CSV, XLSX, XLS, MDB ou ACCDB')


def _employee_export_rows(db: Session):
    employees = db.query(models.Employe).all()
    rows = []
    for e in employees:
        data = _serialize_employee(e, db)
        rows.append({
            'matricule': data.get('matricule'),
            'nom': data.get('nom'),
            'prenom': data.get('prenom'),
            'email': data.get('email'),
            'date_naissance': data.get('date_naissance'),
            'sexe': data.get('sexe'),
            'telephone': data.get('telephone'),
            'fonction': data.get('fonction'),
            'departement': data.get('departement'),
            'direction': data.get('direction'),
            'entite': data.get('entite'),
            'role': data.get('role'),
            'pays': data.get('pays'),
            'ville': data.get('ville'),
            'id_localisation': data.get('id_localisation'),
            'diplome': data.get('diplome'),
            'contact_urgence': data.get('contact_urgence'),
            'date_embauche': data.get('date_embauche'),
            'solde_conges': data.get('solde_conges'),
            'categorie': data.get('categorie'),
            'annee_experience': data.get('annee_experience'),
            'statut_employe': data.get('statut_employe'),
            'n1': data.get('n1'),
            'statut_matrimonial': data.get('statut_matrimonial'),
            'nombre_enfants': data.get('nombre_enfants'),
        })
    return rows


@router.get('/', response_model=list[schemas.EmployeOut])
def list_employees(
    id_pays: Optional[int] = Query(None),
    id_localisation: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    employees = db.query(models.Employe).all()
    employees = [e for e in employees if _employee_matches_geo_filters(e, db, id_pays, id_localisation)]
    return [_serialize_employee(e, db) for e in employees]


@router.get('/scoped', response_model=list[schemas.EmployeOut])
def list_employees_scoped(
    request: Request,
    id_pays: Optional[int] = Query(None),
    id_localisation: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    requester_matricule, requester_role = _get_token_context(request)
    role = str(requester_role or 'EMPLOYE').upper()

    is_full_access = role in {'RH', 'ADMIN', 'PCA', 'AG'}
    if is_full_access:
        employees = db.query(models.Employe).all()
        employees = [e for e in employees if _employee_matches_geo_filters(e, db, id_pays, id_localisation)]
        return [_serialize_employee(e, db) for e in employees]

    requester = db.query(models.Employe).filter(models.Employe.matricule == requester_matricule).first()
    if not requester:
        raise HTTPException(status_code=404, detail='Employé connecté introuvable')

    query = db.query(models.Employe)
    if role == 'DG':
        query = query.filter(models.Employe.id_entite == requester.id_entite)
    elif role == 'DIRECTEUR':
        query = query.filter(models.Employe.id_direction == requester.id_direction)
    elif role == 'RESPONSABLE':
        query = query.filter(models.Employe.dept_id == requester.dept_id)
    else:
        query = query.filter(models.Employe.matricule == requester_matricule)

    employees = query.all()
    employees = [e for e in employees if _employee_matches_geo_filters(e, db, id_pays, id_localisation)]
    return [_serialize_employee(e, db) for e in employees]


@router.post('/', response_model=schemas.EmployeOut)
def create_employee(
    payload: schemas.EmployeBase,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    creator_role = ''
    creator_matricule = None
    auth = request.headers.get('authorization')
    if auth and auth.lower().startswith('bearer '):
        token = auth.split(None, 1)[1]
        try:
            token_payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            creator_role = str(token_payload.get('role') or '').strip().upper()
            creator_matricule = token_payload.get('matricule') or token_payload.get('sub')
            creator_matricule = int(creator_matricule) if creator_matricule is not None else None
        except Exception:
            creator_role = ''
            creator_matricule = None

    data = _prepare_employee_payload(payload, db)
    if not data.get('date_embauche'):
        raise HTTPException(status_code=400, detail="Date d'embauche requise")
    if not data.get('id_entite'):
        raise HTTPException(status_code=400, detail='Entité requise')
    existing = crud.get_employe(db, data.get('matricule'))
    if existing:
        raise HTTPException(status_code=400, detail='Matricule existe')
    try:
        created = crud.create_employe(db, data)
    except IntegrityError as e:
        db.rollback()
        msg = str(getattr(e, 'orig', e))
        if 'email' in msg.lower():
            raise HTTPException(status_code=400, detail='Email existe déjà')
        raise HTTPException(status_code=400, detail='Erreur de sauvegarde')
    _notify_admin_employee_creation(db, created, creator_role, creator_matricule, background_tasks)
    return _serialize_employee(created, db)


@router.post('/import')
def import_employees(
    request: Request,
    file: UploadFile = File(...),
    table: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Import employes depuis CSV/XLSX/XLS/Access (admin)."""
    _check_admin_role(request)

    df, resolved_table = _read_import_dataframe(file, table)
    if df.empty:
        raise HTTPException(status_code=400, detail='Aucune ligne à importer')

    total = len(df.index)
    imported = 0
    errors = []

    for idx, row in enumerate(df.to_dict(orient='records'), start=2):
        normalized = _normalize_import_row(row)
        try:
            payload = schemas.EmployeBase.model_validate(normalized)
            data = _prepare_employee_payload(payload, db)
            if not data.get('date_embauche'):
                raise HTTPException(status_code=400, detail="Date d'embauche requise")
            if not data.get('id_entite'):
                raise HTTPException(status_code=400, detail='Entité requise')
            if not data.get('matricule'):
                raise HTTPException(status_code=400, detail='Matricule requis')
            if crud.get_employe(db, data.get('matricule')):
                raise HTTPException(status_code=400, detail='Matricule existe')

            crud.create_employe(db, data)
            imported += 1
        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                detail = exc.detail
            elif isinstance(exc, IntegrityError):
                detail = 'Contrainte BD violée (email/matricule déjà existant)'
            else:
                detail = str(exc)
            errors.append({'line': idx, 'error': detail})

    return {
        'file': file.filename,
        'table': resolved_table,
        'total_rows': total,
        'imported_rows': imported,
        'failed_rows': len(errors),
        'errors': errors,
    }


@router.get('/export')
def export_employees(
    request: Request,
    format: str = Query('csv', pattern='^(csv|xlsx|xls)$'),
    db: Session = Depends(get_db)
):
    """Export complet de la liste des employes (admin)."""
    _check_admin_role(request)

    rows = _employee_export_rows(db)
    if format == 'csv':
        columns = [
            'matricule', 'nom', 'prenom', 'email', 'date_naissance', 'sexe', 'telephone',
            'fonction', 'departement', 'direction', 'entite', 'role', 'pays', 'ville', 'id_localisation', 'diplome', 'contact_urgence',
            'date_embauche', 'solde_conges', 'categorie', 'annee_experience', 'statut_employe', 'n1',
            'statut_matrimonial', 'nombre_enfants'
        ]
        df = pd.DataFrame(rows, columns=columns)
        payload = df.to_csv(index=False).encode('utf-8')
        return StreamingResponse(
            BytesIO(payload),
            media_type='text/csv',
            headers={'Content-Disposition': 'attachment; filename=employees_export.csv'}
        )

    df = pd.DataFrame(rows)
    stream = BytesIO()
    if format == 'xlsx':
        with pd.ExcelWriter(stream, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='employees')
        filename = 'employees_export.xlsx'
    else:
        with pd.ExcelWriter(stream, engine='xlwt') as writer:
            df.to_excel(writer, index=False, sheet_name='employees')
        filename = 'employees_export.xls'

    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type='application/vnd.ms-excel',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@router.get('/{matricule}', response_model=schemas.EmployeOut)
def get_employee(matricule: str, db: Session = Depends(get_db)):
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Non trouvé')
    return _serialize_employee(e, db)


@router.put('/{matricule}', response_model=schemas.EmployeOut)
def update_employee(matricule: str, payload: schemas.EmployeBase, db: Session = Depends(get_db)):
    data = _prepare_employee_payload(payload, db)
    e = crud.update_employe(db, matricule, data)
    if not e:
        raise HTTPException(status_code=404, detail='Non trouvé')
    return _serialize_employee(e, db)


@router.post('/{matricule}/photo')
async def upload_photo(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Upload or update profile photo for an employee (base64 or multipart)."""
    import base64, os, uuid
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')
    content_type = request.headers.get('content-type', '')
    upload_dir = '/app/uploads/photos'
    os.makedirs(upload_dir, exist_ok=True)
    if 'multipart' in content_type:
        from fastapi import File, UploadFile
        form = await request.form()
        file = form.get('photo')
        if not file:
            raise HTTPException(status_code=400, detail='Champ photo manquant')
        ext = (file.filename or 'jpg').rsplit('.', 1)[-1].lower()
        if ext not in {'jpg', 'jpeg', 'png', 'webp', 'gif'}:
            raise HTTPException(status_code=400, detail='Format non supporté')
        filename = f"{matricule}_{uuid.uuid4().hex[:8]}.{ext}"
        path = os.path.join(upload_dir, filename)
        contents = await file.read()
        try:
            from PIL import Image, ImageOps
            from io import BytesIO as _BytesIO
            _img = Image.open(_BytesIO(contents))
            # Vérifier l'orientation EXIF (tag 274) — ne recompresser que si rotation nécessaire
            _exif = _img.getexif() if hasattr(_img, 'getexif') else {}
            _orientation = (_exif.get(274, 1) if _exif else 1)
            if _orientation != 1:
                _img = ImageOps.exif_transpose(_img)
                _buf = _BytesIO()
                _fmt = 'JPEG' if ext in {'jpg', 'jpeg'} else ext.upper()
                if _fmt == 'JPEG':
                    _kwargs = {'quality': 100, 'subsampling': 0, 'optimize': False}
                elif _fmt == 'PNG':
                    _kwargs = {'compress_level': 0}
                else:
                    _kwargs = {}
                _img.save(_buf, format=_fmt, **_kwargs)
                contents = _buf.getvalue()
            # orientation == 1 : conserver les octets originaux (zéro recompression)
        except Exception:
            pass  # conserver les octets originaux si Pillow échoue
        with open(path, 'wb') as fp:
            fp.write(contents)
        e.photo_url = f'/uploads/photos/{filename}'
    else:
        body = await request.json()
        data_url = body.get('photo_url', '')
        if data_url.startswith('data:image'):
            header, b64 = data_url.split(',', 1)
            ext = header.split(';')[0].split('/')[-1]
            if ext not in {'jpg', 'jpeg', 'png', 'webp', 'gif'}:
                ext = 'jpg'
            filename = f"{matricule}_{uuid.uuid4().hex[:8]}.{ext}"
            path = os.path.join(upload_dir, filename)
            raw = base64.b64decode(b64)
            try:
                from PIL import Image, ImageOps
                from io import BytesIO as _BytesIO
                _img = Image.open(_BytesIO(raw))
                # Vérifier l'orientation EXIF (tag 274) — ne recompresser que si rotation nécessaire
                _exif = _img.getexif() if hasattr(_img, 'getexif') else {}
                _orientation = (_exif.get(274, 1) if _exif else 1)
                if _orientation != 1:
                    _img = ImageOps.exif_transpose(_img)
                    _buf = _BytesIO()
                    _fmt = 'JPEG' if ext in {'jpg', 'jpeg'} else ext.upper()
                    if _fmt == 'JPEG':
                        _kwargs = {'quality': 100, 'subsampling': 0, 'optimize': False}
                    elif _fmt == 'PNG':
                        _kwargs = {'compress_level': 0}
                    else:
                        _kwargs = {}
                    _img.save(_buf, format=_fmt, **_kwargs)
                    raw = _buf.getvalue()
                # orientation == 1 : conserver les octets originaux (zéro recompression)
            except Exception:
                pass
            with open(path, 'wb') as fp:
                fp.write(raw)
            e.photo_url = f'/uploads/photos/{filename}'
        else:
            e.photo_url = data_url
    db.commit()
    db.refresh(e)
    return {'photo_url': e.photo_url}


@router.delete('/{matricule}/photo')
def delete_photo(matricule: str, db: Session = Depends(get_db)):
    """Remove profile photo."""
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')
    e.photo_url = None
    db.commit()
    return {'photo_url': None}



def get_sexe_options():
    """Options pour le champ sexe (auto-complétion)"""
    return [
        {"value": "M", "label": "Masculin"},
        {"value": "F", "label": "Féminin"},
        {"value": "Autre", "label": "Autre"}
    ]


@router.get('/autocomplete/entites')
def get_entites(db: Session = Depends(get_db)):
    """Liste des entités pour auto-complétion"""
    entites = db.query(models.Entite).all()
    return [
        {"value": e.id_entite, "label": e.nom}
        for e in entites
    ]


@router.get('/autocomplete/departements')
def get_departements(id_direction: int = None, id_entite: int = None, db: Session = Depends(get_db)):
    """Liste des départements pour auto-complétion (filtrable par direction)"""
    query = db.query(models.Departement)
    if id_direction:
        query = query.filter(models.Departement.id_direction == id_direction)
    if id_entite:
        query = query.filter(models.Departement.id_entite == id_entite)
    departements = query.order_by(models.Departement.nom.asc()).all()
    return [
        {"value": d.dept_id, "label": d.nom, "id_direction": d.id_direction, "id_entite": d.id_entite}
        for d in departements
    ]


@router.get('/autocomplete/directions')
def get_directions(id_entite: int = None, db: Session = Depends(get_db)):
    """Liste des directions pour auto-complétion (filtrable par entité)"""
    query = db.query(models.Direction)
    if id_entite:
        query = query.filter(models.Direction.id_entite == id_entite)
    directions = query.order_by(models.Direction.nom.asc()).all()
    return [
        {"value": d.id_direction, "label": d.nom, "id_entite": d.id_entite}
        for d in directions
    ]


@router.get('/autocomplete/categories')
def get_categories(db: Session = Depends(get_db)):
    """Liste des catégories d'employés pour auto-complétion"""
    # Récupérer toutes les catégories uniques
    categories = db.query(models.Employe.categorie).distinct().filter(
        models.Employe.categorie.isnot(None)
    ).all()
    return [
        {"value": c[0], "label": c[0]}
        for c in categories
    ]


@router.get('/autocomplete/n1-fonctions')
def get_n1_fonctions(db: Session = Depends(get_db)):
    """Liste des fonctions distinctes avec leur titulaire actif, pour le champ N+1."""
    rows = (
        db.query(
            models.Employe.fonction,
            models.Employe.matricule,
            models.Employe.nom,
            models.Employe.prenom
        )
        .filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
            models.Employe.fonction.isnot(None)
        )
        .order_by(models.Employe.fonction)
        .all()
    )
    seen: dict = {}
    for r in rows:
        if r.fonction and r.fonction.strip() and r.fonction not in seen:
            seen[r.fonction] = {
                'fonction': r.fonction,
                'matricule': r.matricule,
                'nom': r.nom,
                'prenom': r.prenom,
            }
    return list(seen.values())


@router.get('/autocomplete/fonctions')
def get_fonctions(dept_id: int = None, db: Session = Depends(get_db)):
    """Liste des fonctions pour auto-complétion.

    Source prioritaire: table de référence FONCTION_REFERENCE.
    Fallback: fonctions distinctes déjà présentes dans EMPLOYE.
    """
    _seed_default_fonctions(db)
    role_names = _role_names_set(db)

    if dept_id:
        fonctions_dept = db.query(models.Employe.fonction).filter(
            models.Employe.dept_id == dept_id,
            models.Employe.fonction.isnot(None),
            func.length(func.trim(models.Employe.fonction)) > 0
        ).distinct().order_by(models.Employe.fonction.asc()).all()
        if fonctions_dept:
            return [
                {"value": f[0], "label": f[0]}
                for f in fonctions_dept
                if f and f[0] and str(f[0]).strip().lower() not in role_names
            ]

    fonctions_ref = db.query(models.FonctionReference.libelle).order_by(models.FonctionReference.libelle.asc()).all()

    if fonctions_ref:
        return [
            {"value": f[0], "label": f[0]}
            for f in fonctions_ref
            if f and f[0] and str(f[0]).strip().lower() not in role_names
        ]

    fonctions = db.query(models.Employe.fonction).distinct().filter(
        models.Employe.fonction.isnot(None),
        func.length(func.trim(models.Employe.fonction)) > 0
    ).all()
    return [
        {"value": f[0], "label": f[0]}
        for f in fonctions
    ]


@router.post('/admin/fonctions-reference')
def create_fonction_reference(payload: schemas.FonctionReferenceCreate, request: Request, db: Session = Depends(get_db)):
    """Ajoute une fonction dans la table de référence (Admin seulement)."""
    _check_admin_role(request)

    libelle = payload.libelle.strip()
    if not libelle:
        raise HTTPException(status_code=400, detail='Libellé vide')

    if libelle.lower() in _role_names_set(db):
        raise HTTPException(status_code=400, detail='Ce libellé correspond à un rôle, pas à une fonction')

    existing = db.query(models.FonctionReference).filter(
        func.lower(models.FonctionReference.libelle) == libelle.lower()
    ).first()
    if existing:
        return {"id_fonction": existing.id_fonction, "libelle": existing.libelle, "created": False}

    created = models.FonctionReference(libelle=libelle, id_direction=payload.id_direction, dept_id=payload.dept_id)
    db.add(created)
    db.commit()
    db.refresh(created)
    return {"id_fonction": created.id_fonction, "libelle": created.libelle, "id_direction": created.id_direction, "dept_id": created.dept_id, "created": True}


@router.get('/admin/fonctions-reference')
def list_fonctions_reference(request: Request, db: Session = Depends(get_db)):
    """Liste des fonctions de référence (tous rôles authentifiés)."""
    _check_authenticated(request)
    _seed_default_fonctions(db)
    role_names = _role_names_set(db)

    # Build direction/dept lookup maps
    directions = {d.id_direction: d.nom for d in db.query(models.Direction).all()}
    departements = {d.dept_id: d.nom for d in db.query(models.Departement).all()}

    fonctions = db.query(models.FonctionReference).order_by(models.FonctionReference.libelle.asc()).all()
    return [
        {
            "id_fonction": f.id_fonction,
            "libelle": f.libelle,
            "id_direction": f.id_direction,
            "dept_id": f.dept_id,
            "direction_nom": directions.get(f.id_direction) if f.id_direction else None,
            "dept_nom": departements.get(f.dept_id) if f.dept_id else None,
        }
        for f in fonctions
        if str(f.libelle or '').strip().lower() not in role_names
    ]


@router.put('/admin/fonctions-reference/{id_fonction}')
def update_fonction_reference(id_fonction: int, payload: schemas.FonctionReferenceCreate, request: Request, db: Session = Depends(get_db)):
    """Met à jour une fonction de référence (Admin seulement)."""
    _check_admin_role(request)

    current = db.query(models.FonctionReference).filter(models.FonctionReference.id_fonction == id_fonction).first()
    if not current:
        raise HTTPException(status_code=404, detail='Fonction introuvable')

    libelle = payload.libelle.strip()
    if not libelle:
        raise HTTPException(status_code=400, detail='Libellé vide')

    if libelle.lower() in _role_names_set(db):
        raise HTTPException(status_code=400, detail='Ce libellé correspond à un rôle, pas à une fonction')

    existing = db.query(models.FonctionReference).filter(
        func.lower(models.FonctionReference.libelle) == libelle.lower(),
        models.FonctionReference.id_fonction != id_fonction
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Cette fonction existe déjà')

    current.libelle = libelle
    current.id_direction = payload.id_direction
    current.dept_id = payload.dept_id
    db.commit()
    db.refresh(current)
    return {"id_fonction": current.id_fonction, "libelle": current.libelle, "id_direction": current.id_direction, "dept_id": current.dept_id, "updated": True}


@router.delete('/admin/fonctions-reference/{id_fonction}')
def delete_fonction_reference(id_fonction: int, request: Request, db: Session = Depends(get_db)):
    """Supprime une fonction de référence (Admin seulement).

    La suppression est bloquée si des employés utilisent encore ce libellé.
    """
    _check_admin_role(request)

    current = db.query(models.FonctionReference).filter(models.FonctionReference.id_fonction == id_fonction).first()
    if not current:
        raise HTTPException(status_code=404, detail='Fonction introuvable')

    usage_count = db.query(models.Employe).filter(
        models.Employe.fonction.isnot(None),
        func.lower(func.trim(models.Employe.fonction)) == current.libelle.lower()
    ).count()

    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f'Suppression impossible: {usage_count} employe(s) utilisent encore cette fonction'
        )

    db.delete(current)
    db.commit()
    return {"deleted": True, "id_fonction": id_fonction}


@router.get('/autocomplete/diplomes')
def get_diplomes(db: Session = Depends(get_db)):
    """Liste des diplômes pour auto-complétion"""
    STANDARD_DIPLOMES = [
        'BEPC', 'CAP', 'BEP', 'BAC', 'BAC Général', 'BAC PRO', 'BAC Technique',
        'BTS', 'HND', 'DUT', 'DEUG',
        'Licence', 'Licence Pro', 'Bachelor',
        'Maîtrise', 'Master 1', 'Master 2', 'Master', 'MBA',
        'DEA', 'DESS', 'Ingénieur', 'Grande École',
        'Doctorat', 'DBA', 'Habilitation à Diriger des Recherches',
    ]
    diplomes_db = db.query(models.Employe.diplome).distinct().filter(
        models.Employe.diplome.isnot(None),
        models.Employe.diplome != ''
    ).all()
    db_values = {d[0] for d in diplomes_db}
    all_diplomes = sorted({*STANDARD_DIPLOMES, *db_values})
    return [
        {"value": d, "label": d}
        for d in all_diplomes
    ]


@router.get('/autocomplete/statuts')
def get_statuts():
    """Options pour le statut d'employé"""
    return [
        {"value": "ACTIF", "label": "Actif"},
        {"value": "CONGEDIE", "label": "Congédié"},
        {"value": "SUSPENDU", "label": "Suspendu"}
    ]


@router.get('/autocomplete/categories')
def get_categories_enum():
    """Options pour les catégories d'employés (Convention Collective CM)"""
    return [
        {"value": "Cadre supérieur", "label": "Cadre supérieur"},
        {"value": "Cadre moyen", "label": "Cadre moyen"},
        {"value": "Agent de maîtrise", "label": "Agent de maîtrise"},
        {"value": "Agent qualifié", "label": "Agent qualifié"},
        {"value": "Agent non qualifié", "label": "Agent non qualifié"},
        {"value": "Apprenti", "label": "Apprenti"},
        {"value": "Stagiaire", "label": "Stagiaire"}
    ]


@router.get('/autocomplete/villes')
def get_villes_autocomplete(q: str = '', id_pays: Optional[int] = None, db: Session = Depends(get_db)):
    """Search cities from database for autocomplete"""
    query = db.query(models.Localisation)
    if id_pays:
        query = query.filter(models.Localisation.id_pays == id_pays)
    if q:
        query = query.filter(models.Localisation.ville.like(f'%{q}%'))
    villes = query.order_by(models.Localisation.ville.asc()).limit(20).all()
    return [
        {'value': v.ville, 'label': v.ville, 'id_localisation': v.id_localisation, 'id_pays': v.id_pays}
        for v in villes
    ]


@router.get('/autocomplete/pays')
def get_pays_autocomplete(q: str = '', db: Session = Depends(get_db)):
    query = db.query(models.Pays)
    if q:
        q_norm = str(q).strip().lower()
        query = query.filter(
            (func.lower(models.Pays.nom_pays).like(f'%{q_norm}%')) |
            (func.lower(models.Pays.code_pays).like(f'%{q_norm}%'))
        )
    rows = query.order_by(models.Pays.nom_pays.asc()).limit(30).all()
    return [
        {'value': p.id_pays, 'label': p.nom_pays, 'code_pays': p.code_pays}
        for p in rows
    ]


@router.post('/create-entite')
def create_entite(nom: str, request: Request, id_localisation: int = None, db: Session = Depends(get_db)):
    """Créer une nouvelle entité (Admin seulement)"""
    _check_admin_role(request)
    existing = db.query(models.Entite).filter(models.Entite.nom == nom).first()
    if existing:
        raise HTTPException(status_code=400, detail='Entité existe déjà')
    entite = models.Entite(nom=nom)
    db.add(entite)
    db.commit()
    db.refresh(entite)
    
    # Si localisation est spécifiée, créer l'implantation
    if id_localisation:
        localisation = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
        if localisation:
            implantation = models.Implantation(id_localisation=id_localisation, id_entite=entite.id_entite)
            db.add(implantation)
            db.commit()
    
    return entite


@router.post('/create-direction')
def create_direction(nom: str, id_entite: int, request: Request, id_localisation: int = None, cree_par: int = None, db: Session = Depends(get_db)):
    """Créer une nouvelle direction (Admin seulement)"""
    _check_admin_role(request)
    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=400, detail='Entité invalide')
    direction = models.Direction(nom=nom, id_entite=id_entite, id_directeur=cree_par)
    db.add(direction)
    db.commit()
    db.refresh(direction)
    return direction


@router.post('/create-departement')
def create_departement(nom: str, id_entite: int, request: Request, id_direction: int = None, cree_par: int = None, db: Session = Depends(get_db)):
    """Créer un nouveau département (Admin seulement)"""
    _check_admin_role(request)
    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=400, detail='Entité invalide')
    dept = models.Departement(nom=nom, id_entite=id_entite, id_direction=id_direction, id_responsable=cree_par)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get('/admin/entites-structure')
def get_entites_structure(request: Request, db: Session = Depends(get_db)):
    """Récupère toutes les entités avec leurs directions et départements (tous rôles authentifiés)"""
    _check_authenticated(request)
    entites = db.query(models.Entite).all()
    result = []
    for entite in entites:
        directions = db.query(models.Direction).filter(models.Direction.id_entite == entite.id_entite).all()
        departements = db.query(models.Departement).filter(models.Departement.id_entite == entite.id_entite).all()
        dept_by_direction = {}
        for d in departements:
            if d.id_direction is None:
                continue
            dept_by_direction[d.id_direction] = dept_by_direction.get(d.id_direction, 0) + 1
        result.append({
            'id_entite': entite.id_entite,
            'nom': entite.nom,
            'directions_count': len(directions),
            'departements_count': len(departements),
            'directions': [
                {
                    'id_direction': d.id_direction,
                    'nom': d.nom,
                    'departements_count': dept_by_direction.get(d.id_direction, 0)
                }
                for d in directions
            ],
            'departements': [{'dept_id': d.dept_id, 'nom': d.nom, 'id_direction': d.id_direction} for d in departements]
        })
    return result


@router.get('/admin/directions-structure')
def get_directions_structure(request: Request, db: Session = Depends(get_db)):
    """Récupère toutes les directions avec leurs départements (tous rôles authentifiés)"""
    _check_authenticated(request)
    directions = db.query(models.Direction).all()
    result = []
    for direction in directions:
        departements = db.query(models.Departement).filter(models.Departement.id_direction == direction.id_direction).all()
        entite = db.query(models.Entite).filter(models.Entite.id_entite == direction.id_entite).first()
        result.append({
            'id_direction': direction.id_direction,
            'nom': direction.nom,
            'id_entite': direction.id_entite,
            'entite_nom': entite.nom if entite else 'N/A',
            'departements_count': len(departements),
            'departements': [{'dept_id': d.dept_id, 'nom': d.nom} for d in departements]
        })
    return result


@router.get('/admin/departements')
def get_departements(request: Request, db: Session = Depends(get_db)):
    """Récupère tous les départements (tous rôles authentifiés)"""
    _check_authenticated(request)
    departements = db.query(models.Departement).all()
    result = []
    for dept in departements:
        entite = db.query(models.Entite).filter(models.Entite.id_entite == dept.id_entite).first()
        direction = db.query(models.Direction).filter(models.Direction.id_direction == dept.id_direction).first() if dept.id_direction else None
        result.append({
            'dept_id': dept.dept_id,
            'nom': dept.nom,
            'id_entite': dept.id_entite,
            'entite_nom': entite.nom if entite else 'N/A',
            'id_direction': dept.id_direction,
            'direction_nom': direction.nom if direction else 'N/A'
        })
    return result


class UtilisateurAdminUpdate(BaseModel):
    role: Optional[str] = None
    active: Optional[bool] = None
    mfa_enabled: Optional[bool] = None


class UtilisateurResetPassword(BaseModel):
    new_password: Optional[str] = None


class UtilisateurCreerCompte(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None


def _serialize_utilisateur_admin(utilisateur: models.Utilisateur, db: Session):
    employe = db.query(models.Employe).filter(models.Employe.matricule == utilisateur.matricule).first()
    role = db.query(models.Role).filter(models.Role.id == utilisateur.role_id).first() if utilisateur.role_id else None
    est_actif = not (utilisateur.bloque_jusqua and utilisateur.bloque_jusqua > datetime.utcnow())

    return {
        'matricule': utilisateur.matricule,
        'nom': employe.nom if employe else None,
        'prenom': employe.prenom if employe else None,
        'email': utilisateur.email or (employe.email if employe else None),
        'role': role.name if role else None,
        'statut_employe': str(employe.statut_employe) if employe and employe.statut_employe is not None else None,
        'mfa_enabled': bool(getattr(utilisateur, 'mfa_enabled', False) or getattr(utilisateur, 'mfa_active', False)),
        'mot_de_passe_temporaire': bool(utilisateur.mot_de_passe_temporaire),
        'tentatives_echec': int(utilisateur.tentatives_echec or 0),
        'bloque_jusqua': utilisateur.bloque_jusqua.isoformat() if utilisateur.bloque_jusqua else None,
        'active': est_actif,
    }


@router.get('/admin/utilisateurs')
def get_admin_utilisateurs(request: Request, db: Session = Depends(get_db)):
    """Lister les comptes utilisateurs (admin seulement)."""
    _check_admin_role(request)

    utilisateurs = db.query(models.Utilisateur).order_by(models.Utilisateur.matricule.asc()).all()
    return [_serialize_utilisateur_admin(u, db) for u in utilisateurs]


@router.put('/admin/utilisateurs/{matricule}')
def update_admin_utilisateur(
    matricule: int,
    payload: UtilisateurAdminUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Mettre a jour un compte utilisateur (role, activation, MFA)."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not utilisateur:
        raise HTTPException(status_code=404, detail='Utilisateur non trouve')

    if payload.role is not None:
        role_name = str(payload.role).strip().upper()
        role = db.query(models.Role).filter(func.upper(models.Role.name) == role_name).first()
        if not role:
            raise HTTPException(status_code=400, detail='Role inconnu')
        utilisateur.role_id = role.id

    if payload.active is not None:
        if payload.active:
            utilisateur.bloque_jusqua = None
            utilisateur.tentatives_echec = 0
        else:
            utilisateur.bloque_jusqua = datetime.utcnow() + timedelta(days=3650)

    if payload.mfa_enabled is not None:
        utilisateur.mfa_enabled = bool(payload.mfa_enabled)
        if hasattr(utilisateur, 'mfa_active'):
            utilisateur.mfa_active = bool(payload.mfa_enabled)

    db.add(models.AuditLog(
        actor=str(actor_matricule),
        action='USER_ACCOUNT_UPDATE',
        entity='UTILISATEUR',
        entity_id=str(matricule),
        detail=f"role_admin={actor_role}; updates={payload.model_dump(exclude_none=True)}"
    ))

    db.commit()
    db.refresh(utilisateur)
    return _serialize_utilisateur_admin(utilisateur, db)


@router.post('/admin/utilisateurs/{matricule}/reset-password-temp')
def reset_admin_utilisateur_password(
    matricule: int,
    payload: UtilisateurResetPassword,
    request: Request,
    db: Session = Depends(get_db)
):
    """Reinitialiser le mot de passe avec flag temporaire pour forcer le changement au prochain login."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not utilisateur:
        raise HTTPException(status_code=404, detail='Utilisateur non trouve')

    mot_de_passe_temp = (payload.new_password or '').strip() or f"EMS@{matricule}!Reset1"
    ok, msg = security.validate_password_policy(mot_de_passe_temp)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    utilisateur.mot_de_passe_hash = security.hash_password(mot_de_passe_temp)
    utilisateur.mot_de_passe_temporaire = True
    utilisateur.date_changement_mdp = datetime.utcnow()
    utilisateur.tentatives_echec = 0
    utilisateur.bloque_jusqua = None

    db.add(models.AuditLog(
        actor=str(actor_matricule),
        action='USER_PASSWORD_TEMP_RESET',
        entity='UTILISATEUR',
        entity_id=str(matricule),
        detail=f"role_admin={actor_role}; reset_temp_password=true"
    ))

    db.commit()

    return {
        'ok': True,
        'matricule': matricule,
        'mot_de_passe_temporaire': mot_de_passe_temp,
        'message': 'Mot de passe temporaire reinitialise',
    }


@router.get('/admin/employes-sans-compte')
def get_employes_sans_compte(request: Request, db: Session = Depends(get_db)):
    """Lister les employes qui n'ont pas encore de compte utilisateur."""
    _check_admin_role(request)
    employes = db.query(models.Employe).outerjoin(
        models.Utilisateur, models.Employe.matricule == models.Utilisateur.matricule
    ).filter(models.Utilisateur.matricule.is_(None)).order_by(models.Employe.matricule.asc()).all()
    return [{'matricule': e.matricule, 'nom': e.nom, 'prenom': e.prenom, 'email': e.email, 'fonction': e.fonction, 'dept_id': e.dept_id} for e in employes]


@router.post('/admin/utilisateurs/{matricule}/creer-compte')
def creer_compte_utilisateur(
    matricule: int,
    payload: UtilisateurCreerCompte,
    request: Request,
    db: Session = Depends(get_db)
):
    """Creer un compte applicatif pour un employe qui n'en a pas encore."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail='Employe introuvable')

    existant = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if existant:
        raise HTTPException(status_code=409, detail='Cet employe a deja un compte')

    mot_de_passe = (payload.password or '').strip() or f"EMS@{matricule}!Compte1"
    ok, msg = security.validate_password_policy(mot_de_passe)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    role_obj = None
    if payload.role:
        role_name = str(payload.role).strip().upper()
        role_obj = db.query(models.Role).filter(func.upper(models.Role.name) == role_name).first()
        if not role_obj:
            raise HTTPException(status_code=400, detail='Role inconnu')

    email = (payload.email or '').strip() or (employe.email or None)

    utilisateur = models.Utilisateur(
        matricule=matricule,
        mot_de_passe_hash=security.hash_password(mot_de_passe),
        mot_de_passe_temporaire=True,
        role_id=role_obj.id if role_obj else None,
        email=email,
        tentatives_echec=0,
    )
    db.add(utilisateur)
    db.add(models.AuditLog(
        actor=str(actor_matricule),
        action='USER_ACCOUNT_CREATE',
        entity='UTILISATEUR',
        entity_id=str(matricule),
        detail=f"role_admin={actor_role}; role={payload.role}"
    ))
    db.commit()
    db.refresh(utilisateur)

    return {'ok': True, 'matricule': matricule, 'mot_de_passe_temporaire': mot_de_passe, 'message': 'Compte cree avec succes'}


@router.get('/info-utilisateur/{login}')
def get_user_info_by_login(login: str, db: Session = Depends(get_db)):
    """
    Obtenir le matricule et les infos d'un employé à partir de son login.
    Utilisé pour auto-remplir le matricule dans le formulaire.
    """
    utilisateur = db.query(models.Utilisateur).join(
        models.Employe
    ).filter(models.Utilisateur.email == login).first()
    
    if not utilisateur or not utilisateur.employe:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    employe = utilisateur.employe
    
    return {
        "matricule": employe.matricule,
        "nom": employe.nom,
        "prenom": employe.prenom,
        "email": employe.email,
        "solde_conges": float(employe.solde_conges or 0),
        "annee_experience": employe.annee_experience,
        "date_embauche": employe.date_embauche
    }

# ===== ENDPOINTS STATISTIQUES D'UTILISATION =====

from fastapi import Response
import logging
@router.post('/sessions/login')
async def record_session_login(request: Request, db: Session = Depends(get_db)):
    """Enregistrer le login d'un utilisateur (debug CORS/422)"""
    try:
        data = await request.json()
    except Exception:
        data = await request.body()
    logging.warning(f"/sessions/login received: {data}")
    matricule = None
    if isinstance(data, dict):
        matricule = data.get('matricule')
    elif isinstance(data, (bytes, str)):
        import json
        try:
            data_dict = json.loads(data)
            matricule = data_dict.get('matricule')
        except Exception:
            pass
    if not matricule:
        resp = Response(content='{"detail": "matricule manquant"}', status_code=422, media_type="application/json")
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get('user-agent', '')
    session = models.SessionUtilisation(
        matricule=matricule,
        date_connexion=datetime.utcnow(),
        ip_adresse=ip_address,
        user_agent=user_agent
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    resp = Response(content=f'{{"id_session": {session.id_session}, "status": "logged_in"}}', media_type="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@router.put('/sessions/{id_session}/logout')
def record_session_logout(id_session: int, db: Session = Depends(get_db)):
    """Enregistrer le logout d'un utilisateur"""
    session = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.id_session == id_session
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail='Session non trouvée')
    
    session.date_deconnexion = datetime.utcnow()
    duration = (session.date_deconnexion - session.date_connexion).total_seconds() / 60
    session.duree_minutes = int(duration)
    db.commit()
    return {'status': 'logged_out', 'duree_minutes': session.duree_minutes}


@router.get('/stats/usage/{matricule}/today')
def get_usage_today(matricule: int, request: Request, db: Session = Depends(get_db)):
    """Statistiques d'utilisation du jour"""
    _check_admin_role(request)
    
    today = datetime.utcnow().date()
    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) == today,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    
    total_minutes = sum(s.duree_minutes or 0 for s in sessions)
    return {
        'date': today.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'sessions_count': len(sessions)
    }


@router.get('/stats/usage/{matricule}/week')
def get_usage_week(matricule: int, request: Request, db: Session = Depends(get_db)):
    """Statistiques d'utilisation de la semaine"""
    _check_admin_role(request)
    
    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    
    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) >= week_start,
        func.date(models.SessionUtilisation.date_connexion) <= today,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    
    # Group by day
    daily_data = {}
    for session in sessions:
        day = session.date_connexion.date()
        if day not in daily_data:
            daily_data[day] = 0
        daily_data[day] += session.duree_minutes or 0
    
    total_minutes = sum(daily_data.values())
    return {
        'week_start': week_start.isoformat(),
        'week_end': today.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'daily_breakdown': {str(k): v for k, v in daily_data.items()},
        'sessions_count': len(sessions)
    }


@router.get('/stats/usage/{matricule}/month')
def get_usage_month(matricule: int, month: int = None, year: int = None, request: Request = None, db: Session = Depends(get_db)):
    """Statistiques d'utilisation du mois"""
    if request:
        _check_admin_role(request)
    
    today = datetime.utcnow().date()
    if month is None:
        month = today.month
    if year is None:
        year = today.year
    
    # Get first and last day of month
    first_day = datetime(year, month, 1).date()
    if month == 12:
        last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)
    
    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) >= first_day,
        func.date(models.SessionUtilisation.date_connexion) <= last_day,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    
    # Group by day
    daily_data = {}
    for session in sessions:
        day = session.date_connexion.date()
        if day not in daily_data:
            daily_data[day] = 0
        daily_data[day] += session.duree_minutes or 0
    
    total_minutes = sum(daily_data.values())
    return {
        'month': month,
        'year': year,
        'month_start': first_day.isoformat(),
        'month_end': last_day.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'daily_breakdown': {str(k): v for k, v in daily_data.items()},
        'sessions_count': len(sessions)
    }


@router.get('/stats/usage/{matricule}/year')
def get_usage_year(matricule: int, year: int = None, request: Request = None, db: Session = Depends(get_db)):
    """Statistiques d'utilisation de l'année"""
    if request:
        _check_admin_role(request)
    
    today = datetime.utcnow().date()
    if year is None:
        year = today.year
    
    first_day = datetime(year, 1, 1).date()
    last_day = datetime(year, 12, 31).date()
    
    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) >= first_day,
        func.date(models.SessionUtilisation.date_connexion) <= last_day,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    
    # Group by month
    monthly_data = {}
    for session in sessions:
        month = session.date_connexion.month
        if month not in monthly_data:
            monthly_data[month] = 0
        monthly_data[month] += session.duree_minutes or 0
    
    total_minutes = sum(monthly_data.values())
    return {
        'year': year,
        'year_start': first_day.isoformat(),
        'year_end': last_day.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'monthly_breakdown': {str(k): v for k, v in monthly_data.items()},
        'sessions_count': len(sessions)
    }


@router.get('/stats/usage/all/summary')
def get_usage_summary(request: Request, db: Session = Depends(get_db)):
    """Statistiques globales pour tous les utilisateurs (Admin seulement)"""
    _check_admin_role(request)
    
    today = datetime.utcnow().date()
    
    # Today
    today_sessions = db.query(models.SessionUtilisation).filter(
        func.date(models.SessionUtilisation.date_connexion) == today,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    today_minutes = sum(s.duree_minutes or 0 for s in today_sessions)
    
    # This week
    week_start = today - timedelta(days=today.weekday())
    week_sessions = db.query(models.SessionUtilisation).filter(
        func.date(models.SessionUtilisation.date_connexion) >= week_start,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    week_minutes = sum(s.duree_minutes or 0 for s in week_sessions)
    
    # This month
    month_start = datetime(today.year, today.month, 1).date()
    month_sessions = db.query(models.SessionUtilisation).filter(
        func.date(models.SessionUtilisation.date_connexion) >= month_start,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    month_minutes = sum(s.duree_minutes or 0 for s in month_sessions)
    
    # This year
    year_start = datetime(today.year, 1, 1).date()
    year_sessions = db.query(models.SessionUtilisation).filter(
        func.date(models.SessionUtilisation.date_connexion) >= year_start,
        models.SessionUtilisation.duree_minutes != None
    ).all()
    year_minutes = sum(s.duree_minutes or 0 for s in year_sessions)
    
    return {
        'today': {
            'minutes': today_minutes,
            'hours': round(today_minutes / 60, 2) if today_minutes > 0 else 0,
            'sessions': len(today_sessions),
            'users': len(set(s.matricule for s in today_sessions))
        },
        'week': {
            'minutes': week_minutes,
            'hours': round(week_minutes / 60, 2) if week_minutes > 0 else 0,
            'sessions': len(week_sessions),
            'users': len(set(s.matricule for s in week_sessions))
        },
        'month': {
            'minutes': month_minutes,
            'hours': round(month_minutes / 60, 2) if month_minutes > 0 else 0,
            'sessions': len(month_sessions),
            'users': len(set(s.matricule for s in month_sessions))
        },
        'year': {
            'minutes': year_minutes,
            'hours': round(year_minutes / 60, 2) if year_minutes > 0 else 0,
            'sessions': len(year_sessions),
            'users': len(set(s.matricule for s in year_sessions))
        }
    }
