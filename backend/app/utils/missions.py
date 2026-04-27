"""
Système de gestion des missions avec rapports et frais
"""
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Tuple, Dict, List, Optional
from sqlalchemy.orm import Session
from ..models import (
    Mission, Frais, Operation, Employe, Notification, TypeNotificationEnum,
    MissionnairesMission
)


DELAI_RAPPORT_MISSION = 2  # 48 heures pour soumettre le rapport


def creer_mission(
    id_operation: int,
    pays: str,
    ville: str,
    moyens_transport: List[str],
    heure_depart: str,
    heure_retour: str,
    email_mission: Optional[str],
    db: Session
) -> Tuple[bool, str]:
    """
    Crée une mission.
    
    Args:
        id_operation: ID de l'opération
        pays: Pays de destination
        ville: Ville de destination
        moyens_transport: Liste des moyens de transport (routiere, maritime, aerien, ferroviaire)
        heure_depart: Heure de départ (format HH:MM)
        heure_retour: Heure de retour (format HH:MM)
        email_mission: Email de la personne à envoyer en mission (si créée par supérieur)
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    # Calculer la date limite pour le rapport (48h après date de retour)
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    if not operation:
        return False, "Opération introuvable"
    
    date_limite_rapport = operation.date_retour + timedelta(days=DELAI_RAPPORT_MISSION)
    
    # Convertir les moyens de transport en JSON
    import json
    moyens_transport_json = json.dumps(moyens_transport)
    
    mission = Mission(
        id_mission=id_operation,
        pays=pays,
        ville=ville,
        email_mission=email_mission,
        moyens_transport=moyens_transport_json,
        heure_depart=heure_depart,
        heure_retour=heure_retour,
        rapport=None,
        rapport_televerse=False,
        date_limite_rapport=date_limite_rapport
    )
    
    db.add(mission)
    db.commit()
    
    # Si un email est fourni, envoyer une notification
    if email_mission:
        envoyer_notification_mission(email_mission, id_operation, operation, db)
    
    return True, f"Mission créée. Rapport à soumettre avant le {date_limite_rapport}"


def televerser_rapport_mission(
    id_operation: int,
    rapport: str,
    matricule: str,
    db: Session
) -> Tuple[bool, str]:
    """
    Téléverse le rapport de mission.
    
    Args:
        id_operation: ID de l'opération/mission
        rapport: Contenu du rapport ou chemin du fichier
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    mission = db.query(Mission).filter(Mission.id_mission == id_operation).first()
    
    if not mission:
        return False, "Mission introuvable"
    
    # Vérifier le délai
    if date.today() > mission.date_limite_rapport:
        return False, f"Délai dépassé. Date limite était le {mission.date_limite_rapport}"
    
    mission.rapport = rapport
    mission.rapport_televerse = True
    mission.date_telechargement_rapport = datetime.now()
    
    db.commit()
    
    # Notifier le RH
    from .activation_cloture import creer_notification_rh
    creer_notification_rh(
        id_operation,
        "Rapport de mission soumis",
        f"L'employé {matricule} a soumis son rapport de mission",
        db
    )
    
    return True, "Rapport de mission téléversé avec succès"


def verifier_rapport_mission(
    id_operation: int,
    db: Session
) -> Tuple[bool, str]:
    """
    Vérifie si le rapport de mission a été soumis dans les délais.
    
    Args:
        id_operation: ID de l'opération/mission
        db: Session de base de données
    
    Returns:
        Tuple (rapport_ok, message)
    """
    mission = db.query(Mission).filter(Mission.id_mission == id_operation).first()
    
    if not mission:
        return True, "Pas une mission"  # OK si ce n'est pas une mission
    
    if mission.rapport_televerse:
        return True, "Rapport soumis"
    
    if date.today() > mission.date_limite_rapport:
        return False, f"Rapport non soumis. Délai dépassé ({mission.date_limite_rapport})"
    
    jours_restants = (mission.date_limite_rapport - date.today()).days
    return False, f"Rapport non soumis. {jours_restants} jours restants"


def creer_demande_frais(
    id_operation: int,
    matricule: str,
    frais_transport_voyage: Decimal,
    frais_hotel: Decimal,
    frais_deplacement: Decimal,
    frais_nutrition: Decimal,
    preuves_paiement: List[str],
    justificatif: Optional[str],
    db: Session
) -> Tuple[bool, str, Optional[Frais]]:
    """
    Crée une demande de frais de mission.
    
    Args:
        id_operation: ID de l'opération/mission
        matricule: Matricule de l'employé
        frais_transport_voyage: Frais de transport
        frais_hotel: Frais d'hôtel
        frais_deplacement: Frais de déplacement
        frais_nutrition: Frais de nutrition
        preuves_paiement: Liste des chemins des fichiers de preuves
        justificatif: Justificatif général
        db: Session de base de données
    
    Returns:
        Tuple (succès, message, frais)
    """
    mission = db.query(Mission).filter(Mission.id_mission == id_operation).first()
    
    if not mission:
        return False, "Mission introuvable", None
    
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    
    # Autoriser l'initiateur OU tout missionnaire assigné à la mission
    est_missionnaire = db.query(MissionnairesMission).filter(
        MissionnairesMission.id_mission == id_operation,
        MissionnairesMission.matricule == matricule
    ).first() is not None
    if operation.matricule != matricule and not est_missionnaire:
        return False, "Vous n'êtes pas autorisé à créer une demande de frais pour cette mission", None
    
    # Calculer le total
    total_frais = frais_transport_voyage + frais_hotel + frais_deplacement + frais_nutrition
    
    # Convertir les preuves en JSON
    import json
    preuves_json = json.dumps(preuves_paiement)
    
    # Un seul dossier de frais par personne par mission
    frais_existants = db.query(Frais).join(
        Operation, Operation.id_operation == Frais.id_operation
    ).filter(
        Frais.id_mission == id_operation,
        Operation.matricule == matricule
    ).first()
    
    if frais_existants:
        return False, "Une demande de frais existe déjà pour cette mission", None
    
    operation_frais = Operation(
        matricule=matricule,
        titre=f"Frais – {mission.ville or mission.pays or 'mission'}",
        commentaire=justificatif,
        type_demande='Frais de mission',
        statut='en attente',
        date_debut=operation.date_debut,
        date_fin=operation.date_fin,
        duree_jours=operation.duree_jours,
        motif=justificatif,
        date_demande=datetime.now(),
        cree_par=matricule
    )
    db.add(operation_frais)
    db.commit()
    db.refresh(operation_frais)

    frais = Frais(
        id_frais=operation_frais.id_operation,
        id_operation=operation_frais.id_operation,
        id_mission=id_operation,
        frais_transport_voyage=frais_transport_voyage,
        frais_hotel=frais_hotel,
        frais_deplacement=frais_deplacement,
        frais_nutrition=frais_nutrition,
        total_frais=total_frais,
        preuves_paiement=preuves_json,
        justificatif_de_frais=justificatif
    )
    
    db.add(frais)
    db.commit()
    
    # Notifier le prochain validateur du workflow de frais
    from . import workflow, notifications

    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation_frais.id_operation, db)
    if prochain_matricule:
        _emp = db.query(Employe).filter(Employe.matricule == matricule).first()
        _nom_emp = f"{_emp.prenom} {_emp.nom}" if _emp else f"l'employé #{matricule}"
        notifications.notifier_prochain_validateur(
            role=prochain_role,
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre='Une nouvelle demande de frais de mission',
            message=f"{_nom_emp} a soumis une demande de frais de mission ({total_frais} FCFA) pour la mission de {mission.ville or mission.pays or 'destination'}.",
            id_operation=operation_frais.id_operation,
            db=db
        )

    return True, f"Demande de frais créée. Total: {total_frais}", frais


def televerser_preuves_frais(
    id_frais: int,
    type_preuve: str,
    chemin_fichier: str,
    db: Session
) -> Tuple[bool, str]:
    """
    Téléverse des preuves de paiement (tickets de bus, reçus d'hôtel, etc.).
    
    Args:
        id_frais: ID de la demande de frais
        type_preuve: Type de preuve (transport, hotel, deplacement, nutrition)
        chemin_fichier: Chemin du fichier téléversé
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    frais = db.query(Frais).filter(Frais.id_frais == id_frais).first()
    
    if not frais:
        return False, "Demande de frais introuvable"
    
    # Récupérer les preuves existantes
    import json
    preuves = json.loads(frais.preuves_paiement) if frais.preuves_paiement else []
    
    # Ajouter la nouvelle preuve
    preuves.append({
        'type': type_preuve,
        'fichier': chemin_fichier,
        'date_telechargement': datetime.now().isoformat()
    })
    
    frais.preuves_paiement = json.dumps(preuves)
    db.commit()
    
    return True, f"Preuve de {type_preuve} téléversée avec succès"


def obtenir_frais_mission(
    id_operation: int,
    db: Session
) -> Optional[Dict]:
    """
    Récupère les frais d'une mission.
    
    Args:
        id_operation: ID de l'opération/mission
        db: Session de base de données
    
    Returns:
        Dictionnaire avec les détails des frais ou None
    """
    frais = db.query(Frais).filter(Frais.id_mission == id_operation).first()
    
    if not frais:
        return None
    
    import json
    preuves = json.loads(frais.preuves_paiement) if frais.preuves_paiement else []
    
    return {
        'id_frais': frais.id_frais,
        'frais_transport_voyage': float(frais.frais_transport_voyage) if frais.frais_transport_voyage else 0,
        'frais_hotel': float(frais.frais_hotel) if frais.frais_hotel else 0,
        'frais_deplacement': float(frais.frais_deplacement) if frais.frais_deplacement else 0,
        'frais_nutrition': float(frais.frais_nutrition) if frais.frais_nutrition else 0,
        'total_frais': float(frais.total_frais) if frais.total_frais else 0,
        'justificatif': frais.justificatif_de_frais,
        'preuves_paiement': preuves
    }


def envoyer_notification_mission(
    email: str,
    id_operation: int,
    operation: Operation,
    db: Session
):
    """
    Envoie une notification par email lorsqu'un supérieur crée une mission.
    Uniquement après que la mission a été validée par le dernier validateur.
    
    Args:
        email: Email de la personne à envoyer en mission
        id_operation: ID de l'opération
        operation: Instance de l'opération
        db: Session de base de données
    """
    # Trouver l'employé par email
    employe = db.query(Employe).filter(Employe.email == email).first()
    
    if not employe:
        return
    
    # Créer une notification
    notification = Notification(
        matricule=employe.matricule,
        type_notification=TypeNotificationEnum.DEMANDE_MISSION,
        titre="Vous êtes désigné pour une mission",
        message=f"Vous avez été désigné pour une mission du {operation.date_depart} au {operation.date_retour}. "
               f"Veuillez soumettre votre demande de frais via l'onglet Frais.",
        id_operation=id_operation
    )
    db.add(notification)
    db.commit()
    
    # TODO: Envoyer email avec lien vers l'application
    # Le lien devrait pointer vers /frais?mission={id_operation}


def verifier_alertes_rapport_mission(db: Session):
    """
    Vérifie les missions dont le rapport n'a pas été soumis et envoie des rappels.
    À exécuter quotidiennement (cron job).
    
    Args:
        db: Session de base de données
    """
    today = date.today()
    
    # Trouver les missions dont le rapport n'est pas soumis
    missions = db.query(Mission).filter(
        Mission.rapport_televerse == False,
        Mission.date_limite_rapport >= today - timedelta(days=1)  # Dans les 24h du délai
    ).all()
    
    for mission in missions:
        operation = db.query(Operation).filter(Operation.id_operation == mission.id_mission).first()
        
        if operation:
            jours_restants = (mission.date_limite_rapport - today).days
            
            if jours_restants <= 1:  # Rappel critique
                notification = Notification(
                    matricule=operation.matricule,
                    type_notification=TypeNotificationEnum.AUTRE,
                    titre=f"URGENT: Rapport de mission à soumettre",
                    message=f"Il vous reste {jours_restants} jour(s) pour soumettre votre rapport de mission. "
                           f"Date limite: {mission.date_limite_rapport}",
                    id_operation=mission.id_mission
                )
                db.add(notification)
    
    db.commit()


def obtenir_moyens_transport_disponibles() -> List[str]:
    """
    Retourne la liste des moyens de transport disponibles.
    
    Returns:
        Liste des moyens de transport
    """
    return ['routiere', 'maritime', 'aerien', 'ferroviaire']


def verifier_missions_a_activer(db: Session):
    """
    Vérifie les missions validées dont l'activation est incomplète et dont le départ
    est dans moins de 48h. Envoie des rappels d'activation aux missionnaires.

    - Rappel à 48h avant le départ (si pas encore envoyé)
    - Rappel urgent à 24h avant le départ (si pas encore envoyé)

    Anti-doublon : ne renvoie pas si un rappel identique a été envoyé dans les 12 dernières heures.
    """
    from ..models import Activation, TypeActionEnum, StatutFinalEnum, Notification

    now = datetime.now()
    limite_48h = (now + timedelta(hours=48)).date()
    today = now.date()
    limite_12h_back = now - timedelta(hours=12)

    # Missions validées dont l'activation n'est pas complète
    missions_a_activer = db.query(Operation).join(
        Mission, Mission.id_mission == Operation.id_operation
    ).filter(
        Operation.type_demande == 'Mission',
        Operation.statut == 'validé',
        Operation.date_debut != None,
        Operation.date_debut <= limite_48h,
        Operation.date_debut >= today,
    ).all()

    for operation in missions_a_activer:
        activation = db.query(Activation).filter(
            Activation.id_operation == operation.id_operation,
            Activation.type_action == TypeActionEnum.ACTIVATION
        ).first()

        # Skip si déjà complètement activé
        if activation and activation.statut_final == StatutFinalEnum.COMPLETE:
            continue

        delta = datetime.combine(operation.date_debut, datetime.min.time()) - now
        heures_restantes = delta.total_seconds() / 3600

        if heures_restantes <= 0:
            continue

        # Déterminer le type de rappel
        if heures_restantes <= 24:
            type_rappel = '24h'
            urgence = 'URGENT – '
        elif heures_restantes <= 48:
            type_rappel = '48h'
            urgence = ''
        else:
            continue

        # Récupérer les infos de destination
        mission_obj = db.query(Mission).filter(Mission.id_mission == operation.id_operation).first()
        destination = f"{mission_obj.ville}, {mission_obj.pays}" if mission_obj and mission_obj.ville else (mission_obj.pays if mission_obj else "la destination")

        # Récupérer les missionnaires
        missionnaires = db.query(MissionnairesMission).filter(
            MissionnairesMission.id_mission == operation.id_operation
        ).all()
        matricules = [m.matricule for m in missionnaires]
        if operation.matricule not in matricules:
            matricules.append(operation.matricule)

        id_op = operation.id_operation

        for mat in matricules:
            # Anti-doublon : vérifier si un rappel du même type a été envoyé dans les 12 dernières heures
            rappel_recent = db.query(Notification).filter(
                Notification.matricule == mat,
                Notification.titre.like(f'%rappel {type_rappel}%'),
                Notification.date_creation >= limite_12h_back,
                Notification.id_operation == id_op,
            ).first()
            if rappel_recent:
                continue

            heures_display = int(heures_restantes)
            notif = Notification(
                matricule=mat,
                type_notification=TypeNotificationEnum.RAPPEL_DEPART,
                titre=f"{urgence}Rappel {type_rappel} – Activez votre mission avant le départ",
                message=(
                    f"La mission de {destination} "
                    f"débute le {operation.date_debut} (dans environ {heures_display}h) "
                    f"et n'est pas encore activée. "
                    f"Rendez-vous dans l'onglet « Reçu » de la page Missions pour l'activer."
                ),
                id_operation=id_op,
            )
            db.add(notif)

    db.commit()


def verifier_relances_rapport_mission(db: Session):
    """
    Système de relances automatiques pour les rapports de mission non soumis.
    
    Relances:
    - 48H après la date de fin: 1ère relance aux missionnaires
    - 72H après la date de fin: 2ème relance aux missionnaires
    - 96H après la date de fin: 3ème relance aux missionnaires
    - Après 96H: Escalade vers RH et Inspecteur Général (fonction IG)
    
    À exécuter toutes les 2 heures pour détecter les missions à relancer.
    
    Args:
        db: Session de base de données
    """
    from ..models import RelanceMission, MissionnairesMission, Operation
    import json
    
    now = datetime.now()
    today = date.today()
    
    # Trouver toutes les missions dont le rapport n'est pas soumis
    missions = db.query(Mission).join(
        Operation,
        Mission.id_mission == Operation.id_operation
    ).filter(
        Mission.rapport_televerse == False,
        Operation.date_fin < today  # Mission terminée
    ).all()
    
    for mission in missions:
        operation = db.query(Operation).filter(Operation.id_operation == mission.id_mission).first()
        
        if not operation or not operation.date_fin:
            continue
        
        # Calculer le temps écoulé depuis la fin de la mission
        temps_ecoule = now - datetime.combine(operation.date_fin, datetime.min.time())
        heures_ecoulees = temps_ecoule.total_seconds() / 3600
        
        # Vérifier les relances déjà envoyées
        relances_existantes = db.query(RelanceMission).filter(
            RelanceMission.id_mission == mission.id_mission,
            RelanceMission.statut == 'envoyee'
        ).all()
        
        types_relances_envoyees = [r.type_relance for r in relances_existantes]
        
        # Récupérer tous les missionnaires de cette mission
        missionnaires = db.query(MissionnairesMission, Employe).join(
            Employe,
            MissionnairesMission.matricule == Employe.matricule
        ).filter(
            MissionnairesMission.id_mission == mission.id_mission
        ).all()
        
        matricules_missionnaires = [mm.matricule for mm, _ in missionnaires]
        noms_missionnaires = [f"{emp.prenom} {emp.nom}" for _, emp in missionnaires]
        
        # Relance à 48H
        if heures_ecoulees >= 48 and '48h' not in types_relances_envoyees:
            envoyer_relance_rapport(
                db, mission, matricules_missionnaires, noms_missionnaires,
                '48h', "1ère relance", "Il y a 48 heures que votre mission est terminée"
            )
        
        # Relance à 72H
        elif heures_ecoulees >= 72 and '72h' not in types_relances_envoyees:
            envoyer_relance_rapport(
                db, mission, matricules_missionnaires, noms_missionnaires,
                '72h', "2ème relance", "Il y a 72 heures que votre mission est terminée"
            )
        
        # Relance à 96H
        elif heures_ecoulees >= 96 and '96h' not in types_relances_envoyees:
            envoyer_relance_rapport(
                db, mission, matricules_missionnaires, noms_missionnaires,
                '96h', "3ème et DERNIÈRE relance", "Il y a 96 heures que votre mission est terminée"
            )
        
        # Escalade après 96H (si aucune escalade n'a été envoyée)
        elif heures_ecoulees > 96 and 'escalade_rh_ig' not in types_relances_envoyees:
            escalader_vers_rh_ig(db, mission, matricules_missionnaires, noms_missionnaires, operation)
    
    db.commit()


def envoyer_relance_rapport(
    db: Session,
    mission: Mission,
    matricules_missionnaires: List[str],
    noms_missionnaires: List[str],
    type_relance: str,
    numero_relance: str,
    message_contexte: str
):
    """
    Envoie une relance aux missionnaires pour le rapport de mission.
    
    Args:
        db: Session de base de données
        mission: L'objet Mission
        matricules_missionnaires: Liste des matricules des missionnaires
        noms_missionnaires: Liste des noms des missionnaires
        type_relance: Type de relance ('48h', '72h', '96h')
        numero_relance: Libellé du numéro de relance
        message_contexte: Message de contexte
    """
    from ..models import Notification, TypeNotificationEnum
    import json
    
    # Envoyer une notification à chaque missionnaire
    for matricule in matricules_missionnaires:
        notification = Notification(
            matricule=matricule,
            type_notification=TypeNotificationEnum.AUTRE,
            titre=f"⚠️ {numero_relance}: Rapport non soumis – {mission.ville or mission.pays or 'mission'}",
            message=f"{message_contexte}. Veuillez téléverser votre rapport de mission dans les plus brefs délais.",
            id_operation=mission.id_mission
        )
        db.add(notification)
    
    # Enregistrer la relance
    relance = db.query(db.bind.execute(
        "SELECT * FROM RelanceMission"
    )).first() is None  # Check if table exists
    
    from ..models import RelanceMission
    relance = RelanceMission(
        id_mission=mission.id_mission,
        type_relance=type_relance,
        destinataires=json.dumps(matricules_missionnaires),
        statut='envoyee'
    )
    db.add(relance)
    
    print(f"[Relance {type_relance}] Mission #{mission.id_mission} - Envoyé à {len(matricules_missionnaires)} missionnaire(s)")


def escalader_vers_rh_ig(
    db: Session,
    mission: Mission,
    matricules_missionnaires: List[str],
    noms_missionnaires: List[str],
    operation: Operation
):
    """
    Escalade le non-téléversement du rapport vers les RH et l'Inspecteur Général.
    
    Args:
        db: Session de base de données
        mission: L'objet Mission
        matricules_missionnaires: Liste des matricules des missionnaires
        noms_missionnaires: Liste des noms des missionnaires
        operation: L'opération liée
    """
    from ..models import Notification, TypeNotificationEnum, RelanceMission, Employe
    import json
    
    # Trouver tous les employés RH et IG
    employes_rh_ig = db.query(Employe).filter(
        (Employe.fonction.ilike('%RH%')) | (Employe.fonction.ilike('%IG%')) | (Employe.fonction.ilike('%Inspecteur%'))
    ).all()
    
    if not employes_rh_ig:
        print(f"[Escalade] Aucun RH ou IG trouvé pour la mission #{mission.id_mission}")
        return
    
    noms_str = ", ".join(noms_missionnaires)
    jours_ecoules = (date.today() - operation.date_fin).days
    
    # Envoyer notification aux RH et IG
    for employe in employes_rh_ig:
        notification = Notification(
            matricule=employe.matricule,
            type_notification=TypeNotificationEnum.AUTRE,
            titre=f"🚨 ESCALADE: Rapport non soumis – {mission.ville or mission.pays or 'mission'} (>96H)",
            message=f"Les missionnaires ({noms_str}) n'ont pas soumis leur rapport de mission malgré 3 relances. "
                   f"Mission terminée il y a {jours_ecoules} jours. Destination: {mission.ville}, {mission.pays}. "
                   f"Action requise.",
            id_operation=mission.id_mission
        )
        db.add(notification)
    
    # Enregistrer l'escalade
    relance = RelanceMission(
        id_mission=mission.id_mission,
        type_relance='escalade_rh_ig',
        destinataires=json.dumps([e.matricule for e in employes_rh_ig]),
        statut='envoyee'
    )
    db.add(relance)
    
    print(f"[Escalade] Mission #{mission.id_mission} - Envoyé à {len(employes_rh_ig)} RH/IG")
