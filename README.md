# KickFlow

L'arène des défis eFootball : défis 1v1 entre joueurs, lobby, déclaration des scores, litiges arbitrés,
tournois, classement, amis, parrainage. Application web installable (PWA) sur Android, iPhone et ordinateur.

Un seul service : le serveur Node.js (`server/`) sert l'appli, l'API et le temps réel (WebSocket),
et stocke tout dans PostgreSQL.

## Déployer (wedeploy.tech ou tout hébergeur Docker)

Le `Dockerfile` à la racine construit et lance tout. Variables d'environnement à définir :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Base PostgreSQL. Utiliser le compte limité `kickflow_app` (voir `.env` local), pas `postgres`. |
| `JWT_SECRET` | oui | Clé secrète des sessions, 48 caractères aléatoires minimum (celle du `.env` local convient). |
| `ADMIN_EMAILS` | conseillé | Emails des arbitres, séparés par des virgules. |
| `DATABASE_SSL` | non | `true` si la base impose une connexion chiffrée. |
| `SIGNUP_BONUS` | non | XOF offerts à l'inscription (100 par défaut). |
| `PORT` | non | Port d'écoute (8787 par défaut ; souvent fourni par l'hébergeur). |
| `APP_URL` | conseillé | Adresse publique (ex. `https://kickflow.wedeploy.tech`), utilisée dans les liens des emails. |
| `PAYPLUS_BASE_URL`, `PAYPLUS_API_KEY`, `PAYPLUS_API_TOKEN` | requis pour les paiements | Identifiants PayPlus. Garder la clé et le jeton secrets ; les définir aussi dans l'environnement de production. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | conseillé | Notifications sur le téléphone. Générer avec `npx web-push generate-vapid-keys`. Sans elles, pas de notifications. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | conseillé | Envoi des emails « mot de passe oublié ». Sans eux, les liens sont écrits dans les logs du serveur. |

Au premier démarrage, les tables sont créées automatiquement, ainsi que les annonces et deux tournois d'exemple.
Vérification : `https://votre-domaine/api/health` doit répondre `{"ok":true}`.

Sans Docker : `npm ci && npm run build && npm start` (Node.js 22.18 ou plus récent).

⚠️ Le fichier `.env` contient les mots de passe : il est exclu de git, ne le publiez jamais.

## Développer en local

```bash
npm install
npm run dev:server   # serveur + API sur le port 8787 (lit .env)
npm run dev          # appli sur http://localhost:5173 (relaie /api et /ws vers le serveur)
```

Tester sur un téléphone du même Wi-Fi : `npm run dev -- --host`, puis ouvrir l'adresse « Network ».

## Arbitres

Un compte dont l'email figure dans `ADMIN_EMAILS` devient arbitre à sa prochaine connexion :
Profil → Mes disputes → « À arbitrer » → Trancher. La décision corrige automatiquement les XOF.

## Mot de passe oublié

Le joueur clique « Mot de passe oublié ? » et reçoit un lien valable 1 h (variables SMTP requises).
Sans SMTP configuré, le lien apparaît dans les logs du serveur. L'administrateur peut aussi forcer un mot de passe :

```bash
node --env-file=.env -e "import('./server/auth.ts').then(async m => { console.log(await m.adminResetPassword('joueur@email.com', 'nouveauMotDePasse')); process.exit() })"
```

## Fonctionnement

- **Comptes** : email + mot de passe (haché avec bcrypt), 18 ans minimum, session de 30 jours.
- **Défis** : la mise est bloquée à la création et à l'acceptation ; un défi non accepté expire et la mise est rendue.
- **Résultat** : chaque joueur déclare le score. S'ils concordent, le gagnant reçoit la cagnotte moins 20 % ;
  sinon un litige s'ouvre automatiquement. Le perdant a 5 minutes pour contester.
- **Sécurité** : toutes les règles s'exécutent sur le serveur dans des transactions verrouillées ; un joueur ne voit
  jamais l'email, le téléphone, le solde, les transactions ni le chat des autres.
- **Portefeuille XOF** : les montants sont directement en francs CFA BCEAO. Les dépôts et retraits passent par PayPlus ; un dépôt n'est crédité qu'après confirmation du fournisseur.
- **Streaming** : le streamer voit sa caméra ; la vidéo vers les spectateurs reste simulée.

## Structure

```
server/       serveur : index (API), logic (règles du jeu), auth, realtime, db, seed
src/lib/      types, cache temps réel (db), appels serveur (api), formats
src/services/ lecture des données + appels aux actions serveur
src/screens/  écrans
src/components/ éléments réutilisables
```
