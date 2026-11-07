// Ausgangsplan = Steffens Trainingsplan (Stand 07.11.2026, vom iPhone übernommen).
// Übungsnummer = feste ID (gehört zum Foto und zum Verlauf), Reihenfolge im Plan ist davon unabhängig.
// Eigene Fotos (Übungen 15–20) liegen nur auf dem Gerät und bleiben beim Zurücksetzen erhalten.
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
      "end": 29,
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
      "switchRest": 60
    },
    {
      "id": "b09",
      "name": "B freie Gewichte",
      "start": 30,
      "end": 43,
      "kind": "sets",
      "mode": "alternate",
      "items": [
        7,
        8
      ],
      "rounds": 1,
      "roundRest": null
    },
    {
      "id": "b09p",
      "name": "B Plank",
      "start": 44,
      "end": 46,
      "kind": "sets",
      "mode": "single",
      "items": [
        19
      ]
    },
    {
      "id": "b13",
      "name": "C Beine knieschonend",
      "start": 47,
      "end": 62,
      "kind": "sets",
      "mode": "single",
      "items": [
        11,
        16,
        18,
        17
      ],
      "rounds": 1,
      "roundRest": 60
    },
    {
      "id": "b04",
      "name": "D Zirkelmaschinen",
      "start": 63,
      "end": 78,
      "kind": "sets",
      "mode": "single",
      "items": [
        5,
        4,
        6,
        15,
        20
      ],
      "switchRest": 30
    },
    {
      "id": "b12",
      "name": "Ausklang",
      "start": 79,
      "end": 89,
      "kind": "timed",
      "mode": "single",
      "items": [],
      "minutes": 10,
      "note": "3 Min. Cardio locker (Rad/Crosstrainer), danach Brust, Schulter, Waden, Oberschenkelvorderseite und Hüftbeuger dehnen"
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
          "weight": 10,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 10,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 10,
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
          "weight": 25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 25,
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
          "weight": 20,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 20,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 20,
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
    "4": {
      "id": 4,
      "name": "Schulterdrücken",
      "device": "Schulterpresse",
      "tech": "Rücken fest ans Polster; nur wenn Zeit übrig",
      "photo": "img/04.webp",
      "warmup": {
        "reps": 10,
        "weight": 20,
        "text": ""
      },
      "sets": [
        {
          "reps": 10,
          "weight": 30,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 30,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 45,
      "warmRest": 30,
      "step": 2.5,
      "optional": true
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
          "weight": 40,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 40,
          "text": ""
        }
      ],
      "unit": "kg",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": 2.5,
      "optional": true
    },
    "6": {
      "id": 6,
      "name": "Reverse Butterfly",
      "device": "Reverse-Butterfly-Maschine",
      "tech": "Arme weit nach hinten, Schultern tief",
      "photo": "img/06.webp",
      "warmup": {
        "reps": 10,
        "weight": 20,
        "text": ""
      },
      "sets": [
        {
          "reps": 10,
          "weight": 30,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 30,
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
    "7": {
      "id": 7,
      "name": "SZ-Stange",
      "device": "mit oder ohne Scott-Bank mit SZ-Stange",
      "tech": "Oberarme ganz aufs Polster, langsam ablassen",
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
          "weight": 25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 25,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 25,
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
      "name": "Waden sitzend oder stehend",
      "device": "Wadenmaschine sitzend",
      "tech": "Ganz runter, ganz hoch, oben kurz halten;",
      "photo": "img/11.webp",
      "warmup": null,
      "sets": [
        {
          "reps": 15,
          "weight": 15,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 15,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 15,
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
          "weight": 10,
          "text": "gerade"
        },
        {
          "reps": 10,
          "weight": 10,
          "text": "links"
        },
        {
          "reps": 10,
          "weight": 10,
          "text": "rechts"
        },
        {
          "reps": 10,
          "weight": 10,
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
          "weight": 20,
          "text": ""
        },
        {
          "reps": 10,
          "weight": 20,
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
          "weight": 30,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 30,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 30,
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
          "reps": 12,
          "weight": 30,
          "text": ""
        },
        {
          "reps": 12,
          "weight": 30,
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
          "weight": 30,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 30,
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
    "19": {
      "id": 19,
      "name": "Unterarmstütz (Plank)",
      "device": "Matte",
      "tech": "Körper gerade Linie, Bauch und Gesäß fest, ruhig weiteratmen; Füße auf Platte, Kopf nach oben durchstrecken- 5 s halten",
      "photo": null,
      "warmup": null,
      "sets": [
        {
          "reps": 10,
          "weight": null,
          "text": "Sek."
        },
        {
          "reps": 10,
          "weight": null,
          "text": "Sek."
        }
      ],
      "unit": "",
      "sides": "none",
      "rest": 30,
      "warmRest": 30,
      "step": null,
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
          "weight": 30,
          "text": ""
        },
        {
          "reps": 15,
          "weight": 30,
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
    }
  },
  "blockChange": 60
};

export function defaultPlan() {
  return JSON.parse(JSON.stringify(PLAN));
}
