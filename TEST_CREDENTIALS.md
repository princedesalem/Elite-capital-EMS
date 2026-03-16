# 🔐 Credentials de Test - Extranet ELITE CAPITAL

## Accès Direct (Login par Matricule)

### Utilisateur Standard (Employé)
- **Matricule:** `1001`
- **Mot de passe:** `TestPassword123!@#`
- **Email:** `jean.dupont@elc.com`
- **Rôle:** EMPLOYE

### Administrateur
- **Matricule:** `9999`
- **Mot de passe:** `AdminPassword123!@#`
- **Email:** `admin@elc.com`
- **Rôle:** ADMIN (Administrateur Système)

---

## Connexion par Email

Utilisez votre adresse email pour recevoir un lien de connexion à usage unique (15 min de validité).

**Exemple:**
1. Sur la page login, cliquez "Envoyer un lien"
2. Entrez: `jean.dupont@elc.com`
3. Le lien s'affiche dans les **logs du backend** (docker logs ou console)
4. Cliquez le lien → vous êtes authentifiés automatiquement

---

## 🚀 Démarrage Rapide

```powershell
cd extranet
docker compose down -v          # Clean slate
docker compose build            # Build images
docker compose up               # Start everything
```

Accès:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/docs

---

## � Comptes Démo (Hiérarchie Complète)

**Mot de passe commun:** `DemoPassword123!@#`

- **PCA** (9001) : paul.nfor@demo.ec
- **DG** (9002) : aline.manga@demo.ec
- **DIRECTEUR** (9003) : serge.tchoua@demo.ec
- **RESPONSABLE** (9004) : irene.kouam@demo.ec
- **RH** (9005) : rachel.essono@demo.ec
- **DFC** (9006) : joel.ekani@demo.ec
- **EMPLOYE** (9007) : julie.nanga@demo.ec

---

## 📝 À Tester

1. ✅ **Login simple** → Matricule 9007 / DemoPassword123!@#
2. ✅ **Email login** → Entrez jean.dupont@elc.com, cliquez lien
3. ✅ **Employees** → Créez/modifiez un employé
4. ✅ **Leave request** → Soumettez un congé
5. ✅ **Workflows** → Validez une demande
6. ✅ **Audit logs** → Inspectez l'historique des actions
7. ✅ **MFA setup** → Enregistrez un code TOTP (optionnel)
8. ✅ **Password change** → Modifiez votre mot de passe

---

## 🔧 Notes Importantes

- **Password Policy:** min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial
- **MFA:** Activée par défaut (optionnel lors du login)
- **Email:** Les messages non configurés s'affichent en logs
- **Database:** Suppression du volume Docker en cas de besoin (`docker compose down -v`)

---

**Créé:** 2 Mars 2026 | **Extranet Version:** 1.0
