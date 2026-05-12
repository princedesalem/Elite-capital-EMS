"""
Router : Elite Academy LMS — formations, modules, leçons, quiz, progression,
badges, certificats.
"""
import io
import os
import random
import shutil
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..db import get_db
from .. import models

router = APIRouter(prefix='/api/academy', tags=['academy'])

_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'academy')
os.makedirs(_UPLOADS_DIR, exist_ok=True)

_FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
_CG_REGULAR = os.path.join(_FONTS_DIR, 'GOTHIC.TTF')
_CG_BOLD    = os.path.join(_FONTS_DIR, 'GOTHICB.TTF')
_LOGOS_DIR  = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logos')
_ENTITY_LOGOS = {
    'ELCAM': os.path.join(_LOGOS_DIR, 'elcam.jpg'),
    'EXCA':  os.path.join(_LOGOS_DIR, 'exca.jpg'),
    'ECG':   os.path.join(_LOGOS_DIR, 'ecg.jpg'),
}
BRAND_COLOR  = (17, 32, 51)
ACCENT_COLOR = (206, 43, 43)


# ── Schemas ──────────────────────────────────────────────────────────────────

class FormationCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    categorie: Optional[str] = None
    niveau: str = 'Débutant'
    image_url: Optional[str] = None
    duree_estimee_h: Optional[float] = 0
    est_onboarding: bool = False
    est_publie: bool = False
    cree_par: str


class FormationUpdate(BaseModel):
    titre: Optional[str] = None
    description: Optional[str] = None
    categorie: Optional[str] = None
    niveau: Optional[str] = None
    image_url: Optional[str] = None
    duree_estimee_h: Optional[float] = None
    est_onboarding: Optional[bool] = None
    est_publie: Optional[bool] = None


class ModuleCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    ordre: int = 0


class LeconCreate(BaseModel):
    titre: str
    type: str = 'texte'
    contenu: Optional[str] = None
    ordre: int = 0
    duree_min: Optional[int] = 0


class QuizQuestionCreate(BaseModel):
    question: str
    options: list
    bonne_reponse: int = 0
    explication: Optional[str] = None
    ordre: int = 0


class ProgressionUpdate(BaseModel):
    inscription_id: int
    lecon_id: int
    termine: bool = True
    score: Optional[float] = None


class QuizSubmit(BaseModel):
    inscription_id: Optional[int] = None
    lecon_id: int
    # Liste de reponses sous forme {question_id, option_text} pour rester
    # robuste au melange par apprenant. Fallback : indices simples via `reponses`.
    reponses_detaillees: Optional[List[dict]] = None
    reponses: Optional[List[int]] = None  # legacy / mode admin


# ── Helpers ──────────────────────────────────────────────────────────────────

def _formation_to_dict(f: models.Formation, employe_id: Optional[str] = None, db: Optional[Session] = None):
    total_lecons = 0
    for m in f.modules:
        total_lecons += len(m.lecons)

    progress = None
    if employe_id and db:
        insc = db.query(models.InscriptionFormation).filter(
            models.InscriptionFormation.employe_id == employe_id,
            models.InscriptionFormation.formation_id == f.id,
        ).first()
        if insc and total_lecons > 0:
            done_rows = db.query(models.ProgressionLecon).filter(
                models.ProgressionLecon.inscription_id == insc.id,
                models.ProgressionLecon.termine == True,
            ).all()
            done_ids = [p.lecon_id for p in done_rows]
            done = len(done_ids)
            progress = round(done / total_lecons * 100)
            inscription_id = insc.id
            statut_inscription = insc.statut.value
        elif insc:
            done_ids = []
            progress = 0
            inscription_id = insc.id
            statut_inscription = insc.statut.value
        else:
            done_ids = []
            inscription_id = None
            statut_inscription = None
    else:
        done_ids = []
        inscription_id = None
        statut_inscription = None

    return {
        'id': f.id,
        'titre': f.titre,
        'description': f.description,
        'categorie': f.categorie,
        'niveau': f.niveau.value,
        'image_url': f.image_url,
        'duree_estimee_h': float(f.duree_estimee_h) if f.duree_estimee_h else 0,
        'est_onboarding': f.est_onboarding,
        'est_publie': f.est_publie,
        'cree_par': f.cree_par,
        'created_at': f.created_at.isoformat(),
        'nb_modules': len(f.modules),
        'nb_lecons': total_lecons,
        'progress': progress,
        'inscription_id': inscription_id,
        'statut_inscription': statut_inscription,
        # Objet imbriqué utilisé par le frontend AcademyCourse
        'inscription': {
            'id': inscription_id,
            'statut': statut_inscription,
            'lecons_terminees': done_ids,
        } if inscription_id is not None else None,
    }


def _award_badges(employe_id: str, db: Session):
    """Attribue les badges en fonction des accomplissements."""
    # premier_cours
    nb_completes = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.employe_id == employe_id,
        models.InscriptionFormation.statut == models.StatutInscriptionEnum.TERMINE,
    ).count()
    if nb_completes >= 1:
        _give_badge(employe_id, models.TypeBadgeEnum.PREMIER_COURS, db)
    if nb_completes >= 5:
        _give_badge(employe_id, models.TypeBadgeEnum.SERIE_5, db)

    # perfectionniste : score >= 100 sur au moins une formation
    perfect = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.employe_id == employe_id,
        models.InscriptionFormation.score_final >= 100,
    ).first()
    if perfect:
        _give_badge(employe_id, models.TypeBadgeEnum.PERFECTIONNISTE, db)


def _give_badge(employe_id: str, type_badge: models.TypeBadgeEnum, db: Session):
    existing = db.query(models.Badge).filter(
        models.Badge.employe_id == employe_id,
        models.Badge.type == type_badge,
    ).first()
    if not existing:
        db.add(models.Badge(employe_id=employe_id, type=type_badge))


# ── Auto-generation de questions QCM ──────────────────────────────────────────

def _qcm_templates_for(formation: 'models.Formation') -> list:
    """Genere un pool de questions QCM template a partir du titre + categorie.
    Le pool est volontairement plus grand que ce qu'on affichera, pour permettre
    un tirage different par apprenant."""
    titre = formation.titre or 'cette formation'
    cat = formation.categorie or 'le sujet'
    pool = [
        {
            'question': f"Quel est l'objectif principal de la formation \"{titre}\" ?",
            'options': [
                f"Maitriser les notions cles liees a {cat}",
                "Apprendre uniquement la theorie sans pratique",
                "Obtenir un diplome universitaire",
                "Remplacer l'experience terrain",
            ],
            'bonne_reponse': 0,
            'explication': f"Cette formation vise a developper vos competences operationnelles sur {cat}.",
        },
        {
            'question': f"Quelle posture adopter pour reussir la formation \"{titre}\" ?",
            'options': [
                "Survoler le contenu rapidement",
                "Suivre les modules dans l'ordre et pratiquer",
                "Sauter directement au quiz final",
                "Ne pas prendre de notes",
            ],
            'bonne_reponse': 1,
            'explication': "Suivre les modules dans l'ordre et mettre en pratique est essentiel.",
        },
        {
            'question': f"Quel acteur Elite Capital Group est responsable de la mise en oeuvre dans le domaine {cat} ?",
            'options': [
                "Uniquement la Direction generale",
                "Uniquement le service IT",
                "L'ensemble des collaborateurs concernes selon les procedures",
                "Les prestataires externes uniquement",
            ],
            'bonne_reponse': 2,
            'explication': "L'application des procedures concerne tous les collaborateurs impliques.",
        },
        {
            'question': "Que faire en cas de doute sur l'application d'une procedure ?",
            'options': [
                "Improviser une solution",
                "Ignorer la procedure",
                "Consulter son N+1 ou la documentation interne",
                "Attendre une formation complementaire",
            ],
            'bonne_reponse': 2,
            'explication': "Le N+1 et la documentation sont les premieres sources fiables.",
        },
        {
            'question': f"A la fin de la formation \"{titre}\", quel livrable obtenez-vous ?",
            'options': [
                "Un certificat de reussite Elite Academy",
                "Un diplome national",
                "Une prime financiere automatique",
                "Aucun document",
            ],
            'bonne_reponse': 0,
            'explication': "Un certificat est genere apres validation du quiz final.",
        },
        {
            'question': "Quelle est la bonne pratique en matiere de confidentialite ?",
            'options': [
                "Partager les donnees librement avec l'exterieur",
                "Respecter les niveaux d'habilitation et la charte informatique",
                "Stocker les informations sensibles sur des supports personnels",
                "Ignorer la politique RGPD",
            ],
            'bonne_reponse': 1,
            'explication': "La charte et les niveaux d'habilitation protegent les donnees du groupe.",
        },
        {
            'question': "Comment ameliorer continuellement vos competences ?",
            'options': [
                "Refuser tout nouveau cours",
                "Se contenter de l'experience initiale",
                "Suivre les formations et appliquer les retours d'experience",
                "Ne pas demander de feedback",
            ],
            'bonne_reponse': 2,
            'explication': "Formation continue + retours d'experience = montee en competences durable.",
        },
        {
            'question': f"Le module \"{titre}\" peut-il etre suivi a votre rythme ?",
            'options': [
                "Non, il faut tout terminer en une seule fois",
                "Oui, la progression est sauvegardee automatiquement",
                "Uniquement les week-ends",
                "Uniquement avec autorisation prealable",
            ],
            'bonne_reponse': 1,
            'explication': "Elite Academy sauvegarde votre progression : reprenez quand vous voulez.",
        },
    ]
    return pool


def _ensure_quiz_questions(formation: 'models.Formation', db: Session):
    """S'assure qu'il existe au moins une lecon de type quiz avec un pool de
    questions. Cree automatiquement quiz + questions templates si necessaire.
    Appele a la creation de la formation et a la demande de questions."""
    # Trouver une lecon quiz existante
    quiz_lecon = None
    for m in formation.modules:
        for l in m.lecons:
            if l.type == models.TypeLeconEnum.QUIZ:
                quiz_lecon = l
                break
        if quiz_lecon:
            break

    # Sinon creer un module + lecon quiz
    if quiz_lecon is None:
        mod = models.ModuleFormation(
            formation_id=formation.id,
            titre='Validation',
            description='Quiz de validation des acquis.',
            ordre=99,
        )
        db.add(mod)
        db.flush()
        quiz_lecon = models.Lecon(
            module_id=mod.id,
            titre='Quiz final',
            type=models.TypeLeconEnum.QUIZ,
            contenu=None,
            ordre=0,
            duree_min=10,
        )
        db.add(quiz_lecon)
        db.flush()

    # Pool de questions deja present ?
    nb_existing = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.lecon_id == quiz_lecon.id
    ).count()
    if nb_existing >= 5:
        return quiz_lecon

    pool = _qcm_templates_for(formation)
    for idx, q in enumerate(pool):
        db.add(models.QuizQuestion(
            lecon_id=quiz_lecon.id,
            question=q['question'],
            options=q['options'],
            bonne_reponse=q['bonne_reponse'],
            explication=q.get('explication'),
            ordre=idx,
        ))
    db.commit()
    return quiz_lecon


# ── Formations CRUD ──────────────────────────────────────────────────────────

@router.get('/catalogue')
def get_catalogue(employe_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Catalogue public de toutes les formations publiées."""
    formations = db.query(models.Formation).filter(
        models.Formation.est_publie == True
    ).order_by(models.Formation.est_onboarding.desc(), models.Formation.created_at.desc()).all()
    return [_formation_to_dict(f, employe_id, db) for f in formations]


@router.get('/admin/formations')
def get_all_formations(db: Session = Depends(get_db)):
    """Toutes les formations (admin RH)."""
    formations = db.query(models.Formation).order_by(models.Formation.created_at.desc()).all()
    return [_formation_to_dict(f) for f in formations]


@router.post('/formations')
def create_formation(body: FormationCreate, db: Session = Depends(get_db)):
    try:
        niveau = models.NiveauFormationEnum(body.niveau)
    except ValueError:
        raise HTTPException(status_code=400, detail='Niveau invalide')
    f = models.Formation(
        titre=body.titre,
        description=body.description,
        categorie=body.categorie,
        niveau=niveau,
        image_url=body.image_url,
        duree_estimee_h=body.duree_estimee_h,
        est_onboarding=body.est_onboarding,
        est_publie=body.est_publie,
        cree_par=body.cree_par,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    # Auto-generation : module Validation + quiz template
    try:
        _ensure_quiz_questions(f, db)
        db.refresh(f)
    except Exception:
        pass
    return _formation_to_dict(f)


@router.get('/formations/{formation_id}')
def get_formation(formation_id: int, employe_id: Optional[str] = None, db: Session = Depends(get_db)):
    f = db.query(models.Formation).filter(models.Formation.id == formation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail='Formation non trouvée')
    d = _formation_to_dict(f, employe_id, db)
    # Inclure les modules et leçons
    d['modules'] = [
        {
            'id': m.id,
            'titre': m.titre,
            'description': m.description,
            'ordre': m.ordre,
            'lecons': [
                {
                    'id': l.id,
                    'titre': l.titre,
                    'type': l.type.value,
                    'contenu': l.contenu,
                    'ordre': l.ordre,
                    'duree_min': l.duree_min,
                    'nb_questions': len(l.questions),
                }
                for l in m.lecons
            ],
        }
        for m in f.modules
    ]
    return d


@router.put('/formations/{formation_id}')
def update_formation(formation_id: int, body: FormationUpdate, db: Session = Depends(get_db)):
    f = db.query(models.Formation).filter(models.Formation.id == formation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail='Formation non trouvée')
    if body.titre is not None:
        f.titre = body.titre
    if body.description is not None:
        f.description = body.description
    if body.categorie is not None:
        f.categorie = body.categorie
    if body.niveau is not None:
        f.niveau = models.NiveauFormationEnum(body.niveau)
    if body.image_url is not None:
        f.image_url = body.image_url
    if body.duree_estimee_h is not None:
        f.duree_estimee_h = body.duree_estimee_h
    if body.est_onboarding is not None:
        f.est_onboarding = body.est_onboarding
    if body.est_publie is not None:
        f.est_publie = body.est_publie
    db.commit()
    return _formation_to_dict(f)


@router.delete('/formations/{formation_id}')
def delete_formation(formation_id: int, db: Session = Depends(get_db)):
    f = db.query(models.Formation).filter(models.Formation.id == formation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail='Formation non trouvée')
    db.delete(f)
    db.commit()
    return {'ok': True}


# ── Modules ──────────────────────────────────────────────────────────────────

@router.post('/formations/{formation_id}/modules')
def add_module(formation_id: int, body: ModuleCreate, db: Session = Depends(get_db)):
    f = db.query(models.Formation).filter(models.Formation.id == formation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail='Formation non trouvée')
    m = models.ModuleFormation(formation_id=formation_id, titre=body.titre, description=body.description, ordre=body.ordre)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {'id': m.id, 'titre': m.titre, 'ordre': m.ordre}


@router.put('/modules/{module_id}')
def update_module(module_id: int, body: ModuleCreate, db: Session = Depends(get_db)):
    m = db.query(models.ModuleFormation).filter(models.ModuleFormation.id == module_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Module non trouvé')
    m.titre = body.titre
    m.description = body.description
    m.ordre = body.ordre
    db.commit()
    return {'id': m.id, 'titre': m.titre}


@router.delete('/modules/{module_id}')
def delete_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(models.ModuleFormation).filter(models.ModuleFormation.id == module_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Module non trouvé')
    db.delete(m)
    db.commit()
    return {'ok': True}


# ── Leçons ───────────────────────────────────────────────────────────────────

@router.post('/modules/{module_id}/lecons')
def add_lecon(module_id: int, body: LeconCreate, db: Session = Depends(get_db)):
    m = db.query(models.ModuleFormation).filter(models.ModuleFormation.id == module_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Module non trouvé')
    try:
        type_lecon = models.TypeLeconEnum(body.type)
    except ValueError:
        raise HTTPException(status_code=400, detail='Type de leçon invalide')
    l = models.Lecon(module_id=module_id, titre=body.titre, type=type_lecon, contenu=body.contenu, ordre=body.ordre, duree_min=body.duree_min)
    db.add(l)
    db.commit()
    db.refresh(l)
    return {'id': l.id, 'titre': l.titre, 'type': l.type.value}


@router.put('/lecons/{lecon_id}')
def update_lecon(lecon_id: int, body: LeconCreate, db: Session = Depends(get_db)):
    l = db.query(models.Lecon).filter(models.Lecon.id == lecon_id).first()
    if not l:
        raise HTTPException(status_code=404, detail='Leçon non trouvée')
    l.titre = body.titre
    l.type = models.TypeLeconEnum(body.type)
    l.contenu = body.contenu
    l.ordre = body.ordre
    l.duree_min = body.duree_min
    db.commit()
    return {'id': l.id, 'titre': l.titre}


@router.delete('/lecons/{lecon_id}')
def delete_lecon(lecon_id: int, db: Session = Depends(get_db)):
    l = db.query(models.Lecon).filter(models.Lecon.id == lecon_id).first()
    if not l:
        raise HTTPException(status_code=404, detail='Leçon non trouvée')
    db.delete(l)
    db.commit()
    return {'ok': True}


@router.get('/lecons/{lecon_id}/questions')
def get_questions(
    lecon_id: int,
    employe_id: Optional[str] = None,
    nb: int = 5,
    db: Session = Depends(get_db),
):
    """Retourne les questions d'un quiz. Si `employe_id` est fourni, on melange
    deterministe le pool et les options pour limiter la triche entre apprenants.
    `nb` limite le nombre de questions retournees (par defaut 5)."""
    pool = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.lecon_id == lecon_id
    ).order_by(models.QuizQuestion.ordre).all()

    # Pool vide ? On tente d'auto-generer depuis la formation parente
    if not pool:
        lecon = db.query(models.Lecon).filter(models.Lecon.id == lecon_id).first()
        if lecon and lecon.module and lecon.module.formation:
            _ensure_quiz_questions(lecon.module.formation, db)
            pool = db.query(models.QuizQuestion).filter(
                models.QuizQuestion.lecon_id == lecon_id
            ).order_by(models.QuizQuestion.ordre).all()

    if not pool:
        return []

    if employe_id:
        # Seed deterministe par (employe + lecon) : chaque apprenant a un
        # ordre/melange propre mais reproductible entre rafraichissements
        seed = f"{employe_id}::{lecon_id}"
        rng = random.Random(seed)
        rng.shuffle(pool)
        pool = pool[:max(1, nb)]
        out = []
        for q in pool:
            options = list(q.options or [])
            idx = list(range(len(options)))
            rng.shuffle(idx)
            shuffled_opts = [options[i] for i in idx]
            try:
                new_correct = idx.index(int(q.bonne_reponse))
            except ValueError:
                new_correct = 0
            out.append({
                'id': q.id,
                'question': q.question,
                'options': shuffled_opts,
                # On expose la nouvelle position pour le client; le scoring backend
                # recompute aussi pour les soumissions completes.
                'bonne_reponse': new_correct,
                'explication': q.explication,
                'ordre': q.ordre,
                '_idx_map': idx,  # pour le scoring cote serveur si besoin
            })
        return out

    # Mode admin / aperçu : ordre stable, sans melange
    return [
        {
            'id': q.id,
            'question': q.question,
            'options': q.options,
            'bonne_reponse': q.bonne_reponse,
            'explication': q.explication,
            'ordre': q.ordre,
        }
        for q in pool[:max(1, nb)]
    ]


@router.post('/lecons/{lecon_id}/questions')
def add_question(lecon_id: int, body: QuizQuestionCreate, db: Session = Depends(get_db)):
    l = db.query(models.Lecon).filter(models.Lecon.id == lecon_id).first()
    if not l:
        raise HTTPException(status_code=404, detail='Leçon non trouvée')
    q = models.QuizQuestion(
        lecon_id=lecon_id,
        question=body.question,
        options=body.options,
        bonne_reponse=body.bonne_reponse,
        explication=body.explication,
        ordre=body.ordre,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return {'id': q.id, 'question': q.question}


@router.put('/questions/{question_id}')
def update_question(question_id: int, body: QuizQuestionCreate, db: Session = Depends(get_db)):
    q = db.query(models.QuizQuestion).filter(models.QuizQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail='Question non trouvée')
    q.question = body.question
    q.options = body.options
    q.bonne_reponse = body.bonne_reponse
    q.explication = body.explication
    q.ordre = body.ordre
    db.commit()
    return {'id': q.id}


@router.delete('/questions/{question_id}')
def delete_question(question_id: int, db: Session = Depends(get_db)):
    q = db.query(models.QuizQuestion).filter(models.QuizQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail='Question non trouvée')
    db.delete(q)
    db.commit()
    return {'ok': True}


# ── Upload fichiers ───────────────────────────────────────────────────────────

@router.post('/upload')
async def upload_file(file: UploadFile = File(...)):
    """Upload d'un fichier (PDF, image) pour une leçon ou image de couverture."""
    allowed_types = {'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail='Type de fichier non autorisé')
    max_size = 20 * 1024 * 1024  # 20 MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail='Fichier trop volumineux (max 20 MB)')
    safe_name = f"{int(datetime.utcnow().timestamp())}_{os.path.basename(file.filename or 'file')}"
    dest = os.path.join(_UPLOADS_DIR, safe_name)
    with open(dest, 'wb') as f_out:
        f_out.write(contents)
    return {'url': f'/uploads/academy/{safe_name}', 'filename': safe_name}


# ── Inscriptions & progression ────────────────────────────────────────────────

@router.post('/inscriptions/{formation_id}')
def s_inscrire(formation_id: int, employe_id: str, db: Session = Depends(get_db)):
    f = db.query(models.Formation).filter(models.Formation.id == formation_id, models.Formation.est_publie == True).first()
    if not f:
        raise HTTPException(status_code=404, detail='Formation non trouvée')
    existing = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.employe_id == employe_id,
        models.InscriptionFormation.formation_id == formation_id,
    ).first()
    if existing:
        return {'id': existing.id, 'statut': existing.statut.value}
    insc = models.InscriptionFormation(employe_id=employe_id, formation_id=formation_id)
    db.add(insc)
    db.commit()
    db.refresh(insc)
    return {'id': insc.id, 'statut': insc.statut.value}


@router.post('/progression')
def marquer_progression(body: ProgressionUpdate, db: Session = Depends(get_db)):
    """Marque une leçon comme terminée et met à jour la progression."""
    insc = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.id == body.inscription_id
    ).first()
    if not insc:
        raise HTTPException(status_code=404, detail='Inscription non trouvée')

    prog = db.query(models.ProgressionLecon).filter(
        models.ProgressionLecon.inscription_id == body.inscription_id,
        models.ProgressionLecon.lecon_id == body.lecon_id,
    ).first()
    if prog:
        prog.termine = body.termine
        if body.score is not None:
            prog.score = body.score
        prog.date_progression = datetime.utcnow()
    else:
        prog = models.ProgressionLecon(
            inscription_id=body.inscription_id,
            lecon_id=body.lecon_id,
            termine=body.termine,
            score=body.score,
        )
        db.add(prog)

    # Calcul progression globale
    formation = db.query(models.Formation).filter(models.Formation.id == insc.formation_id).first()
    total_lecons = sum(len(m.lecons) for m in formation.modules)
    done_count = db.query(models.ProgressionLecon).filter(
        models.ProgressionLecon.inscription_id == insc.id,
        models.ProgressionLecon.termine == True,
    ).count()

    # Compter la leçon actuelle si elle vient d'être terminée
    if body.termine and not (prog.id if hasattr(prog, 'id') and prog.id else False):
        done_count += 1

    if total_lecons > 0 and done_count >= total_lecons:
        insc.statut = models.StatutInscriptionEnum.TERMINE
        insc.date_completion = datetime.utcnow()
        # Score final = moyenne des scores de quiz
        scores = db.query(models.ProgressionLecon.score).filter(
            models.ProgressionLecon.inscription_id == insc.id,
            models.ProgressionLecon.score.isnot(None),
        ).all()
        if scores:
            insc.score_final = sum(s[0] for s in scores) / len(scores)
        # Attribution badges
        _award_badges(insc.employe_id, db)

    db.commit()
    progress_pct = round(done_count / total_lecons * 100) if total_lecons else 0
    return {
        'ok': True,
        'progress': progress_pct,
        'completed': insc.statut == models.StatutInscriptionEnum.TERMINE,
    }


@router.post('/quiz/submit')
def submit_quiz(body: QuizSubmit, db: Session = Depends(get_db)):
    """Soumet les réponses d'un quiz et retourne le score.

    Deux modes :
    - reponses_detaillees=[{question_id, option_text}]  → robuste au melange
    - reponses=[indices]                                 → ordre stable admin
    """
    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.lecon_id == body.lecon_id
    ).order_by(models.QuizQuestion.ordre).all()
    if not questions:
        raise HTTPException(status_code=404, detail='Aucune question pour cette leçon')

    qmap = {q.id: q for q in questions}
    correct = 0
    details = []
    asked = []

    if body.reponses_detaillees:
        for item in body.reponses_detaillees:
            qid = item.get('question_id')
            chosen = item.get('option_text')
            q = qmap.get(qid)
            if not q:
                continue
            asked.append(q)
            opts = list(q.options or [])
            try:
                bonne_txt = opts[int(q.bonne_reponse)] if 0 <= int(q.bonne_reponse) < len(opts) else None
            except Exception:
                bonne_txt = None
            is_correct = (chosen is not None and bonne_txt is not None and chosen == bonne_txt)
            if is_correct:
                correct += 1
            details.append({
                'question': q.question,
                'reponse_donnee': chosen,
                'bonne_reponse': bonne_txt,
                'correct': is_correct,
                'explication': q.explication,
            })
    else:
        reponses = body.reponses or []
        for i, q in enumerate(questions):
            asked.append(q)
            reponse_donnee = reponses[i] if i < len(reponses) else -1
            is_correct = reponse_donnee == q.bonne_reponse
            if is_correct:
                correct += 1
            details.append({
                'question': q.question,
                'reponse_donnee': reponse_donnee,
                'bonne_reponse': q.bonne_reponse,
                'correct': is_correct,
                'explication': q.explication,
            })

    total = max(1, len(asked))
    score = round(correct / total * 100)

    # Enregistrer la progression de la leçon quiz (seulement si inscription connue)
    if body.inscription_id:
        prog_body = ProgressionUpdate(
            inscription_id=body.inscription_id,
            lecon_id=body.lecon_id,
            termine=True,
            score=float(score),
        )
        marquer_progression(prog_body, db)

    return {
        'score': score,
        'correct': correct,
        'total': total,
        'badge': score >= 80,
        'details': details,
    }


# ── Dashboard employé ─────────────────────────────────────────────────────────

@router.get('/dashboard/{employe_id}')
def get_dashboard(employe_id: str, db: Session = Depends(get_db)):
    """Stats personnelles, badges et leaderboard."""
    inscriptions = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.employe_id == employe_id
    ).all()

    en_cours = [i for i in inscriptions if i.statut == models.StatutInscriptionEnum.EN_COURS]
    termines = [i for i in inscriptions if i.statut == models.StatutInscriptionEnum.TERMINE]
    score_moyen = None
    if termines:
        scores = [float(i.score_final) for i in termines if i.score_final is not None]
        if scores:
            score_moyen = round(sum(scores) / len(scores), 1)

    badges = db.query(models.Badge).filter(models.Badge.employe_id == employe_id).all()

    # Leaderboard top 10 (par formations terminées puis score moyen)
    top_raw = (
        db.query(
            models.InscriptionFormation.employe_id,
            func.count(models.InscriptionFormation.id).label('nb'),
            func.avg(models.InscriptionFormation.score_final).label('score'),
        )
        .filter(models.InscriptionFormation.statut == models.StatutInscriptionEnum.TERMINE)
        .group_by(models.InscriptionFormation.employe_id)
        .order_by(func.count(models.InscriptionFormation.id).desc(), func.avg(models.InscriptionFormation.score_final).desc())
        .limit(10)
        .all()
    )
    leaderboard = []
    for rank, row in enumerate(top_raw, 1):
        emp = db.query(models.Employe).filter(models.Employe.matricule == row.employe_id).first()
        leaderboard.append({
            'rank': rank,
            'employe_id': row.employe_id,
            'nom': f"{emp.prenom} {emp.nom}" if emp else row.employe_id,
            'photo_url': emp.photo_url if emp else None,
            'nb_formations': int(row.nb),
            'score_moyen': round(float(row.score), 1) if row.score else None,
            'is_me': row.employe_id == employe_id,
        })

    return {
        'nb_en_cours': len(en_cours),
        'nb_termines': len(termines),
        'score_moyen': score_moyen,
        'badges': [{'type': b.type.value, 'date_obtenu': b.date_obtenu.isoformat()} for b in badges],
        'leaderboard': leaderboard,
    }


# ── Certificats ───────────────────────────────────────────────────────────────

@router.post('/certificat/{inscription_id}')
def generer_certificat(inscription_id: int, db: Session = Depends(get_db)):
    """Génère un certificat PDF à partir de l'inscription_id.
    L'inscription doit avoir le statut 'termine'."""
    insc = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.id == inscription_id,
    ).first()
    if not insc:
        raise HTTPException(status_code=404, detail='Inscription introuvable')
    if insc.statut != models.StatutInscriptionEnum.TERMINE:
        raise HTTPException(status_code=400, detail='Formation non terminée')

    f = db.query(models.Formation).filter(models.Formation.id == insc.formation_id).first()
    emp = db.query(models.Employe).filter(models.Employe.matricule == insc.employe_id).first()

    pdf_bytes = _build_certificat_pdf(emp, f, insc)

    # Enregistrement certificat (idempotent)
    cert = db.query(models.CertificatFormation).filter(
        models.CertificatFormation.employe_id == insc.employe_id,
        models.CertificatFormation.formation_id == insc.formation_id,
    ).first()
    if not cert:
        cert = models.CertificatFormation(employe_id=insc.employe_id, formation_id=insc.formation_id)
        db.add(cert)
        db.commit()

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="certificat_{insc.formation_id}_{insc.employe_id}.pdf"'},
    )


# ── Stats admin ───────────────────────────────────────────────────────────────

@router.get('/admin/stats/{formation_id}')
def get_stats_formation(formation_id: int, db: Session = Depends(get_db)):
    """Stats d'une formation : inscrits, taux complétion, score moyen."""
    f = db.query(models.Formation).filter(models.Formation.id == formation_id).first()
    if not f:
        raise HTTPException(status_code=404, detail='Formation non trouvée')

    total_inscrits = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.formation_id == formation_id
    ).count()
    nb_termines = db.query(models.InscriptionFormation).filter(
        models.InscriptionFormation.formation_id == formation_id,
        models.InscriptionFormation.statut == models.StatutInscriptionEnum.TERMINE,
    ).count()
    scores = db.query(models.InscriptionFormation.score_final).filter(
        models.InscriptionFormation.formation_id == formation_id,
        models.InscriptionFormation.score_final.isnot(None),
    ).all()
    score_moyen = round(sum(float(s[0]) for s in scores) / len(scores), 1) if scores else None

    return {
        'formation_id': formation_id,
        'titre': f.titre,
        'total_inscrits': total_inscrits,
        'nb_termines': nb_termines,
        'taux_completion': round(nb_termines / total_inscrits * 100) if total_inscrits else 0,
        'score_moyen': score_moyen,
    }


@router.get('/admin/employes-stats')
def get_stats_employes(db: Session = Depends(get_db)):
    """Dashboard global admin par employé: progression, scores quiz, badges et top 3."""
    employes = db.query(models.Employe).order_by(models.Employe.nom.asc(), models.Employe.prenom.asc()).all()

    rows = []
    total_en_cours = 0
    total_termines = 0

    for emp in employes:
        inscriptions = db.query(models.InscriptionFormation).filter(
            models.InscriptionFormation.employe_id == emp.matricule
        ).all()

        nb_en_cours = len([i for i in inscriptions if i.statut == models.StatutInscriptionEnum.EN_COURS])
        nb_termines = len([i for i in inscriptions if i.statut == models.StatutInscriptionEnum.TERMINE])
        total_en_cours += nb_en_cours
        total_termines += nb_termines

        score_vals = [float(i.score_final) for i in inscriptions if i.score_final is not None]
        score_quiz_moyen = round(sum(score_vals) / len(score_vals), 1) if score_vals else None

        progression_vals = []
        for ins in inscriptions:
            formation = db.query(models.Formation).filter(models.Formation.id == ins.formation_id).first()
            if not formation:
                continue
            total_lecons = sum(len(m.lecons) for m in formation.modules)
            if total_lecons <= 0:
                continue
            done_count = db.query(models.ProgressionLecon).filter(
                models.ProgressionLecon.inscription_id == ins.id,
                models.ProgressionLecon.termine == True,
            ).count()
            progression_vals.append(round(done_count / total_lecons * 100))

        progression_moyenne = round(sum(progression_vals) / len(progression_vals)) if progression_vals else 0

        badges_count = db.query(models.Badge).filter(models.Badge.employe_id == emp.matricule).count()

        rows.append({
            'employe_id': emp.matricule,
            'nom': f"{emp.prenom} {emp.nom}" if emp.prenom or emp.nom else emp.matricule,
            'photo_url': emp.photo_url,
            'nb_formations_en_cours': nb_en_cours,
            'nb_formations_termines': nb_termines,
            'progression_moyenne': progression_moyenne,
            'score_quiz_moyen': score_quiz_moyen,
            'badges_count': badges_count,
        })

    leaderboard_raw = (
        db.query(
            models.InscriptionFormation.employe_id,
            func.count(models.InscriptionFormation.id).label('nb'),
            func.avg(models.InscriptionFormation.score_final).label('score'),
        )
        .filter(models.InscriptionFormation.statut == models.StatutInscriptionEnum.TERMINE)
        .group_by(models.InscriptionFormation.employe_id)
        .order_by(func.count(models.InscriptionFormation.id).desc(), func.avg(models.InscriptionFormation.score_final).desc())
        .limit(3)
        .all()
    )

    top_apprenants = []
    for rank, row in enumerate(leaderboard_raw, 1):
        emp = db.query(models.Employe).filter(models.Employe.matricule == row.employe_id).first()
        top_apprenants.append({
            'rank': rank,
            'employe_id': row.employe_id,
            'nom': f"{emp.prenom} {emp.nom}" if emp else row.employe_id,
            'photo_url': emp.photo_url if emp else None,
            'nb_formations': int(row.nb),
            'score_moyen': round(float(row.score), 1) if row.score else None,
        })

    return {
        'totaux': {
            'nb_employes': len(rows),
            'nb_formations_en_cours': total_en_cours,
            'nb_formations_termines': total_termines,
        },
        'top_apprenants': top_apprenants,
        'employes': rows,
    }


# ── PDF Certificat ────────────────────────────────────────────────────────────

def _build_certificat_pdf(emp, formation, insc) -> bytes:
    from fpdf import FPDF

    pdf = FPDF(orientation='L', format='A4')
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    has_cg = os.path.exists(_CG_REGULAR) and os.path.exists(_CG_BOLD)
    if has_cg:
        pdf.add_font('CenturyGothic', '', _CG_REGULAR, uni=True)
        pdf.add_font('CenturyGothic', 'B', _CG_BOLD, uni=True)
        font = 'CenturyGothic'
    else:
        font = 'Helvetica'

    # Fond dégradé simulé par rectangle
    pdf.set_fill_color(10, 22, 40)
    pdf.rect(0, 0, 297, 210, 'F')

    # Bordure décorative
    pdf.set_draw_color(206, 43, 43)
    pdf.set_line_width(3)
    pdf.rect(8, 8, 281, 194)
    pdf.set_draw_color(255, 215, 0)
    pdf.set_line_width(0.5)
    pdf.rect(12, 12, 273, 186)

    # Titre
    pdf.set_font(font, 'B', 32)
    pdf.set_text_color(255, 215, 0)
    pdf.set_xy(0, 30)
    pdf.cell(297, 16, 'CERTIFICAT DE RÉUSSITE', align='C', ln=1)

    # Sous-titre
    pdf.set_font(font, '', 14)
    pdf.set_text_color(200, 210, 230)
    pdf.set_x(0)
    pdf.cell(297, 8, 'Elite Academy — ELITE CAPITAL GROUP', align='C', ln=1)

    pdf.ln(8)

    # Texte principal
    pdf.set_font(font, '', 13)
    pdf.set_text_color(240, 245, 255)
    pdf.set_x(0)
    pdf.cell(297, 8, 'Ce certificat est décerné à', align='C', ln=1)

    pdf.set_font(font, 'B', 26)
    pdf.set_text_color(255, 255, 255)
    nom_complet = f"{emp.prenom} {emp.nom}" if emp else "—"
    pdf.set_x(0)
    pdf.cell(297, 14, nom_complet, align='C', ln=1)

    pdf.set_font(font, '', 12)
    pdf.set_text_color(180, 200, 230)
    pdf.set_x(0)
    pdf.cell(297, 7, 'pour avoir complété avec succès la formation', align='C', ln=1)

    pdf.set_font(font, 'B', 18)
    pdf.set_text_color(206, 43, 43)
    pdf.set_x(0)
    titre_formation = formation.titre if formation else '—'
    pdf.cell(297, 12, titre_formation, align='C', ln=1)

    # Score si disponible
    if insc and insc.score_final is not None:
        pdf.set_font(font, '', 11)
        pdf.set_text_color(200, 220, 200)
        pdf.set_x(0)
        pdf.cell(297, 7, f"Score final : {float(insc.score_final):.0f} / 100", align='C', ln=1)

    pdf.ln(6)

    # Date d'émission
    date_str = insc.date_completion.strftime('%d %B %Y') if insc and insc.date_completion else date.today().strftime('%d %B %Y')
    pdf.set_font(font, '', 10)
    pdf.set_text_color(160, 180, 200)
    pdf.set_x(0)
    pdf.cell(297, 6, f"Émis le {date_str}", align='C', ln=1)

    # Pied de page
    pdf.set_font(font, '', 8)
    pdf.set_text_color(100, 120, 150)
    pdf.set_xy(0, 190)
    pdf.cell(297, 6, 'Document généré automatiquement par EMS — ELITE CAPITAL GROUP S.A', align='C')

    out = pdf.output(dest='S')
    return out.encode('latin-1') if isinstance(out, str) else bytes(out)
