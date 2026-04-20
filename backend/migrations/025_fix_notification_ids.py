"""
Migration 025 - Remplacement des #id dans les notifications existantes
=======================================================================
Remplace les patterns "#N" (ex: "mission #62", "opération #58") dans les
titres et messages des notifications existantes par des libellés descriptifs
(destination, type d'opération, nom du demandeur).

Usage:
    python migrations/025_fix_notification_ids.py [--dry-run]
"""
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app import models

DRY_RUN = '--dry-run' in sys.argv


def log(msg):
    print(f"[{'DRY-RUN' if DRY_RUN else 'APPLY'}] {msg}")


def _destination_label(op_id: int, db) -> str:
    """Retourne 'de {ville}' ou 'de {pays}' si c'est une mission, sinon ''."""
    mission = db.query(models.Mission).filter(models.Mission.id_mission == op_id).first()
    if mission:
        dest = mission.ville or mission.pays
        if dest:
            return f"de {dest}"
    return ""


def _type_label(op_id: int, db) -> str:
    """Retourne le type_demande de l'opération (ex: 'Mission', 'Congé', …)."""
    op = db.query(models.Operation).filter(models.Operation.id_operation == op_id).first()
    if op and op.type_demande:
        return op.type_demande
    return "demande"


def _destination_for_id(n: int, db) -> str:
    """Retourne 'de {ville/pays}' pour l'id N (mission directe ou via frais)."""
    mission = db.query(models.Mission).filter(models.Mission.id_mission == n).first()
    if mission:
        dest = mission.ville or mission.pays
        if dest:
            return f"de {dest}"
    # n est peut-être un id de frais → chercher la mission liée
    from app.models import Frais
    frais = db.query(Frais).filter(Frais.id_operation == n).first()
    if frais and frais.id_mission:
        mission = db.query(models.Mission).filter(models.Mission.id_mission == frais.id_mission).first()
        if mission:
            dest = mission.ville or mission.pays
            if dest:
                return f"de {dest}"
    return ""


def _replace_id_patterns(text: str, op_id: int, db) -> str:
    """
    Remplace toutes les occurrences de #<chiffres> dans `text`.
    Exemples :
        "mission #62"                          → "mission de Paris"
        "pour la mission #58"                  → "pour la mission de Douala"
        "pour l'opération #62"  (frais op=63)  → "pour la mission de Paris"
        "Mission #58 confirmé"                 → "Mission de Douala confirmé"
        "Frais mission #58 validés"            → "Frais mission de Douala validés"
    """
    if not text or '#' not in text:
        return text

    def replacer(m):
        full_before = m.group(1) or ''          # tout ce qui précède #N
        n = int(m.group(2))
        dest = _destination_for_id(n, db)

        before_lower = full_before.strip().lower()

        # Contexte "mission" présent avant le #N
        if re.search(r'\bmission\b', before_lower):
            suffix = f" {dest}" if dest else ""
            return full_before.rstrip() + suffix

        # Contexte "opération" présent avant le #N
        if re.search(r"op[eé]ration", before_lower):
            if dest:
                # "pour l'opération #N" → "pour la mission de X"
                replaced_before = re.sub(
                    r"l['\u2019]op[eé]ration", "la mission",
                    full_before, flags=re.I
                )
                return replaced_before.rstrip() + f" {dest}"
            else:
                # Pas de destination connue → retire juste le #N
                return full_before.rstrip()

        # Cas générique : retire " #N"
        return full_before.rstrip()

    # Regex : capture tout ce qui précède + #<chiffres>
    pattern = re.compile(
        r"((?:(?:pour\s+)?(?:la\s+|les?\s+)?(?:mission|l['\u2019]op[eé]ration|op[eé]ration)(?:\s+de)?\s*)?)\s*#(\d+)",
        re.IGNORECASE
    )
    result = pattern.sub(replacer, text)

    # Nettoyage : espaces multiples, parenthèses vides
    result = re.sub(r'  +', ' ', result)
    result = re.sub(r'\(\s*\)', '', result)
    result = result.strip()
    return result


def fix_notifications(db):
    # Toutes les notifs contenant un #<chiffres>
    notifs = db.query(models.Notification).filter(
        models.Notification.message.op('REGEXP')(r'#[0-9]+')
    ).all()

    # SQLite ne supporte pas REGEXP sans extension ; fallback Python filter
    if not notifs:
        notifs = db.query(models.Notification).all()
        notifs = [n for n in notifs if n.message and re.search(r'#\d+', n.message)]

    titre_only = db.query(models.Notification).all()
    titre_only = [n for n in titre_only if n.titre and re.search(r'#\d+', n.titre)
                  and n not in notifs]

    all_notifs = notifs + titre_only
    log(f"{len(all_notifs)} notification(s) à corriger.")

    fixed = 0
    for notif in all_notifs:
        op_id = notif.id_operation
        if not op_id:
            # Pas d'opération liée → on retire les #N bruts
            new_msg = re.sub(r'\s*#\d+', '', notif.message or '')
            new_titre = re.sub(r'\s*#\d+', '', notif.titre or '')
        else:
            new_msg = _replace_id_patterns(notif.message or '', op_id, db)
            new_titre = _replace_id_patterns(notif.titre or '', op_id, db)

        changed = (new_msg != notif.message) or (new_titre != notif.titre)
        if changed:
            log(f"  Notif #{notif.id_notification} (op={op_id})")
            if notif.message != new_msg:
                log(f"    msg:   {notif.message!r}")
                log(f"    →      {new_msg!r}")
            if notif.titre != new_titre:
                log(f"    titre: {notif.titre!r}")
                log(f"    →      {new_titre!r}")
            if not DRY_RUN:
                notif.message = new_msg
                notif.titre = new_titre
            fixed += 1

    if not DRY_RUN and fixed:
        db.commit()
    log(f"fix_notifications: {fixed} notification(s) corrigée(s).")
    return fixed


def main():
    db = SessionLocal()
    try:
        fix_notifications(db)
    finally:
        db.close()


if __name__ == '__main__':
    main()
