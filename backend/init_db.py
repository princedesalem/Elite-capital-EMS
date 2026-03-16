"""
Simple initialization script to create roles and an admin user.
Run: python backend/init_db.py (from repo root) or via Docker exec.
"""
from app.db import SessionLocal, Base, engine
from app import models
from app.utils.security import hash_password
import os
from datetime import date, datetime, timedelta


def ensure_role(db, name: str, description: str = ''):
    role = db.query(models.Role).filter(models.Role.name == name).first()
    if not role:
        role = models.Role(name=name, description=description or f'Role {name}')
        db.add(role)
        db.commit()
        db.refresh(role)
    return role


def ensure_user(db, matricule: int, email: str, password: str, role_id: int):
    user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not user:
        safe_pwd = password[:72] if len(password.encode('utf-8')) > 72 else password
        user = models.Utilisateur(
            matricule=matricule,
            mot_de_passe_hash=hash_password(safe_pwd),
            role_id=role_id,
            email=email,
            mot_de_passe_temporaire=False,
            mfa_enabled=False
        )
        db.add(user)
    else:
        user.role_id = role_id
        if email:
            user.email = email
    db.commit()


def ensure_employe(
    db,
    matricule: int,
    nom: str,
    prenom: str,
    email: str,
    fonction: str,
    role_id: int,
    id_entite: int,
    id_direction: int,
    dept_id: int,
    n1: int | None = None,
):
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        emp = models.Employe(
            matricule=matricule,
            nom=nom,
            prenom=prenom,
            email=email,
            date_embauche=date(2021, 1, 1),
            fonction=fonction,
            statut_employe='ACTIF',
            solde_conges=30,
            id_role=role_id,
            id_entite=id_entite,
            id_direction=id_direction,
            dept_id=dept_id,
            n1=n1,
        )
        db.add(emp)
    else:
        emp.nom = nom
        emp.prenom = prenom
        emp.email = email
        emp.fonction = fonction
        emp.statut_employe = 'ACTIF'
        emp.id_role = role_id
        emp.id_entite = id_entite
        emp.id_direction = id_direction
        emp.dept_id = dept_id
        emp.n1 = n1
    db.commit()
    return emp


def ensure_demo_operations(db, matricules: dict):
    demandeur = matricules['EMPLOYE']

    existing = db.query(models.Operation).filter(
        models.Operation.titre.in_(['DEMO_CONGE', 'DEMO_PERMISSION', 'DEMO_MISSION'])
    ).count()
    if existing >= 3:
        return

    # DEMO CONGE
    op_conge = db.query(models.Operation).filter(models.Operation.titre == 'DEMO_CONGE').first()
    if not op_conge:
        op_conge = models.Operation(
            matricule=demandeur,
            titre='DEMO_CONGE',
            commentaire='Congé démo pour tests',
            date_depart=date.today() + timedelta(days=5),
            date_retour=date.today() + timedelta(days=10),
            duree=6,
            cree_par=demandeur,
        )
        db.add(op_conge)
        db.commit()
        db.refresh(op_conge)
        db.add(models.CongesLink(id_conges=op_conge.id_operation))
        db.commit()

    # DEMO PERMISSION
    op_perm = db.query(models.Operation).filter(models.Operation.titre == 'DEMO_PERMISSION').first()
    if not op_perm:
        op_perm = models.Operation(
            matricule=demandeur,
            titre='DEMO_PERMISSION',
            commentaire='Permission mariage démo',
            date_depart=date.today() + timedelta(days=2),
            date_retour=date.today() + timedelta(days=5),
            duree=4,
            cree_par=demandeur,
        )
        db.add(op_perm)
        db.commit()
        db.refresh(op_perm)

    perm_link = db.query(models.Permission).filter(models.Permission.id_permission == op_perm.id_operation).first()
    if not perm_link:
        db.add(models.Permission(id_permission=op_perm.id_operation))
        db.commit()

    perm_conv = db.query(models.PermConventionelle).filter(models.PermConventionelle.id_perm_c == op_perm.id_operation).first()
    if not perm_conv:
        db.add(models.PermConventionelle(
            id_perm_c=op_perm.id_operation,
            preuves_televersees=False,
            date_limite_preuves=date.today() + timedelta(days=60),
        ))
        db.commit()

    perm_mar = db.query(models.PermMariage).filter(models.PermMariage.id_perm_mar == op_perm.id_operation).first()
    if not perm_mar:
        db.add(models.PermMariage(id_perm_mar=op_perm.id_operation))
        db.commit()

    # DEMO MISSION
    op_mission = db.query(models.Operation).filter(models.Operation.titre == 'DEMO_MISSION').first()
    if not op_mission:
        op_mission = models.Operation(
            matricule=demandeur,
            titre='DEMO_MISSION',
            commentaire='Mission démo Yaoundé -> Douala',
            date_depart=date.today() + timedelta(days=1),
            date_retour=date.today() + timedelta(days=4),
            duree=4,
            cree_par=matricules['RESPONSABLE'],
        )
        db.add(op_mission)
        db.commit()
        db.refresh(op_mission)

    mission = db.query(models.Mission).filter(models.Mission.id_mission == op_mission.id_operation).first()
    if not mission:
        db.add(models.Mission(
            id_mission=op_mission.id_operation,
            pays='Cameroun',
            ville='Douala',
            email_mission='mission.demo@elc.com',
            moyens_transport=['routiere'],
            heure_depart=datetime.strptime('08:00:00', '%H:%M:%S').time(),
            heure_retour=datetime.strptime('18:00:00', '%H:%M:%S').time(),
            rapport_televerse=False,
            date_limite_rapport=date.today() + timedelta(days=6),
            frais_valides_missionnaire=False,
            frais_valides_rh=False,
            frais_payes=False,
        ))
        db.commit()

    mission_segment = db.query(models.MissionSegment).filter(
        models.MissionSegment.id_mission == op_mission.id_operation,
        models.MissionSegment.ordre == 1
    ).first()
    if not mission_segment:
        db.add(models.MissionSegment(
            id_mission=op_mission.id_operation,
            pays='Cameroun',
            ville='Douala',
            date_debut=date.today() + timedelta(days=1),
            date_fin=date.today() + timedelta(days=4),
            nombre_nuits=3,
            ordre=1,
            moyen_transport='routiere',
        ))
        db.commit()

    missionnaire = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == op_mission.id_operation,
        models.MissionnairesMission.matricule == demandeur
    ).first()
    if not missionnaire:
        db.add(models.MissionnairesMission(
            id_mission=op_mission.id_operation,
            matricule=demandeur,
            role_mission='participant',
        ))
        db.commit()

    frais = db.query(models.Frais).filter(models.Frais.id_frais == op_mission.id_operation).first()
    if not frais:
        db.add(models.Frais(
            id_frais=op_mission.id_operation,
            id_operation=op_mission.id_operation,
            id_mission=op_mission.id_operation,
            frais_transport_voyage=15000,
            frais_hotel=120000,
            frais_deplacement=50000,
            frais_nutrition=30000,
            total_frais=215000,
            preuves_paiement=[],
        ))
        db.commit()

    # Ajout validations de démo (sans ADMIN dans la chaîne)
    for op in [op_conge, op_perm, op_mission]:
        if not op:
            continue
        has_validation = db.query(models.Validation).filter(models.Validation.id_operation == op.id_operation).count() > 0
        if not has_validation:
            db.add(models.Validation(
                id_operation=op.id_operation,
                matricule_validateur=matricules['RESPONSABLE'],
                role_validateur='RESPONSABLE',
                statut_validation='validé',
                commentaire='Validation démo Responsable',
                timestamp_action=datetime.utcnow(),
            ))
            db.commit()

def create_or_get_entity(db, entity_name):
    """Create or retrieve entity by name"""
    entity = db.query(models.Entite).filter(models.Entite.nom == entity_name).first()
    if not entity:
        entity = models.Entite(nom=entity_name)
        db.add(entity)
        db.commit()
        db.refresh(entity)
    return entity

def create_or_get_direction(db, direction_name, entity_id, localisation_id=None):
    """Create or retrieve direction by name, entity and city"""
    direction = db.query(models.Direction).filter(
        models.Direction.nom == direction_name,
        models.Direction.id_entite == entity_id,
        models.Direction.id_localisation == localisation_id,
    ).first()
    if not direction:
        direction = models.Direction(nom=direction_name, id_entite=entity_id, id_localisation=localisation_id)
        db.add(direction)
        db.commit()
        db.refresh(direction)
    return direction

def create_or_get_department(db, dept_name, entity_id, localisation_id=None, direction_id=None):
    """Create or retrieve department by name, entity, city and optional direction"""
    department = db.query(models.Departement).filter(
        models.Departement.nom == dept_name,
        models.Departement.id_entite == entity_id,
        models.Departement.id_localisation == localisation_id,
    ).first()
    if not department:
        department = models.Departement(
            nom=dept_name,
            id_entite=entity_id,
            id_localisation=localisation_id,
            id_direction=direction_id,
        )
        db.add(department)
        db.commit()
        db.refresh(department)
    return department

def create_org_structure_by_city(db, localisations_by_city):
    """Create organisation structure split by city"""
    yaounde_id = localisations_by_city['Yaoundé'].id_localisation
    douala_id = localisations_by_city['Douala'].id_localisation
    libreville_id = localisations_by_city['Libreville'].id_localisation
    brazzaville_id = localisations_by_city['Brazzaville'].id_localisation

    # ELCAM
    elcam = create_or_get_entity(db, 'ELCAM')
    elcam_dist_dir = create_or_get_direction(db, 'Direction de la Distribution', elcam.id_entite, yaounde_id)
    create_or_get_department(db, 'Distribution Grandes Entreprises, Institutions et Fortunes', elcam.id_entite, yaounde_id, elcam_dist_dir.id_direction)
    create_or_get_department(db, 'Distribution particuliers et PME', elcam.id_entite, yaounde_id, elcam_dist_dir.id_direction)
    create_or_get_department(db, 'Gestion et Analyse de portefeuille', elcam.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Middle et Back Office', elcam.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Dévelopement commercial ELCAM', elcam.id_entite, douala_id, None)
    create_or_get_department(db, 'Dévelopement commercial ELCAM', elcam.id_entite, libreville_id, None)
    create_or_get_department(db, 'Dévelopement commercial ELCAM', elcam.id_entite, brazzaville_id, None)

    # EXCA
    exca = create_or_get_entity(db, 'EXCA')
    create_or_get_direction(db, 'Conformité et Controle Interne', exca.id_entite, yaounde_id)
    exca_dev_dir = create_or_get_direction(db, 'Developpement et Investissement', exca.id_entite, yaounde_id)
    create_or_get_department(db, 'Pool Grandes Entreprises & Fortunes', exca.id_entite, yaounde_id, exca_dev_dir.id_direction)
    create_or_get_department(db, 'Pool Particuliers & PME', exca.id_entite, yaounde_id, exca_dev_dir.id_direction)
    exca_conseil_dir = create_or_get_direction(db, 'Conseils et Financements Structurés', exca.id_entite, yaounde_id)
    create_or_get_department(db, 'Financement & Structuration', exca.id_entite, yaounde_id, exca_conseil_dir.id_direction)
    create_or_get_department(db, 'Middle & Back Office', exca.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Trésorerie(ALM)', exca.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Dévelopement commercial EXCA', exca.id_entite, douala_id, None)
    create_or_get_department(db, 'Dévelopement commercial EXCA', exca.id_entite, libreville_id, None)
    create_or_get_department(db, 'Dévelopement commercial EXCA', exca.id_entite, brazzaville_id, None)

    # ECG
    ecg = create_or_get_entity(db, 'ECG')
    ecg_audit_dir = create_or_get_direction(db, 'Audit Interne et Inspection Générale', ecg.id_entite, yaounde_id)
    create_or_get_department(db, 'Inspection Generale', ecg.id_entite, yaounde_id, ecg_audit_dir.id_direction)
    create_or_get_department(db, 'Audit interne', ecg.id_entite, yaounde_id, ecg_audit_dir.id_direction)
    ecg_fin_dir = create_or_get_direction(db, 'Direction Financière et Comptable', ecg.id_entite, yaounde_id)
    create_or_get_department(db, 'Comptabilité', ecg.id_entite, yaounde_id, ecg_fin_dir.id_direction)
    create_or_get_department(db, 'Trésorerie et Financement', ecg.id_entite, yaounde_id, ecg_fin_dir.id_direction)
    create_or_get_department(db, 'Controle de gestion', ecg.id_entite, yaounde_id, ecg_fin_dir.id_direction)
    create_or_get_department(db, 'Ressources Humaines', ecg.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Affaires Juridiques & Fiscalité', ecg.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Communication Marketing et Relations Publiques', ecg.id_entite, yaounde_id, None)
    ecg_org_dir = create_or_get_direction(db, 'Organisation et Projets', ecg.id_entite, yaounde_id)
    create_or_get_department(db, 'Gestion des Projets et Systèmes d\'Informations', ecg.id_entite, yaounde_id, ecg_org_dir.id_direction)
    create_or_get_department(db, 'Marketing Digital et Opérationnel', ecg.id_entite, yaounde_id, None)
    create_or_get_department(db, 'Moyens Généraux', ecg.id_entite, yaounde_id, None)

    return elcam, exca, ecg

def cleanup_city_specific_org(db, entities, localisations_by_city):
    """Remove legacy/extra directions and departments to keep exact structure per city."""
    elcam, exca, ecg = entities

    allowed_directions = {
        (elcam.id_entite, 'Yaoundé'): {
            'Direction de la Distribution',
        },
        (exca.id_entite, 'Yaoundé'): {
            'Conformité et Controle Interne',
            'Developpement et Investissement',
            'Conseils et Financements Structurés',
        },
        (ecg.id_entite, 'Yaoundé'): {
            'Audit Interne et Inspection Générale',
            'Direction Financière et Comptable',
            'Organisation et Projets',
        },
    }

    allowed_departements = {
        (elcam.id_entite, 'Yaoundé'): {
            'Distribution Grandes Entreprises, Institutions et Fortunes',
            'Distribution particuliers et PME',
            'Gestion et Analyse de portefeuille',
            'Middle et Back Office',
        },
        (elcam.id_entite, 'Douala'): {'Dévelopement commercial ELCAM'},
        (elcam.id_entite, 'Libreville'): {'Dévelopement commercial ELCAM'},
        (elcam.id_entite, 'Brazzaville'): {'Dévelopement commercial ELCAM'},

        (exca.id_entite, 'Yaoundé'): {
            'Pool Grandes Entreprises & Fortunes',
            'Pool Particuliers & PME',
            'Financement & Structuration',
            'Middle & Back Office',
            'Trésorerie(ALM)',
        },
        (exca.id_entite, 'Douala'): {'Dévelopement commercial EXCA'},
        (exca.id_entite, 'Libreville'): {'Dévelopement commercial EXCA'},
        (exca.id_entite, 'Brazzaville'): {'Dévelopement commercial EXCA'},

        (ecg.id_entite, 'Yaoundé'): {
            'Inspection Generale',
            'Audit interne',
            'Comptabilité',
            'Trésorerie et Financement',
            'Controle de gestion',
            'Ressources Humaines',
            'Affaires Juridiques & Fiscalité',
            'Communication Marketing et Relations Publiques',
            'Gestion des Projets et Systèmes d\'Informations',
            'Marketing Digital et Opérationnel',
            'Moyens Généraux',
        },
    }

    entity_ids = [elcam.id_entite, exca.id_entite, ecg.id_entite]

    # Clean directions for demo entities on managed cities
    for city_name, localisation in localisations_by_city.items():
        for entity_id in entity_ids:
            allowed = allowed_directions.get((entity_id, city_name), set())
            directions = db.query(models.Direction).filter(
                models.Direction.id_entite == entity_id,
                models.Direction.id_localisation == localisation.id_localisation,
            ).all()
            for direction in directions:
                if direction.nom not in allowed:
                    db.query(models.Departement).filter(
                        models.Departement.id_direction == direction.id_direction,
                        models.Departement.id_localisation == localisation.id_localisation,
                    ).delete(synchronize_session=False)
                    db.delete(direction)

    # Clean departments for demo entities on managed cities
    for city_name, localisation in localisations_by_city.items():
        for entity_id in entity_ids:
            allowed = allowed_departements.get((entity_id, city_name), set())
            departments = db.query(models.Departement).filter(
                models.Departement.id_entite == entity_id,
                models.Departement.id_localisation == localisation.id_localisation,
            ).all()
            for department in departments:
                if department.nom not in allowed:
                    db.delete(department)

    db.commit()

def init():
    print('Creating tables...')
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # create roles
        names = ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'RH', 'DFC', 'DG', 'PCA', 'ADMIN']
        roles = {name: ensure_role(db, name) for name in names}

        # create default pays (countries) - only 3 countries
        pays_data = [
            {'nom_pays': 'Cameroun', 'code_pays': 'CM'},
            {'nom_pays': 'Gabon', 'code_pays': 'GA'},
            {'nom_pays': 'Congo', 'code_pays': 'CG'}
        ]
        pays_map = {}
        for pays_info in pays_data:
            existing_pays = db.query(models.Pays).filter(models.Pays.code_pays == pays_info['code_pays']).first()
            if not existing_pays:
                pays = models.Pays(nom_pays=pays_info['nom_pays'], code_pays=pays_info['code_pays'])
                db.add(pays)
                db.commit()
                db.refresh(pays)
                pays_map[pays_info['code_pays']] = pays.id_pays
            else:
                pays_map[pays_info['code_pays']] = existing_pays.id_pays

        # create ONLY 4 villes where entities are implanted
        villes_data = {
            'CM': ['Yaoundé', 'Douala'],
            'GA': ['Libreville'],
            'CG': ['Brazzaville']
        }
        localisations_by_city = {}
        for code_pays, villes_list in villes_data.items():
            id_pays = pays_map.get(code_pays)
            if id_pays:
                for ville_nom in villes_list:
                    existing_ville = db.query(models.Localisation).filter(
                        models.Localisation.ville == ville_nom,
                        models.Localisation.id_pays == id_pays
                    ).first()
                    if not existing_ville:
                        localisation = models.Localisation(ville=ville_nom, id_pays=id_pays)
                        db.add(localisation)
                        db.commit()
                        db.refresh(localisation)
                    else:
                        localisation = existing_ville

                    localisations_by_city[ville_nom] = localisation

        # create organisational structure by city
        elcam, exca, ecg = create_org_structure_by_city(db, localisations_by_city)
        cleanup_city_specific_org(db, (elcam, exca, ecg), localisations_by_city)

        # Implantations demandées par ville
        allowed_entities_by_city = {
            'Yaoundé': [elcam.id_entite, exca.id_entite, ecg.id_entite],
            'Douala': [elcam.id_entite, exca.id_entite],
            'Libreville': [elcam.id_entite, exca.id_entite],
            'Brazzaville': [elcam.id_entite, exca.id_entite],
        }

        # Synchroniser les implantations pour les 3 entités démo sur ces 4 villes
        demo_entity_ids = [elcam.id_entite, exca.id_entite, ecg.id_entite]
        for city_name, localisation in localisations_by_city.items():
            allowed_entity_ids = allowed_entities_by_city.get(city_name, [])

            # supprimer celles non autorisées pour la ville
            db.query(models.Implantation).filter(
                models.Implantation.id_localisation == localisation.id_localisation,
                models.Implantation.id_entite.in_(demo_entity_ids),
                ~models.Implantation.id_entite.in_(allowed_entity_ids)
            ).delete(synchronize_session=False)

            # ajouter celles autorisées manquantes
            for entity_id in allowed_entity_ids:
                existing_implantation = db.query(models.Implantation).filter(
                    models.Implantation.id_localisation == localisation.id_localisation,
                    models.Implantation.id_entite == entity_id
                ).first()
                if not existing_implantation:
                    db.add(models.Implantation(
                        id_localisation=localisation.id_localisation,
                        id_entite=entity_id
                    ))

        db.commit()

        # Use ECG (Yaoundé) as primary entity for demo users
        ent = ecg
        yaounde_id = localisations_by_city['Yaoundé'].id_localisation
        dir = db.query(models.Direction).filter(
            models.Direction.id_entite == ent.id_entite,
            models.Direction.id_localisation == yaounde_id,
        ).first()
        dept = db.query(models.Departement).filter(
            models.Departement.id_entite == ent.id_entite,
            models.Departement.id_localisation == yaounde_id,
        ).first()
        dept_finance = db.query(models.Departement).filter(
            models.Departement.id_entite == ent.id_entite,
            models.Departement.id_localisation == yaounde_id,
            models.Departement.nom == 'Comptabilité'
        ).first() or dept

        # Comptes de démonstration
        demo_password = os.getenv('DEMO_PASSWORD', 'DemoPassword123!@#')
        admin_pwd = os.getenv('INIT_ADMIN_PW', 'AdminPassword123!@#')

        # Hiérarchie démo (EMPLOYE -> RESPONSABLE -> DIRECTEUR -> DG -> PCA)
        ensure_employe(db, 9001, 'Nfor', 'Paul', 'paul.nfor@demo.ec', 'PCA', roles['PCA'].id, ent.id_entite, dir.id_direction, dept.dept_id)
        ensure_employe(db, 9002, 'Manga', 'Aline', 'aline.manga@demo.ec', 'Directeur Général', roles['DG'].id, ent.id_entite, dir.id_direction, dept.dept_id, n1=9001)
        ensure_employe(db, 9003, 'Tchoua', 'Serge', 'serge.tchoua@demo.ec', 'Directeur', roles['DIRECTEUR'].id, ent.id_entite, dir.id_direction, dept.dept_id, n1=9002)
        ensure_employe(db, 9004, 'Kouam', 'Irene', 'irene.kouam@demo.ec', 'Responsable Département', roles['RESPONSABLE'].id, ent.id_entite, dir.id_direction, dept.dept_id, n1=9003)
        ensure_employe(db, 9005, 'Essono', 'Rachel', 'rachel.essono@demo.ec', 'RH', roles['RH'].id, ent.id_entite, dir.id_direction, dept.dept_id, n1=9003)
        ensure_employe(db, 9006, 'Ekani', 'Joel', 'joel.ekani@demo.ec', 'DFC', roles['DFC'].id, ent.id_entite, dir.id_direction, dept_finance.dept_id, n1=9003)
        ensure_employe(db, 9007, 'Nanga', 'Julie', 'julie.nanga@demo.ec', 'Employé', roles['EMPLOYE'].id, ent.id_entite, dir.id_direction, dept.dept_id, n1=9004)
        ensure_employe(db, 9999, 'Admin', 'Systeme', 'admin@elc.com', 'Administrateur', roles['ADMIN'].id, ent.id_entite, dir.id_direction, dept.dept_id)

        ensure_user(db, 9001, 'paul.nfor@demo.ec', demo_password, roles['PCA'].id)
        ensure_user(db, 9002, 'aline.manga@demo.ec', demo_password, roles['DG'].id)
        ensure_user(db, 9003, 'serge.tchoua@demo.ec', demo_password, roles['DIRECTEUR'].id)
        ensure_user(db, 9004, 'irene.kouam@demo.ec', demo_password, roles['RESPONSABLE'].id)
        ensure_user(db, 9005, 'rachel.essono@demo.ec', demo_password, roles['RH'].id)
        ensure_user(db, 9006, 'joel.ekani@demo.ec', demo_password, roles['DFC'].id)
        ensure_user(db, 9007, 'julie.nanga@demo.ec', demo_password, roles['EMPLOYE'].id)
        ensure_user(db, 9999, 'admin@elc.com', admin_pwd, roles['ADMIN'].id)

        ensure_demo_operations(db, {
            'PCA': 9001,
            'DG': 9002,
            'DIRECTEUR': 9003,
            'RESPONSABLE': 9004,
            'RH': 9005,
            'DFC': 9006,
            'EMPLOYE': 9007,
            'ADMIN': 9999,
        })

        print('\n=== LOGIN CREDENTIALS (DEMO) ===')
        print('Mot de passe commun (hors admin): DemoPassword123!@#')
        print('ADMIN: matricule=9999 / password=AdminPassword123!@# / email=admin@elc.com')
        print('PCA: matricule=9001 / email=paul.nfor@demo.ec')
        print('DG: matricule=9002 / email=aline.manga@demo.ec')
        print('DIRECTEUR: matricule=9003 / email=serge.tchoua@demo.ec')
        print('RESPONSABLE: matricule=9004 / email=irene.kouam@demo.ec')
        print('RH: matricule=9005 / email=rachel.essono@demo.ec')
        print('DFC: matricule=9006 / email=joel.ekani@demo.ec')
        print('EMPLOYE: matricule=9007 / email=julie.nanga@demo.ec')
    finally:
        db.close()
    print("✓ Initialization complete")

if __name__=='__main__':
    try:
        init()
    except Exception as e:
        print(f"Warning: Init failed ({e}), but continuing with server startup")
