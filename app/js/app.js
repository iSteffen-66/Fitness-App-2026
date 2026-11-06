import * as L from './logic.js';
import { createStore, idbAdapter } from './db.js';

const { fmtNum, fmtClock, parseNum } = L;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = { plan: null, sessions: [], photos: {}, meta: {}, active: null, route: [], ui: { form: {}, hist: 'trainings' } };
let store;
let wakeLock = null;
let audio = null;

// ---------- Hilfen ----------
const dateFmt = (t) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const nav = (h) => { location.hash = '#/' + h; };
const setText = (id, t) => { const e = document.getElementById(id); if (e && e.textContent !== t) e.textContent = t; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3000);
}
function modal(html) {
  return new Promise((res) => {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
    const close = (v) => { m.hidden = true; m.innerHTML = ''; m.onclick = null; res(v); };
    m.onclick = (e) => {
      const b = e.target.closest('[data-m]');
      if (b) {
        if (b.dataset.m === 'ok') {
          const o = {};
          m.querySelectorAll('[name]').forEach((i) => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
          close(o);
        } else if (b.dataset.m === 'x') close(null);
        else close({ choice: b.dataset.m });
      } else if (e.target === m) close(null);
    };
  });
}
const confirmBox = (text, ok = 'Löschen', cls = 'danger') =>
  modal(`<p>${esc(text)}</p><div class="row"><button class="btn ghost" data-m="x">Abbrechen</button><button class="btn ${cls}" data-m="ok">${esc(ok)}</button></div>`).then((v) => !!v);

function setByPath(o, path, v) {
  const p = path.split('.'); let t = o;
  for (let i = 0; i < p.length - 1; i++) t = t[p[i]] ??= {};
  t[p[p.length - 1]] = v;
}
const savePlan = () => store.savePlan(S.plan);
const persistActive = () => (S.active ? store.saveActive(S.active) : store.clearActive());

// ---------- Ton, Vibration, Display wach ----------
function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* kein Ton möglich */ }
}
function notify() {
  try {
    if (audio) {
      const t0 = audio.currentTime;
      [0, 0.28, 0.56].forEach((d) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
        o.start(t0 + d); o.stop(t0 + d + 0.25);
      });
    }
  } catch { /* ignorieren */ }
  try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch { /* iOS: nicht unterstützt */ }
}
async function lockScreen() {
  if (!('wakeLock' in navigator)) { S.ui.noWake = true; return; }
  try {
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    S.ui.noWake = false;
  } catch { S.ui.noWake = true; }
}
function unlockScreen() { try { wakeLock?.release(); } catch { /* ignorieren */ } wakeLock = null; }

// ---------- Fotos ----------
const ICON_PH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-label="Kein Foto"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>';
function photoSrc(exId) {
  return S.photos[exId] || S.plan.exercises[exId]?.photo || null;
}
const photoHTML = (exId) => {
  const s = photoSrc(exId);
  return `<div class="photo">${s ? `<img src="${esc(s)}" alt="Foto: ${esc(S.plan.exercises[exId]?.name)}">` : ICON_PH}</div>`;
};
const miniPhoto = (exId) => {
  const s = photoSrc(exId);
  return s ? `<img class="mini" src="${esc(s)}" alt="">` : `<div class="mini photo" style="height:64px;min-height:0">${ICON_PH.replace('<svg', '<svg style="width:28px;height:28px"')}</div>`;
};
async function readPhoto(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    bmp = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const k = Math.min(1, 1200 / w);
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

// ---------- Router / Render ----------
const NAV = [['', 'Start', '●'], ['history', 'Verlauf', '☰'], ['plan', 'Plan', '✎'], ['backup', 'Sicherung', '⇅']];

function render() {
  S.route = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [r] = S.route;
  if (r === 'training' && !S.active) { nav(''); return; }
  const fid = document.activeElement && document.activeElement.id;
  if (!(r === 'plan' && S.route[1] === 'ex')) S.ui.xd = null;
  if (!(r === 'plan' && S.route[1] === 'block')) S.ui.bd = null;
  const app = $('#app');
  app.className = r === 'training' ? 'tr' : '';
  let html;
  try {
    html = r === 'training' ? viewTraining()
      : r === 'history' ? viewHistory()
        : r === 'plan' ? viewPlan()
          : r === 'backup' ? viewBackup() : viewHome();
  } catch (e) { console.error(e); html = `<div class="card bad"><b>Fehler:</b> ${esc(e.message)}</div>`; }
  app.innerHTML = html;
  const nv = $('#nav');
  nv.hidden = r === 'training';
  nv.innerHTML = NAV.map(([h, t, i]) => `<a href="#/${h}" class="${(r || '') === h ? 'on' : ''}"><b>${i}</b>${t}</a>`).join('');
  initSort();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); } }
  if (r === 'training') lockScreen(); else unlockScreen();
  window.scrollTo(0, S.ui.keepScroll ?? 0); S.ui.keepScroll = 0;
}
const rerender = () => { S.ui.keepScroll = window.scrollY; render(); };

// ---------- Start ----------
function backupAgeText() {
  const t = S.meta.lastExport;
  if (!t) return 'Noch nie exportiert.';
  const d = Math.floor((Date.now() - t) / 86400000);
  return d === 0 ? 'Zuletzt heute exportiert.' : `Zuletzt vor ${d} Tag${d === 1 ? '' : 'en'} exportiert.`;
}
const backupWarn = (link = true) => `<div class="card warn"><b>Daten sichern!</b>
  <p class="sm">Plan, Verlauf und Fotos liegen nur in diesem Browser. Auf dem iPhone kann Safari diese Daten löschen (z. B. bei Speicherplatzmangel oder wenn die App lange nicht geöffnet wurde). Exportiere regelmäßig eine Sicherung.</p>
  <p class="sm muted">${backupAgeText()}</p>${link ? '<a class="btn ghost" href="#/backup">Zur Sicherung</a>' : ''}</div>`;

function viewHome() {
  const a = S.active;
  const p = S.plan;
  const total = L.planTotalMinutes(p);
  let h = `<h1>Training</h1><p class="muted">${total} min · ${p.blocks.length} Blöcke</p>`;
  if (a) {
    h += `<div class="card ok"><b>Training läuft${a.pausedAt ? ' (pausiert)' : ''}</b>
      <p class="sm">Gestartet ${timeFmt(a.startedAt)} · Schritt ${Math.min(a.stepIndex + 1, a.steps.length)} von ${a.steps.length}</p>
      <div class="row"><button class="btn ghost" data-act="discard">Verwerfen</button><button class="btn ok" data-act="resume">Fortsetzen</button></div></div>`;
  } else {
    const hasOpt = Object.values(p.exercises).some((e) => e.optional);
    h += `<div class="card">${hasOpt ? `<label class="chk"><input type="checkbox" data-chk="inclOpt" ${S.ui.inclOpt === false ? '' : 'checked'}> Optionale Übungen einbeziehen</label>` : ''}
      <button class="btn" data-act="start" style="margin-top:8px">Training starten</button></div>`;
  }
  h += backupWarn();
  h += '<h2>Ablauf</h2>';
  for (const b of p.blocks) {
    const names = b.kind === 'timed' ? `${fmtNum(b.minutes)} min · ${esc(b.note || '')}` : (b.items || []).map((id) => esc(p.exercises[id]?.name)).join(' + ');
    h += `<div class="item"><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${L.fmtWindow(b)} · ${names}</div></div></div>`;
  }
  return h;
}

// ---------- Training ----------
function initForm() {
  const a = S.active, step = L.currentStep(a);
  if (!step) return;
  if (step.type === 'set') {
    const pre = L.prefill(a, step, S.sessions);
    S.ui.form = { idx: step.index, reps: fmtNum(pre.reps), weight: fmtNum(pre.weight) };
  } else S.ui.form = { idx: step.index, minutes: '', note: '' };
}

const fmtSec = (r) => (r >= 60 && r % 60 === 0 ? `${r / 60} min` : `${r} s`);
function restPreview(a, step, next) {
  const r = L.restAfter(a, step, next);
  if (r <= 0) return '';
  return next.blockId !== step.blockId ? ` (nach ${fmtSec(r)} Wechselzeit)` : ` (nach ${fmtSec(r)} Pause)`;
}
const MODE_NAME = { single: 'Einzeln', superset: 'Supersatz', circuit: 'Zirkel', alternate: 'Abwechselnd' };
function setLabel(step) {
  if (step.setType === 'warmup') return 'Aufwärmsatz';
  if (step.mode === 'single') return `Arbeitssatz ${step.setNo}/${step.setCount}`;
  return `Runde ${step.round}/${step.rounds}`;
}

function viewTraining() {
  const a = S.active, now = Date.now();
  const step = L.currentStep(a);
  if (!step) {
    const open = L.openUnits(a);
    let e = `<h1>${open.length ? 'Noch offen' : 'Alles erledigt'}</h1>`;
    if (open.length) e += '<p class="muted">Diese Übungen hast du ausgelassen. Du kannst sie jetzt nachholen oder das Training beenden.</p>' + open.map(unitRow).join('');
    return e + `<button class="btn ${open.length ? 'ghost' : 'ok'}" style="margin-top:12px" data-act="finishnow">Training abschließen</button>`;
  }
  if (S.ui.form.idx !== step.index) initForm();
  const f = S.ui.form;
  const blk = a.blocks.find((b) => b.id === step.blockId);
  const behind = L.behindMinutes(a, now);
  const pct = Math.round((a.stepIndex / a.steps.length) * 100);
  let h = `<div class="th"><div><div class="clock" id="clock">${fmtClock(L.elapsedMs(a, now) / 1000)}</div>
    <div class="sm muted">Plan ${a.planMinutes} min · jetzt: ${blk ? `${fmtNum(blk.start)}–${fmtNum(blk.end)} min` : ''}</div></div>
    <div class="row fit"><button class="btn sm ghost" data-act="pause">${a.pausedAt ? 'Weiter' : 'Pause'}</button><button class="btn sm ghost" data-act="finish">Beenden</button></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
  if (S.ui.noWake) h += '<p class="sm muted">Das Display bleibt hier nicht automatisch an. Stelle „Automatische Sperre“ (iOS: Anzeige &amp; Helligkeit) während des Trainings auf „Nie“.</p>';
  if (a.pausedAt) {
    return h + `<div class="card"><h1>Training pausiert</h1><p class="muted">Uhr und Timer stehen.</p></div><button class="btn ok" data-act="pause">Weiter trainieren</button>`;
  }
  if (behind > 0) h += `<div class="card warn sm">Du liegst ${behind} min hinter dem Zeitplan (Block „${esc(step.blockName)}“ sollte um Minute ${fmtNum(blk.end)} fertig sein).</div>`;
  if (a.rest) {
    h += `<div class="rest"><div class="sm">${a.rest.change ? `Wechselzeit → ${esc(a.rest.toBlock || 'nächster Block')}` : 'Pause'}</div><div class="big" id="restSec">${fmtClock(L.remainingSec(a.rest.endAt, now))}</div>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="rest+">+15 s</button><button class="btn sm" data-act="restskip">${a.rest.change ? 'Weiter' : 'Pause beenden'}</button></div></div>`;
  }
  if (step.type === 'timed') {
    const t = a.timer, over = now >= t.endAt;
    h += `<h1>${esc(step.blockName)}</h1><p class="muted">${esc(step.note)}</p>
      <div class="big-timer" id="timerSec">${over ? '+' + fmtClock((now - t.endAt) / 1000) : fmtClock(L.remainingSec(t.endAt, now))}</div>
      <p class="muted" style="text-align:center">Soll: ${fmtNum(step.seconds / 60)} min${over ? ' · Zeit abgelaufen' : ''}</p>
      <label class="f" for="in-min">Tatsächliche Dauer (min)</label>
      <input id="in-min" inputmode="decimal" data-in="form.minutes" value="${esc(f.minutes)}" placeholder="leer = verstrichene Zeit des Timers">
      <label class="f" for="in-note">Gerät / Notiz (optional)</label>
      <input id="in-note" data-in="form.note" value="${esc(f.note)}" placeholder="z. B. Crosstrainer">
      <div class="cta"><div class="row"><button class="btn ghost" data-act="back">Zurück</button><button class="btn ok" data-act="done">Fertig</button></div></div>
      <button class="btn ghost" style="margin-top:8px" data-act="order">Später / andere Übung</button>${openHint(a)}`;
    return h;
  }
  const ex = S.plan.exercises[step.exId] || {};
  const sug = step.setType === 'work' && step.setNo === 1 ? L.suggestProgression(S.sessions, ex) : null;
  const rec = L.findRecorded(a, step);
  const next = a.steps.slice(a.stepIndex + 1).find((s) => !(s.type === 'set' && a.skipped.includes(s.exId)));
  const weighted = step.unit !== '';
  const open = weighted && step.weight == null;
  h += photoHTML(step.exId);
  h += `<h1>${esc(step.name)}</h1><div class="muted">${esc(ex.device || '')}</div><div style="margin-top:8px">
    <span class="tag ac">${setLabel(step)}</span>${step.side ? `<span class="tag g">${step.side === 'links' ? 'Links' : 'Rechts'}${step.unit === 'kg je Arm' ? ' (Arm)' : ''}</span>` : ''}
    ${step.mode !== 'single' && step.groupSize > 1 ? `<span class="tag">${MODE_NAME[step.mode]} · Übung ${step.groupPos + 1}/${step.groupSize}</span>` : ''}
    ${step.optional ? '<span class="tag w">optional</span>' : ''}${rec ? '<span class="tag g">erfasst</span>' : ''}</div>`;
  if (ex.tech) h += `<p class="sm">${esc(ex.tech)}</p>`;
  h += `<div class="soll">Soll: <b>${step.reps} Wdh.</b>${weighted ? (open ? ' · Gewicht offen' : ` × <b>${fmtNum(step.weight)} ${esc(step.unit)}</b>`) : ''}${step.text ? ` <span class="muted">(${esc(step.text)})</span>` : ''}</div>`;
  if (open) h += '<div class="card warn sm">Für diese Übung ist noch kein Gewicht hinterlegt. Trage das Gewicht des ersten Satzes ein, es wird als neues Soll übernommen.</div>';
  if (sug) h += `<div class="card ok sm">Letztes Mal alles geschafft. Vorschlag: <b>${fmtNum(sug.weight)} ${esc(ex.unit)}</b> (+${fmtNum(sug.step)}) <button class="btn sm" style="margin-top:8px" data-act="takeSug" data-w="${sug.weight}">Übernehmen</button></div>`;
  h += `<div class="grid2"><div><label class="f" for="in-reps">Wiederholungen</label><div class="stepper">
      <button class="btn ghost" data-act="adj" data-f="reps" data-d="-1" aria-label="weniger">−</button>
      <input id="in-reps" inputmode="numeric" data-in="form.reps" value="${esc(f.reps)}">
      <button class="btn ghost" data-act="adj" data-f="reps" data-d="1" aria-label="mehr">+</button></div></div>
    ${weighted ? `<div><label class="f" for="in-weight">Gewicht (${esc(step.unit)})</label><div class="stepper">
      <button class="btn ghost" data-act="adj" data-f="weight" data-d="-${L.stepOf(ex) || 1}" aria-label="weniger">−</button>
      <input id="in-weight" inputmode="decimal" data-in="form.weight" value="${esc(f.weight)}">
      <button class="btn ghost" data-act="adj" data-f="weight" data-d="${L.stepOf(ex) || 1}" aria-label="mehr">+</button></div></div>` : ''}</div>
    ${next ? `<p class="sm muted">Als Nächstes: <b>${next.type === 'timed' ? esc(next.blockName) : esc(next.name)}</b>${next.type === 'set' ? ` · ${next.setType === 'warmup' ? 'Aufwärmsatz' : next.mode === 'single' ? `Satz ${next.setNo}/${next.setCount}` : `Runde ${next.round}/${next.rounds}`}${next.side ? ' · ' + next.side : ''}` : ''}${restPreview(a, step, next)}</p>` : ''}
    <div class="cta"><button class="btn ok" data-act="done">Erledigt</button></div>
    <div class="row" style="margin-top:8px"><button class="btn ghost" data-act="back">Zurück</button><button class="btn ghost" data-act="order">Gerät belegt?</button></div>
    ${openHint(a)}`;
  return h;
}

const unitRow = (u) => `<div class="item"><div class="grow"><div class="t">${esc(u.label)}</div>
  <div class="s">${u.timed ? 'Zeitblock' : `${u.pending} ${u.pending === 1 ? 'Satz' : 'Sätze'} offen`}${u.timed || u.key.startsWith('b:') ? '' : ' · ' + esc(u.blockName)}${u.skippedNames.length ? ` · <span class="tag w">ausgelassen: ${esc(u.skippedNames.join(', '))}</span>` : ''}</div></div>
  <button class="btn sm ok" data-act="bring" data-key="${esc(u.key)}">Jetzt</button></div>`;
function openHint(a) {
  const n = L.openUnits(a).reduce((k, u) => k + u.skippedNames.length, 0);
  return n ? `<p class="sm muted" style="margin-top:8px">${n} ausgelassene Übung${n === 1 ? '' : 'en'} – über „${L.currentStep(a)?.type === 'timed' ? 'Später / andere Übung' : 'Gerät belegt?'}“ jederzeit nachholbar.</p>` : '';
}
async function orderSheet() {
  const a = S.active, cur = L.currentStep(a);
  if (!cur) return;
  const curKey = L.unitKey(cur);
  const all = L.openUnits(a);
  const me = all.find((u) => u.key === curKey);
  const others = all.filter((u) => u.key !== curKey);
  const next = others.find((u) => !u.skipped);
  const btnRow = (u) => `<div class="item"><div class="grow"><div class="t">${esc(u.label)}</div>
    <div class="s">${u.timed ? 'Zeitblock' : `${u.pending} ${u.pending === 1 ? 'Satz' : 'Sätze'} offen`}${u.skippedNames.length ? ' · ausgelassen: ' + esc(u.skippedNames.join(', ')) : ''}</div></div>
    <button class="btn sm ok" data-m="go|${esc(u.key)}">Jetzt</button></div>`;
  const r = await modal(`<h3>Gerät belegt?</h3><p class="sm muted">Aktuell: <b>${esc(me ? me.label : cur.name || cur.blockName)}</b>. Nichts geht verloren: Erfasste Sätze bleiben gespeichert, offene Sätze kannst du jederzeit nachholen.</p>
    <button class="btn" data-m="later" ${next ? '' : 'disabled'}>Später machen${next ? ` (nach „${esc(next.label)}“)` : ''}</button>
    ${cur.type === 'set' ? '<button class="btn ghost" style="margin-top:8px" data-m="skipset">Nur diesen Satz auslassen</button>' : ''}
    ${cur.type === 'set' ? '<button class="btn ghost" style="margin-top:8px" data-m="skip">Ganze Übung auslassen (bleibt nachholbar)</button>' : ''}
    ${me && me.skippedNames.length ? `<button class="btn ghost" style="margin-top:8px" data-m="go|${esc(curKey)}">Wieder aufnehmen: ${esc(me.skippedNames.join(', '))}</button>` : ''}
    ${others.length ? `<h3 style="margin-top:16px">Stattdessen jetzt machen</h3>${others.map(btnRow).join('')}` : ''}
    <div class="row"><button class="btn ghost" data-m="x">Abbrechen</button></div>`);
  if (!r) return;
  const now = Date.now();
  if (r.choice === 'later') { const l = L.postponeCurrent(a, now); toast(l ? `Verschoben hinter „${l}“.` : 'Keine weitere offene Übung.'); }
  else if (r.choice === 'skip') L.skipCurrent(a, now);
  else if (r.choice === 'skipset') L.skipSet(a, now);
  else if (r.choice.startsWith('go|')) L.bringToFront(a, r.choice.slice(3), now);
  await persistActive();
  if (!L.currentStep(a) && !L.openUnits(a).length) { await finishTraining(false); return; }
  initForm(); rerender(); window.scrollTo(0, 0);
}

async function startTraining() {
  unlockAudio();
  S.ui.inclOpt = S.ui.inclOpt !== false;
  S.active = L.newActive(S.plan, Date.now(), { skipOptional: !S.ui.inclOpt });
  if (!S.active.steps.length) { S.active = null; toast('Der Plan enthält keine Schritte.'); return; }
  S.ui.form = {};
  await persistActive();
  nav('training');
}
async function finishTraining(aborted) {
  const s = L.finalizeSession(S.active, Date.now(), aborted);
  S.sessions = S.sessions.filter((x) => x.id !== s.id).concat(s);
  await store.saveSession(s);
  S.active = null; await persistActive();
  S.ui.justDone = s.id;
  nav('history/' + s.id);
}
async function doneStep() {
  unlockAudio();
  const a = S.active, step = L.currentStep(a), f = S.ui.form;
  let res;
  if (step.type === 'set') {
    const reps = parseNum(f.reps), w = parseNum(f.weight);
    if (reps === null || reps < 0) { toast('Bitte Wiederholungen eingeben.'); return; }
    if (step.unit !== '' && w === null) { toast('Bitte das Gewicht eingeben.'); $('#in-weight')?.focus(); return; }
    res = L.completeStep(a, { reps, weight: w }, Date.now());
    if (res.newTarget) {
      const ex = S.plan.exercises[res.newTarget.exId];
      ex.sets.forEach((s) => { if (s.weight == null) s.weight = res.newTarget.weight; });
      await savePlan();
    }
  } else {
    const m = parseNum(f.minutes);
    const t = a.timer;
    const def = Math.max(0.5, Math.round((Date.now() - t.startedAt) / 30000) / 2);
    res = L.completeStep(a, { actualSec: Math.round((m ?? def) * 60), note: f.note }, Date.now());
  }
  await persistActive();
  if (res.finished && !L.openUnits(a).length) { await finishTraining(false); return; }
  initForm(); rerender(); window.scrollTo(0, 0);
}

function tick() {
  const a = S.active;
  if (!a || S.route[0] !== 'training') return;
  const now = Date.now();
  setText('clock', fmtClock(L.elapsedMs(a, now) / 1000));
  if (a.pausedAt !== null) return;
  let changed = false;
  if (a.rest) {
    const rem = L.remainingSec(a.rest.endAt, now);
    if (rem <= 0) { notify(); a.rest = null; changed = true; } else setText('restSec', fmtClock(rem));
  }
  if (a.timer) {
    if (now >= a.timer.endAt) {
      if (!a.timer.notified) { a.timer.notified = true; notify(); changed = true; }
      setText('timerSec', '+' + fmtClock((now - a.timer.endAt) / 1000));
    } else setText('timerSec', fmtClock(L.remainingSec(a.timer.endAt, now)));
  }
  if (changed) { persistActive(); rerender(); }
}

// ---------- Verlauf ----------
const unitShort = (u) => (u === '' ? '' : ' ' + u);
function setText2(x, unit) {
  const w = x.weight === null || x.weight === undefined ? '' : ` × ${fmtNum(x.weight)}${unitShort(unit)}`;
  return `${x.reps} Wdh.${w}`;
}
function viewHistory() {
  const [, a, b] = S.route;
  if (a === 'ex' && b) return viewExHistory(b);
  if (a && a !== 'ex') return viewSession(a);
  const tab = a === 'ex' ? 'ex' : 'trainings';
  let h = `<h1>Verlauf</h1><div class="seg"><a href="#/history" class="${tab === 'trainings' ? 'on' : ''}">Trainings</a><a href="#/history/ex" class="${tab === 'ex' ? 'on' : ''}">Übungen</a></div>`;
  if (tab === 'ex') {
    const ids = S.plan.blocks.flatMap((x) => x.items || []);
    for (const id of ids) {
      const ex = S.plan.exercises[id]; if (!ex) continue;
      const lv = L.lastValue(S.sessions, id);
      h += `<a class="item" href="#/history/ex/${id}">${miniPhoto(id)}<div class="grow"><div class="t ellip">${esc(ex.name)}</div>
        <div class="s">${lv ? `Zuletzt ${dateFmt(lv.date)}: ${setText2(lv, ex.unit)}` : 'Noch keine Daten'}</div></div></a>`;
    }
    return h;
  }
  const list = L.sortedSessions(S.sessions);
  if (!list.length) return h + '<div class="card muted">Noch kein Training gespeichert.</div>';
  for (const s of list) {
    h += `<a class="item" href="#/history/${s.id}"><div class="grow"><div class="t">${dateFmt(s.startedAt)} · ${timeFmt(s.startedAt)}</div>
      <div class="s">${L.fmtMin(s.durationSec)} · ${L.sessionSetCount(s)} Sätze · ${fmtNum(L.sessionVolume(s))} kg Volumen${s.status === 'aborted' ? ' · vorzeitig beendet' : ''}</div></div><span class="muted">›</span></a>`;
  }
  return h;
}
function viewSession(id) {
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return '<a class="btn ghost" href="#/history">‹ Verlauf</a><p>Training nicht gefunden.</p>';
  const done = S.ui.justDone === id;
  let h = `<a class="btn ghost sm" href="#/history">‹ Verlauf</a>`;
  if (done) h += `<div class="card ok"><h2 style="margin-top:0">Training ${s.status === 'aborted' ? 'vorzeitig beendet' : 'geschafft'}</h2>
    <p>Dauer <b>${L.fmtMin(s.durationSec)}</b> · <b>${L.sessionSetCount(s)}</b> Sätze erledigt · Gesamtvolumen <b>${fmtNum(L.sessionVolume(s))} kg</b></p>
    <p class="sm muted">Volumen = Gewicht × Wiederholungen aller Arbeitssätze, Gewicht wie eingegeben.</p>
    <p class="sm">Tipp: Sicherung exportieren.</p></div>`;
  h += `<h1>${dateFmt(s.startedAt)}</h1><p class="muted">${timeFmt(s.startedAt)} Uhr · ${L.fmtMin(s.durationSec)} · ${L.sessionSetCount(s)} Sätze · ${fmtNum(L.sessionVolume(s))} kg</p>`;
  s.entries.forEach((e, ei) => {
    if (e.kind === 'timed') {
      h += `<div class="card"><div class="row between"><div><h3>${esc(e.name)}</h3><div class="sm muted">${fmtNum(Math.round(e.actualSec / 6) / 10)} min (Soll ${fmtNum(e.targetSec / 60)} min)${e.note ? ' · ' + esc(e.note) : ''}</div></div>
        <div class="row fit"><button class="btn ghost ic" data-act="editTimed" data-s="${s.id}" data-e="${ei}" aria-label="Bearbeiten">✎</button><button class="btn ghost ic" data-act="delEntry" data-s="${s.id}" data-e="${ei}" aria-label="Löschen">🗑</button></div></div></div>`;
      return;
    }
    h += `<div class="card"><div class="row between"><h3>${esc(e.name)}</h3><button class="btn ghost ic" data-act="delEntry" data-s="${s.id}" data-e="${ei}" aria-label="Übung löschen">🗑</button></div>`;
    e.sets.forEach((x, si) => {
      h += `<div class="setrow"><span class="tag ${x.type === 'warmup' ? '' : 'ac'}">${x.type === 'warmup' ? 'Aufw.' : 'Arbeit'}</span>
        <div class="grow">${x.side ? `<span class="muted">${x.side}</span> ` : ''}${setText2(x, e.unit)}<div class="sm muted">Soll ${x.targetReps}${x.targetWeight != null ? ' × ' + fmtNum(x.targetWeight) : ''}</div></div>
        <button class="btn ghost ic" data-act="editSet" data-s="${s.id}" data-e="${ei}" data-i="${si}" aria-label="Satz bearbeiten">✎</button>
        <button class="btn ghost ic" data-act="delSet" data-s="${s.id}" data-e="${ei}" data-i="${si}" aria-label="Satz löschen">🗑</button></div>`;
    });
    h += '</div>';
  });
  return h + `<button class="btn danger" data-act="delSession" data-s="${s.id}" style="margin-top:16px">Ganzes Training löschen</button>`;
}
function chartSvg(pts) {
  if (!pts.length) return '';
  const W = 320, H = 150, p = 30, n = pts.length;
  let lo = Math.min(...pts.map((q) => q.y)), hi = Math.max(...pts.map((q) => q.y));
  if (lo === hi) { lo -= 1; hi += 1; }
  const X = (i) => (n === 1 ? W / 2 : p + (i * (W - 2 * p)) / (n - 1));
  const Y = (v) => H - p + 4 - ((v - lo) / (hi - lo)) * (H - 2 * p);
  const d = pts.map((q, i) => `${X(i).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf Arbeitsgewicht"><polyline points="${d}" fill="none" stroke="#ff5a3c" stroke-width="2.5"/>
    ${pts.map((q, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="4" fill="#ff5a3c"/>`).join('')}
    <text x="4" y="${Y(hi) + 4}" fill="#9aa3b2" font-size="11">${fmtNum(hi)}</text><text x="4" y="${Y(lo) + 4}" fill="#9aa3b2" font-size="11">${fmtNum(lo)}</text>
    <text x="${p}" y="${H - 4}" fill="#9aa3b2" font-size="10">${new Date(pts[0].t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</text>
    <text x="${W - p}" y="${H - 4}" fill="#9aa3b2" font-size="10" text-anchor="end">${new Date(pts[n - 1].t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</text></svg>`;
}
function viewExHistory(id) {
  const ex = S.plan.exercises[id];
  if (!ex) return '<a class="btn ghost" href="#/history/ex">‹ Übungen</a>';
  const hist = L.exerciseHistory(S.sessions, id);
  const sug = L.suggestProgression(S.sessions, ex);
  let h = `<a class="btn ghost sm" href="#/history/ex">‹ Übungen</a><h1>${esc(ex.name)}</h1><p class="muted">${esc(ex.device || '')} · Nr. ${id}</p>`;
  if (!hist.length) return h + '<div class="card muted">Noch keine Daten.</div>';
  const last = L.lastValue(S.sessions, id);
  h += `<p>Letzter Wert: <b>${setText2(last, ex.unit)}</b> (${dateFmt(last.date)})</p>`;
  if (ex.unit !== '') {
    h += `<h2>Arbeitsgewicht</h2>${chartSvg(hist.filter((x) => x.maxWeight != null).map((x) => ({ t: x.date, y: x.maxWeight })))}`;
    h += sug ? `<div class="card ok">Alle Arbeitssätze beim letzten Mal geschafft. Vorschlag: <b>${fmtNum(sug.weight)} ${esc(ex.unit)}</b> (+${fmtNum(sug.step)})</div>`
      : '<div class="card sm muted">Kein Steigerungsvorschlag: beim letzten Mal wurden nicht alle Arbeitssätze mit voller Wiederholungszahl geschafft.</div>';
    h += `<p class="sm muted">Steigerungsstufe: ${fmtNum(L.stepOf(ex))} kg (im Plan-Editor änderbar).</p>`;
  }
  h += '<h2>Trainings</h2>';
  for (const x of [...hist].reverse()) {
    h += `<a class="item" href="#/history/${x.sessionId}"><div class="grow"><div class="t">${dateFmt(x.date)}</div><div class="s">${x.sets.map((q) => setText2(q, ex.unit)).join(' · ')}</div></div><span class="muted">›</span></a>`;
  }
  return h;
}

// ---------- Plan ----------
function exSummary(ex) {
  const sets = ex.sets || [];
  const w = (s) => (ex.unit === '' ? '' : s.weight == null ? ', Gewicht offen' : `, ${fmtNum(s.weight)}${unitShort(ex.unit).replace(' kg', ' kg')}`);
  const same = sets.every((s) => s.reps === sets[0].reps && s.weight === sets[0].weight);
  const txt = same ? `${sets.length} × ${sets[0].reps}${w(sets[0])}` : sets.map((s) => `${s.reps}${w(s)}`).join(' + ');
  return txt + (ex.sides === 'Seite' ? ' je Seite' : ex.sides === 'Arm' ? ' je Arm' : '') + (ex.optional ? ' · optional' : '');
}
const arrows = (kind, id, key = '') => `<button class="btn ghost ic" data-act="mv" data-k="${kind}" data-id="${id}" data-key="${key}" data-d="-1" aria-label="nach oben">↑</button><button class="btn ghost ic" data-act="mv" data-k="${kind}" data-id="${id}" data-key="${key}" data-d="1" aria-label="nach unten">↓</button>`;

function viewPlan() {
  const [, kind, id] = S.route;
  if (kind === 'ex') return viewPlanEx(Number(id));
  if (kind === 'block') return viewPlanBlock(id);
  const p = S.plan;
  const std = L.blockChangeOf(p, {});
  let h = `<h1>Plan</h1><p class="muted">Gesamtdauer: <b>${L.planTotalMinutes(p)} min</b> (aus den Blockzeiten berechnet). Zum Sortieren am ☰ ziehen oder die Pfeile nutzen. Antippen bearbeitet.</p>
    <label class="f" for="p-chg">Wechselzeit zwischen Blöcken (s)</label><input id="p-chg" inputmode="numeric" data-planchg value="${esc(p.blockChange ?? L.DEFAULT_BLOCK_CHANGE)}">
    <p class="sm muted">Gilt für alle Blöcke ohne eigenen Wert (Block antippen → „Wechselzeit danach“). Danach „Zeiten lückenlos“ tippen, damit die Zeitfenster die Wechselzeiten enthalten.</p><div data-sort="blocks">`;
  for (const b of p.blocks) {
    h += `<div class="block" data-id="${b.id}"><div class="row"><span class="drag" aria-hidden="true">☰</span>
      <a class="grow" style="text-decoration:none;color:inherit;flex:1;min-width:0" href="#/plan/block/${b.id}"><div class="t"><b>${esc(b.name)}</b></div><div class="s sm muted">${L.fmtWindow(b)}${b.mode === 'superset' ? ' · Supersatz' : b.mode === 'alternate' ? ' · Abwechselnd' : b.mode === 'circuit' ? ` · Zirkel ${b.rounds}×` : ''}${b.kind === 'timed' ? ' · Zeit ' + fmtNum(b.minutes) + ' min' : ''}</div></a>
      <div class="row fit">${arrows('block', b.id)}</div></div>`;
    if (b.kind !== 'timed') {
      h += `<div data-sort="items" data-key="${b.id}">`;
      for (const eid of b.items || []) {
        const ex = p.exercises[eid]; if (!ex) continue;
        h += `<div class="item" data-id="${eid}"><span class="drag" aria-hidden="true">☰</span><a class="grow" style="text-decoration:none;color:inherit" href="#/plan/ex/${eid}"><div class="t ellip">#${eid} ${esc(ex.name)}</div><div class="s ellip">${esc(exSummary(ex))}</div></a>
          <div class="row fit">${arrows('item', eid, b.id)}</div></div>`;
      }
      h += `</div><button class="btn ghost sm" style="width:100%" data-act="addEx" data-b="${b.id}">+ Übung in diesen Block</button>`;
    } else h += `<div class="sm muted" style="padding:4px 8px">${esc(b.note || '')}</div>`;
    if (b !== p.blocks[p.blocks.length - 1]) {
      const c = L.blockChangeOf(p, b);
      h += `<div class="sm muted" style="padding:6px 8px 0">↓ danach ${c ? fmtSec(c) + ' Wechselzeit' : 'kein Wechsel'}${c !== std ? ' (eigener Wert)' : ''}</div>`;
    }
    h += '</div>';
  }
  h += `</div><div class="grid2"><button class="btn" data-act="addBlock">+ Block</button><button class="btn ghost" data-act="align">Zeiten lückenlos</button></div>
    <a class="btn ghost" style="margin-top:10px" href="#/backup" data-act="toPlanTransfer">Plan auf andere Geräte übertragen</a>
    <button class="btn ghost" style="margin-top:10px" data-act="resetPlan">Plan auf Ausgangsversion zurücksetzen</button>`;
  return h;
}

function toDraftEx(ex) {
  const b = L.findBlockOf(S.plan, ex.id);
  const w = ex.warmup;
  return {
    id: ex.id, name: ex.name, device: ex.device || '', tech: ex.tech || '', unit: ex.unit, sides: ex.sides || 'none',
    rest: String(ex.rest ?? 60), warmRest: String(ex.warmRest ?? 30), step: ex.step ? fmtNum(ex.step) : '', optional: !!ex.optional,
    blockId: b ? b.id : '', warmOn: !!w, warmReps: String(w?.reps ?? 10), warmWeight: fmtNum(w?.weight ?? 0), warmText: w?.text || '',
    sets: ex.sets.map((s) => ({ reps: String(s.reps), weight: fmtNum(s.weight), text: s.text || '' })),
  };
}
function viewPlanEx(id) {
  const ex = S.plan.exercises[id];
  if (!ex) return '<a class="btn ghost" href="#/plan">‹ Plan</a><p>Übung nicht gefunden.</p>';
  if (!S.ui.xd || S.ui.xd.id !== id) S.ui.xd = toDraftEx(ex);
  const d = S.ui.xd, wt = d.unit !== '';
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(t)}</option>`;
  const custom = !!S.photos[id];
  let h = `<a class="btn ghost sm" href="#/plan" data-act="cancelEx">‹ Plan (ohne Speichern)</a><h1>Übung #${id}</h1>
    <p class="sm muted">Die Nummer ist fest und gehört zum Foto. Die Reihenfolge im Plan ist unabhängig davon.</p>
    ${photoHTML(id)}
    <div class="grid2"><label class="btn ghost" style="cursor:pointer"><input type="file" accept="image/*" data-photo="${id}" hidden>Foto aufnehmen / wählen</label>
    <button class="btn ghost" data-act="photoDefault" ${custom ? '' : 'disabled'}>Standardbild</button></div>
    <label class="f" for="x-name">Name</label><input id="x-name" data-in="xd.name" value="${esc(d.name)}">
    <label class="f" for="x-dev">Gerät</label><input id="x-dev" data-in="xd.device" value="${esc(d.device)}">
    <label class="f" for="x-tech">Technikhinweis</label><textarea id="x-tech" data-in="xd.tech">${esc(d.tech)}</textarea>
    <label class="f" for="x-block">Block</label><select id="x-block" data-in="xd.blockId">${S.plan.blocks.filter((b) => b.kind !== 'timed').map((b) => opt(b.id, `${b.name} (${L.fmtWindow(b)})`, d.blockId)).join('')}</select>
    <div class="grid2"><div><label class="f" for="x-unit">Einheit</label><select id="x-unit" data-in="xd.unit" data-rr>${[['kg', 'kg'], ['kg je Seite', 'kg je Seite'], ['kg je Arm', 'kg je Arm'], ['', 'ohne Gewicht']].map(([v, t]) => opt(v, t, d.unit)).join('')}</select></div>
    <div><label class="f" for="x-sides">Ausführung</label><select id="x-sides" data-in="xd.sides">${[['none', 'normal'], ['Seite', 'je Seite (links/rechts)'], ['Arm', 'je Arm (links/rechts)']].map(([v, t]) => opt(v, t, d.sides)).join('')}</select></div></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" data-chk="xd.warmOn" data-rr ${d.warmOn ? 'checked' : ''}> Aufwärmsatz</label>`;
  if (d.warmOn) h += `<div class="grid2"><div><label class="f" for="x-wr">Wdh.</label><input id="x-wr" inputmode="numeric" data-in="xd.warmReps" value="${esc(d.warmReps)}"></div>
    ${wt ? `<div><label class="f" for="x-ww">Gewicht</label><input id="x-ww" inputmode="decimal" data-in="xd.warmWeight" value="${esc(d.warmWeight)}"></div>` : ''}</div>
    <label class="f" for="x-wt">Hinweis Aufwärmsatz</label><input id="x-wt" data-in="xd.warmText" value="${esc(d.warmText)}" placeholder="z. B. ohne Scheiben">`;
  h += '<h2>Arbeitssätze</h2>';
  d.sets.forEach((s, i) => {
    h += `<div class="card"><div class="grid2"><div><label class="f" for="x-r${i}">Wdh.</label><input id="x-r${i}" inputmode="numeric" data-in="xd.sets.${i}.reps" value="${esc(s.reps)}"></div>
      ${wt ? `<div><label class="f" for="x-w${i}">Gewicht (leer = offen)</label><input id="x-w${i}" inputmode="decimal" data-in="xd.sets.${i}.weight" value="${esc(s.weight)}"></div>` : ''}</div>
      <label class="f" for="x-t${i}">Hinweis (optional)</label><input id="x-t${i}" data-in="xd.sets.${i}.text" value="${esc(s.text)}">
      <button class="btn ghost sm" style="margin-top:8px" data-act="xdelSet" data-i="${i}" ${d.sets.length < 2 ? 'disabled' : ''}>Satz entfernen</button></div>`;
  });
  h += `<button class="btn ghost" data-act="xaddSet">+ Arbeitssatz</button>
    <div class="grid2"><div><label class="f" for="x-rest">Pause nach Arbeitssatz (s)</label><input id="x-rest" inputmode="numeric" data-in="xd.rest" value="${esc(d.rest)}"></div>
    <div><label class="f" for="x-wrest">Pause nach Aufwärmen (s)</label><input id="x-wrest" inputmode="numeric" data-in="xd.warmRest" value="${esc(d.warmRest)}"></div></div>
    ${wt ? `<label class="f" for="x-step">Steigerungsstufe in kg (leer = Standard ${fmtNum(L.defaultStep(d.unit))})</label><input id="x-step" inputmode="decimal" data-in="xd.step" value="${esc(d.step)}">` : ''}
    <label class="chk" style="margin-top:8px"><input type="checkbox" data-chk="xd.optional" ${d.optional ? 'checked' : ''}> Übung ist optional</label>
    <div class="cta"><button class="btn ok" data-act="saveEx">Speichern</button></div>
    <button class="btn danger" data-act="delEx" style="margin-top:8px">Übung löschen</button>`;
  return h;
}

function viewPlanBlock(id) {
  const b = S.plan.blocks.find((x) => x.id === id);
  if (!b) return '<a class="btn ghost" href="#/plan">‹ Plan</a><p>Block nicht gefunden.</p>';
  if (!S.ui.bd || S.ui.bd.id !== id) {
    S.ui.bd = { id, name: b.name, start: fmtNum(b.start), end: fmtNum(b.end), kind: b.kind, mode: b.mode || 'single', rounds: String(b.rounds ?? 2), roundRest: b.roundRest === null || b.roundRest === undefined || b.roundRest === '' ? (b.mode === 'circuit' ? '60' : '') : String(b.roundRest), minutes: fmtNum(b.minutes ?? 10), note: b.note || '', changeAfter: b.changeAfter === null || b.changeAfter === undefined || b.changeAfter === '' ? '' : String(b.changeAfter) };
  }
  const d = S.ui.bd;
  const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
  let h = `<a class="btn ghost sm" href="#/plan" data-act="cancelEx">‹ Plan (ohne Speichern)</a><h1>Block bearbeiten</h1>
    <label class="f" for="b-name">Name</label><input id="b-name" data-in="bd.name" value="${esc(d.name)}">
    <div class="grid2"><div><label class="f" for="b-start">Start (min)</label><input id="b-start" inputmode="decimal" data-in="bd.start" value="${esc(d.start)}"></div>
    <div><label class="f" for="b-end">Ende (min)</label><input id="b-end" inputmode="decimal" data-in="bd.end" value="${esc(d.end)}"></div></div>
    <label class="f" for="b-kind">Art</label><select id="b-kind" data-in="bd.kind" data-rr>${opt('sets', 'Übungen', d.kind)}${opt('timed', 'Zeitblock (Cardio, Pause, Dehnen)', d.kind)}</select>`;
  if (d.kind === 'timed') h += `<label class="f" for="b-min">Dauer (min)</label><input id="b-min" inputmode="decimal" data-in="bd.minutes" value="${esc(d.minutes)}">
    <label class="f" for="b-note">Hinweis</label><textarea id="b-note" data-in="bd.note">${esc(d.note)}</textarea>`;
  else {
    h += `<label class="f" for="b-mode">Ablauf</label><select id="b-mode" data-in="bd.mode" data-rr>${opt('single', 'Einzeln nacheinander', d.mode)}${opt('alternate', 'Abwechselnd (Satzpaare: 30 s Wechsel, Pause nach der Runde)', d.mode)}${opt('superset', 'Supersatz (abwechselnd, Pause erst nach der Runde)', d.mode)}${opt('circuit', 'Zirkel (feste Rundenzahl)', d.mode)}</select>
      <p class="sm muted">Abwechselnd und Supersatz: Übung 1 Satz 1, Übung 2 Satz 1, Übung 1 Satz 2 … Reihenfolge der Übungen im Plan festlegen. Zirkel: alle Übungen je Runde, Pause nach der Runde.</p>`;
    if (d.mode === 'alternate') h += `<label class="f" for="b-rr">Pause nach der Runde (s)</label><input id="b-rr" inputmode="numeric" data-in="bd.roundRest" value="${esc(d.roundRest)}" placeholder="leer = Pause der letzten Übung der Runde">
      <p class="sm muted">Ablauf: erst alle Aufwärmsätze, dann Runde 1 (Satz 1 jeder Übung), Runde 2 … Zwischen den Übungen einer Runde ${L.SWITCH_REST} s Wechselpause. Übungen mit weniger Sätzen fallen in späteren Runden weg.</p>`;
    if (d.mode === 'circuit') h += `<div class="grid2"><div><label class="f" for="b-rounds">Runden</label><input id="b-rounds" inputmode="numeric" data-in="bd.rounds" value="${esc(d.rounds)}"></div>
      <div><label class="f" for="b-rr">Pause nach Runde (s)</label><input id="b-rr" inputmode="numeric" data-in="bd.roundRest" value="${esc(d.roundRest)}"></div></div>`;
  }
  h += `<label class="f" for="b-chg">Wechselzeit danach (s)</label><input id="b-chg" inputmode="numeric" data-in="bd.changeAfter" value="${esc(d.changeAfter)}" placeholder="leer = Standard (${L.blockChangeOf(S.plan, {})} s)">
    <p class="sm muted">Zeit bis zum nächsten Block, z. B. für den Weg in einen anderen Bereich. 0 = direkt weiter.</p>`;
  return h + `<div class="cta"><button class="btn ok" data-act="saveBlock">Speichern</button></div><button class="btn danger" data-act="delBlock" style="margin-top:8px">Block löschen</button>`;
}

// ---------- Sicherung ----------
function viewBackup() {
  const nPh = Object.keys(S.photos).length;
  return `<h1>Sicherung</h1>${backupWarn(false)}
    <p class="muted">Enthalten: Plan, ${S.sessions.length} Training${S.sessions.length === 1 ? '' : 's'}, ${nPh} eigene${nPh === 1 ? 's' : ''} Foto${nPh === 1 ? '' : 's'}.</p>
    <button class="btn" data-act="exportJson">Alles exportieren (JSON)</button>
    ${typeof navigator.canShare === 'function' ? '<button class="btn ghost" style="margin-top:10px" data-act="shareJson">Sicherung teilen / in Dateien sichern</button>' : ''}
    <button class="btn ghost" style="margin-top:10px" data-act="exportCsv">Verlauf als CSV exportieren</button>
    <label class="btn ghost" style="margin-top:10px;cursor:pointer"><input type="file" accept="application/json,.json" data-import hidden>Sicherung importieren (JSON)</label>
    <p class="sm muted">Der Import einer Sicherung ersetzt <b>alles</b> auf diesem Gerät, auch den Verlauf.</p>
    ${planTransferHTML()}
    <h2>Gefahrenbereich</h2><button class="btn danger" data-act="wipe">Alle Daten löschen</button>`;
}
function planTransferHTML() {
  const share = typeof navigator.canShare === 'function';
  return `<h2 id="plan-transfer">Plan auf andere Geräte übertragen</h2>
    <p class="sm muted">Überträgt nur den Plan (mit eigenen Fotos der Übungen). Der Verlauf bleibt auf jedem Gerät erhalten.</p>
    <ol class="sm muted" style="padding-left:20px;margin:6px 0 10px"><li>Hier auf dem Gerät mit dem geänderten Plan: ${share ? '„Plan teilen“ (z. B. per AirDrop) oder ' : ''}„Plan exportieren“.</li><li>Auf dem anderen Gerät: „Plan importieren“ und die Datei wählen.</li></ol>
    ${share ? '<button class="btn" data-act="sharePlan">Plan teilen (AirDrop, Dateien …)</button>' : ''}
    <button class="btn ${share ? 'ghost' : ''}" style="margin-top:10px" data-act="exportPlan">Plan exportieren</button>
    <label class="btn ghost" style="margin-top:10px;cursor:pointer"><input type="file" accept="application/json,.json" data-planimport hidden>Plan importieren</label>
    ${S.meta.planImportedAt ? `<p class="sm muted">Zuletzt importiert: ${dateFmt(S.meta.planImportedAt)} ${timeFmt(S.meta.planImportedAt)}${S.meta.planSourceAt ? ` (Stand vom ${dateFmt(S.meta.planSourceAt)} ${timeFmt(S.meta.planSourceAt)})` : ''}</p>` : ''}`;
}
function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
const exportJSON = () => JSON.stringify(L.buildExport(S.plan, S.sessions, S.photos));
async function markExport() { S.meta.lastExport = Date.now(); await store.saveMeta(S.meta); }

const planJSON = () => JSON.stringify(L.buildPlanExport(S.plan, S.photos));
const planFileName = () => `training-plan-${stamp()}.json`;

async function doPlanImport(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { toast('Die Datei ist kein gültiges JSON.'); return; }
  const r = L.readPlanImport(obj);
  if (!r.ok) { toast(r.error); return; }
  const nEx = Object.keys(r.plan.exercises).length, nPh = Object.keys(r.photos).length;
  const when = r.exportedAt ? ` vom ${dateFmt(r.exportedAt)} ${timeFmt(r.exportedAt)}` : '';
  const ok = await confirmBox(`Plan${when} übernehmen? (${r.plan.blocks.length} Blöcke, ${nEx} Übungen, ${nPh} eigene Fotos)${r.fromBackup ? ' Aus der Sicherung wird nur der Plan übernommen.' : ''} Der aktuelle Plan auf diesem Gerät wird ersetzt, der Verlauf bleibt erhalten.`, 'Plan übernehmen', 'ok');
  if (!ok) return;
  const photos = L.mergePlanPhotos(S.photos, r.plan, r.photos);
  await store.replacePlan(r.plan, photos);
  S.plan = await store.getPlan(); S.photos = await store.getPhotos();
  S.meta.planImportedAt = Date.now(); S.meta.planSourceAt = r.exportedAt; await store.saveMeta(S.meta);
  S.ui.xd = null; S.ui.bd = null;
  toast(S.active ? 'Plan übernommen. Gilt ab dem nächsten Training.' : 'Plan übernommen.'); rerender();
}

async function doImport(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { toast('Die Datei ist kein gültiges JSON.'); return; }
  const v = L.validateImport(obj);
  if (!v.ok) { toast(v.error); return; }
  const ok = await confirmBox(`Alle aktuellen Daten durch die Sicherung ersetzen? (${obj.sessions.length} Trainings, ${Object.keys(obj.photos || {}).length} Fotos)`, 'Importieren', 'ok');
  if (!ok) return;
  await store.replaceAll({ plan: obj.plan, sessions: obj.sessions, photos: obj.photos || {} });
  S.plan = await store.getPlan(); S.sessions = await store.listSessions(); S.photos = await store.getPhotos(); S.active = null;
  S.ui.xd = null; S.ui.bd = null;
  toast('Import abgeschlossen.'); rerender();
}

// ---------- Sortieren per Ziehen ----------
function initSort() {
  document.querySelectorAll('[data-sort]').forEach((box) => {
    box.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.drag');
      if (!h || h.closest('[data-sort]') !== box) return;
      let item = h; while (item && item.parentElement !== box) item = item.parentElement;
      if (!item) return;
      e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch { /* ignorieren */ }
      item.classList.add('dragging');
      let target = null, after = false;
      const clear = () => box.querySelectorAll(':scope > .drop-before, :scope > .drop-after').forEach((c) => c.classList.remove('drop-before', 'drop-after'));
      // DOM bleibt beim Ziehen unverändert (sonst bricht der Zeiger-Fokus ab); Einfügemarke zeigt das Ziel.
      const move = (ev) => {
        if (ev.clientY < 90) window.scrollBy(0, -14); else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
        let el = document.elementFromPoint(ev.clientX, ev.clientY);
        while (el && el.parentElement !== box) el = el.parentElement;
        clear(); target = null;
        if (el && el !== item) {
          const r = el.getBoundingClientRect();
          after = ev.clientY > r.top + r.height / 2; target = el;
          el.classList.add(after ? 'drop-after' : 'drop-before');
        }
      };
      const up = async () => {
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        item.classList.remove('dragging'); clear();
        if (!target) return;
        const ids = [...box.children].filter((c) => c !== item).map((c) => c.dataset.id);
        const i = ids.indexOf(target.dataset.id) + (after ? 1 : 0);
        ids.splice(i, 0, item.dataset.id);
        await applyOrder(box.dataset.sort, box.dataset.key, ids);
      };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
  });
}
async function applyOrder(kind, key, ids) {
  if (kind === 'blocks') S.plan.blocks = ids.map((id) => S.plan.blocks.find((b) => b.id === id)).filter(Boolean);
  else { const b = S.plan.blocks.find((x) => x.id === key); b.items = ids.map(Number); }
  await savePlan(); rerender();
}

// ---------- Aktionen ----------
const sessionOf = (id) => S.sessions.find((x) => x.id === id);
const saveSess = async (s) => { await store.saveSession(s); rerender(); };

const ACT = {
  start: startTraining,
  async resume() { unlockAudio(); nav('training'); },
  async discard() { if (await confirmBox('Laufendes Training verwerfen? Erfasste Sätze gehen verloren.', 'Verwerfen')) { S.active = null; await persistActive(); rerender(); } },
  async pause() {
    const a = S.active;
    if (a.pausedAt === null) L.pauseActive(a, Date.now()); else L.resumeActive(a, Date.now());
    await persistActive(); rerender();
  },
  async finish() {
    if (await confirmBox('Training jetzt beenden? Alle erfassten Sätze werden gespeichert.', 'Beenden', 'ok')) await finishTraining(true);
  },
  finishnow: () => finishTraining(false),
  done: doneStep,
  async back() {
    if (!L.goBack(S.active, Date.now())) { toast('Das ist der erste Schritt.'); return; }
    await persistActive(); initForm(); rerender();
  },
  order: orderSheet,
  async bring(d, el) { L.bringToFront(S.active, el.dataset.key, Date.now()); await persistActive(); initForm(); rerender(); window.scrollTo(0, 0); },
  adj(d, el) {
    const f = el.dataset.f, cur = parseNum(S.ui.form[f]) ?? 0;
    const v = Math.max(0, Math.round((cur + Number(el.dataset.d)) * 100) / 100);
    S.ui.form[f] = fmtNum(v);
    const inp = document.getElementById(f === 'reps' ? 'in-reps' : 'in-weight'); if (inp) inp.value = S.ui.form[f];
  },
  takeSug(d, el) { S.ui.form.weight = fmtNum(Number(el.dataset.w)); rerender(); },
  async 'rest+'() { if (S.active.rest) { S.active.rest.endAt += 15000; await persistActive(); setText('restSec', fmtClock(L.remainingSec(S.active.rest.endAt, Date.now()))); } },
  async restskip() { S.active.rest = null; await persistActive(); rerender(); },

  // Verlauf
  async editSet(d, el) {
    const s = sessionOf(el.dataset.s), e = s.entries[+el.dataset.e], x = e.sets[+el.dataset.i];
    const r = await modal(`<h3>Satz bearbeiten</h3><label class="f" for="m-reps">Wiederholungen</label><input id="m-reps" name="reps" inputmode="numeric" value="${esc(x.reps)}">
      ${e.unit !== '' ? `<label class="f" for="m-w">Gewicht (${esc(e.unit)})</label><input id="m-w" name="weight" inputmode="decimal" value="${esc(fmtNum(x.weight))}">` : ''}
      <div class="row"><button class="btn ghost" data-m="x">Abbrechen</button><button class="btn ok" data-m="ok">Speichern</button></div>`);
    if (!r) return;
    const reps = parseNum(r.reps); if (reps === null || reps < 0) { toast('Ungültige Wiederholungen.'); return; }
    L.updateSet(s, +el.dataset.e, +el.dataset.i, { reps, weight: e.unit === '' ? null : parseNum(r.weight) });
    await saveSess(s);
  },
  async delSet(d, el) {
    if (!(await confirmBox('Diesen Satz löschen?'))) return;
    const s = sessionOf(el.dataset.s); L.deleteSet(s, +el.dataset.e, +el.dataset.i); await saveSess(s);
  },
  async delEntry(d, el) {
    const s = sessionOf(el.dataset.s), e = s.entries[+el.dataset.e];
    if (!(await confirmBox(`„${e.name}“ mit allen Sätzen aus diesem Training löschen?`))) return;
    L.deleteEntry(s, +el.dataset.e); await saveSess(s);
  },
  async editTimed(d, el) {
    const s = sessionOf(el.dataset.s), e = s.entries[+el.dataset.e];
    const r = await modal(`<h3>${esc(e.name)}</h3><label class="f" for="m-min">Dauer (min)</label><input id="m-min" name="min" inputmode="decimal" value="${esc(fmtNum(Math.round(e.actualSec / 6) / 10))}">
      <label class="f" for="m-note">Notiz</label><input id="m-note" name="note" value="${esc(e.note || '')}">
      <div class="row"><button class="btn ghost" data-m="x">Abbrechen</button><button class="btn ok" data-m="ok">Speichern</button></div>`);
    if (!r) return;
    const m = parseNum(r.min); if (m === null || m < 0) { toast('Ungültige Dauer.'); return; }
    e.actualSec = Math.round(m * 60); e.note = r.note; await saveSess(s);
  },
  async delSession(d, el) {
    const s = sessionOf(el.dataset.s);
    if (!(await confirmBox(`Training vom ${dateFmt(s.startedAt)} komplett löschen?`))) return;
    await store.deleteSession(s.id); S.sessions = S.sessions.filter((x) => x.id !== s.id); nav('history');
  },

  // Plan
  mv: async (d, el) => {
    const dir = Number(el.dataset.d), id = el.dataset.id;
    const arr = el.dataset.k === 'block' ? S.plan.blocks : S.plan.blocks.find((b) => b.id === el.dataset.key).items;
    const i = el.dataset.k === 'block' ? arr.findIndex((b) => b.id === id) : arr.indexOf(Number(id));
    L.moveInArray(arr, i, i + dir); await savePlan(); rerender();
  },
  async addBlock() {
    const t = L.planTotalMinutes(S.plan), id = 'b' + L.uid();
    S.plan.blocks.push({ id, name: 'Neuer Block', start: t, end: t + 5, kind: 'sets', mode: 'single', items: [] });
    await savePlan(); S.ui.bd = null; nav('plan/block/' + id);
  },
  async addEx(d, el) {
    const id = L.addExercise(S.plan, el.dataset.b, { name: 'Neue Übung', device: '', tech: '', photo: null, warmup: null, sets: [{ reps: 10, weight: null }], unit: 'kg', sides: 'none', rest: 60, warmRest: 30, step: null, optional: false });
    await savePlan(); S.ui.xd = null; nav('plan/ex/' + id);
  },
  toPlanTransfer() { setTimeout(() => document.getElementById('plan-transfer')?.scrollIntoView(), 80); },
  cancelEx() { S.ui.xd = null; S.ui.bd = null; },
  xaddSet() { const d = S.ui.xd, l = d.sets[d.sets.length - 1]; d.sets.push({ ...l }); rerender(); },
  xdelSet(d, el) { S.ui.xd.sets.splice(+el.dataset.i, 1); rerender(); },
  async saveEx() {
    const d = S.ui.xd, ex = S.plan.exercises[d.id];
    if (!d.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
    const sets = d.sets.map((s) => ({ reps: parseNum(s.reps) || 0, weight: d.unit === '' ? null : parseNum(s.weight), text: s.text.trim() })).filter((s) => s.reps > 0);
    if (!sets.length) { toast('Mindestens ein Arbeitssatz mit Wiederholungen nötig.'); return; }
    Object.assign(ex, {
      name: d.name.trim(), device: d.device.trim(), tech: d.tech.trim(), unit: d.unit, sides: d.sides, sets,
      rest: parseNum(d.rest) ?? 60, warmRest: parseNum(d.warmRest) ?? 30, step: parseNum(d.step), optional: d.optional,
      warmup: d.warmOn ? { reps: parseNum(d.warmReps) || 10, weight: d.unit === '' ? null : (parseNum(d.warmWeight) ?? 0), text: d.warmText.trim() } : null,
    });
    if (d.blockId && L.findBlockOf(S.plan, d.id)?.id !== d.blockId) L.moveExerciseToBlock(S.plan, d.id, d.blockId);
    await savePlan(); S.ui.xd = null; nav('plan');
  },
  async delEx() {
    const d = S.ui.xd;
    if (!(await confirmBox(`Übung #${d.id} „${S.plan.exercises[d.id].name}“ aus dem Plan löschen? Bereits gespeicherte Trainings bleiben erhalten.`))) return;
    L.deleteExercise(S.plan, d.id); await savePlan();
    if (S.photos[d.id]) { delete S.photos[d.id]; await store.deletePhoto(d.id); }
    S.ui.xd = null; nav('plan');
  },
  async photoDefault() {
    const id = S.ui.xd.id; delete S.photos[id]; await store.deletePhoto(id); rerender();
  },
  async saveBlock() {
    const d = S.ui.bd, b = S.plan.blocks.find((x) => x.id === d.id);
    const start = parseNum(d.start), end = parseNum(d.end);
    if (!d.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
    if (start === null || end === null || end < start) { toast('Zeitfenster ungültig (Ende vor Start).'); return; }
    if (d.kind === 'timed' && (b.items || []).length) { toast('Der Block enthält Übungen. Verschiebe oder lösche sie zuerst.'); return; }
    Object.assign(b, { name: d.name.trim(), start, end, kind: d.kind, changeAfter: parseNum(d.changeAfter) });
    if (d.kind === 'timed') Object.assign(b, { minutes: parseNum(d.minutes) ?? 1, note: d.note.trim(), mode: 'single' });
    else if (d.mode === 'alternate') {
      Object.assign(b, { mode: d.mode, roundRest: parseNum(d.roundRest) }); // null = Pause der letzten Übung
    } else Object.assign(b, { mode: d.mode, rounds: Math.max(1, parseNum(d.rounds) || 1), roundRest: parseNum(d.roundRest) ?? 60 });
    await savePlan(); S.ui.bd = null; nav('plan');
  },
  async delBlock() {
    const b = S.plan.blocks.find((x) => x.id === S.ui.bd.id), n = (b.items || []).length;
    if (!(await confirmBox(`Block „${b.name}“${n ? ` mit ${n} Übung${n === 1 ? '' : 'en'}` : ''} löschen?`))) return;
    (b.items || []).forEach((id) => { delete S.photos[id]; store.deletePhoto(id); });
    L.deleteBlock(S.plan, b.id); await savePlan(); S.ui.bd = null; nav('plan');
  },
  async align() { L.realignTimes(S.plan); await savePlan(); toast('Zeiten lückenlos ausgerichtet.'); rerender(); },
  async resetPlan() {
    if (!(await confirmBox('Plan auf die Ausgangsversion zurücksetzen? Eigene Änderungen am Plan gehen verloren (Verlauf und Fotos bleiben).', 'Zurücksetzen'))) return;
    S.plan = await store.resetPlan(); rerender();
  },

  // Sicherung
  async exportJson() { download(`training-sicherung-${stamp()}.json`, exportJSON(), 'application/json'); await markExport(); rerender(); },
  async shareJson() {
    const file = new File([exportJSON()], `training-sicherung-${stamp()}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Training Sicherung' }); await markExport(); rerender(); }
      else toast('Teilen wird hier nicht unterstützt. Nutze „Alles exportieren“.');
    } catch (e) { if (e.name !== 'AbortError') toast('Teilen fehlgeschlagen.'); }
  },
  exportPlan() { download(planFileName(), planJSON(), 'application/json'); },
  async sharePlan() {
    const file = new File([planJSON()], planFileName(), { type: 'application/json' });
    try {
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Trainingsplan' });
      else toast('Teilen wird hier nicht unterstützt. Nutze „Plan exportieren“.');
    } catch (e) { if (e.name !== 'AbortError') toast('Teilen fehlgeschlagen.'); }
  },
  exportCsv() { download(`training-verlauf-${stamp()}.csv`, L.toCSV(S.sessions), 'text/csv;charset=utf-8'); },
  async wipe() {
    if (!(await confirmBox('ALLE Daten löschen (Plan, Verlauf, Fotos)? Das lässt sich nur mit einer Sicherung rückgängig machen.', 'Alles löschen'))) return;
    if (!(await confirmBox('Wirklich alles löschen?', 'Ja, löschen'))) return;
    await store.wipe(); S.plan = await store.getPlan(); S.sessions = []; S.photos = {}; S.active = null; S.meta = {};
    toast('Alle Daten gelöscht.'); rerender();
  },
};

function bind() {
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.closest('#modal')) return;
    unlockAudio();
    if (el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    try { await fn(el.dataset, el); } catch (err) { console.error(err); toast('Fehler: ' + err.message); }
  });
  const onInput = (e) => {
    const t = e.target;
    if (t.dataset.in) { setByPath(S.ui, t.dataset.in, t.value); if (e.type === 'change' && 'rr' in t.dataset) rerender(); }
    if (t.dataset.chk && e.type === 'change') { setByPath(S.ui, t.dataset.chk, t.checked); if ('rr' in t.dataset) rerender(); }
  };
  document.addEventListener('input', onInput);
  document.addEventListener('change', async (e) => {
    onInput(e);
    const t = e.target;
    if (t.dataset.photo && t.files[0]) {
      try {
        const data = await readPhoto(t.files[0]);
        S.photos[t.dataset.photo] = data; await store.savePhoto(t.dataset.photo, data); toast('Foto gespeichert.'); rerender();
      } catch (err) { toast('Foto konnte nicht gelesen werden.'); }
    }
    if ('import' in t.dataset && t.files[0]) { await doImport(t.files[0]); t.value = ''; }
    if ('planimport' in t.dataset && t.files[0]) { await doPlanImport(t.files[0]); t.value = ''; }
    if ('planchg' in t.dataset) {
      const v = parseNum(t.value);
      if (v === null || v < 0) { toast('Bitte eine Zahl ≥ 0 eingeben.'); return; }
      S.plan.blockChange = v; await savePlan(); toast(`Wechselzeit ${fmtSec(v)} gespeichert.`); rerender();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.route[0] === 'training') { wakeLock = null; lockScreen(); tick(); }
  });
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
}

async function boot() {
  try {
    store = createStore(idbAdapter());
    try { navigator.storage?.persist?.(); } catch { /* ignorieren */ }
    S.plan = await store.getPlan(); S.sessions = await store.listSessions(); S.photos = await store.getPhotos();
    S.meta = await store.getMeta(); S.active = (await store.getActive()) || null;
  } catch (e) {
    $('#app').innerHTML = `<div class="card bad"><b>Speicher nicht verfügbar.</b><p>Die App braucht IndexedDB. Im privaten Modus oder bei blockierten Websitedaten funktioniert sie nicht.</p><p class="sm">${esc(e.message)}</p></div>`;
    return;
  }
  bind(); render();
  setInterval(tick, 250);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__app = { S, L }; // für automatisierte Tests
}
boot();
