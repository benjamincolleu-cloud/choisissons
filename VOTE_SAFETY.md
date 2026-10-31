# VOTE_SAFETY — Filet de sécurité du système de vote

## Ce que ce système protège

Le vote citoyen est la fonctionnalité la plus critique de l'app. Ce filet de sécurité
empêche tout déploiement si le vote est cassé.

---

## Fonctionnement en une phrase

`git push` → tests de vote → si OK → déploiement Vercel. Si les tests échouent, **rien n'est déployé**.

---

## Setup initial (à faire une seule fois)

### 1. Créer le fichier `.env.test` localement

```bash
cp tests/.env.test.example .env.test
```

Puis remplis les valeurs dans `.env.test` :

| Variable | Où la trouver |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role **(secret)** |

> ⚠️ `.env.test` est dans `.gitignore` — il ne sera jamais commité.

### 2. Tester localement

```bash
npm run test:vote
```

Tu dois voir 8 tests verts. Si l'un est rouge, ne pousse rien.

### 3. Configurer les secrets GitHub

Va sur : **GitHub → ton repo → Settings → Secrets and variables → Actions → New repository secret**

Ajoute ces secrets :

| Nom du secret | Valeur |
|---|---|
| `SUPABASE_URL` | L'URL de ton projet Supabase |
| `SUPABASE_ANON_KEY` | La clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | La clé service_role Supabase **(secrète)** |
| `VITE_SUPABASE_URL` | Même valeur que `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Même valeur que `SUPABASE_ANON_KEY` |
| `VERCEL_TOKEN` | Voir étape 4 ci-dessous |
| `VERCEL_ORG_ID` | Voir étape 4 ci-dessous |
| `VERCEL_PROJECT_ID` | Voir étape 4 ci-dessous |

### 4. Récupérer les IDs Vercel

**Token Vercel :**
- Va sur https://vercel.com/account/tokens
- Crée un token nommé "GitHub Actions CI"
- Copie-le dans le secret `VERCEL_TOKEN`

**Org ID et Project ID :**
```bash
# Dans le dossier du projet :
npx vercel link
# Réponds aux questions (connecte-toi si demandé)
# Puis :
cat .vercel/project.json
# → tu vois orgId et projectId
```

Mets `orgId` dans `VERCEL_ORG_ID` et `projectId` dans `VERCEL_PROJECT_ID`.

### 5. Désactiver l'auto-deploy Vercel natif

Vercel ne doit plus déployer tout seul — c'est GitHub Actions qui s'en charge.

- Va sur https://vercel.com → ton projet → Settings → Git
- Section **"Connected Git Repository"** → clique sur **Disconnect** ou désactive les déploiements automatiques

> Le fichier `vercel.json` contient déjà `"github": { "enabled": false }` qui fait ça automatiquement quand Vercel relit la config.

---

## Utilisation quotidienne

### Push normal → pipeline automatique

```
git push origin main
    ↓
GitHub Actions se lance
    ↓
(2 comptes citoyens temporaires + 1 loi de test, supprimés à la fin)
Test 1 : un visiteur non connecté ne peut pas voter
Test 2 : un citoyen connecté vote → compté, identifiant calculé par la base
Test 3 : vote définitif → le même citoyen ne peut pas revoter
Test 4 : impossible de voter à la place d'un autre
Test 5 : un choix invalide est refusé
Test 6 : « Mes votes » ne renvoie que les votes du compte connecté
Test 7 : personne ne modifie les compteurs directement
Test 8 : personne n'écrit directement dans le registre ou l'urne
    ↓
Si tous OK → build → déploiement Vercel production
Si un test FAIL → arrêt → Vercel ne se lance PAS
```

### Lancer les tests manuellement

```bash
npm run test:vote           # run une fois
npm run test:vote:watch     # mode watch (relance à chaque sauvegarde)
```

---

## Fonctions de vérification en base

> ⚠️ Depuis le 30/10/2026, `check_vote_rls()` est obsolète (elle contrôle l'ancienne politique de mise à jour, supprimée pour la sécurité). Les tests ci-dessus vérifient directement le comportement du vote.

Tu peux vérifier les garde-fous à tout moment dans Supabase SQL Editor :

```sql
-- Vérifie tout en une requête
SELECT check_vote_rls();

-- Résultat attendu :
-- {
--   "parliamentary_laws_has_update_policy": true,
--   "deposer_bulletin_has_row_security_off": true,
--   "urne_electronique_rls_enabled": true,
--   "registre_scrutin_rls_enabled": true,
--   "checked_at": "2026-06-07T..."
-- }
```

Si une valeur est `false` → quelque chose a cassé les garde-fous.

---

## Ce qui est protégé dans la base

### `deposer_bulletin` (fonction critique)
Commentaire visible dans Supabase → Database → Functions :
> *"SET row_security = off est OBLIGATOIRE — sans lui, les UPDATE sur parliamentary_laws.votes_pour/contre/blanc sont silencieusement bloqués par RLS"*

### `parliamentary_laws` — politique UPDATE
Commentaire sur la politique "Update votes compteurs" :
> *"Sans cette politique UPDATE, deposer_bulletin ne peut pas incrémenter votes_pour/votes_contre/votes_blanc"*

---

## Pourquoi ce système existe

Le vote était cassé 2 fois de suite :
1. Le frontend lisait la colonne JSONB `votes` (jamais mise à jour) au lieu de `votes_pour/contre/blanc`
2. La politique RLS UPDATE était absente → les UPDATE étaient bloqués silencieusement
3. `SET row_security = off` manquait dans `deposer_bulletin`

Ces 3 bugs ont été corrigés le 2026-06-07. Ce filet de sécurité empêche leur réapparition.
