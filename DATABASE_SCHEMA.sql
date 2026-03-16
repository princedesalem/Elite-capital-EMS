-- =====================================================
-- CREATION DATABASE EMS
-- =====================================================
CREATE DATABASE IF NOT EXISTS EMS_DB;
USE EMS_DB;

-- =====================================================
-- PAYS
-- =====================================================
CREATE TABLE PAYS (
    id_pays INT AUTO_INCREMENT PRIMARY KEY,
    nom_pays VARCHAR(100) NOT NULL,
    code_pays VARCHAR(10) UNIQUE NOT NULL
);

CREATE TABLE LOCALISATION (
    id_localisation INT AUTO_INCREMENT PRIMARY KEY,
    ville VARCHAR(100) NOT NULL,
    id_pays INT NOT NULL,
    FOREIGN KEY (id_pays) REFERENCES PAYS(id_pays)
);

-- =====================================================
CREATE TABLE ENTITE (
    id_entite INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL
);

-- IMPLANTATION (Relation entre ENTITE et LOCALISATION)
-- =====================================================
CREATE TABLE IMPLANTATION (
    id_localisation INT,
    id_entite INT,
    PRIMARY KEY (id_localisation, id_entite),
    FOREIGN KEY (id_localisation) REFERENCES LOCALISATION(id_localisation),
    FOREIGN KEY (id_entite) REFERENCES ENTITE(id_entite)
);

-- =====================================================
-- DIRECTION
-- =====================================================
CREATE TABLE DIRECTION (
    id_direction INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    id_entite INT NOT NULL,
    id_directeur INT,
    FOREIGN KEY (id_entite) REFERENCES ENTITE(id_entite),
    FOREIGN KEY (id_directeur) REFERENCES EMPLOYE(matricule)
);
-- =====================================================
-- DEPARTEMENT
-- =====================================================
CREATE TABLE DEPARTEMENT (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150),
    id_entite INT NOT NULL,
    id_direction INT,
    id_responsable INT,
    FOREIGN KEY (id_entite) REFERENCES ENTITE(id_entite),
    FOREIGN KEY (id_direction) REFERENCES DIRECTION(id_direction),
    FOREIGN KEY (id_responsable) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- ROLE
-- =====================================================
CREATE TABLE ROLE (
    id_role INT AUTO_INCREMENT PRIMARY KEY,
    nom_role VARCHAR(100) NOT NULL
);

-- =====================================================
-- EMPLOYE
-- =====================================================
CREATE TABLE EMPLOYE (
    matricule INT PRIMARY KEY,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    email VARCHAR(150) UNIQUE,
    date_naissance DATE,
    sexe ENUM('M', 'F', 'Autre'),
    telephone VARCHAR(20),
    diplome VARCHAR(150),
    solde_conges DECIMAL(5,2) DEFAULT 0,
    date_embauche DATE NOT NULL,
    date_derniere_maj_solde DATE,
    fonction VARCHAR(150),
    anciennete VARCHAR(100),
    annee_experience INT GENERATED ALWAYS AS (YEAR(CURDATE()) - YEAR(date_embauche)) STORED,
    categorie VARCHAR(100),
    dept_id INT,
    id_role INT,
    id_entite INT,
    id_direction INT,
    statut_employe ENUM('ACTIF', 'CONGEDIE', 'SUSPENDU') DEFAULT 'ACTIF',
    FOREIGN KEY (dept_id) REFERENCES DEPARTEMENT(dept_id),
    FOREIGN KEY (id_role) REFERENCES ROLE(id_role),
    FOREIGN KEY (id_entite) REFERENCES ENTITE(id_entite),
    FOREIGN KEY (id_direction) REFERENCES DIRECTION(id_direction)
);

-- =====================================================
-- EMPLOYE_ROLE
-- =====================================================
CREATE TABLE EMPLOYE_ROLE (
    id_role INT,
    matricule INT,
    remplacant BIT DEFAULT 0,
    PRIMARY KEY (id_role, matricule),
    FOREIGN KEY (id_role) REFERENCES ROLE(id_role),
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- EMBAUCHE / CONGEDIER
-- =====================================================
CREATE TABLE Embauche (
    embauche_ID INT AUTO_INCREMENT PRIMARY KEY,
    date_action DATE,
    time_action TIME,
    type VARCHAR(50),
    id_entite INT,
    matricule INT,
    FOREIGN KEY (id_entite) REFERENCES ENTITE(id_entite),
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule)
);

CREATE TABLE Congedier (
    congedie_ID INT AUTO_INCREMENT PRIMARY KEY,
    date_action DATE,
    time_action TIME,
    type VARCHAR(50),
    id_entite INT,
    matricule INT,
    FOREIGN KEY (id_entite) REFERENCES ENTITE(id_entite),
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- FICHE DE POSTE / EVALUATION
-- =====================================================
CREATE TABLE Fiche_de_poste (
    id_fiche INT AUTO_INCREMENT PRIMARY KEY,
    objectifs JSON NOT NULL,
    matricule INT NOT NULL,
    cree_par INT NOT NULL,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (cree_par) REFERENCES EMPLOYE(matricule)
);

CREATE TABLE Periode_evaluation (
    id_periode INT AUTO_INCREMENT PRIMARY KEY,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    cree_par INT NOT NULL,
    FOREIGN KEY (cree_par) REFERENCES EMPLOYE(matricule)
);

CREATE TABLE Evaluation (
    id_eval INT AUTO_INCREMENT PRIMARY KEY,
    id_fiche INT NOT NULL,
    id_periode INT NOT NULL,
    matricule INT NOT NULL,
    auto_evaluation JSON,
    evaluations JSON,
    note_finale DECIMAL(5,2),
    statut ENUM('EN_ATTENTE_AUTO_EVAL', 'EN_COURS', 'TERMINE') DEFAULT 'EN_ATTENTE_AUTO_EVAL',
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_finalisation DATETIME,
    FOREIGN KEY (id_fiche) REFERENCES Fiche_de_poste(id_fiche),
    FOREIGN KEY (id_periode) REFERENCES Periode_evaluation(id_periode),
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- UTILISATEUR
-- =====================================================
CREATE TABLE UTILISATEUR (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT UNIQUE,
    mot_de_passe_hash VARCHAR(500) NOT NULL,
    mot_de_passe_temporaire BOOLEAN DEFAULT TRUE,
    dernier_login DATETIME,
    tentatives_echec INT DEFAULT 0,
    bloque_jusqua DATETIME,
    date_changement_mdp DATETIME,
    mfa_active BIT DEFAULT 0,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- AUDIT_LOG
-- =====================================================
CREATE TABLE AUDIT_LOG (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    action VARCHAR(200),
    table_cible VARCHAR(150),
    id_objet INT,
    ancienne_valeur JSON,
    nouvelle_valeur JSON,
    adresse_ip VARCHAR(50),
    timestamp_action DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES UTILISATEUR(id_user)
);

-- =====================================================
-- OPERATIONS
-- =====================================================
CREATE TABLE OPERATIONS (
    id_operation INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT,
    titre VARCHAR(200),
    commentaire TEXT,
    date_depart DATE,
    date_retour DATE,
    duree INT,
    remplacant INT,
    cree_par INT,
    est_modifie BOOLEAN DEFAULT FALSE,
    date_modification DATETIME,
    retour_anticipe BOOLEAN DEFAULT FALSE,
    date_retour_anticipe DATE,
    alerte_non_cloture BOOLEAN DEFAULT FALSE,
    date_alerte_envoyee DATETIME,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (remplacant) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (cree_par) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- HERITAGE OPERATIONS
-- =====================================================
CREATE TABLE Conges (
    id_conges INT PRIMARY KEY,
    FOREIGN KEY (id_conges) REFERENCES OPERATIONS(id_operation)
);

CREATE TABLE Permission (
    id_permission INT PRIMARY KEY,
    FOREIGN KEY (id_permission) REFERENCES OPERATIONS(id_operation)
);

CREATE TABLE Perm_non_conventionelle (
    id_perm_nc INT PRIMARY KEY,
    FOREIGN KEY (id_perm_nc) REFERENCES Permission(id_permission)
);

CREATE TABLE Perm_conventionelle (
    id_perm_c INT PRIMARY KEY,
    preuve VARCHAR(300),
    preuves_televersees BOOLEAN DEFAULT FALSE,
    date_telechargement_preuves DATETIME,
    date_limite_preuves DATE,
    FOREIGN KEY (id_perm_c) REFERENCES Permission(id_permission)
);

-- Sous types conventionnels
CREATE TABLE Perm_maternelle (
    id_perm_mat INT PRIMARY KEY,
    FOREIGN KEY (id_perm_mat) REFERENCES Perm_conventionelle(id_perm_c)
);

CREATE TABLE Perm_deces (
    id_perm_dec INT PRIMARY KEY,
    FOREIGN KEY (id_perm_dec) REFERENCES Perm_conventionelle(id_perm_c)
);

CREATE TABLE Perm_maladie (
    id_perm_mal INT PRIMARY KEY,
    FOREIGN KEY (id_perm_mal) REFERENCES Perm_conventionelle(id_perm_c)
);

CREATE TABLE Perm_bapteme (
    id_perm_bap INT PRIMARY KEY,
    FOREIGN KEY (id_perm_bap) REFERENCES Perm_conventionelle(id_perm_c)
);

CREATE TABLE Perm_mariage (
    id_perm_mar INT PRIMARY KEY,
    FOREIGN KEY (id_perm_mar) REFERENCES Perm_conventionelle(id_perm_c)
);

-- =====================================================
-- MISSION
-- =====================================================
CREATE TABLE Mission (
    id_mission INT PRIMARY KEY,
    pays VARCHAR(100),
    ville VARCHAR(100),
    email_mission VARCHAR(150),
    moyens_transport JSON,
    heure_depart TIME,
    heure_retour TIME,
    rapport TEXT,
    rapport_televerse BOOLEAN DEFAULT FALSE,
    date_telechargement_rapport DATETIME,
    date_limite_rapport DATE,
    FOREIGN KEY (id_mission) REFERENCES OPERATIONS(id_operation)
);

-- =====================================================
-- MISSION SEGMENT (pour missions multi-destinations)
-- =====================================================
CREATE TABLE MissionSegment (
    id_segment INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    pays VARCHAR(100) NOT NULL,
    ville VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    heure_arrivee TIME,
    heure_depart TIME,
    frais_hotel_unitaire DECIMAL(12,2) DEFAULT 0,
    frais_hotel_total DECIMAL(12,2) DEFAULT 0,
    nombre_nuits INT DEFAULT 0,
    ordre INT NOT NULL,
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE
);

-- =====================================================
-- FRAIS
-- =====================================================
CREATE TABLE Frais (
    id_frais INT PRIMARY KEY,
    id_operation INT,
    id_mission INT,
    frais_transport_voyage DECIMAL(12,2),
    frais_hotel DECIMAL(12,2),
    frais_deplacement DECIMAL(12,2),
    justificatif_de_frais VARCHAR(300),
    preuves_paiement JSON,
    frais_nutrition DECIMAL(12,2),
    total_frais DECIMAL(12,2),
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation),
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission)
);

-- =====================================================
-- ACTIVATION / CLOTURE
-- =====================================================
CREATE TABLE Activation (
    id_activation INT AUTO_INCREMENT PRIMARY KEY,
    id_operation INT,
    type_action ENUM('ACTIVATION','CLOTURE'),
    demandeur_fait BOOLEAN DEFAULT FALSE,
    date_demandeur DATETIME,
    rh_fait BOOLEAN DEFAULT FALSE,
    date_rh DATETIME,
    statut_final ENUM('EN_ATTENTE','COMPLETE') DEFAULT 'EN_ATTENTE',
    timestamp_action DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation)
);

-- =====================================================
-- VALIDATION
-- =====================================================
CREATE TABLE Validation (
    id_validation INT AUTO_INCREMENT PRIMARY KEY,
    id_operation INT,
    statut_validation ENUM('validé','attente','refusé'),
    timestamp_action DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation)
);

-- =====================================================
-- CREATION
-- =====================================================
CREATE TABLE Creation (
    id_creation INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT,
    id_operation INT,
    timestamp_action DATETIME DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50),
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation)
);

-- =====================================================
-- REMPLACANT
-- =====================================================
CREATE TABLE Remplacant_propose (
    id_remplacant_propose INT AUTO_INCREMENT PRIMARY KEY,
    id_operation INT NOT NULL,
    matricule_remplacant INT NOT NULL,
    ordre_proposition INT,
    est_accepte BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation),
    FOREIGN KEY (matricule_remplacant) REFERENCES EMPLOYE(matricule)
);

-- =====================================================
-- NOTIFICATION
-- =====================================================
CREATE TABLE Notification (
    id_notification INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT NOT NULL,
    type_notification ENUM('VALIDATION', 'REFUS', 'ALERTE_CONGES', 'RAPPEL_DEPART', 'RAPPEL_RETOUR', 'DEMANDE_MISSION', 'DEMANDE_EXPLICATION', 'EVALUATION', 'CLOTURE_REQUISE', 'AUTRE'),
    titre VARCHAR(200),
    message TEXT NOT NULL,
    lue BOOLEAN DEFAULT FALSE,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_lecture DATETIME,
    id_operation INT,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation)
);

-- =====================================================
-- DEMANDE EXPLICATION (solde négatif)
-- =====================================================
CREATE TABLE Demande_explication (
    id_demande_explication INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT NOT NULL,
    id_operation INT,
    motif TEXT,
    explication_fournie TEXT,
    date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_reponse DATETIME,
    statut ENUM('EN_ATTENTE', 'REPONDU') DEFAULT 'EN_ATTENTE',
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    FOREIGN KEY (id_operation) REFERENCES OPERATIONS(id_operation)
);

-- =====================================================
-- ALERTE ANNUELLE CONGES
-- =====================================================
CREATE TABLE Alerte_conges_annuelle (
    id_alerte INT AUTO_INCREMENT PRIMARY KEY,
    matricule INT NOT NULL,
    annee INT NOT NULL,
    solde_restant DECIMAL(5,2),
    date_alerte DATETIME DEFAULT CURRENT_TIMESTAMP,
    alertes_envoyees INT DEFAULT 0,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule)
);
