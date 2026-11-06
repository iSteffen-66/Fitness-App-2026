// Ausgangsplan nach PROMPT.md, ergänzt um 1 min Wechselzeit zwischen den Blöcken. Übungsnummer = feste ID (gehört zum Foto).
import { realignTimes } from './logic.js';

export const PLAN_VERSION = 1;

const ex = (id, name, device, tech, o) => ({
  id, name, device, tech,
  photo: o.noPhoto ? null : `img/${String(id).padStart(2, '0')}.webp`,
  warmup: o.warmup || null,
  sets: o.sets,
  unit: o.unit ?? 'kg',
  sides: o.sides || 'none',
  rest: o.rest ?? 60,
  warmRest: 30,
  step: o.step ?? null,
  optional: !!o.optional,
});
const sets = (n, reps, weight) => Array.from({ length: n }, () => ({ reps, weight }));

export function defaultPlan() {
  const exercises = {};
  [
    ex(1, 'Bankdrücken liegend', 'Bank liegend mit Scheiben', 'Schulterblätter zusammen, Füße fest',
      { unit: 'kg je Seite', rest: 90, warmup: { reps: 10, weight: 0, text: 'ohne Scheiben' }, sets: sets(2, 10, 10) }),
    ex(2, 'Enges Rudern', 'Rudermaschine mit Brustpolster', 'Sitzhöhe Stufe 3, Brust ans Polster',
      { rest: 90, warmup: { reps: 10, weight: 7.5 }, sets: sets(2, 10, 15) }),
    ex(3, 'Latzug', 'Latzug-Maschine (Griffe von oben)', 'Beine einklemmen, nur Fingerspitzen, zur Brust ziehen',
      { unit: 'kg je Seite', rest: 90, warmup: { reps: 10, weight: 15 }, sets: sets(2, 10, 20) }),
    ex(4, 'Schulterdrücken', 'Schulterpresse', 'Rücken fest ans Polster',
      { rest: 90, warmup: { reps: 10, weight: 20 }, sets: sets(2, 10, 30) }),
    ex(5, 'Butterfly', 'Butterfly-Maschine', 'Fingerspitzen vorne zusammen, Rücken anlegen',
      { warmup: { reps: 10, weight: 20 }, sets: sets(2, 10, 40) }),
    ex(6, 'Reverse Butterfly', 'Reverse-Butterfly-Maschine', 'Arme weit nach hinten, Schultern tief',
      { warmup: { reps: 10, weight: 20 }, sets: sets(2, 10, 30) }),
    ex(7, 'Scott-Curl SZ-Stange', 'Scott-Bank mit SZ-Stange', 'Oberarme ganz aufs Polster, langsam ablassen',
      { unit: 'kg je Seite', warmup: { reps: 15, weight: 0, text: '5 × unten bis Mitte, 5 × Mitte bis oben, 5 × voll, ohne Scheiben' },
        sets: sets(2, 10, 5) }),
    ex(8, 'Trizepsdrücken am Seil', 'Kabelturm mit Seilgriff', 'Ellbogen am Körper, Seil bis unter die Hüfte',
      { warmup: { reps: 10, weight: 10 }, sets: sets(2, 10, 25) }),
    ex(11, 'Waden sitzend', 'Wadenmaschine sitzend', 'Ganz runter, ganz hoch',
      { unit: '', sets: [{ reps: 20, weight: null }] }),
    ex(12, 'Bauch ohne Gewicht', 'Matte / Boden', 'Lendenwirbelsäule am Boden',
      { unit: '', noPhoto: true, sets: [{ reps: 10, weight: null, text: '10 gerade, je 10 links/rechts, 10 gerade' }] }),
    ex(13, 'Bauchmaschine', 'Bauchmaschine mit Fußrolle', 'Aus dem Bauch einrollen',
      { warmup: { reps: 10, weight: 20 }, sets: sets(2, 10, 40) }),
    ex(14, 'Bauch schräg (Winkel links/rechts verstellbar)', 'Bauchmaschine schräg', 'Becken fixiert, Drehung aus dem Rumpf, Winkel je Seite umstellen',
      { sides: 'Seite', sets: sets(2, 10, null) }),
    // Beinpresse und Beinbeuger (Zirkel D): Werte aus dem alten Plan nicht verfügbar → Gewicht offen (erster Satz wird Soll)
    ex(16, 'Beinpresse', 'Beinpresse', 'Füße hüftbreit auf der Platte, Knie nicht ganz durchstrecken',
      { unit: 'kg', noPhoto: true, sets: sets(2, 10, null) }),
    ex(17, 'Beinbeuger', 'Beinbeuger-Maschine', 'Becken fest am Polster, langsam ablassen',
      { unit: 'kg', noPhoto: true, sets: sets(2, 10, null) }),
    ex(15, 'Plank', 'Matte / Boden', 'Körper gerade, Bauch und Po fest, nicht durchhängen',
      { unit: '', noPhoto: true, rest: 45, sets: [{ reps: 1, weight: null, text: '60 s halten' }, { reps: 1, weight: null, text: '60 s halten' }] }),
  ].forEach((e) => { exercises[e.id] = e; });

  const B = (id, name, start, end, o) => ({ id, name, start, end, kind: 'sets', mode: 'single', items: [], ...o });
  const blocks = [
    B('b01', 'Cardio Aufwärmen', 0, 10, { kind: 'timed', minutes: 10, note: 'Rad, Crosstrainer oder Laufband, locker bis mittel' }),
    // Roter Käfig: alle Geräte im selben Bereich, daher nur 30 s Wechsel zwischen den Übungen
    B('b02', 'A Roter Käfig', 0, 19, { items: [1, 2, 3, 14], switchRest: 30 }),
    B('b06', 'B Zirkeltraining', 0, 10, { mode: 'circuit', rounds: 2, roundRest: 60, items: [4, 5, 6, 11] }),
    // Freie Gewichte: Stange und Seilzug abwechselnd, Plank als eigener Block direkt dahinter
    B('b08', 'C Freie Gewichte', 0, 8, { mode: 'alternate', items: [7, 8], roundRest: null }),
    B('b08p', 'C Plank', 0, 3, { items: [15] }),
    B('b10', 'D Zirkel', 0, 9, { mode: 'circuit', rounds: 2, roundRest: 60, items: [13, 16, 17, 12] }),
    B('b11', 'Puffer', 0, 1, { kind: 'timed', minutes: 1, note: 'Wechselzeit, Trinken' }),
    B('b12', 'Ausklang', 0, 10, { kind: 'timed', minutes: 10, note: 'Cardio locker, danach Brust, Schulter und Waden dehnen' }),
  ];
  // Zeitfenster inkl. Wechselzeiten (1 min zwischen den Blöcken) lückenlos berechnen
  return realignTimes({ version: PLAN_VERSION, blockChange: 60, blocks, exercises });
}
