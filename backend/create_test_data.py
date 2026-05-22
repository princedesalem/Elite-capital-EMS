"""
Script pour créer des demandes de test dans la base de données
"""
import sys
import os
_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)

from app.db import SessionLocal
from app import models
from datetime import date, datetime, timedelta

db = SessionLocal()

try:
    print("✓ Démarrage du script...")
    
    operations_creees = []
    
    # ==== CONGÉ 1 ====
    employe = db.query(models.Employe).filter(models.Employe.matricule == 9007).first()
    if employe:
        op = models.Operation(
            matricule=9007,
            titre=f"Congé - {employe.prenom} {employe.nom}",
            commentaire="Congés annuels - Test automatique",
            date_depart=date.today() + timedelta(days=10),
            date_retour=date.today() + timedelta(days=15),
            duree=5,
            cree_par=9007
        )
        db.add(op)
        db.flush()
        
        conge = models.CongesLink(id_conges=op.id_operation)
        db.add(conge)
        
        operations_creees.append(('Congé', op.id_operation, employe.prenom, employe.nom))
        print(f"✓ Congé créé pour {employe.prenom} {employe.nom} (#{op.id_operation})")
        
        if employe.n1:
            n1 = db.query(models.Employe).filter(models.Employe.matricule == employe.n1).first()
            if n1:
                val = models.Validation(
                    id_operation=op.id_operation,
                    matricule_validateur=employe.n1,
                    role_validateur='N+1',
                    statut_validation='en attente'
                )
                db.add(val)
                print(f"  → Validation pour {n1.prenom} {n1.nom}")
    
    # ==== PERMISSION 1 ====
    employe = db.query(models.Employe).filter(models.Employe.matricule == 9007).first()
    if employe:
        op = models.Operation(
            matricule=9007,
            titre=f"Permission - {employe.prenom} {employe.nom}",
            commentaire="Permission exceptionnelle - Test",
            date_depart=date.today() + timedelta(days=3),
            date_retour=date.today() + timedelta(days=3),
            duree=1,
            cree_par=9007
        )
        db.add(op)
        db.flush()
        
        perm = models.Permission(id_permission=op.id_operation)
        db.add(perm)
        
        operations_creees.append(('Permission', op.id_operation, employe.prenom, employe.nom))
        print(f"✓ Permission créée pour {employe.prenom} {employe.nom} (#{op.id_operation})")
        
        if employe.n1:
            n1 = db.query(models.Employe).filter(models.Employe.matricule == employe.n1).first()
            if n1:
                val = models.Validation(
                    id_operation=op.id_operation,
                    matricule_validateur=employe.n1,
                    role_validateur='N+1',
                    statut_validation='en attente'
                )
                db.add(val)
                print(f"  → Validation pour {n1.prenom} {n1.nom}")
    
    # ==== MISSION 1 ====
    employe = db.query(models.Employe).filter(models.Employe.matricule == 9004).first()
    if employe:
        op = models.Operation(
            matricule=9004,
            titre=f"Mission - {employe.prenom} {employe.nom}",
            commentaire="Mission Douala - Test",
            date_depart=date.today() + timedelta(days=7),
            date_retour=date.today() + timedelta(days=12),
            duree=5,
            cree_par=9004
        )
        db.add(op)
        db.flush()
        
        mission = models.Mission(
            id_mission=op.id_operation,
            pays="Cameroun",
            ville="Douala",
            email_mission="test@example.com"
        )
        db.add(mission)
        
        operations_creees.append(('Mission', op.id_operation, employe.prenom, employe.nom))
        print(f"✓ Mission créée pour {employe.prenom} {employe.nom} (#{op.id_operation})")
        
        if employe.n1:
            n1 = db.query(models.Employe).filter(models.Employe.matricule == employe.n1).first()
            if n1:
                val = models.Validation(
                    id_operation=op.id_operation,
                    matricule_validateur=employe.n1,
                    role_validateur='N+1',
                    statut_validation='en attente'
                )
                db.add(val)
                print(f"  → Validation pour {n1.prenom} {n1.nom}")
    
    # ==== CONGÉ 2 ====
    employe = db.query(models.Employe).filter(models.Employe.matricule == 9006).first()
    if employe:
        op = models.Operation(
            matricule=9006,
            titre=f"Congé - {employe.prenom} {employe.nom}",
            commentaire="Congés de fin d'année - Test",
            date_depart=date.today() + timedelta(days=20),
            date_retour=date.today() + timedelta(days=25),
            duree=5,
            cree_par=9006
        )
        db.add(op)
        db.flush()
        
        conge = models.CongesLink(id_conges=op.id_operation)
        db.add(conge)
        
        operations_creees.append(('Congé', op.id_operation, employe.prenom, employe.nom))
        print(f"✓ Congé créé pour {employe.prenom} {employe.nom} (#{op.id_operation})")
        
        if employe.n1:
            n1 = db.query(models.Employe).filter(models.Employe.matricule == employe.n1).first()
            if n1:
                val = models.Validation(
                    id_operation=op.id_operation,
                    matricule_validateur=employe.n1,
                    role_validateur='N+1',
                    statut_validation='en attente'
                )
                db.add(val)
                print(f"  → Validation pour {n1.prenom} {n1.nom}")
    
    # ==== PERMISSION 2 ====
    employe = db.query(models.Employe).filter(models.Employe.matricule == 9005).first()
    if employe:
        op = models.Operation(
            matricule=9005,
            titre=f"Permission - {employe.prenom} {employe.nom}",
            commentaire="Rendez-vous médical - Test",
            date_depart=date.today() + timedelta(days=2),
            date_retour=date.today() + timedelta(days=2),
            duree=1,
            cree_par=9005
        )
        db.add(op)
        db.flush()
        
        perm = models.Permission(id_permission=op.id_operation)
        db.add(perm)
        
        operations_creees.append(('Permission', op.id_operation, employe.prenom, employe.nom))
        print(f"✓ Permission créée pour {employe.prenom} {employe.nom} (#{op.id_operation})")
        
        if employe.n1:
            n1 = db.query(models.Employe).filter(models.Employe.matricule == employe.n1).first()
            if n1:
                val = models.Validation(
                    id_operation=op.id_operation,
                    matricule_validateur=employe.n1,
                    role_validateur='N+1',
                    statut_validation='en attente'
                )
                db.add(val)
                print(f"  → Validation pour {n1.prenom} {n1.nom}")
    
    db.commit()
    
    print(f"\n🎉 {len(operations_creees)} demandes de test créées !")
    print(f"\n📱 Accède à http://192.168.3.186:5173")
    print(f"   Connecte-toi avec:")
    print(f"   • Matricule: 9007 (employé) ou 9004 (responsable)")
    print(f"   • Mot de passe: DemoPassword123!@#")
    print(f"\n🔍 Va dans Opérations → Workflow pour voir tes demandes !")
    
except Exception as e:
    print(f"❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
