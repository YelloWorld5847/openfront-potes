# Version potes

Fork d'OpenFront pour jouer entre amis, hébergé sur Render gratuit. Licence AGPL-3.0 : si le site est public, le code modifié doit rester public.

## Lancer en local

```powershell
npm ci --ignore-scripts
npm run dev
```

Puis http://localhost:9000. Node 24.15+ est demandé par le projet. Avec une version plus ancienne, ajouter `--engine-strict=false`.

## Déployer sur Render

1. Pousser ce dossier sur un dépôt GitHub à toi.
2. Render, New > Blueprint, choisir le dépôt. Le fichier `render.yaml` fait le reste.
3. L'URL est du type `https://openfront-potes.onrender.com`.

Le serveur tourne en mode `GAME_ENV=dev`. Dans ce mode il n'appelle pas l'API fermée d'OpenFront :
pas de Turnstile, pas d'abonnement ni de paiement pour lister un salon, pas de limite d'IP.
Les joueurs sont identifiés par un id local, sans compte.

Créer un salon privé ou le lister publiquement est gratuit. Le client bloque le multijoueur tant
que l'API répond mal, donc `src/server/StandaloneApi.ts` joue ce rôle depuis le serveur lui-même
(`/cluster.json`, `/users/@me`, `/cosmetics.json`, `/reserved_clan_tags`).

Skins : 12 motifs de territoire à nous, 7 palettes de couleurs, tous débloqués pour tout le monde.
Le catalogue est généré dans `src/server/FreeCosmetics.ts` (ajouter une entrée dans `PATTERNS` ou
`PALETTES`). Chaque navigateur reçoit un compte anonyme lié à un cookie, signé par
`src/server/StandaloneApi.ts`. Le dossier `proprietary/` reste sous droits réservés, on n'y touche pas.
Sur Render, `DOMAIN` doit être le nom public du site (déjà repris de `RENDER_EXTERNAL_HOSTNAME`).
En local, `npm run dev` lance aussi ce faux compte sur le port 8787.

## Rester éveillé

`src/server/KeepAlive.ts` appelle `/api/health` sur l'URL publique toutes les 10 minutes
(variable `RENDER_EXTERNAL_URL`, fournie par Render). Le plan gratuit offre 750 h par mois,
ce qui couvre un seul service allumé en continu. Si ça ne suffit pas, ajouter un ping externe
(UptimeRobot ou cron-job.org) sur `/api/health`.

## Où modifier quoi

| Je veux changer | Fichier |
| --- | --- |
| Cartes et modes des parties publiques automatiques | `src/server/MapPlaylist.ts` |
| Délai avant le départ d'une partie publique | `gameCreationRate` dans `src/server/ServerEnv.ts` et `src/client/ClientEnv.ts` |
| Nombre max de salons listés, taille max d'un salon | `MAX_HOSTED_LOBBIES` et `MAX_HOSTED_LOBBY_PLAYERS` dans `packages/shared/src/WireSchemas.ts` |
| Options d'un salon (or infini, construction instantanée, bots...) | menu "Créer un salon", filtrées côté serveur par `src/server/ConfigPatch.ts` |
| Règles du jeu (troupes, coûts, vitesses) | `packages/engine-lib/src/configuration/Config.ts` |
| Textes de l'interface | `resources/lang/en.json` (passer par `translateText()`) |

Le moteur est déterministe et tourne chez chaque joueur : toute modif de règles doit rester identique
pour tout le monde (pas de `Math.random`, voir `CLAUDE.md`). Tout le monde doit donc jouer la même version.
