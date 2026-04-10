-- Migration 032: Add dedicated tables for Events, Performance 360,
--                Talent Management, Workforce Planning, and Club Review

-- Événements
CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    lieu VARCHAR(200),
    date_debut VARCHAR(50) NOT NULL,
    date_fin VARCHAR(50),
    organisateur VARCHAR(200),
    capacite INTEGER,
    statut VARCHAR(50) NOT NULL DEFAULT 'brouillon',
    created_by INTEGER REFERENCES EMPLOYE(matricule),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance 360
CREATE TABLE IF NOT EXISTS reviews_360 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reviewer_id INTEGER NOT NULL REFERENCES EMPLOYE(matricule),
    reviewee_id INTEGER NOT NULL REFERENCES EMPLOYE(matricule),
    scores JSON NOT NULL DEFAULT '[]',
    commentaire TEXT,
    points_forts TEXT,
    points_amelioration TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Talent Management – réunions
CREATE TABLE IF NOT EXISTS talent_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre VARCHAR(200) NOT NULL,
    manager_id INTEGER REFERENCES EMPLOYE(matricule),
    employee_id INTEGER REFERENCES EMPLOYE(matricule),
    date VARCHAR(20),
    agenda TEXT,
    notes TEXT,
    actions TEXT,
    statut VARCHAR(50) NOT NULL DEFAULT 'planifie',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Talent Management – objectifs
CREATE TABLE IF NOT EXISTS talent_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    echeance VARCHAR(20),
    statut VARCHAR(50) NOT NULL DEFAULT 'a_faire',
    employee_id INTEGER REFERENCES EMPLOYE(matricule),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workforce Planning – postes planifiés
CREATE TABLE IF NOT EXISTS workforce_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre VARCHAR(200) NOT NULL,
    direction VARCHAR(200),
    entite VARCHAR(100),
    trimestre VARCHAR(10) DEFAULT 'T1',
    annee VARCHAR(10),
    budget DECIMAL(15,2),
    priorite VARCHAR(50) DEFAULT 'moyenne',
    statut VARCHAR(50) DEFAULT 'planifie',
    notes TEXT,
    created_by INTEGER REFERENCES EMPLOYE(matricule),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Clubs
CREATE TABLE IF NOT EXISTS clubs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(100) DEFAULT 'Sports',
    emoji VARCHAR(10),
    created_by INTEGER REFERENCES EMPLOYE(matricule),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Club memberships
CREATE TABLE IF NOT EXISTS club_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL REFERENCES clubs(id),
    user_id INTEGER NOT NULL REFERENCES EMPLOYE(matricule),
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Club activities
CREATE TABLE IF NOT EXISTS club_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL REFERENCES clubs(id),
    titre VARCHAR(200) NOT NULL,
    date VARCHAR(20),
    description TEXT,
    created_by INTEGER REFERENCES EMPLOYE(matricule),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Club reviews
CREATE TABLE IF NOT EXISTS club_review_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL REFERENCES clubs(id),
    user_id INTEGER NOT NULL REFERENCES EMPLOYE(matricule),
    rating INTEGER NOT NULL,
    commentaire TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
