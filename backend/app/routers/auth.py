from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db import get_db
from .. import crud, schemas, models
from ..utils.security import create_access_token, hash_password, verify_token
from ..utils import email as mailer
from datetime import timedelta, datetime
from ..utils.security import generate_mfa_secret, verify_totp, validate_password_policy
from fastapi import Form, BackgroundTasks, Request
import os

router = APIRouter(prefix='/auth', tags=['auth'])



@router.post('/login/email')
def send_login_email_request(background_tasks: BackgroundTasks, db: Session = Depends(get_db), email: str = Form(...)):
    user = crud.get_user_by_email(db, email)
    # respond OK even if user not found (no enumeration)
    if not user:
        return {"ok": True}
    token = create_access_token({"matricule": user.matricule, "role": user.role.name if user.role else 'Utilisateur', "email_login": True}, expires_minutes=15)
    link = f"{os.getenv('APP_URL','http://localhost:5173')}/login/email/callback?token={token}"
    body = f"Cliquez sur ce lien pour vous connecter : {link}\n(valable 15 minutes)"
    background_tasks.add_task(mailer.send_email, email, "Lien de connexion ELITE CAPITAL", body)
    return {"ok": True}

@router.get('/login/email/validate')
def login_email_validate(token: str, db: Session = Depends(get_db)):
    payload = verify_token(token)
    if not payload or not payload.get('email_login'):
        raise HTTPException(status_code=400, detail='Token invalide')
    matricule = payload.get('matricule')
    user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilisateur non trouvé')
    access_token = create_access_token({"matricule": user.matricule, "role": user.role.name if user.role else 'Utilisateur'}, expires_minutes=525600)
    return {"access_token": access_token}

@router.post('/register')
def register(payload: schemas.UtilisateurCreate, db: Session = Depends(get_db)):
    if not payload.matricule:
        raise HTTPException(status_code=400, detail='Matricule requis')
    u = crud.create_utilisateur(db, payload.matricule, payload.password, email=payload.email)
    return {"ok": True}


@router.post('/login')
def login(matricule: str = Form(...), password: str = Form(...), mfaCode: str | None = Form(None), db: Session = Depends(get_db)):
    """
    Authentification avec :
    - Blocage après 3 tentatives échouées (5 minutes)
    - Détection de mot de passe temporaire (force changement)
    - Support MFA
    """
    # Récupérer l'utilisateur
    user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    
    if not user:
        raise HTTPException(status_code=401, detail='Identifiants invalides')
    
    # Vérifier si le compte est bloqué
    if user.bloque_jusqua and user.bloque_jusqua > datetime.utcnow():
        temps_restant = (user.bloque_jusqua - datetime.utcnow()).seconds // 60
        raise HTTPException(
            status_code=403, 
            detail=f'Compte temporairement bloqué. Réessayez dans {temps_restant} minute(s).'
        )
    
    # Si le délai de blocage est dépassé, réinitialiser
    if user.bloque_jusqua and user.bloque_jusqua <= datetime.utcnow():
        user.bloque_jusqua = None
        user.tentatives_echec = 0
        db.commit()
    
    # Vérifier le mot de passe
    from ..utils.security import verify_password
    if not verify_password(password, user.mot_de_passe_hash):
        # Incrémenter les tentatives échouées
        user.tentatives_echec = (user.tentatives_echec or 0) + 1
        
        # Bloquer après 3 tentatives
        if user.tentatives_echec >= 3:
            user.bloque_jusqua = datetime.utcnow() + timedelta(minutes=5)
            db.commit()
            raise HTTPException(
                status_code=403, 
                detail='Trop de tentatives échouées. Compte bloqué pendant 5 minutes.'
            )
        
        db.commit()
        tentatives_restantes = 3 - user.tentatives_echec
        raise HTTPException(
            status_code=401, 
            detail=f'Identifiants invalides. {tentatives_restantes} tentative(s) restante(s).'
        )
    
    # Authentification réussie - réinitialiser les tentatives
    user.tentatives_echec = 0
    user.dernier_login = datetime.utcnow()
    
    # Vérifier MFA si activée
    if user.mfa_enabled and user.mfa_secret:
        if not mfaCode:
            db.commit()
            raise HTTPException(status_code=400, detail='MFA code requis')
        if not verify_totp(user.mfa_secret, mfaCode):
            db.commit()
            raise HTTPException(status_code=401, detail='Code MFA invalide')
    
    db.commit()
    
    # Générer le token
    token = create_access_token({
        "matricule": user.matricule, 
        "role": user.role.name if user.role else 'Utilisateur'
    }, expires_minutes=525600)
    
    # Vérifier si mot de passe temporaire
    mot_de_passe_temporaire = user.mot_de_passe_temporaire or False
    
    return {
        "access_token": token,
        "mot_de_passe_temporaire": mot_de_passe_temporaire,
        "doit_changer_mdp": mot_de_passe_temporaire,
        "message": "Vous devez changer votre mot de passe temporaire" if mot_de_passe_temporaire else "Authentification réussie"
    }



@router.post('/mfa/setup')
def mfa_setup(matricule: str = Form(...), db: Session = Depends(get_db)):
    u = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not u:
        raise HTTPException(status_code=404, detail='Utilisateur non trouvé')
    secret = generate_mfa_secret()
    u.mfa_secret = secret
    db.commit()
    otpauth = f"otpauth://totp/ELC:{matricule}?secret={secret}&issuer=ELITE_CAPITAL"
    return {"secret": secret, "otpauth": otpauth}


@router.post('/mfa/verify')
def mfa_verify(matricule: str = Form(...), code: str = Form(...), db: Session = Depends(get_db)):
    u = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not u or not hasattr(u, 'mfa_secret'):
        raise HTTPException(status_code=404, detail='MFA not set')
    ok = verify_totp(u.mfa_secret, code)
    if ok:
        u.mfa_enabled = True
        db.commit()
        return {"ok": True}
    raise HTTPException(status_code=400, detail='Code invalide')


@router.post('/password/change')
def change_password(matricule: str = Form(...), old_password: str = Form(...), new_password: str = Form(...), db: Session = Depends(get_db)):
    """
    Changer le mot de passe avec validation de politique.
    Enlève le flag mot_de_passe_temporaire après changement.
    """
    u = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not u:
        raise HTTPException(status_code=404, detail='Utilisateur non trouvé')
    
    from ..utils.security import verify_password
    if not verify_password(old_password, u.mot_de_passe_hash):
        raise HTTPException(status_code=400, detail='Mot de passe actuel incorrect')
    
    # Valider la politique de mot de passe
    ok, msg = validate_password_policy(new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    
    # Vérifier que le nouveau mot de passe est différent de l'ancien
    if verify_password(new_password, u.mot_de_passe_hash):
        raise HTTPException(status_code=400, detail='Le nouveau mot de passe doit être différent de l\'ancien')
    
    # Mettre à jour le mot de passe
    u.mot_de_passe_hash = hash_password(new_password)
    u.date_changement_mdp = datetime.utcnow()
    u.mot_de_passe_temporaire = False  # Enlever le flag temporaire
    
    db.commit()
    
    return {
        "ok": True,
        "message": "Mot de passe changé avec succès"
    }


@router.post('/password/force-change')
def force_change_password(matricule: str = Form(...), new_password: str = Form(...), db: Session = Depends(get_db)):
    """
    Changement forcé de mot de passe temporaire (premier login).
    Ne nécessite pas l'ancien mot de passe.
    """
    u = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not u:
        raise HTTPException(status_code=404, detail='Utilisateur non trouvé')
    
    # Vérifier que c'est bien un mot de passe temporaire
    if not u.mot_de_passe_temporaire:
        raise HTTPException(status_code=400, detail='Utilisez l\'endpoint /password/change pour changer votre mot de passe')
    
    # Valider la politique de mot de passe
    ok, msg = validate_password_policy(new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    
    # Mettre à jour le mot de passe
    u.mot_de_passe_hash = hash_password(new_password)
    u.date_changement_mdp = datetime.utcnow()
    u.mot_de_passe_temporaire = False
    
    db.commit()
    
    return {
        "ok": True,
        "message": "Mot de passe définitif créé avec succès"
    }
