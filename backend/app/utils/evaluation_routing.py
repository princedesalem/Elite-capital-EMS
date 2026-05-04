"""
Utilitaire de routage des évaluations.
Détermine l'évaluateur (N+1) d'un employé selon la hiérarchie de l'entreprise.

Règles (par ordre de priorité) :
  1. emp.n1                → le N+1 explicitement défini
  2. Direction.id_directeur   → le directeur de la direction de l'employé
  3. Departement.id_direction → direction du département → son directeur
  4. Departement.id_responsable → le responsable de département
  5. Fallback : None (pas d'évaluateur trouvé — l'admin doit assigner manuellement)
"""
from sqlalchemy.orm import Session
from .. import models


def determiner_evaluateur(matricule: str, db: Session) -> dict | None:
    """
    Retourne un dict ``{"matricule": str, "nom_complet": str, "role": str}``
    représentant l'évaluateur désigné, ou ``None`` si introuvable.
    """
    emp = db.query(models.Employe).filter(
        models.Employe.matricule == matricule
    ).first()
    if not emp:
        return None

    def _emp_info(mat: str, role: str) -> dict | None:
        if not mat:
            return None
        e = db.query(models.Employe).filter(models.Employe.matricule == mat).first()
        if not e:
            return None
        return {
            "matricule": e.matricule,
            "nom_complet": f"{e.prenom or ''} {e.nom or ''}".strip(),
            "role": role,
        }

    # 1. N+1 explicite
    if emp.n1 and emp.n1 != matricule:
        result = _emp_info(emp.n1, "N+1")
        if result:
            return result

    # 2. Directeur de la direction directe de l'employé
    if emp.id_direction:
        direction = db.query(models.Direction).filter(
            models.Direction.id_direction == emp.id_direction
        ).first()
        if direction and direction.id_directeur and direction.id_directeur != matricule:
            result = _emp_info(direction.id_directeur, "DIRECTEUR")
            if result:
                return result

    # 3. Direction via le département de l'employé
    if emp.dept_id:
        dept = db.query(models.Departement).filter(
            models.Departement.dept_id == emp.dept_id
        ).first()
        if dept:
            if dept.id_direction:
                direction = db.query(models.Direction).filter(
                    models.Direction.id_direction == dept.id_direction
                ).first()
                if direction and direction.id_directeur and direction.id_directeur != matricule:
                    result = _emp_info(direction.id_directeur, "DIRECTEUR")
                    if result:
                        return result

            # 4. Responsable de département
            if dept.id_responsable and dept.id_responsable != matricule:
                result = _emp_info(dept.id_responsable, "RESPONSABLE")
                if result:
                    return result

    return None
