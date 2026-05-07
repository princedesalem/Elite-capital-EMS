"""
Router — Documentation interne ELITE CAPITAL EMS.

Endpoints :
  GET    /api/documentation/articles           — liste des articles/fichiers
  POST   /api/documentation/articles           — créer un article
  PUT    /api/documentation/articles/{id}      — modifier un article
  DELETE /api/documentation/articles/{id}      — supprimer un article
  GET    /api/documentation/categories         — liste des catégories existantes
  POST   /api/documentation/upload             — upload d'un fichier (PDF/Word/etc.)
"""
import os
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..utils.security import get_current_user

router = APIRouter(prefix='/api/documentation', tags=['documentation'])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads', 'documentation')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xlsx', '.xls', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg'}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


# ── Schémas ───────────────────────────────────────────────────────────────────

class ArticleCreate(BaseModel):
    titre: str
    contenu: Optional[str] = None
    categorie: Optional[str] = 'Général'


class ArticleUpdate(BaseModel):
    titre: Optional[str] = None
    contenu: Optional[str] = None
    categorie: Optional[str] = None


def _serialize(doc: models.DocumentInterne) -> dict:
    return {
        'id': doc.id_doc,
        'titre': doc.titre,
        'contenu': doc.contenu or '',
        'categorie': doc.categorie or 'Général',
        'auteur_matricule': doc.auteur_matricule,
        'auteur_nom': doc.auteur_nom or '',
        'fichier_url': doc.fichier_url,
        'fichier_nom': doc.fichier_nom,
        'type_doc': doc.type_doc,
        'created_at': doc.created_at.isoformat() if doc.created_at else None,
        'updated_at': doc.updated_at.isoformat() if doc.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get('/articles')
def list_articles(
    categorie: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = db.query(models.DocumentInterne).order_by(models.DocumentInterne.updated_at.desc())
    if categorie:
        q = q.filter(models.DocumentInterne.categorie == categorie)
    if search:
        term = f'%{search}%'
        q = q.filter(
            models.DocumentInterne.titre.ilike(term) |
            models.DocumentInterne.contenu.ilike(term)
        )
    return [_serialize(d) for d in q.all()]


@router.get('/categories')
def list_categories(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    rows = db.query(models.DocumentInterne.categorie).distinct().all()
    cats = sorted({r[0] for r in rows if r[0]})
    return cats


@router.get('/articles/{doc_id}')
def get_article(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    doc = db.query(models.DocumentInterne).filter_by(id_doc=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail='Document introuvable.')
    return _serialize(doc)


@router.post('/articles', status_code=201)
def create_article(
    body: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    mat = current_user.get('matricule')
    emp = db.query(models.Employe).filter_by(matricule=mat).first() if mat else None
    auteur_nom = f"{emp.prenom} {emp.nom}".strip() if emp else mat or 'Inconnu'

    doc = models.DocumentInterne(
        titre=body.titre.strip(),
        contenu=body.contenu,
        categorie=body.categorie or 'Général',
        auteur_matricule=mat,
        auteur_nom=auteur_nom,
        type_doc='article',
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


@router.put('/articles/{doc_id}')
def update_article(
    doc_id: int,
    body: ArticleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    doc = db.query(models.DocumentInterne).filter_by(id_doc=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail='Document introuvable.')

    if body.titre is not None:
        doc.titre = body.titre.strip()
    if body.contenu is not None:
        doc.contenu = body.contenu
    if body.categorie is not None:
        doc.categorie = body.categorie

    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


@router.delete('/articles/{doc_id}', status_code=204)
def delete_article(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    doc = db.query(models.DocumentInterne).filter_by(id_doc=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail='Document introuvable.')
    # Suppression du fichier physique si c'est un fichier uploadé
    if doc.fichier_url:
        try:
            file_path = os.path.join(UPLOAD_DIR, os.path.basename(doc.fichier_url))
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass
    db.delete(doc)
    db.commit()
    return None


@router.post('/upload', status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    categorie: Optional[str] = Query('Général'),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Validation extension
    ext = os.path.splitext(file.filename or '')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extension non autorisée. Formats acceptés : {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Lecture et validation taille
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail='Fichier trop volumineux (max 20 MB).')

    # Sauvegarde
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, 'wb') as f:
        f.write(contents)

    fichier_url = f'/uploads/documentation/{safe_name}'
    original_name = file.filename or safe_name

    mat = current_user.get('matricule')
    emp = db.query(models.Employe).filter_by(matricule=mat).first() if mat else None
    auteur_nom = f"{emp.prenom} {emp.nom}".strip() if emp else mat or 'Inconnu'

    doc = models.DocumentInterne(
        titre=original_name,
        contenu=None,
        categorie=categorie or 'Général',
        auteur_matricule=mat,
        auteur_nom=auteur_nom,
        fichier_url=fichier_url,
        fichier_nom=original_name,
        type_doc='fichier',
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize(doc)
