# Løft

Personlig træningslogger til telefonen, bygget efter `master-prompt-traeningsapp.md`.
Appen ligger på https://carlelg04.github.io/loeft/ og bygges fra repoet `Carlelg04/loeft`.
Inspireret af arbejdsgangen i Hevy, men uden login, server eller reklamer. Alle data ligger kun på telefonen, og appen virker uden net.

## Det kan den

- Start en tom træning eller en rutine. Push day og Pull day ligger klar med dine topsæt som mål.
- Log sæt med ét tryk: tomme felter tager rutinens mål eller det, du løftede sidst.
- Kolonnen "Forrige" viser sidste gang, samme sæt. Opvarmning matches med opvarmning.
- Sættyper: opvarmning (O), failure (F) og dropsæt (D). Tryk på sætnummeret.
- Pausetimeren starter automatisk og viser rigtig tid, også når appen har været i baggrunden.
- Maskine optaget (⋮ på øvelsen): øvelsen foldes sammen og lægger sig nederst. Bliver maskinen ledig, trykker du "Ledig nu". Ellers gemmes intet for den, og næste gang viser "Forrige" stadig dine sidste tal.
- Rekorder opdages, mens du træner (tungeste vægt, estimeret 1RM, sæt-volumen, flest reps, mindst hjælp).
- Historik, øvelsesside med graf, statistik pr. uge og pr. muskelgruppe.
- Backup som JSON (eksport, import, flet eller erstat) og CSV-eksport.
- Skærmen holdes tændt under træning.

## Kør den lokalt

```bash
npm install
npm run dev        # åbn adressen på telefonen på samme wifi
npm test           # unit tests (Vitest)
npm run e2e        # E2E i mobilstørrelse (Playwright), bygger først
npm run build      # færdig app i dist/
```

Service worker og installation virker kun på den udgivne HTTPS-version, ikke over wifi-adressen.

## Udgiv på GitHub Pages (gratis)

Gratis GitHub Pages kræver et offentligt repo. Koden bliver offentlig, men dine træningsdata kommer aldrig i repoet. De ligger kun på telefonen.

1. Opret et nyt offentligt repo, fx `loeft`.
2. Læg indholdet af denne mappe i roden af repoet, og push til `main`.
3. På GitHub: Settings, Pages, Source: **GitHub Actions**.
4. Workflowet i `.github/workflows/deploy.yml` tester, bygger og udgiver. Adressen bliver `https://<brugernavn>.github.io/loeft/`.

Vil du have et privat repo gratis, så brug Netlify eller Cloudflare Pages. Byg-kommando `npm run build`, mappe `dist`.

## Installér på telefonen

**iPhone:** Åbn adressen i Safari, tryk Del, derefter "Føj til hjemmeskærm".

- Brug kun appen fra hjemmeskærmen. På iPhone er data i Safari og data i hjemmeskærm-appen adskilt.
- iPhone understøtter ikke vibration fra web, og lydløs-knappen kan slå bippet fra. Derfor holdes skærmen tændt, og timeren skifter farve, når pausen er slut.

**Android:** Åbn adressen i Chrome, og vælg "Installér app".

## Backup og ny telefon

Indstillinger (tandhjulet på Statistik), derefter **Eksportér backup**. På iPhone åbner delingsmenuen, vælg "Gem i Filer".
Appen minder dig om det på Træn-fanen, når der er gået 14 dage.

Ny telefon: installér appen, gå til Indstillinger, **Importér backup**, og vælg filen.

## Til den næste, der ændrer i koden

- Datalaget er Dexie (IndexedDB), se `src/db/`. Al vægt gemmes i kg.
- **Hver ændring af skemaet** får et nyt `version(n)` med en `upgrade()`-funktion i `src/db/db.ts`. Slet aldrig tabeller eller felter med data. Hæv `SCHEMA_VERSION`, og migrér gamle backups i `src/lib/backupParse.ts`.
- Beregninger (1RM, volumen, rekorder, "Forrige") ligger som rene funktioner i `src/lib/calc.ts` og `src/lib/sets.ts` med tests i `tests/`.
- Opdateringer genindlæser aldrig appen af sig selv. Brugeren får en knap, og den vises ikke under en træning.
- Ikonerne laves med `node scripts/make-icons.mjs`.
