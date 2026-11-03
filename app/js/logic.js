// Reine Datenlogik ohne DOM- und Browser-Abhängigkeiten (testbar mit Node).

export const APP_ID = 'fitness-app-2026';
export const UNITS = ['kg', 'kg je Seite', 'kg je Arm', ''];

export function unitLabel(u) { return u === '' ? 'ohne Gewicht' : u; }

/** Standard-Steigerung: 2,5 kg bei Scheiben (je Seite), 5 kg am Steckgewicht. */
export function defaultStep(unit) {
  if (unit === '') return 0;
  return unit === 'kg je Seite' ? 2.5 : 5;
}
export function stepOf(ex) { return ex.step > 0 ? ex.step : defaultStep(ex.unit); }

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ---------- Zahlen / Zeit ----------
export function parseNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
export function fmtMin(sec) { return Math.round(sec / 60) + ' min'; }

// ---------- Plan ----------
export function planTotalMinutes(plan) {
  return plan.blocks.reduce((m, b) => Math.max(m, Number(b.end) || 0), 0);
}
export function fmtWindow(b) { return `${fmtNum(b.start)}–${fmtNum(b.end)} min`; }

/** Zeitfenster lückenlos hintereinander legen; Dauer je Block bleibt erhalten. */
export function realignTimes(plan) {
  let t = 0;
  for (const b of plan.blocks) {
    const d = Math.max(0, (Number(b.end) || 0) - (Number(b.start) || 0));
    b.start = t; b.end = t + d; t += d;
  }
  return plan;
}
export function moveInArray(arr, from, to) {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr;
}
export function nextExerciseId(plan) {
  const ids = Object.keys(plan.exercises).map(Number);
  return Math.max(14, ...ids) + 1;
}
export function findBlockOf(plan, exId) {
  return plan.blocks.find((b) => b.items && b.items.includes(Number(exId)));
}
export function addExercise(plan, blockId, ex) {
  const id = nextExerciseId(plan);
  plan.exercises[id] = { ...ex, id };
  const b = plan.blocks.find((x) => x.id === blockId);
  if (b) b.items.push(id);
  return id;
}
export function deleteExercise(plan, id) {
  delete plan.exercises[id];
  plan.blocks.forEach((b) => { if (b.items) b.items = b.items.filter((x) => x !== Number(id)); });
}
export function moveExerciseToBlock(plan, id, blockId) {
  plan.blocks.forEach((b) => { if (b.items) b.items = b.items.filter((x) => x !== Number(id)); });
  const b = plan.blocks.find((x) => x.id === blockId);
  if (b) b.items.push(Number(id));
}
export function deleteBlock(plan, blockId) {
  const b = plan.blocks.find((x) => x.id === blockId);
  if (!b) return;
  (b.items || []).forEach((id) => delete plan.exercises[id]);
  plan.blocks = plan.blocks.filter((x) => x.id !== blockId);
}

// ---------- Trainingsschritte ----------
function sideList(ex) { return ex.sides === 'Seite' || ex.sides === 'Arm' ? ['links', 'rechts'] : [null]; }

function makeSetSteps(block, ex, setType, set, meta, rest) {
  const sides = sideList(ex);
  return sides.map((side, i) => ({
    type: 'set', blockId: block.id, blockName: block.name, mode: block.mode || 'single',
    exId: ex.id, name: ex.name, optional: !!ex.optional, setType, side,
    reps: Number(set.reps) || 0,
    weight: ex.unit === '' ? null : (set.weight ?? null),
    text: set.text || '', unit: ex.unit,
    rest: i === sides.length - 1 ? rest : 0,
    ...meta,
  }));
}

export function buildSteps(plan, opts = {}) {
  const steps = [];
  for (const block of plan.blocks) {
    const start = steps.length;
    if (block.kind === 'timed') {
      steps.push({
        type: 'timed', blockId: block.id, blockName: block.name,
        seconds: Math.round((Number(block.minutes) || 0) * 60), note: block.note || '', rest: 0,
      });
      continue;
    }
    let exs = (block.items || []).map((id) => plan.exercises[id]).filter((e) => e && e.sets && e.sets.length);
    if (opts.skipOptional) exs = exs.filter((e) => !e.optional);
    if (!exs.length) continue;
    const mode = block.mode || 'single';
    if (mode === 'single') {
      for (const ex of exs) {
        if (ex.warmup) steps.push(...makeSetSteps(block, ex, 'warmup', ex.warmup, { setNo: 0, setCount: ex.sets.length }, ex.warmRest ?? 30));
        ex.sets.forEach((s, i) => steps.push(...makeSetSteps(block, ex, 'work', s, { setNo: i + 1, setCount: ex.sets.length }, ex.rest ?? 60)));
      }
    } else {
      const warm = exs.filter((e) => e.warmup);
      warm.forEach((ex, i) => steps.push(...makeSetSteps(block, ex, 'warmup', ex.warmup,
        { setNo: 0, setCount: 0, groupPos: i, groupSize: warm.length },
        i === warm.length - 1 ? Math.max(...warm.map((e) => e.warmRest ?? 30)) : 0)));
      const rounds = mode === 'circuit' ? Math.max(1, Number(block.rounds) || 1) : Math.max(...exs.map((e) => e.sets.length));
      for (let r = 0; r < rounds; r++) {
        const part = exs.filter((e) => mode === 'circuit' || r < e.sets.length);
        const roundRest = mode === 'circuit' ? (Number(block.roundRest) || 0) : Math.max(...part.map((e) => e.rest ?? 60));
        part.forEach((ex, i) => {
          const s = ex.sets[Math.min(r, ex.sets.length - 1)];
          steps.push(...makeSetSteps(block, ex, 'work', s,
            { setNo: r + 1, setCount: rounds, round: r + 1, rounds, groupPos: i, groupSize: part.length },
            i === part.length - 1 ? roundRest : 0));
        });
      }
    }
    if (steps.length > start) steps[steps.length - 1].rest = 0; // Blockwechsel ohne Pausentimer
  }
  steps.forEach((s, i) => { s.index = i; });
  return steps;
}

// ---------- Laufendes Training ----------
export function newActive(plan, now, opts = {}) {
  const a = {
    id: uid(), startedAt: now, pausedAt: null, pausedTotal: 0,
    steps: buildSteps(plan, opts), stepIndex: 0, rest: null, timer: null, skipped: [],
    planMinutes: planTotalMinutes(plan),
    blocks: plan.blocks.map((b) => ({ id: b.id, start: b.start, end: b.end, name: b.name })),
    session: { id: uid(), startedAt: now, endedAt: null, durationSec: 0, status: 'running', entries: [] },
  };
  enterStep(a, now);
  return a;
}
export function elapsedMs(a, now) { return Math.max(0, (a.pausedAt ?? now) - a.startedAt - a.pausedTotal); }
export function remainingSec(endAt, now) { return Math.max(0, Math.ceil((endAt - now) / 1000)); }

export function pauseActive(a, now) { if (a.pausedAt === null) a.pausedAt = now; return a; }
export function resumeActive(a, now) {
  if (a.pausedAt === null) return a;
  const d = now - a.pausedAt;
  a.pausedTotal += d;
  if (a.rest) a.rest.endAt += d;
  if (a.timer) { a.timer.endAt += d; a.timer.startedAt += d; }
  a.pausedAt = null;
  return a;
}
export function currentStep(a) { return a.steps[a.stepIndex] || null; }

export function enterStep(a, now) {
  const s = currentStep(a);
  a.timer = s && s.type === 'timed'
    ? { startedAt: now, endAt: now + s.seconds * 1000, total: s.seconds, notified: false }
    : null;
}
function isSkipped(a, i) { const s = a.steps[i]; return s && s.type === 'set' && a.skipped.includes(s.exId); }
function nextIndex(a, from) { let i = from + 1; while (i < a.steps.length && isSkipped(a, i)) i++; return i; }
function prevIndex(a, from) { let i = from - 1; while (i >= 0 && isSkipped(a, i)) i--; return i; }

/** Hinter Plan? Gibt Minuten zurück (0 = im Plan). */
export function behindMinutes(a, now) {
  const s = currentStep(a);
  if (!s) return 0;
  const b = a.blocks.find((x) => x.id === s.blockId);
  if (!b) return 0;
  const min = elapsedMs(a, now) / 60000;
  return min > b.end ? Math.ceil(min - b.end) : 0;
}

function entryFor(a, step) {
  let e = a.session.entries.find((x) => x.exId === step.exId && x.kind === 'sets');
  if (!e) {
    e = { kind: 'sets', exId: step.exId, name: step.name, blockName: step.blockName, unit: step.unit, sets: [] };
    a.session.entries.push(e);
  }
  return e;
}
export function findRecorded(a, step) {
  if (!step || step.type !== 'set') return null;
  const e = a.session.entries.find((x) => x.exId === step.exId && x.kind === 'sets');
  return e ? e.sets.find((s) => s.stepIndex === step.index) || null : null;
}

/** Satz bestätigen (auch erneut für einen bereits erfassten Schritt). */
export function completeStep(a, values, now) {
  const step = currentStep(a);
  if (!step) return { finished: true };
  let newTarget = null;
  if (step.type === 'set') {
    const e = entryFor(a, step);
    const rec = {
      type: step.setType, side: step.side, targetReps: step.reps, targetWeight: step.weight,
      reps: Number(values.reps) || 0, weight: step.unit === '' ? null : (values.weight ?? null),
      at: now, stepIndex: step.index,
    };
    const i = e.sets.findIndex((s) => s.stepIndex === step.index);
    if (i >= 0) e.sets[i] = rec; else e.sets.push(rec);
    // Kein Soll-Gewicht hinterlegt: erster Wert wird neues Soll
    if (step.unit !== '' && step.weight == null && rec.weight != null) {
      a.steps.forEach((s) => { if (s.type === 'set' && s.exId === step.exId && s.weight == null) s.weight = rec.weight; });
      newTarget = { exId: step.exId, weight: rec.weight };
    }
  } else {
    const t = a.timer;
    const spent = t ? Math.round((Math.min(now, t.endAt + 36e5) - t.startedAt) / 1000) : 0;
    a.session.entries.push({
      kind: 'timed', name: step.blockName, blockName: step.blockName, targetSec: step.seconds,
      actualSec: values.actualSec ?? spent, note: values.note || '',
    });
  }
  const next = nextIndex(a, a.stepIndex);
  a.rest = step.rest > 0 && next < a.steps.length
    ? { endAt: now + step.rest * 1000, total: step.rest, notified: false } : null;
  a.stepIndex = next;
  if (next < a.steps.length) enterStep(a, now); else a.timer = null;
  return { finished: next >= a.steps.length, newTarget };
}
export function skipCurrent(a, now) {
  const s = currentStep(a);
  if (!s) return;
  if (s.type === 'set') a.skipped.push(s.exId);
  a.rest = null;
  a.stepIndex = nextIndex(a, a.stepIndex);
  enterStep(a, now);
}
export function goBack(a, now) {
  const p = prevIndex(a, a.stepIndex);
  if (p < 0) return false;
  a.stepIndex = p; a.rest = null; enterStep(a, now);
  return true;
}
export function finalizeSession(a, now, aborted) {
  const s = a.session;
  s.endedAt = a.pausedAt ?? now;
  s.durationSec = Math.round(elapsedMs(a, now) / 1000);
  s.status = aborted ? 'aborted' : 'done';
  s.entries = s.entries.filter((e) => e.kind === 'timed' || e.sets.length);
  return s;
}

// ---------- Auswertung ----------
export function workSets(entry) { return (entry.sets || []).filter((s) => s.type === 'work'); }
export function sessionVolume(session) {
  let v = 0;
  for (const e of session.entries) if (e.kind === 'sets') for (const s of workSets(e)) v += (s.weight || 0) * (s.reps || 0);
  return Math.round(v * 100) / 100;
}
export function sessionSetCount(session) {
  return session.entries.reduce((n, e) => n + (e.kind === 'sets' ? e.sets.length : 0), 0);
}
export function sortedSessions(sessions) {
  return [...sessions].sort((a, b) => b.startedAt - a.startedAt);
}
export function exerciseHistory(sessions, exId) {
  const out = [];
  for (const s of sortedSessions(sessions).reverse()) {
    const e = s.entries.find((x) => x.kind === 'sets' && x.exId === Number(exId));
    if (!e) continue;
    const w = workSets(e);
    if (!w.length) continue;
    const weights = w.map((x) => x.weight).filter((x) => x != null);
    out.push({
      sessionId: s.id, date: s.startedAt, sets: w,
      maxWeight: weights.length ? Math.max(...weights) : null,
      maxReps: Math.max(...w.map((x) => x.reps || 0)),
    });
  }
  return out;
}
export function lastValue(sessions, exId) {
  const h = exerciseHistory(sessions, exId);
  if (!h.length) return null;
  const last = h[h.length - 1];
  const s = last.sets[last.sets.length - 1];
  return { weight: s.weight, reps: s.reps, date: last.date, maxWeight: last.maxWeight };
}
const round025 = (n) => Math.round(n * 4) / 4;

/** Alle Arbeitssätze beim letzten Mal mit voller Wiederholungszahl → nächste Stufe vorschlagen. */
export function suggestProgression(sessions, ex) {
  if (!ex || ex.unit === '') return null;
  const h = exerciseHistory(sessions, ex.id);
  if (!h.length) return null;
  const last = h[h.length - 1];
  const needed = ex.sets.length * (ex.sides === 'none' || !ex.sides ? 1 : 2);
  if (last.sets.length < needed) return null;
  if (!last.sets.every((s) => s.reps >= s.targetReps && s.targetReps > 0)) return null;
  if (last.maxWeight == null) return null;
  const step = stepOf(ex);
  return { from: last.maxWeight, weight: round025(last.maxWeight + step), step };
}

/** Vorbelegung der Eingabefelder für den aktuellen Schritt. */
export function prefill(a, step, sessions) {
  const rec = findRecorded(a, step);
  if (rec) return { reps: rec.reps, weight: rec.weight };
  let weight = step.weight;
  if (step.unit !== '') {
    const entry = a.session.entries.find((x) => x.exId === step.exId && x.kind === 'sets');
    const prev = entry ? [...entry.sets].reverse().find((s) => s.type === step.setType && s.weight != null) : null;
    if (prev) weight = prev.weight;
    else if (step.setType === 'work') {
      const lv = lastValue(sessions, step.exId);
      if (lv && lv.maxWeight != null) weight = lv.maxWeight;
    }
  }
  return { reps: step.reps, weight };
}

// ---------- Sessions bearbeiten ----------
export function updateSet(session, entryIdx, setIdx, patch) {
  Object.assign(session.entries[entryIdx].sets[setIdx], patch);
  return session;
}
export function deleteSet(session, entryIdx, setIdx) {
  session.entries[entryIdx].sets.splice(setIdx, 1);
  if (!session.entries[entryIdx].sets.length) session.entries.splice(entryIdx, 1);
  return session;
}
export function deleteEntry(session, entryIdx) { session.entries.splice(entryIdx, 1); return session; }

// ---------- CSV / Export / Import ----------
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function toCSV(sessions, tz = {}) {
  const head = ['Datum', 'Start', 'Training_Dauer_min', 'Block', 'Übung', 'Satzart', 'Seite', 'Satz', 'Soll_Wdh', 'Ist_Wdh', 'Gewicht', 'Einheit', 'Volumen', 'Dauer_min'];
  const rows = [head];
  const pad = (n) => String(n).padStart(2, '0');
  for (const s of sortedSessions(sessions).reverse()) {
    const d = new Date(s.startedAt);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const dur = Math.round((s.durationSec || 0) / 60);
    for (const e of s.entries) {
      if (e.kind === 'timed') {
        rows.push([date, time, dur, e.blockName, e.name, 'Zeit', '', '', '', '', '', '', '', fmtNum(Math.round((e.actualSec || 0) / 6) / 10)]);
        continue;
      }
      e.sets.forEach((x, i) => rows.push([
        date, time, dur, e.blockName, e.name, x.type === 'warmup' ? 'Aufwärmen' : 'Arbeitssatz', x.side || '', i + 1,
        x.targetReps, x.reps, fmtNum(x.weight), e.unit,
        x.type === 'work' ? fmtNum((x.weight || 0) * (x.reps || 0)) : '', '',
      ]));
    }
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

export function buildExport(plan, sessions, photos, now = Date.now()) {
  return { app: APP_ID, version: 1, exportedAt: now, plan, sessions, photos };
}
function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.blocks) || !plan.exercises || typeof plan.exercises !== 'object') return { ok: false, error: 'Plan fehlt oder ist beschädigt.' };
  for (const b of plan.blocks) {
    if (!b || typeof b.id !== 'string' || !b.name) return { ok: false, error: 'Ein Block im Plan ist beschädigt.' };
    for (const id of b.items || []) if (!plan.exercises[id]) return { ok: false, error: `Block „${b.name}“ verweist auf eine fehlende Übung (${id}).` };
  }
  return { ok: true };
}
function validatePhotos(ph) {
  for (const k of Object.keys(ph || {})) if (typeof ph[k] !== 'string' || !ph[k].startsWith('data:image/')) return { ok: false, error: `Eigenes Foto ${k} ist beschädigt.` };
  return { ok: true };
}
export function validateImport(o) {
  if (!o || typeof o !== 'object') return { ok: false, error: 'Keine gültige JSON-Datei.' };
  if (o.app !== APP_ID) return { ok: false, error: 'Die Datei stammt nicht aus dieser App.' };
  if (o.kind === 'plan') return { ok: false, error: 'Das ist eine Plan-Datei. Bitte über „Plan importieren“ einlesen.' };
  const vp = validatePlan(o.plan); if (!vp.ok) return vp;
  if (!Array.isArray(o.sessions)) return { ok: false, error: 'Verlauf fehlt.' };
  for (const s of o.sessions) if (!s || !s.id || !Array.isArray(s.entries) || typeof s.startedAt !== 'number') return { ok: false, error: 'Ein Training im Verlauf ist beschädigt.' };
  return validatePhotos(o.photos);
}

// ---------- Nur den Plan übertragen (Verlauf bleibt auf jedem Gerät) ----------
/** Plan-Datei: Plan plus eigene Fotos der Übungen im Plan. */
export function buildPlanExport(plan, photos, now = Date.now()) {
  const ids = new Set(Object.keys(plan.exercises).map(String));
  const own = Object.fromEntries(Object.entries(photos || {}).filter(([k]) => ids.has(String(k))));
  return { app: APP_ID, kind: 'plan', version: 1, exportedAt: now, plan, photos: own };
}
/** Akzeptiert Plan-Dateien und vollständige Sicherungen; liefert nur Plan und Fotos. */
export function readPlanImport(o) {
  if (!o || typeof o !== 'object') return { ok: false, error: 'Keine gültige JSON-Datei.' };
  if (o.app !== APP_ID) return { ok: false, error: 'Die Datei stammt nicht aus dieser App.' };
  const vp = validatePlan(o.plan); if (!vp.ok) return vp;
  const vf = validatePhotos(o.photos); if (!vf.ok) return vf;
  return { ok: true, plan: o.plan, photos: o.photos || {}, exportedAt: o.exportedAt || null, fromBackup: o.kind !== 'plan' };
}
/**
 * Fotos nach dem Plan-Import: Für Übungen des neuen Plans gilt genau der Stand der Datei
 * (eigenes Foto oder Standardbild). Fotos anderer Übungen bleiben unberührt.
 */
export function mergePlanPhotos(current, plan, incoming) {
  const out = { ...current };
  for (const id of Object.keys(plan.exercises)) {
    if (incoming[id]) out[id] = incoming[id]; else delete out[id];
  }
  return out;
}
