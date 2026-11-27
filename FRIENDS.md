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

## Modificateurs chaos

Les parties automatiques ("spéciales") tirent au hasard 1 à 3 modificateurs, qui se combinent avec ceux d'origine, et au moins un des nôtres à chaque fois.
Les nôtres ont un badge orange dans la liste des parties.
On peut aussi les activer dans un salon privé (Advanced settings) et en Solo.

| Modificateur         | Ce que ça fait                                                                                                                                             | Réglages                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Volcan               | un joueur "Volcan" (rouge lave) apparaît à 3 min sur une zone vide et envoie une vague d'attaque toutes les 45 s. On le combat comme n'importe quel joueur | `VolcanoExecution.ts` (délais, taille des vagues), dessin dans `src/client/controllers/VolcanoMarkerController.ts` |
| Contrats secrets     | chaque joueur reçoit en privé un objectif (3 ports, 4 villes, un silo, 3 navires de guerre, 5 % des terres) et 250 000 d'or à la clé                       | `ContractsExecution.ts` (liste `CONTRACTS`, `REWARD`)                                                              |
| Marché noir          | toutes les 4 minutes environ, un événement change tous les revenus d'or : x2, x3 ou /2 pendant 40 à 60 s, annoncé à tous                                   | `BlackMarketExecution.ts` (liste `DEALS`)                                                                          |
| Trésors cachés       | de petites parcelles dorées gardées par des troupes, à prendre comme n'importe quel territoire pour gagner de l'or (150 000, 400 000 ou 1 000 000)         | `TreasureExecution.ts` (liste `TIERS`)                                                                             |
| Brouillard de guerre | la carte est sombre hors de ton territoire, de celui de tes alliés et de tes unités. C'est un effet d'affichage, pas une protection contre la triche       | `src/client/controllers/FogController.ts`                                                                          |

La fréquence de chaque modificateur se règle dans `SPECIAL_MODIFIER_POOL` (`src/server/MapPlaylist.ts`) : plus il y a de lignes, plus il sort souvent.
Pour en forcer sur toutes les parties spéciales, par exemple en test : `FORCE_MODIFIERS=isFog,isTreasures` (noms dans `ModifierKey`).

## Gros budget : silos turbo et envois en masse

Deux options pour les parties perso avec beaucoup d'or (salon privé, Advanced settings, ou Solo). Elles ne sortent pas dans les parties automatiques.

- **Silos turbo** : la recharge d'un silo diminue avec son niveau (9 s au niveau 1, 1,5 s au niveau 11, jamais moins de 1 s). Un niveau de silo est aussi le nombre de missiles qui peuvent partir en parallèle : améliorer un silo coûte de l'or et fait les deux. Formule dans `SiloCooldown` (`packages/engine-lib/src/configuration/Config.ts`).
- **Envois en masse** : un panneau à gauche de l'écran (`src/client/controllers/MassOrdersController.ts`) avec la quantité par ordre (x1 à x50), ce qu'on place (silo, ville, bombe atomique, bombe H), "maintenir pour répéter" et "améliorer tous les silos / toutes les villes". Une bombe cliquée avec x25 en lance 25 d'un coup. En maintenant le clic, le placement se répète à chaque case survolée ; sur une case qui a déjà un bâtiment, ça l'améliore. La limite de débit des ordres est multipliée par 20 dans ces parties (`ClientMsgRateLimiter.ts`).

## En local sous Windows

Docker peut réserver des ports, dont 8787, que le faux compte de `npm run dev` utilise. Si l'API locale ne démarre pas, lance avec `DEV_API_PORT=9150` (par exemple `DEV_API_PORT=9150 npm run dev`) et, dans la console du navigateur, `localStorage.setItem("apiHost", "http://localhost:9150")`.

## Où modifier quoi

| Je veux changer                                                   | Fichier                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cartes et modes des parties publiques automatiques                | `src/server/MapPlaylist.ts`                                                                  |
| Délai avant le départ d'une partie publique                       | `gameCreationRate` dans `src/server/ServerEnv.ts` et `src/client/ClientEnv.ts`               |
| Nombre max de salons listés, taille max d'un salon                | `MAX_HOSTED_LOBBIES` et `MAX_HOSTED_LOBBY_PLAYERS` dans `packages/shared/src/WireSchemas.ts` |
| Options d'un salon (or infini, construction instantanée, bots...) | menu "Créer un salon", filtrées côté serveur par `src/server/ConfigPatch.ts`                 |
| Règles du jeu (troupes, coûts, vitesses)                          | `packages/engine-lib/src/configuration/Config.ts`                                            |
| Textes de l'interface                                             | `resources/lang/en.json` (passer par `translateText()`)                                      |

Le moteur est déterministe et tourne chez chaque joueur : toute modif de règles doit rester identique
pour tout le monde (pas de `Math.random`, voir `CLAUDE.md`). Tout le monde doit donc jouer la même version.
