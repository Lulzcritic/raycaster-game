# 🚀 Guide de Déploiement Continu Automatique (CI/CD)

Ce projet utilise **GitHub Actions** pour le déploiement continu :
1. **Tests & Build automatisés** sur le cloud GitHub (`ubuntu-latest`).
2. **Déploiement direct sur votre serveur** via le **Runner GitHub officiel** (`runs-on: self-hosted`).

Grâce au Runner officiel GitHub :
- **0 port à ouvrir sur votre box** (pas besoin de rediriger le port 22 ni 2222).
- **Aucun risque de timeout ou de blocage opérateur**.
- **Aucune clé SSH ni mot de passe à stocker dans GitHub Secrets**.
- Le déploiement s'exécute localement à la vitesse maximale.

---

## 1. Installation du Runner GitHub sur votre Serveur (2 minutes)

Sur votre machine Linux (`lulz@lulzserv`) :

### A. Obtenir le script d'installation officiel
1. Dans votre navigateur, rendez-vous sur votre dépôt GitHub :
   👉 **Settings** ➔ **Actions** ➔ **Runners**
2. Cliquez sur le bouton vert **"New self-hosted runner"**.
3. Sélectionnez **Linux** (Architecture: **x64**).

### B. Copier-coller les commandes dans votre terminal Linux
GitHub vous génère automatiquement les commandes avec votre jeton temporaire personnel.
Exécutez-les simplement dans votre terminal :

```bash
# 1. Créer le dossier du runner
mkdir actions-runner && cd actions-runner

# 2. Télécharger le package officiel (utilisez le lien fourni par GitHub)
curl -o actions-runner-linux-x64.tar.gz -L <LIEN_FOURNI_PAR_GITHUB>
tar xzf ./actions-runner-linux-x64.tar.gz

# 3. Configurer le runner (GitHub vous donne le token pré-rempli)
./config.sh --url https://github.com/Lulzcritic/raycaster-game --token <VOTRE_TOKEN_GITHUB>
```
*(Appuyez sur Entrée pour accepter les valeurs par défaut lorsqu'il demande le nom du runner).*

### C. Activer le service en arrière-plan (permanent)
Pour que le runner reste toujours actif même après un redémarrage du serveur :
```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

---

## 2. Déploiement Automatique

C'est tout ! Dès que vous faites :
```bash
git push origin main
```
1. GitHub lance les tests et vérifie le build.
2. Votre serveur reçoit instantanément l'ordre de déploiement via GitHub.
3. Le serveur met à jour le code, reconstruit les conteneurs Docker et vérifie `/health`.
