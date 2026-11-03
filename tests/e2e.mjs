// End-to-End-Test im mobilen Viewport (390 × 844). Start: node tests/e2e.mjs
// Benötigt Playwright (global installiert) und einen laufenden Webserver: npm start  (Port 8080)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.env.NODE_PATH || '', 'playwright'))); }

const URL_ = process.env.APP_URL || 'http://localhost:8080/';
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'fit-shots-'));
const OWN_PHOTO = process.env.OWN_PHOTO;
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FEHLER:', m); } else console.log('  ok:', m); };
const eq = (a, b, m) => ok(a === b, `${m} (ist ${JSON.stringify(a)}, soll ${JSON.stringify(b)})`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const hscroll = async (label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(o.sw <= o.iw, `kein horizontales Scrollen: ${label} (${o.sw} <= ${o.iw})`);
};
const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); };
const tapAct = (a, opt = {}) => page.locator(`[data-act="${a}"]`).first().click(opt);
const modalOk = () => page.locator('#modal [data-m="ok"]').click();

console.log('1. Laden, Service Worker');
await page.goto(URL_);
await page.waitForSelector('text=Training starten');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 20);
ok(true, 'Service Worker aktiv, Dateien zwischengespeichert');
await hscroll('Start'); await shot('01-start');

console.log('2. Training komplett durchklicken');
await page.locator('[data-act="start"]').click();
await page.waitForSelector('#clock');
await shot('02-training-cardio'); await hscroll('Training Cardio');
let steps = 0, shotsDone = new Set();
for (; steps < 200; steps++) {
  if (!page.url().includes('#/training')) break;
  if (await page.locator('#timerSec').count()) {
    if (steps < 3) await shot('03-timed');
    await tapAct('done');
  } else {
    const name = await page.locator('h1').first().innerText();
    if (!shotsDone.has(name) && shotsDone.size < 6) { shotsDone.add(name); await shot('04-set-' + shotsDone.size); await hscroll('Satz ' + name); }
    const w = page.locator('#in-weight');
    if (await w.count() && (await w.inputValue()) === '') { await w.fill('25'); await shot('05-gewicht-offen'); }
    if (await page.locator('.rest').count() && steps < 8) await shot('06-pause');
    await tapAct('done');
  }
  await page.waitForTimeout(40);
}
await page.waitForURL(/#\/history\/\w+/);
ok(steps > 30, `Training lief über ${steps} Schritte`);
await hscroll('Zusammenfassung'); await shot('07-zusammenfassung');
const summary = await page.locator('.card.ok').first().innerText();
ok(/Sätze erledigt/.test(summary) && /kg/.test(summary), 'Zusammenfassung zeigt Dauer, Sätze, Volumen');

console.log('3. Verlauf: gespeichert, bearbeiten, löschen');
const sess = await page.evaluate(() => __app.S.sessions);
eq(sess.length, 1, 'ein Training gespeichert');
const nSets = sess[0].entries.reduce((n, e) => n + (e.sets ? e.sets.length : 0), 0);
ok(nSets >= 38, `Sätze gespeichert (${nSets})`);
const ex14 = sess[0].entries.find((e) => e.exId === 14);
ok(ex14 && ex14.sets.length === 4 && ex14.sets.every((s) => s.weight === 25), 'Übung 14: 4 Sätze (links/rechts), Gewicht 25 übernommen');
eq(await page.evaluate(() => __app.S.plan.exercises[14].sets[0].weight), 25, 'Übung 14: Soll-Gewicht im Plan gesetzt');
await go('history'); await shot('08-verlauf'); await hscroll('Verlauf');
await page.locator('a.item').first().click(); await page.waitForSelector('.setrow');
await tapAct('editSet'); await page.fill('#m-reps', '7'); await shot('09-satz-bearbeiten'); await modalOk();
await page.waitForTimeout(150);
const firstEntry = await page.evaluate(() => __app.S.sessions[0].entries.find((e) => e.kind === 'sets'));
eq(firstEntry.sets[0].reps, 7, 'Satz bearbeitet (Wdh. 7)');
const before = await page.locator('.setrow').count();
await tapAct('delSet'); await page.locator('#modal [data-m="x"]').click();
eq(await page.locator('.setrow').count(), before, 'Löschen abbrechen ändert nichts');
await tapAct('delSet'); await shot('10-loeschen-rueckfrage'); await modalOk(); await page.waitForTimeout(150);
eq(await page.locator('.setrow').count(), before - 1, 'Satz gelöscht (mit Rückfrage)');
await tapAct('delEntry'); await modalOk(); await page.waitForTimeout(150);
ok((await page.evaluate(() => __app.S.sessions[0].entries.length)) < 20, 'Übung aus Training gelöscht');
await go('history/ex'); await hscroll('Übungsliste'); await go('history/ex/2'); await hscroll('Übungsverlauf'); await shot('11-uebung-verlauf');
await go('history');
// zweites Training anlegen, dann ganzes Training löschen
await page.evaluate(() => { const s = structuredClone(__app.S.sessions[0]); s.id = 'zweites'; s.startedAt -= 86400000; __app.S.sessions.push(s); });
await page.evaluate(async () => { const r = indexedDB.open('fitness-app-2026'); await new Promise((res) => { r.onsuccess = () => { const tx = r.result.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put(__app.S.sessions[1]); tx.oncomplete = res; }; }); });
await page.reload(); await go('history/zweites'); await page.waitForSelector('[data-act="delSession"]');
await tapAct('delSession'); await modalOk(); await page.waitForTimeout(200);
eq(await page.evaluate(() => __app.S.sessions.length), 1, 'ganzes Training gelöscht');

console.log('4. Plan-Editor');
await go('plan'); await hscroll('Plan'); await shot('12-plan');
eq(await page.locator('[data-sort="blocks"] > .block').count(), 12, '12 Blöcke');
const ids0 = await page.evaluate(() => __app.S.plan.blocks.find((b) => b.id === 'b06').items.join());
await page.locator('[data-act="mv"][data-k="item"][data-id="5"][data-d="1"]').click(); await page.waitForTimeout(100);
eq(await page.evaluate(() => __app.S.plan.blocks.find((b) => b.id === 'b06').items.join()), '6,5', 'Pfeiltaste: Reihenfolge geändert (Nr. bleibt)');
// Drag & Drop per Zeiger: Übung 6 hinter 5 ziehen
const h6 = page.locator('[data-sort="items"][data-key="b06"] .item[data-id="6"] .drag');
const t5 = page.locator('[data-sort="items"][data-key="b06"] .item[data-id="5"]');
await h6.scrollIntoViewIfNeeded();
const hb = await h6.boundingBox(), tb = await t5.boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
await page.mouse.move(tb.x + 50, tb.y + tb.height - 5, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
eq(await page.evaluate(() => __app.S.plan.blocks.find((b) => b.id === 'b06').items.join()), '5,6', 'Drag & Drop: Reihenfolge geändert');
await page.locator('a[href="#/plan/ex/1"]').click(); await page.waitForSelector('#x-name'); await hscroll('Übung bearbeiten'); await shot('13-uebung-edit');
await page.fill('#x-name', 'Bankdrücken Test'); await page.fill('#x-r0', '8'); await page.fill('#x-w0', '12,5'); await page.fill('#x-step', '1,25');
await page.locator('[data-act="xaddSet"]').click(); await page.locator('[data-act="saveEx"]').click(); await page.waitForTimeout(150);
const ex1 = await page.evaluate(() => __app.S.plan.exercises[1]);
ok(ex1.name === 'Bankdrücken Test' && ex1.sets.length === 3 && ex1.sets[0].reps === 8 && ex1.sets[0].weight === 12.5 && ex1.step === 1.25, 'Übung gespeichert');
// neue Übung
await page.locator('[data-act="addEx"][data-b="b02"]').click(); await page.waitForSelector('#x-name');
eq(await page.evaluate(() => location.hash), '#/plan/ex/15', 'neue Übung bekommt feste Nr. 15');
await page.fill('#x-name', 'Testübung'); await page.locator('[data-act="saveEx"]').click(); await page.waitForTimeout(150);
await page.locator('a[href="#/plan/ex/15"]').click(); await page.waitForSelector('#x-name');
await page.locator('[data-act="delEx"]').click(); await shot('14-uebung-loeschen'); await modalOk(); await page.waitForTimeout(150);
ok(!(await page.evaluate(() => 15 in __app.S.plan.exercises)), 'Übung gelöscht');
// Block-Zeiten
await page.locator('a[href="#/plan/block/b02"]').click(); await page.waitForSelector('#b-end'); await hscroll('Block bearbeiten'); await shot('15-block-edit');
await page.fill('#b-end', '20'); await page.locator('[data-act="saveBlock"]').click(); await page.waitForTimeout(150);
eq(await page.evaluate(() => __app.L.planTotalMinutes(__app.S.plan)), 75, 'Gesamtdauer aus Blockzeiten (Block verlängert, Summe = max Ende)');
await tapAct('align'); await page.waitForTimeout(150);
eq(await page.evaluate(() => __app.L.planTotalMinutes(__app.S.plan)), 79, 'Zeiten lückenlos → 79 min');
await page.locator('[data-act="resetPlan"]').click(); await modalOk(); await page.waitForTimeout(200);
eq(await page.evaluate(() => __app.S.plan.exercises[1].name), 'Bankdrücken liegend', 'Plan zurückgesetzt');
eq(await page.evaluate(() => __app.L.planTotalMinutes(__app.S.plan)), 75, 'Gesamtdauer wieder 75 min');

console.log('5. Eigenes Foto');
if (OWN_PHOTO) {
  await go('plan/ex/1'); await page.waitForSelector('[data-photo]', { state: 'attached' });
  await page.setInputFiles('[data-photo="1"]', OWN_PHOTO); await page.waitForTimeout(800);
  const dim = await page.evaluate(() => new Promise((res) => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = __app.S.photos[1]; }));
  ok(dim[0] === 1200 && dim[1] === 800, `eigenes Foto auf 1200 px verkleinert (${dim})`);
  await shot('16-eigenes-foto');
}

console.log('6. Sicherung: Export → löschen → Import');
await page.evaluate(() => { __app.S.plan.exercises[2].name = 'Rudern eigener Name'; return null; });
await page.evaluate(async () => { const r = indexedDB.open('fitness-app-2026'); await new Promise((res) => { r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(__app.S.plan, 'plan'); tx.oncomplete = res; }; }); });
await go('backup'); await hscroll('Sicherung'); await shot('17-sicherung');
const [dl] = await Promise.all([page.waitForEvent('download'), tapAct('exportJson')]);
const file = path.join(SHOTS, 'sicherung.json'); await dl.saveAs(file);
const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
ok(dump.app === 'fitness-app-2026' && dump.sessions.length === 1 && dump.plan.exercises[2].name === 'Rudern eigener Name', 'Export enthält Plan und Verlauf');
if (OWN_PHOTO) ok(!!dump.photos[1], 'Export enthält eigenes Foto');
const [dl2] = await Promise.all([page.waitForEvent('download'), tapAct('exportCsv')]);
const csv = fs.readFileSync(await dl2.path(), 'utf8'); ok(csv.includes('Datum;Start') && csv.includes('Arbeitssatz'), 'CSV-Export');
await tapAct('wipe'); await modalOk(); await page.waitForTimeout(100); await modalOk(); await page.waitForTimeout(300);
eq(await page.evaluate(() => __app.S.sessions.length), 0, 'Daten gelöscht: Verlauf leer');
eq(await page.evaluate(() => Object.keys(__app.S.photos).length), 0, 'Daten gelöscht: Fotos leer');
await page.setInputFiles('[data-import]', file); await page.waitForSelector('#modal [data-m="ok"]'); await modalOk(); await page.waitForTimeout(500);
eq(await page.evaluate(() => __app.S.sessions.length), 1, 'Import: Verlauf wieder da');
eq(await page.evaluate(() => __app.S.plan.exercises[2].name), 'Rudern eigener Name', 'Import: Plan wieder da');
if (OWN_PHOTO) ok(await page.evaluate(() => !!__app.S.photos[1]), 'Import: eigenes Foto wieder da');
await page.setInputFiles('[data-import]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"anders"}') }); await page.waitForTimeout(300);
ok(/nicht aus dieser App/.test(await page.locator('#toast').innerText()), 'Import: falsche Datei wird abgelehnt');

console.log('6b. Plan auf ein zweites Gerät übertragen (Verlauf bleibt)');
await go('plan/ex/4'); await page.waitForSelector('#x-name');
await page.fill('#x-name', 'Schulterdrücken Gerät A'); await page.locator('[data-act="saveEx"]').click(); await page.waitForTimeout(150);
await go('backup'); await page.waitForSelector('#plan-transfer'); await hscroll('Sicherung mit Plan-Übertragung'); await page.locator('#plan-transfer').scrollIntoViewIfNeeded(); await shot('18-plan-uebertragen');
const [dl3] = await Promise.all([page.waitForEvent('download'), tapAct('exportPlan')]);
const planFile = path.join(SHOTS, 'plan.json'); await dl3.saveAs(planFile);
const pf = JSON.parse(fs.readFileSync(planFile, 'utf8'));
ok(pf.kind === 'plan' && !pf.sessions && pf.plan.exercises[4].name === 'Schulterdrücken Gerät A', 'Plan-Export enthält nur den Plan (ohne Verlauf)');
if (OWN_PHOTO) ok(!!pf.photos[1], 'Plan-Export enthält eigenes Foto');
// Gerät B: eigenes Browserprofil mit eigenem Verlauf
const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pb = await ctxB.newPage();
await pb.goto(URL_); await pb.waitForSelector('[data-act="start"]');
await pb.evaluate(async () => { const s = { id: 'geraet-b', startedAt: Date.now(), endedAt: Date.now(), durationSec: 60, status: 'done', entries: [{ kind: 'sets', exId: 2, name: 'Enges Rudern', blockName: 'A', unit: 'kg', sets: [{ type: 'work', reps: 10, targetReps: 10, weight: 15, targetWeight: 15 }] }] };
  const r = indexedDB.open('fitness-app-2026'); await new Promise((res) => { r.onsuccess = () => { const tx = r.result.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put(s); tx.oncomplete = res; }; }); });
await pb.reload(); await pb.evaluate((x) => { location.hash = x; }, 'backup'); await pb.waitForSelector('[data-planimport]', { state: 'attached' });
await pb.setInputFiles('[data-planimport]', planFile); await pb.waitForSelector('#modal [data-m="ok"]');
ok(/Verlauf bleibt erhalten/.test(await pb.locator('#modal').innerText()), 'Rückfrage nennt, dass der Verlauf erhalten bleibt');
await pb.locator('#modal [data-m="ok"]').click(); await pb.waitForTimeout(400);
eq(await pb.evaluate(() => __app.S.plan.exercises[4].name), 'Schulterdrücken Gerät A', 'Gerät B: Plan übernommen');
eq(await pb.evaluate(() => __app.S.sessions.map((s) => s.id).join()), 'geraet-b', 'Gerät B: eigener Verlauf unverändert');
if (OWN_PHOTO) ok(await pb.evaluate(() => !!__app.S.photos[1]), 'Gerät B: eigenes Foto übernommen');
await pb.reload(); await pb.waitForSelector('#app h1');
eq(await pb.evaluate(() => __app.S.plan.exercises[4].name), 'Schulterdrücken Gerät A', 'Gerät B: Plan nach Neuladen gespeichert');
// Plan-Datei im Sicherungs-Import wird abgewiesen
await pb.setInputFiles('[data-import]', planFile); await pb.waitForTimeout(300);
ok(/Plan importieren/.test(await pb.locator('#toast').innerText()), 'Plan-Datei im vollständigen Import wird abgewiesen');
await ctxB.close();

console.log('7. Neu laden und Offline');
await page.reload(); await page.waitForSelector('text=Sicherung');
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('#app h1');
eq(await page.evaluate(() => __app.S.sessions.length), 1, 'offline: Verlauf vorhanden');
await go('plan/ex/3'); await page.waitForSelector('.photo img');
ok(await page.evaluate(() => { const i = document.querySelector('.photo img'); return i.complete && i.naturalWidth > 0; }), 'offline: Standardfoto wird angezeigt');
await go('plan/ex/1'); await page.waitForSelector('.photo img');
ok(await page.evaluate(() => { const i = document.querySelector('.photo img'); return i.complete && i.naturalWidth > 0; }), 'offline: Foto (Übung 1) wird angezeigt');
await go('plan/ex/12'); await page.waitForSelector('.photo svg');
ok(true, 'Übung 12: Platzhaltersymbol statt Foto');
await ctx.setOffline(false);

console.log('8. Timer nach Display-aus (2 min) – simulierte Uhr');
const p2 = await ctx.newPage();
await p2.clock.install({ time: new Date('2026-11-02T10:00:00') });
await p2.goto(URL_); await p2.waitForSelector('[data-act="start"]');
await p2.locator('[data-act="start"]').click(); await p2.waitForSelector('#timerSec');
await p2.clock.runFor(1000);
await p2.clock.fastForward(120_000);   // Display 2 Minuten aus: keine Ticks, Zeit springt
await p2.clock.runFor(500);
const t1 = await p2.locator('#timerSec').innerText(), c1 = await p2.locator('#clock').innerText();
ok(['07:57', '07:58', '07:59', '08:00'].includes(t1), `Cardio-Countdown nach 2 min Display-aus: ${t1}`);
ok(['02:01', '02:02', '02:03', '02:00'].includes(c1), `Gesamtuhr nach 2 min Display-aus: ${c1}`);
await p2.locator('[data-act="done"]').click(); await p2.waitForSelector('#in-reps');
await p2.locator('[data-act="done"]').click(); await p2.waitForSelector('.rest');
await p2.clock.runFor(1000); await p2.clock.fastForward(20_000); await p2.clock.runFor(500);
const r1 = await p2.locator('#restSec').innerText();
ok(['00:08', '00:09', '00:10', '00:11'].includes(r1), `Pausentimer (30 s) nach 20 s Display-aus: ${r1}`);
await p2.reload(); await p2.waitForSelector('#clock');
ok(true, 'Laufendes Training überlebt Neuladen');
await p2.close();

ok(errors.length === 0, 'keine Konsolenfehler' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(`\n${checks - fails}/${checks} Prüfungen bestanden. Screenshots: ${SHOTS}`);
process.exit(fails ? 1 : 0);
