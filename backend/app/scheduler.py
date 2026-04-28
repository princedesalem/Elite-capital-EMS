"""
Tâches planifiées (Cron Jobs) pour le système EMS
À configurer avec APScheduler ou Celery
"""
from datetime import datetime
from sqlalchemy.orm import Session
from .utils.notifications import (
    envoyer_alerte_conges_fin_annee,
    envoyer_rappel_depart_conges,
    envoyer_rappel_retour_conges,
    nettoyer_anciennes_notifications,
    notifier_tous_employes_debut_operation
)
from .utils.activation_cloture import verifier_delai_cloture
from .utils.missions import verifier_alertes_rapport_mission, verifier_relances_rapport_mission, verifier_missions_a_activer
from .utils.permissions import envoyer_rappel_preuves_permission
from .utils.business_logic import calculer_augmentation_solde_mensuel
from .utils.relances import executer_relances
from .db import SessionLocal
from .models import Employe, PermConventionelle


def job_quotidien():
    """
    Tâche quotidienne à exécuter chaque jour à 8h00.
    
    - Vérifier les délais de clôture des opérations
    - Envoyer rappels de départ/retour
    - Vérifier les rapports de mission non soumis
    - Envoyer rappels pour preuves permissions conventionnelles
    """
    print(f"[{datetime.now()}] Exécution des tâches quotidiennes...")
    
    db = SessionLocal()
    try:
        # 1. Vérifier les délais de clôture
        print("  - Vérification des délais de clôture...")
        verifier_delai_cloture(db)
        
        # 2. Rappels de départ
        print("  - Envoi des rappels de départ...")
        envoyer_rappel_depart_conges(db)
        
        # 3. Rappels de retour
        print("  - Envoi des rappels de retour...")
        envoyer_rappel_retour_conges(db)
        
        # 4. Alertes rapports de mission
        print("  - Vérification des rapports de mission...")
        verifier_alertes_rapport_mission(db)
        
        # 5. Rappels preuves permissions
        print("  - Envoi des rappels pour preuves permissions...")
        permissions = db.query(PermConventionelle).filter(
            PermConventionelle.preuves_televersees == False
        ).all()
        
        for perm in permissions:
            from .utils.permissions import envoyer_rappel_preuves_permission
            envoyer_rappel_preuves_permission(perm.id_perm_c, db)

        # 6. Notifier tous les employés des absences commençant aujourd'hui
        print("  - Notification broadcast début d'absence...")
        notifier_tous_employes_debut_operation(db)

        print(f"[{datetime.now()}] Tâches quotidiennes terminées avec succès.")
    
    except Exception as e:
        print(f"[{datetime.now()}] Erreur lors des tâches quotidiennes: {e}")
        db.rollback()
    finally:
        db.close()


def job_hebdomadaire():
    """
    Tâche hebdomadaire à exécuter chaque lundi à 9h00.
    
    - Envoyer alertes de fin d'année pour prendre les congés (Oct-Déc)
    - Nettoyer les anciennes notifications
    """
    print(f"[{datetime.now()}] Exécution des tâches hebdomadaires...")
    
    db = SessionLocal()
    try:
        # 1. Alertes congés fin d'année
        print("  - Envoi des alertes congés fin d'année...")
        envoyer_alerte_conges_fin_annee(db)
        
        # 2. Nettoyage des notifications
        print("  - Nettoyage des anciennes notifications...")
        nettoyer_anciennes_notifications(90, db)  # 90 jours de rétention
        
        print(f"[{datetime.now()}] Tâches hebdomadaires terminées avec succès.")
    
    except Exception as e:
        print(f"[{datetime.now()}] Erreur lors des tâches hebdomadaires: {e}")
        db.rollback()
    finally:
        db.close()


def job_mensuel():
    """
    Tâche mensuelle à exécuter le 1er de chaque mois à 00h30.
    
    - Mettre à jour les soldes de congés (+2 jours/mois)
    """
    print(f"[{datetime.now()}] Exécution des tâches mensuelles...")
    
    db = SessionLocal()
    try:
        print("  - Mise à jour des soldes de congés...")
        employes = db.query(Employe).all()
        
        compteur = 0
        for employe in employes:
            try:
                calculer_augmentation_solde_mensuel(employe, db)
                compteur += 1
            except Exception as e:
                print(f"    Erreur pour employé {employe.matricule}: {e}")
        
        print(f"  - {compteur} employés mis à jour")
        print(f"[{datetime.now()}] Tâches mensuelles terminées avec succès.")
    
    except Exception as e:
        print(f"[{datetime.now()}] Erreur lors des tâches mensuelles: {e}")
        db.rollback()
    finally:
        db.close()


def job_relances_rapports():
    """
    Tâche de relances automatiques pour les rapports de mission.
    À exécuter toutes les 2 heures.
    
    Système de relances:
    - 48H après la fin: 1ère relance aux missionnaires
    - 72H après la fin: 2ème relance aux missionnaires
    - 96H après la fin: 3ème relance aux missionnaires
    - Après 96H: Escalade vers RH et Inspecteur Général
    """
    print(f"[{datetime.now()}] Vérification des relances de rapports de mission...")
    
    db = SessionLocal()
    try:
        verifier_relances_rapport_mission(db)
        print(f"[{datetime.now()}] Relances de rapports vérifiées avec succès.")
    
    except Exception as e:
        print(f"[{datetime.now()}] Erreur lors des relances de rapports: {e}")
        db.rollback()
    finally:
        db.close()


def job_activation_reminders():
    """
    Vérifie les missions validées dont le départ est dans moins de 48h et
    qui ne sont pas encore activées. Envoie des rappels aux missionnaires.
    À exécuter toutes les 6 heures.
    """
    print(f"[{datetime.now()}] Vérification des rappels d'activation de missions...")

    db = SessionLocal()
    try:
        verifier_missions_a_activer(db)
        print(f"[{datetime.now()}] Rappels d'activation vérifiés avec succès.")

    except Exception as e:
        print(f"[{datetime.now()}] Erreur lors des rappels d'activation: {e}")
        db.rollback()
    finally:
        db.close()


def job_relances_15min():
    """Relances toutes les 15 minutes en heures ouvrées (L-V 8h-18h).

    - Crée une notification RELANCE_VALIDATION pour chaque validateur courant
      d'une opération en attente (déclenche email + push via les events).
    - Ré-émet email + push pour toute notification non lue depuis > 15 min,
      sans créer de doublon en base.
    """
    db = SessionLocal()
    try:
        nb_val, nb_unread = executer_relances(db)
        if nb_val or nb_unread:
            print(
                f"[{datetime.now()}] Relances 15min : {nb_val} validateurs, "
                f"{nb_unread} notifs non lues r\u00e9-\u00e9mises."
            )
    except Exception as e:
        print(f"[{datetime.now()}] Erreur lors des relances 15min: {e}")
        db.rollback()
    finally:
        db.close()


def configurer_scheduler():
    """
    Configure APScheduler avec toutes les tâches planifiées.
    À appeler au démarrage de l'application.
    """
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    
    scheduler = BackgroundScheduler()
    
    # Tâche quotidienne à 8h00
    scheduler.add_job(
        job_quotidien,
        CronTrigger(hour=8, minute=0),
        id='job_quotidien',
        name='Tâches quotidiennes (8h00)',
        replace_existing=True
    )
    
    # Tâche hebdomadaire chaque lundi à 9h00
    scheduler.add_job(
        job_hebdomadaire,
        CronTrigger(day_of_week='mon', hour=9, minute=0),
        id='job_hebdomadaire',
        name='Tâches hebdomadaires (Lundi 9h00)',
        replace_existing=True
    )
    
    # Tâche mensuelle le 1er à 00h30
    scheduler.add_job(
        job_mensuel,
        CronTrigger(day=1, hour=0, minute=30),
        id='job_mensuel',
        name='Tâches mensuelles (1er du mois 00h30)',
        replace_existing=True
    )
    
    # Tâche de relances toutes les 2 heures
    scheduler.add_job(
        job_relances_rapports,
        CronTrigger(hour='*/2', minute=0),  # Toutes les 2 heures
        id='job_relances_rapports',
        name='Relances rapports de mission (toutes les 2h)',
        replace_existing=True
    )

    # Rappels d'activation de mission (toutes les 6 heures)
    scheduler.add_job(
        job_activation_reminders,
        CronTrigger(hour='*/6', minute=0),
        id='job_activation_reminders',
        name='Rappels activation missions (toutes les 6h)',
        replace_existing=True
    )

    # Relances toutes les 15 minutes (filtre interne heures ouvr\u00e9es L-V 8h-18h)
    scheduler.add_job(
        job_relances_15min,
        CronTrigger(minute='*/15'),
        id='job_relances_15min',
        name='Relances validateurs + notifs non lues (15 min, heures ouvr\u00e9es)',
        replace_existing=True
    )
    
    scheduler.start()
    print("Scheduler configuré et démarré.")
    print("  - Job quotidien: 8h00")
    print("  - Job hebdomadaire: Lundi 9h00")
    print("  - Job mensuel: 1er du mois 00h30")
    print("  - Job relances rapports: Toutes les 2 heures")
    print("  - Job rappels activation missions: Toutes les 6 heures")
    print("  - Job relances 15 min: heures ouvr\u00e9es L-V 8h-18h")
    
    return scheduler


# Pour exécution manuelle en ligne de commande
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        job_name = sys.argv[1]
        
        if job_name == "quotidien":
            job_quotidien()
        elif job_name == "hebdomadaire":
            job_hebdomadaire()
        elif job_name == "mensuel":
            job_mensuel()
        else:
            print(f"Job inconnu: {job_name}")
            print("Usage: python scheduler.py [quotidien|hebdomadaire|mensuel]")
    else:
        print("Usage: python scheduler.py [quotidien|hebdomadaire|mensuel]")
