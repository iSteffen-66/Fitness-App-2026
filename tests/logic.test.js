import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../app/js/logic.js';
import { defaultPlan } from '../app/js/seed.js';
import { createStore, memoryAdapter } from '../app/js/db.js';

const T0 = 1_700_000_000_000;
const finishAll = (a, now = T0, vals = (s) => ({ reps: s.reps, weight: s.weight ?? 20 })) => {
  let t = now;
  while (L.currentStep(a)) {
    const s = L.currentStep(a);
    L.completeStep(a, s.type === 'timed' ? { actualSec: s.seconds } : vals(s), t);
    t += 1000;
  }
  return t;
};

test('Plan: Gesamtdauer 75 min, 12 Blöcke, 14 Übungen, Übung 12 ohne Foto', () => {
  const p = defaultPlan();
  assert.equal(L.planTotalMinutes(p), 75);
  assert.equal(p.blocks.length, 12);
  assert.equal(Object.keys(p.exercises).length, 14);
  assert.equal(p.exercises[12].photo, null);
  assert.equal(p.exercises[14].sets[0].weight, null);
  // Zeitfenster lückenlos
  for (let i = 1; i < p.blocks.length; i++) assert.equal(p.blocks[i].start, p.blocks[i - 1].end);
});

test('Schritte: Reihenfolge, Supersatz, Zirkel, Seiten, Pausen', () => {
  const steps = L.buildSteps(defaultPlan());
  const key = (s) => s.type === 'timed' ? `T:${s.blockName}` : `${s.exId}${s.setType === 'warmup' ? 'w' : ''}${s.side ? s.side[0] : ''}`;
  const seq = steps.map(key);
  // Block A Drücken: Aufwärmen + 2 Sätze
  assert.deepEqual(seq.slice(0, 5), ['T:Cardio Aufwärmen', '1w', '1', '1', '2w']);
  // Supersatz B: erst beide Aufwärmsätze, dann Runden 5,6,5,6
  const i5 = seq.indexOf('5w');
  assert.deepEqual(seq.slice(i5, i5 + 6), ['5w', '6w', '5', '6', '5', '6']);
  // Supersatz C: Scott-Curl hat 2 Sätze (10 + 5)
  const i7 = seq.indexOf('7w');
  assert.deepEqual(seq.slice(i7, i7 + 6), ['7w', '8w', '7', '8', '7', '8']);
  assert.equal(steps.filter((s) => s.exId === 7 && s.setType === 'work')[1].reps, 5);
  // Zirkel D: 2 Runden, 13 hat Aufwärmen, 14 links/rechts
  const i13 = seq.indexOf('13w');
  assert.deepEqual(seq.slice(i13, i13 + 12), ['13w', '13', '11', '14l', '14r', '12', '13', '11', '14l', '14r', '12', 'T:Puffer']);
  // Einarmig (9): links und rechts getrennt
  const i9 = seq.indexOf('9wl');
  assert.deepEqual(seq.slice(i9, i9 + 6), ['9wl', '9wr', '9l', '9r', '9l', '9r']);
});

test('Pausen: Supersatz erst nach der Runde, Zirkel 60 s, keine Pause am Blockende', () => {
  const steps = L.buildSteps(defaultPlan());
  const ss = steps.filter((s) => s.blockId === 'b06');
  assert.deepEqual(ss.map((s) => s.rest), [0, 30, 0, 60, 0, 0]);
  const circ = steps.filter((s) => s.blockId === 'b10');
  const rests = circ.map((s) => s.rest);
  assert.equal(rests[0], 30);              // Aufwärmsatz 13
  assert.equal(rests[circ.findIndex((s, i) => i > 1 && s.exId === 12)], 60); // nach Runde 1
  assert.equal(rests[rests.length - 1], 0); // Blockende
  // Seiten: Pause nur nach rechter Seite
  const e9 = steps.filter((s) => s.exId === 9 && s.setType === 'work');
  assert.deepEqual(e9.map((s) => s.rest), [0, 60, 0, 0]);
  assert.equal(steps.find((s) => s.exId === 1 && s.setType === 'warmup').rest, 30);
  assert.equal(steps.find((s) => s.exId === 1 && s.setType === 'work').rest, 90);
});

test('optionale Übungen lassen sich ausschließen', () => {
  const steps = L.buildSteps(defaultPlan(), { skipOptional: true });
  assert.equal(steps.some((s) => s.exId === 10), false);
});

test('Timer: Zeitstempel, Pause und Wiederaufnahme', () => {
  const a = L.newActive(defaultPlan(), T0);
  assert.equal(L.currentStep(a).type, 'timed');
  assert.equal(L.remainingSec(a.timer.endAt, T0), 600);
  // 2 Minuten "Display aus" – Zeit läuft korrekt weiter
  assert.equal(L.remainingSec(a.timer.endAt, T0 + 120_000), 480);
  assert.equal(Math.round(L.elapsedMs(a, T0 + 120_000) / 1000), 120);
  // Pause 90 s: Uhr und Countdown stehen
  L.pauseActive(a, T0 + 120_000);
  assert.equal(L.elapsedMs(a, T0 + 300_000), 120_000);
  L.resumeActive(a, T0 + 210_000);
  assert.equal(L.elapsedMs(a, T0 + 210_000), 120_000);
  assert.equal(L.remainingSec(a.timer.endAt, T0 + 210_000), 480);
  assert.equal(L.remainingSec(a.timer.endAt, T0 + 10 * 3600_000), 0);
});

test('Pausentimer startet nach Erledigt und überlebt Pause', () => {
  const a = L.newActive(defaultPlan(), T0);
  L.completeStep(a, { actualSec: 600 }, T0 + 600_000); // Cardio fertig
  const w = L.currentStep(a);
  assert.equal(w.setType, 'warmup');
  L.completeStep(a, { reps: 10, weight: 0 }, T0 + 610_000);
  assert.equal(a.rest.total, 30);
  assert.equal(L.remainingSec(a.rest.endAt, T0 + 620_000), 20);
  L.pauseActive(a, T0 + 620_000);
  L.resumeActive(a, T0 + 680_000);
  assert.equal(L.remainingSec(a.rest.endAt, T0 + 680_000), 20);
});

test('Training durchlaufen, speichern, Volumen und Satzanzahl', async () => {
  const plan = defaultPlan();
  const a = L.newActive(plan, T0);
  const end = finishAll(a, T0);
  const s = L.finalizeSession(a, end, false);
  assert.equal(s.status, 'done');
  const total = L.buildSteps(plan).filter((x) => x.type === 'set').length;
  assert.equal(L.sessionSetCount(s), total);
  const bank = s.entries.find((e) => e.exId === 1);
  assert.equal(bank.sets.length, 3);
  assert.equal(bank.sets[0].type, 'warmup');
  // Volumen nur Arbeitssätze: Bankdrücken 2 × 10 × 10
  const only = { entries: [bank] };
  assert.equal(L.sessionVolume(only), 2 * 10 * 10);
  // Speichern/Laden
  const store = createStore(memoryAdapter());
  await store.saveSession(s);
  const back = await store.listSessions();
  assert.equal(back.length, 1);
  assert.deepEqual(back[0], JSON.parse(JSON.stringify(s)));
});

test('Übung ohne Soll-Gewicht (14): erster Wert wird neues Soll', () => {
  const plan = defaultPlan();
  const a = L.newActive(plan, T0);
  while (L.currentStep(a) && L.currentStep(a).exId !== 14) {
    const s = L.currentStep(a);
    L.completeStep(a, s.type === 'timed' ? {} : { reps: s.reps, weight: s.weight ?? 1 }, T0);
  }
  const st = L.currentStep(a);
  assert.equal(st.weight, null);
  const r = L.completeStep(a, { reps: 10, weight: 25 }, T0 + 1000);
  assert.deepEqual(r.newTarget, { exId: 14, weight: 25 });
  const rest = a.steps.filter((x) => x.exId === 14);
  assert.ok(rest.every((x) => x.weight === 25));
  // Vorbelegung des nächsten Schritts übernimmt den Wert
  assert.equal(L.prefill(a, L.currentStep(a), []).weight, 25);
});

test('Überspringen, Zurück, erneutes Erfassen überschreibt den Satz', () => {
  const a = L.newActive(defaultPlan(), T0);
  L.completeStep(a, { actualSec: 1 }, T0);
  L.skipCurrent(a, T0); // Übung 1 überspringen
  assert.equal(L.currentStep(a).exId, 2);
  assert.ok(!a.steps.slice(a.stepIndex).some((s) => s.exId === 1));
  L.completeStep(a, { reps: 9, weight: 7.5 }, T0);
  assert.equal(L.goBack(a, T0), true);
  assert.equal(L.currentStep(a).exId, 2);
  assert.equal(L.prefill(a, L.currentStep(a), []).reps, 9);
  L.completeStep(a, { reps: 8, weight: 7.5 }, T0);
  const e = a.session.entries.find((x) => x.exId === 2);
  assert.equal(e.sets.length, 1);
  assert.equal(e.sets[0].reps, 8);
});

test('Hinweis bei Rückstand', () => {
  const a = L.newActive(defaultPlan(), T0);
  assert.equal(L.behindMinutes(a, T0 + 9 * 60_000), 0);
  assert.equal(L.behindMinutes(a, T0 + 12 * 60_000), 2);
});

async function twoSessions(plan, secondReps) {
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const a = L.newActive(plan, T0 + i * 86400_000);
    finishAll(a, T0 + i * 86400_000, (s) => ({ reps: i === 1 && s.exId === 1 && s.setType === 'work' && s.setNo === 2 ? secondReps : s.reps, weight: s.weight ?? 20 }));
    sessions.push(L.finalizeSession(a, T0 + i * 86400_000 + 5e6, false));
  }
  return sessions;
}

test('Steigerungsvorschlag: nur bei voller Wiederholungszahl', async () => {
  const plan = defaultPlan();
  const ok = await twoSessions(plan, 10);
  const sug = L.suggestProgression(ok, plan.exercises[1]);
  assert.deepEqual(sug, { from: 10, weight: 12.5, step: 2.5 });           // Scheiben: 2,5
  assert.equal(L.suggestProgression(ok, plan.exercises[2]).weight, 20);   // Steckgewicht: 15 + 5
  const bad = await twoSessions(plan, 9);
  assert.equal(L.suggestProgression(bad, plan.exercises[1]), null);
  // Stufe pro Übung einstellbar
  plan.exercises[1].step = 1.25;
  assert.equal(L.suggestProgression(ok, plan.exercises[1]).weight, 11.25);
  assert.equal(L.suggestProgression(ok, plan.exercises[11]), null);       // ohne Gewicht
  assert.equal(L.suggestProgression([], plan.exercises[1]), null);
});

test('Letzter Wert und Verlauf', async () => {
  const plan = defaultPlan();
  const ss = await twoSessions(plan, 10);
  const h = L.exerciseHistory(ss, 2);
  assert.equal(h.length, 2);
  assert.ok(h[0].date < h[1].date);
  assert.equal(L.lastValue(ss, 2).maxWeight, 15);
  const a = L.newActive(plan, T0 + 9e9);
  L.completeStep(a, {}, T0);
  const st = a.steps.find((s) => s.exId === 1 && s.setType === 'work');
  assert.equal(L.prefill(a, st, ss).weight, 10);
});

test('Bearbeiten und Löschen von Sätzen, Übungen und Trainings', async () => {
  const plan = defaultPlan();
  const [s] = await twoSessions(plan, 10);
  const idx = s.entries.findIndex((e) => e.exId === 1);
  const n = s.entries[idx].sets.length;
  L.updateSet(s, idx, 1, { reps: 7, weight: 12.5 });
  assert.equal(s.entries[idx].sets[1].weight, 12.5);
  L.deleteSet(s, idx, 0);
  assert.equal(s.entries[idx].sets.length, n - 1);
  L.deleteEntry(s, idx);
  assert.ok(!s.entries.some((e) => e.exId === 1));
  const store = createStore(memoryAdapter());
  await store.saveSession(s);
  await store.deleteSession(s.id);
  assert.equal((await store.listSessions()).length, 0);
});

test('Plan bearbeiten: hinzufügen, verschieben, löschen, Zeiten', () => {
  const p = defaultPlan();
  const id = L.addExercise(p, 'b09', { name: 'Neu', unit: 'kg', sets: [{ reps: 10, weight: 5 }], sides: 'none', rest: 60 });
  assert.equal(id, 15);
  assert.deepEqual(p.blocks.find((b) => b.id === 'b09').items, [9, 15]);
  L.moveExerciseToBlock(p, 15, 'b02');
  assert.deepEqual(p.blocks.find((b) => b.id === 'b02').items, [1, 15]);
  const items = p.blocks.find((b) => b.id === 'b02').items;
  L.moveInArray(items, 1, 0);
  assert.deepEqual(items, [15, 1]);
  L.deleteExercise(p, 15);
  assert.ok(!p.exercises[15]);
  assert.deepEqual(p.blocks.find((b) => b.id === 'b02').items, [1]);
  // Nummer bleibt fest, auch wenn Reihenfolge wechselt
  assert.equal(L.nextExerciseId(p), 15);
  p.blocks[1].end = 20;            // Block verlängern
  L.realignTimes(p);
  assert.equal(L.planTotalMinutes(p), 79);
  L.deleteBlock(p, 'b10');
  assert.ok(!p.exercises[13] && !p.exercises[12]);
  assert.equal(p.blocks.length, 11);
});

test('Plan speichern/Standard wiederherstellen', async () => {
  const store = createStore(memoryAdapter());
  const p = await store.getPlan();
  p.exercises[1].name = 'Geändert';
  await store.savePlan(p);
  assert.equal((await store.getPlan()).exercises[1].name, 'Geändert');
  assert.equal((await store.resetPlan()).exercises[1].name, 'Bankdrücken liegend');
});

test('Export → Löschen → Import stellt alles wieder her', async () => {
  const store = createStore(memoryAdapter());
  const plan = await store.getPlan();
  plan.exercises[1].name = 'Eigener Name';
  await store.savePlan(plan);
  const ss = await twoSessions(plan, 10);
  for (const s of ss) await store.saveSession(s);
  await store.savePhoto(3, 'data:image/jpeg;base64,AAAA');
  const dump = JSON.parse(JSON.stringify(L.buildExport(await store.getPlan(), await store.listSessions(), await store.getPhotos())));
  assert.deepEqual(L.validateImport(dump), { ok: true });
  await store.wipe();
  assert.equal((await store.listSessions()).length, 0);
  assert.deepEqual(await store.getPhotos(), {});
  await store.replaceAll(dump);
  assert.equal((await store.getPlan()).exercises[1].name, 'Eigener Name');
  assert.equal((await store.listSessions()).length, 2);
  assert.deepEqual(await store.getPhotos(), { 3: 'data:image/jpeg;base64,AAAA' });
});

test('Import: ungültige Dateien werden abgelehnt', () => {
  assert.equal(L.validateImport(null).ok, false);
  assert.equal(L.validateImport({ app: 'x' }).ok, false);
  const good = L.buildExport(defaultPlan(), [], {});
  assert.equal(L.validateImport(good).ok, true);
  assert.equal(L.validateImport({ ...good, sessions: 'x' }).ok, false);
  assert.equal(L.validateImport({ ...good, photos: { 1: 'nope' } }).ok, false);
  const broken = structuredClone(good); broken.plan.blocks[1].items = [99];
  assert.equal(L.validateImport(broken).ok, false);
});

test('CSV: Kopfzeile, Semikolon, Dezimalkomma', async () => {
  const plan = defaultPlan();
  const [s] = await twoSessions(plan, 10);
  const csv = L.toCSV([s]);
  const lines = csv.replace('﻿', '').split('\r\n');
  assert.ok(lines[0].startsWith('Datum;Start;'));
  const row = lines.find((l) => l.includes('Enges Rudern') && l.includes('Arbeitssatz'));
  assert.ok(row.includes(';15;kg;150;'), row);
  assert.ok(lines.some((l) => l.includes('Zeit')));
  assert.equal(L.toCSV([]).replace('﻿', '').split('\r\n').length, 1);
});

test('Zahlen: Komma-Eingabe und Formatierung', () => {
  assert.equal(L.parseNum('32,5'), 32.5);
  assert.equal(L.parseNum(' '), null);
  assert.equal(L.parseNum('abc'), null);
  assert.equal(L.fmtNum(2.5), '2,5');
  assert.equal(L.fmtClock(3725), '1:02:05');
  assert.equal(L.fmtClock(65), '01:05');
});

test('Service Worker kennt alle App-Dateien', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(dir).map((f) => path.relative(dir, f).replaceAll('\\', '/')).filter((f) => f !== 'sw.js');
  const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  const missing = files.filter((f) => !sw.includes(`'${f}'`));
  assert.deepEqual(missing, []);
});

test('Plan übertragen: Export enthält nur Plan und Fotos der Planübungen', () => {
  const p = defaultPlan();
  const f = JSON.parse(JSON.stringify(L.buildPlanExport(p, { 3: 'data:image/jpeg;base64,AA', 99: 'data:image/jpeg;base64,BB' }, T0)));
  assert.equal(f.kind, 'plan');
  assert.equal(f.sessions, undefined);
  assert.deepEqual(Object.keys(f.photos), ['3']);
  const r = L.readPlanImport(f);
  assert.equal(r.ok, true);
  assert.equal(r.fromBackup, false);
  assert.equal(r.exportedAt, T0);
  // Plan-Datei wird beim vollständigen Import abgewiesen (würde sonst Verlauf löschen)
  assert.match(L.validateImport(f).error, /Plan importieren/);
  // Vollständige Sicherung ist als Plan-Quelle erlaubt
  assert.equal(L.readPlanImport(L.buildExport(p, [], {})).fromBackup, true);
  assert.equal(L.readPlanImport({ app: 'x' }).ok, false);
  const broken = structuredClone(f); broken.plan.blocks[2].items = [77];
  assert.equal(L.readPlanImport(broken).ok, false);
});

test('Plan übertragen: Fotos werden je Übung angeglichen', () => {
  const p = defaultPlan();
  const cur = { 1: 'data:image/jpeg;base64,ALT1', 2: 'data:image/jpeg;base64,ALT2', 99: 'data:image/jpeg;base64,X' };
  const out = L.mergePlanPhotos(cur, p, { 1: 'data:image/jpeg;base64,NEU1' });
  assert.equal(out[1], 'data:image/jpeg;base64,NEU1');   // ersetzt
  assert.equal(out[2], undefined);                        // auf Gerät A Standardbild → hier auch
  assert.equal(out[99], 'data:image/jpeg;base64,X');      // Übung nicht im Plan → bleibt
});

test('Plan übertragen: Verlauf bleibt beim Plan-Import erhalten', async () => {
  const store = createStore(memoryAdapter());
  const plan = await store.getPlan();
  const ss = await twoSessions(plan, 10);
  for (const s of ss) await store.saveSession(s);
  await store.savePhoto(5, 'data:image/jpeg;base64,ALT');
  await store.saveMeta({ lastExport: 123 });
  const other = defaultPlan(); other.exercises[1].name = 'Von Gerät A';
  const r = L.readPlanImport(JSON.parse(JSON.stringify(L.buildPlanExport(other, { 2: 'data:image/jpeg;base64,NEU' }))));
  await store.replacePlan(r.plan, L.mergePlanPhotos(await store.getPhotos(), r.plan, r.photos));
  assert.equal((await store.getPlan()).exercises[1].name, 'Von Gerät A');
  assert.equal((await store.listSessions()).length, 2);
  assert.deepEqual(await store.getPhotos(), { 2: 'data:image/jpeg;base64,NEU' });
  assert.deepEqual(await store.getMeta(), { lastExport: 123 });
});

test('Abwechselnd: Sätze alternieren, Pause nach jedem Satz', () => {
  const p = defaultPlan();
  const b = p.blocks.find((x) => x.id === 'b08'); // Scott-Curl + Trizeps
  b.mode = 'alternate';
  p.exercises[7].sets = [{ reps: 10, weight: 5 }, { reps: 10, weight: 5 }];
  const st = L.buildSteps(p).filter((s) => s.blockId === 'b08');
  assert.deepEqual(st.map((s) => `${s.exId}${s.setType === 'warmup' ? 'w' : ''}`), ['7w', '8w', '7', '8', '7', '8']);
  assert.deepEqual(st.map((s) => s.rest), [30, 30, 60, 60, 60, 0]);
  assert.ok(st.filter((s) => s.setType === 'work').every((s) => s.reps === 10));
  // Supersatz zum Vergleich: Pause nur nach der Runde
  b.mode = 'superset';
  assert.deepEqual(L.buildSteps(p).filter((s) => s.blockId === 'b08').map((s) => s.rest), [0, 30, 0, 60, 0, 0]);
});

const doCur = (a, t = T0) => { const s = L.currentStep(a); return L.completeStep(a, s.type === 'timed' ? { actualSec: 60 } : { reps: s.reps, weight: s.weight ?? 20 }, t); };
const curEx = (a) => L.currentStep(a)?.exId;

test('Gerät belegt: Übung später machen', () => {
  const a = L.newActive(defaultPlan(), T0);
  doCur(a);                                   // Cardio
  assert.equal(curEx(a), 1);
  doCur(a);                                   // Aufwärmsatz Bankdrücken erledigt
  const lbl = L.postponeCurrent(a, T0);
  assert.equal(lbl, 'Enges Rudern');
  assert.equal(curEx(a), 2);
  // Rudern komplett, danach kommen die restlichen Bankdrück-Sätze
  doCur(a); doCur(a); doCur(a);
  assert.equal(curEx(a), 1);
  assert.equal(L.currentStep(a).setType, 'work');
  // bereits erfasster Aufwärmsatz bleibt gespeichert
  assert.equal(a.session.entries.find((e) => e.exId === 1).sets.length, 1);
});

test('Gerät belegt: andere Übung vorziehen, ganze Supersatz-Blöcke wandern zusammen', () => {
  const a = L.newActive(defaultPlan(), T0);
  doCur(a);
  const units = L.openUnits(a);
  const sup = units.find((u) => u.key === 'b:b06');
  assert.equal(sup.label, 'B Supersatz: Butterfly + Reverse Butterfly');
  assert.equal(sup.pending, 6);
  L.bringToFront(a, 'b:b06', T0);
  assert.equal(curEx(a), 5);
  doCur(a);
  assert.equal(curEx(a), 6);                   // Abwechseln bleibt erhalten
  // Bankdrücken steht direkt nach dem Supersatz an
  for (let i = 0; i < 5; i++) doCur(a);
  assert.equal(curEx(a), 1);
});

test('Auslassen ist nachholbar, auch am Ende', () => {
  const plan = defaultPlan();
  const a = L.newActive(plan, T0);
  doCur(a);
  L.skipCurrent(a, T0);                        // Bankdrücken auslassen
  assert.equal(curEx(a), 2);
  const sk = L.openUnits(a).find((u) => u.exIds.includes(1));
  assert.equal(sk.skipped, true);
  let r;
  while (L.currentStep(a)) r = doCur(a);
  assert.equal(r.finished, true);
  const open = L.openUnits(a);
  assert.deepEqual(open.map((u) => u.label), ['Bankdrücken liegend']);
  assert.deepEqual(open[0].skippedNames, ['Bankdrücken liegend']);
  L.bringToFront(a, open[0].key, T0);
  assert.equal(curEx(a), 1);
  while (L.currentStep(a)) doCur(a);
  assert.equal(L.openUnits(a).length, 0);
  const s = L.finalizeSession(a, T0 + 1, false);
  assert.equal(L.sessionSetCount(s), L.buildSteps(plan).filter((x) => x.type === 'set').length);
});

test('Zeitblock erneut erfassen ersetzt den Eintrag', () => {
  const a = L.newActive(defaultPlan(), T0);
  L.completeStep(a, { actualSec: 300 }, T0);
  L.goBack(a, T0);
  L.completeStep(a, { actualSec: 600 }, T0);
  const t = a.session.entries.filter((e) => e.kind === 'timed');
  assert.equal(t.length, 1);
  assert.equal(t[0].actualSec, 600);
});

test('Laufendes Training aus älterer Version: erledigter Zeitblock bleibt erledigt', () => {
  const a = L.newActive(defaultPlan(), T0);
  L.completeStep(a, { actualSec: 600 }, T0);
  delete a.session.entries[0].stepIndex; // Stand vor diesem Update
  assert.ok(!L.openUnits(a).some((u) => u.key === 'b:b01'));
});
