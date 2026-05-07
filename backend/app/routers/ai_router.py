"""
Router — Assistant IA RH (moteur intégré + Ollama optionnel).

Endpoints :
  POST /api/ai/chat                          — chatbot RH avec contexte employés
  GET  /api/ai/dashboard-summary             — résumé narratif du tableau de bord
  GET  /api/ai/recommandations/{mat}         — recommandations contextuelles pour un employé
  POST /api/ai/search-employes               — recherche en langage naturel → résultats directs
  GET  /api/ai/analytics-summary             — résumé exécutif IA des analytics RH
  GET  /api/ai/dashboard-insights/{matricule}— insights & recommandations personnalisés
  GET  /api/ai/rapport-narratif              — rapport narratif complet RH

Le moteur IA est basé sur les données SQL temps réel. Si OLLAMA_BASE_URL est défini
et qu'Ollama est accessible, les réponses utilisent le modèle mistral ; sinon, le
moteur déterministe intégré prend le relais (fallback sans interruption de service).
"""
import os
import re
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models
from ..db import get_db
from ..services.ai_insights import generate_insights
from ..utils.security import get_current_user

router = APIRouter(prefix='/api/ai', tags=['ai'])

_ROLES_RH = {'RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA'}


# ── Schémas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    system: Optional[str] = None


class NLSearchRequest(BaseModel):
    query: str


# ── Moteur IA intégré ─────────────────────────────────────────────────────────

def _kw(text: str, *words: str) -> bool:
    t = text.lower()
    return any(w.lower() in t for w in words)


def _engine_chat(question: str, db: Session) -> str:
    q = question.strip()
    today = datetime.utcnow().date()

    # Employés
    if _kw(q, 'combien', 'nombre', 'total', 'effectif') and _kw(q, 'employ', 'personnel', 'staff'):
        total = db.query(func.count(models.Employe.matricule)).scalar() or 0
        actifs = db.query(func.count(models.Employe.matricule)).filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        ).scalar() or 0
        return (
            f"👥  Effectif ELITE CAPITAL au {today.strftime('%d/%m/%Y')} :\n"
            f"   • Total        : {total} employés\n"
            f"   • Actifs       : {actifs}\n"
            f"   • Inactifs     : {total - actifs}"
        )

    if _kw(q, 'liste', 'affiche', 'montre', 'voir', 'qui sont') and _kw(q, 'employ', 'actif'):
        emps = db.query(models.Employe).filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        ).order_by(models.Employe.nom).limit(20).all()
        if not emps:
            return "Aucun employé actif trouvé."
        total = db.query(func.count(models.Employe.matricule)).filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        ).scalar() or 0
        lines = [f"• {e.prenom} {e.nom} — {e.fonction or 'N/R'} (mat. {e.matricule})" for e in emps]
        suffix = f"\n_(et {total - 20} autres…)_" if total > 20 else ""
        return "👥  Employés actifs :\n" + "\n".join(lines) + suffix

    # Congés
    if _kw(q, 'congé', 'conge', 'absence', 'leave'):
        if _kw(q, 'attente', 'pending', 'approuv', 'valider', 'en cours'):
            count = db.query(func.count(models.Operation.id_operation)).filter(
                models.Operation.type_demande == 'Congé',
                models.Operation.statut == 'en attente',
            ).scalar() or 0
            ops = db.query(models.Operation).filter(
                models.Operation.type_demande == 'Congé',
                models.Operation.statut == 'en attente',
            ).order_by(models.Operation.date_demande.desc()).limit(10).all()
            if count == 0:
                return "✅  Aucune demande de congé en attente de validation."
            lines = []
            for op in ops:
                emp = db.query(models.Employe).filter_by(matricule=op.matricule).first()
                nom = f"{emp.prenom} {emp.nom}" if emp else op.matricule
                d = op.date_debut.strftime('%d/%m/%Y') if op.date_debut else '?'
                lines.append(f"   • {nom} — du {d} (op #{op.id_operation})")
            return (
                f"🕐  {count} demande(s) de congé en attente :\n" + "\n".join(lines) +
                (f"\n   _(et {count - 10} autres)_" if count > 10 else "")
            )
        nb = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Congé').scalar() or 0
        att = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Congé', models.Operation.statut == 'en attente').scalar() or 0
        app = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Congé', models.Operation.statut == 'approuvé').scalar() or 0
        return (
            f"📋  Statistiques congés :\n"
            f"   • Total      : {nb}\n"
            f"   • En attente : {att}\n"
            f"   • Approuvées : {app}\n"
            f"   • Autres     : {nb - att - app}"
        )

    # Missions
    if _kw(q, 'mission'):
        count_att = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Mission', models.Operation.statut == 'en attente').scalar() or 0
        total_m = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Mission').scalar() or 0
        if _kw(q, 'attente', 'pending', 'valider'):
            ops = db.query(models.Operation).filter(
                models.Operation.type_demande == 'Mission', models.Operation.statut == 'en attente'
            ).limit(10).all()
            if count_att == 0:
                return "✅  Aucune mission en attente de validation."
            lines = []
            for op in ops:
                emp = db.query(models.Employe).filter_by(matricule=op.matricule).first()
                nom = f"{emp.prenom} {emp.nom}" if emp else op.matricule
                lines.append(f"   • {nom} (op #{op.id_operation})")
            return f"🌍  {count_att} mission(s) en attente de validation :\n" + "\n".join(lines)
        return f"🌍  Missions : {total_m} au total, dont {count_att} en attente de validation."

    # Demandes d'explication
    if _kw(q, 'explication', 'demande explication', 'demandes d\'explication'):
        total = db.query(func.count(models.DemandeExplicationV2.id_de)).scalar() or 0
        att = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
            models.DemandeExplicationV2.statut == 'EN_ATTENTE').scalar() or 0
        rep = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
            models.DemandeExplicationV2.statut == 'REPONDUE').scalar() or 0
        clos = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
            models.DemandeExplicationV2.statut == 'CLOSE').scalar() or 0
        return (
            f"📨  Demandes d'explication :\n"
            f"   • Total      : {total}\n"
            f"   • En attente : {att}\n"
            f"   • Répondues  : {rep}\n"
            f"   • Closes     : {clos}"
        )

    # Disciplinaire
    if _kw(q, 'disciplinaire', 'mesure', 'sanction', 'avertissement', 'blame', 'blâme'):
        total = db.query(func.count(models.MesureDisciplinaire.id_mesure)).scalar() or 0
        if total == 0:
            return "✅  Aucune mesure disciplinaire enregistrée."
        recentes = db.query(models.MesureDisciplinaire).order_by(
            models.MesureDisciplinaire.date_mesure.desc()).limit(5).all()
        lines = []
        for m in recentes:
            emp = db.query(models.Employe).filter_by(matricule=m.matricule).first()
            nom = f"{emp.prenom} {emp.nom}" if emp else m.matricule
            d = m.date_mesure.strftime('%d/%m/%Y') if m.date_mesure else '?'
            lines.append(f"   • {nom} — {m.type_mesure} ({d})")
        return f"⚖️  {total} mesure(s) disciplinaire(s) enregistrée(s).\nDernières mesures :\n" + "\n".join(lines)

    # Résumé / bonjour
    if _kw(q, 'résumé', 'resume', 'situation', 'bilan', 'rapport', 'bonjour', 'salut', 'état', 'etat', 'rh'):
        total_emp = db.query(func.count(models.Employe.matricule)).scalar() or 0
        actifs = db.query(func.count(models.Employe.matricule)).filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF).scalar() or 0
        conges_att = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Congé', models.Operation.statut == 'en attente').scalar() or 0
        missions_att = db.query(func.count(models.Operation.id_operation)).filter(
            models.Operation.type_demande == 'Mission', models.Operation.statut == 'en attente').scalar() or 0
        des_att = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
            models.DemandeExplicationV2.statut == 'EN_ATTENTE').scalar() or 0
        mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).scalar() or 0

        points = []
        if conges_att > 0:
            points.append(f"{conges_att} congé(s) en attente de validation")
        if missions_att > 0:
            points.append(f"{missions_att} mission(s) en attente")
        if des_att > 0:
            points.append(f"{des_att} demande(s) d'explication sans réponse")
        attention = ("\n\n⚠️  Points d'attention :\n   • " + "\n   • ".join(points)) if points else "\n\n✅  Aucune action urgente en attente."

        return (
            f"📊  Situation RH — {today.strftime('%d/%m/%Y')}\n\n"
            f"👥  Effectif            : {total_emp} employés ({actifs} actifs)\n"
            f"🕐  Congés en attente   : {conges_att}\n"
            f"🌍  Missions en attente : {missions_att}\n"
            f"📨  Demandes expliq.    : {des_att} ouvertes\n"
            f"⚖️   Mesures discipl.   : {mesures}"
            + attention
        )

    # Aide
    if _kw(q, 'aide', 'help', 'que peux', 'commande', 'exemple', 'question'):
        return (
            "💬  Je suis votre assistant RH. Exemples de questions :\n\n"
            "👥  Combien d'employés actifs ?\n"
            "🕐  Quelles demandes de congé sont en attente ?\n"
            "🌍  Missions en attente de validation\n"
            "📨  Combien de demandes d'explication en attente ?\n"
            "⚖️   Dernières mesures disciplinaires\n"
            "📊  Résumé de la situation RH"
        )

    # Recherche nom par défaut
    words = q.split()
    if words:
        emps_found = db.query(models.Employe).filter(
            (models.Employe.nom.ilike(f"%{words[0]}%")) |
            (models.Employe.prenom.ilike(f"%{words[0]}%"))
        ).limit(3).all()
        if emps_found and len(words) <= 4:
            lines = [
                f"• {e.prenom} {e.nom} — {e.fonction or 'N/R'} ({e.statut_employe.value if e.statut_employe else 'N/R'}) mat. {e.matricule}"
                for e in emps_found
            ]
            return "Employés correspondants :\n" + "\n".join(lines)

    return (
        "🤔  Je n'ai pas compris votre demande.\nEssayez par exemple :\n"
        "   • Congés en attente\n"
        "   • Résumé de la situation RH\n"
        "   • Aide — pour voir toutes les commandes disponibles."
    )


def _engine_summary(db: Session) -> str:
    today = datetime.utcnow().date()
    total = db.query(func.count(models.Employe.matricule)).scalar() or 0
    actifs = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF).scalar() or 0
    conges_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Congé', models.Operation.statut == 'en attente').scalar() or 0
    conges_app = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Congé', models.Operation.statut == 'approuvé').scalar() or 0
    missions_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Mission', models.Operation.statut == 'en attente').scalar() or 0
    de_att = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.statut == 'EN_ATTENTE').scalar() or 0
    mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).scalar() or 0

    urgences = []
    if conges_att > 0:
        urgences.append(f"{conges_att} demande(s) de congé non traitée(s)")
    if missions_att > 0:
        urgences.append(f"{missions_att} mission(s) en attente")
    if de_att > 0:
        urgences.append(f"{de_att} demande(s) d'explication sans réponse")

    note = ("⚠️  Points d'attention :\n   • " + "\n   • ".join(urgences)) if urgences else "✅  Aucune action urgente à ce jour."
    taux = round(conges_app / actifs * 100, 1) if actifs > 0 else 0

    return (
        f"📊  BULLETIN DE SITUATION RH — ELITE CAPITAL GROUP S.A.\n"
        f"    Date : {today.strftime('%d/%m/%Y')}\n\n"
        f"👥  Effectif total : {total} employés dont {actifs} actifs ({total - actifs} inactifs).\n"
        f"    Taux d'absences validées : {taux}% de l'effectif actif.\n\n"
        f"🕐  Congés en attente : {conges_att}   |   🌍  Missions en attente : {missions_att}\n"
        f"📨  Demandes d'explication sans réponse : {de_att}\n\n"
        f"⚖️   Mesures disciplinaires enregistrées : {mesures}\n\n"
        + note
    )


def _engine_recommandations(emp: models.Employe, nb_ops: int, nb_des: int, nb_mesures: int) -> str:
    recs = []
    if nb_mesures >= 2:
        recs.append(
            "⚖️  Suivi disciplinaire recommandé : un entretien de recadrage individuel permettrait "
            "de clarifier les attentes et d'accompagner l'employé vers une meilleure conduite."
        )
    elif nb_mesures == 1:
        recs.append(
            "⚖️  Une mesure disciplinaire a été enregistrée. Envisagez un entretien de suivi pour vérifier l'évolution."
        )
    if nb_des >= 1:
        recs.append(
            "📨  Des demandes d'explication ont été émises. Maintenez un dialogue ouvert et constructif."
        )
    if nb_ops < 2:
        recs.append(
            "✨  Profil stable. C'est le moment idéal pour identifier les aspirations de l'employé et co-construire un plan de développement."
        )
    elif nb_ops >= 5:
        recs.append(
            "📈  Employé très actif avec de nombreuses opérations. Veillez à l'équilibre de la charge de travail."
        )
    if not recs:
        recs.append("✅  Aucun indicateur négatif détecté. Poursuivez le suivi régulier et valorisez les contributions.")
    return "\n\n".join(f"{i+1}. {r}" for i, r in enumerate(recs))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post('/chat')
def chat_rh(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Extrait le dernier message utilisateur
    last_user_msg = ''
    for m in reversed(body.messages):
        if m.role == 'user':
            last_user_msg = m.content
            break

    # Réponse déterministe comme fallback et contexte
    fallback_reply = _engine_chat(last_user_msg, db)

    # Construit le contexte RH pour le system prompt
    rh_summary = _engine_summary(db)
    system_prompt = (
        "Tu es EMS Chat, l'assistant RH intelligent d'ELITE CAPITAL GROUP S.A. "
        "Tu réponds toujours en français, de manière professionnelle, claire et concise. "
        "Tu as accès aux données RH en temps réel. Voici la situation RH actuelle :\n\n"
        f"{rh_summary}\n\n"
        "Réponds à la question de l'utilisateur en t'appuyant sur ce contexte. "
        "Si la question dépasse ce contexte, utilise tes connaissances générales RH."
    )

    # Tentative Ollama avec l'historique complet
    base_url = os.environ.get('OLLAMA_BASE_URL', 'http://ollama:11434')
    try:
        # Construction des messages pour l'API Ollama chat
        ollama_messages = [{'role': 'system', 'content': system_prompt}]
        for m in body.messages:
            if m.role in ('user', 'assistant'):
                ollama_messages.append({'role': m.role, 'content': m.content})

        resp = httpx.post(
            f'{base_url}/api/chat',
            json={'model': 'mistral', 'messages': ollama_messages, 'stream': False},
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        ollama_reply = (data.get('message') or {}).get('content', '').strip()
        if ollama_reply:
            return {'role': 'assistant', 'content': ollama_reply}
    except Exception:
        pass  # Fallback silencieux vers le moteur déterministe

    return {'role': 'assistant', 'content': fallback_reply}


@router.get('/dashboard-summary')
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès réservé aux RH/ADMIN/DIRECTEUR/DG/PCA.')
    summary = _engine_summary(db)
    return {'summary': summary, 'generated_at': datetime.utcnow().isoformat()}


@router.get('/recommandations/{matricule}')
def recommandations_employe(
    matricule: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get('role') or '').upper()
    if current_user['matricule'] != matricule and role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès refusé.')
    emp = db.query(models.Employe).filter_by(matricule=matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employé introuvable.')
    nb_ops = db.query(func.count(models.Operation.id_operation)).filter_by(matricule=matricule).scalar() or 0
    nb_des = db.query(func.count(models.DemandeExplicationV2.id_de)).filter_by(matricule_employe=matricule).scalar() or 0
    nb_mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).filter_by(matricule=matricule).scalar() or 0
    reply = _engine_recommandations(emp, nb_ops, nb_des, nb_mesures)
    return {
        'matricule': matricule,
        'nom': f"{emp.prenom} {emp.nom}",
        'recommandations': reply,
        'generated_at': datetime.utcnow().isoformat(),
    }


@router.post('/search-employes')
def search_employes_nl(
    body: NLSearchRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès réservé aux RH/ADMIN/DIRECTEUR/DG/PCA.')

    q_text = body.query.strip()
    query = db.query(models.Employe)

    if _kw(q_text, 'actif', 'active'):
        query = query.filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)
    elif _kw(q_text, 'congédié', 'congedie', 'inactif'):
        try:
            query = query.filter(models.Employe.statut_employe == models.StatutEmployeEnum.CONGEDIE)
        except Exception:
            pass

    if _kw(q_text, 'femme', 'féminin', 'feminin'):
        try:
            query = query.filter(models.Employe.sexe == models.SexeEnum.F)
        except Exception:
            pass
    elif _kw(q_text, 'homme', 'masculin'):
        try:
            query = query.filter(models.Employe.sexe == models.SexeEnum.M)
        except Exception:
            pass

    for terme in ['directeur', 'manager', 'comptable', 'juriste', 'assistant', 'secrétaire',
                  'responsable', 'analyste', 'consultant', 'ingénieur', 'commercial']:
        if terme in q_text.lower():
            query = query.filter(models.Employe.fonction.ilike(f'%{terme}%'))
            break

    employes = query.limit(50).all()
    return {
        'query': body.query,
        'resultats': [
            {
                'matricule': e.matricule,
                'nom': e.nom,
                'prenom': e.prenom,
                'fonction': e.fonction,
                'statut': e.statut_employe.value if e.statut_employe else None,
            }
            for e in employes
        ],
        'total': len(employes),
    }


# ── Utilitaire Ollama ─────────────────────────────────────────────────────────

def _call_ollama(prompt: str) -> Optional[str]:
    """Appelle le modèle Ollama local (mistral). Retourne None si indisponible."""
    base_url = os.environ.get('OLLAMA_BASE_URL', 'http://ollama:11434')
    try:
        resp = httpx.post(
            f'{base_url}/api/generate',
            json={'model': 'mistral', 'prompt': prompt, 'stream': False},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json().get('response', '').strip() or None
    except Exception:
        return None


# ── Endpoints IA analytiques ──────────────────────────────────────────────────

@router.get('/analytics-summary')
def analytics_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Résumé exécutif IA des analytics RH — RH/ADMIN/DIRECTEUR/DG/PCA."""
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès réservé.')

    today = datetime.utcnow().date()

    # Collecte métriques
    nb_actifs = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF).scalar() or 0
    nb_total = db.query(func.count(models.Employe.matricule)).scalar() or 0

    conges_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Congé',
        models.Operation.statut == 'en attente').scalar() or 0

    missions_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Mission',
        models.Operation.statut == 'en attente').scalar() or 0

    de_att = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.statut == 'EN_ATTENTE').scalar() or 0

    mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).scalar() or 0

    # Absences du mois en cours par département
    abs_dept = (
        db.query(models.Departement.nom, func.count(models.Operation.id_operation))
        .join(models.Employe, models.Operation.matricule == models.Employe.matricule)
        .join(models.Departement, models.Departement.dept_id == models.Employe.dept_id)
        .filter(
            models.Operation.type_demande.in_(['Congé', 'Absence']),
            models.Operation.statut == 'approuvé',
            func.year(models.Operation.date_debut) == today.year,
            func.month(models.Operation.date_debut) == today.month,
        )
        .group_by(models.Departement.nom)
        .order_by(func.count(models.Operation.id_operation).desc())
        .limit(1)
        .first()
    )
    top_dept = abs_dept[0] if abs_dept else 'N/A'
    top_dept_nb = abs_dept[1] if abs_dept else 0

    # Congés dépassant 36 jours restants
    soldes_eleves = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.solde_conges > 36,
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
    ).scalar() or 0

    # Tentative Ollama
    prompt = (
        f"Tu es un assistant RH expert. Rédige un résumé exécutif en français en 3 à 5 phrases "
        f"à partir de ces données RH du {today.strftime('%d/%m/%Y')} :\n"
        f"- Effectif : {nb_total} employés dont {nb_actifs} actifs\n"
        f"- Congés en attente de validation : {conges_att}\n"
        f"- Missions en attente : {missions_att}\n"
        f"- Demandes d'explication non traitées : {de_att}\n"
        f"- Mesures disciplinaires : {mesures}\n"
        f"- Département avec le plus d'absences ce mois : {top_dept} ({top_dept_nb} absences)\n"
        f"- Employés actifs avec plus de 36 jours de congé en solde : {soldes_eleves}\n"
        f"Adopte un ton professionnel et neutre. Identifie les points d'attention prioritaires."
    )
    text = _call_ollama(prompt)

    if not text:
        # Fallback déterministe
        pts = []
        if conges_att > 0:
            pts.append(f"{conges_att} demande(s) de congé en attente de validation")
        if missions_att > 0:
            pts.append(f"{missions_att} mission(s) à approuver")
        if de_att > 0:
            pts.append(f"{de_att} demande(s) d'explication sans réponse")
        if soldes_eleves > 0:
            pts.append(f"{soldes_eleves} employé(s) avec un solde de congé supérieur à 36 jours")

        if pts:
            alerte = "Points d'attention : " + " ; ".join(pts) + "."
        else:
            alerte = "Aucune action urgente à ce jour."

        text = (
            f"Situation RH au {today.strftime('%d/%m/%Y')} : "
            f"{nb_actifs} employés actifs sur {nb_total} au total. "
            f"{alerte} "
            f"Le département {top_dept} concentre le plus d'absences ce mois "
            f"({top_dept_nb} absence(s)). "
            f"Suivi recommandé sur les soldes de congé élevés et les demandes en attente."
        )

    return {'text': text, 'generated_at': datetime.utcnow().isoformat(), 'source': 'ollama' if _call_ollama is not None else 'deterministic'}


@router.get('/dashboard-insights/{matricule}')
def dashboard_insights(
    matricule: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Insights et recommandations personnalisés pour un employé / manager."""
    role = (current_user.get('role') or '').upper()
    if current_user['matricule'] != matricule and role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès refusé.')

    emp = db.query(models.Employe).filter_by(matricule=matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employé introuvable.')

    # Métriques personnelles
    solde = emp.solde_conges or 0
    nb_ops = db.query(func.count(models.Operation.id_operation)).filter_by(matricule=matricule).scalar() or 0
    ops_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.matricule == matricule,
        models.Operation.statut == 'en attente',
    ).scalar() or 0
    nb_missions_cours = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.matricule == matricule,
        models.Operation.type_demande == 'Mission',
        models.Operation.statut == 'approuvé',
    ).scalar() or 0
    nb_des = db.query(func.count(models.DemandeExplicationV2.id_de)).filter_by(
        matricule_employe=matricule).scalar() or 0
    nb_mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).filter_by(
        matricule=matricule).scalar() or 0

    # Périmètre manager (si directeur/RH)
    equipe_count = 0
    if (role in _ROLES_RH or role in {'DIRECTEUR'}) and emp.id_direction:
        equipe_count = db.query(func.count(models.Employe.matricule)).filter(
            models.Employe.id_direction == emp.id_direction,
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
        ).scalar() or 0

    prompt = (
        f"Tu es un assistant RH. Génère 2 à 4 recommandations concrètes en français pour "
        f"{emp.prenom} {emp.nom} ({emp.fonction or 'N/R'}) basées sur ces données :\n"
        f"- Solde de congé : {solde} jours\n"
        f"- Opérations en cours / totales : {ops_att} en attente / {nb_ops} total\n"
        f"- Missions approuvées : {nb_missions_cours}\n"
        f"- Demandes d'explication : {nb_des}\n"
        f"- Mesures disciplinaires : {nb_mesures}\n"
        + (f"- Effectif direction : {equipe_count} personnes actives\n" if equipe_count else "")
        + "Adopte un ton bienveillant et professionnel. Chaque recommandation doit être actionnable."
    )
    text = _call_ollama(prompt)

    if not text:
        # Fallback déterministe amélioré
        recs = []
        if solde > 36:
            recs.append(f"Solde de congé élevé ({solde} j) : planifiez la prise de congé avant la fin de l'année pour éviter la perte de jours.")
        elif solde < 3:
            recs.append(f"Solde de congé faible ({solde} j) : veillez à bien enregistrer toutes vos absences.")
        if ops_att > 0:
            recs.append(f"{ops_att} opération(s) en attente de validation — relancez votre responsable si nécessaire.")
        if nb_missions_cours > 0:
            recs.append(f"{nb_missions_cours} mission(s) en cours : vérifiez que les rapports de mission et remboursements sont soumis dans les délais.")
        if nb_mesures >= 2:
            recs.append("Plusieurs mesures disciplinaires enregistrées — un entretien de suivi est recommandé.")
        if nb_des >= 1:
            recs.append("Des demandes d'explication ont été émises. Maintenez un dialogue constructif avec la hiérarchie.")
        if not recs:
            recs.append("Aucun indicateur négatif détecté. Profil stable — continuez sur cette lancée et envisagez un bilan de compétences.")
        text = "\n\n".join(f"{i+1}. {r}" for i, r in enumerate(recs))

    return {
        'matricule': matricule,
        'nom': f"{emp.prenom} {emp.nom}",
        'text': text,
        'generated_at': datetime.utcnow().isoformat(),
    }


@router.get('/rapport-narratif')
def rapport_narratif(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Rapport narratif RH complet — RH/ADMIN/DG/PCA uniquement."""
    role = (current_user.get('role') or '').upper()
    if role not in {'RH', 'ADMIN', 'DG', 'PCA'}:
        raise HTTPException(status_code=403, detail='Accès réservé.')

    today = datetime.utcnow().date()

    # Métriques globales
    nb_total = db.query(func.count(models.Employe.matricule)).scalar() or 0
    nb_actifs = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF).scalar() or 0

    hommes = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.sexe == models.SexeEnum.M).scalar() or 0
    femmes = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.sexe == models.SexeEnum.F).scalar() or 0

    conges_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Congé', models.Operation.statut == 'en attente').scalar() or 0
    conges_app = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Congé', models.Operation.statut == 'approuvé').scalar() or 0

    missions_att = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Mission', models.Operation.statut == 'en attente').scalar() or 0
    missions_app = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Mission', models.Operation.statut == 'approuvé').scalar() or 0

    # Missions longues non remboursées (> 30 jours approuvées sans remboursement)
    missions_longues = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == 'Mission',
        models.Operation.statut == 'approuvé',
        func.datediff(today, models.Operation.date_debut) > 30,
    ).scalar() or 0

    de_att = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.statut == 'EN_ATTENTE').scalar() or 0
    mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).scalar() or 0

    soldes_eleves = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.solde_conges > 36,
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
    ).scalar() or 0

    prompt = (
        f"Tu es un consultant RH senior. Rédige un rapport narratif structuré en français "
        f"pour la direction générale, basé sur les données suivantes du {today.strftime('%d/%m/%Y')} :\n\n"
        f"EFFECTIFS\n"
        f"- Total : {nb_total} employés ({nb_actifs} actifs, {nb_total - nb_actifs} inactifs)\n"
        f"- Répartition : {hommes} hommes, {femmes} femmes\n\n"
        f"CONGÉS ET ABSENCES\n"
        f"- Demandes en attente : {conges_att}\n"
        f"- Congés approuvés : {conges_app}\n"
        f"- Employés avec solde > 36 jours : {soldes_eleves}\n\n"
        f"MISSIONS\n"
        f"- En attente de validation : {missions_att}\n"
        f"- En cours (approuvées) : {missions_app}\n"
        f"- Missions > 30 jours sans clôture : {missions_longues}\n\n"
        f"DISCIPLINE ET GESTION\n"
        f"- Demandes d'explication en attente : {de_att}\n"
        f"- Mesures disciplinaires totales : {mesures}\n\n"
        f"Structure ton rapport avec : 1) Synthèse exécutive, 2) Points d'attention, "
        f"3) Recommandations stratégiques. Sois concis mais précis (max 300 mots)."
    )
    text = _call_ollama(prompt)

    if not text:
        # Fallback structuré
        alertes = []
        if conges_att > 5:
            alertes.append(f"Volume important de congés en attente ({conges_att})")
        if missions_longues > 0:
            alertes.append(f"{missions_longues} mission(s) en cours depuis plus de 30 jours sans clôture")
        if de_att > 0:
            alertes.append(f"{de_att} demande(s) d'explication sans réponse")
        if soldes_eleves > 0:
            alertes.append(f"{soldes_eleves} employé(s) avec plus de 36 jours de congé en solde")

        text = (
            f"**1. Synthèse exécutive**\n"
            f"Au {today.strftime('%d/%m/%Y')}, l'entreprise compte {nb_total} employés "
            f"dont {nb_actifs} actifs ({hommes} hommes, {femmes} femmes). "
            f"{conges_app} congés sont approuvés et {missions_app} missions sont en cours.\n\n"
            f"**2. Points d'attention**\n"
            + ("\n".join(f"- {a}" for a in alertes) if alertes else "- Aucune alerte majeure détectée.")
            + f"\n\n**3. Recommandations**\n"
            f"- Traiter en priorité les {conges_att} demandes de congé en attente.\n"
            + (f"- Clôturer les {missions_longues} missions longues sans remboursement.\n" if missions_longues else "")
            + f"- Maintenir le suivi des soldes de congé élevés pour prévenir les reports excessifs."
        )

    return {
        'text': text,
        'generated_at': datetime.utcnow().isoformat(),
        'periode': today.strftime('%d/%m/%Y'),
    }


# ── Endpoint unifié — Insights & Recommandations multi-pages ────────────────

class InsightsRequest(BaseModel):
    page: str = 'dashboard'           # dashboard | analytics | score_comportemental
    tab: Optional[str] = None         # personnel | departements | mois | annee | ...
    filters: Optional[dict] = None    # date_debut, date_fin, annee, mois, direction, entite, departement, matricule
    lang: Optional[str] = 'fr'        # fr | en
    depth: Optional[str] = 'détaillé' # court | moyen | détaillé


@router.post('/insights')
def insights(
    body: InsightsRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Endpoint unifié — génère des insights structurés (synthèse, KPIs,
    points d'attention, recommandations priorisées, narratif) en s'adaptant
    à la page, l'onglet actif, le rôle utilisateur et les filtres temporels.
    """
    role = (current_user.get('role') or '').upper()
    page = (body.page or 'dashboard').lower()

    # Contrôle d'accès léger : analytics et rapport-narratif réservés aux RH/DG/PCA/ADMIN
    if page in {'analytics', 'score_comportemental'} and role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès réservé aux RH / DG / PCA / ADMIN.')

    return generate_insights(
        db=db,
        current_user=current_user,
        page=page,
        tab=body.tab,
        filters=body.filters or {},
        lang=(body.lang or 'fr'),
        depth=(body.depth or 'détaillé'),
    )
