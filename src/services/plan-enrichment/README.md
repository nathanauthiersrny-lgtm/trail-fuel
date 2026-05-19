# Plan Enrichment (mobile)

Couche client qui appelle le companion `/api/generate-plan` pour enrichir un
`TimelinePlan` brut produit par l'engine déterministe.

## Configuration

Variable d'environnement Expo (préfixe `EXPO_PUBLIC_` pour exposer au client) :

```bash
# .env.local à la racine de trail-fuel/
EXPO_PUBLIC_COMPANION_URL=http://<machine-IP-LAN>:3000
```

- **Dev local sur le même poste** (web / simulateur) : `http://localhost:3000`
- **Dev sur téléphone physique** : IP LAN de ton poste (`ip route get 1.1.1.1` ou
  équivalent). Le téléphone doit être sur le même Wi-Fi.
- **Companion non lancé / config absente** : `enrichPlan()` retourne
  `{ ok: false, reason: 'no_url_configured' }` et le caller fallback sur le
  plan brut. Aucun crash, l'app reste utilisable.

## Modules

- `client.ts` — fetch POST avec timeout 30s, gestion typée des échecs
  (`offline | timeout | http_error | no_url_configured | invalid_response`)
- `orchestrator.ts` — fonction haut niveau `generateEnrichedPlan` qui combine
  l'engine builder + l'appel d'enrichissement + l'adapter
  `TimelinePlan → PlannedEvent[]`. Mode `engine_only` ou `try_enrich`.

## Usage typique

```ts
const result = await generateEnrichedPlan({
  profile,
  race,
  foodItems,
  mode: 'try_enrich', // ou 'engine_only' pour skip Claude
});

console.log(result.events);          // PlannedEvent[] prêts pour le runtime
console.log(result.wasEnriched);     // true si Claude a appliqué des modifs
console.log(result.enrichmentMeta);  // tokens, articles utilisés, etc.
console.log(result.warnings);        // bornes physio + branches_not_executed
```

## Coexistence avec `generatePlan` legacy

Le runtime continue d'utiliser `src/engine/planning/generate.ts` pour
l'instant. Le nouvel orchestrateur est appelé en opt-in depuis
`PreviewScreen.tsx` (bouton "Enrichir avec Claude"). La bascule complète
(suppression du legacy, runtime sur TimelinePlan persisté) est l'objet de
A.5.
