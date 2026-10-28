# 🚀 Guide de Déploiement Continu Automatique (CI/CD)

Ce projet dispose d'un pipeline d'intégration et de déploiement continu (**GitHub Actions**) qui :
1. **Passe les tests et le build** sur chaque push (`main`).
2. **Se connecte en SSH** à votre serveur Linux avec Docker.
3. **Met à jour le code**, **reconstruit l'image Docker** et **redémarre le serveur** sans interruption.
4. **Valide le démarrage** via le healthcheck HTTP `/health`.

---

## 1. Configuration Initiale sur votre Serveur Linux

Si ce n'est pas déjà fait sur votre serveur distant :

### A. Installer Docker & Docker Compose
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```
*(Déconnectez-vous puis reconnectez-vous au SSH pour appliquer les permissions Docker).*

### B. Cloner le projet une première fois
```bash
cd ~
git clone https://github.com/Lulzcritic/raycaster-game.git
cd raycaster-game
```

---

## 2. Configuration des Secrets GitHub

Dans votre dépôt GitHub, rendez-vous dans :
👉 **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret**

Ajoutez les secrets suivants :

| Secret | Description | Exemple |
| :--- | :--- | :--- |
| `SSH_HOST` | Adresse IP publique ou nom de domaine de votre serveur | `51.15.20.123` ou `game.mondomaine.com` |
| `SSH_USER` | Utilisateur SSH de connexion | `ubuntu` ou `debian` ou `root` |
| `SSH_KEY` | Contenu de la **clé privée SSH** (`~/.ssh/id_rsa` ou `id_ed25519`) | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |
| `SSH_PORT` *(optionnel)* | Port SSH de votre serveur (défaut : 22) | `22` |
| `SERVER_PATH` *(optionnel)* | Chemin absolu du dossier sur le serveur (défaut : `~/raycaster-game`) | `/home/ubuntu/raycaster-game` |

> [!TIP]
> **Créer une clé SSH dédiée au déploiement (recommandé) :**
> ```bash
> ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
> cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
> ```
> * Copiez le contenu de `~/.ssh/github_deploy` dans le secret GitHub `SSH_KEY`.
> * La clé publique est déjà autorisée dans `~/.ssh/authorized_keys`.

---

## 3. Fonctionnement Automatique

Dès que vous effectuez un push sur la branche `main` :
1. **GitHub Actions** déclenche le workflow `.github/workflows/deploy.yml`.
2. Le job **`test`** installe les dépendances, compile le code TypeScript + Vite (`npm run build`) et passe les tests automatisés (`npm test`).
3. Si tous les tests sont au vert, le job **`deploy`** prend le relais, met à jour le serveur via Docker Compose et vérifie que le port `3001` répond `{"status":"ok"}`.
4. Votre jeu est immédiatement accessible et jouable sur `http://<VOTRE-IP-OU-DOMAINE>:3001` !
