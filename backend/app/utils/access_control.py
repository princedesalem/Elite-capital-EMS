from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from .. import models
from ..utils import security


MISSION_INITIATOR_ROLES = {'RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'PCA', 'AG', 'ADMIN'}
GLOBAL_ROLES = {'RH', 'PCA', 'AG', 'ADMIN'}


def get_actor_from_request(request: Request) -> tuple[int | None, str | None]:
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

    matricule = payload.get('matricule')
    role = (payload.get('role') or 'EMPLOYE').upper()

    try:
        matricule = str(matricule).strip().upper() if matricule is not None else None
    except Exception:
        matricule = None

    return matricule, role


def ensure_can_create_for_matricule(request: Request, matricule_cible: str):
    actor_matricule, actor_role = get_actor_from_request(request)
    cible = str(matricule_cible).strip().upper() if matricule_cible is not None else None
    if actor_matricule == cible:
        return actor_matricule, actor_role

    if actor_role not in {'RH', 'ADMIN', 'PCA', 'AG'}:
        raise HTTPException(status_code=403, detail='Seul RH/PCA/AG/Admin peut créer une demande pour autrui')

    return actor_matricule, actor_role


def ensure_mission_initiator_role(actor_role: str):
    if actor_role not in MISSION_INITIATOR_ROLES:
        raise HTTPException(
            status_code=403,
            detail='Création de mission réservée aux rôles hiérarchiques (RESPONSABLE, DIRECTEUR, RH, DG, PCA, ADMIN)'
        )


def can_access_globally(role: str) -> bool:
    return role in GLOBAL_ROLES


def is_rh_or_admin_or_pca(role: str) -> bool:
    return role in {'RH', 'ADMIN', 'PCA', 'AG'}


def ensure_employee_crud_role(request: Request):
    _, role = get_actor_from_request(request)
    if role not in {'RH', 'PCA', 'AG', 'ADMIN'}:
        raise HTTPException(status_code=403, detail='Accès refusé: seuls RH/PCA/AG/Admin peuvent gérer les employés')


def get_actor_role_from_db(matricule: str, db: Session) -> str:
    utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not utilisateur or not utilisateur.role_id:
        return 'EMPLOYE'

    role = db.query(models.Role).filter(models.Role.id == utilisateur.role_id).first()
    return (role.name if role else 'EMPLOYE').upper()
