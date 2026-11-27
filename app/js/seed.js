// Ausgangsplan = Steffens Trainingsplan (Stand 27.11.2026, vom iPhone übernommen).
// Übungsnummer = feste ID (gehört zum Foto und zum Verlauf), Reihenfolge im Plan ist davon unabhängig.
// Eigene Fotos (z. B. Übungen 11, 15–20) liegen nur auf dem Gerät und bleiben beim Zurücksetzen erhalten.
// Der frühere Ausgangsplan liegt als Testvorlage in tests/fixtures/ausgangsplan-bis-2026-11-07.json.
export const PLAN_VERSION = 1;

const PLAN = {
  "version": 1,
  "blocks": [
    {
      "id": "b01",
      "name": "Cardio Aufwärmen",
      "start": 0,
      "end": 10,
      "kind": "timed",
      "mode": "single",
      "items": [],
      "minutes": 10,
      "note": "Rad oder Crosstrainer, locker bis mittel; Laufband nur gehen, nicht laufen"
    },
    {
      "id": "b02",
      "name": "A Roter Käfig",
      "start": 11,
      "end": 34,
      "kind": "sets",
      "mode": "single",
      "items": [
        1,
        2,
        3,
        14
      ],
      "rounds": 1,
      "roundRest": 60,
      "switchRest": 60,
      "changeAfter": null
    },
    {
      "id": "b09",
      "name": "B freie Gewichte",
      "start": 35,
      "end": 43,
      "kind": "sets",
      "mode": "alternate",
      "items": [
        21,
        8
      ],
      "rounds": 1,
      "roundRest": null
    },
    {
      "id": "b09d1",
      "name": "B Dehnen 1/2",
      "start": 44,
      "end": 49,
      "kind": "timed",
      "mode": "single",
      "items": [],
      "minutes": 5,
      "note": "Dehnungsübungen, 5 min",
      "changeAfter": 0
    },
    {
      "id": "b09d2",
      "name": "B Dehnen 2/2",
      "start": 49,
      "end": 54,
      "kind": "timed",
      "mode": "single",
      "items": [],
      "minutes": 5,
      "note": "Dehnungsübungen, 5 min"
    },
    {
      "id": "b13",
      "name": "C Beine & Maschinen",
      "start": 55,
      "end": 85,
      "kind": "sets",
      "mode": "single",
      "items": [
        11,
        18,
        16,
        5,
        6,
        15,
        17,
        20
      ],
      "rounds": 1,
      "roundRest": 60,
      "changeAfter": 30,
      "switchRest": 30
    },
    {
      "id": "b12",
      "name": "Ausklang",
      "start": 86,
      "end": 93,
      "kind": "timed",
      "mode": "single",
      "items": [],
      "minutes": 7,
      "note": "6Min. Cardio locker",
      "changeAfter": null
    }
  ],
  "exercises": {
    "1": {
      "id": 1,
      "name": "Bankdrücken liegend",
      "device": "Bank liegend mit Scheiben",
      "tech": "Schulterblätter zusammen, Füße fest",
      "photo": "img/01.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 11.25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 11.25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 11.25,
          "text": ""
        }
      ],
      "unit": "kg je Seite",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 1.25,
      "optional": false
    },
    "2": {
      "id": 2,
      "name": "Arm ziehen",
      "device": "Zugmaschine",
      "tech": "",
      "photo": "img/02.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 32.5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 32.5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 32.5,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "3": {
      "id": 3,
      "name": "Enges Rudern",
      "device": "",
      "tech": "",
      "photo": "img/03.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 31.25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 31.25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 31.25,
          "text": ""
        }
      ],
      "unit": "kg je Seite",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 1.25,
      "optional": false
    },
    "5": {
      "id": 5,
      "name": "Butterfly",
      "device": "Butterfly-Maschine",
      "tech": "Fingerspitzen vorne zusammen, Rücken anlegen; nur wenn Zeit übrig",
      "photo": "img/05.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 42.5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 42.5,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "6": {
      "id": 6,
      "name": "Reverse Butterfly",
      "device": "Reverse-Butterfly-Maschine",
      "tech": "Arme weit nach hinten, Schultern tief",
      "photo": "img/06.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 42.5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 42.5,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "8": {
      "id": 8,
      "name": "Trizepsdrücken am Seil",
      "device": "Kabelturm mit Seilgriff",
      "tech": "Ellbogen am Körper, Seil bis unter die Hüfte",
      "photo": "img/08.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 45,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 45,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 45,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "11": {
      "id": 11,
      "name": "Waden stehend",
      "device": "Wadenmaschine",
      "tech": "Ganz runter, ganz hoch, oben kurz halten;",
      "photo": "img/11.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 15,
          "weight": 40,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 40,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "14": {
      "id": 14,
      "name": "Bauch schräg (Winkel links/rechts verstellbar)",
      "device": "Bauchmaschine schräg",
      "tech": "Becken fixiert, Drehung aus dem Rumpf, Winkel je Seite umstellen",
      "photo": "img/14.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 12.5,
          "text": "gerade"
        },
        {
          "reps": 10,
          "weight": 12.5,
          "text": "links"
        },
        {
          "reps": 10,
          "weight": 12.5,
          "text": "rechts"
        },
        {
          "reps": 10,
          "weight": 12.5,
          "text": "gerade"
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "15": {
      "name": "Rückenstrecker",
      "device": "Rückenstrecker-Maschine",
      "tech": "Becken fixiert, langsam aus dem unteren Rücken strecken, nicht überstrecken",
      "photo": null,
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 42.5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 42.5,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 2.5,
      "optional": false,
      "id": 15
    },
    "16": {
      "id": 16,
      "name": "Beinpresse",
      "device": "Beinpresse",
      "tech": "Knie max. 90° beugen, Knie in Linie mit Fußspitzen, oben nicht durchstrecken, nur schmerzfrei",
      "photo": null,
      "warmup": null,
      "sets": [
        {
          "reps": 15,
          "weight": 50,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 50,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 50,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 5,
      "optional": false
    },
    "17": {
      "id": 17,
      "name": "Beinbeuger",
      "device": "Beinbeuger sitzend oder liegend",
      "tech": "Langsam beugen, kontrolliert zurück, Polster knapp über der Ferse",
      "photo": null,
      "warmup": null,
      "sets": [
        {
          "reps": 15,
          "weight": 35,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 35,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "18": {
      "id": 18,
      "name": "Abduktoren",
      "device": "Abduktoren-Maschine",
      "tech": "Beine nach außen drücken, Rücken anlegen, langsam zurück",
      "photo": null,
      "warmup": null,
      "sets": [
        {
          "reps": 15,
          "weight": 47.5,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 47.5,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 2.5,
      "optional": false
    },
    "20": {
      "name": "Bauchmuskel",
      "device": "",
      "tech": "",
      "photo": null,
      "warmup": null,
      "sets": [
        {
          "reps": 15,
          "weight": 50,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 50,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": null,
      "optional": false,
      "id": 20
    },
    "21": {
      "id": 21,
      "name": "SZ-Stange frei stehend",
      "device": "SZ-Stange, frei stehend",
      "tech": "Aufrecht stehen, Oberarme am Körper, ohne Schwung, langsam ablassen",
      "photo": "img/07.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": 5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 5,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 5,
          "text": ""
        }
      ],
      "unit": "kg je Seite",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 1.25,
      "optional": false
    }
  },
  "blockChange": 60
};

export function defaultPlan() {
  return JSON.parse(JSON.stringify(PLAN));
}
