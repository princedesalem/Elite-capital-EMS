"""
Tests : PUT /employees/{matricule} doit notifier les admins quand le RH
modifie le dossier d'un employé, avec le détail des champs changés.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import models
from app.utils.security import hash_password


# ---------------------------------------------------------------------------
# Helper : construire les données de mise à jour minimales
# ---------------------------------------------------------------------------

def _update_payload(seed, **overrides):
    """Retourne un payload valide pour PUT /employees/{matricule} avec toutes les
    valeurs actuelles de l'employé, afin d'éviter des diff parasites."""
    emp = seed["employe"]
    # statut_employe peut être un Enum (str enum) ou None
    statut = emp.statut_employe
    statut_str = statut.value if hasattr(statut, "value") else (str(statut) if statut else None)
    payload = {
        "matricule": emp.matricule,
        "nom": emp.nom,
        "prenom": emp.prenom,
        "date_embauche": emp.date_embauche.isoformat() if emp.date_embauche else "2024-01-01",
        "sexe": "F",
        "entite": seed["entite"].nom,
        "direction": seed["direction"].nom,
        "departement": seed["departement"].nom,
        "role": "EMPLOYE",
        "fonction": emp.fonction or "Analyste",
        "email": emp.email,
        "statut_employe": statut_str,
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Test 1 — Le RH modifie un champ → l'admin reçoit une notification avec diff
# ---------------------------------------------------------------------------

def test_rh_update_employee_notifies_admin_with_diff(client, seed_reference_data, db_session, auth_headers):
    emp = seed_reference_data["employe"]
    rh = seed_reference_data["rh"]
    admin = seed_reference_data["admin"]

    payload = _update_payload(seed_reference_data, fonction="Chef de projet")

    response = client.put(
        f"/employees/{emp.matricule}",
        json=payload,
        headers=auth_headers(rh.matricule, "RH"),
    )
    assert response.status_code == 200

    db_session.expire_all()
    admin_notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == admin.matricule,
        models.Notification.titre == "Dossier employé modifié par le RH",
    ).all()

    assert len(admin_notifs) >= 1, "L'admin doit recevoir une notification"

    msg = admin_notifs[0].message
    # Contient le nom du RH
    assert rh.nom in msg or rh.prenom in msg, (
        f"Le message doit mentionner le RH, obtenu : '{msg}'"
    )
    # Contient le diff de la fonction
    assert "Fonction" in msg, f"Le message doit mentionner le champ Fonction, obtenu : '{msg}'"
    assert "→" in msg, f"Le message doit contenir '→' pour le diff, obtenu : '{msg}'"
    # Contient le nom de l'employé modifié
    assert emp.nom in msg, f"Le message doit mentionner l'employé, obtenu : '{msg}'"


# ---------------------------------------------------------------------------
# Test 2 — Un non-RH (ADMIN) modifie un employé → pas de notification admin
# ---------------------------------------------------------------------------

def test_non_rh_update_does_not_notify_admin(client, seed_reference_data, db_session, auth_headers):
    emp = seed_reference_data["employe"]
    admin = seed_reference_data["admin"]

    payload = _update_payload(seed_reference_data, fonction="Directeur Adjoint")

    response = client.put(
        f"/employees/{emp.matricule}",
        json=payload,
        headers=auth_headers(admin.matricule, "ADMIN"),
    )
    assert response.status_code == 200

    db_session.expire_all()
    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == admin.matricule,
        models.Notification.titre == "Dossier employé modifié par le RH",
    ).all()

    assert len(notifs) == 0, (
        "Un admin qui modifie lui-même ne doit pas générer la notification RH→admin"
    )


# ---------------------------------------------------------------------------
# Test 3 — Aucun champ pertinent modifié → pas de notification
# ---------------------------------------------------------------------------

def test_rh_update_no_relevant_change_no_notification(client, seed_reference_data, db_session, auth_headers):
    emp = seed_reference_data["employe"]
    rh = seed_reference_data["rh"]
    admin = seed_reference_data["admin"]

    # Envoyer exactement les mêmes données (aucun changement pertinent)
    payload = _update_payload(seed_reference_data)

    response = client.put(
        f"/employees/{emp.matricule}",
        json=payload,
        headers=auth_headers(rh.matricule, "RH"),
    )
    assert response.status_code == 200

    db_session.expire_all()
    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == admin.matricule,
        models.Notification.titre == "Dossier employé modifié par le RH",
    ).all()

    assert len(notifs) == 0, (
        "Sans changement pertinent, aucune notification ne doit être créée"
    )


# ---------------------------------------------------------------------------
# Test 4 — Plusieurs admins → chacun reçoit sa notification
# ---------------------------------------------------------------------------

def test_rh_update_notifies_all_admins(client, seed_reference_data, db_session, auth_headers):
    emp = seed_reference_data["employe"]
    rh = seed_reference_data["rh"]
    admin = seed_reference_data["admin"]
    admin_role = seed_reference_data["roles"]["ADMIN"]

    # Créer un second admin
    emp2 = models.Employe(
        matricule=9002,
        nom="Second",
        prenom="Admin",
        email="9002@example.com",
        date_embauche=date(2024, 1, 1),
        id_entite=seed_reference_data["entite"].id_entite,
        id_role=admin_role.id,
        statut_employe="ACTIF",
    )
    db_session.add(emp2)
    db_session.flush()
    user2 = models.Utilisateur(
        matricule=9002,
        email="9002@example.com",
        role_id=admin_role.id,
        mot_de_passe_hash=hash_password("PasswordTemp123!"),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db_session.add(user2)
    db_session.commit()

    payload = _update_payload(seed_reference_data, telephone="0612345678")

    response = client.put(
        f"/employees/{emp.matricule}",
        json=payload,
        headers=auth_headers(rh.matricule, "RH"),
    )
    assert response.status_code == 200

    db_session.expire_all()
    notifs_admin1 = db_session.query(models.Notification).filter(
        models.Notification.matricule == admin.matricule,
        models.Notification.titre == "Dossier employé modifié par le RH",
    ).all()
    notifs_admin2 = db_session.query(models.Notification).filter(
        models.Notification.matricule == 9002,
        models.Notification.titre == "Dossier employé modifié par le RH",
    ).all()

    assert len(notifs_admin1) >= 1, "Premier admin doit recevoir une notification"
    assert len(notifs_admin2) >= 1, "Second admin doit recevoir une notification"
