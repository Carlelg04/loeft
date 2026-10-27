# Master-prompt: Personlig træningslogger til telefonen (Hevy-inspireret)

> **Sådan bruges den:** Udfyld BRIEF-blokken (afsnit 0), og indsæt hele prompten som første besked i dit vibecoding-værktøj (Claude Code, Lovable, Bolt, v0 eller lignende).
> Byg én fase ad gangen (afsnit 13), og test på din telefon i fitnesscentret mellem hver fase. Det er dér, de rigtige fejl viser sig.
> Brug opfølgningsprompts fra afsnit 16, når du har prøvet appen.

---

## 0. BRIEF (udfyld)

- **Appens navn:** (dit eget navn, ikke "Hevy")
- **Telefon:** iPhone / Android (model og version, fx "iPhone 14, iOS 26")
- **Vægtenhed:** kg / lb
- **Sprog i appen:** dansk / engelsk
- **Øvelsesnavne:** dansk / engelsk (de fleste i fitnesscentre bruger de engelske)
- **Hvordan træner jeg nu:** (fx "push/pull/ben 4 gange om ugen", "5x5", "fuldkrop 3 gange om ugen")
- **Mine faste rutiner:** (skriv dem ind, så de bliver lagt ind som startdata. Fx "Push A: Bench Press 4x6-8, Incline Dumbbell Press 3x8-10, Cable Fly 3x12-15, Lateral Raise 4x12-15, Triceps Pushdown 3x10-12")
- **Standard pausetid:** (fx 120 sek. på tunge basisøvelser, 90 sek. på resten)
- **Bruger jeg Hevy i dag?** Ja, og jeg vil importere min historik fra Hevys CSV-eksport / Nej
- **Hvor skal appen ligge:** GitHub Pages (gratis, anbefalet) / Netlify / Cloudflare Pages / værktøjets egen publicering
- **Stemning i 3 ord:** (fx "rolig, mørk, præcis")
- **Accentfarve:** (eller "vælg selv")

---

## 1. ROLLE OG MÅL

Du er en erfaren mobil-frontend-udvikler, der selv træner styrke. Du bygger en personlig træningslogger til én bruger: mig. Den er inspireret af arbejdsgangen i Hevy (hevyapp.com), men den er min egen app.

Appen bruges **midt i et træningspas**: telefonen ligger på en bænk eller i lommen, hænderne er svedige eller har kridt på, pulsen er høj, og der går 1-3 minutter mellem hvert input. Alt designes til den situation, ikke til en skrivebordsskærm.

**Målet:** Jeg kan logge en hel træning med én hånd og uden at tænke, hurtigere end med papir og mindst lige så hurtigt som i Hevy.

**Ophavsret:** Brug ikke Hevys navn, logo, ikoner, skærmbilleder, tekster eller øvelsesbilleder og -videoer. Du genskaber arbejdsgangen, ikke produktet.

---

## 2. AFGRÆNSNING

**Version 1 (skal virke):**

1. Start en tom træning eller start fra en rutine
2. Log sæt med kg og reps, og markér sæt som færdige
3. Sættyper: normal, opvarmning, til failure, dropsæt
4. "Forrige"-kolonne: hvad jeg løftede sidst på samme øvelse og samme sæt
5. Pausetimer, der starter automatisk, når et sæt markeres færdigt
6. Rutiner: opret, redigér, start, og opdatér med dagens værdier
7. Øvelsesbibliotek med søgning, filtre og egne øvelser
8. Historik: se, redigér, slet og gentag tidligere træninger
9. Personlige rekorder (PR), som opdages, mens jeg logger
10. Øvelsesside med historik, rekorder og graf
11. Simpel statistik: træninger pr. uge, volumen pr. uge og sæt pr. muskelgruppe
12. Backup: eksport og import af alle data som JSON
13. Installérbar på hjemmeskærmen og virker 100 % offline

**Version 2 (først når jeg beder om det, én ad gangen):**

- Supersæt
- RPE pr. sæt
- Pladeregner (hvilke skiver på hver side af stangen)
- Opvarmningsberegner (fx 40 % / 60 % / 80 % af arbejdsvægten)
- Progressionsforslag ("Sidst 3x8 på 80 kg. Prøv 82,5 kg.")
- Mapper til rutiner
- Kropsvægt og kropsmål med graf
- Kalender og streak-visning
- Import af historik fra Hevys CSV-eksport (flyttes til version 1, hvis BRIEF siger ja)

**Ikke med (byg det ikke):**

- Login, brugerkonti, server eller database i skyen (heller ikke Supabase eller Firebase)
- Socialt feed, følgere, likes og deling
- Betaling, abonnement og reklamer
- AI-coach og chat
- Ur-apps, Apple Health og Google Fit
- Push-notifikationer fra en server

---

## 3. TEKNISK STAK

Brug denne stak. Hvis dit værktøj har sin egen faste stak, så brug den nærmeste tilsvarende og skriv, hvad du afviger fra.

- **Vite + React + TypeScript** (strict)
- **Tailwind CSS**
- **Dexie.js** (IndexedDB) som eneste datalager, plus `dexie-react-hooks` (`useLiveQuery`) til at læse data reaktivt
- **vite-plugin-pwa** (Workbox) til service worker og manifest
- **React Router med `HashRouter`**, så GitHub Pages ikke giver 404 ved genindlæsning
- **zod** til at validere backup-filer ved import
- **Ikoner:** én familie med ens stroke, fx Phosphor eller Tabler
- **Grafer:** et let bibliotek, fx uPlot eller Recharts
- **Ingen backend.** Alt ligger på telefonen.

Tjek `package.json` før imports, og skriv install-kommandoen, hvis noget mangler. Hold antallet af afhængigheder lavt.

---

## 4. DATAMODEL

Brug denne model som udgangspunkt. Regler:

- Alle id'er er `crypto.randomUUID()`.
- Alle tidspunkter er epoch-millisekunder (`number`).
- Al vægt gemmes i **kg** internt og konverteres kun ved visning.
- Afledte tal (volumen, PR, estimeret 1RM) **beregnes** ud fra sættene. De gemmes ikke som sandhed. En cache er fin, hvis den kan genberegnes.

```ts
type ExerciseType =
  | 'weight_reps'          // fx bænkpres: kg x reps
  | 'bodyweight_reps'      // fx pull-ups: reps, evt. med ekstra kg
  | 'assisted_bodyweight'  // fx assisteret pull-up: kg trækkes fra
  | 'duration'             // fx planke: sekunder
  | 'distance_duration';   // fx roning: meter og tid

type SetType = 'normal' | 'warmup' | 'failure' | 'drop';

type Muscle =
  | 'chest' | 'lats' | 'upper_back' | 'lower_back' | 'traps'
  | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'abs'
  | 'glutes' | 'quads' | 'hamstrings' | 'calves'
  | 'adductors' | 'abductors' | 'neck' | 'cardio' | 'full_body';

type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'
  | 'kettlebell' | 'band' | 'smith' | 'other';

interface Exercise {
  id: string;
  name: string;
  aliases: string[];          // fx ["Bænkpres"] ved siden af "Bench Press"
  type: ExerciseType;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  isCustom: boolean;
  defaultRestSec?: number;
  notes?: string;
  archived?: boolean;
}

interface Routine {
  id: string;
  name: string;
  notes?: string;
  order: number;
  exercises: RoutineExercise[];
  updatedAt: number;
}

interface RoutineExercise {
  exerciseId: string;
  restSec: number;
  notes?: string;
  sets: {
    type: SetType;
    targetKg?: number;
    targetReps?: number;
    targetRepsMax?: number;   // til intervaller som 8-10
  }[];
}

interface Workout {
  id: string;
  name: string;
  routineId?: string;
  startedAt: number;
  endedAt?: number;           // mangler = træningen er aktiv
  notes?: string;
  exerciseIds: string[];      // denormaliseret, multiEntry-indeks til "forrige"-opslag
  exercises: WorkoutExercise[];
}

interface WorkoutExercise {
  exerciseId: string;
  restSec: number;
  notes?: string;
  sets: WorkoutSet[];
}

interface WorkoutSet {
  id: string;
  type: SetType;
  kg?: number;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  rpe?: number;               // version 2
  done: boolean;
  doneAt?: number;
}

interface Settings {
  unit: 'kg' | 'lb';
  defaultRestSec: number;
  previousFrom: 'any_workout' | 'same_routine';
  sound: boolean;
  vibrate: boolean;
  keepAwake: boolean;
  theme: 'dark' | 'light' | 'system';
  barKg: number;
  plates: number[];
  lastBackupAt?: number;
}

// Pausetimeren gemmes også, så den overlever genstart:
interface RestTimer { endsAt: number; durationSec: number; exerciseId: string; }
```

Dexie-indekser, mindst: `workouts: 'id, startedAt, endedAt, routineId, *exerciseIds'`, `exercises: 'id, name, primaryMuscle, equipment'`, `routines: 'id, order'`.

**Startdata:** ca. 80 almindelige øvelser fordelt på alle muskelgrupper og udstyrstyper, på det sprog BRIEF angiver, med aliaser på det andet sprog. Plus mine rutiner fra BRIEF.

---

## 5. SKÆRME OG FLOW

Bundnavigation med 4 faner: **Træn**, **Historik**, **Øvelser**, **Statistik**. Indstillinger ligger bag et tandhjul på Statistik.

### 5.1 Træn (startskærm)

- Stor primærknap: "Start tom træning".
- Mine rutiner som liste: navn, øvelserne i kort form og "Sidst lavet for 3 dage siden". Tryk åbner en forhåndsvisning med "Start rutine".
- Er en træning i gang, ligger en fast bjælke lige over bundnavigationen på alle faner: "Træning i gang, 34:12". Tryk fører tilbage til træningen.
- Åbner jeg appen, mens en træning er i gang, lander jeg direkte i træningen.

### 5.2 Aktiv træning (den vigtigste skærm)

**Top:** træningsnavn (kan rettes), varighed (tæller op), volumen i kg, antal færdige sæt og knappen "Afslut".

**Pr. øvelse:**

- Øvelsesnavn (tryk åbner øvelsessiden) og en menu: Erstat øvelse, Flyt op, Flyt ned, Pausetid, Fjern.
- Et kort notefelt, som er foldet sammen, indtil jeg bruger det.
- Sæt som rækker med kolonnerne `Sæt | Forrige | kg | Reps | ✓`:
  - **Sæt:** nummer. Tryk vælger type: O (opvarmning), F (failure), D (dropsæt). Opvarmningssæt tælles ikke med i nummereringen.
  - **Forrige:** fx "80 x 8" fra sidste gang, samme sætnummer og samme slags sæt (opvarmning matches med opvarmning). Gråt. Tryk kopierer værdierne ind.
  - **kg og Reps:** tomme felter viser forrige værdi (eller rutinens mål) som placeholder.
  - **✓:** markerer sættet som færdigt. Er felterne tomme, bruges placeholder-værdierne. Rækken skifter til færdig-farve, pausetimeren starter, og slår sættet en rekord, vises et lille pokal-ikon på rækken.
  - Swipe til venstre sletter sættet, med "Fortryd" i 5 sekunder.
- "Tilføj sæt" kopierer værdierne fra sættet over.

**Nederst:** "Tilføj øvelse" (biblioteket åbner som bottom sheet med flervalg) og "Kassér træning" (kræver bekræftelse).

**Input:**

- kg-felt: `inputmode="decimal"`. Accepter både komma og punktum, fordi det danske tastatur giver komma. Vis tal med `Intl.NumberFormat` i appens sprog.
- Reps-felt: `inputmode="numeric"`.
- Skriftstørrelse i felter er mindst 16 px, ellers zoomer iPhone ind.
- Når jeg trykker i et felt, markeres hele værdien, så jeg kan skrive direkte over den.
- "Næste" på tastaturet flytter fra kg til reps og videre til næste sæts kg.
- Tastaturet må aldrig dække det felt, jeg skriver i.
- Efter ✓ springer fokus ikke ind i et felt. Tastaturet må ikke dukke op af sig selv.

**Afslut:**

- Opsummering: varighed, volumen, antal sæt og nye rekorder. Navn og note kan rettes.
- Har træningen kørt over 3 timer, foreslår appen at rette sluttidspunktet (jeg har sikkert glemt at afslutte).
- Sæt uden ✓: "3 sæt er ikke markeret som færdige. Fjern dem, eller markér dem som færdige?"
- Er træningen startet fra en rutine, og er vægt, reps eller antal sæt ændret: "Opdatér rutinen med dagens værdier?"

**Robusthed:**

- Hver ændring gemmes i IndexedDB med det samme (højst 300 ms debounce).
- Lukkes appen, går telefonen i dvale, eller lukker iOS appen i baggrunden, kan træningen genoptages præcis, hvor jeg slap. Varighed beregnes fra `startedAt`, og pausetimeren fra `endsAt`.
- Der kan kun være én aktiv træning ad gangen.

### 5.3 Pausetimer

- Starter automatisk ved ✓ med øvelsens pausetid.
- Vises som en bjælke nederst: stor nedtælling og knapperne −15 s, +15 s og Spring over.
- Bygger på et sluttidspunkt (`endsAt`), aldrig på en tæller i `setInterval`. Så viser den den rigtige tid, når jeg vender tilbage til appen.
- Ved 0: kort bip via Web Audio (låses op ved første tryk i appen), vibration hvor det understøttes, og en tydelig visuel ændring af bjælken.
- **Vær ærlig om platformen:** En web-app kan ikke pålideligt give lyd eller notifikationer, når skærmen er låst eller appen ligger i baggrunden. iPhone understøtter ikke vibration fra web, og lydløs-knappen kan slå bippet fra. Løsningen er at holde skærmen tændt under træning (afsnit 5.7). Den visuelle advarsel er den primære.

### 5.4 Rutiner

- Opret og redigér: navn, øvelser fra biblioteket, rækkefølge (træk i et tydeligt håndtag, ikke kun long-press), sæt pr. øvelse med mål for kg og reps (gerne interval som 8-10), pausetid pr. øvelse og noter.
- Duplikér, slet (kræver bekræftelse) og sortér.
- "Gem som rutine" fra en afsluttet træning.

### 5.5 Øvelser

- Søgefelt øverst. Søgningen tåler små stavefejl og finder også aliaser. Filter-chips for muskelgruppe og udstyr.
- Er søgefeltet tomt, vises "Senest brugt" øverst.
- "Opret øvelse": navn, type, primær muskel, sekundære muskler og udstyr.
- **Øvelsesside** med tre faner:
  - **Historik:** alle sæt, grupperet pr. træning, nyeste først.
  - **Rekorder:** tungeste vægt, bedste estimerede 1RM, største sæt-volumen (kg x reps), flest reps og største samlede volumen på én træning.
  - **Graf:** estimeret 1RM, tungeste vægt eller volumen over tid. Periode: 3 måneder, 1 år eller alt.

**Beregninger (læg dem i rene funktioner med tests):**

- Estimeret 1RM: Epley, `kg * (1 + reps / 30)`. Ved 1 rep er 1RM lig med vægten. Bruges kun ved 1-12 reps.
- Volumen: summen af kg x reps for færdige sæt. Opvarmningssæt tæller ikke med. Kropsvægtsøvelser tæller kun ekstra kg.
- PR: et færdigt sæt (ikke opvarmning) sammenlignes med alle tidligere afsluttede træninger med samme øvelse. Den igangværende træning tæller ikke som "tidligere".

### 5.6 Historik

- Liste over træninger, nyeste øverst og grupperet pr. måned: navn, dato, varighed, volumen, antal rekorder og øvelserne i kort form.
- Detaljevisning med alle øvelser og sæt. Handlinger: Redigér (samme skærm som aktiv træning), Slet (kræver bekræftelse), Gentag (starter en ny træning med de samme øvelser) og Gem som rutine.

### 5.7 Statistik og indstillinger

**Statistik:**

- Træninger pr. uge (sidste 12 uger)
- Volumen pr. uge
- Sæt pr. muskelgruppe de sidste 7 eller 30 dage (primær muskel tæller 1 sæt, sekundær 0,5)
- Antal træninger i alt og antal uger i træk med mindst én træning

**Indstillinger:**

- kg eller lb, standard pausetid, lyd, vibration, hold skærmen tændt under træning, tema
- "Forrige"-værdier fra: seneste træning med øvelsen (standard) eller seneste træning fra samme rutine
- Eksportér backup (JSON), importér backup, eksportér CSV
- Slet alle data (to bekræftelser, den sidste kræver, at jeg skriver "SLET")
- Appversion, status for vedvarende lagring og datoen for seneste backup

**Hold skærmen tændt:** Brug Screen Wake Lock API (`navigator.wakeLock.request('screen')`), mens en træning er aktiv. Anmod igen ved `visibilitychange`. Fejl stille, hvis det ikke understøttes.

**Backup-påmindelse:** Er seneste eksport over 14 dage gammel, vises et diskret banner på Træn-fanen. Ikke en popup.

---

## 6. MOBIL OG PWA

- **Manifest:** navn og kort navn fra BRIEF, `display: "standalone"`, `orientation: "portrait"`, `theme_color` og `background_color`, der matcher appens baggrund, ikoner i 192 og 512 px plus et maskable ikon på 512 px. Tilføj `apple-touch-icon` på 180 px. Lav et simpelt ikon selv.
- **Service worker:** precache alle app-filer, så appen starter i flytilstand.
- **Opdateringer:** brug `registerType: 'prompt'`. Når en ny version er klar, vises en diskret knap: "Ny version. Genindlæs." **Genindlæs aldrig automatisk, mens en træning er i gang.**
- **Lagring:** kald `navigator.storage.persist()` ved første start, så browseren ikke rydder data. Vis status i indstillinger.
- **Viewport:** `width=device-width, initial-scale=1, viewport-fit=cover`. Brug `env(safe-area-inset-*)`, så bundnavigation og pausetimer ligger over home-indikatoren og indhold ikke gemmer sig under notch eller Dynamic Island.
- Brug `100dvh`, aldrig `100vh`.
- `touch-action: manipulation` (ingen dobbelttryk-zoom), `overscroll-behavior: none` på `body` (ingen pull-to-refresh, der genindlæser midt i træningen) og `-webkit-tap-highlight-color: transparent`.
- Intet må afhænge af hover.
- Brug bottom sheets i stedet for dialoger midt på skærmen.

**iPhone (skal stå i README):**

- Installér via Safari: Del, derefter "Føj til hjemmeskærm".
- På iPhone er data i Safari og data i hjemmeskærm-appen adskilt. Brug kun appen fra hjemmeskærmen.
- Vibration fra web understøttes ikke. Lyd kan være slået fra af lydløs-knappen.
- Wake Lock virker i nyere iOS-versioner. Test det på telefonen.

**Android:** Chrome tilbyder "Installér app". Vibration virker.

---

## 7. DESIGN TIL FITNESSCENTRET

Det her er en app, ikke en landingsside. Ingen hero, ingen marketingsektioner.

- **Mørkt tema som standard,** lyst tema som valg. Det blænder mindre under lysstofrør og sparer strøm på OLED. Ingen ren `#000` eller `#fff`.
- **Touch-mål på mindst 48 x 48 px.** ✓-knappen gerne 56 px. God afstand mellem destruktive knapper og primærknapper.
- **Tommelfinger-zonen:** primære handlinger ligger i den nederste tredjedel af skærmen. De øverste hjørner bruges kun til sekundære ting.
- **Tallene er hovedpersonen:** store, `font-variant-numeric: tabular-nums`, vægt 500-600. Kg og reps skal kunne læses på en armslængdes afstand.
- **Font:** systemfonten (SF Pro på iPhone, Roboto på Android). Den føles native, kræver ingen download og har gode tal.
- **Farver:** én accentfarve til primærknap, færdige sæt og timer. Rød kun til slet og kassér. Én særskilt farve (fx rav) kun til rekorder. WCAG AA som minimum, gerne AAA på tal.
- **Én radius-skala,** fx 12 px på flader og 10 px på knapper og felter. Den følges overalt.
- **Bevægelse kun som feedback:** kort `scale` ved tryk på ✓, rækken skifter tilstand, timerbjælken glider ind. Højst 200 ms. Animér kun `transform` og `opacity`. Respektér `prefers-reduced-motion`. Ingen sideovergange, der forsinker.
- **Ingen pynt:** ingen emojis, gradienter, glassmorphism, motiverende citater eller konfetti. Et kort, roligt rekord-øjeblik er nok.
- **Tekst:** kort og konkret ("Start træning", "Afslut", "Kassér", "Tilføj sæt"). Sentence case. Ingen udråbstegn og ingen tankestreger.
- **Tomme tilstande** har én handling: "Ingen rutiner endnu. Opret rutine."
- **Ingen spinnere** ved lokale data. Det skal føles øjeblikkeligt.

---

## 8. HASTIGHEDSKRAV

Det er her, appen skal slå både papir og Hevy.

- Et sæt med samme værdier som sidst logges med **ét tryk** (✓).
- Et sæt med nye værdier logges med højst 3 tryk plus tallene.
- Fra appikon til første sæt i en rutine: højst 3 tryk.
- Koldstart under 1,5 sekunder på en mellemklasse-telefon. Hold bundlen lille, og lazy-load grafer og statistik.

---

## 9. DATASIKKERHED

Det er min træningshistorik i årevis. Den må aldrig gå tabt ved en opdatering.

- **Hver ændring af Dexie-skemaet** får et nyt versionsnummer og en `upgrade()`-funktion. Slet aldrig tabeller eller felter med data. Test migrationen på en database med data, før den sendes ud.
- **Backup-JSON** indeholder `schemaVersion`, `exportedAt` og alle tabeller. Import valideres med zod og viser en forhåndsvisning ("142 træninger, 87 øvelser, 6 rutiner") før bekræftelse. Vælg mellem "Erstat alt" og "Flet". En backup fra en ældre version migreres ved import.
- **Slet i aktiv træning** (sæt eller øvelse) bruger "Fortryd" i 5 sekunder i stedet for en bekræftelsesdialog. Det er hurtigere.
- **Hevy-import (hvis valgt):** Hevy kan eksportere træninger som CSV fra sine indstillinger. Læs kolonnerne fra den rigtige fil, jeg uploader, i stedet for at gætte dem. Match øvelsesnavne med biblioteket, opret ukendte som egne øvelser, og vis en oversigt over matchningen, før noget gemmes. Håndtér filens datoformat og tidszone eksplicit.

---

## 10. KVALITET OG TEST

- TypeScript strict og ingen `any`.
- **Unit tests (Vitest)** for: estimeret 1RM, PR-detektion, volumen (opvarmning tæller ikke), "Forrige"-opslag, kg/lb-konvertering, komma-parsing ("82,5" giver 82.5), backup round-trip (eksport og derefter import giver identiske data), Dexie-migrationer og Hevy-CSV-parseren (hvis den bygges).
- **E2E (Playwright) i mobil-viewport på 390 x 844:** start rutine, log 3 sæt, pausetimeren starter, genindlæs siden midt i træningen, træningen er der stadig, afslut, og træningen står i historikken med rekord.
- **Offline-test:** byg, server den byggede version, sæt Playwright offline (`context.setOffline(true)`), genindlæs: appen virker.
- **Lever komplet kode.** Ingen `// ...` og ingen "resten følger samme mønster".

---

## 11. HOSTING OG TELEFON

**GitHub Pages (anbefalet):**

- `vite.config.ts`: `base: '/<repo-navn>/'`.
- Et GitHub Actions-workflow, der bygger og udgiver til Pages ved push til `main`.
- HTTPS, som service workers kræver, følger med.
- Gratis GitHub Pages kræver et offentligt repo. Det betyder, at koden er offentlig, men mine træningsdata ligger aldrig i repoet. De ligger kun på telefonen. Vil jeg have et privat repo gratis, så brug Netlify eller Cloudflare Pages.

**Under udvikling:** `npm run dev -- --host` og åbn den viste IP-adresse på telefonen på samme wifi. Service worker og installation virker kun på den udgivne HTTPS-version, så test PWA-delen der.

**README på dansk:** sådan kører jeg appen lokalt, udgiver den, installerer den på iPhone og Android, tager backup og gendanner på en ny telefon.

---

## 12. FØR DU KODER

Skriv kort:

1. Hvilket værktøj og hvilken stak du kører i, og hvad du afviger fra i afsnit 3.
2. Dexie-skemaet med indekser.
3. Mappestrukturen.
4. Listen over startøvelser (navn, alias, muskelgruppe, udstyr), så jeg kan rette den.
5. Er noget i BRIEF uklart, så stil højst ét spørgsmål. Ellers start på fase 0.

---

## 13. ARBEJDSGANG I FASER

Byg én fase ad gangen. Efter hver fase: stop, skriv hvad der virker, og hvad jeg skal teste på telefonen. Vent derefter på mit "videre".

- **Fase 0, fundament:** projekt, manifest og ikoner, service worker, bundnavigation, tema, Dexie-skema, startøvelser og udgivelse.
  *Test: installér på telefonen, slå flytilstand til, åbn appen.*
- **Fase 1, log en træning:** tom træning, tilføj øvelser, sæt-rækker, ✓, varighed, afslut og gem, historik med liste og detalje, genoptag efter genstart.
  *Test: log en rigtig træning i fitnesscentret.*
- **Fase 2, Hevy-flowet:** "Forrige"-kolonne, ✓ med placeholder-værdier, sættyper, pausetimer, wake lock, rutiner (opret, start, opdatér fra træning).
  *Test: kør en hel rutine og se, om ét tryk pr. sæt holder.*
- **Fase 3, fremskridt:** rekorder under træning og i opsummeringen, øvelsessiden med historik, rekorder og graf, statistik.
- **Fase 4, data og finish:** backup-eksport og -import, CSV, Hevy-import (hvis valgt), indstillinger, tomme tilstande, backup-påmindelse, testsuite og README.
- **Fase 5 og frem:** ønsker fra version 2, én ad gangen.

---

## 14. SKILLS (kun i Claude Code)

Hvis du kører i Claude Code, og disse skills findes, så brug dem som opslagsværk:

- `frontend-design` eller `taste-skill` til den visuelle retning. Ignorér deres regler om hero, sektioner og landingssider. Det her er en app, og afsnit 7 vinder.
- `react-best-practices` til komponenter og ydelse.
- `test-driven-development` til beregningerne i afsnit 5.5 og datasikkerheden i afsnit 9.
- `webapp-testing` eller `playwright-skill` til mobil-E2E og offline-test.
- `verification-before-completion`, før en fase meldes færdig.
- `web-design-guidelines` til den afsluttende gennemgang.

Hvis en skill siger noget andet end denne prompt, gælder denne prompt.

---

## 15. TJEKLISTE (efter hver fase)

Gå listen igennem, før du melder en fase færdig. Ret alt, der fejler.

- [ ] Virker i 390 px bredde, og jeg har fået besked om, hvad jeg skal teste på min telefon
- [ ] Virker i flytilstand efter første indlæsning
- [ ] Et sæt med samme værdier som sidst kan logges med ét tryk
- [ ] Træningen overlever genindlæsning, lukning af appen og låst skærm
- [ ] Pausetimeren viser den rigtige tid, når appen har været i baggrunden
- [ ] Både komma og punktum virker i kg-feltet
- [ ] Ingen felter under 16 px og ingen touch-mål under 48 px
- [ ] Intet ligger under notch, Dynamic Island eller home-indikator
- [ ] Ingen automatisk genindlæsning under en aktiv træning
- [ ] Skemaændringer har en migration, og eksisterende data er bevaret
- [ ] Backup, slet alt, import giver præcis de samme data
- [ ] Alle tests er grønne

---

## 16. OPFØLGNINGSPROMPTS

Brug dem, når du har prøvet appen i fitnesscentret.

**Noget var bøvlet:**
> Jeg har trænet med appen. Det her var bøvlet: [beskriv]. Ret det. Ændr kun datamodellen, hvis det er nødvendigt, og så med migration. Følg master-prompten.

**Ny funktion:**
> Byg [funktion] fra version 2 i master-prompten. Skriv først kort, hvordan den passer ind i datamodellen og skærmene, og vent på mit "videre".

**Fejl:**
> Det her gik galt: [beskriv, gerne med skærmbillede]. Find årsagen, før du ændrer noget. Skriv en test, der fanger fejlen, og ret den derefter.

**Før en større ændring:**
> Før du ændrer databasen: vis mig migrationen, og bekræft, at mine eksisterende data bevares. Mind mig om at tage en backup først.
