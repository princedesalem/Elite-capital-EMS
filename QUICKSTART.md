# ⚡ Démarrage du Projet - Extranet ELITE CAPITAL

## Option 1: Docker Compose (RECOMMANDÉ)

### Étape 1: Préparer le workspace
```powershell
# Ouvrir PowerShell dans extranet/
cd c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet

# Nettoyer les données anciennes (première fois seulement)
docker compose down -v
```

### Étape 2: Builder les images
```powershell
# Construire les images Docker
docker compose build

# Cela télécharge Python, Node, dépendances, etc.
# Peut prendre 2-5 minutes la première fois
```

### Étape 3: Lancer tout
```powershell
# Démarrer tous les services
docker compose up

# Vous verrez:
# ✓ db:      Postgres prêt sur port 5432
# ✓ backend: Uvicorn sur http://localhost:8000
# ✓ frontend: Vite sur http://localhost:5173
```

### Étape 4: Accéder à l'app
Ouvrir le navigateur:
```
http://localhost:5173
```

**Identifier avec les credentials du fichier TEST_CREDENTIALS.md**

---

## Option 2: Arrêter tout
```powershell
# Ctrl+C dans le terminal où Docker Compose tourne
# Ou:
docker compose down

# Si vous voulez effacer la base de données:
docker compose down -v
```

---

## ❓ Troubleshooting

### "impossible de charger le script"
```powershell
# Sur Windows, autoriser l'exécution:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "unable to get image 'extranet-frontend'"
```powershell
# Rebuild les images:
docker compose build --no-cache
```

### "Connexion refusée sur 5173 / 8000"
- Attendez 30 secondes pour que les services démarrent
- Vérifiez: `docker ps` (voyez-vous les 3 conteneurs?)
- Vérifiez les logs: `docker logs extranet-backend` ou `docker logs extranet-frontend`

### "Email non reçu"
- Les emails s'affichent dans les **logs du backend**
- Voir: `docker logs extranet-backend` et chercher `[email]`
- Pour vraiment envoyer: configurer SMTP dans docker-compose.yml

---

## 📊 Vérifier le statut

```powershell
# Voir tous les conteneurs
docker ps -a

# Voir les logs d'un service
docker logs extranet-backend
docker logs extranet-frontend

# Exécuter une commande dans un conteneur
docker exec -it extranet-backend bash
```

---

## 🎯 Prochaines Étapes

Une fois lancé:

1. **Tester le login:** E001 / Test1234!@#$
2. **Tester l'email login:** jean.dupont@elc.com
3. **Créer un employé:** Employees → New
4. **Demander un congé:** Leaves → New
5. **Valider une demande:** Dashboard

Plus de détails → **TEST_CREDENTIALS.md**

---

Besoin d'aide ? 💬
