from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum, Boolean, Text, JSON, DECIMAL, Time, UniqueConstraint, func
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
    RELANCE_VALIDATION = 'RELANCE_VALIDATION'
    RETARD_POINTAGE = 'RETARD_POINTAGE'
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


class TypeContratEnum(str, enum.Enum):
    CDI = 'CDI'
    CDD = 'CDD'
    STAGIAIRE = 'Stagiaire'


class TypeAlerteContratEnum(str, enum.Enum):
    J7 = 'J7'
    J2 = 'J2'


class StatutAlerteContratEnum(str, enum.Enum):
    ACTIVE = 'active'
    TRAITEE = 'traitee'


class ActionAlerteContratEnum(str, enum.Enum):
    RENOUVELLEMENT = 'renouvellement'
    ARRET = 'arret'
    CONFIRMATION_CDI = 'confirmation_cdi'


class TypeLettreRHEnum(str, enum.Enum):
    RENOUVELLEMENT = 'renouvellement'
    ARRET = 'arret'
    CONFIRMATION_CDI = 'confirmation_cdi'
    INFO_CONTRAT = 'info_contrat'


# Academy enums
class NiveauFormationEnum(str, enum.Enum):
    DEBUTANT = 'Débutant'
    INTERMEDIAIRE = 'Intermédiaire'
    AVANCE = 'Avancé'


class TypeLeconEnum(str, enum.Enum):
    VIDEO = 'video'
    PDF = 'pdf'
    TEXTE = 'texte'
    QUIZ = 'quiz'
    PRESENTATION = 'presentation'


class StatutInscriptionEnum(str, enum.Enum):
    EN_COURS = 'en_cours'
    TERMINE = 'termine'
    ABANDONNE = 'abandonne'


class TypeBadgeEnum(str, enum.Enum):
    PREMIER_COURS = 'premier_cours'
    SERIE_5 = 'serie_5'
    PERFECTIONNISTE = 'perfectionniste'
    TOP_APPRENANT = 'top_apprenant'
    ASSIDU = 'assidu'


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
    matricule = Column(String(32), primary_key=True)
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
    nouvelle_recrue = Column(Boolean, default=False, nullable=True)
    # absence / backup fields (garder pour compatibilité)
    absent = Column(Boolean, default=False)
    absence_until = Column(Date, nullable=True)
    backup_matricule = Column(String(32), nullable=True)
    n1 = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    n1_fonction = Column(String(255), nullable=True)
    photo_url = Column(String(500), nullable=True)
    signature_url = Column(String(500), nullable=True)
    contact_urgence = Column(String(30), nullable=True)
    statut_matrimonial = Column(Enum(StatutMatrimonialEnum), nullable=True)
    nombre_enfants = Column(Integer, nullable=True, default=0)
    # Salaire confidentiel (D backlog) — visible RH uniquement, ou propre matricule.
    salaire_brut = Column(DECIMAL(12, 2), nullable=True)
    salaire_devise = Column(String(3), nullable=True, default='XAF')
    # Préférence d'envoi email pour les notifications hors-app (opt-out par employé)
    notif_email_enabled = Column(Boolean, nullable=False, default=True)
    # Assignation manuelle d'une fiche de poste (FK vers Fiche_poste_template)
    id_fiche_poste = Column(Integer, ForeignKey('Fiche_poste_template.id_template', ondelete='SET NULL'), nullable=True)
    # Présence en ligne — mis à jour par heartbeat frontend toutes les 30s
    derniere_connexion = Column(DateTime, nullable=True)
    # Contrat
    type_contrat = Column(Enum(TypeContratEnum), nullable=False, default=TypeContratEnum.CDI)
    date_debut_contrat = Column(Date, nullable=True)
    date_fin_contrat = Column(Date, nullable=True)
    utilisateur = relationship('Utilisateur', back_populates='employe', uselist=False)
    fiche_poste = relationship('FichePosteTemplate', back_populates='titulaires', foreign_keys=[id_fiche_poste])
    alertes_contrat = relationship('AlerteContrat', back_populates='employe', cascade='all, delete-orphan')
    lettres_rh = relationship('LettreRH', back_populates='employe', cascade='all, delete-orphan')


class Utilisateur(Base):
    __tablename__ = 'UTILISATEUR'
    id_user = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), unique=True, nullable=True)
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
    id_directeur = Column(String(32), ForeignKey('EMPLOYE.matricule'))

class Departement(Base):
    __tablename__ = 'DEPARTEMENT'
    dept_id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(150))
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'), nullable=False)
    id_direction = Column(Integer, ForeignKey('DIRECTION.id_direction'))
    id_responsable = Column(String(32), ForeignKey('EMPLOYE.matricule'))
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
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'))

class Congedier(Base):
    __tablename__ = 'Congedier'
    congedie_ID = Column(Integer, primary_key=True, autoincrement=True)
    date_action = Column(Date)
    time_action = Column(String(8))
    type = Column(String(50))
    id_entite = Column(Integer, ForeignKey('ENTITE.id_entite'))
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'))

class FicheDePoste(Base):
    __tablename__ = 'Fiche_de_poste'
    id_fiche = Column(Integer, primary_key=True, autoincrement=True)
    objectifs = Column(JSON, nullable=False)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    cree_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)

class PeriodeEvaluation(Base):
    __tablename__ = 'Periode_evaluation'
    id_periode = Column(Integer, primary_key=True, autoincrement=True)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)
    cree_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)

class Evaluation(Base):
    __tablename__ = 'Evaluation'
    id_eval = Column(Integer, primary_key=True, autoincrement=True)
    id_fiche = Column(Integer, ForeignKey('Fiche_de_poste.id_fiche'), nullable=True)
    id_template = Column(Integer, ForeignKey('Fiche_poste_template.id_template', ondelete='SET NULL'), nullable=True)
    id_periode = Column(Integer, ForeignKey('Periode_evaluation.id_periode'), nullable=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    evaluateur_matricule = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='SET NULL'), nullable=True)
    evaluateur_role = Column(String(50), nullable=True)
    auto_evaluation = Column(JSON)
    evaluations = Column(JSON)
    evaluation_n1 = Column(JSON)
    notes_par_section = Column(JSON)
    note_finale = Column(DECIMAL(5,2))
    statut = Column(Enum(StatutEvaluationEnum), default=StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_soumission_auto = Column(DateTime, nullable=True)
    date_evaluation_n1 = Column(DateTime, nullable=True)
    date_finalisation = Column(DateTime)

# Alias used by evaluations_router
EvaluationEmploye = Evaluation


class FichePosteTemplate(Base):
    """
    Fiche de poste modèle par fonction, alimentée par import .docx.
    sections : [{titre: str, contenu: [str]}] — structure extraite du document.
    """
    __tablename__ = 'Fiche_poste_template'
    id_template       = Column(Integer, primary_key=True, autoincrement=True)
    fonction          = Column(String(200), unique=True, nullable=False)
    fichier_nom       = Column(String(300))          # nom original du .docx
    sections          = Column(JSON)                 # [{titre, contenu:[str]}]
    html_content      = Column(Text)                 # rendu HTML fidèle (mammoth) sans signatures
    cree_par          = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='SET NULL'), nullable=True)
    date_creation     = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime)
    titulaires = relationship('Employe', back_populates='fiche_poste', foreign_keys='Employe.id_fiche_poste')


# operations and related tables
class Operation(Base):
    __tablename__ = 'OPERATIONS'
    id_operation = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'))
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
    remplacant = Column(String(32), ForeignKey('EMPLOYE.matricule'))
    cree_par = Column(String(32), ForeignKey('EMPLOYE.matricule'))
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
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule', name='fk_missionnaires_employe'))
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
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule', name='fk_commentaire_employe'))
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
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule', name='fk_frais_miss_employe', ondelete='CASCADE'), nullable=False)
    # Lien optionnel vers un segment précis de la mission (multi-destinations).
    # NULL = frais globaux non attribués. ON DELETE SET NULL : la suppression
    # d'un segment ne purge pas ses frais, ils retombent en « non assignés ».
    id_segment = Column(Integer, ForeignKey('MissionSegment.id_segment', name='fk_frais_miss_segment', ondelete='SET NULL'), nullable=True)
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
    matricule_validateur = Column(String(32), ForeignKey('EMPLOYE.matricule'))
    role_validateur = Column(String(50))  # RESPONSABLE, DIRECTEUR, DFC, RH, DG, PCA, AG
    statut_validation = Column(String(20))
    commentaire = Column(Text)
    signature_url = Column(String(500), nullable=True)
    timestamp_action = Column(DateTime, default=datetime.utcnow)

class Creation(Base):
    __tablename__ = 'Creation'
    id_creation = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'))
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    timestamp_action = Column(DateTime, default=datetime.utcnow)
    type = Column(String(50))

# Nouveaux modèles
class RemplacantPropose(Base):
    __tablename__ = 'Remplacant_propose'
    id_remplacant_propose = Column(Integer, primary_key=True, autoincrement=True)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'), nullable=False)
    matricule_remplacant = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    ordre_proposition = Column(Integer)
    est_accepte = Column(Boolean, default=False)
    demande_envoyee = Column(Boolean, default=False)
    commentaire = Column(Text, nullable=True)


class ParcoursEmploye(Base):
    __tablename__ = 'PARCOURS_EMPLOYE'
    id_parcours = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
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
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    type_notification = Column(Enum(TypeNotificationEnum))
    titre = Column(String(200))
    message = Column(Text, nullable=False)
    lue = Column(Boolean, default=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_lecture = Column(DateTime)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    # Horodatage du dernier rappel hors-app (email/push) pour cette notification ;
    # utilisé par le job de relance toutes les 15 min en heures ouvrées.
    dernier_rappel_at = Column(DateTime, nullable=True)


class PushSubscription(Base):
    __tablename__ = 'PUSH_SUBSCRIPTION'
    id_push_subscription = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    endpoint = Column(String(700), unique=True, nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    user_agent = Column(String(500), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Pointage(Base):
    """Stub d'intégration biométrie : enregistre les pointages reçus via webhook.

    Les retards sont calculés au moment de l'insertion (utils/retards.py) et stockés
    dans `retard_minutes`. Le câblage à un device réel (ZKTeco/Suprema/...) reste
    à faire ; cette table sert de point d'entrée stable.
    """
    __tablename__ = 'POINTAGE'
    id_pointage = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    date_pointage = Column(Date, nullable=False)
    heure_arrivee = Column(Time, nullable=True)
    heure_depart = Column(Time, nullable=True)
    device_id = Column(String(64), nullable=True)
    source = Column(String(32), nullable=False, default='biometrie')
    retard_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (
        UniqueConstraint('matricule', 'date_pointage', 'device_id', name='uq_pointage_unique'),
    )

class OperationVue(Base):
    """Trace de la PREMIÈRE consultation d'une opération par un utilisateur.

    Voir migration 058 — l'unicité (id_operation, matricule_observateur) est
    garantie en base ; les ré-ouvertures sont silencieusement ignorées.
    """
    __tablename__ = 'OPERATION_VUE'
    id_vue = Column(Integer, primary_key=True, autoincrement=True)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation', ondelete='CASCADE'), nullable=False, index=True)
    matricule_observateur = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    nom_observateur = Column(String(255), nullable=True)
    role_observateur = Column(String(32), nullable=True)
    date_vue = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (
        UniqueConstraint('id_operation', 'matricule_observateur', name='uq_opvue_unique'),
    )

class DemandeExplication(Base):
    __tablename__ = 'demande_explication_v1'
    id_demande_explication = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    id_operation = Column(Integer, ForeignKey('OPERATIONS.id_operation'))
    motif = Column(Text)
    explication_fournie = Column(Text)
    date_demande = Column(DateTime, default=datetime.utcnow)
    date_reponse = Column(DateTime)
    statut = Column(Enum(StatutExplicationEnum), default=StatutExplicationEnum.EN_ATTENTE)

class AlerteCongesAnnuelle(Base):
    __tablename__ = 'Alerte_conges_annuelle'
    id_alerte = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    annee = Column(Integer, nullable=False)
    solde_restant = Column(DECIMAL(5,2))
    date_alerte = Column(DateTime, default=datetime.utcnow)
    alertes_envoyees = Column(Integer, default=0)

class SessionUtilisation(Base):
    __tablename__ = 'SESSION_UTILISATION'
    id_session = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    date_connexion = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_deconnexion = Column(DateTime, nullable=True)
    duree_minutes = Column(Integer, nullable=True)  # Duration in minutes
    ip_adresse = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)


class Sortie(Base):
    __tablename__ = 'SORTIE'
    id_sortie = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
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
    assigne_a = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    cree_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TeamSpacePost(Base):
    __tablename__ = 'TEAM_SPACE_POST'
    id_post = Column(Integer, primary_key=True, autoincrement=True)
    post_type = Column(String(20), nullable=False)
    author_matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
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


class TeamSpacePostLike(Base):
    """1 like par personne par post — unicité enforced en DB."""
    __tablename__ = 'team_space_post_like'
    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey('TEAM_SPACE_POST.id_post', ondelete='CASCADE'), nullable=False)
    matricule = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (
        UniqueConstraint('post_id', 'matricule', name='uq_like_post_user'),
    )


class TeamSpaceComment(Base):
    """Commentaires (et réponses imbriquées) sur les posts Espace Équipe."""
    __tablename__ = 'team_space_comment'
    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey('TEAM_SPACE_POST.id_post', ondelete='CASCADE'), nullable=False)
    parent_id = Column(Integer, ForeignKey('team_space_comment.id', ondelete='CASCADE'), nullable=True)
    auteur_matricule = Column(String(32), nullable=True)
    auteur_nom = Column(String(150), nullable=False)
    contenu = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ModuleStoreItem(Base):
    __tablename__ = 'MODULE_STORE_ITEM'
    id_item = Column(Integer, primary_key=True, autoincrement=True)
    module_name = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    created_by = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
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
    created_by = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Performance 360 ───────────────────────────────────────────────────────────
class Review360(Base):
    __tablename__ = 'reviews_360'
    id = Column(Integer, primary_key=True, autoincrement=True)
    reviewer_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    reviewee_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
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
    manager_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    employee_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
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
    employee_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
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
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow)


# ── Gestion des contrats ─────────────────────────────────────────────────────

class AlerteContrat(Base):
    __tablename__ = 'alertes_contrat'
    id           = Column(Integer, primary_key=True, autoincrement=True)
    employe_id   = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    type_alerte  = Column(Enum(TypeAlerteContratEnum), nullable=False)
    statut       = Column(Enum(StatutAlerteContratEnum), nullable=False, default=StatutAlerteContratEnum.ACTIVE)
    action       = Column(Enum(ActionAlerteContratEnum), nullable=True)
    date_generee = Column(DateTime, nullable=False, default=datetime.utcnow)
    date_traitee = Column(DateTime, nullable=True)
    traite_par   = Column(String(32), nullable=True)
    employe      = relationship('Employe', back_populates='alertes_contrat')
    lettres      = relationship('LettreRH', back_populates='alerte')


class LettreRH(Base):
    __tablename__ = 'lettres_rh'
    id                = Column(Integer, primary_key=True, autoincrement=True)
    employe_id        = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    alerte_id         = Column(Integer, ForeignKey('alertes_contrat.id', ondelete='SET NULL'), nullable=True)
    type_lettre       = Column(Enum(TypeLettreRHEnum), nullable=False)
    pdf_path          = Column(String(500), nullable=True)
    signature_data    = Column(Text, nullable=True)
    date_generation   = Column(DateTime, nullable=False, default=datetime.utcnow)
    genere_par        = Column(String(32), nullable=False)
    date_fin_nouvelle = Column(Date, nullable=True)
    employe           = relationship('Employe', back_populates='lettres_rh')
    alerte            = relationship('AlerteContrat', back_populates='lettres')


# ── Elite Academy LMS ─────────────────────────────────────────────────────────

class Formation(Base):
    __tablename__ = 'formations'
    id               = Column(Integer, primary_key=True, autoincrement=True)
    titre            = Column(String(200), nullable=False)
    description      = Column(Text, nullable=True)
    categorie        = Column(String(100), nullable=True)
    niveau           = Column(
        Enum(NiveauFormationEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=NiveauFormationEnum.DEBUTANT,
    )
    image_url        = Column(String(500), nullable=True)
    duree_estimee_h  = Column(DECIMAL(5, 1), nullable=True, default=0)
    est_onboarding   = Column(Boolean, nullable=False, default=False)
    est_publie       = Column(Boolean, nullable=False, default=False)
    cree_par         = Column(String(32), nullable=False)
    created_at       = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at       = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    modules          = relationship('ModuleFormation', back_populates='formation', cascade='all, delete-orphan', order_by='ModuleFormation.ordre')
    inscriptions     = relationship('InscriptionFormation', back_populates='formation', cascade='all, delete-orphan')
    certificats      = relationship('CertificatFormation', back_populates='formation', cascade='all, delete-orphan')


class ModuleFormation(Base):
    __tablename__ = 'modules_formation'
    id           = Column(Integer, primary_key=True, autoincrement=True)
    formation_id = Column(Integer, ForeignKey('formations.id', ondelete='CASCADE'), nullable=False)
    titre        = Column(String(200), nullable=False)
    description  = Column(Text, nullable=True)
    ordre        = Column(Integer, nullable=False, default=0)
    formation    = relationship('Formation', back_populates='modules')
    lecons       = relationship('Lecon', back_populates='module', cascade='all, delete-orphan', order_by='Lecon.ordre')


class Lecon(Base):
    __tablename__ = 'lecons'
    id        = Column(Integer, primary_key=True, autoincrement=True)
    module_id = Column(Integer, ForeignKey('modules_formation.id', ondelete='CASCADE'), nullable=False)
    titre     = Column(String(200), nullable=False)
    type      = Column(
        Enum(TypeLeconEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=TypeLeconEnum.TEXTE,
    )
    contenu   = Column(Text, nullable=True)
    ordre     = Column(Integer, nullable=False, default=0)
    duree_min = Column(Integer, nullable=True, default=0)
    module    = relationship('ModuleFormation', back_populates='lecons')
    questions = relationship('QuizQuestion', back_populates='lecon', cascade='all, delete-orphan', order_by='QuizQuestion.ordre')
    progressions = relationship('ProgressionLecon', back_populates='lecon', cascade='all, delete-orphan')


class QuizQuestion(Base):
    __tablename__ = 'quiz_questions'
    id           = Column(Integer, primary_key=True, autoincrement=True)
    lecon_id     = Column(Integer, ForeignKey('lecons.id', ondelete='CASCADE'), nullable=False)
    question     = Column(Text, nullable=False)
    options      = Column(JSON, nullable=False)
    bonne_reponse = Column(Integer, nullable=False, default=0)
    explication  = Column(Text, nullable=True)
    ordre        = Column(Integer, nullable=False, default=0)
    lecon        = relationship('Lecon', back_populates='questions')


class InscriptionFormation(Base):
    __tablename__ = 'inscriptions_formation'
    id               = Column(Integer, primary_key=True, autoincrement=True)
    employe_id       = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    formation_id     = Column(Integer, ForeignKey('formations.id', ondelete='CASCADE'), nullable=False)
    date_inscription = Column(DateTime, nullable=False, default=datetime.utcnow)
    statut           = Column(
        Enum(StatutInscriptionEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=StatutInscriptionEnum.EN_COURS,
    )
    score_final      = Column(DECIMAL(5, 2), nullable=True)
    date_completion  = Column(DateTime, nullable=True)
    employe          = relationship('Employe')
    formation        = relationship('Formation', back_populates='inscriptions')
    progressions     = relationship('ProgressionLecon', back_populates='inscription', cascade='all, delete-orphan')
    __table_args__ = (UniqueConstraint('employe_id', 'formation_id', name='uq_inscription'),)


class ProgressionLecon(Base):
    __tablename__ = 'progression_lecons'
    id               = Column(Integer, primary_key=True, autoincrement=True)
    inscription_id   = Column(Integer, ForeignKey('inscriptions_formation.id', ondelete='CASCADE'), nullable=False)
    lecon_id         = Column(Integer, ForeignKey('lecons.id', ondelete='CASCADE'), nullable=False)
    termine          = Column(Boolean, nullable=False, default=False)
    score            = Column(DECIMAL(5, 2), nullable=True)
    date_progression = Column(DateTime, nullable=False, default=datetime.utcnow)
    inscription      = relationship('InscriptionFormation', back_populates='progressions')
    lecon            = relationship('Lecon', back_populates='progressions')
    __table_args__ = (UniqueConstraint('inscription_id', 'lecon_id', name='uq_progression'),)


class Badge(Base):
    __tablename__ = 'badges'
    id          = Column(Integer, primary_key=True, autoincrement=True)
    employe_id  = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    type        = Column(
        Enum(TypeBadgeEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    date_obtenu = Column(DateTime, nullable=False, default=datetime.utcnow)
    employe     = relationship('Employe')
    __table_args__ = (UniqueConstraint('employe_id', 'type', name='uq_badge'),)


class CertificatFormation(Base):
    __tablename__ = 'certificats_formation'
    id           = Column(Integer, primary_key=True, autoincrement=True)
    employe_id   = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    formation_id = Column(Integer, ForeignKey('formations.id', ondelete='CASCADE'), nullable=False)
    date_emission = Column(DateTime, nullable=False, default=datetime.utcnow)
    pdf_path     = Column(String(500), nullable=True)
    statut = Column(String(50), default='planifie')
    notes = Column(Text, nullable=True)
    created_by = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    employe      = relationship('Employe', foreign_keys=[employe_id])
    formation    = relationship('Formation', back_populates='certificats')
    __table_args__ = (UniqueConstraint('employe_id', 'formation_id', name='uq_certificat'),)
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
    created_by = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClubMembership(Base):
    __tablename__ = 'club_memberships'
    id = Column(Integer, primary_key=True, autoincrement=True)
    club_id = Column(Integer, ForeignKey('clubs.id'), nullable=False)
    user_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)


class ClubActivity(Base):
    __tablename__ = 'club_activities'
    id = Column(Integer, primary_key=True, autoincrement=True)
    club_id = Column(Integer, ForeignKey('clubs.id'), nullable=False)
    titre = Column(String(200), nullable=False)
    date = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClubReviewItem(Base):
    __tablename__ = 'club_review_items'
    id = Column(Integer, primary_key=True, autoincrement=True)
    club_id = Column(Integer, ForeignKey('clubs.id'), nullable=False)
    user_id = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    rating = Column(Integer, nullable=False)
    commentaire = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Tâches multi-assignees ────────────────────────────────────────────────────
class TaskAssignee(Base):
    __tablename__ = 'TASK_ASSIGNEE'
    id = Column(Integer, primary_key=True, autoincrement=True)
    id_task = Column(Integer, ForeignKey('TASK.id_task', ondelete='CASCADE'), nullable=False)
    matricule_employe = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), nullable=False)
    __table_args__ = (
        UniqueConstraint('id_task', 'matricule_employe', name='uq_task_employe'),
    )


# ── Paramètres utilisateurs (persistence DB) ──────────────────────────────────
class UserSettings(Base):
    __tablename__ = 'USER_SETTINGS'
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule', ondelete='CASCADE'), primary_key=True)
    settings = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Module DE — Demande d'Explication ─────────────────────────────────────────
class DemandeExplicationV2(Base):
    """Demande d'explication formelle émise par RH/ADMIN/DIRECTEUR/DG/PCA."""
    __tablename__ = 'demande_explication'
    id_de = Column(Integer, primary_key=True, autoincrement=True)
    matricule_employe = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    cree_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    motif = Column(Text, nullable=False)
    reponse_employe = Column(Text, nullable=True)
    # statut: EN_ATTENTE | REPONDU | CLOS
    statut = Column(String(20), nullable=False, default='EN_ATTENTE')
    date_limite_reponse = Column(DateTime, nullable=False)   # cree_le + 72h
    date_reponse = Column(DateTime, nullable=True)
    cree_le = Column(DateTime, nullable=False, default=datetime.utcnow)
    clos_le = Column(DateTime, nullable=True)
    clos_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)


# ── Gestion Disciplinaire ─────────────────────────────────────────────────────
class MesureDisciplinaire(Base):
    __tablename__ = 'mesure_disciplinaire'
    id_mesure = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    # blame | avertissement | sanction | conseil_discipline
    type_mesure = Column(String(50), nullable=False)
    motif = Column(Text, nullable=False)
    gravite = Column(Integer, nullable=False, default=1)  # 1-5
    date_mesure = Column(Date, nullable=False)
    cree_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Scoring Comportemental ────────────────────────────────────────────────────
class ScoreComportemental(Base):
    __tablename__ = 'score_comportemental'
    id_score = Column(Integer, primary_key=True, autoincrement=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    # delai_validation | participation_evenements | engagement_app | esprit_equipe
    dimension = Column(String(50), nullable=False)
    valeur = Column(DECIMAL(5, 2), nullable=False, default=0)
    periode = Column(String(7), nullable=False)   # YYYY-MM
    details = Column(JSON, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint('matricule', 'dimension', 'periode', name='uq_score_dim_periode'),
    )


# ── Inscriptions Événements ───────────────────────────────────────────────────
class InscriptionEvenement(Base):
    __tablename__ = 'inscription_evenement'
    id_inscription = Column(Integer, primary_key=True, autoincrement=True)
    id_evenement = Column(Integer, ForeignKey('evenements.id', ondelete='CASCADE'), nullable=False, index=True)
    matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=False, index=True)
    # inscrit | present | absent
    statut = Column(String(20), nullable=False, default='inscrit')
    inscrit_le = Column(DateTime, nullable=False, default=datetime.utcnow)
    confirme_le = Column(DateTime, nullable=True)
    confirme_par = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    __table_args__ = (
        UniqueConstraint('id_evenement', 'matricule', name='uq_inscription_evenement'),
    )


# ── Documentation interne ─────────────────────────────────────────────────────
class DocumentInterne(Base):
    __tablename__ = 'document_interne'
    id_doc = Column(Integer, primary_key=True, autoincrement=True)
    titre = Column(String(300), nullable=False)
    contenu = Column(Text, nullable=True)
    categorie = Column(String(100), nullable=True, default='Général')
    auteur_matricule = Column(String(32), ForeignKey('EMPLOYE.matricule'), nullable=True)
    auteur_nom = Column(String(200), nullable=True)
    fichier_url = Column(String(500), nullable=True)
    fichier_nom = Column(String(300), nullable=True)
    type_doc = Column(String(20), nullable=False, default='article')  # article | fichier
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)