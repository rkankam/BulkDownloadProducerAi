---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['_bmad-output/analysis/brainstorming-session-2026-01-08.md']
briefCount: 0
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
workflowType: 'prd'
lastStep: 4
---

# Product Requirements Document - BulkDownloadProducerAi

**Author:** Mon Seigneyr
**Date:** 2026-01-08

## Executive Summary

**BulkDownloadProducerAi** est un outil CLI Node.js conçu pour télécharger automatiquement et en masse une bibliothèque musicale complète depuis producer.ai (300+ morceaux) avec métadonnées et organisation structurée locale.

### Le Problème

Producer.ai ne propose pas de fonctionnalité de téléchargement en masse. Télécharger manuellement 300+ créations musicales est un processus répétitif et chronophage qui nécessite une automatisation. L'utilisateur a besoin de:
- Télécharger l'intégralité de sa bibliothèque initiale (300+ morceaux)
- Synchroniser continuellement les nouvelles créations
- Organiser et préserver son contenu créatif localement

### La Solution

Un outil CLI robuste qui automatise l'extraction complète via reverse engineering de l'API producer.ai:
- **Téléchargement séquentiel** de tous les morceaux au format MP3
- **Organisation intelligente** avec nomenclature `{title}_{generation_id}.mp3`
- **Architecture résiliente** avec reprise après crash via state file
- **Skip automatique** des fichiers déjà téléchargés

### Public Cible

Usage personnel - développeur intermédiaire qui possède une bibliothèque de 300+ créations musicales sur producer.ai et souhaite un outil fiable pour la préservation locale de son contenu.

### What Makes This Special

Ce n'est pas un script jetable - c'est une solution production-ready dès le PoC qui évite la dette fonctionnelle:

**Architecture éprouvée empruntée aux meilleurs:**
- Pattern `.downloading` (inspiré de aria2, IDM) pour garantir l'intégrité des fichiers
- State file (inspiré d'ETL tools comme Airflow) pour reprise exacte après crash
- Skip intelligent (inspiré de rclone) avec vérification de taille
- Retry logic (2 max) pour gérer les erreurs réseau transitoires

**Pragmatisme guidé par l'expérience:**
- KISS principle appliqué: MP3 uniquement, téléchargement séquentiel, métadonnées dans filename
- Équilibre simplicité/robustesse - pas de sur-engineering mais pas de shortcuts qui créent de la dette
- Modulaire dès Phase 1 (api.js, downloader.js, auth.js) pour maintenabilité

**Critère de succès immédiat:** Le premier batch correctement téléchargé et organisé valide l'approche.

**Vision évolutive:** CLI d'abord (PoC), puis Chrome Extension (UX améliorée) - mais chaque phase doit être complète et fonctionnelle.

## Project Classification

**Technical Type:** CLI Tool
**Domain:** General
**Complexity:** Low
**Project Context:** Greenfield - nouveau projet

**Classification rationale:**
- **CLI Tool** détecté via: Node.js, command-line, terminal, script, architecture modulaire CLI
- **Domain General** - Usage personnel sans réglementation sectorielle spécifique
- **Complexity Low** - Requirements standards, pas de compliance complexe, sécurité basique via cookies session

**Implications pour le PRD:**
- Focus sur: structure de commandes, formats de sortie, configuration (config.json), support de scripting
- Sections non pertinentes: UI/UX visuel, compliance réglementaire, multi-tenant, app store guidelines

## Success Criteria

### User Success

Le succès utilisateur se mesure par trois moments clés qui valident l'approche:

**Moment "ça marche" (Validation initiale):**
- Premier batch (20 morceaux) téléchargé avec succès
- Fichiers correctement nommés selon le pattern `{title}_{generation_id}.mp3`
- Fichiers jouables et organisés dans le dossier de sortie

**Moment "je peux lui faire confiance" (Validation de robustesse):**
- Le script reprend exactement où il s'est arrêté après un crash
- Skip automatique des fichiers déjà téléchargés lors d'un re-run
- Retry automatique en cas d'erreur réseau transitoire
- Aucune perte de données ou corruption de fichiers

**Moment "mission accomplie" (Validation complète):**
- Les 300+ morceaux téléchargés et organisés localement
- Collection musicale complète accessible hors ligne
- Fichiers prêts pour batch publishing sur plateformes de streaming
- Script peut être relancé périodiquement pour synchronisation continue

### Business Success

**Élimination de friction cognitive:**
- **Problème éliminé:** Sessions de téléchargement manuel inachevées dues à UI lente et perte de focus
- **Solution:** Script autonome - lance et oublie, pas de "baby-sitting" requis
- **Résultat:** Processus qui aurait pris des semaines/mois d'effort fragmenté complété en une seule session automatisée

**Déblocage de workflow critique:**
- **Capacité débloquée:** Backup local complet permet préparation batch publishing sur plateformes streaming
- **ROI réel:** Non mesurable en heures économisées mais en capacité stratégique débloquée
- **Autonomie:** Contrôle complet sur la collection sans dépendance aux limitations UI de producer.ai

**Évolutivité:**
- Synchronisation continue: Script relançable pour capturer nouvelles créations
- Extension future possible: Chrome Extension pour UX améliorée (post-PoC)

### Technical Success

**Critères Phase 2 (PoC Robuste) - TARGET:**

**Résilience:**
- State file persiste la progression (lastOffset, downloaded, skipped, failed)
- Reprise exacte après crash sans re-télécharger les fichiers existants
- Pattern `.downloading` garantit intégrité (pas de fichiers partiellement corrompus)
- Cleanup automatique des fichiers `.downloading` orphelins au démarrage

**Fiabilité:**
- Retry logic (2 max) gère les erreurs réseau transitoires
- Skip intelligent: vérification de taille de fichier (size > 0)
- Validation: fichiers téléchargés sont jouables et non corrompus

**Observabilité:**
- Logging clair avec progression en temps réel
- Statistiques finales: downloaded, skipped, failed counts
- Identification des échecs pour diagnostic post-run

**Architecture:**
- Code modulaire (api.js, downloader.js, auth.js, state.js, utils.js)
- Configuration externalisée (config.json pour cookies, userId, outputDir)
- Maintenable et extensible pour futures améliorations

### Measurable Outcomes

**Validation Technique (Phase 0 - Spike):**
- [ ] Authentification par cookies validée
- [ ] API pagination retourne liste complète des morceaux
- [ ] Endpoint download MP3 fonctionnel
- [ ] Structure JSON métadonnées comprise

**Validation PoC Minimal (Phase 1):**
- [ ] Script télécharge end-to-end sans crash
- [ ] Nomenclature fichiers `{title}_{id}.mp3` appliquée
- [ ] Code modulaire et lisible

**Validation PoC Robuste (Phase 2 - Success Target):**
- [ ] Crash & resume testé: reprise exacte via state file
- [ ] Re-run testé: skip automatique des fichiers existants
- [ ] Erreur réseau testée: retry 2x puis marqué failed
- [ ] Cleanup `.downloading` orphelins au démarrage
- [ ] Logging avec stats finales (downloaded/skipped/failed)

**Validation Utilisateur Finale:**
- [ ] 300+ morceaux téléchargés et jouables
- [ ] Collection organisée et prête pour batch publishing
- [ ] Script autonome - peut tourner overnight sans supervision

## Product Scope

### MVP - Minimum Viable Product (Phase 2 Target)

**Ce qui DOIT fonctionner pour que ce soit utile:**

**Core Features:**
- Téléchargement séquentiel de tous les morceaux au format MP3
- Authentification via cookies manuels (DevTools copy/paste)
- Pagination automatique de l'API (toutes les pages)
- Organisation fichiers: `{title}_{generation_id}.mp3` dans dossier plat

**Robustesse Requise (Non-négociable pour "production-ready"):**
- Pattern `.downloading` pendant téléchargement, renommé une fois complet
- State file (`download-state.json`) pour tracking progression
- Skip automatique fichiers existants (vérification taille > 0)
- Retry logic (2 max) pour erreurs réseau
- Cleanup orphaned `.downloading` au démarrage

**Configuration:**
- `config.json` avec cookies, userId, outputDir, format
- Logging clair avec progression et stats finales

**Success Criteria MVP:**
- Premier batch téléchargé et organisé ✓
- Crash & resume fonctionne ✓
- 300+ morceaux téléchargés sans supervision ✓

### Growth Features (Post-MVP)

**Ce qui rendrait l'outil plus compétitif (Could Have):**

**Multi-format Support:**
- Téléchargement WAV (haute qualité)
- Téléchargement M4A (compression Apple)
- Sélection format dans config.json

**Stems Support:**
- Téléchargement pistes séparées (drums, vocals, bass, etc.)
- Décodage base64 depuis endpoint `/stems`
- Organisation: `{title}_{id}/stems/` folder structure

**Métadonnées Enrichies:**
- Export JSON séparé avec métadonnées complètes (date, genre, BPM, etc.)
- Tags ID3 dans fichiers MP3
- Index CSV pour batch publishing

**Performance:**
- Téléchargements parallèles (avec rate limiting)
- Barre de progression CLI (progress bar)
- Estimation temps restant

**UX Améliorée:**
- Arguments CLI pour options (--format, --parallel, --retry-count)
- Mode verbose/quiet
- Dry-run pour prévisualiser

### Vision (Future)

**La version rêvée (Nice to Have):**

**Chrome Extension:**
- Auto-extraction cookies (pas de copy/paste manuel)
- UI graphique avec progress bar
- One-click download depuis producer.ai
- Paramètres persistés dans extension storage

**Synchronisation Continue:**
- Mode daemon/watch pour sync automatique
- Détection nouvelles créations
- Notifications desktop quand nouvelles pistes disponibles

**Publishing Integration:**
- Export direct vers plateformes streaming (DistroKid, TuneCore, etc.)
- Batch metadata mapping pour publishing
- Templates pour artwork et release info

**Communauté:**
- NPM package publication
- Tests unitaires et CI/CD
- Documentation utilisateur complète
- Support multi-plateformes musicales (pas juste producer.ai)

## User Journeys

### Journey 1: Le Créateur Musical - Libération du Workflow Bloqué

**Persona:** Rayan, créateur musical productif avec 300+ morceaux sur producer.ai

**Situation:** Veut préparer batch publishing sur plateformes streaming mais bloqué par l'absence de backup local. Les sessions de téléchargement manuel sont inachevées à cause de l'UI lente et de la perte de focus.

**Leur histoire avec BulkDownloadProducerAi:**

Rayan ouvre producer.ai un samedi matin, déterminé à télécharger sa collection. Après 45 minutes passées à cliquer morceau par morceau, il n'a téléchargé que 15 pistes et l'UI devient de plus en plus lente. Frustré, il abandonne encore une fois, sachant que sans backup local, il ne peut pas commencer son batch publishing sur les plateformes streaming.

Il décide de construire son propre outil. Après un spike technique qui valide l'approche API, il développe BulkDownloadProducerAi en suivant sa roadmap Phase 0-2. Il configure son `config.json` avec les cookies depuis DevTools, définit l'outputDir, et lance le script un dimanche soir avant de se coucher.

Le lendemain matin, il vérifie le dossier de sortie. Le script a tourné toute la nuit. 300+ morceaux correctement nommés `{title}_{generation_id}.mp3`, tous jouables, tous organisés. Le `download-state.json` montre: downloaded: 312, skipped: 0, failed: 3. Il a sa collection complète.

Trois jours plus tard, Rayan lance son workflow de batch publishing. Les fichiers MP3 sont déjà prêts, bien nommés, et il peut se concentrer sur l'optimisation des métadonnées pour les plateformes. Le script tourne maintenant une fois par semaine en tâche automatisée pour capturer ses nouvelles créations. Il a repris le contrôle de son contenu.

**Requirements révélés:**
- Configuration simple (config.json avec cookies, userId, outputDir)
- Exécution autonome sans supervision (peut tourner overnight)
- Nomenclature claire des fichiers pour faciliter batch processing
- Logging avec stats finales pour validation
- Réutilisable pour synchronisation continue

### Journey 2: Le Troubleshooter - Diagnostic Après Crash

**Persona:** Rayan en mode investigation technique

**Situation:** Le script a planté après 120 morceaux téléchargés suite à une erreur réseau. Besoin de comprendre ce qui s'est passé et reprendre sans perdre de données.

**Leur histoire avec BulkDownloadProducerAi:**

Mercredi matin, Rayan lance le script avant de partir travailler. En revenant le soir, il découvre que le terminal affiche une erreur réseau et le script s'est arrêté. Son cœur bat plus vite - a-t-il perdu sa progression? Doit-il recommencer du début?

Il ouvre le dossier `downloads/` et voit 120 fichiers MP3 bien nommés, aucun fichier `.downloading` orphelin. Le script a bien nettoyé. Il lit le `download-state.json`: `{"lastOffset": 120, "downloaded": 120, "skipped": 0, "failed": ["gen-xyz-abc"]}`. Les logs montrent clairement: "❌ Failed after 2 attempts: Track XYZ - Network timeout". Il comprend exactement ce qui s'est passé.

Rayan relance simplement le script avec la même commande. Le script charge automatiquement le state file, skip les 120 morceaux déjà présents (vérification taille > 0), et reprend à offset=120. En 15 minutes, les 180 morceaux restants sont téléchargés. Le fichier failed précédemment réussit cette fois.

Rayan réalise que son outil est vraiment robuste. Il peut l'interrompre à tout moment (Ctrl+C), le système peut crasher, peu importe - il reprendra toujours exactement où il s'est arrêté. Cette confiance lui permet de lancer des téléchargements sans anxiété. Le logging clair lui donne toujours une vision complète de ce qui s'est passé.

**Requirements révélés:**
- State file persistant (`download-state.json`) avec lastOffset, downloaded, skipped, failed
- Cleanup automatique des `.downloading` orphelins au démarrage
- Skip intelligent des fichiers existants avec vérification de taille
- Logging détaillé avec identification claire des échecs
- Retry logic visible dans les logs (tentative 1/2, 2/2)
- Reprise idempotente (relancer = reprendre, pas recommencer)

### Journey 3: Le Futur Utilisateur - Adoption et Configuration

**Persona:** Sophie, productrice musicale technique avec 150+ morceaux sur producer.ai

**Situation:** Découvre BulkDownloadProducerAi via GitHub. Première fois qu'elle utilise un outil CLI pour download, besoin de comprendre le setup.

**Leur histoire avec BulkDownloadProducerAi:**

Sophie cherche "producer.ai bulk download" sur Google après avoir abandonné pour la troisième fois un téléchargement manuel. Elle trouve le repo GitHub de Rayan. Le README explique clairement le problème qu'elle vit. Elle clone le projet, un peu nerveuse - elle code mais n'a jamais fait de reverse engineering d'API.

Elle suit le README pas à pas. `npm install` fonctionne. Elle doit maintenant créer `config.json`. Les instructions montrent exactement où trouver les cookies dans DevTools (screenshot inclus), comment identifier son `userId` depuis l'API response. Elle copie-colle, adapte l'`outputDir` à son système Mac. Elle hésite avant de lancer - et si ça casse quelque chose?

Elle lance `node src/index.js`. Le terminal affiche immédiatement: "📥 Fetching page offset=0..." puis "✅ Downloaded: Midnight Dreams_gen-123.mp3". Elle voit les fichiers apparaître dans son dossier. Le pattern de nommage est clair, les fichiers jouent parfaitement. Après 20 minutes, ses 150 morceaux sont téléchargés. Le log final affiche: "🎉 Download complete! Downloaded: 150, Skipped: 0, Failed: 0".

Sophie est impressionnée par la simplicité et la robustesse. Elle ajoute une note dans son calendrier pour relancer le script chaque mois pour sync. Elle contribue au README avec une section "Tips for Mac users". Six mois plus tard, elle utilise toujours l'outil et a recommandé à trois amis producteurs. L'outil fait ce qu'il promet, sans surprise.

**Requirements révélés:**
- README clair avec setup step-by-step
- Instructions visuelles pour extraction cookies (screenshots)
- Exemple `config.json` avec commentaires explicatifs
- Messages de console clairs et rassurants pendant l'exécution
- Feedback visuel immédiat (fichiers apparaissent, logs progressent)
- Stats finales claires pour validation du succès
- Code simple à lire pour troubleshooting si besoin
- Cross-platform support (Windows, Mac, Linux)

### Journey Requirements Summary

Les trois parcours utilisateur révèlent les capacités essentielles suivantes:

**Configuration & Setup:**
- Configuration simple via `config.json` (cookies, userId, outputDir, format)
- Documentation claire avec instructions visuelles pour extraction cookies et userId
- Compatibilité cross-platform (Windows, Mac, Linux)
- Exemple de configuration avec commentaires explicatifs

**Exécution Robuste:**
- State file pour persistence et reprise (`download-state.json`)
- Pattern `.downloading` pour garantir intégrité des fichiers
- Skip intelligent des fichiers existants avec vérification de taille
- Retry logic (2 tentatives max) pour erreurs réseau transitoires
- Cleanup automatique des fichiers `.downloading` orphelins au démarrage

**Observabilité & Trust:**
- Logging en temps réel avec émojis clairs (📥, ✅, ⏭️, ❌, 🎉)
- Statistiques finales (downloaded/skipped/failed counts)
- Identification des échecs avec raison explicite
- Progression visible (offset, filename en cours)
- State file lisible pour diagnostic manuel

**Autonomie:**
- Exécution sans supervision (peut tourner overnight ou en tâche automatisée)
- Interruptible à tout moment (Ctrl+C, crash système)
- Reprennable sans perte de données
- Idempotent (relancer le script est safe et reprend où ça s'est arrêté)
- Utilisable pour synchronisation continue (re-run périodique)
