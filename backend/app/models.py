from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum, Boolean, Text, JSON, DECIMAL, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from .db import Base
import enum
from datetime import datetime


class EntiteEnum(str, enum.Enum):
    GROUP = 'GROUP'
    EXCA = 'EXCA'
    ELCAM = 'ELCAM'
    ECG = 'ECG'

class SexeEnum(str, enum.Enum):
    M = 'M'
    F = 'F'
    AUTRE = 'Autre'

class StatutEmployeEnum(str, enum.Enum):
    ACTIF = 'ACTIF'
    CONGEDIE = 'CONGEDIE'
    SUSPENDU = 'SUSPENDU'

class TypeNotificationEnum(str, enum.Enum):
    VALIDATION = 'VALIDATION'
    REFUS = 'REFUS'
    ALERTE_CONGES = 'ALERTE_CONGES'
    RAPPEL_DEPART = 'RAPPEL_DEPART'
    RAPPEL_RETOUR = 'RAPPEL_RETOUR'
    DEMANDE_MISSION = 'DEMANDE_MISSION'
    DEMANDE_EXPLICATION = 'DEMANDE_EXPLICATION'
    EVALUATION = 'EVALUATION'
    CLOTURE_REQUISE = 'CLOTURE_REQUISE'
    AUTRE = 'AUTRE'

class TypeActionEnum(str, enum.Enum):
    ACTIVATION = 'ACTIVATION'
    CLOTURE = 'CLOTURE'

class StatutFinalEnum(str, enum.Enum):
    EN_ATTENTE = 'EN_ATTENTE'
    COMPLETE = 'COMPLETE'

class StatutEvaluationEnum(str, enum.Enum):
    EN_ATTENTE_AUTO_EVAL = 'EN_ATTENTE_AUTO_EVAL'
    EN_COURS = 'EN_COURS'
    TERMINE = 'TERMINE'

class StatutExplicationEnum(str, enum.Enum):
    EN_ATTENTE = 'EN_ATTENTE'
    REPONDU = 'REPONDU'

class CategorieEnum(str, enum.Enum):
    """Catégories selon la Convention Collective Nationale du Commerce au Cameroun"""
    CADRE_SUP = 'Cadre supérieur'
    CADRE_MOY = 'Cadre moyen'
    AGENT_MAITRISE = 'Agent de maîtrise'
    AGENT_QUALIFICATION = 'Agent qualifié'
    AGENT_NON_QUALIFICATION = 'Agent non qualifié'
    APPRENTI = 'Apprenti'
    STAGIAIRE = 'Stagiaire'


class StatutMatrimonialEnum(str, enum.Enum):
    CELIBATAIRE = 'Celibataire'
    MARIE = 'Marie'


class TypeParcoursEnum(str, enum.Enum):
    PROMOTION = 'PROMOTION'
    MUTATION = 'MUTATION'
    TRANSFERT = 'TRANSFERT'
    EMBAUCHE = 'EMBAUCHE'
    CONGEDIEMENT = 'CONGEDIEMENT'
    AUTRE = 'AUTRE'


class Pays(Base):
    __tablename__ = 'PAYS'
    id_pays = Column(Integer, primary_key=True, autoincrement=True)
    nom_pays = Column(String(100), nullable=False)
    code_pays = Column(String(10), unique=True, nullable=False)


class Localisation(Base):
    __tablename__ = 'LOCALISATION'
    id_localisation = Column(Integer, primary_key=True, autoincrement=True)
    ville = Column(String(100), nullable=False)
    id_pays = Column(Integer, ForeignKey('PAYS.id_pays'), nullable=False)


class Implantation(Base):
    __tablename__ = 'Implantation'
    id_localisation = Column(Integer, ForeignKey('LOCALISATION.id_localisation'), primary_key=True)
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'), primary_key=True)


class Role(Base):
    __tablename__ = 'roles'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, index=True)
    description = Column(String(300), nullable=True)


class FonctionReference(Base):
    __tablename__ = 'FONCTION_REFERENCE'
    id_fonction = Column(Integer, primary_key=True, autoincrement=True)
    libelle = Column(String(200), unique=True, nullable=False)
    id_direction = Column(Integer, ForeignKey('DIRECTION.id_direction'), nullable=True)
    dept_id = Column(Integer, ForeignKey('DEPARTEMENT.dept_id'), nullable=True)


class Employe(Base):
    __tablename__ = 'EMPLOYE'
    matricule = Column(Integer, primary_key=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=True)
    date_naissance = Column(Date, nullable=True)
    sexe = Column(Enum(SexeEnum), nullable=True)
    telephone = Column(String(20), nullable=True)
    diplome = Column(String(150), nullable=True)
    solde_conges = Column(DECIMAL(5,2), default=0)
    date_embauche = Column(Date, nullable=False)
    date_derniere_maj_solde = Column(Date, nullable=True)
    fonction = Column(String(150), nullable=True)
    anciennete = Column(String(100), nullable=True)
    annee_experience = Column(Integer, nullable=True)  # Généré automatiquement en SQL
    categorie = Column(Enum(CategorieEnum), nullable=True)
    anciennete = Column(String(100), nullable=True)  # "X ans Y mois"
    dept_id = Column(Integer, ForeignKey('DEPARTEMENT.dept_id'))
    id_localisation = Column(Integer, ForeignKey('LOCALISATION.id_localisation'), nullable=True)
    id_direction = Column(Integer, ForeignKey('DIRECTION.id_direction'), nullable=True)
    id_role = Column(Integer, ForeignKey('roles.id'))
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'))
    id_direction = Column(Integer, ForeignKey('DIRECTION.id_direction'))
    statut_employe = Column(Enum(StatutEmployeEnum), default=StatutEmployeEnum.ACTIF)
    # absence / backup fields (garder pour compatibilité)
    absent = Column(Boolean, default=False)
    absence_until = Column(Date, nullable=True)
    backup_matricule = Column(Integer, nullable=True)
    n1 = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    n1_fonction = Column(String(255), nullable=True)
    photo_url = Column(String(500), nullable=True)
    contact_urgence = Column(String(30), nullable=True)
    statut_matrimonial = Column(Enum(StatutMatrimonialEnum), nullable=True)
    nombre_enfants = Column(Integer, nullable=True, default=0)
    utilisateur = relationship('Utilisateur', back_populates='employe', uselist=False)


class Utilisateur(Base):
    __tablename__ = 'UTILISATEUR'
    id_user = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), unique=True, nullable=True)
    mot_de_passe_hash = Column(String(500), nullable=False)
    mot_de_passe_temporaire = Column(Boolean, default=True)
    dernier_login = Column(DateTime)
    tentatives_echec = Column(Integer, default=0)
    bloque_jusqua = Column(DateTime)
    date_changement_mdp = Column(DateTime)
    mfa_active = Column(Boolean, default=False)
    # Anciens champs pour compatibilité temporaire
    mfa_enabled = Column(Boolean, default=True)
    mfa_secret = Column(String(100), nullable=True)
    email = Column(String(150), unique=True, nullable=True)
    role_id = Column(Integer, ForeignKey('roles.id'), nullable=True)
    role = relationship('Role', foreign_keys=[role_id])
    employe = relationship('Employe', back_populates='utilisateur')


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(150), nullable=True)
    action = Column(String(200), nullable=False)
    entity = Column(String(150), nullable=True)
    entity_id = Column(String(50), nullable=True)
    detail = Column(Text, nullable=True)
    ip = Column(String(45), nullable=True)
    request_body = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


# additional tables from provided SQL schema

class Entite(Base):
    __tablename__ = 'ENTITE'
    id_entite = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(150), nullable=False)

class Direction(Base):
    __tablename__ = 'DIRECTION'
    id_direction = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(150), nullable=False)
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'), nullable=False)
    id_localisation = Column(Integer, ForeignKey('LOCALISATION.id_localisation'), nullable=True)
    id_directeur = Column(Integer, ForeignKey('EMPLOYE.matricule'))

class Departement(Base):
    __tablename__ = 'DEPARTEMENT'
    dept_id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(150))
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'), nullable=False)
    id_direction = Column(Integer, ForeignKey('DIRECTION.id_direction'))
    id_responsable = Column(Integer, ForeignKey('EMPLOYE.matricule'))
    villes = relationship('DepartementImplantation', back_populates='departement', cascade='all, delete-orphan')


class DepartementImplantation(Base):
    """Junction table: explicit city-presence of a department."""
    __tablename__ = 'DEPARTEMENT_IMPLANTATION'
    dept_id = Column(Integer, ForeignKey('DEPARTEMENT.dept_id', ondelete='CASCADE'), primary_key=True)
    id_localisation = Column(Integer, ForeignKey('LOCALISATION.id_localisation', ondelete='CASCADE'), primary_key=True)
    departement = relationship('Departement', back_populates='villes')
    localisation = relationship('Localisation')


class Embauche(Base):
    __tablename__ = 'Embauche'
    embauche_ID = Column(Integer, primary_key=True, autoincrement=True)
    date_action = Column(Date)
    time_action = Column(String(8))
    type = Column(String(50))
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'))
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'))

class Congedier(Base):
    __tablename__ = 'Congedier'
    congedie_ID = Column(Integer, primary_key=True, autoincrement=True)
    date_action = Column(Date)
    time_action = Column(String(8))
    type = Column(String(50))
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'))
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'))

class FicheDePoste(Base):
    __tablename__ = 'Fiche_de_poste'
    id_fiche = Column(Integer, primary_key=True, autoincrement=True)
    objectifs = Column(JSON, nullable=False)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    cree_par = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)

class PeriodeEvaluation(Base):
    __tablename__ = 'Periode_evaluation'
    id_periode = Column(Integer, primary_key=True, autoincrement=True)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)
    cree_par = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)

class Evaluation(Base):
    __tablename__ = 'Evaluation'
    id_eval = Column(Integer, primary_key=True, autoincrement=True)
    id_fiche = Column(Integer, ForeignKey('Fiche_de_poste.id_fiche'), nullable=False)
    id_periode = Column(Integer, ForeignKey('Periode_evaluation.id_periode'), nullable=False)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    auto_evaluation = Column(JSON)
    evaluations = Column(JSON)
    note_finale = Column(DECIMAL(5,2))
    statut = Column(Enum(StatutEvaluationEnum), default=StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_finalisation = Column(DateTime)

# Alias used by evaluations_router
EvaluationEmploye = Evaluation

# operations and related tables
class Operation(Base):
    __tablename__ = 'OPERATIONS'
    id_operation = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'))
    titre = Column(String(200), nullable=True)
    commentaire = Column(Text)
    # Champs ajoutés par migration 010
    type_demande = Column(String(50))  # Congé, Permission, Mission
    statut = Column(String(20), default='en attente')  # en attente, validé, rejeté, annulé
    date_debut = Column(Date)  # Date début logique
    date_fin = Column(Date)  # Date fin logique
    duree_jours = Column(Integer)  # Durée en jours ouvrables
    motif = Column(Text)  # Motif/raison
    date_demande = Column(DateTime, default=datetime.utcnow)  # Date de création
    # Champs existants
    date_depart = Column(Date)  # Date départ (missions)
    date_retour = Column(Date)  # Date retour (missions)
    duree = Column(Integer)  # Durée brute
    remplacant = Column(Integer, ForeignKey('EMPLOYE.matricule'))
    cree_par = Column(Integer, ForeignKey('EMPLOYE.matricule'))
    est_modifie = Column(Boolean, default=False)
    solde_deduit = Column(Boolean, default=False)
    date_modification = Column(DateTime)
    retour_anticipe = Column(Boolean, default=False)
    date_retour_anticipe = Column(Date)
    alerte_non_cloture = Column(Boolean, default=False)
    date_alerte_envoyee = Column(DateTime)

class CongesLink(Base):
    __tablename__ = 'Conges'
    id_conges = Column(Integer, ForeignKey('OPERATIONS.id_operation', name='fk_conges_operations'), primary_key=True)

class Permission(Base):
    __tablename__ = 'Permission'
    id_permission = Column(Integer, ForeignKey('OPERATIONS.id_operation', name='fk_permission_operations'), primary_key=True)

class PermNonConventionelle(Base):
    __tablename__ = 'Perm_non_conventionelle'
    id_perm_nc = Column(Integer, ForeignKey('Permission.id_permission', name='fk_perm_nc_permission'), primary_key=True)

class PermConventionelle(Base):
    __tablename__ = 'Perm_conventionelle'
    id_perm_c = Column(Integer, ForeignKey('Permission.id_permission', name='fk_perm_c_permission'), primary_key=True)
    preuve = Column(String(300))
    preuves_televersees = Column(Boolean, default=False)
    date_telechargement_preuves = Column(DateTime)
    date_limite_preuves = Column(Date)
    preuves = relationship('PreuvePermission', back_populates='perm_conv', cascade='all, delete-orphan')


class PreuvePermission(Base):
    __tablename__ = 'PREUVE_PERMISSION'
    id_preuve = Column(Integer, primary_key=True, autoincrement=True)
    id_perm_c = Column(Integer, ForeignKey('Perm_conventionelle.id_perm_c', name='fk_preuve_perm_c', ondelete='CASCADE'), nullable=False)
    chemin_fichier = Column(String(500), nullable=False)
    nom_fichier = Column(String(255), nullable=False)
    date_upload = Column(DateTime, nullable=False, default=datetime.utcnow)
    perm_conv = relationship('PermConventionelle', back_populates='preuves')

class PermMaternelle(Base):
    __tablename__ = 'Perm_maternelle'
    id_perm_mat = Column(Integer, ForeignKey('Perm_conventionelle.id_perm_c', name='fk_perm_mat_perm_c'), primary_key=True)

class PermDeces(Base):
    __tablename__ = 'Perm_deces'
    id_perm_dec = Column(Integer, ForeignKey('Perm_conventionelle.id_perm_c', name='fk_perm_dec_perm_c'), primary_key=True)

class PermMaladie(Base):
    __tablename__ = 'Perm_maladie'
    id_perm_mal = Column(Integer, ForeignKey('Perm_conventionelle.id_perm_c', name='fk_perm_mal_perm_c'), primary_key=True)

class PermBapteme(Base):
    __tablename__ = 'Perm_bapteme'
    id_perm_bap = Column(Integer, ForeignKey('Perm_conventionelle.id_perm_c', name='fk_perm_bap_perm_c'), primary_key=True)

class PermMariage(Base):
    __tablename__ = 'Perm_mariage'
    id_perm_mar = Column(Integer, ForeignKey('Perm_conventionelle.id_perm_c', name='fk_perm_mar_perm_c'), primary_key=True)

class Mission(Base):
    __tablename__ = 'Mission'
    id_mission = Column(Integer, ForeignKey('OPERATIONS.id_operation', name='fk_mission_operations'), primary_key=True)
    pays = Column(String(100))
    ville = Column(String(100))
    email_mission = Column(String(150))
    moyens_transport = Column(JSON)
    heure_depart = Column(Time)
    heure_retour = Column(Time)
    rapport = Column(Text)
    rapport_televerse = Column(Boolean, default=False)
    date_telechargement_rapport = Column(DateTime)
    date_limite_rapport = Column(Date)
    mission_comment = Column(String(512), nullable=True)
    # Champs pour la gestion du paiement des frais (validation à 2 niveaux)
    frais_valides_missionnaire = Column(Boolean, default=False)
    frais_valides_rh = Column(Boolean, default=False)
    frais_payes = Column(Boolean, default=False)
    date_validation_frais_missionnaire = Column(DateTime)
    date_validation_frais_rh = Column(DateTime)
    date_paiement_frais = Column(DateTime)

class MissionSegment(Base):
    __tablename__ = 'MissionSegment'
    id_segment = Column(Integer, primary_key=True, autoincrement=True)
    id_mission = Column(Integer, ForeignKey('Mission.id_mission', name='fk_segment_mission'))
    pays = Column(String(100))
    ville = Column(String(100))
    date_debut = Column(Date)
    date_fin = Column(Date)
    heure_depart = Column(Time)
    heure_arrivee = Column(Time)
    heure_retour = Column(Time)
    frais_hotel_unitaire = Column(DECIMAL(12,2))
    frais_hotel_total = Column(DECIMAL(12,2))
    nombre_nuits = Column(Integer)
    ordre = Column(Integer)  # Pour maintenir l'ordre chronologique des segments
    moyen_transport = Column(String(50))  # Transport pour ce segment spécifique

class MissionnairesMission(Base):
    __tablename__ = 'MissionnairesMission'
    id_missionnaire_mission = Column(Integer, primary_key=True, autoincrement=True)
    id_mission = Column(Integer, ForeignKey('Mission.id_mission', name='fk_missionnaires_mission'))
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule', name='fk_missionnaires_employe'))
    role_mission = Column(String(50))  # 'responsable', 'participant', etc.
    date_ajout = Column(DateTime, default=datetime.utcnow)

class RelanceMission(Base):
    __tablename__ = 'RelanceMission'
    id_relance = Column(Integer, primary_key=True, autoincrement=True)
    id_mission = Column(Integer, ForeignKey('Mission.id_mission', name='fk_relance_mission'))
    type_relance = Column(Enum('48h', '72h', '96h', 'escalade_rh_ig', name='type_relance_enum'))
    date_envoi = Column(DateTime, default=datetime.utcnow)
    destinataires = Column(Text)  # JSON string des matricules destinataires
    statut = Column(Enum('envoyee', 'rapport_recu', name='statut_relance_enum'), default='envoyee')

class CommentaireMission(Base):
    __tablename__ = 'CommentaireMission'
    id_commentaire = Column(Integer, primary_key=True, autoincrement=True)
    id_mission = Column(Integer, ForeignKey('Mission.id_mission', name='fk_commentaire_mission'))
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule', name='fk_commentaire_employe'))
    commentaire = Column(Text)
    date_creation = Column(DateTime, default=datetime.utcnow)
    lu_par = Column(JSON)  # Array des matricules qui ont lu le commentaire

class Frais(Base):
    __tablename__ = 'Frais'
    id_frais = Column(Integer, primary_key=True)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation', name='fk_frais_operations'))
    id_mission = Column(Integer, ForeignKey('Mission.id_mission', name='fk_frais_mission'))
    frais_transport_voyage = Column(DECIMAL(12,2))
    frais_hotel = Column(DECIMAL(12,2))
    frais_deplacement = Column(DECIMAL(12,2))
    justificatif_de_frais = Column(String(300))
    preuves_paiement = Column(JSON)
    frais_nutrition = Column(DECIMAL(12,2))
    total_frais = Column(DECIMAL(12,2))

class FraisMissionnaire(Base):
    __tablename__ = 'FraisMissionnaire'
    id = Column(Integer, primary_key=True, autoincrement=True)
    id_mission = Column(Integer, ForeignKey('Mission.id_mission', name='fk_frais_miss_mission', ondelete='CASCADE'), nullable=False)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule', name='fk_frais_miss_employe', ondelete='CASCADE'), nullable=False)
    frais_transport = Column(DECIMAL(12,2), default=0)
    frais_hotel = Column(DECIMAL(12,2), default=0)
    frais_deplacement = Column(DECIMAL(12,2), default=0)
    frais_nutrition = Column(DECIMAL(12,2), default=0)
    total_frais = Column(DECIMAL(12,2), default=0)
    justificatif = Column(Text, nullable=True)
    statut = Column(String(20), default='soumis')
    date_soumission = Column(DateTime, default=datetime.utcnow)


class Activation(Base):
    __tablename__ = 'Activation'
    id_activation = Column(Integer, primary_key=True, autoincrement=True)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    type_action = Column(Enum(TypeActionEnum))
    demandeur_fait = Column(Boolean, default=False)
    date_demandeur = Column(DateTime)
    rh_fait = Column(Boolean, default=False)
    date_rh = Column(DateTime)
    statut_final = Column(Enum(StatutFinalEnum), default=StatutFinalEnum.EN_ATTENTE)
    timestamp_action = Column(DateTime, default=datetime.utcnow)

class Validation(Base):
    __tablename__ = 'Validation'
    id_validation = Column(Integer, primary_key=True, autoincrement=True)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    matricule_validateur = Column(Integer, ForeignKey('EMPLOYE.matricule'))
    role_validateur = Column(String(50))  # RESPONSABLE, DIRECTEUR, DFC, RH, DG, PCA, AG
    statut_validation = Column(String(20))
    commentaire = Column(Text)
    timestamp_action = Column(DateTime, default=datetime.utcnow)

class Creation(Base):
    __tablename__ = 'Creation'
    id_creation = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'))
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    timestamp_action = Column(DateTime, default=datetime.utcnow)
    type = Column(String(50))

# Nouveaux modèles
class RemplacantPropose(Base):
    __tablename__ = 'Remplacant_propose'
    id_remplacant_propose = Column(Integer, primary_key=True, autoincrement=True)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'), nullable=False)
    matricule_remplacant = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    ordre_proposition = Column(Integer)
    est_accepte = Column(Boolean, default=False)
    demande_envoyee = Column(Boolean, default=False)
    commentaire = Column(Text, nullable=True)


class ParcoursEmploye(Base):
    __tablename__ = 'PARCOURS_EMPLOYE'
    id_parcours = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    type_action = Column(Enum(TypeParcoursEnum), nullable=False)
    champ_modifie = Column(String(64), nullable=True)
    ancienne_valeur = Column(String(255), nullable=True)
    nouvelle_valeur = Column(String(255), nullable=True)
    libelle = Column(Text, nullable=True)
    actor = Column(String(64), nullable=True)
    date_action = Column(Date, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = 'Notification'
    id_notification = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    type_notification = Column(Enum(TypeNotificationEnum))
    titre = Column(String(200))
    message = Column(Text, nullable=False)
    lue = Column(Boolean, default=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_lecture = Column(DateTime)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))


class PushSubscription(Base):
    __tablename__ = 'PUSH_SUBSCRIPTION'
    id_push_subscription = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    endpoint = Column(String(700), unique=True, nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    user_agent = Column(String(500), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class DemandeExplication(Base):
    __tablename__ = 'Demande_explication'
    id_demande_explication = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    motif = Column(Text)
    explication_fournie = Column(Text)
    date_demande = Column(DateTime, default=datetime.utcnow)
    date_reponse = Column(DateTime)
    statut = Column(Enum(StatutExplicationEnum), default=StatutExplicationEnum.EN_ATTENTE)

class AlerteCongesAnnuelle(Base):
    __tablename__ = 'Alerte_conges_annuelle'
    id_alerte = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    annee = Column(Integer, nullable=False)
    solde_restant = Column(DECIMAL(5,2))
    date_alerte = Column(DateTime, default=datetime.utcnow)
    alertes_envoyees = Column(Integer, default=0)

class SessionUtilisation(Base):
    __tablename__ = 'SESSION_UTILISATION'
    id_session = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    date_connexion = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_deconnexion = Column(DateTime, nullable=True)
    duree_minutes = Column(Integer, nullable=True)  # Duration in minutes
    ip_adresse = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)


class Sortie(Base):
    __tablename__ = 'SORTIE'
    id_sortie = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'), nullable=True)
    date_sortie = Column(Date, nullable=False)
    heure_sortie = Column(Time, nullable=False)
    commentaire = Column(Text, nullable=True)
    statut = Column(String(20), default='en attente')
    date_creation = Column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = 'TASK'
    id_task = Column(Integer, primary_key=True, autoincrement=True)
    titre = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priorite = Column(String(20), nullable=False, default='moyenne')
    statut = Column(String(20), nullable=False, default='a_faire')
    date_echeance = Column(Date, nullable=True)
    assigne_a = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    cree_par = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TeamSpacePost(Base):
    __tablename__ = 'TEAM_SPACE_POST'
    id_post = Column(Integer, primary_key=True, autoincrement=True)
    post_type = Column(String(20), nullable=False)
    author_matricule = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    author_name = Column(String(150), nullable=False)
    destinataire = Column(String(150), nullable=True)
    message = Column(Text, nullable=True)
    valeur = Column(String(100), nullable=True)
    raison = Column(Text, nullable=True)
    question = Column(Text, nullable=True)
    poll_options = Column(JSON, nullable=True)
    voted_by = Column(JSON, nullable=True)
    likes = Column(Integer, default=0, nullable=False)
    audience_type = Column(String(30), default='all', nullable=False)
    audience_selected = Column(JSON, nullable=True)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)


class ModuleStoreItem(Base):
    __tablename__ = 'MODULE_STORE_ITEM'
    id_item = Column(Integer, primary_key=True, autoincrement=True)
    module_name = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    created_by = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ── Événements ────────────────────────────────────────────────────────────────
class Evenement(Base):
    __tablename__ = 'evenements'
    id = Column(Integer, primary_key=True, autoincrement=True)
    titre = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    lieu = Column(String(200), nullable=True)
    date_debut = Column(String(50), nullable=False)
    date_fin = Column(String(50), nullable=True)
    organisateur = Column(String(200), nullable=True)
    capacite = Column(Integer, nullable=True)
    statut = Column(String(50), default='brouillon')
    created_by = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Performance 360 ───────────────────────────────────────────────────────────
class Review360(Base):
    __tablename__ = 'reviews_360'
    id = Column(Integer, primary_key=True, autoincrement=True)
    reviewer_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    reviewee_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    scores = Column(JSON, nullable=False, default=list)
    commentaire = Column(Text, nullable=True)
    points_forts = Column(Text, nullable=True)
    points_amelioration = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Talent Management ─────────────────────────────────────────────────────────
class TalentMeeting(Base):
    __tablename__ = 'talent_meetings'
    id = Column(Integer, primary_key=True, autoincrement=True)
    titre = Column(String(200), nullable=False)
    manager_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    employee_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    date = Column(String(20), nullable=True)
    agenda = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    actions = Column(Text, nullable=True)
    statut = Column(String(50), default='planifie')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TalentGoal(Base):
    __tablename__ = 'talent_goals'
    id = Column(Integer, primary_key=True, autoincrement=True)
    titre = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(100), nullable=True)
    echeance = Column(String(20), nullable=True)
    statut = Column(String(50), default='a_faire')
    employee_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Workforce Planning ────────────────────────────────────────────────────────
class WorkforcePosition(Base):
    __tablename__ = 'workforce_positions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    titre = Column(String(200), nullable=False)
    direction = Column(String(200), nullable=True)
    entite = Column(String(100), nullable=True)
    trimestre = Column(String(10), default='T1')
    annee = Column(String(10), nullable=True)
    budget = Column(DECIMAL(15, 2), nullable=True)
    priorite = Column(String(50), default='moyenne')
    statut = Column(String(50), default='planifie')
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Clubs ─────────────────────────────────────────────────────────────────────
class Club(Base):
    __tablename__ = 'clubs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(100), default='Sports')
    emoji = Column(String(10), nullable=True)
    created_by = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClubMembership(Base):
    __tablename__ = 'club_memberships'
    id = Column(Integer, primary_key=True, autoincrement=True)
    club_id = Column(Integer, ForeignKey('clubs.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)


class ClubActivity(Base):
    __tablename__ = 'club_activities'
    id = Column(Integer, primary_key=True, autoincrement=True)
    club_id = Column(Integer, ForeignKey('clubs.id'), nullable=False)
    titre = Column(String(200), nullable=False)
    date = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClubReviewItem(Base):
    __tablename__ = 'club_review_items'
    id = Column(Integer, primary_key=True, autoincrement=True)
    club_id = Column(Integer, ForeignKey('clubs.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('EMPLOYE.matricule'), nullable=False)
    rating = Column(Integer, nullable=False)
    commentaire = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Tâches multi-assignees ────────────────────────────────────────────────────
class TaskAssignee(Base):
    __tablename__ = 'TASK_ASSIGNEE'
    id = Column(Integer, primary_key=True, autoincrement=True)
    id_task = Column(Integer, ForeignKey('TASK.id_task', ondelete='CASCADE'), nullable=False)
    matricule_employe = Column(Integer, ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    __table_args__ = (
        UniqueConstraint('id_task', 'matricule_employe', name='uq_task_employe'),
    )


# ── Paramètres utilisateurs (persistence DB) ──────────────────────────────────
class UserSettings(Base):
    __tablename__ = 'USER_SETTINGS'
    matricule = Column(Integer, ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), primary_key=True)
    settings = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)