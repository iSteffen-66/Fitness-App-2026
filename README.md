# Training – Fitness-App 2026

Trainingsbegleiter fürs Fitnessstudio als PWA: führt Block für Block durch den 75-Minuten-Plan, erfasst Wiederholungen, Gewicht und Dauer, plant Pausen und speichert alles lokal im Browser (IndexedDB). Nach dem ersten Laden vollständig offline nutzbar. Der Auftrag steht in `PROMPT.md`.

## Aufbau

```
app/            die App (statische Dateien, kein Build-Schritt)
  index.html, style.css, manifest.webmanifest, sw.js
  js/logic.js   reine Logik: Schritte, Timer, Steigerung, Export/Import, CSV
  js/seed.js    Ausgangsplan
  js/db.js      IndexedDB-Speicher (+ Memory-Adapter für Tests)
  js/app.js     Oberfläche
  img/          Standardbilder (WebP, max. 1200 px), aus fotos/ erzeugt
fotos/          Originalfotos (unverändert)
tools/          make-images.py (Fotos → WebP), make-icons.py
tests/          logic.test.js (Node), e2e.mjs (Playwright, 390 × 844)
deploy/         Beispiel-Workflow für GitHub Pages (inaktiv)
```

**Stack:** Reines JavaScript (ES-Module) ohne Framework und ohne Build. Das ist für eine Ein-Personen-App mit wenigen Screens am wartbarsten: kein Node-Toolchain-Zwang, der Ordner `app/` ist direkt hostbar, und Safari-Verhalten (Service Worker, Wake Lock) lässt sich ohne Übersetzungsschicht nachvollziehen.

## Lokal starten

```
cd Fitness-App-2026
python3 -m http.server 8080 --directory app
```

Dann `http://localhost:8080` öffnen. (Service Worker und Wake Lock funktionieren nur über `localhost` oder HTTPS.)

## Tests

```
node --test tests/logic.test.js                      # Datenlogik, 49 Tests
npm start &                                          # Webserver auf Port 8080
NODE_PATH=$(npm root -g) node tests/e2e.mjs          # Oberfläche im Handy-Viewport, offline, Export/Import, Timer
```

Standardbilder neu erzeugen (nach neuen Fotos in `fotos/`, Dateiname beginnt mit der Übungsnummer): `python3 tools/make-images.py`. Danach `app/sw.js` anpassen (Dateiliste und `CACHE`-Version erhöhen).

## Live-Adresse und Updates

Die App läuft auf Firebase Hosting: **https://fitness-app-2026-fc0ae.web.app** (Projekt `fitness-app-2026-fc0ae`).

Update veröffentlichen:
1. In `app/sw.js` die Konstante `CACHE` hochzählen (z. B. `training-v3`), sonst laden installierte Apps die alte Version.
2. `npm install -g firebase-tools` (einmalig), `firebase login`, dann im Repo-Ordner `firebase deploy --only hosting`.
3. Auf dem iPhone die App schließen und neu öffnen, ggf. ein zweites Mal: Der Service Worker lädt die neue Version im Hintergrund und zeigt sie beim nächsten Start.

## Auf dem iPhone testen

1. Die App über HTTPS aufrufen (siehe unten) in **Safari**.
2. Teilen-Symbol → **Zum Home-Bildschirm**. Die App nur von dort aus starten (nur so greift der Standalone-Modus).
3. Einmal mit Internet öffnen und kurz warten, bis alles geladen ist. Danach Flugmodus testen.
4. Training starten, Display sperren/entsperren: Uhr und Timer müssen weiterlaufen.

## Daten sichern

Alle Daten liegen nur in diesem Browser. **Safari kann sie auf dem iPhone löschen** (Speicherknappheit, lange nicht genutzt, „Websitedaten löschen“). Daher: Tab **Sicherung** → **Alles exportieren (JSON)** und die Datei in iCloud/Dateien ablegen. Das passiert am besten nach jedem Training oder mindestens wöchentlich. Import ersetzt alle Daten durch den Inhalt der Datei. Der Verlauf lässt sich zusätzlich als CSV exportieren (Semikolon, Dezimalkomma, für Excel).

## Gerät belegt? Reihenfolge im Training ändern

Im Training öffnet **„Gerät belegt?“** (bei Cardio: „Später / andere Übung“) eine Auswahl:
- **Später machen:** Die aktuelle Übung rückt hinter die nächste offene Übung. Mehrfach tippen schiebt sie weiter nach hinten.
- **Stattdessen jetzt machen:** Jede offene Übung lässt sich vorziehen.
- **Auslassen:** Die Übung wird übersprungen, bleibt aber offen und lässt sich jederzeit über dieselbe Auswahl nachholen. Am Ende fragt die App nach noch offenen Übungen.

Supersätze, Zirkel und Blöcke mit „Abwechselnd“ werden als Ganzes verschoben, damit das Abwechseln erhalten bleibt. Bereits erfasste Sätze bleiben gespeichert, verschoben werden nur offene Sätze.

## Wechselzeit zwischen Blöcken

Zwischen zwei Blöcken läuft automatisch eine **Wechselzeit von 1 Minute** (Anzeige „Wechselzeit → nächster Block“), z. B. für den Weg in einen anderen Bereich des Studios.
- Standard für den ganzen Plan: Plan → „Wechselzeit zwischen Blöcken (s)“.
- Je Block abweichend: Block antippen → „Wechselzeit danach (s)“ (leer = Standard, 0 = direkt weiter).
- Die Zeitfenster der Blöcke enthalten die Wechselzeiten. Nach Änderungen „Zeiten lückenlos“ tippen.
- Pläne ohne eigene Angabe (z. B. ältere Sicherungen) nutzen ebenfalls 1 Minute.

Ausgangsplan = dein Trainingsplan (Stand 27.11.2026, Gesamtdauer mit Wechselzeiten 93 Minuten):

| Block | Übungen | Ablauf |
|---|---|---|
| Cardio Aufwärmen | – | 10 min |
| A Roter Käfig | 1 Bankdrücken, 2 Arm ziehen, 3 Enges Rudern, 14 Bauch schräg | nacheinander, 1 min Gerätewechsel, 23 min |
| B freie Gewichte | 21 SZ-Stange frei stehend, 8 Trizepsdrücken am Seil | abwechselnd, 3 Runden, 8 min |
| B Dehnen 1/2, 2/2 | – | 2 × 5 min, direkt hintereinander |
| C Beine & Maschinen | 11 Waden, 18 Abduktoren, 16 Beinpresse, 5 Butterfly, 6 Reverse Butterfly, 15 Rückenstrecker, 17 Beinbeuger, 20 Bauchmuskel | nacheinander, 30 s Gerätewechsel, 30 min |
| Ausklang | – | 7 min |

„Plan auf Ausgangsversion zurücksetzen“ stellt genau diesen Plan wieder her. Eigene Fotos und Verlauf bleiben dabei erhalten. Der frühere Ausgangsplan dient nur noch den automatischen Tests (`tests/fixtures/ausgangsplan-bis-2026-11-07.json`).

**Wechselzeit zwischen den Übungen eines Blocks** (Ablauf „nacheinander“): Block antippen → „Wechselzeit zwischen den Übungen“. Sie ersetzt nach dem letzten Satz einer Übung deren normale Pause; die Anzeige lautet dann „Wechsel → nächste Übung“. Leer = Pause der Übung wie bisher.

## Übungen abwechselnd trainieren

Plan → Block antippen → **Ablauf**:
- **Einzeln nacheinander** (`single`): alle Sätze einer Übung, dann die nächste.
- **Abwechselnd** (`alternate`, Satzpaare): erst alle Aufwärmsätze der Blockübungen, dann Runde 1 (Satz 1 jeder Übung), Runde 2 (jeweils Satz 2) usw. Übungen mit weniger Sätzen fallen in späteren Runden weg, ebenso optionale Übungen, die beim Start abgewählt oder im Training ausgelassen werden.
  - Pause innerhalb der Runde: 30 s Wechselpause.
  - Nach dem letzten Satz einer Runde: „Pause nach der Runde“ des Blocks; ist das Feld leer, die Pause der zuletzt gemachten Übung. Nach der letzten Runde (Blockende) gibt es keine Pause, wie bei allen Blöcken.
  - Wird die letzte Übung einer Runde ausgelassen, wird die laufende Wechselpause zur Rundenpause (gerechnet ab Ende des letzten Satzes).
  - Anzeige: Foto, Übung, „Runde x/y“ und „Als Nächstes“ mit der folgenden Übung und Pause.
- **Supersatz:** gleiche Reihenfolge, Pause erst nach jeder Runde (größte Übungspause).
- **Zirkel:** alle Übungen je Runde, feste Rundenzahl, Pause nach der Runde.

Welche Übungen abwechseln, legst du fest, indem du sie in denselben Block legst (Übung bearbeiten → Feld „Block“). Die Reihenfolge im Block bestimmt, welche zuerst kommt.

Im Training lassen sich über „Gerät belegt?“ auch **einzelne Sätze** auslassen („Nur diesen Satz auslassen“); mit „Zurück“ kannst du einen ausgelassenen Satz doch noch erfassen.

## Plan auf mehreren Geräten nutzen

Jedes Gerät speichert seine Daten getrennt. Einen geänderten Plan überträgst du so:

1. Auf dem Gerät mit dem geänderten Plan: **Sicherung → Plan auf andere Geräte übertragen → „Plan teilen“** (z. B. per AirDrop oder in „Dateien“ sichern) oder **„Plan exportieren“**. Vom Plan-Tab führt der Knopf „Plan auf andere Geräte übertragen“ direkt dorthin.
2. Auf dem anderen Gerät: **Sicherung → „Plan importieren“** und die Datei `training-plan-JJJJ-MM-TT.json` wählen.

Dabei gilt:
- Übernommen werden Plan und eigene Fotos der Übungen im Plan. Für diese Übungen gilt danach genau der Stand der Datei (eigenes Foto oder Standardbild).
- Verlauf und Sicherungsdatum auf dem Zielgerät bleiben unverändert.
- Ein laufendes Training nutzt den neuen Plan erst beim nächsten Start.
- „Plan importieren“ akzeptiert auch eine vollständige Sicherung und übernimmt daraus nur den Plan. Umgekehrt weist „Sicherung importieren“ eine Plan-Datei ab, weil sie sonst den Verlauf löschen würde.

## Bedienung in Kürze

- **Start:** „Training starten“. Die Cardio-Blöcke starten ihren Countdown automatisch.
- **Satz:** Wiederholungen und Gewicht sind vorbelegt (letzter Wert, sonst Soll). „Erledigt“ speichert und startet die Pause.
- **Supersatz/Zirkel:** Übungen wechseln sich ab, Pause erst nach der Runde. Übungen „je Seite/Arm“ erfassen links und rechts getrennt.
- **Übung 14** hat kein Soll-Gewicht: Der erste eingegebene Wert wird zum neuen Soll.
- **Verlauf:** Trainings und Sätze bearbeiten oder löschen; Tab „Übungen“ zeigt den Gewichtsverlauf und den Steigerungshinweis.
- **Plan:** jede Übung mit Vorschaubild (eigenes Foto, Standardbild oder Platzhalter); Übungen/Blöcke ändern, per ☰ ziehen oder mit Pfeilen sortieren, Fotos ersetzen, Zeiten anpassen, Ausgangsplan wiederherstellen.

## Annahmen im Plan (bitte prüfen)

- **Scott-Curl „2 × 5 kg“:** als 5 kg je Seite (Scheiben) angelegt. Falls 5 kg insgesamt gemeint sind, im Plan-Editor Einheit auf „kg“ stellen.
- **Steigerungsstufe:** 2,5 kg bei „kg je Seite“ (Scheiben), 5 kg bei „kg“ und „kg je Arm“ (Steckgewicht). Pro Übung einstellbar.
- **Volumen:** Gewicht × Wiederholungen aller Arbeitssätze, Gewicht wie eingegeben (bei „je Seite“ also nicht verdoppelt). Aufwärmsätze zählen nicht.
- **Pausen:** 90 s nach Arbeitssätzen bei Übung 1–4, sonst 60 s; 30 s nach Aufwärmsätzen; Zirkel D 60 s nach jeder Runde. Nach dem letzten Satz eines Blocks gibt es keine Pause (der Zeitplan enthält die Wechselzeit).
- **Übung 14** ist laut `PROMPT.md` Teil von Zirkel D. `fotos/ZUORDNUNG.md` nennt sie noch „zusätzliches Gerät“; der Prompt hat Vorrang.
- Gerätenamen und Technikhinweise: Technik aus `PROMPT.md`, Gerätenamen aus den Fotos abgeleitet. Alles im Plan-Editor änderbar.
- Die Zuordnung der Fotos 04 (Schulterdrücken) und 06 (Reverse Butterfly) war in `ZUORDNUNG.md` als „unsicher“ markiert. Im Plan-Editor lässt sich ein Foto je Übung ersetzen.

## App per HTTPS aufs Handy bringen (nicht ausgeführt, nur vorbereitet)

Ohne deine Freigabe wurde nichts veröffentlicht.

### Weg A: Netlify Drop (empfohlen, am schnellsten)

Vorteile: keine Änderung am Repo, Repo kann privat bleiben, HTTPS sofort, kostenlos. Nachteil: Updates sind Handarbeit (Ordner erneut hochladen); die Adresse ist öffentlich erreichbar (zufälliger Name), enthält aber nur Gerätefotos und keine persönlichen Daten.

1. Auf https://app.netlify.com/drop gehen (Konto anlegen oder anmelden).
2. Den Ordner `app/` aus dem Repo (nicht das ganze Repo) in das Feld ziehen.
3. Die angezeigte Adresse `https://….netlify.app` auf dem iPhone in Safari öffnen und zum Home-Bildschirm hinzufügen.
4. Update: in Netlify unter „Deploys“ den geänderten Ordner erneut hochladen. Vorher `CACHE` in `app/sw.js` erhöhen, sonst liefert der Service Worker die alte Version.

### Weg B: GitHub Pages

Vorteile: Updates laufen automatisch bei jedem Push auf `main`. Nachteile: Pages auf **privaten** Repos erfordert einen kostenpflichtigen GitHub-Tarif; im kostenlosen Tarif muss das Repo **öffentlich** sein (inklusive `fotos/` und `PROMPT.md`). Das Umstellen der Sichtbarkeit nur nach eigener Entscheidung.

1. Repo-Sichtbarkeit klären (öffentlich oder bezahlter Tarif).
2. `deploy/github-pages.yml.example` nach `.github/workflows/pages.yml` kopieren und committen.
3. Im Repo: **Settings → Pages → Source: GitHub Actions**.
4. Nach dem Push auf `main` läuft die Action. Die Adresse lautet `https://<benutzer>.github.io/<repo>/`. Die App nutzt relative Pfade und läuft deshalb auch in diesem Unterpfad.

## Nicht getestet / offen

- **Safari auf einem echten iPhone:** nicht getestet (nur Chromium mit 390 × 844 Viewport, simulierte Uhr). Besonders prüfen: Zum-Home-Bildschirm-Installation, Offline-Start aus dem Home-Bildschirm, Speicherverhalten (siehe Sicherung), Foto aufnehmen/auswählen, Drag & Drop per Touch (die Pfeiltasten sind der verlässliche Weg), Dateidownload der Sicherung.
- **Ton und Vibration:** Ton ist nur nach einer Berührung der Seite erlaubt und kommt nicht, solange das Display aus ist; der Timer ist dann trotzdem korrekt und meldet sich beim Entsperren. iOS-Safari unterstützt `navigator.vibrate` nicht.
- **Display wach halten:** Screen Wake Lock wird verwendet, sofern unterstützt (iOS ab 16.4; in der Home-Bildschirm-App gab es bis iOS 18.3 einen Fehler). Wenn nicht verfügbar, zeigt die App einen Hinweis. Im Test-Chromium schlug die Anforderung ebenfalls fehl; die Wake-Lock-Funktion selbst wurde daher nicht erfolgreich geprüft.
- Die Sicherung per „Teilen“-Dialog und der Export-Download wurden nur in Chromium geprüft.
