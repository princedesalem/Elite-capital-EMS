from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..db import get_db
from .. import crud, schemas, models
from ..utils import security
from ..utils.world_data import WORLD_COUNTRIES, WORLD_CITIES
from datetime import datetime, timedelta
from typing import Optional

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
    'chargé Back Office & operations'
]


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
    except security.jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Token invalide')


def _serialize_employee(e: models.Employe, db: Session):
    data = schemas.EmployeOut.model_validate(e).model_dump()
    role = db.query(models.Role).filter(models.Role.id == e.id_role).first() if e.id_role else None
    entite = db.query(models.Entite).filter(models.Entite.id_entite == e.id_entite).first() if e.id_entite else None
    data['role'] = role.name if role else None
    data['entite'] = entite.nom if entite else None
    return data


def _prepare_employee_payload(payload: schemas.EmployeBase, db: Session):
    source = payload.model_dump()
    role_name = source.pop('role', None)
    entite_input = source.pop('entite', None)
    direction_input = source.pop('direction', None)
    categorie_input = source.pop('categorie', None)
    anciennete = source.pop('anciennete', None)  # read-only, ignore on write

    valid_fields = {
        'matricule', 'nom', 'prenom', 'date_naissance', 'sexe', 'telephone', 'email',
        'diplome', 'solde_conges', 'date_embauche', 'fonction', 'annee_experience', 'n1'
    }
    cleaned = {k: v for k, v in source.items() if k in valid_fields}

    if cleaned.get('matricule') is not None and cleaned.get('matricule') != '':
        cleaned['matricule'] = int(cleaned['matricule'])
    if cleaned.get('n1') is not None and cleaned.get('n1') != '':
        cleaned['n1'] = int(cleaned['n1'])
    elif 'n1' in cleaned and not cleaned['n1']:
        cleaned['n1'] = None

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

    if categorie_input:
        cleaned['categorie'] = categorie_input

    return cleaned


@router.get('/', response_model=list[schemas.EmployeOut])
def list_employees(db: Session = Depends(get_db)):
    return [_serialize_employee(e, db) for e in crud.get_employes(db)]


@router.post('/', response_model=schemas.EmployeOut)
def create_employee(payload: schemas.EmployeBase, db: Session = Depends(get_db)):
    data = _prepare_employee_payload(payload, db)
    existing = crud.get_employe(db, data.get('matricule'))
    if existing:
        raise HTTPException(status_code=400, detail='Matricule existe')
    created = crud.create_employe(db, data)
    return _serialize_employee(created, db)


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


@router.get('/autocomplete/sexe')
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
def get_departements(id_direction: int = None, db: Session = Depends(get_db)):
    """Liste des départements pour auto-complétion (filtrable par direction)"""
    query = db.query(models.Departement)
    if id_direction:
        query = query.filter(models.Departement.id_direction == id_direction)
    departements = query.all()
    return [
        {"value": d.dept_id, "label": d.dept_name}
        for d in departements
    ]


@router.get('/autocomplete/directions')
def get_directions(id_entite: int = None, db: Session = Depends(get_db)):
    """Liste des directions pour auto-complétion (filtrable par entité)"""
    query = db.query(models.Direction)
    if id_entite:
        # Filtrer par entité via les départements
        query = query.join(models.Departement).join(
            models.Employe
        ).filter(models.Employe.id_entite == id_entite)
    directions = query.distinct().all()
    return [
        {"value": d.id_direction, "label": d.nom}
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


@router.get('/autocomplete/fonctions')
def get_fonctions(db: Session = Depends(get_db)):
    """Liste des fonctions pour auto-complétion.

    Source prioritaire: table de référence FONCTION_REFERENCE.
    Fallback: fonctions distinctes déjà présentes dans EMPLOYE.
    """
    _seed_default_fonctions(db)
    role_names = _role_names_set(db)
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

    created = models.FonctionReference(libelle=libelle)
    db.add(created)
    db.commit()
    db.refresh(created)
    return {"id_fonction": created.id_fonction, "libelle": created.libelle, "created": True}


@router.get('/admin/fonctions-reference')
def list_fonctions_reference(request: Request, db: Session = Depends(get_db)):
    """Liste des fonctions de référence (Admin seulement)."""
    _check_admin_role(request)
    _seed_default_fonctions(db)
    role_names = _role_names_set(db)

    fonctions = db.query(models.FonctionReference).order_by(models.FonctionReference.libelle.asc()).all()
    return [
        {"id_fonction": f.id_fonction, "libelle": f.libelle}
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
    db.commit()
    db.refresh(current)
    return {"id_fonction": current.id_fonction, "libelle": current.libelle, "updated": True}


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
    diplomes = db.query(models.Employe.diplome).distinct().filter(
        models.Employe.diplome.isnot(None)
    ).all()
    return [
        {"value": d[0], "label": d[0]}
        for d in diplomes
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
def create_departement(nom: str, id_entite: int, request: Request, id_direction: int = None, id_localisation: int = None, cree_par: int = None, db: Session = Depends(get_db)):
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
    """Récupère toutes les entités avec leurs directions et départements (Admin seulement)"""
    _check_admin_role(request)
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
    """Récupère toutes les directions avec leurs départements (Admin seulement)"""
    _check_admin_role(request)
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
    """Récupère tous les départements (Admin seulement)"""
    _check_admin_role(request)
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

@router.post('/sessions/login')
def record_session_login(matricule: int, request: Request, db: Session = Depends(get_db)):
    """Enregistrer le login d'un utilisateur"""
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
    return {'id_session': session.id_session, 'status': 'logged_in'}


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
