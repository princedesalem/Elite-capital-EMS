"""
Router — Module DE (Demande d'Explication).

Rôles autorisés à créer une DE : RH, ADMIN, DIRECTEUR, DG, PCA.
L'employé concerné peut consulter ses DEs et soumettre une réponse.
RH/ADMIN/DIRECTEUR/DG/PCA peuvent clore une DE répondue.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..utils.security import get_current_user

router = APIRouter(prefix='/api/de', tags=['demandes-explication'])

_ROLES_INITIATEURS = {'RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA'}


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class DECreate(BaseModel):
    matricule_employe: str
    motif: str
    delai_heures: int = 72   # 72h par défaut


class DERepondre(BaseModel):
    reponse: str


class DEClore(BaseModel):
    pass   # pas de champ requis


def _serialize(de: models.DemandeExplicationV2, db: Session) -> dict:
    emp = db.query(models.Employe).filter_by(matricule=de.matricule_employe).first()
    cree_par_emp = db.query(models.Employe).filter_by(matricule=de.cree_par).first()
    return {
        'id_de': de.id_de,
        'matricule_employe': de.matricule_employe,
        'nom_employe': f"{emp.prenom} {emp.nom}" if emp else de.matricule_employe,
        'cree_par': de.cree_par,
        'nom_createur': f"{cree_par_emp.prenom} {cree_par_emp.nom}" if cree_par_emp else de.cree_par,
        'motif': de.motif,
        'reponse_employe': de.reponse_employe,
        'statut': de.statut,
        'date_limite_reponse': de.date_limite_reponse.isoformat() if de.date_limite_reponse else None,
        'date_reponse': de.date_reponse.isoformat() if de.date_reponse else None,
        'cree_le': de.cree_le.isoformat() if de.cree_le else None,
        'clos_le': de.clos_le.isoformat() if de.clos_le else None,
        'clos_par': de.clos_par,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post('/initier', status_code=status.HTTP_201_CREATED)
def initier_de(
    body: DECreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Créer une demande d'explication. Réservé aux rôles habilitants."""
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_INITIATEURS:
        raise HTTPException(status_code=403, detail="Rôle insuffisant pour initier une DE.")

    # Vérifier que l'employé existe
    emp = db.query(models.Employe).filter_by(matricule=body.matricule_employe).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable.")

    now = datetime.utcnow()
    de = models.DemandeExplicationV2(
        matricule_employe=body.matricule_employe,
        cree_par=current_user['matricule'],
        motif=body.motif,
        statut='EN_ATTENTE',
        date_limite_reponse=now + timedelta(hours=body.delai_heures),
        cree_le=now,
    )
    db.add(de)
    db.flush()   # obtenir id_de avant le commit

    # Notification à l'employé
    notif = models.Notification(
        matricule=body.matricule_employe,
        type_notification=models.TypeNotificationEnum.DEMANDE_EXPLICATION,
        titre="Demande d'explication",
        message=f"Une demande d'explication vous a été adressée. Motif : {body.motif[:120]}",
        lue=False,
        date_creation=now,
    )
    db.add(notif)
    db.commit()
    db.refresh(de)
    return _serialize(de, db)


@router.get('/')
def lister_des(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Liste toutes les DEs — réservé aux rôles habilitants."""
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_INITIATEURS:
        raise HTTPException(status_code=403, detail="Accès réservé aux RH/ADMIN/DIRECTEUR/DG/PCA.")
    des = db.query(models.DemandeExplicationV2).order_by(
        models.DemandeExplicationV2.cree_le.desc()
    ).all()
    return [_serialize(d, db) for d in des]


@router.get('/mes-demandes')
def mes_demandes(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retourne les DEs de l'employé connecté."""
    matricule = current_user['matricule']
    des = db.query(models.DemandeExplicationV2).filter_by(
        matricule_employe=matricule
    ).order_by(models.DemandeExplicationV2.cree_le.desc()).all()
    return [_serialize(d, db) for d in des]


@router.get('/{id_de}')
def detail_de(
    id_de: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    de = db.query(models.DemandeExplicationV2).filter_by(id_de=id_de).first()
    if not de:
        raise HTTPException(status_code=404, detail="DE introuvable.")
    matricule = current_user['matricule']
    role = (current_user.get('role') or '').upper()
    if matricule != de.matricule_employe and role not in _ROLES_INITIATEURS:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    return _serialize(de, db)


@router.post('/{id_de}/repondre')
def repondre_de(
    id_de: int,
    body: DERepondre,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """L'employé soumet sa réponse."""
    de = db.query(models.DemandeExplicationV2).filter_by(id_de=id_de).first()
    if not de:
        raise HTTPException(status_code=404, detail="DE introuvable.")
    if current_user['matricule'] != de.matricule_employe:
        raise HTTPException(status_code=403, detail="Vous ne pouvez répondre qu'à vos propres DEs.")
    if de.statut != 'EN_ATTENTE':
        raise HTTPException(status_code=400, detail=f"Impossible de répondre à une DE en statut '{de.statut}'.")

    now = datetime.utcnow()
    de.reponse_employe = body.reponse
    de.statut = 'REPONDU'
    de.date_reponse = now

    # Notification au créateur de la DE
    notif = models.Notification(
        matricule=de.cree_par,
        type_notification=models.TypeNotificationEnum.DEMANDE_EXPLICATION,
        titre="Réponse à une demande d'explication",
        message=f"L'employé {de.matricule_employe} a répondu à votre demande d'explication.",
        lue=False,
        date_creation=now,
    )
    db.add(notif)
    db.commit()
    db.refresh(de)
    return _serialize(de, db)


@router.put('/{id_de}/clore')
def clore_de(
    id_de: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """RH/ADMIN/DIRECTEUR/DG/PCA clôt la DE après examen de la réponse."""
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_INITIATEURS:
        raise HTTPException(status_code=403, detail="Rôle insuffisant.")
    de = db.query(models.DemandeExplicationV2).filter_by(id_de=id_de).first()
    if not de:
        raise HTTPException(status_code=404, detail="DE introuvable.")
    if de.statut == 'CLOS':
        raise HTTPException(status_code=400, detail="Cette DE est déjà close.")

    de.statut = 'CLOS'
    de.clos_le = datetime.utcnow()
    de.clos_par = current_user['matricule']
    db.commit()
    db.refresh(de)
    return _serialize(de, db)
