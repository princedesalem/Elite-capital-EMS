from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from ..db import get_db
from .. import models
from ..utils import security
from fastapi import Request
from datetime import date, datetime, timedelta

router = APIRouter(prefix='/dashboard', tags=['dashboard'])


@router.get('/analytics/{matricule}')
def get_dashboard_analytics_for_user(matricule: int, db: Session = Depends(get_db)):
    """
    Retourne les analytics filtrées selon le rôle de l'utilisateur:
    - EMPLOYE: ses propres opérations uniquement
    - RESPONSABLE: opérations de son département + ses opérations
    - DIRECTEUR: opérations de sa direction + ses opérations
    - DG: opérations de son entité + ses opérations
    - RH/ADMIN/PCA/AG: toutes les opérations + toutes les infos organisation
    """
    # Récupérer l'employé
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Récupérer le rôle de l'employé
    role_obj = db.query(models.Role).filter(models.Role.id == employe.id_role).first() if employe.id_role else None
    role = (role_obj.name if role_obj else 'EMPLOYE').upper()
    
    # Déterminer le périmètre selon le rôle
    is_admin = role in ['RH', 'ADMIN', 'PCA', 'AG']
    is_dg = role == 'DG'
    is_directeur = role == 'DIRECTEUR'
    is_responsable = role == 'RESPONSABLE'
    
    # === MES OPÉRATIONS PERSONNELLES (pour tous) ===
    mes_operations = db.query(models.Operation).filter(
        models.Operation.matricule == matricule
    ).all()
    
    mes_ops_by_type = {}
    for op in mes_operations:
        type_op = op.titre or op.type_demande or 'Non renseigné'
        mes_ops_by_type[type_op] = mes_ops_by_type.get(type_op, 0) + 1
    
    mes_ops_by_statut = {}
    for op in mes_operations:
        statut = op.statut or 'en attente'
        mes_ops_by_statut[statut] = mes_ops_by_statut.get(statut, 0) + 1
    
    mes_operations_stats = {
        'total': len(mes_operations),
        'by_type': [{'type': k, 'count': v} for k, v in mes_ops_by_type.items()],
        'by_statut': [{'statut': k, 'count': v} for k, v in mes_ops_by_statut.items()],
    }
    
    # === OPÉRATIONS DU PÉRIMÈTRE ===
    perimetre_operations = []
    perimetre_employes = []
    show_org_stats = False
    
    if is_admin:
        # Voir TOUT
        perimetre_operations = db.query(models.Operation).all()
        perimetre_employes = db.query(models.Employe).all()
        show_org_stats = True
    elif is_dg:
        # Voir toute l'entité
        perimetre_employes = db.query(models.Employe).filter(
            models.Employe.id_entite == employe.id_entite
        ).all()
        matricules_entite = [e.matricule for e in perimetre_employes]
        perimetre_operations = db.query(models.Operation).filter(
            models.Operation.matricule.in_(matricules_entite)
        ).all()
        show_org_stats = True
    elif is_directeur:
        # Voir toute la direction
        perimetre_employes = db.query(models.Employe).filter(
            models.Employe.id_direction == employe.id_direction
        ).all()
        matricules_direction = [e.matricule for e in perimetre_employes]
        perimetre_operations = db.query(models.Operation).filter(
            models.Operation.matricule.in_(matricules_direction)
        ).all()
        show_org_stats = True
    elif is_responsable:
        # Voir tout le département
        perimetre_employes = db.query(models.Employe).filter(
            models.Employe.dept_id == employe.dept_id
        ).all()
        matricules_dept = [e.matricule for e in perimetre_employes]
        perimetre_operations = db.query(models.Operation).filter(
            models.Operation.matricule.in_(matricules_dept)
        ).all()
        show_org_stats = True
    else:
        # EMPLOYE: seulement ses opérations (déjà dans mes_operations_stats)
        perimetre_operations = []
        perimetre_employes = []
        show_org_stats = False
    
    # Stats périmètre
    perimetre_ops_by_type = {}
    for op in perimetre_operations:
        type_op = op.titre or op.type_demande or 'Non renseigné'
        perimetre_ops_by_type[type_op] = perimetre_ops_by_type.get(type_op, 0) + 1
    
    perimetre_ops_by_statut = {}
    for op in perimetre_operations:
        statut = op.statut or 'en attente'
        perimetre_ops_by_statut[statut] = perimetre_ops_by_statut.get(statut, 0) + 1
    
    # KPIs du périmètre (effectif, sexe, catégorie, rôles, opérations)
    perimetre_kpis = {}
    if len(perimetre_employes) > 0:
        total = len(perimetre_employes)
        
        # ===== SEXE =====
        hommes = sum(1 for e in perimetre_employes if e.sexe == 'M')
        femmes = sum(1 for e in perimetre_employes if e.sexe == 'F')
        perimetre_kpis['effectif_total'] = total
        perimetre_kpis['hommes'] = hommes
        perimetre_kpis['femmes'] = femmes
        perimetre_kpis['hommes_pct'] = round((hommes / total * 100), 1) if total > 0 else 0
        perimetre_kpis['femmes_pct'] = round((femmes / total * 100), 1) if total > 0 else 0
        perimetre_kpis['by_sexe'] = [
            {'sexe': 'M', 'count': hommes, 'pct': perimetre_kpis['hommes_pct']},
            {'sexe': 'F', 'count': femmes, 'pct': perimetre_kpis['femmes_pct']},
        ]
        
        # ===== CATÉGORIES =====
        categories = {}
        for e in perimetre_employes:
            cat = e.categorie or 'Non renseigné'
            categories[cat] = categories.get(cat, 0) + 1
        perimetre_kpis['by_categorie'] = [{'categorie': k, 'count': v, 'pct': round((v/total*100), 1)} for k, v in sorted(categories.items(), key=lambda x: x[1], reverse=True)]
        
        # ===== RÔLES =====
        roles = {}
        for e in perimetre_employes:
            role_name = 'Non assigné'
            if e.id_role:
                role_obj = db.query(models.Role).filter(models.Role.id == e.id_role).first()
                if role_obj:
                    role_name = role_obj.name
            roles[role_name] = roles.get(role_name, 0) + 1
        perimetre_kpis['by_role'] = [{'role': k, 'count': v, 'pct': round((v/total*100), 1)} for k, v in sorted(roles.items(), key=lambda x: x[1], reverse=True)]
        
        # ===== GÉOGRAPHIE: VILLES & PAYS =====
        cities = {}
        countries = {}
        for e in perimetre_employes:
            city = 'Non renseigné'
            country = 'Non renseigné'
            if e.dept_id:
                dept = db.query(models.Departement).filter(models.Departement.dept_id == e.dept_id).first()
                if dept and dept.id_localisation:
                    loc = db.query(models.Localisation).filter(models.Localisation.id_localisation == dept.id_localisation).first()
                    if loc:
                        city = loc.ville or 'Non renseigné'
                        if loc.id_pays:
                            pays = db.query(models.Pays).filter(models.Pays.id_pays == loc.id_pays).first()
                            if pays:
                                country = pays.nom_pays or 'Non renseigné'
            cities[city] = cities.get(city, 0) + 1
            countries[country] = countries.get(country, 0) + 1
        perimetre_kpis['by_ville'] = [{'ville': k, 'count': v, 'pct': round((v/total*100), 1)} for k, v in sorted(cities.items(), key=lambda x: x[1], reverse=True)]
        perimetre_kpis['by_pays'] = [{'pays': k, 'count': v, 'pct': round((v/total*100), 1)} for k, v in sorted(countries.items(), key=lambda x: x[1], reverse=True)]
        
        # ===== ÂGES (tranches) =====
        today = date.today()
        tranches_age = {'<25': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0}
        for e in perimetre_employes:
            if e.date_naissance:
                age = today.year - e.date_naissance.year
                if today.month < e.date_naissance.month or (today.month == e.date_naissance.month and today.day < e.date_naissance.day):
                    age -= 1
                
                if age < 25:
                    tranches_age['<25'] += 1
                elif age < 35:
                    tranches_age['25-34'] += 1
                elif age < 45:
                    tranches_age['35-44'] += 1
                elif age < 55:
                    tranches_age['45-54'] += 1
                else:
                    tranches_age['55+'] += 1
        
        perimetre_kpis['by_age'] = [{'tranche': k, 'count': v, 'pct': round((v/total*100), 1)} for k, v in tranches_age.items() if v > 0]
        
        # ===== OPÉRATIONS PAR SEXE =====
        ops_by_sexe = {'M': 0, 'F': 0}
        for op in perimetre_operations:
            emp = db.query(models.Employe).filter(models.Employe.matricule == op.matricule).first()
            if emp and emp.sexe:
                ops_by_sexe[emp.sexe] = ops_by_sexe.get(emp.sexe, 0) + 1
        perimetre_kpis['operations_by_sexe'] = [
            {'sexe': 'M', 'count': ops_by_sexe.get('M', 0)},
            {'sexe': 'F', 'count': ops_by_sexe.get('F', 0)},
        ]
        
        # ===== OPÉRATIONS PAR TYPE ET SEXE =====
        ops_type_sexe = {}
        for op in perimetre_operations:
            type_op = op.titre or 'NON_RENSEIGNE'
            emp = db.query(models.Employe).filter(models.Employe.matricule == op.matricule).first()
            sexe = emp.sexe if emp else 'X'
            key = f"{type_op}_{sexe}"
            ops_type_sexe[key] = ops_type_sexe.get(key, 0) + 1
        
        ops_by_type_and_sexe = {}
        for key, count in ops_type_sexe.items():
            type_op, sexe = key.rsplit('_', 1)
            if type_op not in ops_by_type_and_sexe:
                ops_by_type_and_sexe[type_op] = {'M': 0, 'F': 0, 'X': 0}
            ops_by_type_and_sexe[type_op][sexe] = count
        
        perimetre_kpis['operations_by_type_and_sexe'] = [
            {
                'type': k,
                'hommes': v.get('M', 0),
                'femmes': v.get('F', 0),
                'indetermine': v.get('X', 0),
                'total': v.get('M', 0) + v.get('F', 0) + v.get('X', 0)
            }
            for k, v in ops_by_type_and_sexe.items()
        ]
    
    # ===== STRUCTURE ORGANISATIONNELLE PAR VILLE ET PAYS =====
    org_structure_by_geo = {}
    
    # Directions par ville/pays
    directions_by_ville = {}
    directions_by_pays = {}
    all_directions = db.query(models.Direction).all()
    for direction in all_directions:
        # Trouver les départements de cette direction
        depts = db.query(models.Departement).filter(models.Departement.id_direction == direction.id_direction).all()
        for dept in depts:
            if dept.id_localisation:
                loc = db.query(models.Localisation).filter(models.Localisation.id_localisation == dept.id_localisation).first()
                if loc:
                    ville = loc.ville or 'Non renseigné'
                    directions_by_ville[ville] = set(directions_by_ville.get(ville, set())) | {direction.id_direction}
                    if loc.id_pays:
                        pays = db.query(models.Pays).filter(models.Pays.id_pays == loc.id_pays).first()
                        if pays:
                            pays_name = pays.nom_pays
                            directions_by_pays[pays_name] = set(directions_by_pays.get(pays_name, set())) | {direction.id_direction}
    
    # Départements par ville/pays
    departments_by_ville = {}
    departments_by_pays = {}
    all_depts = db.query(models.Departement).all()
    for dept in all_depts:
        if dept.id_localisation:
            loc = db.query(models.Localisation).filter(models.Localisation.id_localisation == dept.id_localisation).first()
            if loc:
                ville = loc.ville or 'Non renseigné'
                departments_by_ville[ville] = departments_by_ville.get(ville, 0) + 1
                if loc.id_pays:
                    pays = db.query(models.Pays).filter(models.Pays.id_pays == loc.id_pays).first()
                    if pays:
                        pays_name = pays.nom_pays
                        departments_by_pays[pays_name] = departments_by_pays.get(pays_name, 0) + 1
    
    # Entités par ville/pays
    entities_by_ville = {}
    entities_by_pays = {}
    all_entities = db.query(models.Entite).all()
    for entity in all_entities:
        # Trouver les directions de cette entité
        dirs = db.query(models.Direction).filter(models.Direction.id_entite == entity.id_entite).all()
        for direction in dirs:
            depts = db.query(models.Departement).filter(models.Departement.id_direction == direction.id_direction).all()
            for dept in depts:
                if dept.id_localisation:
                    loc = db.query(models.Localisation).filter(models.Localisation.id_localisation == dept.id_localisation).first()
                    if loc:
                        ville = loc.ville or 'Non renseigné'
                        entities_by_ville[ville] = set(entities_by_ville.get(ville, set())) | {entity.id_entite}
                        if loc.id_pays:
                            pays = db.query(models.Pays).filter(models.Pays.id_pays == loc.id_pays).first()
                            if pays:
                                pays_name = pays.nom_pays
                                entities_by_pays[pays_name] = set(entities_by_pays.get(pays_name, set())) | {entity.id_entite}
    
    org_structure_by_geo['directions_by_ville'] = [
        {'ville': k, 'count': len(v)} for k, v in sorted(directions_by_ville.items())
    ]
    org_structure_by_geo['directions_by_pays'] = [
        {'pays': k, 'count': len(v)} for k, v in sorted(directions_by_pays.items())
    ]
    org_structure_by_geo['departments_by_ville'] = [
        {'ville': k, 'count': v} for k, v in sorted(departments_by_ville.items())
    ]
    org_structure_by_geo['departments_by_pays'] = [
        {'pays': k, 'count': v} for k, v in sorted(departments_by_pays.items())
    ]
    org_structure_by_geo['entities_by_ville'] = [
        {'ville': k, 'count': len(v)} for k, v in sorted(entities_by_ville.items())
    ]
    org_structure_by_geo['entities_by_pays'] = [
        {'pays': k, 'count': len(v)} for k, v in sorted(entities_by_pays.items())
    ]
    
    perimetre_stats = {
        'total_operations': len(perimetre_operations),
        'total_employes': len(perimetre_employes),
        'kpis': perimetre_kpis,
        'by_type': [{'type': k, 'count': v} for k, v in perimetre_ops_by_type.items()],
        'by_statut': [{'statut': k, 'count': v} for k, v in perimetre_ops_by_statut.items()],
        'org_structure_by_geo': org_structure_by_geo,
    }
    
    # === INFOS ORGANISATION (selon rôle) ===
    org_stats = None
    if show_org_stats:
        if is_admin:
            # Toutes les entités
            org_stats = {
                'employes_by_entite': [
                    {
                        'entite': e.nom,
                        'count': db.query(func.count(models.Employe.matricule)).filter(
                            models.Employe.id_entite == e.id_entite
                        ).scalar() or 0
                    }
                    for e in db.query(models.Entite).all()
                ],
                'employes_by_direction': [
                    {
                        'direction': d.nom,
                        'count': db.query(func.count(models.Employe.matricule)).filter(
                            models.Employe.id_direction == d.id_direction
                        ).scalar() or 0
                    }
                    for d in db.query(models.Direction).all()
                ],
                'employes_by_departement': [
                    {
                        'departement': d.nom,
                        'count': db.query(func.count(models.Employe.matricule)).filter(
                            models.Employe.dept_id == d.dept_id
                        ).scalar() or 0
                    }
                    for d in db.query(models.Departement).all()
                ],
            }
        elif is_dg:
            # Toutes les directions de l'entité
            directions = db.query(models.Direction).filter(
                models.Direction.id_entite == employe.id_entite
            ).all()
            org_stats = {
                'employes_by_direction': [
                    {
                        'direction': d.nom,
                        'count': db.query(func.count(models.Employe.matricule)).filter(
                            models.Employe.id_direction == d.id_direction
                        ).scalar() or 0
                    }
                    for d in directions
                ],
            }
        elif is_directeur:
            # Tous les départements de la direction
            departements = db.query(models.Departement).filter(
                models.Departement.id_direction == employe.id_direction
            ).all()
            org_stats = {
                'employes_by_departement': [
                    {
                        'departement': d.nom,
                        'count': db.query(func.count(models.Employe.matricule)).filter(
                            models.Employe.dept_id == d.dept_id
                        ).scalar() or 0
                    }
                    for d in departements
                ],
            }
        elif is_responsable:
            # Juste le département
            departement = db.query(models.Departement).filter(
                models.Departement.dept_id == employe.dept_id
            ).first()
            if departement:
                org_stats = {
                    'departement': {
                        'nom': departement.nom,
                        'total_employes': len(perimetre_employes),
                    }
                }
    
    return {
        'matricule': matricule,
        'role': role,
        'mes_operations': mes_operations_stats,
        'perimetre': perimetre_stats,
        'organisation': org_stats,
        'show_org_stats': show_org_stats,
    }


@router.get('/analytics')
def get_dashboard_analytics(db: Session = Depends(get_db)):
    # === KPIs de base ===
    total_employes = db.query(func.count(models.Employe.matricule)).scalar() or 0
    total_operations = db.query(func.count(models.Operation.id_operation)).scalar() or 0

    # === Répartition Hommes/Femmes ===
    sexe_rows = db.query(
        models.Employe.sexe,
        func.count(models.Employe.matricule)
    ).filter(models.Employe.sexe.isnot(None)).group_by(models.Employe.sexe).all()
    
    repartition_sexe = []
    total_sexe = sum(count for _, count in sexe_rows) or 1
    for sexe, count in sexe_rows:
        repartition_sexe.append({
            'sexe': sexe or 'Non renseigné',
            'count': int(count),
            'percentage': round((count / total_sexe) * 100, 1)
        })

    # === Nouvelles recrues (embauchés cette année) ===
    current_year = date.today().year
    nouvelles_recrues = db.query(func.count(models.Employe.matricule)).filter(
        extract('year', models.Employe.date_embauche) == current_year
    ).scalar() or 0

    # Recrues par mois (6 derniers mois)
    six_months_ago = date.today() - timedelta(days=180)
    recrues_par_mois_rows = db.query(
        extract('year', models.Employe.date_embauche).label('annee'),
        extract('month', models.Employe.date_embauche).label('mois'),
        func.count(models.Employe.matricule)
    ).filter(
        models.Employe.date_embauche >= six_months_ago
    ).group_by('annee', 'mois').order_by('annee', 'mois').all()

    recrues_par_mois = [
        {
            'mois': f"{int(annee)}-{int(mois):02d}",
            'count': int(count)
        }
        for annee, mois, count in recrues_par_mois_rows
    ]

    # === Répartition par catégorie ===
    categorie_rows = db.query(
        models.Employe.categorie,
        func.count(models.Employe.matricule)
    ).group_by(models.Employe.categorie).all()

    repartition_categorie = [
        {
            'categorie': cat or 'Non renseigné',
            'count': int(count)
        }
        for cat, count in categorie_rows
    ]

    # === Employés par ville ===
    employes_par_ville_rows = db.query(
        models.Employe.ville,
        func.count(models.Employe.matricule)
    ).group_by(models.Employe.ville).all()

    employes_par_ville = [
        {
            'ville': ville or 'Non renseigné',
            'count': int(count)
        }
        for ville, count in employes_par_ville_rows
    ]

    # === Tranches d'âge ===
    today = date.today()
    employes_avec_age = db.query(models.Employe).filter(models.Employe.date_naissance.isnot(None)).all()
    
    tranches_age = {'<25': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0}
    for emp in employes_avec_age:
        if emp.date_naissance:
            age = today.year - emp.date_naissance.year
            if today.month < emp.date_naissance.month or (today.month == emp.date_naissance.month and today.day < emp.date_naissance.day):
                age -= 1
            
            if age < 25:
                tranches_age['<25'] += 1
            elif age < 35:
                tranches_age['25-34'] += 1
            elif age < 45:
                tranches_age['35-44'] += 1
            elif age < 55:
                tranches_age['45-54'] += 1
            else:
                tranches_age['55+'] += 1

    repartition_age = [{'tranche': k, 'count': v} for k, v in tranches_age.items() if v > 0]

    # === Répartition par rôle ===
    role_rows = db.query(
        models.Role.name,
        func.count(models.Employe.matricule)
    ).join(models.Role, models.Employe.id_role == models.Role.id, isouter=True
    ).group_by(models.Role.name).all()

    repartition_role = [
        {
            'role': role or 'EMPLOYE',
            'count': int(count)
        }
        for role, count in role_rows
    ]

    # === Ancienneté moyenne (en années) ===
    employes_avec_embauche = db.query(models.Employe).filter(models.Employe.date_embauche.isnot(None)).all()
    if employes_avec_embauche:
        total_anciennete = sum(
            (today - emp.date_embauche).days / 365.25
            for emp in employes_avec_embauche
        )
        anciennete_moyenne = round(total_anciennete / len(employes_avec_embauche), 1)
    else:
        anciennete_moyenne = 0

    # === Solde congés moyen ===
    solde_conges_moyen = db.query(func.avg(models.Employe.solde_conges)).filter(
        models.Employe.solde_conges.isnot(None)
    ).scalar() or 0
    solde_conges_moyen = round(float(solde_conges_moyen), 1)

    # === Opérations par type ===
    by_type_rows = db.query(
        models.Operation.titre,
        func.count(models.Operation.id_operation)
    ).group_by(models.Operation.titre).all()

    operations_by_type = [
        {
            'type': titre or 'NON_RENSEIGNE',
            'count': int(count),
        }
        for titre, count in by_type_rows
    ]

    # === Validations par statut ===
    validations_by_status_rows = db.query(
        models.Validation.statut_validation,
        func.count(models.Validation.id_validation)
    ).group_by(models.Validation.statut_validation).all()

    validations_by_status = [
        {
            'statut': statut or 'INCONNU',
            'count': int(count),
        }
        for statut, count in validations_by_status_rows
    ]

    # Taux d'approbation
    total_validations = sum(v['count'] for v in validations_by_status) or 1
    approuvees = sum(v['count'] for v in validations_by_status if 'APPROUV' in str(v['statut']).upper())
    taux_approbation = round((approuvees / total_validations) * 100, 1)

    # === Employés par entité ===
    employes_by_entite_rows = db.query(
        models.Entite.nom,
        func.count(models.Employe.matricule)
    ).join(
        models.Employe,
        models.Employe.id_entite == models.Entite.id_entite,
        isouter=True
    ).group_by(models.Entite.nom).all()

    employes_by_entite = [
        {
            'entite': entite,
            'count': int(count),
        }
        for entite, count in employes_by_entite_rows
    ]

    # === Départements par ville ===
    departments_by_city_rows = db.query(
        models.Localisation.ville,
        func.count(models.Departement.dept_id)
    ).join(
        models.Departement,
        models.Departement.id_localisation == models.Localisation.id_localisation,
        isouter=True
    ).group_by(models.Localisation.ville).all()

    departments_by_city = [
        {
            'ville': ville,
            'count': int(count),
        }
        for ville, count in departments_by_city_rows
    ]

    return {
        'generated_at': str(date.today()),
        'kpis': {
            'total_employes': int(total_employes),
            'total_operations': int(total_operations),
            'total_types_operations': len(operations_by_type),
            'nouvelles_recrues': int(nouvelles_recrues),
            'anciennete_moyenne': anciennete_moyenne,
            'solde_conges_moyen': solde_conges_moyen,
            'taux_approbation': taux_approbation,
        },
        'repartition_sexe': repartition_sexe,
        'repartition_categorie': repartition_categorie,
        'repartition_age': repartition_age,
        'repartition_role': repartition_role,
        'employes_par_ville': employes_par_ville,
        'recrues_par_mois': recrues_par_mois,
        'operations_by_type': operations_by_type,
        'validations_by_status': validations_by_status,
        'employes_by_entite': employes_by_entite,
        'departments_by_city': departments_by_city,
    }


@router.get('/')
def get_dashboard(request: Request, db: Session = Depends(get_db)):
    # extract matricule and role from bearer token if present
    auth = request.headers.get('authorization')
    matricule = None
    role = None
    if auth and auth.lower().startswith('bearer '):
        token = auth.split(None,1)[1]
        try:
            payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            matricule = payload.get('matricule')
            role = payload.get('role')
        except Exception:
            pass

    if not matricule:
        raise HTTPException(status_code=401, detail='Unauthorized')

    # Employee: own requests
    if role == 'EMPLOYE' or role is None:
        own = db.query(models.Conge).filter(models.Conge.matricule==matricule).all()
        return {'role':'EMPLOYE','own': [c.__dict__ for c in own]}

    # RESPONSABLE: requests in department and subordinates
    if role == 'RESPONSABLE':
        emp = db.query(models.Employe).filter(models.Employe.matricule==matricule).first()
        dept = emp.departement if emp else None
        # requests where employe.departement == dept OR employe.n1 chain includes matricule
        subs = []
        def collect_subs(m):
            direct = db.query(models.Employe).filter(models.Employe.n1==m).all()
            for d in direct:
                subs.append(d.matricule)
                collect_subs(d.matricule)
        collect_subs(matricule)
        q = db.query(models.Conge).filter((models.Conge.matricule.in_(subs)) | (models.Conge.matricule==matricule)).all()
        return {'role':'RESPONSABLE','requests': [c.__dict__ for c in q]}

    if role == 'RH':
        allc = db.query(models.Conge).all()
        return {'role':'RH','requests': [c.__dict__ for c in allc]}

    if role == 'DG':
        emp = db.query(models.Employe).filter(models.Employe.matricule==matricule).first()
        ent = emp.entite if emp else None
        q = db.query(models.Conge).join(models.Employe, models.Conge.matricule==models.Employe.matricule).filter(models.Employe.entite==ent).all()
        return {'role':'DG','requests': [c.__dict__ for c in q]}

    if role == 'PCA':
        allc = db.query(models.Conge).all()
        return {'role':'PCA','requests': [c.__dict__ for c in allc]}

    return {'role':'UNKNOWN','requests':[]}
