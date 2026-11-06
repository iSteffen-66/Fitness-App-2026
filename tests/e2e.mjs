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
const planSets = await page.evaluate(() => __app.L.buildSteps(__app.S.plan).filter((x) => x.type === 'set').length);
eq(nSets, planSets, 'Alle Sätze des Plans gespeichert');
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
eq(await page.locator('#p-chg').inputValue(), '60', 'Plan: Wechselzeit zwischen Blöcken 60 s');
ok((await page.locator('text=↓ danach 1 min Wechselzeit').count()) === 7, 'Plan: 7 Übergänge mit 1 min Wechselzeit angezeigt');
ok(/A Roter Käfig[\s\S]*30 s Wechsel zwischen Übungen/.test(await page.locator('[data-sort="blocks"]').innerText()), 'Plan: Roter Käfig mit 30 s Wechsel zwischen Übungen');
ok(!(await page.evaluate(() => 9 in __app.S.plan.exercises || 10 in __app.S.plan.exercises)), 'Plan: Übungen 9 und 10 entfallen');
ok(/A Roter Käfig[\s\S]*B Zirkeltraining[\s\S]*C Freie Gewichte[\s\S]*C Plank[\s\S]*D Zirkel/.test(await page.locator('[data-sort="blocks"]').innerText()), 'Plan: Reihenfolge der Blöcke');
eq(await page.locator('[data-sort="blocks"] > .block').count(), 8, '8 Blöcke');
const ids0 = await page.evaluate(() => __app.S.plan.blocks.find((b) => b.id === 'b06').items.join());
await page.locator('[data-act="mv"][data-k="item"][data-id="5"][data-d="1"]').click(); await page.waitForTimeout(100);
eq(await page.evaluate(() => __app.S.plan.blocks.find((b) => b.id === 'b06').items.join()), '4,6,5,11', 'Pfeiltaste: Reihenfolge geändert (Nr. bleibt)');
// Drag & Drop per Zeiger: Übung 6 hinter 5 ziehen
const h6 = page.locator('[data-sort="items"][data-key="b06"] .item[data-id="6"] .drag');
const t5 = page.locator('[data-sort="items"][data-key="b06"] .item[data-id="5"]');
await h6.scrollIntoViewIfNeeded();
const hb = await h6.boundingBox(), tb = await t5.boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
await page.mouse.move(tb.x + 50, tb.y + tb.height - 5, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
eq(await page.evaluate(() => __app.S.plan.blocks.find((b) => b.id === 'b06').items.join()), '4,5,6,11', 'Drag & Drop: Reihenfolge geändert');
await page.locator('a[href="#/plan/ex/1"]').click(); await page.waitForSelector('#x-name'); await hscroll('Übung bearbeiten'); await shot('13-uebung-edit');
await page.fill('#x-name', 'Bankdrücken Test'); await page.fill('#x-r0', '8'); await page.fill('#x-w0', '12,5'); await page.fill('#x-step', '1,25');
await page.locator('[data-act="xaddSet"]').click(); await page.locator('[data-act="saveEx"]').click(); await page.waitForTimeout(150);
const ex1 = await page.evaluate(() => __app.S.plan.exercises[1]);
ok(ex1.name === 'Bankdrücken Test' && ex1.sets.length === 3 && ex1.sets[0].reps === 8 && ex1.sets[0].weight === 12.5 && ex1.step === 1.25, 'Übung gespeichert');
// neue Übung
await page.locator('[data-act="addEx"][data-b="b02"]').click(); await page.waitForSelector('#x-name');
eq(await page.evaluate(() => location.hash), '#/plan/ex/18', 'neue Übung bekommt feste Nr. 18');
await page.fill('#x-name', 'Testübung'); await page.locator('[data-act="saveEx"]').click(); await page.waitForTimeout(150);
await page.locator('a[href="#/plan/ex/18"]').click(); await page.waitForSelector('#x-name');
await page.locator('[data-act="delEx"]').click(); await shot('14-uebung-loeschen'); await modalOk(); await page.waitForTimeout(150);
ok(!(await page.evaluate(() => 18 in __app.S.plan.exercises)), 'Übung gelöscht');
// Block-Zeiten
await page.locator('a[href="#/plan/block/b02"]').click(); await page.waitForSelector('#b-end'); await hscroll('Block bearbeiten'); await shot('15-block-edit');
await page.fill('#b-end', '33'); await page.locator('[data-act="saveBlock"]').click(); await page.waitForTimeout(150);
eq(await page.evaluate(() => __app.L.planTotalMinutes(__app.S.plan)), 77, 'Gesamtdauer aus Blockzeiten (Block verlängert, Summe = max Ende)');
await tapAct('align'); await page.waitForTimeout(150);
eq(await page.evaluate(() => __app.L.planTotalMinutes(__app.S.plan)), 80, 'Zeiten lückenlos (inkl. 1 min Wechselzeiten) → 80 min');
await page.locator('[data-act="resetPlan"]').click(); await modalOk(); await page.waitForTimeout(200);
eq(await page.evaluate(() => __app.S.plan.exercises[1].name), 'Bankdrücken liegend', 'Plan zurückgesetzt');
eq(await page.evaluate(() => __app.L.planTotalMinutes(__app.S.plan)), 77, 'Gesamtdauer wieder 77 min');

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
// Kleine Plan-Datei ohne Fotos per „Plan aus Text einfügen“: eigenes Foto auf Gerät B bleibt
const slim = { ...pf }; delete slim.photos; slim.plan = structuredClone(pf.plan); slim.plan.exercises[2].name = 'Rudern per Text';
await pb.evaluate((x) => { location.hash = x; }, 'backup'); await pb.waitForSelector('[data-act="pastePlan"]');
const photosBefore = await pb.evaluate(() => Object.keys(__app.S.photos).join());
await pb.click('[data-act="pastePlan"]'); await pb.waitForSelector('#m-plan');
await pb.fill('#m-plan', JSON.stringify(slim)); await pb.click('#modal [data-m="ok"]');
await pb.waitForSelector('#modal [data-m="ok"]');
ok(/eigene Fotos bleiben unverändert/.test(await pb.locator('#modal').innerText()), 'Text-Import: Rückfrage nennt, dass Fotos bleiben');
await pb.click('#modal [data-m="ok"]'); await pb.waitForTimeout(400);
eq(await pb.evaluate(() => __app.S.plan.exercises[2].name), 'Rudern per Text', 'Text-Import: Plan übernommen');
eq(await pb.evaluate(() => Object.keys(__app.S.photos).join()), photosBefore, 'Text-Import ohne Fotos: eigene Fotos unverändert');
await pb.click('[data-act="pastePlan"]'); await pb.waitForSelector('#m-plan');
await pb.fill('#m-plan', '{"app":"fitness-app-2026","plan":'); await pb.click('#modal [data-m="ok"]'); await pb.waitForTimeout(300);
ok(/Kein gültiger Plan/.test(await pb.locator('#toast').innerText()), 'Text-Import: unvollständiger Text wird verständlich abgewiesen');
ok(await pb.evaluate(() => !document.querySelector('[data-planimport]').hasAttribute('accept')), 'Dateiauswahl ohne Typfilter (iOS graut .json nicht aus)');
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

console.log('7b. Gerät belegt: später, vorziehen, auslassen und nachholen');
{
  const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const q = await cx.newPage();
  q.on('pageerror', (e) => errors.push(e.message));
  await q.goto(URL_); await q.waitForSelector('[data-act="start"]');
  await q.click('[data-act="start"]'); await q.waitForSelector('#timerSec');
  await q.click('[data-act="done"]'); await q.waitForSelector('#in-reps');
  const h1 = () => q.locator('h1').first().innerText();
  eq(await h1(), 'Bankdrücken liegend', 'Start mit Bankdrücken');
  await q.click('[data-act="order"]'); await q.waitForSelector('#modal [data-m="later"]');
  const ow = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  ok(ow.sw <= ow.iw, 'Auswahl „Gerät belegt?“ ohne horizontales Scrollen');
  await q.screenshot({ path: path.join(SHOTS, '19-geraet-belegt.png') });
  await q.click('#modal [data-m="later"]'); await q.waitForTimeout(150);
  eq(await h1(), 'Enges Rudern', 'Später: nächste Übung kommt dran');
  await q.click('[data-act="order"]'); await q.click('#modal [data-m="go|b:b06"]'); await q.waitForTimeout(150);
  eq(await h1(), 'Schulterdrücken', 'Zirkeltraining B vorgezogen');
  await q.click('[data-act="order"]'); await q.click('#modal [data-m="skip"]'); await q.waitForTimeout(150);
  eq(await h1(), 'Butterfly', 'Schulterdrücken ausgelassen, Zirkel läuft weiter');
  ok(/ausgelassene Übung/.test(await q.locator('#app').innerText()), 'Hinweis auf ausgelassene Übung');
  await q.click('[data-act="order"]'); await q.waitForSelector('#modal [data-m="go|b:b06"]');
  ok(/Wieder aufnehmen: Schulterdrücken/.test(await q.locator('#modal').innerText()), 'Ausgelassene Übung im laufenden Block wieder aufnehmbar');
  await q.click('#modal [data-m="x"]');
  // Rest durchklicken
  for (let i = 0; i < 200 && q.url().includes('#/training'); i++) {
    if (await q.locator('[data-act="finishnow"]').count()) break;
    const w = q.locator('#in-weight');
    if (await w.count() && (await w.inputValue()) === '') await w.fill('20');
    await q.click('[data-act="done"]'); await q.waitForTimeout(30);
  }
  ok(/Noch offen/.test(await q.locator('h1').first().innerText()), 'Am Ende: ausgelassene Übung wird angeboten');
  await q.screenshot({ path: path.join(SHOTS, '20-noch-offen.png') });
  await q.click('[data-act="bring"]'); await q.waitForTimeout(150);
  eq(await h1(), 'Schulterdrücken', 'Ausgelassene Übung nachgeholt');
  for (let i = 0; i < 10 && q.url().includes('#/training'); i++) { await q.click('[data-act="done"]'); await q.waitForTimeout(30); }
  await q.waitForURL(/#\/history\/\w+/);
  const ss = await q.evaluate(() => __app.S.sessions[0]);
  const bf = ss.entries.find((e) => e.exId === 4);
  ok(bf && bf.sets.filter((x) => x.type === 'work').length === 2, 'Schulterdrücken-Arbeitssätze nachgeholt und gespeichert');
  const total = await q.evaluate(() => __app.L.buildSteps(__app.S.plan).filter((x) => x.type === 'set').length);
  eq(ss.entries.reduce((n, e) => n + (e.sets ? e.sets.length : 0), 0), total, 'Alle Sätze trotz geänderter Reihenfolge gespeichert');
  await cx.close();
}

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
ok(/Wechselzeit → A Roter Käfig/.test(await p2.locator('.rest').innerText()), 'Nach Cardio: Wechselzeit → A Roter Käfig angezeigt');
eq(await p2.locator('#restSec').innerText(), '01:00', 'Wechselzeit 1 min');
await p2.screenshot({ path: path.join(SHOTS, '24-wechselzeit.png') });
await p2.locator('[data-act="done"]').click(); await p2.waitForSelector('.rest');
await p2.clock.runFor(1000); await p2.clock.fastForward(20_000); await p2.clock.runFor(500);
const r1 = await p2.locator('#restSec').innerText();
ok(['00:08', '00:09', '00:10', '00:11'].includes(r1), `Pausentimer (30 s) nach 20 s Display-aus: ${r1}`);
await p2.reload(); await p2.waitForSelector('#clock');
ok(true, 'Laufendes Training überlebt Neuladen');
await p2.close();

console.log('9. Modus „alternate“: Testplan B freie Gewichte (SZ 3, Tri 3, Plank 2)');
{
  const { defaultPlan } = await import('../app/js/seed.js');
  const L = await import('../app/js/logic.js');
  const plan = defaultPlan();
  plan.exercises[7].sets = [1, 2, 3].map(() => ({ reps: 10, weight: 5 }));
  plan.exercises[8].sets = [1, 2, 3].map(() => ({ reps: 10, weight: 25 }));
  plan.exercises[15] = { id: 15, name: 'Plank', device: 'Matte', tech: 'Körper gerade', photo: null, warmup: null,
    sets: [{ reps: 1, weight: null, text: '60 s halten' }, { reps: 1, weight: null, text: '60 s halten' }],
    unit: '', sides: 'none', rest: 45, warmRest: 30, step: null, optional: false };
  const blk = plan.blocks.find((b) => b.id === 'b08');
  Object.assign(blk, { name: 'B freie Gewichte', mode: 'alternate', items: [7, 8, 15], roundRest: null, start: 0, end: 10 });
  plan.blocks = [blk];                        // nur dieser Block, damit der Test direkt einsteigt
  const testFile = path.join(SHOTS, 'testplan-alternate.json');
  fs.writeFileSync(testFile, JSON.stringify(L.buildPlanExport(plan, {}, Date.now())));

  const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const q = await cx.newPage();
  q.on('pageerror', (e) => errors.push(e.message));
  await q.goto(URL_ + '#/backup'); await q.waitForSelector('[data-planimport]', { state: 'attached' });
  await q.setInputFiles('[data-planimport]', testFile); await q.click('#modal [data-m="ok"]'); await q.waitForTimeout(300);
  await q.evaluate(() => { location.hash = '#/plan/block/b08'; }); await q.waitForSelector('#b-mode');
  eq(await q.locator('#b-mode').inputValue(), 'alternate', 'Plan-Editor: Modus „abwechselnd“ gewählt');
  eq(await q.locator('#b-rr').inputValue(), '', 'Plan-Editor: Rundenpause leer (= Pause der letzten Übung)');
  const opts = await q.locator('#b-mode option').allInnerTexts();
  ok(opts.some((o) => /nacheinander/.test(o)) && opts.some((o) => /Abwechselnd/.test(o)), 'Plan-Editor: Auswahl nacheinander / abwechselnd');
  await q.screenshot({ path: path.join(SHOTS, '21-editor-alternate.png') });

  await q.evaluate(() => { location.hash = '#/'; }); await q.waitForSelector('[data-act="start"]');
  await q.click('[data-act="start"]'); await q.waitForSelector('#in-reps');
  const SHORT = { 'Scott-Curl SZ-Stange': 'SZ', 'Trizepsdrücken am Seil': 'Tri', Plank: 'Plank' };
  const where = async () => {
    const name = SHORT[await q.locator('h1').first().innerText()] || '?';
    const tag = await q.locator('.tag.ac').first().innerText();
    return tag === 'Aufwärmsatz' ? name + '-Aufw' : name + tag.replace('Runde ', '').split('/')[0];
  };
  const seq = []; const rests = [];
  let reloaded = false;
  for (let i = 0; i < 20 && q.url().includes('#/training'); i++) {
    const w = await where();
    seq.push(w);
    if (w === 'SZ1') await q.screenshot({ path: path.join(SHOTS, '22-alternate-sz1.png') });
    if (w === 'Plank2' && !reloaded) {
      // direkt nach Tri2 neu geladen (siehe unten)
    }
    await q.click('[data-act="done"]'); await q.waitForTimeout(80);
    if (!q.url().includes('#/training')) break;
    rests.push(w + ':' + ((await q.locator('#restSec').count()) ? (await q.locator('#restSec').innerText()) : '–'));
    if (w === 'Tri2' && !reloaded) {
      reloaded = true;
      await q.reload(); await q.waitForSelector('#in-reps');
      eq(await where(), 'Plank2', 'Nach Neuladen zwischen Tri2 und Plank2: weiter bei Plank Runde 2');
      eq(await q.locator('.tag.ac').first().innerText(), 'Runde 2/3', 'Anzeige „Runde 2/3“');
      ok(await q.locator('.rest').count() === 1, 'Laufende Wechselpause nach Neuladen weiter sichtbar');
      ok(/Als Nächstes: Scott-Curl SZ-Stange · Runde 3\/3/.test(await q.locator('#app').innerText()), 'Anzeige „Als Nächstes“ mit Runde');
      await q.screenshot({ path: path.join(SHOTS, '23-nach-neuladen-plank2.png') });
    }
  }
  console.log('     Ablauf:', seq.join(', '));
  console.log('     Pausen:', rests.join(', '));
  eq(seq.filter((x) => !x.endsWith('-Aufw')).join(','), 'SZ1,Tri1,Plank1,SZ2,Tri2,Plank2,SZ3,Tri3', 'Reihenfolge laut Testplan');
  eq(seq.slice(0, 2).join(','), 'SZ-Aufw,Tri-Aufw', 'Erst alle Aufwärmsätze');
  ok(rests.find((r) => r.startsWith('SZ1:')).endsWith('00:30') && rests.find((r) => r.startsWith('Plank1:')).endsWith('00:45'), 'Pausen: 30 s Wechsel, Rundenpause = Pause der letzten Übung (45 s)');
  await q.waitForURL(/#\/history\/\w+/);
  const sess = await q.evaluate(() => __app.S.sessions[0]);
  eq(JSON.stringify(sess.entries.map((e) => [e.exId, e.sets.filter((x) => x.type === 'work').length])), '[[7,3],[8,3],[15,2]]', 'Protokoll: je Übung ein Eintrag mit allen Sätzen');
  // Export → Import identisch
  await q.evaluate(() => { location.hash = '#/backup'; }); await q.waitForSelector('[data-act="exportPlan"]');
  const [d] = await Promise.all([q.waitForEvent('download'), q.click('[data-act="exportPlan"]')]);
  const back = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
  ok(JSON.stringify(back.plan) === JSON.stringify(plan), 'Export → Import → Export: Plan identisch (Byte-Vergleich)');
  await cx.close();
}

ok(errors.length === 0, 'keine Konsolenfehler' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(`\n${checks - fails}/${checks} Prüfungen bestanden. Screenshots: ${SHOTS}`);
process.exit(fails ? 1 : 0);
