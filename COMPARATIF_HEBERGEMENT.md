# Comparatif Hébergement — Elite Capital EMS
## Système de Gestion d'Entreprise (Enterprise Management System)
### Analyse complète : Hébergement local vs Cloud — 70 utilisateurs simultanés — MySQL 8.0 — Extranet à accès restreint par rôle

---

> **Stack technique confirmé (d'après le code source) :**
> - Backend : Python (FastAPI + SQLAlchemy + PyMySQL), port 8000
> - Frontend : JavaScript (React / Vite), port 5173
> - Base de données : MySQL 8.0 (EMS_DB) — 30+ tables relationnelles
> - Containerisation : Docker + Docker Compose (déjà configuré)
> - Sécurité existante : Audit log, blocage de compte, MFA (Multi-Factor Authentication — authentification à deux facteurs), RBAC (Role Based Access Control — contrôle d'accès par rôles)

---

## Lexique des abréviations utilisées

| Abréviation | Signification complète |
|---|---|
| CPU | Central Processing Unit — Unité centrale de traitement |
| RAM | Random Access Memory — Mémoire vive |
| DB | Database — Base de données |
| CDN | Content Delivery Network — Réseau de distribution de contenu |
| SLA | Service Level Agreement — Niveau de service garanti |
| HA | High Availability — Haute disponibilité |
| IAM | Identity and Access Management — Gestion des identités et des accès |
| WAF | Web Application Firewall — Pare-feu applicatif |
| DDoS | Distributed Denial of Service — Attaque par déni de service distribué |
| vCPU | Virtual Central Processing Unit — Processeur virtuel |
| IOPS | Input/Output Operations Per Second — Opérations d'entrée/sortie par seconde |
| VPN | Virtual Private Network — Réseau privé virtuel |
| RBAC | Role Based Access Control — Contrôle d'accès basé sur les rôles |
| 2FA | Two Factor Authentication — Authentification à deux facteurs |
| MFA | Multi-Factor Authentication — Authentification multi-facteurs |
| SSO | Single Sign-On — Authentification unique |
| VPC | Virtual Private Cloud — Nuage privé virtuel |
| TLS | Transport Layer Security — Protocole de chiffrement |
| JWT | JSON Web Token — Jeton d'authentification |
| RGPD | Règlement Général sur la Protection des Données |
| SSD | Solid-State Drive — Disque à état solide |
| MVP | Minimum Viable Product — Produit minimum viable |
| PME | Petites et Moyennes Entreprises |
| RDS | Relational Database Service — Service de base de données relationnelle (AWS) |
| EC2 | Elastic Compute Cloud — Serveur virtuel (AWS) |
| ECS | Elastic Container Service — Service de conteneurs (AWS) |
| EKS | Elastic Kubernetes Service — Service Kubernetes géré (AWS) |
| ELB | Elastic Load Balancer — Équilibreur de charge (AWS) |
| SES | Simple Email Service — Service d'envoi d'e-mails (AWS) |
| GCP | Google Cloud Platform — Plateforme cloud de Google |
| GKE | Google Kubernetes Engine — Service Kubernetes géré (GCP) |
| AKS | Azure Kubernetes Service — Service Kubernetes géré (Azure) |
| ACI | Azure Container Instances — Instances de conteneurs (Azure) |
| AD | Active Directory — Annuaire d'identités Microsoft |
| IAP | Identity-Aware Proxy — Proxy de contrôle d'accès par identité (GCP) |
| KMS | Key Management Service — Service de gestion des clés de chiffrement |
| SMTP | Simple Mail Transfer Protocol — Protocole d'envoi d'e-mails |
| HTTPS | HyperText Transfer Protocol Secure — Protocole web sécurisé |
| NAT | Network Address Translation — Traduction d'adresse réseau |

---

## TABLEAU 1 — Hébergement local (sur site) versus Hébergement cloud (nuage)

| Critère | Hébergement local (sur site / on-premise) | Hébergement cloud (nuage) |
|---|---|---|
| **Coût initial** | Élevé : achat serveur physique (500 € — 3 000 €), réseau, onduleur, climatisation, licences. Pour ton projet : serveur capable de faire tourner Docker + MySQL 8.0 + FastAPI + React coûte environ 800 € — 2 000 €. | Faible : aucun achat matériel. Paiement uniquement à l'usage chaque mois. Démarrage possible dès 15 € — 90 €/mois. |
| **Coût mensuel récurrent** | Électricité (30 € — 80 €/mois), maintenance, renouvellement matériel tous les 3 à 5 ans. Coût total sur 3 ans : 2 500 € — 7 000 €. | Paiement mensuel variable. Pour ton profil (70 utilisateurs simultanés, MySQL, FastAPI, React) : 80 € — 430 €/mois selon fournisseur. |
| **Coût total estimé sur 3 ans** | 3 000 € — 8 000 € (matériel + électricité + maintenance) | 2 880 € — 15 480 € (hyperscalers) / 2 880 € — 7 920 € (DigitalOcean / Infomaniak) |
| **Contrôle physique** | Contrôle total sur le matériel et la localisation exacte des données. Idéal si données très sensibles à garder dans les locaux. | Fournisseur gère le matériel. Tu contrôles configuration, accès logiques, et choix de région (ex : Europe). |
| **Sécurité** | Tu gères tout (pare-feu physique, mises à jour, sauvegardes). Ton application a déjà un audit log (AUDIT_LOG), blocage de compte (tentatives_echec, bloque_jusqua) et MFA. Très sécurisé si compétence disponible, risqué sinon. | Sécurité native intégrée (chiffrement, détection d'intrusion, WAF). Modèle partagé : fournisseur protège l'infrastructure, toi la configuration applicative. |
| **Maintenance** | Lourde : patchs manuels, remplacement matériel, surveillance 24h/24. Ton Docker Compose simplifie un peu, mais reste sur ta charge. | Réduite si services managés (base MySQL managée, sauvegardes automatiques). Ton Docker Compose peut être transposé directement. |
| **Scalabilité (montée en charge)** | Limitée par le matériel acheté. Pour passer de 70 à 200 utilisateurs simultanés : upgrade ou achat nouveau serveur. | Rapide et dynamique : autoscaling (mise à l'échelle automatique) disponible chez tous les grands fournisseurs. |
| **Disponibilité / Fiabilité** | Dépend de ta redondance locale. Sans onduleur et RAID (Redundant Array of Independent Disks — système de disques redondants), risque de coupure. HA coûteuse. | SLA de 99,9 % à 99,99 % chez la plupart des fournisseurs. Multi-zones disponible. |
| **Rapidité / Latence** | Faible latence si les 70 utilisateurs sont dans le même réseau local. Dégradée si accès via internet sans optimisation. | Très bonne si région proche des utilisateurs. CDN disponible pour les fichiers statiques (frontend React). |
| **Accessibilité distante (extranet)** | Nécessite VPN ou exposition publique avec NAT/Pare-feu. Configuration manuelle et délicate pour accès à distance sécurisé. | Accès global HTTPS natif, load balancer (équilibreur de charge), IAM, VPN ou Zero Trust (accès basé sur identité sans VPN) facilement configurables. |
| **Accès restreint par rôle (ton cas)** | Possible via ton système de rôles MySQL déjà en place (ROLE, EMPLOYE_ROLE). Mais l'exposition réseau distante est manuelle et complexe. | Idéal : combine ton RBAC applicatif existant + règles réseau cloud (groupes de sécurité, VPC). |
| **Conformité / Localisation des données** | Données dans tes locaux — localisation garantie. Idéal pour contraintes légales strictes. | Choix de région (ex : Europe Paris, Suisse Infomaniak). RGPD respecté si région EU choisie. |
| **Avantages clés** | Contrôle total, coût prévisible pour charge stable, indépendance fournisseur. | Agilité, services managés, sécurité native, montée en charge, accès distant facile. |
| **Inconvénients clés** | Investissement initial, maintenance lourde, accès distant complexe, peu d'agilité. | Coût variable, dépendance fournisseur, nécessité de bien configurer sécurité et accès. |

---

## TABLEAU 2 — Comparatif des fournisseurs cloud

> Configuration cible : Docker + FastAPI Python + React JavaScript + MySQL 8.0 + 70 utilisateurs simultanés

| Critère | Amazon Web Services (AWS) | Microsoft Azure | Google Cloud Platform (GCP) | DigitalOcean | OVHcloud | Infomaniak | Hostinger |
|---|---|---|---|---|---|---|---|
| **Estimation coût mensuel (EUR)** | 170 € — 430 € | 170 € — 430 € | 160 € — 420 € | 90 € — 220 € | 80 € — 220 € | 80 € — 200 € | 15 € — 80 € |
| **Estimation coût sur 3 ans (EUR)** | 6 120 € — 15 480 € | 6 120 € — 15 480 € | 5 760 € — 15 120 € | 3 240 € — 7 920 € | 2 880 € — 7 920 € | 2 880 € — 7 200 € | 540 € — 2 880 € |
| **Sécurité** | Très élevée : IAM, KMS, WAF, Shield (protection DDoS). Certifications ISO 27001, SOC 2, RGPD. | Très élevée : intégration Azure Active Directory (AD), bonnes certifications enterprise. | Élevée : IAM, VPC Service Controls, conformité forte. | Bonne : pare-feu, Managed DB sécurisée. Moins de certifications enterprise. | Bonne : data residency en Europe, options pare-feu. | Très bonne : axée vie privée, basée en Suisse/Europe, conforme RGPD. | Basique : VPS exposé, à toi de sécuriser. Peu de certifications. |
| **Support MySQL 8.0 managé** | Amazon RDS for MySQL 8.0 — sauvegarde, réplication, patch automatiques. | Azure Database for MySQL — Flexible Server. | Cloud SQL for MySQL 8.0. | Managed MySQL (MySQL 8.0 supporté). | Managed DB (CloudDB). | MySQL via VPS ou hébergement managé. | MySQL sur VPS (non managé — à gérer soi-même). |
| **Compatibilité Docker / Docker Compose** | Oui : ECS, EKS, ou EC2 avec Docker Compose directement. | Oui : ACI, AKS, ou VM avec Docker. | Oui : Cloud Run, GKE, ou VM avec Docker. | Oui : Droplets (VM) avec Docker Compose directement — le plus simple. | Oui : VPS ou Cloud Public avec Docker Compose. | Oui : VPS avec Docker Compose. | Oui : VPS avec Docker Compose (installation manuelle). |
| **Performance et scalabilité** | Excellente : autoscaling, régions mondiales, large choix d'instances. | Très bonne : comparable à AWS. | Très bonne : réseau excellent, fort sur conteneurs. | Très bonne pour petites/moyennes charges. | Bonne en Europe. | Bonne en Europe, adaptée PME. | Limitée : VPS fixe, pas d'autoscaling. |
| **Facilité déploiement Docker Compose** | Modérée : nécessite apprentissage (console complexe). | Modérée : interface riche mais courbe d'apprentissage. | Modérée : bonne pour développeurs. | Très facile : dépose ton Docker Compose sur un Droplet, ça tourne. | Facile : interface claire. | Facile : interface conviviale. | Facile mais limité : tout faire manuellement. |
| **Accessibilité distante / extranet** | Excellente : load balancer, IAM, VPN, Zero Trust. | Excellente : intégration Active Directory idéale pour extranet entreprise. | Très bonne : IAP (Identity-Aware Proxy — proxy de contrôle d'accès par identité). | Bonne : pare-feu réseau, accès HTTPS, load balancer disponible. | Bonne : pare-feu, IP fixe, load balancer. | Bonne : IP fixe, HTTPS, pare-feu. | Basique : accès HTTP/HTTPS direct, peu d'options avancées. |
| **Disponibilité / SLA garanti** | 99,99 % (multi-zones disponibles) | 99,99 % | 99,99 % | 99,99 % (load balancer inclus) | 99,9 % | 99,9 % | 99,9 % (non garanti sur VPS partagé) |
| **Localisation données (Europe)** | Région eu-west-3 Paris disponible | Région France Central disponible | Région europe-west9 Paris disponible | Régions Amsterdam (AMS3), Frankfurt (FRA1) | Hébergement France/Europe (Strasbourg, Roubaix) | Suisse (Geneva) et Europe — forte garantie vie privée | Hébergement Europe disponible |
| **Idéal pour** | Grandes entreprises, montée en charge massive, conformité stricte. | Organisations utilisant Microsoft / Active Directory. | Startups, apps conteneurisées, traitement de données. | Projets en croissance, développeurs, budget modéré. | Projets européens sensibles à la localisation des données. | Organisations EU cherchant confidentialité et simplicité. | Sites simples, budget très serré. |
| **Points faibles** | Tarification complexe, risque coûts surprises, courbe d'apprentissage. | Facturation parfois opaque, complexité de gestion. | Écosystème moins large que AWS pour certains services. | Moins d'outils enterprise, support professionnel payant. | Documentation moins centralisée que hyperscalers. | Moins de services managés avancés qu'AWS/GCP. | Pas adapté à la production critique ni à la haute disponibilité. |

---

## TABLEAU 3 — Ventilation détaillée des coûts par fournisseur

> Hypothèses basées sur le code source du projet :
> - 2 conteneurs applicatifs : backend FastAPI (Python) port 8000 + frontend React (JavaScript/Vite) port 5173
> - Base MySQL 8.0 (EMS_DB) : 30+ tables, estimé 10 — 30 Go initial
> - 70 utilisateurs simultanés → environ 50 — 80 requêtes/seconde au pic
> - Fichiers téléversés (justificatifs missions, preuves permissions) : 20 — 50 Go stockage objet
> - Sortie réseau (egress — trafic sortant) : 200 — 300 Go/mois
> - Sauvegardes automatisées MySQL (backup-db.ps1 déjà présent dans le repo)
> - Redondance minimale : 2 instances applicatives

| Poste de dépense | Description | AWS (EUR/mois) | Azure (EUR/mois) | GCP (EUR/mois) | DigitalOcean (EUR/mois) | OVHcloud (EUR/mois) | Infomaniak (EUR/mois) | Hostinger (EUR/mois) |
|---|---|---|---|---|---|---|---|---|
| **Instance backend FastAPI (Python) × 2** | 2 serveurs virtuels 2 vCPU / 4 Go RAM — pour FastAPI + Uvicorn + scheduler (tâches automatiques quotidiennes) | 40 € — 80 € | 40 € — 90 € | 38 € — 80 € | 28 € — 48 € | 20 € — 50 € | 20 € — 50 € | 8 € — 20 € |
| **Instance frontend React (JavaScript/Vite)** | 1 serveur virtuel 1 vCPU / 2 Go RAM — ou service d'hébergement statique si frontend compilé | 10 € — 20 € | 10 € — 20 € | 8 € — 18 € | 6 € — 12 € | 5 € — 12 € | 5 € — 10 € | 2 € — 5 € |
| **MySQL 8.0 managé (EMS_DB)** | Base managée 2 vCPU / 8 Go RAM, stockage SSD 100 Go, sauvegardes automatiques, réplication | 60 € — 150 € | 60 € — 150 € | 58 € — 145 € | 40 € — 80 € | 35 € — 80 € | 35 € — 80 € | Non managé — VPS MySQL 5 € — 20 € |
| **Stockage objet (justificatifs, rapports, preuves)** | Fichiers téléversés via API (missions, permissions) — 50 Go | 1 € — 5 € | 1 € — 5 € | 1 € — 4 € | 5 € (forfait Spaces) | 2 € — 8 € | 2 € — 8 € | Non disponible (stockage local VPS) |
| **Sortie réseau (egress) — 300 Go/mois** | Trafic sortant vers navigateurs des 70 utilisateurs | 20 € — 60 € | 20 € — 60 € | 18 € — 55 € | Inclus dans forfait | 5 € — 20 € | Inclus / faible | Inclus dans VPS |
| **Équilibreur de charge (load balancer) + IP fixe + TLS/SSL** | Répartit le trafic entre les 2 instances backend, certificat HTTPS | 15 € — 30 € | 15 € — 35 € | 15 € — 30 € | 10 € | 5 € — 15 € | 5 € — 15 € | Non disponible managé |
| **Sauvegardes (backups)** | Sauvegardes automatiques DB + volumes (remplace backup-db.ps1 existant) | 5 € — 20 € | 5 € — 20 € | 5 € — 18 € | 3 € — 10 € | 3 € — 10 € | 3 € — 10 € | Manuel / inclus VPS |
| **Monitoring + logs + alertes** | Surveillance CPU/RAM/requêtes/erreurs, alertes si dépassement ou panne | 10 € — 30 € | 10 € — 30 € | 8 € — 25 € | 0 € — 8 € (basique inclus) | 0 € — 10 € | 0 € — 10 € | Non disponible managé |
| **E-mail transactionnel (SMTP)** | Alertes congés, validations, rappels missions. Actuellement Gmail SMTP dans docker-compose — remplacement recommandé. | 5 € — 15 € (Amazon SES) | 5 € — 15 € | 3 € — 10 € | 0 € (SendGrid externe) | 5 € — 10 € | Inclus offre e-mail | 2 € — 5 € |
| **TOTAL MENSUEL ESTIMÉ** | | **170 € — 430 €** | **170 € — 430 €** | **160 € — 420 €** | **90 € — 220 €** | **80 € — 220 €** | **80 € — 200 €** | **15 € — 80 €** |
| **TOTAL SUR 3 ANS ESTIMÉ** | | **6 120 € — 15 480 €** | **6 120 € — 15 480 €** | **5 760 € — 15 120 €** | **3 240 € — 7 920 €** | **2 880 € — 7 920 €** | **2 880 € — 7 200 €** | **540 € — 2 880 €** |

---

## TABLEAU 4 — Sécurité et contrôle d'accès restreint (extranet — certains rôles seulement)

| Objectif de sécurité | Mesure recommandée | Existant dans le projet | À ajouter en production |
|---|---|---|---|
| **Authentification** | Authentification par identifiant + mot de passe hashé (chiffré) | ✅ UTILISATEUR.mot_de_passe_hash déjà en base | ✅ Activer MFA : champ mfa_active déjà en base, à activer en prod |
| **Blocage de compte** | Blocage après plusieurs tentatives échouées | ✅ tentatives_echec + bloque_jusqua déjà en base et dans l'API | ✅ Vérifier que le mécanisme est bien activé en prod |
| **Contrôle d'accès par rôle (RBAC)** | Seuls certains rôles peuvent accéder à l'extranet et à certaines fonctions | ✅ Tables ROLE, EMPLOYE_ROLE, id_role dans EMPLOYE | ✅ Vérifier que chaque endpoint API vérifie le rôle avant de répondre |
| **Traçabilité / Audit** | Journalisation de toutes les actions sensibles | ✅ Table AUDIT_LOG avec ip, action, table_cible, ancienne et nouvelle valeur | ✅ S'assurer que toutes les actions sensibles sont bien loguées |
| **Mot de passe temporaire** | Forcer le changement de mot de passe au premier login | ✅ mot_de_passe_temporaire + endpoint force-change déjà en place | ✅ Vérifier que le frontend redirige bien vers le formulaire de changement |
| **Chiffrement en transit** | HTTPS/TLS obligatoire | ❌ En local : HTTP uniquement (localhost) | ✅ Configurer certificat TLS via Let's Encrypt (gratuit) ou fournisseur cloud |
| **Isolation réseau** | MySQL non exposé publiquement | ✅ En Docker Compose : MySQL accessible uniquement par le backend via réseau interne Docker | ✅ En cloud : placer MySQL dans un VPC sans IP publique |
| **Protection applicative** | WAF contre injections, attaques web | ❌ Non présent actuellement | ✅ Ajouter WAF via fournisseur cloud (AWS WAF, Cloudflare gratuit possible) |
| **Accès distant sécurisé** | VPN ou Zero Trust pour utilisateurs distants | ❌ Non présent | ✅ Option 1 : VPN (WireGuard, OpenVPN). Option 2 : Zero Trust (Cloudflare Access — gratuit jusqu'à 50 utilisateurs) |
| **Gestion des secrets** | Pas de mots de passe en clair dans le code | ⚠️ Secrets visibles en clair dans docker-compose.yml (MYSQL_ROOT_PASSWORD, SECRET_KEY) | ✅ Utiliser variables d'environnement chiffrées ou secrets manager hors dépôt Git |
| **Sauvegardes chiffrées** | Sauvegardes automatiques de MySQL | ✅ Script backup-db.ps1 présent dans le repo | ✅ En cloud : utiliser service de backup managé avec chiffrement et rotation automatique |
| **Notifications sécurité** | Alertes en cas d'accès anormal | ⚠️ Système de notification existant mais axé métier | ✅ Ajouter alertes de sécurité (trop d'échecs login, IP inconnue) via monitoring cloud |

---

## TABLEAU 5 — Architecture recommandée et correspondance des services par fournisseur

| Composant | Rôle dans le projet | AWS | Azure | GCP | DigitalOcean | OVHcloud | Infomaniak | Hostinger |
|---|---|---|---|---|---|---|---|---|
| **Backend FastAPI (Python)** | API REST, scheduler automatique, gestion des rôles, authentification JWT | EC2 ou ECS | App Service ou VM avec Docker | Cloud Run ou Compute Engine | Droplet (VM) avec Docker Compose | VPS ou Cloud Public | VPS | VPS |
| **Frontend React/Vite (JavaScript)** | Interface utilisateur, tableau de bord, formulaires | S3 + CloudFront (CDN) ou EC2 | Static Web Apps ou Azure CDN | Cloud Storage + CDN ou Compute Engine | Droplet ou App Platform | VPS + CDN option | VPS ou hébergement web | Hébergement web |
| **MySQL 8.0 (EMS_DB)** | Base de données relationnelle — 30+ tables | Amazon RDS for MySQL 8.0 | Azure Database for MySQL Flexible Server | Cloud SQL for MySQL 8.0 | Managed MySQL Database | CloudDB (Managed DB) | MySQL managé ou VPS MySQL | MySQL sur VPS (non managé) |
| **Stockage fichiers** | Justificatifs missions, preuves permissions, rapports téléversés | Amazon S3 | Azure Blob Storage | Google Cloud Storage | Spaces (Object Storage) | Object Storage | kDrive ou Object Storage | Stockage VPS local |
| **Équilibreur de charge (load balancer)** | Répartir trafic entre 2 instances backend pour haute disponibilité | Elastic Load Balancer (ELB) | Azure Load Balancer | Cloud Load Balancing | Load Balancer (10 €/mois) | Load Balancer | Load Balancer | Non disponible managé |
| **CDN (réseau de distribution de contenu)** | Accélérer chargement du frontend React (fichiers statiques) | Amazon CloudFront | Azure CDN | Cloud CDN | Cloudflare (gratuit) | CDN option | CDN option | Cloudflare (externe, gratuit) |
| **Certificat TLS/HTTPS** | Chiffrer communications navigateur vers serveur | AWS Certificate Manager (gratuit avec load balancer) | Azure App Gateway | Google Managed SSL | Let's Encrypt (gratuit) | Let's Encrypt (gratuit) | Inclus | Let's Encrypt (manuel) |
| **Gestion des secrets** | Stocker SECRET_KEY, MYSQL_ROOT_PASSWORD hors du code | AWS Secrets Manager | Azure Key Vault | Secret Manager | Variables d'environnement chiffrées | Variables d'environnement | Variables d'environnement | Fichier .env (manuel) |
| **E-mail transactionnel (SMTP)** | Alertes congés, validations, rappels missions | Amazon SES (Simple Email Service) | Azure Communication Services | SendGrid (partenaire GCP) | SendGrid (partenaire externe) | Infomaniak Mail | Infomaniak Mail (inclus) | Hébergement mail inclus |
| **Monitoring + alertes** | Surveiller CPU, RAM, requêtes/seconde, erreurs FastAPI | Amazon CloudWatch | Azure Monitor | Cloud Monitoring | Monitoring intégré + Alertes | Monitoring et Métriques | Monitoring / Logs | Non disponible managé |
| **Sauvegardes automatiques** | Remplacer backup-db.ps1 par service managé | RDS Automated Backups | Azure Automated Backups | Cloud SQL Backups | Managed DB Backups automatiques | Snapshot automatique | Backup automatique | Manuel / snapshot VPS |
| **Pare-feu applicatif (WAF)** | Protéger l'API FastAPI contre injections SQL, attaques OWASP | AWS WAF | Azure WAF | Cloud Armor | Cloudflare (externe, gratuit) | Pare-feu option | Cloudflare (externe, gratuit) | Non disponible |

---

## TABLEAU 6 — Recommandation finale par profil et priorité

| Priorité | Profil correspondant | Fournisseur recommandé | Configuration optimale | Coût mensuel estimé |
|---|---|---|---|---|
| **Coût minimal (prototype / MVP)** | Budget serré, fonctionnalités de base, utilisateurs internes seulement | Hostinger VPS | 1 VPS 4 vCPU / 8 Go RAM, MySQL auto-hébergé, Docker Compose direct | 15 € — 50 €/mois |
| **Équilibre coût / performance / simplicité** | Projet en croissance, équipe petite, accès distant sécurisé, MySQL managé | **DigitalOcean** ✅ | 2 Droplets 2 vCPU / 4 Go RAM + Managed MySQL 2 vCPU / 8 Go + Load Balancer + Spaces 50 Go | **90 € — 150 €/mois** |
| **Priorité vie privée / données Europe** | Contraintes RGPD, données sensibles (fiches employés, évaluations, audit), localisation Suisse/EU | **Infomaniak** ✅ | 2 VPS/Cloud + MySQL managé + stockage + e-mail inclus | **80 € — 160 €/mois** |
| **Performance + conformité + montée à l'échelle** | Forte croissance utilisateurs, audit sécurité requis, SLA garanti | AWS eu-west-3 (Paris) | EC2 t3.medium × 2 + RDS MySQL db.t3.medium + S3 + ELB + CloudWatch | 200 € — 350 €/mois |
| **Intégration Microsoft / Active Directory existant** | Si organisation déjà sous Microsoft 365 ou Active Directory | Microsoft Azure | App Service + Azure Database for MySQL + Azure AD pour SSO | 180 € — 380 €/mois |
| **Meilleure option globale pour l'extranet Elite Capital** | Extranet restreint, 70 utilisateurs simultanés, Docker Compose prêt, budget raisonnable | **DigitalOcean ou Infomaniak** ✅ | Voir lignes ci-dessus | **80 € — 160 €/mois** |

---

## TABLEAU 7 — Plan d'action prioritaire pour la mise en production

| Étape | Action | Priorité | Statut dans le projet |
|---|---|---|---|
| 1 | Déployer sur **DigitalOcean** ou **Infomaniak** avec Docker Compose existant | 🔴 Immédiate | Docker Compose prêt ✅ |
| 2 | Activer **HTTPS/TLS** (Let's Encrypt gratuit) sur frontend et backend | 🔴 Immédiate | Non configuré ❌ |
| 3 | Sortir les **secrets** du docker-compose.yml (MYSQL_ROOT_PASSWORD, SECRET_KEY) vers fichier .env chiffré hors Git | 🔴 Immédiate | Secrets en clair ⚠️ |
| 4 | Activer **MFA** pour les rôles ayant accès distant à l'extranet | 🟠 Avant ouverture | Champ mfa_active en base ✅ — à activer |
| 5 | Configurer **Cloudflare** (gratuit) devant l'application pour CDN + WAF + protection DDoS | 🟠 Avant ouverture | Non configuré ❌ |
| 6 | Remplacer **Gmail SMTP** par service dédié (Infomaniak Mail ou Amazon SES) | 🟡 Recommandé | Gmail SMTP configuré ⚠️ |
| 7 | Mettre en place **sauvegardes automatiques** MySQL managées (remplace backup-db.ps1 manuel) | 🟡 Recommandé | Script manuel existant ⚠️ |
| 8 | Ajouter **monitoring** (alerte CPU > 80 %, erreurs API, tentatives de connexion échouées) | 🟡 Recommandé | Non configuré ❌ |

---

*Document généré automatiquement par GitHub Copilot — Projet Elite Capital EMS*
*Date de génération : Avril 2026*
*Basé sur l'analyse du code source : docker-compose.yml, DATABASE_SCHEMA.sql, API_ENDPOINTS.md