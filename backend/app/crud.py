from sqlalchemy.orm import Session
from . import models, schemas
from .utils.security import hash_password, verify_password
from datetime import datetime
from typing import Optional


def _entite_value(emp: models.Employe | None) -> str | None:
    if not emp or not getattr(emp, 'entite', None):
        return None
    entite = emp.entite
    return entite.value if hasattr(entite, 'value') else str(entite)


def _approval_sequence_for_emp(emp: models.Employe | None) -> list[str]:
    final_role = 'AG' if _entite_value(emp) == 'ECG' else 'PCA'
    return ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', final_role]


def create_employe(db: Session, emp: dict):
    e = models.Employe(**emp)
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


def get_employes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Employe).offset(skip).limit(limit).all()


def get_employe(db: Session, matricule: str):
    return db.query(models.Employe).filter(models.Employe.matricule == matricule).first()


def update_employe(db: Session, matricule: str, data: dict):
    e = get_employe(db, matricule)
    if not e:
        return None
    for k, v in data.items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return e


def create_utilisateur(db: Session, matricule: str, password: str, email: Optional[str] = None):
    u = models.Utilisateur(matricule=matricule, hashed_password=hash_password(password), email=email)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def get_user_by_email(db: Session, email: str):
    return db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first()


def authenticate_user(db: Session, matricule: str, password: str):
    user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_conge(db: Session, data: dict):
    # compute duree as days difference
    d0 = data.get('date_debut')
    d1 = data.get('date_fin')
    duree = (d1 - d0).days + 1 if d0 and d1 else 0
    # determine workflow based on employee entity:
    # RESPONSABLE -> DIRECTEUR -> RH -> DG -> PCA (or AG for ECG)
    emp = db.query(models.Employe).filter(models.Employe.matricule == data.get('matricule')).first()
    sequence = _approval_sequence_for_emp(emp)
    initial = None
    validator = None
    for role in sequence:
        candidate = get_validator_for_role(db, emp, role)
        if candidate:
            initial = role
            validator = candidate
            break
    if not initial:
        initial = sequence[0]
    c = models.Conge(**data, duree=duree, statut='attente' if duree>0 else 'brouillon', current_step=initial, current_validator=validator, history='')
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def advance_conge(db: Session, conge_id: int, actor: str, action: str, comment: str | None = None):
    c = db.query(models.Conge).filter(models.Conge.id_conge == conge_id).first()
    if not c:
        return None, 'Not found'
    # action: approve / refuse / modify / cancel
    emp = db.query(models.Employe).filter(models.Employe.matricule == c.matricule).first()
    sequence = _approval_sequence_for_emp(emp)
    if c.current_step is None:
        return None, 'No current step'
    try:
        idx = sequence.index(c.current_step)
    except ValueError:
        return None, 'Invalid step'

    # record history entry
    entry = f"{datetime.utcnow().isoformat()}|{actor}|{c.current_step}|{action}|{comment or ''}\n"
    c.history = (c.history or '') + entry

    if action == 'approve':
        # advance to next role and assign concrete validator (with backups)
        next_idx = idx + 1
        assigned = None
        while next_idx < len(sequence):
            next_role = sequence[next_idx]
            # find validator for next_role
            assigned = get_validator_for_role(db, emp, next_role)
            if assigned:
                c.current_step = next_role
                c.current_validator = assigned
                c.statut = 'attente'
                break
            # no validator found for this role -> record skip and try next
            skip_entry = f"{datetime.utcnow().isoformat()}|SYSTEM|SKIP|{next_role}|no_validator\n"
            c.history = (c.history or '') + skip_entry
            next_idx += 1
        if next_idx >= len(sequence):
            c.current_step = 'DONE'
            c.current_validator = None
            c.statut = 'validé'
    elif action == 'refuse':
        c.statut = 'refusé'
        c.current_step = None
    elif action == 'cancel':
        # cancellation allowed before last approver validation
        if c.current_step == sequence[-1] or c.statut == 'validé':
            return None, f"Cannot cancel after {sequence[-1]} validation or when validated"
        c.statut = 'annulé'
        c.current_step = None
    elif action == 'modify':
        # allow modification only before N1 validation completes
        if c.current_step == 'N1' or c.statut in ['brouillon','attente']:
            # modifications handled externally; here just record
            c.date_modification = datetime.utcnow()
        else:
            return None, 'Cannot modify after N1'
    else:
        return None, 'Unknown action'

    db.commit()
    db.refresh(c)
    return c, None


def get_validator_for_role(db: Session, emp: models.Employe | None, role: str) -> str | None:
    """Return a matricule for a validator for given role and employee context or None if not found.
    Backup rules implemented:
    - RESPONSABLE: prefer emp.n1, else RESPONSABLE in same entite, else any RESPONSABLE
    - DIRECTEUR: prefer DIRECTEUR in same entite, else any DIRECTEUR
    - RH: prefer RH in same entite, else any RH
    - DG: prefer DG in same entite, else any DG
    - PCA/AG: any available user for the role
    """
    def is_absent_emp(e: models.Employe | None) -> bool:
        if not e:
            return False
        if e.absent:
            return True
        return False

    def get_user_if_available(matricule: str):
        if not matricule:
            return None
        u = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule, models.Utilisateur.blocked == False).first()
        if not u:
            return None
        # check employe absence
        emp_candidate = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
        if is_absent_emp(emp_candidate):
            # try backup specified on employee
            if emp_candidate and emp_candidate.backup_matricule:
                backup_user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == emp_candidate.backup_matricule, models.Utilisateur.blocked==False).first()
                if backup_user:
                    return backup_user.matricule
            return None
        return u.matricule

    if role == 'N1':
        role = 'RESPONSABLE'

    if role == 'RESPONSABLE':
        # traverse chain of n1 and prefer first available non-absent, non-blocked user
        cur = emp
        visited = set()
        while cur and cur.n1 and cur.n1 not in visited:
            visited.add(cur.n1)
            candidate_m = get_user_if_available(cur.n1)
            if candidate_m:
                return candidate_m
            # move up
            cur = db.query(models.Employe).filter(models.Employe.matricule == cur.n1).first()
        # fallback to RESPONSABLE in same entite
        if emp and emp.entite:
            role_user = db.query(models.Utilisateur).join(models.Role).join(models.Employe, models.Utilisateur.matricule == models.Employe.matricule).filter(
                models.Role.name == 'RESPONSABLE',
                models.Employe.entite == emp.entite,
                models.Utilisateur.blocked == False,
            ).all()
            for ru in role_user:
                if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule == ru.matricule).first()):
                    return ru.matricule
        # fallback to any RESPONSABLE
        role_user = db.query(models.Utilisateur).join(models.Role).filter(models.Role.name == 'RESPONSABLE', models.Utilisateur.blocked == False).all()
        for ru in role_user:
            if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule == ru.matricule).first()):
                return ru.matricule
        return None

    if role == 'DIRECTEUR':
        if emp and emp.entite:
            role_user = db.query(models.Utilisateur).join(models.Role).join(models.Employe, models.Utilisateur.matricule == models.Employe.matricule).filter(
                models.Role.name == 'DIRECTEUR',
                models.Employe.entite == emp.entite,
                models.Utilisateur.blocked == False,
            ).all()
            for ru in role_user:
                if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule == ru.matricule).first()):
                    return ru.matricule
        role_user = db.query(models.Utilisateur).join(models.Role).filter(models.Role.name == 'DIRECTEUR', models.Utilisateur.blocked == False).all()
        for ru in role_user:
            if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule == ru.matricule).first()):
                return ru.matricule
        return None

    if role == 'RH':
        if emp and emp.entite:
            role_user = db.query(models.Utilisateur).join(models.Role).join(models.Employe, models.Utilisateur.matricule==models.Employe.matricule).filter(models.Role.name=='RH', models.Employe.entite==emp.entite, models.Utilisateur.blocked==False).first()
            if role_user:
                # ensure not absent
                if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule==role_user.matricule).first()):
                    return role_user.matricule
        # fallback to any RH who is available
        role_user = db.query(models.Utilisateur).join(models.Role).filter(models.Role.name=='RH', models.Utilisateur.blocked==False).all()
        for ru in role_user:
            if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule==ru.matricule).first()):
                return ru.matricule
        return None

    if role == 'DG':
        if emp and emp.entite:
            role_user = db.query(models.Utilisateur).join(models.Role).join(models.Employe, models.Utilisateur.matricule==models.Employe.matricule).filter(models.Role.name=='DG', models.Employe.entite==emp.entite, models.Utilisateur.blocked==False).first()
            if role_user and not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule==role_user.matricule).first()):
                return role_user.matricule
        role_user = db.query(models.Utilisateur).join(models.Role).filter(models.Role.name=='DG', models.Utilisateur.blocked==False).all()
        for ru in role_user:
            if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule==ru.matricule).first()):
                return ru.matricule
        return None

    if role == 'PCA':
        role_user = db.query(models.Utilisateur).join(models.Role).filter(models.Role.name=='PCA', models.Utilisateur.blocked==False).all()
        for ru in role_user:
            if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule==ru.matricule).first()):
                return ru.matricule
        return None

    if role == 'AG':
        role_user = db.query(models.Utilisateur).join(models.Role).filter(models.Role.name == 'AG', models.Utilisateur.blocked == False).all()
        for ru in role_user:
            if not is_absent_emp(db.query(models.Employe).filter(models.Employe.matricule == ru.matricule).first()):
                return ru.matricule
        return None

    return None
