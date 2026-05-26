from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from .. import models, schemas
from ..db import get_db
from ..utils.audit import log_action


def _actor_from_request(request: Request | None):
    """Extrait le matricule acteur + IP depuis un Request FastAPI (best-effort)."""
    if request is None:
        return None, None
    actor = None
    ip = request.client.host if request.client else None
    auth = request.headers.get('authorization', '')
    if auth.lower().startswith('bearer '):
        try:
            from ..utils import security as _sec
            token_data = _sec.jwt.decode(auth.split(None, 1)[1], _sec.SECRET_KEY, algorithms=[_sec.ALGORITHM])
            actor = token_data.get('matricule') or token_data.get('sub')
        except Exception:
            actor = None
    return actor, ip


router = APIRouter(prefix='/employees', tags=['organisation'])


@router.get('/pays')
def get_pays(db: Session = Depends(get_db)):
    """Récupère tous les pays"""
    try:
        from ..utils.world_data import get_flag_by_code
        pays_list = db.query(models.Pays).all()
        return [{'id_pays': p.id_pays, 'nom_pays': p.nom_pays, 'code_pays': p.code_pays, 'flag': get_flag_by_code(p.code_pays)} for p in pays_list]
    except Exception as e:
        import traceback
        print(f"ERROR in get_pays: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


@router.post('/pays')
def create_pays(payload: schemas.PaysCreate, db: Session = Depends(get_db)):
    """Créer un nouveau pays"""
    from ..utils.world_data import get_flag_by_code
    
    existing = db.query(models.Pays).filter(models.Pays.code_pays == payload.code_pays.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail='Code pays existe déjà')
    
    pays = models.Pays(nom_pays=payload.nom_pays, code_pays=payload.code_pays.upper())
    db.add(pays)
    db.commit()
    db.refresh(pays)
    return {
        'id_pays': pays.id_pays,
        'nom_pays': pays.nom_pays,
        'code_pays': pays.code_pays,
        'flag': get_flag_by_code(pays.code_pays)
    }


@router.delete('/pays/{id_pays}')
def delete_pays(id_pays: int, db: Session = Depends(get_db)):
    """Supprimer un pays et toutes ses villes et implantations associées"""
    pays = db.query(models.Pays).filter(models.Pays.id_pays == id_pays).first()
    if not pays:
        raise HTTPException(status_code=404, detail='Pays non trouvé')
    
    # Récupérer toutes les villes du pays
    villes = db.query(models.Localisation).filter(models.Localisation.id_pays == id_pays).all()
    
    # Supprimer les implantations pour chaque ville
    for ville in villes:
        db.query(models.Implantation).filter(models.Implantation.id_localisation == ville.id_localisation).delete()
    
    # Supprimer toutes les villes du pays
    db.query(models.Localisation).filter(models.Localisation.id_pays == id_pays).delete()
    
    # Supprimer le pays
    db.delete(pays)
    db.commit()
    return {'status': 'ok'}


@router.get('/pays/{id_pays}/villes')
def get_villes_by_pays(id_pays: int, db: Session = Depends(get_db)):
    """Récupère les villes d'un pays"""
    from ..utils.world_data import get_flag_by_code
    pays = db.query(models.Pays).filter(models.Pays.id_pays == id_pays).first()
    if not pays:
        raise HTTPException(status_code=404, detail='Pays non trouvé')
    
    villes = db.query(models.Localisation).filter(models.Localisation.id_pays == id_pays).all()
    return [{'id_localisation': v.id_localisation, 'ville': v.ville, 'id_pays': v.id_pays, 'flag': get_flag_by_code(pays.code_pays)} for v in villes]


@router.get('/pays-avec-entites')
def get_pays_avec_entites(db: Session = Depends(get_db)):
    """Récupère tous les pays présents dans la base de données"""
    from ..utils.world_data import get_flag_by_code
    try:
        pays_list = db.query(models.Pays).all()
        return [{'id_pays': p.id_pays, 'nom_pays': p.nom_pays, 'code_pays': p.code_pays, 'flag': get_flag_by_code(p.code_pays)} for p in pays_list]
    except Exception:
        return []


@router.get('/pays/{id_pays}/villes-avec-entites')
def get_villes_avec_entites(id_pays: int, db: Session = Depends(get_db)):
    """Récupère toutes les villes d'un pays présentes dans la base de données"""
    from ..utils.world_data import get_flag_by_code
    pays = db.query(models.Pays).filter(models.Pays.id_pays == id_pays).first()
    if not pays:
        raise HTTPException(status_code=404, detail='Pays non trouvé')
    try:
        villes = db.query(models.Localisation).filter(models.Localisation.id_pays == id_pays).all()
        return [{'id_localisation': v.id_localisation, 'ville': v.ville, 'id_pays': v.id_pays, 'flag': get_flag_by_code(pays.code_pays)} for v in villes]
    except Exception:
        return []


@router.post('/villes')
def create_ville(payload: schemas.VilleCreate, db: Session = Depends(get_db)):
    """Créer une nouvelle ville"""
    from ..utils.world_data import get_flag_by_code
    
    pays = db.query(models.Pays).filter(models.Pays.id_pays == payload.id_pays).first()
    if not pays:
        raise HTTPException(status_code=404, detail='Pays non trouvé')
    
    existing = db.query(models.Localisation).filter(
        models.Localisation.ville == payload.nom,
        models.Localisation.id_pays == payload.id_pays
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Ville existe déjà dans ce pays')
    
    ville = models.Localisation(ville=payload.nom, id_pays=payload.id_pays)
    db.add(ville)
    db.commit()
    db.refresh(ville)
    return {
        'id_localisation': ville.id_localisation,
        'ville': ville.ville,
        'id_pays': ville.id_pays,
        'flag': get_flag_by_code(pays.code_pays)
    }


@router.delete('/villes/{id_localisation}')
def delete_ville(id_localisation: int, db: Session = Depends(get_db)):
    """Supprimer une ville et ses implantations associées"""
    ville = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
    if not ville:
        raise HTTPException(status_code=404, detail='Ville non trouvée')
    
    # Supprimer d'abord les implantations associées
    db.query(models.Implantation).filter(models.Implantation.id_localisation == id_localisation).delete()
    # Puis supprimer la ville
    db.delete(ville)
    db.commit()
    return {'status': 'ok'}


@router.get('/villes/{id_localisation}/entites-structure')
def get_entites_structure_by_ville(id_localisation: int, db: Session = Depends(get_db)):
    """Get organization structure for a city"""
    ville = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
    if not ville:
        raise HTTPException(status_code=404, detail='Ville non trouvée')
    
    # Get all entites for this localisation through Implantation
    implantations = db.query(models.Implantation).filter(models.Implantation.id_localisation == id_localisation).all()
    entite_ids = [imp.id_entite for imp in implantations]
    
    if not entite_ids:
        return []
    
    entites = db.query(models.Entite).filter(models.Entite.id_entite.in_(entite_ids)).all()
    
    result = []
    for e in entites:
        # Get all directions for this entite
        directions = db.query(models.Direction).filter(models.Direction.id_entite == e.id_entite).all()
        directions_list = []
        for d in directions:
            # Count departments for each direction
            dept_count = db.query(models.Departement).filter(models.Departement.id_direction == d.id_direction).count()
            directions_list.append({
                'id_direction': d.id_direction,
                'nom': d.nom,
                'departements_count': dept_count
            })
        
        result.append({
            'id_entite': e.id_entite,
            'nom': e.nom,
            'directions_count': len(directions_list),
            'directions': directions_list
        })
    return result


@router.get('/villes/{id_localisation}/directions-structure')
def get_directions_structure_by_ville(id_localisation: int, db: Session = Depends(get_db)):
    """Get directions for a city"""
    ville = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
    if not ville:
        raise HTTPException(status_code=404, detail='Ville non trouvée')
    
    # Get all entites for this localisation
    implantations = db.query(models.Implantation).filter(models.Implantation.id_localisation == id_localisation).all()
    entite_ids = [imp.id_entite for imp in implantations]
    
    if not entite_ids:
        return []
    
    # Get directions for those entites
    directions = db.query(models.Direction).filter(models.Direction.id_entite.in_(entite_ids)).all()
    
    result = []
    for d in directions:
        # Get the entite name
        entite = db.query(models.Entite).filter(models.Entite.id_entite == d.id_entite).first()
        # Get all departments for this direction
        departements = db.query(models.Departement).filter(models.Departement.id_direction == d.id_direction).all()
        departements_list = []
        for dept in departements:
            departements_list.append({
                'dept_id': dept.dept_id,
                'nom': dept.nom
            })
        
        result.append({
            'id_direction': d.id_direction,
            'id_entite': d.id_entite,
            'nom': d.nom,
            'entite_nom': entite.nom if entite else '',
            'departements_count': len(departements_list),
            'departements': departements_list
        })
    return result


@router.get('/villes/{id_localisation}/departements')
def get_departements_by_ville(id_localisation: int, db: Session = Depends(get_db)):
    """Get departments explicitly linked to a city via DEPARTEMENT_IMPLANTATION."""
    ville = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
    if not ville:
        raise HTTPException(status_code=404, detail='Ville non trouvée')

    liaisons = db.query(models.DepartementImplantation).filter(
        models.DepartementImplantation.id_localisation == id_localisation
    ).all()
    dept_ids = set(li.dept_id for li in liaisons)

    if not dept_ids:
        return []

    depts = db.query(models.Departement).filter(
        models.Departement.dept_id.in_(dept_ids)
    ).all()

    result = []
    for d in depts:
        entite = db.query(models.Entite).filter(models.Entite.id_entite == d.id_entite).first()
        direction = None
        if d.id_direction:
            direction = db.query(models.Direction).filter(models.Direction.id_direction == d.id_direction).first()

        result.append({
            'dept_id': d.dept_id,
            'nom': d.nom,
            'id_entite': d.id_entite,
            'entite_nom': entite.nom if entite else '',
            'id_direction': d.id_direction,
            'direction_nom': direction.nom if direction else '',
        })
    return result


@router.get('/world-countries')
def get_world_countries(db: Session = Depends(get_db)):
    """Get all world countries"""
    from ..utils.world_data import get_all_countries
    try:
        countries = get_all_countries()
        return countries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur chargement pays: {str(e)}")


@router.get('/world-countries/search')
def search_world_countries(q: str, db: Session = Depends(get_db)):
    """Recherche de pays dans la base mondiale"""
    from ..utils.world_geo_service import search_countries
    from ..utils.world_data import search_countries as fallback_search_countries
    try:
        results = search_countries(q)
        return results
    except Exception as e:
        # Fallback local si l'API externe est indisponible
        try:
            return fallback_search_countries(q)
        except Exception:
            raise HTTPException(status_code=500, detail=f"Erreur recherche: {str(e)}")


@router.get('/world-cities/search')
def search_world_cities(country_code: str, q: str, db: Session = Depends(get_db)):
    """Recherche de villes pour un pays"""
    from ..utils.world_geo_service import search_cities
    from ..utils.world_data import search_cities as fallback_search_cities
    try:
        results = search_cities(country_code, q)
        return results
    except Exception as e:
        # Fallback local si l'API externe est indisponible
        try:
            return fallback_search_cities(country_code, q)
        except Exception:
            raise HTTPException(status_code=500, detail=f"Erreur recherche: {str(e)}")


# ==================== ENTITES ====================

@router.get('/entites')
def get_all_entites(id_localisation: int = None, db: Session = Depends(get_db)):
    """Get all entites from database with nested directions"""
    entites_query = db.query(models.Entite)
    if id_localisation:
        entites_query = entites_query.join(
            models.Implantation,
            models.Implantation.id_entite == models.Entite.id_entite
        ).filter(models.Implantation.id_localisation == id_localisation)
    entites = entites_query.all()
    result = []
    for e in entites:
        # Get all directions for this entite
        directions_query = db.query(models.Direction).filter(models.Direction.id_entite == e.id_entite)
        if id_localisation:
            directions_query = directions_query.filter(models.Direction.id_localisation == id_localisation)
        directions = directions_query.all()
        directions_list = []
        for d in directions:
            # Count departments for each direction
            dept_query = db.query(models.Departement).filter(models.Departement.id_direction == d.id_direction)
            dept_count = dept_query.count()
            directions_list.append({
                'id_direction': d.id_direction,
                'nom': d.nom,
                'departements_count': dept_count
            })
        
        result.append({
            'id_entite': e.id_entite,
            'nom': e.nom,
            'directions_count': len(directions_list),
            'directions': directions_list
        })
    return result


@router.post('/entites')
def create_entite(data: dict, request: Request = None, db: Session = Depends(get_db)):
    """Create a new entite"""
    nom = data.get('nom')
    id_localisation = data.get('id_localisation')
    
    if not nom:
        raise HTTPException(status_code=400, detail='Nom est requis')
    
    # Check if entite already exists
    existing = db.query(models.Entite).filter(models.Entite.nom == nom).first()
    if existing:
        raise HTTPException(status_code=400, detail='Entité existe déjà')
    
    # Create entite
    entite = models.Entite(nom=nom)
    db.add(entite)
    db.commit()
    db.refresh(entite)
    
    # If localisation is specified, create implantation
    if id_localisation:
        localisation = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
        if localisation:
            implantation = models.Implantation(id_localisation=id_localisation, id_entite=entite.id_entite)
            db.add(implantation)
            db.commit()

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'CREATE_ENTITE', 'ENTITE', entite.id_entite, {'nom': entite.nom, 'id_localisation': id_localisation}, ip_address=ip)
    return {'id_entite': entite.id_entite, 'nom': entite.nom, 'directions_count': 0}


# ==================== DIRECTIONS ====================

@router.get('/directions')
def get_all_directions(id_localisation: int = None, db: Session = Depends(get_db)):
    """Get all directions from database with nested departements"""
    directions_query = db.query(models.Direction)
    if id_localisation:
        directions_query = directions_query.filter(models.Direction.id_localisation == id_localisation)
    directions = directions_query.all()
    result = []
    for d in directions:
        # Get the entite name
        entite = db.query(models.Entite).filter(models.Entite.id_entite == d.id_entite).first()
        # Get all departments for this direction
        departements_query = db.query(models.Departement).filter(models.Departement.id_direction == d.id_direction)
        departements = departements_query.all()
        departements_list = []
        for dept in departements:
            departements_list.append({
                'dept_id': dept.dept_id,
                'nom': dept.nom
            })
        
        result.append({
            'id_direction': d.id_direction,
            'id_entite': d.id_entite,
            'id_localisation': d.id_localisation,
            'nom': d.nom,
            'entite_nom': entite.nom if entite else '',
            'departements_count': len(departements_list),
            'departements': departements_list
        })
    return result


@router.post('/directions')
def create_direction(data: dict, request: Request = None, db: Session = Depends(get_db)):
    """Create a new direction"""
    nom = data.get('nom')
    id_entite = data.get('id_entite')
    id_localisation = data.get('id_localisation')
    
    if not nom or not id_entite:
        raise HTTPException(status_code=400, detail='Nom et id_entite sont requis')
    
    # Check if entite exists
    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=400, detail='Entité invalide')

    if not id_localisation:
        # Auto-resolve from entite's implantation
        impl = db.query(models.Implantation).filter(models.Implantation.id_entite == id_entite).first()
        if impl:
            id_localisation = impl.id_localisation
        else:
            raise HTTPException(status_code=400, detail='id_localisation est requis (aucune implantation trouvée pour cette entité)')

    localisation = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
    if not localisation:
        raise HTTPException(status_code=400, detail='Localisation invalide')
    
    # Create direction
    direction = models.Direction(nom=nom, id_entite=id_entite, id_localisation=id_localisation)
    db.add(direction)
    db.commit()
    db.refresh(direction)

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'CREATE_DIRECTION', 'DIRECTION', direction.id_direction, {'nom': direction.nom, 'id_entite': id_entite, 'id_localisation': id_localisation}, ip_address=ip)
    return {
        'id_direction': direction.id_direction,
        'id_entite': direction.id_entite,
        'id_localisation': direction.id_localisation,
        'nom': direction.nom,
        'entite_nom': entite.nom,
        'departements_count': 0
    }


# ==================== DEPARTEMENTS ====================

@router.get('/villes')
def get_villes_by_entite(id_entite: int = None, db: Session = Depends(get_db)):
    """Return all cities where a given entity is implanted (used by Administration create-dept form)."""
    if id_entite is None:
        raise HTTPException(status_code=400, detail='id_entite est requis')
    from ..utils.world_data import get_flag_by_code
    implantations = db.query(models.Implantation).filter(
        models.Implantation.id_entite == id_entite
    ).all()
    result = []
    for impl in implantations:
        loc = db.query(models.Localisation).filter(
            models.Localisation.id_localisation == impl.id_localisation
        ).first()
        if loc:
            pays = db.query(models.Pays).filter(models.Pays.id_pays == loc.id_pays).first()
            flag = get_flag_by_code(pays.code_pays) if pays else ''
            result.append({
                'id_localisation': loc.id_localisation,
                'ville': loc.ville,
                'id_pays': loc.id_pays,
                'flag': flag,
            })
    return result


@router.get('/departements')
def get_all_departements(id_localisation: int = None, id_pays: int = None, db: Session = Depends(get_db)):
    """Get all departements, optionally filtered by localisation or pays via DEPARTEMENT_IMPLANTATION."""
    if id_pays is not None:
        # Pays → Localisation → DEPARTEMENT_IMPLANTATION → Département
        locs = db.query(models.Localisation).filter(models.Localisation.id_pays == id_pays).all()
        loc_ids = [l.id_localisation for l in locs]
        if not loc_ids:
            return []
        liaisons = db.query(models.DepartementImplantation).filter(
            models.DepartementImplantation.id_localisation.in_(loc_ids)
        ).all()
        dept_ids = list({li.dept_id for li in liaisons})
        if not dept_ids:
            return []
        departements = db.query(models.Departement).filter(
            models.Departement.dept_id.in_(dept_ids)
        ).all()
    elif id_localisation is not None:
        # Localisation → DEPARTEMENT_IMPLANTATION → Département
        liaisons = db.query(models.DepartementImplantation).filter(
            models.DepartementImplantation.id_localisation == id_localisation
        ).all()
        dept_ids = set(li.dept_id for li in liaisons)
        if not dept_ids:
            return []
        departements = db.query(models.Departement).filter(
            models.Departement.dept_id.in_(list(dept_ids))
        ).all()
    else:
        departements = db.query(models.Departement).all()

    result = []
    for d in departements:
        entite = db.query(models.Entite).filter(models.Entite.id_entite == d.id_entite).first()
        direction = None
        if d.id_direction:
            direction = db.query(models.Direction).filter(models.Direction.id_direction == d.id_direction).first()
        # When filtering by a specific city, use that city directly to avoid
        # .first() returning a different linked city (e.g. Yaoundé when browsing Douala)
        if id_localisation is not None:
            id_loc = id_localisation
        else:
            di = db.query(models.DepartementImplantation).filter(
                models.DepartementImplantation.dept_id == d.dept_id
            ).first()
            id_loc = di.id_localisation if di else None
        localisation_nom = ''
        pays_nom = ''
        pays_id = None
        if id_loc:
            loc = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_loc).first()
            if loc:
                localisation_nom = loc.ville
                pays = db.query(models.Pays).filter(models.Pays.id_pays == loc.id_pays).first()
                if pays:
                    pays_nom = pays.nom_pays
                    pays_id = pays.id_pays

        result.append({
            'dept_id': d.dept_id,
            'nom': d.nom,
            'id_entite': d.id_entite,
            'entite_nom': entite.nom if entite else '',
            'id_direction': d.id_direction,
            'direction_nom': direction.nom if direction else '',
            'id_localisation': id_loc,
            'localisation_nom': localisation_nom,
            'id_pays': pays_id,
            'pays_nom': pays_nom,
        })
    return result


@router.post('/departements')
def create_departement(data: dict, request: Request = None, db: Session = Depends(get_db)):
    """Create a new departement.

    Optional city-linking fields:
    - id_localisation (int): single city — used by Organisation (city context).
    - villes_ids (list[int]): multiple cities — used by Administration.
    Both are validated: (id_entite, id_localisation) must exist in Implantation.
    """
    nom = data.get('nom')
    id_entite = data.get('id_entite')
    id_direction = data.get('id_direction')
    id_localisation = data.get('id_localisation')  # from Organisation
    villes_ids = data.get('villes_ids') or []      # from Administration

    if not nom or not id_entite:
        raise HTTPException(status_code=400, detail='Nom et id_entite sont requis')

    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=400, detail='Entité invalide')

    direction = None
    if id_direction:
        direction = db.query(models.Direction).filter(models.Direction.id_direction == id_direction).first()
        if not direction:
            raise HTTPException(status_code=400, detail='Direction invalide')

    # Build the full list of city ids to link
    all_loc_ids = list({int(i) for i in villes_ids})
    if id_localisation:
        all_loc_ids = list({*all_loc_ids, int(id_localisation)})

    # Validate each city: entity must be implanted there
    for loc_id in all_loc_ids:
        impl = db.query(models.Implantation).filter(
            models.Implantation.id_entite == id_entite,
            models.Implantation.id_localisation == loc_id,
        ).first()
        if not impl:
            raise HTTPException(
                status_code=400,
                detail=f"L'entité n'est pas implantée dans la ville id={loc_id}"
            )

    departement = models.Departement(
        nom=nom,
        id_entite=id_entite,
        id_direction=id_direction,
    )
    db.add(departement)
    db.flush()  # get dept_id before creating liaisons

    for loc_id in all_loc_ids:
        db.add(models.DepartementImplantation(
            dept_id=departement.dept_id,
            id_localisation=loc_id,
        ))

    db.commit()
    db.refresh(departement)

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'CREATE_DEPARTEMENT', 'DEPARTEMENT', departement.dept_id, {'nom': departement.nom, 'id_entite': id_entite, 'id_direction': id_direction, 'villes_ids': all_loc_ids}, ip_address=ip)
    return {
        'dept_id': departement.dept_id,
        'nom': departement.nom,
        'id_entite': departement.id_entite,
        'entite_nom': entite.nom,
        'id_direction': departement.id_direction,
        'direction_nom': direction.nom if direction else '',
    }


@router.post('/departements/{dept_id}/villes/{id_localisation}')
def link_departement_to_ville(dept_id: int, id_localisation: int, db: Session = Depends(get_db)):
    """Link an existing department to a city (Organisation — Lier un département)."""
    dept = db.query(models.Departement).filter(models.Departement.dept_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail='Département non trouvé')

    loc = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
    if not loc:
        raise HTTPException(status_code=404, detail='Ville non trouvée')

    impl = db.query(models.Implantation).filter(
        models.Implantation.id_entite == dept.id_entite,
        models.Implantation.id_localisation == id_localisation,
    ).first()
    if not impl:
        raise HTTPException(
            status_code=400,
            detail="L'entité de ce département n'est pas implantée dans cette ville"
        )

    existing = db.query(models.DepartementImplantation).filter(
        models.DepartementImplantation.dept_id == dept_id,
        models.DepartementImplantation.id_localisation == id_localisation,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Département déjà lié à cette ville')

    db.add(models.DepartementImplantation(dept_id=dept_id, id_localisation=id_localisation))
    db.commit()
    return {'status': 'ok', 'dept_id': dept_id, 'id_localisation': id_localisation}


@router.delete('/departements/{dept_id}/villes/{id_localisation}')
def unlink_departement_from_ville(dept_id: int, id_localisation: int, db: Session = Depends(get_db)):
    """Remove a department from a city (Organisation — Retirer de cette ville).
    Does NOT delete the department itself.
    """
    liaison = db.query(models.DepartementImplantation).filter(
        models.DepartementImplantation.dept_id == dept_id,
        models.DepartementImplantation.id_localisation == id_localisation,
    ).first()
    if not liaison:
        raise HTTPException(status_code=404, detail='Liaison département-ville non trouvée')

    db.delete(liaison)
    db.commit()
    return {'status': 'ok', 'message': 'Département retiré de la ville'}


# ==================== ENTITES - DELETE & UPDATE ====================

@router.put('/entites/{id_entite}')
def update_entite(id_entite: int, data: dict, request: Request = None, db: Session = Depends(get_db)):
    """Update an entite"""
    nom = data.get('nom')
    
    if not nom:
        raise HTTPException(status_code=400, detail='Nom est requis')
    
    # Check if entite exists
    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=404, detail='Entité non trouvée')
    
    # Check if new name already exists (for another entite)
    existing = db.query(models.Entite).filter(
        models.Entite.nom == nom,
        models.Entite.id_entite != id_entite
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Entité avec ce nom existe déjà')
    
    # Update entite
    old_nom = entite.nom
    entite.nom = nom
    db.commit()
    db.refresh(entite)

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'UPDATE_ENTITE', 'ENTITE', entite.id_entite, {'old_nom': old_nom, 'new_nom': entite.nom}, ip_address=ip)

    # Count directions
    dir_count = db.query(models.Direction).filter(models.Direction.id_entite == entite.id_entite).count()

    return {
        'id_entite': entite.id_entite,
        'nom': entite.nom,
        'directions_count': dir_count
    }


@router.delete('/entites/{id_entite}')
def delete_entite(id_entite: int, request: Request = None, db: Session = Depends(get_db)):
    """Delete an entite"""
    # Check if entite exists
    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=404, detail='Entité non trouvée')
    
    # Delete all implantations for this entite
    db.query(models.Implantation).filter(models.Implantation.id_entite == id_entite).delete()
    
    # Delete all directions for this entite (and their departments)
    directions = db.query(models.Direction).filter(models.Direction.id_entite == id_entite).all()
    for direction in directions:
        db.query(models.Departement).filter(models.Departement.id_direction == direction.id_direction).delete()
    db.query(models.Direction).filter(models.Direction.id_entite == id_entite).delete()
    
    # Delete all departments directly linked to this entite
    db.query(models.Departement).filter(models.Departement.id_entite == id_entite).delete()
    
    # Delete entite
    entite_nom = entite.nom
    db.delete(entite)
    db.commit()

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'DELETE_ENTITE', 'ENTITE', id_entite, {'nom': entite_nom}, ip_address=ip)

    return {'status': 'ok', 'message': 'Entité supprimée avec succès'}


# ==================== DIRECTIONS - DELETE & UPDATE ====================

@router.put('/directions/{id_direction}')
def update_direction(id_direction: int, data: dict, request: Request = None, db: Session = Depends(get_db)):
    """Update a direction"""
    nom = data.get('nom')
    id_entite = data.get('id_entite')
    id_localisation = data.get('id_localisation')
    
    if not nom:
        raise HTTPException(status_code=400, detail='Nom est requis')
    
    # Check if direction exists
    direction = db.query(models.Direction).filter(models.Direction.id_direction == id_direction).first()
    if not direction:
        raise HTTPException(status_code=404, detail='Direction non trouvée')
    
    # If changing entite, verify it exists
    if id_entite and id_entite != direction.id_entite:
        entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
        if not entite:
            raise HTTPException(status_code=400, detail='Entité invalide')
        direction.id_entite = id_entite

    if id_localisation:
        localisation = db.query(models.Localisation).filter(models.Localisation.id_localisation == id_localisation).first()
        if not localisation:
            raise HTTPException(status_code=400, detail='Localisation invalide')
        direction.id_localisation = id_localisation
    
    # Update direction
    old_nom = direction.nom
    direction.nom = nom
    db.commit()
    db.refresh(direction)

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'UPDATE_DIRECTION', 'DIRECTION', direction.id_direction, {'old_nom': old_nom, 'new_nom': direction.nom, 'id_entite': direction.id_entite, 'id_localisation': direction.id_localisation}, ip_address=ip)

    # Get entite name
    entite = db.query(models.Entite).filter(models.Entite.id_entite == direction.id_entite).first()
    
    # Count departments
    dept_count = db.query(models.Departement).filter(models.Departement.id_direction == direction.id_direction).count()
    
    return {
        'id_direction': direction.id_direction,
        'id_entite': direction.id_entite,
        'id_localisation': direction.id_localisation,
        'nom': direction.nom,
        'entite_nom': entite.nom if entite else '',
        'departements_count': dept_count
    }


@router.delete('/directions/{id_direction}')
def delete_direction(id_direction: int, request: Request = None, db: Session = Depends(get_db)):
    """Delete a direction"""
    # Check if direction exists
    direction = db.query(models.Direction).filter(models.Direction.id_direction == id_direction).first()
    if not direction:
        raise HTTPException(status_code=404, detail='Direction non trouvée')
    
    # Delete all departments for this direction
    db.query(models.Departement).filter(models.Departement.id_direction == id_direction).delete()

    # Delete direction
    direction_nom = direction.nom
    db.delete(direction)
    db.commit()

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'DELETE_DIRECTION', 'DIRECTION', id_direction, {'nom': direction_nom}, ip_address=ip)

    return {'status': 'ok', 'message': 'Direction supprimée avec succès'}


# ==================== DEPARTEMENTS - DELETE & UPDATE ====================

@router.put('/departements/{dept_id}')
def update_departement(dept_id: int, data: dict, request: Request = None, db: Session = Depends(get_db)):
    """Update a departement"""
    nom = data.get('nom')
    id_entite = data.get('id_entite')
    id_direction = data.get('id_direction')
    
    if not nom or not id_entite:
        raise HTTPException(status_code=400, detail='Nom et id_entite sont requis')
    
    # Check if departement exists
    departement = db.query(models.Departement).filter(models.Departement.dept_id == dept_id).first()
    if not departement:
        raise HTTPException(status_code=404, detail='Département non trouvé')
    
    # Check if entite exists
    entite = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    if not entite:
        raise HTTPException(status_code=400, detail='Entité invalide')
    
    # Check if direction exists (if specified)
    direction = None
    if id_direction:
        direction = db.query(models.Direction).filter(models.Direction.id_direction == id_direction).first()
        if not direction:
            raise HTTPException(status_code=400, detail='Direction invalide')
    
    # Update departement
    old_snapshot = {'nom': departement.nom, 'id_entite': departement.id_entite, 'id_direction': departement.id_direction}
    departement.nom = nom
    departement.id_entite = id_entite
    departement.id_direction = id_direction
    db.commit()
    db.refresh(departement)

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'UPDATE_DEPARTEMENT', 'DEPARTEMENT', departement.dept_id, {'before': old_snapshot, 'after': {'nom': departement.nom, 'id_entite': departement.id_entite, 'id_direction': departement.id_direction}}, ip_address=ip)

    return {
        'dept_id': departement.dept_id,
        'nom': departement.nom,
        'id_entite': departement.id_entite,
        'entite_nom': entite.nom,
        'id_direction': departement.id_direction,
        'direction_nom': direction.nom if direction else '',
    }


@router.delete('/departements/{dept_id}')
def delete_departement(dept_id: int, request: Request = None, db: Session = Depends(get_db)):
    """Delete a departement"""
    # Check if departement exists
    departement = db.query(models.Departement).filter(models.Departement.dept_id == dept_id).first()
    if not departement:
        raise HTTPException(status_code=404, detail='Département non trouvé')
    
    # Delete departement
    dept_nom = departement.nom
    db.delete(departement)
    db.commit()

    actor, ip = _actor_from_request(request)
    log_action(db, actor, 'DELETE_DEPARTEMENT', 'DEPARTEMENT', dept_id, {'nom': dept_nom}, ip_address=ip)

    return {'status': 'ok', 'message': 'Département supprimé avec succès'}
