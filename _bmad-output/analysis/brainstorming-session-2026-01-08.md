---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Développement d''une solution de téléchargement en bulk pour producer.ai (musique, métadonnées, stems)'
session_goals: 'Créer un outil pour télécharger automatiquement 300+ morceaux avec leurs métadonnées et pistes séparées, avec support pour téléchargement initial massif et synchronisation continue'
selected_approach: 'AI-Recommended Techniques'
techniques_used: ['First Principles Thinking', 'SCAMPER Method', 'Cross-Pollination', 'Decision Tree Mapping']
ideas_generated: 47
session_outcome: 'Architecture complète définie avec roadmap Phase 0-2, stack JavaScript/Node.js, patterns .downloading + state file, target PoC robuste production-ready'
context_file: 'C:\Users\rayan\OneDrive\Documents\Code\BulkDownloadProducerAi\_bmad\bmm\data\project-context-template.md'
---

# Brainstorming Session Results

**Facilitator:** Mon Seigneyr
**Date:** 2026-01-08

## Session Overview

**Topic:** Développement d'une solution de téléchargement en bulk pour producer.ai (musique complète, métadonnées, pistes séparées)

**Goals:** Extraire et télécharger automatiquement toute la bibliothèque musicale (300+ morceaux), capturer les métadonnées associées, télécharger les pistes séparées (stems en ZIP), et organiser le tout de manière structurée localement. Support pour téléchargement initial massif et synchronisation continue.

### Context Guidance

Cette session se concentre sur le développement d'un outil technique pour résoudre un problème d'utilisateur concret : l'absence de fonctionnalité de téléchargement en masse sur producer.ai. L'exploration couvrira :

- **Problème Utilisateur** : Impossibilité de télécharger en masse 300+ créations musicales
- **Approches Techniques** : Reverse engineering d'API, web scraping, architecture hybride
- **Expérience Utilisateur** : CLI pour PoC, puis Chrome Extension pour UX améliorée
- **Considérations Techniques** : Formats multiples (WAV/MP3/M4A), stems en ZIP, gestion de volumétrie importante
- **Valeur Business** : Automatisation d'un processus manuel répétitif, préservation du contenu créatif

### Session Setup

**Contexte Technique Collecté :**
- Volume : 300+ morceaux
- Fréquence : Téléchargement initial + synchronisation continue
- Niveau technique : Intermédiaire
- Parcours : CLI (PoC) → Chrome Extension (production)
- Formats : Stems (ZIP), Audio (WAV/MP3/M4A)
- ToS : Permissifs ✅

**Zones d'Exploration :**
1. Stack technologique optimal
2. Stratégies d'extraction intelligentes
3. Architecture d'organisation des données
4. Résilience et gestion d'erreurs
5. Maintenabilité et évolutivité

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Développement d'une solution de téléchargement en bulk pour producer.ai avec focus sur résolution de problèmes techniques, planification architecturale, et innovation pratique

**Recommended Techniques:**

1. **First Principles Thinking (Creative):** Recommandée pour déconstruire producer.ai jusqu'aux fondamentaux, identifier les vérités absolues (endpoints API, structure de données, authentification) et éliminer les assumptions qui pourraient mener à des impasses techniques. Durée estimée : 15-20 min.

2. **SCAMPER Method (Structured):** Recommandée pour explorer systématiquement toutes les options architecturales via 7 lentilles (Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse), créant un catalogue complet d'options techniques pour chaque composant. Durée estimée : 20-25 min.

3. **Cross-Pollination (Creative):** Recommandée pour découvrir comment d'autres industries (ETL tools, gestionnaires de médias, outils de backup cloud, download managers) résolvent des problèmes similaires, permettant d'adapter des patterns éprouvés au lieu de réinventer la roue. Durée estimée : 15-20 min.

4. **Decision Tree Mapping (Structured):** Recommandée pour visualiser tous les chemins de décision et leurs conséquences, facilitant des choix architecturaux éclairés et la création d'une roadmap claire pour l'implémentation. Durée estimée : 15-20 min.

**AI Rationale:** Cette séquence équilibre analyse profonde (First Principles, Decision Tree), exploration créative (Cross-Pollination), et planification structurée (SCAMPER) pour transformer un problème pratique en solution technique robuste. Total estimé : 65-85 minutes.

---

## Technique Execution Results

### 🔍 Technique 1: First Principles Thinking

**Objectif:** Déconstruire producer.ai jusqu'aux vérités fondamentales en analysant les logs réseau (HAR files) pour identifier ce qui est *vraiment* nécessaire vs ce qui est assumé.

#### Découvertes Fondamentales (Vérités Absolues)

**VÉRITÉ #1 : Authentification par Cookies**
- Pas de header `Authorization` complexe
- Les cookies de session font tout le travail automatiquement
- **Implication:** Récupération des cookies d'une session navigateur authentifiée suffit

**VÉRITÉ #2 : Endpoint de Liste Paginée**
```
/__api/v2/users/{user_id}/generations?offset=0&limit=20
```
- Retourne toute la bibliothèque avec pagination (20 items par page)
- Format JSON propre, pas de HTML à scraper
- **Implication:** ~15 requêtes API (300÷20) suffisent pour obtenir tous les generation IDs

**VÉRITÉ #3 : Pattern de Téléchargement Simple**
```
/__api/{generation_id}/download?format=mp3
```
- Un seul endpoint, paramètre `format` variable: `mp3`, `wav`, `m4a`
- **Implication:** Téléchargement trivial une fois qu'on a les IDs

**VÉRITÉ #4 : Endpoint des Stems (Could Have)**
```
/__api/stems/{generation_id}
```
- Retourne un JSON avec chaque piste séparée encodée en base64
- Structure: `{"stems":{"drums":"[base64]","vocals":"[base64]",...}}`
- **Décision:** Reporter aux stems pour phase ultérieure (nice-to-have)

**VÉRITÉ #5 : Stockage Google Cloud**
```
https://storage.googleapis.com/corpusant-app-public/riffs/{user_id}/audio/{audio_id}.m4a
```
- Les fichiers ne sont PAS sur les serveurs producer.ai
- **Implication:** Téléchargement direct depuis GCS, pas de rate limiting côté producer.ai

#### Conclusions First Principles

**Ce dont on a VRAIMENT besoin:**
1. Authentification: Cookies de session (pas de OAuth complexe)
2. Liste des morceaux: 1 endpoint paginé (pas de scraping HTML)
3. Téléchargement audio: 1 endpoint avec paramètre format
4. Métadonnées: Probablement dans la réponse `/generations`

**Ce qui était FAUX (Assumptions éliminées):**
- ❌ "Les stems sont dans un ZIP" → Ils sont en base64 dans JSON
- ❌ "Il faut scraper du HTML" → API JSON propre existe
- ❌ "L'authentification est complexe" → Cookies suffisent

---

### 📊 Technique 2: SCAMPER Method

**Objectif:** Explorer systématiquement toutes les variations possibles pour chaque composant via 7 lentilles (Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse).

#### Décisions SCAMPER Finales

**S - SUBSTITUTE (Remplacer)**
- **Langage:** Full JavaScript (Node.js) pour scalabilité vers Chrome Extension
- **Authentification:** Cookies manuels (DevTools copy/paste) pour PoC

**C - COMBINE (Combiner)**
- Stack unifié JavaScript (pas de mix Python/JS)
- Éviter la complexité de combiner multiples outils

**A - ADAPT (Adapter)**
- **Reprise après crash:** Skip fichiers existants (taille > 0)
- Pattern inspiré de download managers professionnels

**M - MODIFY (Modifier)**
- **Validation:** Basique avec 2 retry max
- Équilibre entre robustesse et simplicité

**P - PUT TO OTHER USES (Utiliser autrement)**
- **Scope:** Spécifique à producer.ai pour PoC
- Extensibilité future possible mais pas prioritaire

**E - ELIMINATE (Éliminer)**
- ❌ Pas de WAV/M4A (MP3 uniquement pour PoC)
- ❌ Pas de stems (reporté en "could have")
- ❌ Pas de métadonnées JSON séparées
- ❌ Pas de téléchargements parallèles (séquentiel pour simplicité)

**R - REVERSE (Inverser)**
- **Flux streaming:** Fetch page → Download → Fetch page suivante
- Gratification immédiate vs batch complet puis download

#### Organisation des Données (SCAMPER)

**Nomenclature fichiers:** `{title}_{generation_id}.mp3`
- Titre pour lisibilité humaine
- ID pour garantir unicité

**Structure dossiers:** Plat (tous dans un seul dossier)
- Simple, cherchable, pas de hiérarchie complexe

---

### 🔄 Technique 3: Cross-Pollination

**Objectif:** Emprunter les meilleurs patterns d'autres industries/outils ayant résolu des problèmes similaires.

#### Patterns Empruntés

**Pattern #1: Download Managers (aria2, IDM)**
```javascript
// Fichier .downloading pendant téléchargement
const tempFile = `${title}_${id}.mp3.downloading`;
// Renommé une fois complété
fs.rename(tempFile, `${title}_${id}.mp3`);
```
**Avantage:** Si crash, les `.downloading` sont clairement identifiables comme incomplets

**Pattern #2: ETL Tools (Airflow, Luigi)**
```javascript
// State file pour tracking progression
const state = {
  lastOffset: 40,
  downloaded: 40,
  skipped: 2,
  failed: ["gen-id-xyz"]
};
fs.writeFileSync('download-state.json', JSON.stringify(state));
```
**Avantage:** Reprise exacte après crash sans regarder les fichiers

**Pattern #3: gallery-dl (Architecture modulaire)**
```
producer-dl/
├── src/
│   ├── auth.js          # Gestion cookies
│   ├── api.js           # Appels API producer.ai
│   ├── downloader.js    # Téléchargement fichiers
│   ├── utils.js         # Helpers (sanitize filename, etc.)
│   └── index.js         # Orchestrateur principal
├── config.json          # Cookies, output path
└── package.json
```

**Pattern #4: rclone (Skip existing intelligent)**
```javascript
function shouldDownload(filepath) {
  if (!fs.existsSync(filepath)) return true;
  const stats = fs.statSync(filepath);
  return stats.size === 0; // Re-download si vide
}
```

**Pattern #5: Stratégie Taille + .downloading**
- Combinaison optimale pour garantir intégrité sans complexité de checksum
- Checksum jugé "overkill" pour ce cas d'usage

#### Stack Technique Final (Cross-Pollination)

**HTTP Client:** `node-fetch` (minimaliste, proche de fetch natif)
**Sanitize:** `sanitize-filename` (lib dédiée)
**Progress:** `console.log` simple (pas de barre de progression pour PoC)

---

### 🌳 Technique 4: Decision Tree Mapping

**Objectif:** Cartographier tous les chemins de décision et créer une roadmap d'implémentation optimale.

#### Arbre de Décision - Phases d'Implémentation

```
START
  │
  ├─ Phase 0: SPIKE TECHNIQUE (1-2h) ✅
  │   ├─ Validate authentification cookies
  │   ├─ Validate API pagination structure
  │   └─ Validate download MP3 endpoint
  │
  ├─ Phase 1: PoC MINIMAL (3-4h)
  │   ├─ Code structure modulaire
  │   ├─ Pagination loop
  │   ├─ Download séquentiel
  │   └─ Basic filename sanitization
  │
  ├─ Phase 2: PoC ROBUSTE (2-3h) ✅ TARGET
  │   ├─ Skip existing (size check)
  │   ├─ .downloading pattern
  │   ├─ Retry logic (2 max)
  │   ├─ State file (resume capability)
  │   └─ Better logging
  │
  └─ Phase 3: CHROME EXTENSION (4-6h, futur)
      ├─ Manifest + UI
      ├─ Auto cookies
      └─ Progress bar
```

#### Décisions Critiques

**DÉCISION #1:** Spike technique d'abord ✅
- Valider que tout fonctionne AVANT de coder l'architecture complète
- Lever les incertitudes (auth, API, download)

**DÉCISION #2:** Target Phase 2 (PoC Robuste) ✅
- Production-ready avec retry, skip, resume
- Balance entre MVP et robustesse

**DÉCISION #3:** Métadonnées dans nom de fichier uniquement ✅
- Pas de JSON séparé, pas de tags ID3
- KISS principle (Keep It Simple, Stupid)

---

## 🎯 Architecture Finale & Roadmap

### Stack Technique Finalisé

```javascript
{
  "runtime": "Node.js",
  "language": "JavaScript",
  "httpClient": "node-fetch",
  "dependencies": [
    "node-fetch",
    "sanitize-filename"
  ],
  "authentication": "Manual cookies (DevTools)",
  "downloadStrategy": "Sequential streaming",
  "resumeStrategy": "State file + skip existing"
}
```

### Structure de Code Recommandée

```
producer-dl/
├── src/
│   ├── index.js         # Entry point, orchestration
│   ├── config.js        # Load config.json, validate
│   ├── auth.js          # Cookie management
│   ├── api.js           # producer.ai API calls
│   │   ├── fetchGenerations(offset, limit)
│   │   ├── getDownloadUrl(generationId, format)
│   │   └── getUserId()
│   ├── downloader.js    # Download logic with retry
│   │   ├── downloadTrack(track, outputDir)
│   │   └── shouldSkip(filepath)
│   ├── state.js         # State file management
│   │   ├── loadState()
│   │   ├── saveState(state)
│   │   └── updateState(downloaded, skipped, failed)
│   └── utils.js         # Helpers
│       ├── sanitizeFilename(name)
│       └── cleanupDownloadingFiles(dir)
├── config.json          # User config
│   {
│     "cookies": "...",
│     "userId": "...",
│     "outputDir": "./downloads",
│     "format": "mp3"
│   }
├── download-state.json  # Auto-generated
└── package.json
```

---

## 📋 Roadmap d'Implémentation Détaillée

### Phase 0: Spike Technique (1-2h)

**Objectif:** Valider toutes les incertitudes techniques avant de coder.

**Tasks:**
1. **Test Authentification**
   - Ouvrir producer.ai dans Chrome
   - DevTools → Application → Cookies
   - Copier tous les cookies du domaine producer.ai
   - Tester avec curl/Postman:
     ```bash
     curl 'https://www.producer.ai/__api/v2/users/YOUR_USER_ID/generations?offset=0&limit=20' \
       -H 'Cookie: YOUR_COOKIES_HERE'
     ```

2. **Test API Pagination**
   - Analyser la structure JSON de la réponse
   - Vérifier présence de: `title`, `id`, `created_at`, etc.
   - Tester offset=20, 40, 60 pour valider pagination
   - Identifier le `user_id` à utiliser

3. **Test Download Endpoint**
   - Prendre un `generation_id` du résultat
   - Appeler: `/__api/{generation_id}/download?format=mp3`
   - Sauvegarder et vérifier que le fichier joue
   - Mesurer taille typique d'un fichier MP3

**Success Criteria:**
- ✅ Les cookies fonctionnent pour l'authentification
- ✅ L'API retourne bien la liste complète des morceaux
- ✅ Le téléchargement MP3 fonctionne
- ✅ La structure JSON des métadonnées est comprise

---

### Phase 1: PoC Minimal (3-4h)

**Objectif:** Script fonctionnel end-to-end sans robustesse.

**Implementation Order:**

1. **Setup projet**
   ```bash
   mkdir producer-dl && cd producer-dl
   npm init -y
   npm install node-fetch sanitize-filename
   ```

2. **Créer `config.json`**
   ```json
   {
     "cookies": "YOUR_COOKIES_FROM_DEVTOOLS",
     "userId": "YOUR_USER_ID",
     "outputDir": "./downloads",
     "format": "mp3"
   }
   ```

3. **`src/api.js` - Basic API calls**
   ```javascript
   import fetch from 'node-fetch';

   export async function fetchGenerations(cookies, userId, offset = 0, limit = 20) {
     const url = `https://www.producer.ai/__api/v2/users/${userId}/generations?offset=${offset}&limit=${limit}`;
     const response = await fetch(url, {
       headers: { 'Cookie': cookies }
     });
     return await response.json();
   }

   export function getDownloadUrl(generationId, format = 'mp3') {
     return `https://www.producer.ai/__api/${generationId}/download?format=${format}`;
   }
   ```

4. **`src/downloader.js` - Basic download**
   ```javascript
   import fetch from 'node-fetch';
   import fs from 'fs';
   import path from 'path';
   import sanitize from 'sanitize-filename';

   export async function downloadTrack(track, cookies, outputDir, format) {
     const filename = sanitize(`${track.title}_${track.id}.${format}`);
     const filepath = path.join(outputDir, filename);
     const url = getDownloadUrl(track.id, format);

     const response = await fetch(url, {
       headers: { 'Cookie': cookies }
     });

     const buffer = await response.buffer();
     fs.writeFileSync(filepath, buffer);

     console.log(`✅ Downloaded: ${filename}`);
     return { status: 'success', file: filename };
   }
   ```

5. **`src/index.js` - Main orchestration**
   ```javascript
   import fs from 'fs';
   import { fetchGenerations } from './api.js';
   import { downloadTrack } from './downloader.js';

   async function main() {
     const config = JSON.parse(fs.readFileSync('./config.json'));
     fs.mkdirSync(config.outputDir, { recursive: true });

     let offset = 0;
     const limit = 20;
     let hasMore = true;

     while (hasMore) {
       console.log(`📥 Fetching page offset=${offset}...`);
       const data = await fetchGenerations(config.cookies, config.userId, offset, limit);

       const tracks = data.generations || [];
       if (tracks.length === 0) {
         hasMore = false;
         break;
       }

       for (const track of tracks) {
         await downloadTrack(track, config.cookies, config.outputDir, config.format);
       }

       offset += limit;
     }

     console.log('🎉 All downloads complete!');
   }

   main().catch(console.error);
   ```

**Success Criteria Phase 1:**
- ✅ Script télécharge tous les morceaux du début à la fin (si pas de crash)
- ✅ Fichiers sauvegardés avec nom: `{title}_{id}.mp3`
- ✅ Code modulaire et lisible

---

### Phase 2: PoC Robuste (2-3h) - TARGET

**Objectif:** Ajouter retry, skip existing, state file, .downloading pattern.

**Features à implémenter:**

1. **Skip Existing + .downloading Pattern**
   ```javascript
   // downloader.js
   export async function downloadTrack(track, cookies, outputDir, format) {
     const filename = sanitize(`${track.title}_${track.id}.${format}`);
     const finalPath = path.join(outputDir, filename);
     const tempPath = `${finalPath}.downloading`;

     // Skip si déjà téléchargé
     if (fs.existsSync(finalPath)) {
       const stats = fs.statSync(finalPath);
       if (stats.size > 0) {
         console.log(`⏭️  Skipping: ${filename} (exists, ${stats.size} bytes)`);
         return { status: 'skipped', file: filename };
       }
     }

     // Nettoyer ancien .downloading si présent
     if (fs.existsSync(tempPath)) {
       fs.unlinkSync(tempPath);
     }

     // Download to .downloading
     try {
       const url = getDownloadUrl(track.id, format);
       const response = await fetch(url, {
         headers: { 'Cookie': cookies }
       });
       const buffer = await response.buffer();
       fs.writeFileSync(tempPath, buffer);

       // Rename to final
       fs.renameSync(tempPath, finalPath);
       console.log(`✅ Downloaded: ${filename}`);
       return { status: 'success', file: filename };
     } catch (error) {
       // Cleanup failed .downloading
       if (fs.existsSync(tempPath)) {
         fs.unlinkSync(tempPath);
       }
       throw error;
     }
   }
   ```

2. **Retry Logic (2 max)**
   ```javascript
   async function downloadWithRetry(track, cookies, outputDir, format, maxRetries = 2) {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         return await downloadTrack(track, cookies, outputDir, format);
       } catch (error) {
         if (attempt === maxRetries) {
           console.error(`❌ Failed after ${maxRetries} attempts: ${track.title}`);
           return { status: 'failed', file: track.title, error: error.message };
         }
         console.warn(`⚠️  Retry ${attempt}/${maxRetries}: ${track.title}`);
         await sleep(1000 * attempt); // Exponential backoff
       }
     }
   }
   ```

3. **State File Management**
   ```javascript
   // state.js
   export function loadState() {
     if (fs.existsSync('./download-state.json')) {
       return JSON.parse(fs.readFileSync('./download-state.json'));
     }
     return { lastOffset: 0, downloaded: 0, skipped: 0, failed: [] };
   }

   export function saveState(state) {
     fs.writeFileSync('./download-state.json', JSON.stringify(state, null, 2));
   }
   ```

4. **Cleanup Orphaned .downloading**
   ```javascript
   // utils.js
   export function cleanupDownloadingFiles(dir) {
     const files = fs.readdirSync(dir);
     const downloading = files.filter(f => f.endsWith('.downloading'));
     downloading.forEach(f => {
       fs.unlinkSync(path.join(dir, f));
       console.log(`🧹 Cleaned up: ${f}`);
     });
   }
   ```

5. **Enhanced index.js with Resume**
   ```javascript
   async function main() {
     const config = JSON.parse(fs.readFileSync('./config.json'));
     fs.mkdirSync(config.outputDir, { recursive: true });

     // Cleanup orphaned files
     cleanupDownloadingFiles(config.outputDir);

     // Load state
     const state = loadState();
     let offset = state.lastOffset;

     const stats = { downloaded: 0, skipped: 0, failed: 0 };

     while (true) {
       console.log(`\n📥 Fetching page offset=${offset}...`);
       const data = await fetchGenerations(config.cookies, config.userId, offset, 20);

       if (!data.generations || data.generations.length === 0) break;

       for (const track of data.generations) {
         const result = await downloadWithRetry(track, config.cookies, config.outputDir, config.format);
         stats[result.status]++;
         if (result.status === 'failed') {
           state.failed.push(track.id);
         }
       }

       offset += 20;
       state.lastOffset = offset;
       saveState(state);
     }

     console.log('\n🎉 Download complete!');
     console.log(`Downloaded: ${stats.downloaded}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);
   }
   ```

**Success Criteria Phase 2:**
- ✅ Si crash → reprend où ça s'est arrêté via state file
- ✅ Si re-run → skip automatiquement les déjà téléchargés
- ✅ Si erreur réseau → retry 2x avant abandon
- ✅ Fichiers .downloading nettoyés au démarrage
- ✅ Logging clair avec statistiques finales

---

## ✅ Checklist d'Exécution

### Phase 0: Spike
- [ ] Extraire cookies depuis DevTools
- [ ] Tester API `/generations` avec curl
- [ ] Analyser structure JSON
- [ ] Tester download endpoint
- [ ] Documenter findings

### Phase 1: PoC Minimal
- [ ] Initialiser projet Node.js
- [ ] Installer dependencies (node-fetch, sanitize-filename)
- [ ] Créer config.json avec cookies
- [ ] Coder src/api.js
- [ ] Coder src/downloader.js
- [ ] Coder src/index.js
- [ ] Test run avec 1-2 pages
- [ ] Valider fichiers téléchargés jouent correctement

### Phase 2: PoC Robuste
- [ ] Implémenter pattern .downloading
- [ ] Implémenter skip existing (size check)
- [ ] Implémenter retry logic (2 max)
- [ ] Implémenter state file (load/save)
- [ ] Implémenter cleanup orphaned files
- [ ] Enhanced logging avec stats
- [ ] Test: crash & resume
- [ ] Test: re-run avec fichiers existants
- [ ] Test: erreur réseau (débrancher wifi)
- [ ] Documentation README

---

## 🚀 Next Steps (Post-Phase 2)

**Could Have (Futur):**
- [ ] Support multi-format (WAV, M4A)
- [ ] Téléchargement stems (base64 decode)
- [ ] Métadonnées JSON séparées
- [ ] Téléchargements parallèles
- [ ] Barre de progression CLI
- [ ] Chrome Extension UI

**Nice to Have:**
- [ ] Tests unitaires
- [ ] CI/CD
- [ ] Docker container
- [ ] NPM package publication

---

## 💡 Key Insights & Lessons Learned

### Breakthrough Moments

1. **First Principles révélation:** L'analyse des HAR files a révélé que producer.ai utilise des API JSON propres, éliminant le besoin de scraping HTML complexe.

2. **Pattern .downloading + skip existing:** La combinaison de ces deux patterns garantit l'intégrité des fichiers sans la complexité des checksums.

3. **Streaming vs Batch:** Le choix du flux streaming (fetch page → download → next page) permet une gratification immédiate et une meilleure gestion mémoire.

4. **KISS Principle appliqué:** Choix pragmatiques (MP3 only, nom de fichier pour metadata, séquentiel) permettent un PoC rapide et fonctionnel.

### Décisions Architecturales Critiques

- **Full JavaScript:** Vision unifiée CLI → Chrome Extension
- **Modulaire dès Phase 1:** Code maintenable et testable
- **State file:** Reprise robuste après crash
- **Manual cookies pour PoC:** Évite complexité Puppeteer

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cookies expirent | Bloque tout | Documenter comment refresh cookies |
| API change | Casse tool | Phase 0 validation + tests réguliers |
| Rate limiting | Ralentit download | Séquentiel + monitoring |
| Nom fichiers invalides | Crash save | sanitize-filename lib |

---

## 📚 Resources & References

**Patterns inspirés de:**
- aria2 (download manager) - Pattern .part/.downloading
- rclone (sync tool) - Skip existing strategies
- gallery-dl (media downloader) - Architecture modulaire
- ETL tools - State file pour tracking

**Librairies Node.js:**
- node-fetch: HTTP client minimaliste
- sanitize-filename: Nettoyage noms de fichiers

**Documentation producer.ai:**
- Endpoints découverts via reverse engineering (HAR analysis)
- ToS: Permissifs pour usage personnel

---

_Session facilitée par Mary, Business Analyst - 2026-01-08_
_Durée totale: ~85 minutes_
_Techniques utilisées: First Principles Thinking, SCAMPER Method, Cross-Pollination, Decision Tree Mapping_
