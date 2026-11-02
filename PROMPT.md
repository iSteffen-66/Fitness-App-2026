# Auftrag: Fitness-Trainings-App (PWA) für das Smartphone

## Ziel
Baue eine Web-App, die ich auf dem Smartphone (vermutlich iPhone/Safari) zum Home-Bildschirm hinzufüge und im Fitnessstudio offline nutze. Sie führt mich Schritt für Schritt durch mein Trainingsprogramm. Für jeden Abschnitt zeigt sie, was ich tun soll und wie lange. Ich bestätige, was ich tatsächlich gemacht habe: Wiederholungen, Gewicht und Dauer. Den Plan kann ich jederzeit bearbeiten.

Ich bin technisch versiert, aber kein Programmierer. Erkläre Schritte, die ich selbst ausführen muss, mit kopierbaren Befehlen.

## Arbeitsweise
- Beschreibe zuerst kurz deinen Plan: Stack, Datenmodell, Screens. Setze ihn danach direkt um, ohne auf meine Freigabe zu warten.
- Frage nur nach, wenn eine Entscheidung das Ergebnis wesentlich verändert.
- Veröffentliche nichts (kein Deployment, keine Änderung der Sichtbarkeit des Repos) ohne meine ausdrückliche Freigabe. Bereite das Deployment nur vor und erkläre es.

## Technische Vorgaben
- Kein Server, kein Konto, keine externen Dienste. Alle Daten lokal im Browser (IndexedDB, nicht nur localStorage).
- Einfacher, wartbarer Stack. Begründe deine Wahl in 2–3 Sätzen.
- PWA: Manifest, Service Worker, App-Icon, vollständig offline nutzbar nach dem ersten Laden.
- Bildschirm während des Trainings wach halten (Screen Wake Lock API, mit Fallback-Hinweis falls nicht unterstützt).
- Timer-Ende: Ton und, wo unterstützt, Vibration. Timer müssen korrekt weiterlaufen, wenn das Display kurz aus war: Zeitstempel verwenden, nicht Intervall-Zählen.
- Fotos: Die Gerätefotos liegen bereits benannt in `./fotos` (Zuordnung in `fotos/ZUORDNUNG.md`, Dateiname beginnt mit der Übungsnummer). Korrigiere die Ausrichtung (EXIF), verkleinere auf max. 1200 px Breite, konvertiere nach WebP/JPEG und binde sie als Standardbilder ein. Die Originale bleiben unverändert. Zusätzlich muss ich pro Übung ein eigenes Foto aufnehmen oder hochladen und das Standardbild ersetzen können. Eigene Fotos werden in IndexedDB gespeichert.
- Oberfläche auf Deutsch, Dark Mode, große Bedienelemente (mind. 48 px), mit einer Hand bedienbar, optimiert für ca. 390 px Breite.

## Funktionen
1. **Trainingsmodus (Anleitung)**
   - Start → Ablauf Block für Block mit Gesamtuhr und Soll-Zeitfenster (z. B. „10–16 min“). Hinweis, wenn ich hinter dem Zeitplan liege.
   - Je Übung: Foto, Name, Gerät, Technikhinweis, Soll-Sätze mit Soll-Wiederholungen und Soll-Gewicht.
   - Je Satz: Felder für Ist-Wiederholungen und Ist-Gewicht, vorbelegt mit dem Sollwert bzw. meinem letzten Wert. Ein Tipp auf „Erledigt“ bestätigt den Satz und startet automatisch den Pausentimer.
   - Übungen „je Seite“ oder „je Arm“ (z. B. 9, 14): Sätze für links und rechts getrennt erfassen.
   - Supersätze und Zirkel: Übungen in der festgelegten Reihenfolge abwechselnd anzeigen, Pause erst nach der Runde.
   - Cardio: Countdown-Timer mit Feld für tatsächliche Dauer und optional Gerät/Notiz.
   - Übung überspringen, zurückgehen, Training pausieren und vorzeitig beenden.
   - Ist bei einer Übung kein Soll-Gewicht hinterlegt (Übung 14), fordere beim ersten Satz zur Eingabe auf und übernimm den Wert als neues Soll.
   - Am Ende: Zusammenfassung mit Dauer, erledigten Sätzen und Gesamtvolumen (kg × Wdh.).
2. **Verlauf**
   - Liste aller Trainings mit Datum und Dauer, Detailansicht.
   - Einzelne Sätze, Übungen oder ganze Trainings bearbeiten und löschen, mit Rückfrage vor dem Löschen.
   - Pro Übung: letzter Wert und einfacher Verlauf des Arbeitsgewichts.
   - Steigerungshinweis: Wurden beim letzten Mal alle Arbeitssätze mit voller Wiederholungszahl geschafft, die nächste Gewichtsstufe vorschlagen. Die Stufe ist pro Übung einstellbar, Standard 2,5 kg bzw. 5 kg am Steckgewicht.
3. **Plan-Editor**
   - Übungen und Blöcke hinzufügen, ändern, löschen, per Drag & Drop oder Pfeiltasten umsortieren.
   - Pro Übung bearbeitbar: Name, Gerät, Foto, Technik, Aufwärmsatz, Arbeitssätze (Wdh., Gewicht, Einheit „kg“, „kg je Seite“ oder „kg je Arm“), Pausendauer, Supersatz-/Zirkel-Gruppe, Kennzeichen „optional“.
   - Die Übungsnummer ist eine feste ID (gehört zum Foto), die Reihenfolge ist davon unabhängig.
   - Zeitplan der Blöcke anpassen. Die Gesamtdauer wird automatisch berechnet.
   - Plan auf die Ausgangsversion zurücksetzen.
4. **Datensicherung**
   - Export und Import aller Daten (Plan, Verlauf, eigene Fotos) als eine JSON-Datei. Zusätzlich CSV-Export des Verlaufs.
   - Gut sichtbarer Hinweis, dass Browserdaten auf iPhones verloren gehen können und regelmäßige Exporte empfohlen sind.

## Startdaten (Ausgangsplan, 75 Minuten)
Schema je Übung: 1 Aufwärmsatz mit ca. 50 % Gewicht × 10, dann 2 Arbeitssätze × 10. Pausen 60–90 s nach Arbeitssätzen, 30 s nach dem Aufwärmsatz. Im Supersatz/Zirkel keine Pause zwischen den Übungen. „je Seite“ = Scheiben pro Seite. Die Tabelle ist in Trainingsreihenfolge sortiert, „Nr“ ist die feste Übungs-/Foto-Nummer.

| Zeit | Block | Nr | Übung | Foto | Aufwärmen | Arbeitssätze | Technik |
|---|---|---|---|---|---|---|---|
| 0–10 | Cardio | – | Cardio Aufwärmen | – | – | 10 min locker bis mittel | Rad, Crosstrainer oder Laufband |
| 10–16 | A Drücken | 1 | Bankdrücken liegend | 01 | 10 × ohne Scheiben | 2 × 10, 10 kg je Seite | Schulterblätter zusammen, Füße fest |
| 16–21 | A Ziehen | 2 | Enges Rudern | 02 | 10 × 7,5 kg | 2 × 10, 15 kg | Sitzhöhe Stufe 3, Brust ans Polster |
| 21–26 | A Drücken | 4 | Schulterdrücken | 04 | 10 × 20 kg | 2 × 10, 30 kg | Rücken fest ans Polster |
| 26–31 | A Ziehen | 3 | Latzug | 03 | 10 × 15 kg je Seite | 2 × 10, 20 kg je Seite | Beine einklemmen, nur Fingerspitzen, zur Brust ziehen |
| 31–38 | B Supersatz | 5 | Butterfly | 05 | 10 × 20 kg | 2 × 10, 40 kg | Fingerspitzen vorne zusammen, Rücken anlegen |
| 31–38 | B Supersatz | 6 | Reverse Butterfly | 06 | 10 × 20 kg | 2 × 10, 30 kg | Arme weit nach hinten, Schultern tief |
| 38–42 | B Brust (optional) | 10 | Kabel-Butterfly frei | 10 | 10 × 10 kg | 2 × 10, 15 kg | Leicht gebeugte Arme, Hände vor dem Körper |
| 42–50 | C Supersatz | 7 | Scott-Curl SZ-Stange | 07 | 5 × unten bis Mitte, 5 × Mitte bis oben, 5 × voll, ohne Scheiben | 1 × 10 + 1 × 5, 2 × 5 kg | Oberarme ganz aufs Polster, langsam ablassen |
| 42–50 | C Supersatz | 8 | Trizepsdrücken am Seil | 08 | 10 × 10 kg | 2 × 10, 25 kg | Ellbogen am Körper, Seil bis unter die Hüfte |
| 50–54 | C Bizeps | 9 | Kabel einarmig (Bizeps-Curl) | 09 | 10 × 10 kg je Arm | 2 × 10, 20 kg je Arm | Ellbogen fixiert, ohne Schwung |
| 54–64 | D Zirkel (2 Runden, 60 s Pause nach jeder Runde) | 13 | Bauchmaschine | 13 | 10 × 20 kg | 2 × 10, 40 kg | Aus dem Bauch einrollen |
| 54–64 | D Zirkel | 11 | Waden sitzend | 11 | – | 20 × ohne Gewicht | Ganz runter, ganz hoch |
| 54–64 | D Zirkel | 14 | Bauch schräg (Winkel links/rechts verstellbar) | 14 | – | 2 × 10 je Seite, Gewicht offen | Becken fixiert, Drehung aus dem Rumpf, Winkel je Seite umstellen |
| 54–64 | D Zirkel | 12 | Bauch ohne Gewicht | – | – | 10 gerade, je 10 links/rechts, 10 gerade | Lendenwirbelsäule am Boden |
| 64–65 | Puffer | – | Wechselzeit, Trinken | – | – | 1 min | – |
| 65–75 | Ausklang | – | Cardio locker + Dehnen | – | – | 10 min, dann Brust, Schulter, Waden dehnen | – |

Übung 12 hat kein Foto: zeige ein neutrales Platzhaltersymbol.

## Erfolgskriterien und Prüfung
- Ein komplettes Training lässt sich auf 390 px Breite ohne horizontales Scrollen durchklicken. Alle Sätze werden gespeichert und erscheinen im Verlauf.
- Nach Neuladen und im Flugmodus sind Plan, Verlauf und Fotos vorhanden.
- Bearbeiten und Löschen funktioniert für Planübungen, Sätze und ganze Trainings.
- Export → Daten löschen → Import stellt alles wieder her.
- Timer stimmen nach 2 Minuten Display-aus noch.
- Schreibe automatisierte Tests für Datenlogik (Speichern, Bearbeiten, Steigerungsvorschlag, Export/Import, Timerberechnung) und führe sie aus.
- Prüfe die Oberfläche in einem mobilen Viewport (z. B. Playwright, 390 × 844) und behebe Darstellungsfehler.

## Abschluss
- Liefere eine kurze README auf Deutsch: lokal starten, auf dem iPhone testen, Daten sichern.
- Schlage 2 Wege vor, die App per HTTPS aufs Handy zu bringen (z. B. GitHub Pages oder Netlify), mit Vor- und Nachteilen und exakten Schritten. Führe keinen davon ohne meine Freigabe aus.
- Nenne offen, was nicht getestet werden konnte, insbesondere das Verhalten in Safari auf einem echten iPhone.
