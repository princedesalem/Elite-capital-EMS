from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from ..db import get_db, UPLOADS_ROOT
from .. import crud, schemas, models
from ..utils import security
from ..utils.world_data import WORLD_COUNTRIES, WORLD_CITIES
from ..utils.audit import log_action
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from io import BytesIO
import pandas as pd
from ..utils.access_parser import AccessImportError, read_access_dataframe
from ..utils import notifications as notifications_utils
from ..utils import email as email_utils
from ..utils.employee_excel import canonical_import_header, column_keys, workbook_bytes

router = APIRouter(prefix='/employees', tags=['employees'])

DEFAULT_FONCTIONS = [
    'Administrateur Général',
    'PCA',
    'Directeur Audit Interne et Inspection Générale',
    'Inspecteur Général(IG)',
    'Auditeur',
    "Représentants Résidents et responsables de la création et relations d'affaires",
    'Directeur Financier et Comptable(DFC)',
    'Chargé Trésorerie et financement',
    'Contrôleur de gestion',
    'Comptable',
    'Responsable Ressources Humaines',
    'Chargé des Ressources Humaines',
    'Responsable Communication et Relations Publiques',
    'chargé community management accueil et courrier',
    'Infographiste & Déploiement',
    'Responsable Affaires Juridiques & fiscalité',
    'Chargé de la fiscalité',
    'Directeur Organisations et Projets',
    "Responsable Systèmes d'Information",
    'Chargé Organisations et projets',
    'Chargé Marketing digital et Opérationnel',
    'Chargé des Moyens généraux',
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
    creator_matricule: Optional[str],
    background_tasks: Optional[BackgroundTasks],
    force_notify: bool = False,
):
    """Notifie tous les admins de la création d'un employé.
    Appelé lors d'une création manuelle (RH) ou d'un import bulk (force_notify=True).
    """
    role_upper = str(creator_role or '').upper()
    # Notifications : RH créateur ou import forcé. Les admins sont toujours notifiés.
    if role_upper not in {'RH'} and not force_notify:
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
                " Veuillez bien créer un compte d'utilisateur pour cet employé."
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


def _notify_admin_employee_update(
    db: Session,
    before_data: dict,
    after: models.Employe,
    actor_role: str,
    actor_matricule: Optional[str],
):
    """Notifie tous les admins quand le RH modifie le dossier d'un employé.
    before_data doit être un snapshot dict capturé AVANT crud.update_employe
    (car SQLAlchemy met à jour l'objet en mémoire via l'identity map).
    """
    if str(actor_role or '').upper() != 'RH':
        return

    changes = []

    for field, label in [
        ('nom', 'Nom'),
        ('prenom', 'Prénom'),
        ('fonction', 'Fonction'),
        ('email', 'Email'),
        ('telephone', 'Téléphone'),
        ('statut_employe', 'Statut'),
        ('n1_fonction', 'Superviseur N+1'),
        ('diplome', 'Diplôme'),
        ('solde_conges', 'Solde congés'),
    ]:
        v_before = before_data.get(field)
        v_after = getattr(after, field, None)
        if str(v_before or '') != str(v_after or ''):
            changes.append(f"• {label} : {v_before or '–'} → {v_after or '–'}")

    if before_data.get('dept_id') != getattr(after, 'dept_id', None):
        dept_b = db.query(models.Departement).filter(models.Departement.dept_id == before_data.get('dept_id')).first() if before_data.get('dept_id') else None
        dept_a = db.query(models.Departement).filter(models.Departement.dept_id == after.dept_id).first() if after.dept_id else None
        changes.append(f"• Département : {dept_b.nom if dept_b else '–'} → {dept_a.nom if dept_a else '–'}")

    if before_data.get('id_role') != getattr(after, 'id_role', None):
        role_b = db.query(models.Role).filter(models.Role.id == before_data.get('id_role')).first() if before_data.get('id_role') else None
        role_a = db.query(models.Role).filter(models.Role.id == after.id_role).first() if after.id_role else None
        changes.append(f"• Rôle : {role_b.name if role_b else '–'} → {role_a.name if role_a else '–'}")

    if before_data.get('id_entite') != getattr(after, 'id_entite', None):
        ent_b = db.query(models.Entite).filter(models.Entite.id_entite == before_data.get('id_entite')).first() if before_data.get('id_entite') else None
        ent_a = db.query(models.Entite).filter(models.Entite.id_entite == after.id_entite).first() if after.id_entite else None
        changes.append(f"• Entité : {ent_b.nom if ent_b else '–'} → {ent_a.nom if ent_a else '–'}")

    if not changes:
        return

    admin_role_ids = [
        role.id
        for role in db.query(models.Role).all()
        if str(role.name or '').strip().upper() in {'ADMIN', 'ADMINISTRATEUR'}
    ]
    if not admin_role_ids:
        return
    admin_users = db.query(models.Utilisateur).filter(
        models.Utilisateur.role_id.in_(admin_role_ids)
    ).all()
    if not admin_users:
        return

    actor_emp = db.query(models.Employe).filter(
        models.Employe.matricule == actor_matricule
    ).first() if actor_matricule else None
    actor_label = (
        f"{actor_emp.prenom} {actor_emp.nom}" if actor_emp else f"RH {actor_matricule or ''}"
    ).strip()
    emp_label = f"{after.prenom} {after.nom} (matricule {after.matricule})"
    changes_text = '\n'.join(changes)

    for admin in admin_users:
        notifications_utils.creer_notification(
            matricule=admin.matricule,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre='Dossier employé modifié par le RH',
            message=f"{actor_label} (RH) a modifié le dossier de {emp_label} :\n{changes_text}",
            id_operation=None,
            db=db,
        )


def _role_names_set(db: Session):
    return {
        str(r.name or '').strip().lower()
        for r in db.query(models.Role).all()
        if str(r.name or '').strip()
    }


def _seed_default_fonctions(db: Session):
    """Insère les fonctions par défaut UNIQUEMENT si la table est vide (premier démarrage).

    Sinon (table déjà initialisée), n'insère rien : sinon les fonctions
    supprimées par l'admin réapparaîtraient à chaque GET avec un nouvel id.
    """
    if db.query(models.FonctionReference.id_fonction).first() is not None:
        return
    role_names = _role_names_set(db)
    to_create = []
    seen = set()
    for libelle in DEFAULT_FONCTIONS:
        key = str(libelle or '').strip().lower()
        if not key or key in seen or key in role_names:
            continue
        seen.add(key)
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


def _auto_fill_org_head(db: Session, employe: models.Employe) -> None:
    """Quand un employé est créé ou mis à jour avec le rôle DIRECTEUR ou RESPONSABLE,
    remplir automatiquement DIRECTION.id_directeur ou DEPARTEMENT.id_responsable."""
    if not employe.id_role:
        return
    role = db.query(models.Role).filter(models.Role.id == employe.id_role).first()
    if not role:
        return
    role_name = (role.name or '').strip().upper()
    if role_name == 'DIRECTEUR' and employe.id_direction:
        direction = db.query(models.Direction).filter(
            models.Direction.id_direction == employe.id_direction
        ).first()
        if direction:
            direction.id_directeur = employe.matricule
            db.commit()
    elif role_name == 'RESPONSABLE' and employe.dept_id:
        dept = db.query(models.Departement).filter(
            models.Departement.dept_id == employe.dept_id
        ).first()
        if dept:
            dept.id_responsable = employe.matricule
            db.commit()


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
        matricule = str(matricule).strip().upper()
    except Exception:
        raise HTTPException(status_code=401, detail='Token sans matricule valide')

    return matricule, role


def _normalize_sexe_filter(sexe: Optional[str]) -> Optional[str]:
    """Normalise un paramètre `sexe` reçu en query (M/F/Autre)."""
    if sexe is None:
        return None
    raw = str(sexe).strip().lower()
    if not raw:
        return None
    if raw in {'m', 'masculin', 'homme', 'male'}:
        return 'M'
    if raw in {'f', 'féminin', 'feminin', 'femme', 'female'}:
        return 'F'
    if raw in {'a', 'autre', 'other'}:
        return 'Autre'
    return None


def _serialize_employee(e: models.Employe, db: Session, *, viewer_matricule: Optional[str] = None, viewer_role: Optional[str] = None):
    data = schemas.EmployeOut.model_validate(e).model_dump()
    role = db.query(models.Role).filter(models.Role.id == e.id_role).first() if e.id_role else None
    entite = db.query(models.Entite).filter(models.Entite.id_entite == e.id_entite).first() if e.id_entite else None
    direction = db.query(models.Direction).filter(models.Direction.id_direction == e.id_direction).first() if e.id_direction else None
    departement = db.query(models.Departement).filter(models.Departement.dept_id == e.dept_id).first() if e.dept_id else None
    # Priorité: Employe.id_role, sinon Utilisateur.role_id (même table roles)
    if not (role) and e.utilisateur and e.utilisateur.role:
        role = e.utilisateur.role
    data['role'] = role.name if role else None
    data['entite'] = entite.nom if entite else None
    data['direction'] = direction.nom if direction else None
    data['departement'] = departement.nom if departement else None
    data['id_entite'] = e.id_entite
    data['id_direction'] = e.id_direction
    data['dept_id'] = e.dept_id
    data['photo_url'] = e.photo_url
    data['signature_url'] = e.signature_url
    localisation = _resolve_employee_localisation(e, db)
    data['id_localisation'] = localisation.id_localisation if localisation else None
    data['ville'] = localisation.ville if localisation else None
    pays = db.query(models.Pays).filter(models.Pays.id_pays == localisation.id_pays).first() if localisation else None
    data['id_pays'] = pays.id_pays if pays else None
    data['pays'] = pays.nom_pays if pays else None
    data['n1_fonction'] = e.n1_fonction
    # Nom complet du supérieur hiérarchique (pour affichage côté UI sans
    # second appel API). Champ additif, jamais requis par les schémas.
    if e.n1:
        n1_emp = db.query(models.Employe).filter(models.Employe.matricule == e.n1).first()
        data['n1_nom'] = f"{n1_emp.prenom or ''} {n1_emp.nom or ''}".strip() if n1_emp else None
    else:
        data['n1_nom'] = None
    sv = e.statut_employe
    data['statut_employe'] = (sv.value if hasattr(sv, 'value') else str(sv)) if sv else 'ACTIF'

    # D — Salaire confidentiel : visible uniquement par RH/ADMIN, ou par
    # le propriétaire du salaire (chacun voit le sien). Sinon on masque.
    privileged_roles = {'RH', 'ADMIN', 'PCA', 'AG'}
    role_norm = (viewer_role or '').strip().upper()
    is_owner = bool(viewer_matricule) and str(viewer_matricule).strip().upper() == str(e.matricule).strip().upper()
    if role_norm in privileged_roles or is_owner:
        data['salaire_brut'] = float(e.salaire_brut) if e.salaire_brut is not None else None
        data['salaire_devise'] = e.salaire_devise or 'XAF'
    else:
        data['salaire_brut'] = None
        data['salaire_devise'] = None
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
        'statut_employe', 'photo_url', 'signature_url', 'contact_urgence', 'statut_matrimonial', 'nombre_enfants',
        'nouvelle_recrue', 'salaire_brut', 'salaire_devise',
        'type_contrat', 'date_debut_contrat', 'date_fin_contrat',
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
        cleaned['matricule'] = str(cleaned['matricule']).strip().upper()
    if cleaned.get('n1') is not None and cleaned.get('n1') != '':
        cleaned['n1'] = str(cleaned['n1']).strip().upper()
    elif 'n1' in cleaned and not cleaned['n1']:
        cleaned['n1'] = None
    # Resolve n1 from function: find the active holder of n1_fonction
    # Always re-resolve when n1_fonction is provided, even if n1 is already set (handles edits)
    if cleaned.get('n1_fonction'):
        nf = cleaned['n1_fonction'].strip()
        holder = db.query(models.Employe).filter(
            models.Employe.fonction == nf,
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        ).first()
        if holder:
            cleaned['n1'] = holder.matricule
            cleaned['n1_fonction'] = nf
    elif 'n1_fonction' in cleaned and not cleaned.get('n1_fonction'):
        cleaned['n1_fonction'] = None
        cleaned['n1'] = None
    elif cleaned.get('n1'):
        # Si seul `n1` (matricule) est fourni — typiquement depuis l'organigramme —
        # on synchronise automatiquement `n1_fonction` à partir de la fonction
        # de l'employé désigné, pour que les deux colonnes restent cohérentes.
        holder = db.query(models.Employe).filter(
            models.Employe.matricule == cleaned['n1']
        ).first()
        if holder and holder.fonction:
            cleaned['n1_fonction'] = holder.fonction
    # Normalise email : chaîne vide → NULL pour éviter la contrainte UNIQUE sur ''
    if 'email' in cleaned:
        email_val = str(cleaned.get('email') or '').strip()
        cleaned['email'] = email_val if email_val else None

    if cleaned.get('sexe') is not None:
        sexe_raw = str(cleaned.get('sexe') or '').strip().lower()
        if sexe_raw in {'m', 'masculin', 'homme'}:
            cleaned['sexe'] = 'M'
        elif sexe_raw in {'f', 'féminin', 'feminin', 'femme'}:
            cleaned['sexe'] = 'F'
        elif sexe_raw in {'autre', 'other'}:
            cleaned['sexe'] = 'Autre'
        else:
            raise HTTPException(status_code=400, detail="Sexe invalide. Valeurs acceptées : M, F, Autre.")

    if cleaned.get('statut_matrimonial') is not None:
        raw = str(cleaned.get('statut_matrimonial') or '').strip().lower()
        if raw in {'celibataire', 'célibataire', 'c'}:
            cleaned['statut_matrimonial'] = 'Celibataire'
        elif raw in {'marie', 'marié', 'm'}:
            cleaned['statut_matrimonial'] = 'Marie'
        elif raw:
            raise HTTPException(status_code=400, detail='Statut matrimonial invalide (Célibataire ou Marié).')
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
    else:
        # Allow clearing direction
        cleaned['id_direction'] = None

    if departement_input:
        departement = db.query(models.Departement).filter(models.Departement.nom == departement_input).first()
        if not departement and str(departement_input).isdigit():
            departement = db.query(models.Departement).filter(models.Departement.dept_id == int(departement_input)).first()
        if not departement:
            raise HTTPException(status_code=400, detail='Département invalide')
        cleaned['dept_id'] = departement.dept_id
    else:
        # Allow clearing department
        cleaned['dept_id'] = None

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
    result = {}
    for key, value in (raw_row or {}).items():
        mapped = canonical_import_header(key)
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

    def _detect_header_row(sample_df) -> Optional[int]:
        """Cherche dans les 6 premières lignes celle qui ressemble à un en-tête de colonnes."""
        max_rows = min(6, sample_df.shape[0])
        for r in range(max_rows):
            values = sample_df.iloc[r].tolist()
            matched = sum(1 for v in values if canonical_import_header(v))
            if matched >= 3:  # au moins 3 colonnes reconnues = c'est probablement un en-tête
                return r
        return None

    try:
        if filename.endswith('.csv'):
            return pd.read_csv(BytesIO(content), sep=None, engine='python', dtype=str, keep_default_na=False), None
        if filename.endswith('.xlsx'):
            workbook = pd.ExcelFile(BytesIO(content), engine='openpyxl')
            frames = []
            skipped_sheets = []
            for sheet_name in workbook.sheet_names:
                # Skip non-employee sheets (Instructions, Référence, etc.)
                sheet_lower = str(sheet_name).strip().lower()
                if any(skip in sheet_lower for skip in ('instruction', 'référence', 'reference', 'aide', 'help', 'doc')):
                    skipped_sheets.append(sheet_name)
                    continue
                try:
                    preview = pd.read_excel(BytesIO(content), engine='openpyxl', sheet_name=sheet_name, header=None, nrows=6, dtype=str, keep_default_na=False)
                except Exception:
                    skipped_sheets.append(sheet_name)
                    continue
                header_row = _detect_header_row(preview)
                if header_row is None:
                    skipped_sheets.append(sheet_name)
                    continue
                df_sheet = pd.read_excel(BytesIO(content), engine='openpyxl', sheet_name=sheet_name, header=header_row, dtype=str, keep_default_na=False)
                if not df_sheet.empty:
                    frames.append(df_sheet)
            if not frames:
                raise HTTPException(status_code=400, detail="Aucune feuille importable trouvée dans le classeur")
            combined = pd.concat(frames, ignore_index=True, sort=False)
            return combined, None
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
        data = _serialize_employee(e, db, viewer_role='ADMIN')
        row = {key: data.get(key) for key in column_keys()}
        if isinstance(row.get('nouvelle_recrue'), bool):
            row['nouvelle_recrue'] = 'TRUE' if row['nouvelle_recrue'] else 'FALSE'
        rows.append(row)
    return rows


@router.get('/', response_model=list[schemas.EmployeOut])
def list_employees(
    request: Request,
    id_pays: Optional[int] = Query(None),
    id_localisation: Optional[int] = Query(None),
    sexe: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db)
):
    try:
        viewer_mat, viewer_role = _get_token_context(request)
    except Exception:
        viewer_mat, viewer_role = None, None
    q = db.query(models.Employe)
    if not include_deleted:
        q = q.filter(models.Employe.statut_employe != models.StatutEmployeEnum.CONGEDIE)
    sexe_norm = _normalize_sexe_filter(sexe)
    if sexe_norm:
        q = q.filter(models.Employe.sexe == sexe_norm)
    employees = q.all()
    employees = [e for e in employees if _employee_matches_geo_filters(e, db, id_pays, id_localisation)]
    return [_serialize_employee(e, db, viewer_matricule=viewer_mat, viewer_role=viewer_role) for e in employees]


@router.get('/scoped', response_model=list[schemas.EmployeOut])
def list_employees_scoped(
    request: Request,
    id_pays: Optional[int] = Query(None),
    id_localisation: Optional[int] = Query(None),
    sexe: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db)
):
    requester_matricule, requester_role = _get_token_context(request)
    role = str(requester_role or 'EMPLOYE').upper()

    sexe_norm = _normalize_sexe_filter(sexe)

    is_full_access = role in {'RH', 'ADMIN', 'PCA', 'AG'}
    if is_full_access:
        q = db.query(models.Employe)
        if not include_deleted:
            q = q.filter(models.Employe.statut_employe != models.StatutEmployeEnum.CONGEDIE)
        if sexe_norm:
            q = q.filter(models.Employe.sexe == sexe_norm)
        employees = q.all()
        employees = [e for e in employees if _employee_matches_geo_filters(e, db, id_pays, id_localisation)]
        return [_serialize_employee(e, db, viewer_matricule=requester_matricule, viewer_role=role) for e in employees]

    requester = db.query(models.Employe).filter(models.Employe.matricule == requester_matricule).first()
    if not requester:
        raise HTTPException(status_code=404, detail='Employé connecté introuvable')

    query = db.query(models.Employe)
    if not include_deleted:
        query = query.filter(models.Employe.statut_employe != models.StatutEmployeEnum.CONGEDIE)
    if sexe_norm:
        query = query.filter(models.Employe.sexe == sexe_norm)
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
    return [_serialize_employee(e, db, viewer_matricule=requester_matricule, viewer_role=role) for e in employees]


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
            creator_matricule = str(creator_matricule).strip().upper() if creator_matricule is not None else None
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
    _auto_fill_org_head(db, created)
    _notify_admin_employee_creation(db, created, creator_role, creator_matricule, background_tasks)
    log_action(db, creator_matricule, 'EMPLOYEE_CREATED', 'employe', created.matricule, {'nom': data.get('nom'), 'prenom': data.get('prenom')}, ip_address=request.client.host if request.client else None)
    return _serialize_employee(created, db)


@router.post('/import')
def import_employees(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    table: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Import employes depuis CSV/XLSX/XLS/Access (admin)."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    df, resolved_table = _read_import_dataframe(file, table)
    if df.empty:
        raise HTTPException(status_code=400, detail='Aucune ligne à importer')

    total = len(df.index)
    imported = 0
    skipped = 0
    errors = []
    imported_matricules: list[str] = []

    for idx, row in enumerate(df.to_dict(orient='records'), start=2):
        normalized = _normalize_import_row(row)
        # Skip empty rows (no matricule AND no nom)
        if not normalized.get('matricule') and not normalized.get('nom'):
            continue
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
                # Idempotence: l'employé existe déjà → on saute sans erreur
                skipped += 1
                continue

            created_import = crud.create_employe(db, data)
            _auto_fill_org_head(db, created_import)
            imported_matricules.append(str(created_import.matricule))
            # Notifier les admins pour chaque employé créé via import
            _notify_admin_employee_creation(
                db, created_import, actor_role, actor_matricule,
                background_tasks, force_notify=True
            )
            imported += 1
        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                detail = exc.detail
            elif isinstance(exc, IntegrityError):
                # Doublon email/matricule lié à une condition de course : considérer comme skip
                msg = str(getattr(exc, 'orig', exc)).lower()
                if 'email' in msg or 'matricule' in msg or 'duplicate' in msg:
                    skipped += 1
                    continue
                detail = 'Contrainte BD violée'
            else:
                detail = str(exc)
            errors.append({'line': idx, 'error': detail})

    # Notification résumé import (une seule notif globale pour les admins)
    if imported > 0:
        failed_count = len(errors)
        admin_role_ids = [
            role.id for role in db.query(models.Role).all()
            if str(role.name or '').strip().upper() in {'ADMIN', 'ADMINISTRATEUR'}
        ]
        if admin_role_ids:
            admin_users = db.query(models.Utilisateur).filter(
                models.Utilisateur.role_id.in_(admin_role_ids)
            ).all()
            summary_msg = (
                f"Import du fichier « {file.filename} » terminé : "
                f"{imported} employé(s) ajouté(s)"
                + (f", {skipped} existant(s) ignoré(s)" if skipped else "")
                + (f", {failed_count} échec(s)." if failed_count else ".")
            )
            for admin in admin_users:
                notifications_utils.creer_notification(
                    matricule=admin.matricule,
                    type_notification=models.TypeNotificationEnum.AUTRE,
                    titre='Import employés terminé',
                    message=summary_msg,
                    id_operation=None,
                    db=db,
                )

    log_action(
        db, actor_matricule, 'EMPLOYEES_IMPORTED', 'employe', None,
        {'count': imported, 'skipped': skipped, 'failed': len(errors), 'file': file.filename},
        ip_address=request.client.host if request.client else None,
    )

    return {
        'file': file.filename,
        'table': resolved_table,
        'total_rows': total,
        'imported_rows': imported,
        'skipped_rows': skipped,
        'failed_rows': len(errors),
        'errors': errors,
        'imported_matricules': imported_matricules,
    }


class _RollbackImportBody(BaseModel):
    matricules: list[str]


@router.delete('/import/rollback')
def rollback_import(
    request: Request,
    body: _RollbackImportBody,
    db: Session = Depends(get_db),
):
    """Annule un import récent en supprimant les employés créés.

    Seul un admin peut appeler cet endpoint.  La liste des matricules est celle
    renvoyée par POST /import dans le champ ``imported_matricules``.
    """
    _check_admin_role(request)
    actor_matricule, _ = _get_token_context(request)

    deleted_list: list[str] = []
    for mat in body.matricules:
        emp = crud.get_employe(db, mat)
        if emp:
            db.delete(emp)
            deleted_list.append(str(mat))

    db.commit()

    log_action(
        db, actor_matricule, 'EMPLOYEES_IMPORT_ROLLBACK', 'employe', None,
        {'count': len(deleted_list), 'matricules': deleted_list},
    )

    return {'deleted': len(deleted_list), 'matricules': deleted_list}


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
        columns = column_keys()
        df = pd.DataFrame(rows, columns=columns)
        payload = df.to_csv(index=False).encode('utf-8')
        return StreamingResponse(
            BytesIO(payload),
            media_type='text/csv',
            headers={'Content-Disposition': 'attachment; filename=employees_export.csv'}
        )

    if format == 'xlsx':
        stream = workbook_bytes(rows=rows, mode='export')
        filename = 'employees_export.xlsx'
    else:
        stream = BytesIO()
        df = pd.DataFrame(rows, columns=column_keys())
        with pd.ExcelWriter(stream, engine='xlwt') as writer:
            df.to_excel(writer, index=False, sheet_name='employees')
        filename = 'employees_export.xls'

    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type='application/vnd.ms-excel',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@router.get('/autocomplete/employes')
def search_employes_autocomplete(q: str = '', limit: int = 15, db: Session = Depends(get_db)):
    """Recherche d'employés par matricule ou nom pour auto-complétion."""
    term = q.strip()
    query = db.query(models.Employe).filter(
        models.Employe.statut_employe != models.StatutEmployeEnum.CONGEDIE
    )
    if term:
        like = f'%{term}%'
        query = query.filter(
            func.lower(models.Employe.matricule).like(func.lower(like)) |
            func.lower(models.Employe.nom).like(func.lower(like)) |
            func.lower(models.Employe.prenom).like(func.lower(like))
        )
    employes = query.order_by(models.Employe.nom, models.Employe.prenom).limit(limit).all()
    return [
        {
            'matricule': e.matricule,
            'nom': e.nom or '',
            'prenom': e.prenom or '',
            'label': f"{e.matricule} — {(e.nom or '').upper()} {e.prenom or ''}".strip(),
        }
        for e in employes
    ]


_PRESENCE_THRESHOLD_MINUTES = 5  # en ligne si actif dans les 5 dernières minutes


@router.patch('/me/heartbeat', status_code=204)
def heartbeat(
    request: Request,
    db: Session = Depends(get_db),
):
    """Mise à jour de la présence — appelé par le frontend toutes les 30s."""
    try:
        matricule, _ = _get_token_context(request)
    except HTTPException:
        return  # token absent ou invalide → on ignore silencieusement
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if emp:
        now = datetime.utcnow()
        emp.derniere_connexion = now
        # Synchronise aussi Utilisateur.dernier_login
        if emp.utilisateur:
            emp.utilisateur.dernier_login = now
        # Met à jour derniere_activite sur la session ouverte la plus récente
        # (sans date_deconnexion) → permet de calculer la vraie durée d'utilisation
        open_session = (
            db.query(models.SessionUtilisation)
            .filter(
                models.SessionUtilisation.matricule == str(matricule),
                models.SessionUtilisation.date_deconnexion == None,  # noqa: E711
            )
            .order_by(models.SessionUtilisation.date_connexion.desc())
            .first()
        )
        if open_session:
            open_session.derniere_activite = now
        db.commit()


@router.get('/presence')
def get_presence(
    request: Request,
    db: Session = Depends(get_db),
):
    """Retourne la liste de tous les employés actifs avec leur statut de présence."""
    threshold = datetime.utcnow() - timedelta(minutes=_PRESENCE_THRESHOLD_MINUTES)
    employes = (
        db.query(models.Employe)
        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)
        .order_by(
            # MySQL ne supporte pas NULLS LAST — on trie les NULL en dernier manuellement
            case((models.Employe.derniere_connexion == None, 1), else_=0),
            models.Employe.derniere_connexion.desc(),
            models.Employe.nom,
        )
        .all()
    )
    result = []
    for e in employes:
        # Utilise dernier_login comme fallback si derniere_connexion non encore renseignée
        connexion = e.derniere_connexion or (e.utilisateur.dernier_login if e.utilisateur else None)
        en_ligne = connexion is not None and connexion >= threshold
        result.append({
            'matricule': e.matricule,
            'nom': e.nom or '',
            'prenom': e.prenom or '',
            'fonction': e.fonction or '',
            'photo_url': e.photo_url or None,
            'en_ligne': en_ligne,
            'derniere_connexion': connexion.isoformat() if connexion else None,
        })
    # Trier: en ligne d'abord, puis hors ligne par derniere_connexion desc, puis jamais connecté
    result.sort(key=lambda x: (
        0 if x['en_ligne'] else (1 if x['derniere_connexion'] else 2),
        x['derniere_connexion'] or '',
    ), reverse=False)
    # Inverser la clé de date pour avoir le plus récent en premier dans hors-ligne
    result.sort(key=lambda x: (
        0 if x['en_ligne'] else 1,
        '' if not x['derniere_connexion'] else x['derniere_connexion'],
    ), reverse=False)
    online = [x for x in result if x['en_ligne']]
    offline_with = sorted([x for x in result if not x['en_ligne'] and x['derniere_connexion']], key=lambda x: x['derniere_connexion'], reverse=True)
    offline_never = [x for x in result if not x['en_ligne'] and not x['derniere_connexion']]
    return online + offline_with + offline_never


@router.get('/{matricule}', response_model=schemas.EmployeOut)
def get_employee(matricule: str, request: Request, db: Session = Depends(get_db)):
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Non trouvé')
    try:
        viewer_mat, viewer_role = _get_token_context(request)
    except HTTPException:
        viewer_mat, viewer_role = None, None
    return _serialize_employee(e, db, viewer_matricule=viewer_mat, viewer_role=viewer_role)


@router.delete('/{matricule}')
def soft_delete_employee(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Soft-delete: sets statut_employe to CONGEDIE and disables the user account (ADMIN only)."""
    actor_matricule, actor_role = _get_token_context(request)
    if str(actor_role or '').upper() != 'ADMIN':
        raise HTTPException(status_code=403, detail='Réservé aux administrateurs')

    e = db.query(models.Employe).filter(models.Employe.matricule == str(matricule).strip().upper()).first()
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    if e.statut_employe == models.StatutEmployeEnum.CONGEDIE:
        raise HTTPException(status_code=409, detail='Employé déjà supprimé')

    e.statut_employe = models.StatutEmployeEnum.CONGEDIE
    db.flush()

    # Disable associated user account if any
    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == str(matricule).strip().upper()).first()
    if utilisateur:
        utilisateur.bloque_jusqua = datetime(9999, 12, 31)  # block permanently
        db.flush()

    log_action(
        db,
        actor_matricule,
        'EMPLOYEE_SOFT_DELETED',
        'employe',
        str(matricule),
        {'nom': e.nom, 'prenom': e.prenom, 'statut': 'CONGEDIE'},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {'detail': 'Employé supprimé (soft delete)', 'matricule': matricule}


# ── RGPD endpoints ────────────────────────────────────────────────────────────

@router.get('/{matricule}/export-personal-data')
def export_personal_data(matricule: str, request: Request, db: Session = Depends(get_db)):
    """RGPD: Export all personal data for an employee (self or ADMIN/RH)."""
    actor_matricule, actor_role = _get_token_context(request)
    role = str(actor_role or '').upper()
    requesting_own = str(actor_matricule) == str(matricule)
    if not requesting_own and role not in {'ADMIN', 'RH', 'PCA', 'AG'}:
        raise HTTPException(status_code=403, detail='Accès refusé')

    e = db.query(models.Employe).filter(models.Employe.matricule == str(matricule).strip().upper()).first()
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    operations = db.query(models.Operation).filter(models.Operation.matricule == str(matricule).strip().upper()).all()
    missions = db.query(models.MissionnairesMission).filter(models.MissionnairesMission.matricule == str(matricule).strip().upper()).all()

    data = {
        'employe': {
            'matricule': e.matricule,
            'nom': e.nom,
            'prenom': e.prenom,
            'email': e.email,
            'telephone': e.telephone,
            'date_naissance': str(e.date_naissance) if e.date_naissance else None,
            'lieu_naissance': getattr(e, 'lieu_naissance', None),
            'adresse': getattr(e, 'adresse', None),
            'nationalite': getattr(e, 'nationalite', None),
            'statut_employe': e.statut_employe.value if e.statut_employe else None,
            'fonction': e.fonction,
            'date_embauche': str(e.date_embauche) if e.date_embauche else None,
        },
        'operations_count': len(operations),
        'missions_count': len(missions),
        'export_date': datetime.utcnow().isoformat(),
        'exported_by': str(actor_matricule),
    }
    log_action(db, actor_matricule, 'RGPD_EXPORT', 'employe', str(matricule), {}, ip_address=request.client.host if request.client else None)
    db.commit()
    return data


@router.post('/{matricule}/anonymize')
def anonymize_employee(matricule: str, request: Request, db: Session = Depends(get_db)):
    """RGPD: Anonymize all PII for a departed employee (ADMIN only). Keeps operational records."""
    actor_matricule, actor_role = _get_token_context(request)
    if str(actor_role or '').upper() != 'ADMIN':
        raise HTTPException(status_code=403, detail='Réservé aux administrateurs')

    e = db.query(models.Employe).filter(models.Employe.matricule == str(matricule).strip().upper()).first()
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    if e.statut_employe != models.StatutEmployeEnum.CONGEDIE:
        raise HTTPException(status_code=409, detail="L'employé doit être congédié avant anonymisation")

    anon_label = f'ANONYME-{matricule}'
    e.nom = anon_label
    e.prenom = ''
    e.email = None
    e.telephone = None
    e.date_naissance = None
    e.lieu_naissance = None
    e.adresse = None
    e.nationalite = None

    log_action(db, actor_matricule, 'RGPD_ANONYMIZE', 'employe', str(matricule), {'anon_label': anon_label}, ip_address=request.client.host if request.client else None)
    db.commit()
    return {'detail': 'Données personnelles anonymisées avec succès', 'matricule': matricule}


@router.put('/{matricule}', response_model=schemas.EmployeOut)
def update_employee(matricule: str, payload: schemas.EmployeUpdate, request: Request, db: Session = Depends(get_db)):
    # Récupérer l'employé existant — nécessaire pour le fallback des champs manquants ET le snapshot AVANT
    before = crud.get_employe(db, matricule)
    if not before:
        raise HTTPException(status_code=404, detail='Non trouvé')
    # PARTIAL UPDATE : ne traiter QUE les champs réellement envoyés par le client.
    # Sinon les champs absents sont remplis avec None et écrasent les valeurs existantes.
    sent_fields = payload.model_fields_set
    update_dict = payload.model_dump(exclude_unset=True)
    # Compléter les champs requis depuis l'employé existant si absents du payload
    if not update_dict.get('matricule'):
        update_dict['matricule'] = str(before.matricule)
    if not update_dict.get('nom'):
        update_dict['nom'] = str(before.nom) if before.nom else ''
    if not update_dict.get('prenom'):
        update_dict['prenom'] = str(before.prenom) if before.prenom else ''
    full_payload = schemas.EmployeBase(**update_dict)
    prepared = _prepare_employee_payload(full_payload, db)
    # Filtrer 'prepared' pour ne garder que les clés que le client a vraiment envoyées
    # (plus les clés calculées par _prepare_employee_payload qui dépendent des champs envoyés).
    # Mapping : un nom logique envoyé par le client → les colonnes DB qu'il met à jour.
    LOGICAL_TO_DB = {
        'role': {'id_role'},
        'entite': {'id_entite'},
        'direction': {'id_direction'},
        'departement': {'dept_id', 'departement'},
        'fonction': {'fonction'},
        'ville': {'ville', 'id_localisation'},
        'id_localisation': {'id_localisation', 'ville'},
        'pays': {'pays', 'id_pays'},
        'n1': {'n1'},
    }
    keys_to_apply = set()
    for k in sent_fields:
        keys_to_apply.add(k)
        keys_to_apply.update(LOGICAL_TO_DB.get(k, set()))
    # matricule/nom/prenom sont toujours valides (fallback DB)
    keys_to_apply.update({'matricule', 'nom', 'prenom'})
    data = {k: v for k, v in prepared.items() if k in keys_to_apply}
    # PROTECTION ANTI-EFFACEMENT : un PUT ne doit jamais écraser une valeur
    # existante par None ou par une chaîne vide. Pour vider explicitement un
    # champ, utiliser un endpoint dédié (DELETE / clear). Cela protège l'app
    # contre les payloads partiels (form, API tierce, tests) qui omettent ou
    # envoient null/"" pour des champs qu'ils n'ont pas l'intention de modifier.
    NEVER_BLANK_PROTECTED = {'matricule', 'nom', 'prenom'}
    CLEARABLE_DB_COLS = {'dept_id', 'id_direction', 'id_localisation'}
    cleaned = {}
    for k, v in data.items():
        if k in NEVER_BLANK_PROTECTED:
            cleaned[k] = v
            continue
        if v is None and k in CLEARABLE_DB_COLS:
            cleaned[k] = None   # effacement explicite autorisé
            continue
        if v is None:
            continue
        if isinstance(v, str) and v.strip() == '':
            continue
        cleaned[k] = v
    data = cleaned
    # Snapshot BEFORE update pour détecter promotions/mutations/transferts
    before_snapshot = {
        'id_role': getattr(before, 'id_role', None),
        'dept_id': getattr(before, 'dept_id', None),
        'id_direction': getattr(before, 'id_direction', None),
        'id_entite': getattr(before, 'id_entite', None),
        'id_localisation': getattr(before, 'id_localisation', None),
        'type_contrat': getattr(getattr(before, 'type_contrat', None), 'value', '') or '',
    }
    # Snapshot complet pour la notification admin (capturé avant crud.update_employe
    # car SQLAlchemy met à jour l'objet en mémoire via l'identity map).
    before_notif_snapshot = {
        'nom': getattr(before, 'nom', None),
        'prenom': getattr(before, 'prenom', None),
        'fonction': getattr(before, 'fonction', None),
        'email': getattr(before, 'email', None),
        'telephone': getattr(before, 'telephone', None),
        'statut_employe': getattr(before, 'statut_employe', None),
        'n1_fonction': getattr(before, 'n1_fonction', None),
        'diplome': getattr(before, 'diplome', None),
        'solde_conges': getattr(before, 'solde_conges', None),
        'dept_id': getattr(before, 'dept_id', None),
        'id_role': getattr(before, 'id_role', None),
        'id_entite': getattr(before, 'id_entite', None),
    }
    e = crud.update_employe(db, matricule, data)
    if not e:
        raise HTTPException(status_code=404, detail='Non trouvé')
    actor_matricule = None
    actor_role = ''
    auth = request.headers.get('authorization')
    if auth and auth.lower().startswith('bearer '):
        try:
            from ..utils import security
            token_payload = security.jwt.decode(auth.split(None, 1)[1], security.SECRET_KEY, algorithms=[security.ALGORITHM])
            actor_matricule = token_payload.get('matricule') or token_payload.get('sub')
            actor_matricule = str(actor_matricule).strip().upper() if actor_matricule is not None else None
            actor_role = str(token_payload.get('role') or '').strip().upper()
        except Exception:
            actor_matricule = None
    log_action(db, actor_matricule, 'EMPLOYEE_UPDATED', 'employe', matricule, {'nom': data.get('nom'), 'prenom': data.get('prenom')}, ip_address=request.client.host if request.client else None)
    # Historiser les changements de carrière (promotion/mutation/transfert)
    if before_snapshot:
        try:
            from ..utils import parcours as _parcours
            after_snapshot = {
                'id_role': getattr(e, 'id_role', None),
                'dept_id': getattr(e, 'dept_id', None),
                'id_direction': getattr(e, 'id_direction', None),
                'id_entite': getattr(e, 'id_entite', None),
                'id_localisation': getattr(e, 'id_localisation', None),
                'type_contrat': getattr(getattr(e, 'type_contrat', None), 'value', '') or '',
            }
            _parcours.record_employee_diff(db, str(matricule).strip().upper(), before_snapshot, after_snapshot, actor=actor_matricule)
        except Exception:
            # Ne jamais bloquer la mise à jour employé en cas d'échec d'historisation
            db.rollback()
    _auto_fill_org_head(db, e)
    _notify_admin_employee_update(db, before_notif_snapshot, e, actor_role, actor_matricule)
    return _serialize_employee(e, db)


@router.post('/{matricule}/photo')
async def upload_photo(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Upload or update profile photo for an employee (base64 or multipart)."""
    import base64, os, uuid
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')
    content_type = request.headers.get('content-type', '')
    upload_dir = str(UPLOADS_ROOT / 'photos')
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


@router.post('/{matricule}/signature')
async def upload_signature(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Upload or update handwritten signature for an employee (base64 or multipart)."""
    import base64, os, uuid
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')
    content_type = request.headers.get('content-type', '')
    upload_dir = str(UPLOADS_ROOT / 'signatures')
    os.makedirs(upload_dir, exist_ok=True)
    if 'multipart' in content_type:
        form = await request.form()
        file = form.get('signature')
        if not file:
            raise HTTPException(status_code=400, detail='Champ signature manquant')
        ext = (file.filename or 'png').rsplit('.', 1)[-1].lower()
        if ext not in {'jpg', 'jpeg', 'png', 'webp'}:
            raise HTTPException(status_code=400, detail='Format non supporté')
        filename = f"{matricule}_{uuid.uuid4().hex[:8]}.{ext}"
        path = os.path.join(upload_dir, filename)
        contents = await file.read()
        with open(path, 'wb') as fp:
            fp.write(contents)
        e.signature_url = f'/uploads/signatures/{filename}'
    else:
        body = await request.json()
        data_url = body.get('signature_url', '')
        if data_url.startswith('data:image'):
            header, b64 = data_url.split(',', 1)
            ext = header.split(';')[0].split('/')[-1]
            if ext not in {'jpg', 'jpeg', 'png', 'webp'}:
                ext = 'png'
            filename = f"{matricule}_{uuid.uuid4().hex[:8]}.{ext}"
            path = os.path.join(upload_dir, filename)
            raw = base64.b64decode(b64)
            with open(path, 'wb') as fp:
                fp.write(raw)
            e.signature_url = f'/uploads/signatures/{filename}'
        else:
            e.signature_url = data_url
    db.commit()
    db.refresh(e)
    return {'signature_url': e.signature_url}


@router.delete('/{matricule}/signature')
def delete_signature(matricule: str, db: Session = Depends(get_db)):
    """Remove handwritten signature from profile."""
    e = crud.get_employe(db, matricule)
    if not e:
        raise HTTPException(status_code=404, detail='Employé introuvable')
    e.signature_url = None
    db.commit()
    return {'signature_url': None}



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

    Priorité :
    1. FONCTION_REFERENCE filtrée par dept_id (si fourni)
    2. Fonctions des employés dans ce département (fallback)
    3. Toutes les FONCTION_REFERENCE (si pas de dept_id ou aucun résultat)
    4. Fonctions distinctes de la table EMPLOYE (fallback ultime)
    """
    _seed_default_fonctions(db)
    role_names = _role_names_set(db)

    if dept_id:
        # 1. Fonctions de référence configurées pour ce département
        fonctions_ref_dept = db.query(models.FonctionReference.libelle).filter(
            models.FonctionReference.dept_id == dept_id
        ).order_by(models.FonctionReference.libelle.asc()).all()
        if fonctions_ref_dept:
            return [
                {"value": f[0], "label": f[0]}
                for f in fonctions_ref_dept
                if f and f[0] and str(f[0]).strip().lower() not in role_names
            ]
        # 2. Fonctions déjà utilisées par des employés dans ce département
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

    # 3. Toutes les fonctions de référence (pas de filtre dept)
    fonctions_ref = db.query(models.FonctionReference.libelle).order_by(models.FonctionReference.libelle.asc()).all()
    if fonctions_ref:
        return [
            {"value": f[0], "label": f[0]}
            for f in fonctions_ref
            if f and f[0] and str(f[0]).strip().lower() not in role_names
        ]

    # 4. Fallback ultime : fonctions saisies dans EMPLOYE
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
        func.lower(models.FonctionReference.libelle) == libelle.lower(),
        models.FonctionReference.id_direction == payload.id_direction,
        models.FonctionReference.dept_id == payload.dept_id,
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
    """Met à jour une fonction de référence (Admin seulement).

    Propage le changement de libellé aux employés concernés (EMPLOYE.fonction).
    """
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
        models.FonctionReference.id_direction == payload.id_direction,
        models.FonctionReference.dept_id == payload.dept_id,
        models.FonctionReference.id_fonction != id_fonction
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Cette fonction existe déjà dans cette direction/département')

    old_libelle = current.libelle
    propagated = 0
    if old_libelle and old_libelle.strip().lower() != libelle.lower():
        propagated = db.query(models.Employe).filter(
            models.Employe.fonction.isnot(None),
            func.lower(func.trim(models.Employe.fonction)) == old_libelle.strip().lower()
        ).update({models.Employe.fonction: libelle}, synchronize_session=False)

    current.libelle = libelle
    current.id_direction = payload.id_direction
    current.dept_id = payload.dept_id
    db.commit()
    db.refresh(current)
    return {
        "id_fonction": current.id_fonction,
        "libelle": current.libelle,
        "id_direction": current.id_direction,
        "dept_id": current.dept_id,
        "updated": True,
        "employees_updated": propagated,
    }


@router.delete('/admin/fonctions-reference/{id_fonction}')
def delete_fonction_reference(id_fonction: int, request: Request, db: Session = Depends(get_db)):
    """Supprime une fonction de référence (Admin seulement).

    Les employés référençant ce libellé voient leur champ `fonction` mis à NULL
    (cascade logique). Le compteur d'employés impactés est retourné.
    """
    _check_admin_role(request)

    current = db.query(models.FonctionReference).filter(models.FonctionReference.id_fonction == id_fonction).first()
    if not current:
        raise HTTPException(status_code=404, detail='Fonction introuvable')

    libelle_old = (current.libelle or '').strip()
    cleared = 0
    if libelle_old:
        cleared = db.query(models.Employe).filter(
            models.Employe.fonction.isnot(None),
            func.lower(func.trim(models.Employe.fonction)) == libelle_old.lower()
        ).update({models.Employe.fonction: None}, synchronize_session=False)

    db.delete(current)
    db.commit()
    return {"deleted": True, "id_fonction": id_fonction, "employees_cleared": cleared}


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


@router.get('/{matricule}/parcours', response_model=list[schemas.ParcoursEmployeOut])
def get_employee_parcours(matricule: str, db: Session = Depends(get_db)):
    """Retourne l'historique de parcours (promotions / mutations / transferts) d'un employé, trié du plus récent au plus ancien."""
    rows = (
        db.query(models.ParcoursEmploye)
        .filter(models.ParcoursEmploye.matricule == matricule)
        .order_by(models.ParcoursEmploye.date_action.desc(), models.ParcoursEmploye.id_parcours.desc())
        .all()
    )
    return rows


@router.get('/{matricule}/formations')
def get_employee_formations(matricule: str, db: Session = Depends(get_db)):
    """
    Retourne toutes les formations suivies par un employé.
    Même logique que le taux d'accès à la formation du dashboard :
      1) Missions avec 'formation' dans titre/commentaire/motif
      2) Tâches terminées avec 'formation' dans le titre (assignées ou créées par l'employé)
      3) Événements de type Formation inscrits par l'employé
    """
    import re as _re
    formation_re = _re.compile(r'formations?', _re.IGNORECASE)
    results = []

    # 1) Missions formation où la personne est MISSIONNAIRE (pas initiateur)
    mm_rows = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.matricule == matricule
    ).all()
    ids_misso = {mm.id_mission for mm in mm_rows}
    for id_m in ids_misso:
        op = db.query(models.Operation).filter(
            models.Operation.id_operation == id_m,
            models.Operation.type_demande == 'Mission',
        ).first()
        if op and (formation_re.search(op.titre or '')
                   or formation_re.search(op.commentaire or '')
                   or formation_re.search(op.motif or '')):
            mission = db.query(models.Mission).filter(
                models.Mission.id_mission == op.id_operation
            ).first()
            results.append({
                'source': 'mission',
                'id': op.id_operation,
                'titre': op.titre or 'Mission formation',
                'date': str(op.date_debut) if op.date_debut else str(op.date_demande),
                'statut': op.statut,
                'lieu': (mission.ville or mission.pays) if mission else None,
            })

    # 2) Tâches terminées avec 'formation' dans le titre
    tasks_assigned = db.query(models.TaskAssignee).filter(
        models.TaskAssignee.matricule_employe == matricule
    ).all()
    task_ids_assigned = {ta.id_task for ta in tasks_assigned}

    tasks = db.query(models.Task).filter(
        models.Task.statut == 'termine',
    ).all()
    for task in tasks:
        if not formation_re.search(task.titre or ''):
            continue
        is_mine = (
            str(task.cree_par) == str(matricule)
            or str(task.assigne_a) == str(matricule)
            or task.id_task in task_ids_assigned
        )
        if is_mine:
            results.append({
                'source': 'tache',
                'id': task.id_task,
                'titre': task.titre,
                'date': str(task.date_modification or task.date_creation),
                'statut': 'Terminé',
                'lieu': None,
            })

    # 3) Événements de type Formation (inscrit comme présent)
    inscriptions = db.query(models.InscriptionEvenement).filter(
        models.InscriptionEvenement.matricule == matricule,
        models.InscriptionEvenement.statut.in_(['inscrit', 'present']),
    ).all()
    for ins in inscriptions:
        ev = db.query(models.Evenement).filter(
            models.Evenement.id == ins.id_evenement,
        ).first()
        if ev and (ev.type == 'Formation' or formation_re.search(ev.titre or '')):
            results.append({
                'source': 'evenement',
                'id': ev.id,
                'titre': ev.titre,
                'date': str(ev.date_debut) if ev.date_debut else None,
                'statut': 'Présent' if ins.statut == 'present' else 'Inscrit',
                'lieu': ev.lieu,
            })

    # Déduplication par (source, id)
    seen = set()
    dedup = []
    for r in results:
        key = (r['source'], r['id'])
        if key not in seen:
            seen.add(key)
            dedup.append(r)

    dedup.sort(key=lambda x: x['date'] or '', reverse=True)
    return dedup


@router.get('/admin/utilisateurs')
def get_admin_utilisateurs(request: Request, db: Session = Depends(get_db)):
    """Lister les comptes utilisateurs (admin seulement)."""
    _check_admin_role(request)

    utilisateurs = db.query(models.Utilisateur).order_by(models.Utilisateur.matricule.asc()).all()
    return [_serialize_utilisateur_admin(u, db) for u in utilisateurs]


@router.put('/admin/utilisateurs/{matricule}')
def update_admin_utilisateur(
    matricule: str,
    payload: UtilisateurAdminUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Mettre a jour un compte utilisateur (role, activation, MFA)."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not utilisateur:
        raise HTTPException(status_code=404, detail='Utilisateur non trouvé')

    previous_role_id = utilisateur.role_id

    if payload.role is not None:
        role_name = str(payload.role).strip().upper()
        role = db.query(models.Role).filter(func.upper(models.Role.name) == role_name).first()
        if not role:
            raise HTTPException(status_code=400, detail='Rôle inconnu')
        utilisateur.role_id = role.id
        # Synchroniser la table EMPLOYE pour cohérence
        emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
        if emp is not None:
            emp.id_role = role.id

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

    # Historiser une promotion si le rôle a changé
    if payload.role is not None and previous_role_id != utilisateur.role_id:
        try:
            from ..utils import parcours as _parcours
            _parcours.record_event(
                db,
                matricule=str(matricule).strip().upper(),
                type_action=models.TypeParcoursEnum.PROMOTION,
                champ_modifie='id_role',
                ancienne_valeur=_parcours._role_label(db, previous_role_id),
                nouvelle_valeur=_parcours._role_label(db, utilisateur.role_id),
                libelle=f"Rôle : {_parcours._role_label(db, previous_role_id) or '—'} → {_parcours._role_label(db, utilisateur.role_id) or '—'}",
                actor=actor_matricule,
            )
        except Exception:
            db.rollback()

    return _serialize_utilisateur_admin(utilisateur, db)


@router.post('/admin/utilisateurs/{matricule}/reset-password-temp')
def reset_admin_utilisateur_password(
    matricule: str,
    payload: UtilisateurResetPassword,
    request: Request,
    db: Session = Depends(get_db)
):
    """Reinitialiser le mot de passe avec flag temporaire pour forcer le changement au prochain login."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not utilisateur:
        raise HTTPException(status_code=404, detail='Utilisateur non trouvé')

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
        'message': 'Mot de passe temporaire réinitialisé',
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
    matricule: str,
    payload: UtilisateurCreerCompte,
    request: Request,
    db: Session = Depends(get_db)
):
    """Creer un compte applicatif pour un employe qui n'en a pas encore."""
    _check_admin_role(request)
    actor_matricule, actor_role = _get_token_context(request)

    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    existant = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if existant:
        raise HTTPException(status_code=409, detail='Cet employé a déjà un compte')

    mot_de_passe = (payload.password or '').strip() or f"EMS@{matricule}!Compte1"
    ok, msg = security.validate_password_policy(mot_de_passe)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    role_obj = None
    if payload.role:
        role_name = str(payload.role).strip().upper()
        role_obj = db.query(models.Role).filter(func.upper(models.Role.name) == role_name).first()
        if not role_obj:
            raise HTTPException(status_code=400, detail='Rôle inconnu')

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


_INACTIVITY_TIMEOUT_MINUTES = 15  # session considérée fermée après 15min sans heartbeat
_SESSION_MAX_WINDOW_HOURS = 12    # durée max d'une session (évite de capturer la session suivante)


def _build_audit_map(db, start_dt: datetime) -> dict:
    """Construit un index {matricule: [timestamps triés asc]} des actions
    dans audit_logs depuis start_dt.
    Exclut LOGIN_SUCCESS (= début de session, déjà dans date_connexion).
    """
    rows = (
        db.query(models.AuditLog.actor, models.AuditLog.timestamp)
        .filter(
            models.AuditLog.timestamp >= start_dt,
            models.AuditLog.actor != None,  # noqa: E711
            models.AuditLog.action != 'LOGIN_SUCCESS',
        )
        .order_by(models.AuditLog.actor, models.AuditLog.timestamp.asc())
        .all()
    )
    result: dict = {}
    for actor, ts in rows:
        if actor and ts:
            result.setdefault(str(actor), []).append(ts)
    return result


def _resolve_minutes(session, today=None, audit_map: dict | None = None) -> int:
    """Calcule la durée effective d'utilisation en minutes.

    Priorité:
    1. duree_minutes déjà défini (logout propre) → utiliser tel quel.
    2. date_deconnexion défini (logout API) → calculer depuis les timestamps.
    3. derniere_activite connue (heartbeat) → derniere_activite + INACTIVITY_TIMEOUT.
    4. Fallback audit_log: dernière action de l'user dans la fenêtre de session
       → last_audit + INACTIVITY_TIMEOUT.
    5. Aucune donnée → 0 min (on ne sait pas, on n'invente pas).
    """
    if session.duree_minutes is not None:
        return session.duree_minutes
    if session.date_deconnexion:
        return max(0, int((session.date_deconnexion - session.date_connexion).total_seconds() / 60))
    # Session sans logout — utiliser derniere_activite si disponible
    if session.derniere_activite:
        effective_end = session.derniere_activite + timedelta(minutes=_INACTIVITY_TIMEOUT_MINUTES)
        return max(0, int((effective_end - session.date_connexion).total_seconds() / 60))
    # Fallback: chercher la dernière action dans l'audit log
    if audit_map:
        timestamps = audit_map.get(str(session.matricule), [])
        if timestamps:
            session_start = session.date_connexion
            max_end = session_start + timedelta(hours=_SESSION_MAX_WINDOW_HOURS)
            # Parcourir en ordre décroissant pour trouver le dernier dans la fenêtre
            last_audit = None
            for ts in reversed(timestamps):
                if session_start < ts <= max_end:
                    last_audit = ts
                    break
            if last_audit:
                effective_end = last_audit + timedelta(minutes=_INACTIVITY_TIMEOUT_MINUTES)
                return max(0, int((effective_end - session_start).total_seconds() / 60))
    # Aucune donnée disponible → 0 min
    return 0


def _session_interval(session, audit_map: dict | None = None) -> tuple | None:
    """Retourne l'intervalle effectif (start_dt, end_dt) d'une session, ou None
    si on ne peut pas determiner la fin.

    Meme logique de priorite que _resolve_minutes:
    1. duree_minutes -> start + duree
    2. date_deconnexion -> (start, deconnexion)
    3. derniere_activite -> (start, derniere_activite + INACTIVITY)
    4. audit_map -> (start, last_audit + INACTIVITY) si trouve dans la fenetre
    5. sinon None (on ignore la session — pas de comptage)
    """
    start = session.date_connexion
    if start is None:
        return None
    if session.duree_minutes is not None:
        return (start, start + timedelta(minutes=max(0, session.duree_minutes)))
    if session.date_deconnexion is not None:
        end = session.date_deconnexion
        return (start, end) if end > start else None
    if session.derniere_activite is not None:
        end = session.derniere_activite + timedelta(minutes=_INACTIVITY_TIMEOUT_MINUTES)
        return (start, end) if end > start else None
    if audit_map:
        timestamps = audit_map.get(str(session.matricule), [])
        if timestamps:
            max_end = start + timedelta(hours=_SESSION_MAX_WINDOW_HOURS)
            last_audit = None
            for ts in reversed(timestamps):
                if start < ts <= max_end:
                    last_audit = ts
                    break
            if last_audit:
                end = last_audit + timedelta(minutes=_INACTIVITY_TIMEOUT_MINUTES)
                return (start, end)
    return None


def _merge_intervals(intervals: list) -> list:
    """Fusionne une liste de tuples (start, end) qui se chevauchent.
    Retourne la liste fusionnee triee par start."""
    if not intervals:
        return []
    sorted_iv = sorted(intervals, key=lambda x: x[0])
    merged = [list(sorted_iv[0])]
    for start, end in sorted_iv[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [(s, e) for s, e in merged]


def _clip_intervals_to_window(intervals: list, win_start, win_end) -> list:
    """Restreint chaque intervalle a la fenetre [win_start, win_end].
    Elimine ceux qui sont entierement hors fenetre."""
    result = []
    for start, end in intervals:
        s = max(start, win_start)
        e = min(end, win_end)
        if s < e:
            result.append((s, e))
    return result


def _minutes_in_intervals(intervals: list) -> int:
    """Somme les durees (en minutes) d'une liste d'intervalles fusionnes."""
    return sum(int((e - s).total_seconds() / 60) for s, e in intervals)


def _user_minutes_in_window(sessions, win_start, win_end, audit_map=None) -> int:
    """Calcule les minutes UNIQUES d'un utilisateur dans la fenetre,
    en fusionnant les sessions qui se chevauchent.

    Garantit qu'on ne depasse JAMAIS la duree physique de la fenetre.
    """
    raw_intervals = []
    for s in sessions:
        iv = _session_interval(s, audit_map)
        if iv is not None:
            raw_intervals.append(iv)
    merged = _merge_intervals(raw_intervals)
    clipped = _clip_intervals_to_window(merged, win_start, win_end)
    return _minutes_in_intervals(clipped)


@router.get('/stats/usage/{matricule}/today')
def get_usage_today(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Statistiques d'utilisation du jour"""
    _check_admin_role(request)

    today = datetime.utcnow().date()
    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) == today,
    ).all()

    audit_map = _build_audit_map(db, datetime.combine(today, datetime.min.time()))
    win = (datetime.combine(today, datetime.min.time()),
           datetime.combine(today, datetime.min.time()) + timedelta(days=1))
    total_minutes = _user_minutes_in_window(sessions, win[0], win[1], audit_map)
    return {
        'date': today.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'sessions_count': len(sessions),
    }


@router.get('/stats/usage/{matricule}/week')
def get_usage_week(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Statistiques d'utilisation de la semaine"""
    _check_admin_role(request)

    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())

    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) >= week_start,
        func.date(models.SessionUtilisation.date_connexion) <= today,
    ).all()

    audit_map = _build_audit_map(db, datetime.combine(week_start, datetime.min.time()))
    daily_data = {}
    d = week_start
    while d <= today:
        win = (datetime.combine(d, datetime.min.time()),
               datetime.combine(d, datetime.min.time()) + timedelta(days=1))
        mins_d = _user_minutes_in_window(sessions, win[0], win[1], audit_map)
        if mins_d > 0:
            daily_data[d] = mins_d
        d += timedelta(days=1)

    total_minutes = sum(daily_data.values())
    return {
        'week_start': week_start.isoformat(),
        'week_end': today.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'daily_breakdown': {str(k): v for k, v in sorted(daily_data.items())},
        'sessions_count': len(sessions),
    }


@router.get('/stats/usage/{matricule}/month')
def get_usage_month(matricule: str, month: int = None, year: int = None, request: Request = None, db: Session = Depends(get_db)):
    """Statistiques d'utilisation du mois"""
    if request:
        _check_admin_role(request)

    today = datetime.utcnow().date()
    if month is None:
        month = today.month
    if year is None:
        year = today.year

    first_day = datetime(year, month, 1).date()
    if month == 12:
        last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)

    sessions = db.query(models.SessionUtilisation).filter(
        models.SessionUtilisation.matricule == matricule,
        func.date(models.SessionUtilisation.date_connexion) >= first_day,
        func.date(models.SessionUtilisation.date_connexion) <= last_day,
    ).all()

    audit_map = _build_audit_map(db, datetime.combine(first_day, datetime.min.time()))
    daily_data = {}
    d = first_day
    while d <= last_day:
        win = (datetime.combine(d, datetime.min.time()),
               datetime.combine(d, datetime.min.time()) + timedelta(days=1))
        mins_d = _user_minutes_in_window(sessions, win[0], win[1], audit_map)
        if mins_d > 0:
            daily_data[d] = mins_d
        d += timedelta(days=1)

    total_minutes = sum(daily_data.values())
    return {
        'month': month,
        'year': year,
        'month_start': first_day.isoformat(),
        'month_end': last_day.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'daily_breakdown': {str(k): v for k, v in sorted(daily_data.items())},
        'sessions_count': len(sessions),
    }


@router.get('/stats/usage/{matricule}/year')
def get_usage_year(matricule: str, year: int = None, request: Request = None, db: Session = Depends(get_db)):
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
    ).all()

    monthly_data = {}
    audit_map = _build_audit_map(db, datetime.combine(first_day, datetime.min.time()))
    for m in range(1, 13):
        m_start = datetime(year, m, 1).date()
        if m == 12:
            m_end = datetime(year + 1, 1, 1).date()
        else:
            m_end = datetime(year, m + 1, 1).date()
        if m_start > last_day:
            break
        win = (datetime.combine(m_start, datetime.min.time()),
               datetime.combine(m_end, datetime.min.time()))
        mins_m = _user_minutes_in_window(sessions, win[0], win[1], audit_map)
        if mins_m > 0:
            monthly_data[m] = mins_m

    total_minutes = sum(monthly_data.values())
    return {
        'year': year,
        'year_start': first_day.isoformat(),
        'year_end': last_day.isoformat(),
        'total_minutes': total_minutes,
        'total_hours': round(total_minutes / 60, 2) if total_minutes > 0 else 0,
        'monthly_breakdown': {str(k): v for k, v in sorted(monthly_data.items())},
        'sessions_count': len(sessions),
    }


@router.get('/stats/usage/all/summary')
def get_usage_summary(request: Request, db: Session = Depends(get_db), tz: str | None = None):
    """Statistiques globales pour tous les utilisateurs (Admin seulement).

    Inclut toutes les sessions — y compris abandonnées (sans logout) —
    en estimant la durée via _resolve_minutes.
    Retourne les 4 périodes + breakdowns journaliers/mensuels + ranking
    par employé, département, direction, entité.

    Le parametre `tz` (ex: Africa/Douala) permet d'aligner les bornes
    aujourd'hui/semaine/mois sur le calendrier local de l'utilisateur
    plutot que sur UTC — sinon les connexions en debut/fin de journee
    locale tombent dans le mauvais jour.
    """
    _check_admin_role(request)

    # Resolution du "today" local
    try:
        from zoneinfo import ZoneInfo  # type: ignore
        local_tz = ZoneInfo(tz) if tz else None
    except Exception:
        local_tz = None

    if local_tz is not None:
        today = datetime.now(local_tz).date()
    else:
        today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = datetime(today.year, today.month, 1).date()
    year_start = datetime(today.year, 1, 1).date()

    # Fetch ALL sessions from the start of this year (covers today/week/month/year)
    # On elargit la borne d'un jour pour couvrir le decalage TZ (max 14h).
    sql_year_start = year_start - timedelta(days=1)
    all_sessions = db.query(models.SessionUtilisation).filter(
        func.date(models.SessionUtilisation.date_connexion) >= sql_year_start,
    ).all()

    # Construire l'audit_map une seule fois pour tout le summary
    # (évite N requêtes pour N sessions sans heartbeat)
    audit_map = _build_audit_map(db, datetime.combine(sql_year_start, datetime.min.time()))

    # Build employee info map: matricule → {nom, prenom, departement, direction, entite, dept_id, id_direction, id_entite}
    employees = db.query(models.Employe).all()
    entites_map = {e.id_entite: e.nom for e in db.query(models.Entite).all()}
    directions_map = {d.id_direction: d.nom for d in db.query(models.Direction).all()}
    departements_map = {d.dept_id: d.nom for d in db.query(models.Departement).all()}
    emp_info: dict = {}
    for e in employees:
        emp_info[e.matricule] = {
            'nom': f'{e.prenom} {e.nom}',
            'dept_id': e.dept_id,
            'id_direction': e.id_direction,
            'id_entite': e.id_entite,
            'departement': departements_map.get(e.dept_id, 'N/A') if e.dept_id else 'N/A',
            'direction': directions_map.get(e.id_direction, 'N/A') if e.id_direction else 'N/A',
            'entite': entites_map.get(e.id_entite, 'N/A') if e.id_entite else 'N/A',
        }

    # Accumulators
    today_mins = 0; today_sessions = []; today_users = set()
    week_mins = 0;  week_sessions = [];  week_users = set()
    month_mins = 0; month_sessions = []; month_users = set()
    year_mins = 0;  year_sessions = [];  year_users = set()

    # Breakdowns time
    week_daily: dict = {}
    month_daily: dict = {}
    year_monthly: dict = {}

    # Org breakdowns per period: mat → {minutes, sessions}
    def _new_period_orgs():
        return {'emp': {}, 'dept': {}, 'direction': {}, 'entite': {}}

    today_orgs = _new_period_orgs()
    week_orgs = _new_period_orgs()
    month_orgs = _new_period_orgs()
    year_orgs = _new_period_orgs()

    def _acc_orgs(orgs: dict, mat: int, mins: int, n_sessions: int = 1):
        info = emp_info.get(mat, {})
        # Employee
        k = str(mat)
        label = info.get('nom', f'#{mat}')
        if k not in orgs['emp']:
            orgs['emp'][k] = {'id': k, 'label': label, 'minutes': 0, 'sessions': 0}
        orgs['emp'][k]['minutes'] += mins
        orgs['emp'][k]['sessions'] += n_sessions
        # Département
        dept_id = info.get('dept_id')
        if dept_id:
            dk = str(dept_id)
            dlabel = info.get('departement', 'N/A')
            if dk not in orgs['dept']:
                orgs['dept'][dk] = {'id': dk, 'label': dlabel, 'minutes': 0, 'sessions': 0}
            orgs['dept'][dk]['minutes'] += mins
            orgs['dept'][dk]['sessions'] += n_sessions
        # Direction
        dir_id = info.get('id_direction')
        if dir_id:
            dirk = str(dir_id)
            dirlabel = info.get('direction', 'N/A')
            if dirk not in orgs['direction']:
                orgs['direction'][dirk] = {'id': dirk, 'label': dirlabel, 'minutes': 0, 'sessions': 0}
            orgs['direction'][dirk]['minutes'] += mins
            orgs['direction'][dirk]['sessions'] += n_sessions
        # Entité
        ent_id = info.get('id_entite')
        if ent_id:
            ek = str(ent_id)
            elabel = info.get('entite', 'N/A')
            if ek not in orgs['entite']:
                orgs['entite'][ek] = {'id': ek, 'label': elabel, 'minutes': 0, 'sessions': 0}
            orgs['entite'][ek]['minutes'] += mins
            orgs['entite'][ek]['sessions'] += n_sessions

    # ── NOUVELLE LOGIQUE : fusion d'intervalles par utilisateur ───────────────
    # Pour eviter le double-comptage (ex: 2 navigateurs ouverts en parallele,
    # ou sessions dupliquees par backfill), on regroupe les sessions par user,
    # on construit les intervalles (start, end) puis on les FUSIONNE.
    # Ainsi un user ne peut JAMAIS depasser la duree physique de la fenetre.

    from datetime import timezone as _tz

    def _to_utc_naive(dt):
        """Convertit un datetime aware en naive UTC (pour comparaison uniforme)."""
        if dt is None:
            return None
        if getattr(dt, 'tzinfo', None) is not None:
            return dt.astimezone(_tz.utc).replace(tzinfo=None)
        return dt

    def _day_window_utc(d):
        """Retourne (start_utc, end_utc) pour le jour calendaire d, en tenant
        compte du fuseau horaire local de l'admin si fourni."""
        if local_tz is not None:
            start_local = datetime.combine(d, datetime.min.time()).replace(tzinfo=local_tz)
            end_local = start_local + timedelta(days=1)
            return (start_local.astimezone(_tz.utc).replace(tzinfo=None),
                    end_local.astimezone(_tz.utc).replace(tzinfo=None))
        return (datetime.combine(d, datetime.min.time()),
                datetime.combine(d, datetime.min.time()) + timedelta(days=1))

    # Fenetres globales par periode (en UTC naive pour comparaison avec date_connexion)
    today_win = _day_window_utc(today)
    week_win = (_day_window_utc(week_start)[0], today_win[1])
    month_win = (_day_window_utc(month_start)[0], today_win[1])
    year_win = (_day_window_utc(year_start)[0], today_win[1])

    # Grouper les sessions par utilisateur
    sessions_by_mat: dict = {}
    for s in all_sessions:
        sessions_by_mat.setdefault(s.matricule, []).append(s)

    # Pour chaque user, calculer les intervals fusionnes UNE FOIS
    merged_by_mat: dict = {}
    for mat, sess_list in sessions_by_mat.items():
        raw = []
        for s in sess_list:
            iv = _session_interval(s, audit_map)
            if iv is not None:
                raw.append((_to_utc_naive(iv[0]), _to_utc_naive(iv[1])))
        merged_by_mat[mat] = _merge_intervals(raw)

    # Compteurs de sessions BRUTES par user et par periode (pour info, pas pour les minutes)
    def _count_sessions_in_window(sess_list, win):
        n = 0
        for s in sess_list:
            d = _to_utc_naive(s.date_connexion)
            if d is not None and win[0] <= d < win[1]:
                n += 1
        return n

    for mat, merged in merged_by_mat.items():
        if not merged:
            continue
        sess_list = sessions_by_mat.get(mat, [])

        # Minutes UNIQUES par periode (intervals fusionnes + clippes a la fenetre)
        year_user_mins = _minutes_in_intervals(_clip_intervals_to_window(merged, *year_win))
        month_user_mins = _minutes_in_intervals(_clip_intervals_to_window(merged, *month_win))
        week_user_mins = _minutes_in_intervals(_clip_intervals_to_window(merged, *week_win))
        today_user_mins = _minutes_in_intervals(_clip_intervals_to_window(merged, *today_win))

        if year_user_mins > 0:
            year_mins += year_user_mins
            year_users.add(mat)
            _acc_orgs(year_orgs, mat, year_user_mins, _count_sessions_in_window(sess_list, year_win))
        if month_user_mins > 0:
            month_mins += month_user_mins
            month_users.add(mat)
            _acc_orgs(month_orgs, mat, month_user_mins, _count_sessions_in_window(sess_list, month_win))
        if week_user_mins > 0:
            week_mins += week_user_mins
            week_users.add(mat)
            _acc_orgs(week_orgs, mat, week_user_mins, _count_sessions_in_window(sess_list, week_win))
        if today_user_mins > 0:
            today_mins += today_user_mins
            today_users.add(mat)
            _acc_orgs(today_orgs, mat, today_user_mins, _count_sessions_in_window(sess_list, today_win))

        # Breakdowns: pour chaque jour de la semaine et du mois,
        # clipper les intervalles a la fenetre du jour et sommer les minutes
        # (garantit que daily[jour] <= 24h * users, etc.)

        # Daily breakdown semaine
        d = week_start
        while d <= today:
            win_d = _day_window_utc(d)
            mins_d = _minutes_in_intervals(_clip_intervals_to_window(merged, *win_d))
            if mins_d > 0:
                key = str(d)
                if key not in week_daily:
                    week_daily[key] = {'total_minutes': 0, 'sessions_count': 0, 'users': set()}
                week_daily[key]['total_minutes'] += mins_d
                week_daily[key]['users'].add(mat)
                week_daily[key]['sessions_count'] += _count_sessions_in_window(sess_list, win_d)
            d += timedelta(days=1)

        # Daily breakdown mois
        d = month_start
        while d <= today:
            win_d = _day_window_utc(d)
            mins_d = _minutes_in_intervals(_clip_intervals_to_window(merged, *win_d))
            if mins_d > 0:
                key = str(d)
                if key not in month_daily:
                    month_daily[key] = {'total_minutes': 0, 'sessions_count': 0, 'users': set()}
                month_daily[key]['total_minutes'] += mins_d
                month_daily[key]['users'].add(mat)
                month_daily[key]['sessions_count'] += _count_sessions_in_window(sess_list, win_d)
            d += timedelta(days=1)

        # Monthly breakdown annee
        for m in range(1, 13):
            try:
                m_start = datetime(today.year, m, 1).date()
            except ValueError:
                continue
            if m == 12:
                m_end = datetime(today.year + 1, 1, 1).date()
            else:
                m_end = datetime(today.year, m + 1, 1).date()
            if m_start > today:
                break
            win_m = (_day_window_utc(m_start)[0], _day_window_utc(m_end)[0])
            mins_m = _minutes_in_intervals(_clip_intervals_to_window(merged, *win_m))
            if mins_m > 0:
                key = str(m)
                if key not in year_monthly:
                    year_monthly[key] = {'total_minutes': 0, 'sessions_count': 0, 'users': set()}
                year_monthly[key]['total_minutes'] += mins_m
                year_monthly[key]['users'].add(mat)
                year_monthly[key]['sessions_count'] += _count_sessions_in_window(sess_list, win_m)

    # Compteurs de sessions globaux (pour today_sessions etc.)
    for s in all_sessions:
        d = _to_utc_naive(s.date_connexion)
        if d is None:
            continue
        if year_win[0] <= d < year_win[1]:
            year_sessions.append(s)
        if month_win[0] <= d < month_win[1]:
            month_sessions.append(s)
        if week_win[0] <= d < week_win[1]:
            week_sessions.append(s)
        if today_win[0] <= d < today_win[1]:
            today_sessions.append(s)

    # Fill zeros: include every employee/dept/direction/entite even with no sessions
    for period_orgs in [today_orgs, week_orgs, month_orgs, year_orgs]:
        for mat, info in emp_info.items():
            k = str(mat)
            if k not in period_orgs['emp']:
                period_orgs['emp'][k] = {'id': k, 'label': info['nom'], 'minutes': 0, 'sessions': 0}
            dept_id = info.get('dept_id')
            if dept_id:
                dk = str(dept_id)
                if dk not in period_orgs['dept']:
                    period_orgs['dept'][dk] = {'id': dk, 'label': info.get('departement', 'N/A'), 'minutes': 0, 'sessions': 0}
            dir_id = info.get('id_direction')
            if dir_id:
                dirk = str(dir_id)
                if dirk not in period_orgs['direction']:
                    period_orgs['direction'][dirk] = {'id': dirk, 'label': info.get('direction', 'N/A'), 'minutes': 0, 'sessions': 0}
            ent_id = info.get('id_entite')
            if ent_id:
                ek = str(ent_id)
                if ek not in period_orgs['entite']:
                    period_orgs['entite'][ek] = {'id': ek, 'label': info.get('entite', 'N/A'), 'minutes': 0, 'sessions': 0}

    def _serialize_breakdown(bd: dict) -> dict:
        return {k: {'total_minutes': v['total_minutes'], 'sessions_count': v['sessions_count'],
                    'users_count': len(v['users'])} for k, v in sorted(bd.items())}

    def _serialize_orgs(orgs: dict) -> dict:
        """Serialize and sort each org dimension by minutes DESC (zeros at bottom)."""
        result = {}
        for dim, entries in orgs.items():
            result[dim] = sorted(entries.values(), key=lambda x: x['minutes'], reverse=True)
        return result

    return {
        'today': {
            'minutes': today_mins,
            'hours': round(today_mins / 60, 2) if today_mins > 0 else 0,
            'sessions': len(today_sessions),
            'users': len(today_users),
            'ranking': _serialize_orgs(today_orgs),
        },
        'week': {
            'minutes': week_mins,
            'hours': round(week_mins / 60, 2) if week_mins > 0 else 0,
            'sessions': len(week_sessions),
            'users': len(week_users),
            'daily_breakdown': _serialize_breakdown(week_daily),
            'ranking': _serialize_orgs(week_orgs),
        },
        'month': {
            'minutes': month_mins,
            'hours': round(month_mins / 60, 2) if month_mins > 0 else 0,
            'sessions': len(month_sessions),
            'users': len(month_users),
            'daily_breakdown': _serialize_breakdown(month_daily),
            'ranking': _serialize_orgs(month_orgs),
        },
        'year': {
            'minutes': year_mins,
            'hours': round(year_mins / 60, 2) if year_mins > 0 else 0,
            'sessions': len(year_sessions),
            'users': len(year_users),
            'monthly_breakdown': _serialize_breakdown(year_monthly),
            'ranking': _serialize_orgs(year_orgs),
        },
    }
