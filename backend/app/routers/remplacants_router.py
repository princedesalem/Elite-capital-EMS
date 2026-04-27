"""
Router pour la gestion des remplaçants automatiques
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ..db import get_db
from .. import models, schemas
from ..utils import remplacants as rempl_utils, notifications, security, email as email_utils

router = APIRouter(prefix='/api/remplacants', tags=['remplacants'])


@router.get('/operations-disponibles')
def lister_operations_disponibles(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Lister toutes les opérations disponibles pour chercher des remplaçants,
    filtrée selon le rôle de l'utilisateur courant.
    """
    auth = request.headers.get('authorization')
    if not auth or not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Token manquant')

    token = auth.split(None, 1)[1]
    try:
        payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail='Token invalide')

    token_matricule = payload.get('matricule') or payload.get('sub')
    try:
        matricule = str(token_matricule).strip().upper()
    except Exception:
        raise HTTPException(status_code=401, detail='Token sans matricule valide')

    current_user = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not current_user:
        raise HTTPException(status_code=404, detail='Utilisateur introuvable')

    role = payload.get('role') or ''
    if not role:
        utilisateur_obj = db.query(models.Utilisateur).filter(
            models.Utilisateur.matricule == matricule
        ).first()
        if utilisateur_obj and utilisateur_obj.role:
            role = utilisateur_obj.role.name
    
    # Seulement les opérations en attente ou validées (pas les refusées)
    query = db.query(models.Operation).filter(
        models.Operation.statut.in_(['en attente', 'validé', 'validée'])
    )
    
    if role and role.upper() in ['RH', 'ADMIN', 'PCA', 'AG']:
        # RH/Admin/PCA/AG: Tous les opérations du système
        pass
    elif role and role.upper() == 'DIRECTEUR':
        # Directeur: opérations de sa direction
        direction_employees = db.query(models.Employe).filter(
            models.Employe.id_direction == current_user.id_direction
        ).all()
        matricules = [e.matricule for e in direction_employees]
        query = query.filter(models.Operation.matricule.in_(matricules))
    elif role and role.upper() == 'RESPONSABLE':
        # Responsable: opérations de son département
        dept_employees = db.query(models.Employe).filter(
            models.Employe.dept_id == current_user.dept_id
        ).all()
        matricules = [e.matricule for e in dept_employees]
        query = query.filter(models.Operation.matricule.in_(matricules))
    else:
        # EMPLOYE: ses propres opérations
        query = query.filter(models.Operation.matricule == matricule)
    
    operations = query.order_by(models.Operation.id_operation.desc()).limit(500).all()
    
    result = []
    for op in operations:
        employe = db.query(models.Employe).filter(
            models.Employe.matricule == op.matricule
        ).first()
        
        result.append({
            "id_operation": op.id_operation,
            "matricule": op.matricule,
            "nom_employe": f"{employe.prenom} {employe.nom}" if employe else "Inconnu",
            "type_demande": op.type_demande,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "duree_jours": op.duree_jours,
            "motif": op.motif,
            "statut": op.statut
        })
    
    return result



@router.get('/propositions/{id_operation}')
def obtenir_remplacants_proposes(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir les remplaçants proposés automatiquement pour une opération.
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    # Récupérer les remplaçants proposés
    propositions = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.id_operation == id_operation
    ).order_by(models.RemplacantPropose.ordre_proposition).all()
    
    result = []
    for prop in propositions:
        employe = db.query(models.Employe).filter(
            models.Employe.matricule == prop.matricule_remplacant
        ).first()
        
        if employe:
            result.append({
                "id_remplacant_propose": prop.id_remplacant_propose,
                "matricule": employe.matricule,
                "nom_complet": f"{employe.prenom} {employe.nom}",
                "fonction": employe.fonction,
                "departement_id": employe.dept_id,
                "direction_id": employe.id_direction,
                "ordre_proposition": prop.ordre_proposition,
                "est_accepte": prop.est_accepte,
                "demande_envoyee": prop.demande_envoyee if prop.demande_envoyee is not None else False,
                "commentaire": prop.commentaire or ""
            })
    
    return result


@router.patch('/propositions/{id_remplacant_propose}/commentaire')
def mettre_a_jour_commentaire_remplacant(
    id_remplacant_propose: int,
    payload: schemas.RemplacantCommentaireUpdate,
    db: Session = Depends(get_db),
):
    """Mettre à jour le commentaire associé à une proposition de remplaçant."""
    prop = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.id_remplacant_propose == id_remplacant_propose
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proposition de remplaçant introuvable")
    prop.commentaire = (payload.commentaire or '').strip() or None
    db.commit()
    db.refresh(prop)
    return {
        "id_remplacant_propose": prop.id_remplacant_propose,
        "commentaire": prop.commentaire or "",
    }


@router.post('/generer/{id_operation}')
def generer_remplacants(
    id_operation: int,
    limite: int = 5,
    db: Session = Depends(get_db)
):
    """
    Générer automatiquement une liste de remplaçants proposés.
    
    Ordre de priorité:
    1. Subordonnés directs du même département
    2. Collègues du même département
    3. Employés de la même direction
    4. Employés de la même entité
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    # Générer les remplaçants (en excluant ceux déjà occupés sur la même période)
    remplacants = rempl_utils.trouver_remplacants_automatiques(employe, db, limite, operation=operation)
    
    if not remplacants:
        return {
            "message": "Aucun remplaçant disponible trouvé",
            "remplacants": []
        }
    
    # Enregistrer les propositions
    success, message = rempl_utils.enregistrer_remplacants_proposes(
        id_operation, remplacants, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "message": f"{len(remplacants)} remplaçant(s) proposé(s)",
        "remplacants": [
            {
                "matricule": r['matricule'],
                "nom_complet": f"{r['prenom']} {r['nom']}",
                "fonction": r.get('fonction', '')
            }
            for r in remplacants
        ]
    }


@router.post('/{id_operation}/accepter/{matricule_remplacant}')
def accepter_remplacant(
    id_operation: int,
    matricule_remplacant: str,
    db: Session = Depends(get_db)
):
    """
    Accepter un remplaçant proposé.
    """
    success, message = rempl_utils.accepter_remplacant(
        id_operation, matricule_remplacant, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Notifier le remplaçant accepté
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    
    notifications.creer_notification(
        matricule=matricule_remplacant,
        type_notification='AUTRE',
        titre="Remplacement confirmé",
        message=f"Vous avez été choisi pour remplacer {employe.prenom} {employe.nom}",
        id_operation=id_operation,
        db=db
    )

    # Email au remplaçant confirmé
    remplacant_emp = db.query(models.Employe).filter(
        models.Employe.matricule == matricule_remplacant
    ).first()
    if remplacant_emp and remplacant_emp.email:
        email_utils.send_email(
            remplacant_emp.email,
            "[EMS] Remplacement confirmé",
            (
                f"Bonjour {remplacant_emp.prenom} {remplacant_emp.nom},\n\n"
                f"Vous avez été choisi(e) pour remplacer {employe.prenom} {employe.nom} "
                f"durant son {(operation.type_demande or 'absence').lower()} (du {operation.date_debut} au {operation.date_fin or operation.date_retour or '?'}).\n\n"
                f"Cordialement,\nÉquipe EMS"
            )
        )

    return {"message": message}


@router.post('/{id_operation}/demander/{matricule_remplacant}')
def demander_remplacant(
    id_operation: int,
    matricule_remplacant: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Le RH envoie une demande de confirmation à un remplacant proposé.
    Passe demande_envoyee=True et notifie l'employé concerné.
    """
    auth = request.headers.get('authorization', '')
    if not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Token manquant')

    prop = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.id_operation == id_operation,
        models.RemplacantPropose.matricule_remplacant == matricule_remplacant
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail='Proposition introuvable')
    if prop.est_accepte:
        raise HTTPException(status_code=400, detail='Ce remplacant a déjà accepté')

    prop.demande_envoyee = True
    db.commit()

    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    employe_absent = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first() if operation else None

    nom_absent = f"{employe_absent.prenom} {employe_absent.nom}" if employe_absent else "un collègue"
    type_absence = (operation.type_demande or 'absence').lower() if operation else 'absence'
    notifications.creer_notification(
        matricule=matricule_remplacant,
        type_notification='AUTRE',
        titre=f"Demande de remplacement – {(operation.type_demande or 'Absence') if operation else 'Absence'}",
        message=f"Vous êtes sollicité(e) pour remplacer {nom_absent} durant son {type_absence} (du {operation.date_debut} au {operation.date_fin or '?'}). Veuillez confirmer votre accord dans l'application.",
        id_operation=id_operation,
        db=db
    )

    # Email au remplaçant sollicité
    remplacant_emp = db.query(models.Employe).filter(
        models.Employe.matricule == matricule_remplacant
    ).first()
    if remplacant_emp and remplacant_emp.email:
        email_utils.send_email(
            remplacant_emp.email,
            f"[EMS] Demande de remplacement – {(operation.type_demande or 'Absence') if operation else 'Absence'}",
            (
                f"Bonjour {remplacant_emp.prenom} {remplacant_emp.nom},\n\n"
                f"Vous êtes sollicité(e) pour remplacer {nom_absent} durant son {type_absence} "
                f"(du {operation.date_debut} au {operation.date_fin or '?'}).\n\n"
                f"Connectez-vous à l'application EMS pour confirmer votre disponibilité.\n\n"
                f"Cordialement,\nÉquipe EMS"
            )
        )

    return {"message": "Demande envoyée", "id_operation": id_operation}


@router.get('/mes-demandes/{matricule}')
def obtenir_mes_demandes(matricule: str, db: Session = Depends(get_db)):
    """
    Retourne les opérations pour lesquelles l'employé a reçu une demande
    (demande_envoyee=True, est_accepte=False) afin qu'il puisse accepter.
    """
    propositions = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.matricule_remplacant == matricule,
        models.RemplacantPropose.demande_envoyee == True,
        models.RemplacantPropose.est_accepte == False
    ).all()

    result = []
    for prop in propositions:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == prop.id_operation
        ).first()
        if operation:
            employe_absent = db.query(models.Employe).filter(
                models.Employe.matricule == operation.matricule
            ).first()
            result.append({
                "id_operation": operation.id_operation,
                "type_demande": operation.type_demande,
                "date_debut": operation.date_debut,
                "date_fin": operation.date_fin,
                "statut": operation.statut,
                "employe_absent": {
                    "matricule": employe_absent.matricule,
                    "nom_complet": f"{employe_absent.prenom} {employe_absent.nom}",
                    "fonction": employe_absent.fonction
                } if employe_absent else None
            })
    return result


@router.get('/disponibilite/{matricule}')
def verifier_disponibilite(
    matricule: str,
    date_debut: date,
    date_fin: date,
    db: Session = Depends(get_db)
):
    """
    Vérifier si un employé est disponible sur une période donnée.
    """
    disponible, raison = rempl_utils.verifier_disponibilite_remplacant(
        matricule, date_debut, date_fin, db
    )
    
    return {
        "disponible": disponible,
        "raison": raison,
        "periodes_indisponibles": []
    }


@router.get('/mes-remplacements/{matricule}')
def obtenir_mes_remplacements(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations pour lesquelles un employé a été accepté comme remplaçant.
    """
    propositions = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.matricule_remplacant == matricule,
        models.RemplacantPropose.est_accepte == True
    ).all()
    
    result = []
    for prop in propositions:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == prop.id_operation
        ).first()
        
        if operation:
            employe_absent = db.query(models.Employe).filter(
                models.Employe.matricule == operation.matricule
            ).first()
            
            result.append({
                "id_operation": operation.id_operation,
                "type_demande": operation.type_demande,
                "date_debut": operation.date_debut,
                "date_fin": operation.date_fin,
                "statut": operation.statut,
                "employe_absent": {
                    "matricule": employe_absent.matricule,
                    "nom_complet": f"{employe_absent.prenom} {employe_absent.nom}",
                    "fonction": employe_absent.fonction
                } if employe_absent else None
            })
    
    return result
