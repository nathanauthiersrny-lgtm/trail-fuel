# Trail Fuel — Projet Claude Code

Structure prête pour démarrer le projet avec Claude Code en CLI.

## Fichiers fournis

- **`CLAUDE.md`** — Contexte persistent chargé à chaque session. Court (~100 lignes), pointe vers le reste.
- **`doc.md`** — Doc produit complète (scope, modèle de données, moteur de planning, flow user). La référence.
- **`.claude/skills/`** — Quatre skills domain-specific chargés à la demande :
  - `nutrition-rules/` — Règles métier (besoins, modificateurs, règles de terrain)
  - `gpx-tobler/` — Parsing GPX, Haversine, Tobler, calibration
  - `expo-notifications-android/` — Notifs locales, batch, actions, pièges Android
  - `planning-engine/` — Algo de génération du planning

## Comment l'utiliser

### 1. Mise en place

```bash
# Déposer ces fichiers dans un nouveau dossier
mkdir ~/projects/trail-fuel
cd ~/projects/trail-fuel
# Copier CLAUDE.md, doc.md, .claude/ ici

# Initialiser le projet Expo
npx create-expo-app@latest . --template blank-typescript

# Lancer Claude Code dans le dossier
claude
```

### 2. Premières commandes Claude Code

Une fois dedans, `/init` va essayer de (re)générer un `CLAUDE.md`. Pas besoin, celui fourni est déjà adapté. Tu peux directement commencer par :

```
> Lis doc.md et CLAUDE.md pour te mettre à jour sur le projet, puis propose-moi
  un plan détaillé pour implémenter l'étape 1 du planning (setup Expo +
  structure initiale), en une session de ~2h.
```

### 3. Déclenchement des skills

Les skills sont chargés automatiquement quand Claude détecte le contexte correspondant. Tu peux aussi les invoquer explicitement :

```
> Utilise le skill planning-engine pour implémenter la fonction generatePlan
  de A à Z, avec les tests associés.
```

## Philosophie des skills

Les skills contiennent la **connaissance domain-specific** qui serait trop verbeuse dans `CLAUDE.md`. Règle : si l'info n'est pertinente que pour **certaines tâches** du projet, c'est un skill. Si elle est universelle (stack, conventions), c'est dans `CLAUDE.md`.

**Exemples de ce qui est où** :

| Info                                      | Où ?                 |
|-------------------------------------------|----------------------|
| "On utilise TypeScript strict"            | `CLAUDE.md`          |
| "Les ingrédients du planning sont X, Y…"  | `planning-engine`    |
| "La formule de Tobler est…"               | `gpx-tobler`         |
| "Le channel Android pour les alertes est…"| `expo-notifications` |
| "60-90g de glucides/h"                    | `nutrition-rules`    |

## Ajouter un skill

Quand tu identifies un domaine qui devient verbeux dans les échanges avec Claude, crée un skill :

```bash
mkdir .claude/skills/nom-du-skill
cat > .claude/skills/nom-du-skill/SKILL.md <<'EOF'
---
name: nom-du-skill
description: Use this skill when... [triggers précis]
---

# Contenu...
EOF
```

La `description` dans le frontmatter est critique : c'est ce qui déclenche le chargement auto du skill. Elle doit lister des mots-clés et situations concrètes.

## Évolutions à envisager plus tard

- **Hooks** pour formatter le code auto après chaque edit (`PostToolUse` → prettier)
- **Commandes slash** pour workflows répétés (`/new-screen`, `/add-migration`)
- **Skill `ui-patterns`** quand l'UI se densifie (composants réutilisables, gestes, accessibilité)
- **Skill `testing`** quand la suite de tests grossit

## Itération sur le doc et les skills

Après quelques sessions, relis `CLAUDE.md` et les skills. Si Claude a fait des erreurs récurrentes, c'est probablement qu'une instruction manque ou est mal phrasée. Si tu ne peux pas justifier une ligne par "sans elle, Claude ferait une erreur", la supprimer.

**Budget d'instructions** : ~150-200 lignes dans `CLAUDE.md` maximum avant que Claude commence à ignorer des instructions au hasard. Les skills, eux, peuvent être plus longs car ils ne chargent qu'à la demande.
