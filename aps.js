'use strict';
/*
 * 統香 APS — finite-capacity scheduling for the production board.
 * Pure functions only (no DB), so every rule can be tested with plain data.
 *
 * Inputs it relies on (all optional — anything missing is reported, never invented):
 *   lines      production lines / equipment: minutes per day, start time, changeover minutes, categories it runs
 *   rates      output per hour, per category and unit (箱/桶/瓶)
 *   workdays   weekdays the plant runs (0=Sun … 6=Sat) and holiday dates
 *   down       capacity changes for a line on a date (breakdown, short day, overtime)
 *   lead       days a finished order must be ready before its ship date, per delivery method
 */

const DEFAULT_APS = {
  lines: [],
  rates: {},
  workdays: [1, 2, 3, 4, 5],
  holidays: [],
  down: [],
  lead: { '物流配送': 0, '公司配送': 0, '門市自取': 0 },
  horizon: 14,
  autoLearn: false,
};
const METHOD_RANK = { '物流配送': 0, '公司配送': 1, '': 1, '門市自取': 2 };
const UNITS = ['箱', '桶', '瓶'];

const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const hm = (m) => { m = Math.max(0, Math.round(m)); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : 480; };

function normAps(a) {
  const o = Object.assign({}, DEFAULT_APS, a || {});
  o.lines = (Array.isArray(o.lines) ? o.lines : []).filter((l) => l && l.id).map((l) => ({
    id: String(l.id), name: String(l.name || l.id), minutes: Math.max(0, +l.minutes || 0), start: l.start || '08:00',
    changeover: Math.max(0, +l.changeover || 0), cats: Array.isArray(l.cats) ? l.cats.map(String) : [], staff: Math.max(0, +l.staff || 0),
  }));
  o.lead = Object.assign({}, DEFAULT_APS.lead, o.lead || {});
  o.workdays = Array.isArray(o.workdays) && o.workdays.length ? o.workdays.map(Number) : DEFAULT_APS.workdays;
  o.holidays = Array.isArray(o.holidays) ? o.holidays : [];
  o.down = Array.isArray(o.down) ? o.down : [];
  return o;
}

/* learned output per hour from finished work that has a start time (needs ≥5 samples to be trusted) */
function learnRates(done) {
  const g = {};
  done.forEach((t) => {
    if (!t.started_at || !t.completed_at || !t.cat || !t.qty) return;
    const min = (new Date(t.completed_at) - new Date(t.started_at)) / 60000;
    if (!(min >= 3 && min <= 720)) return;
    const k = t.cat + '|' + (t.unit || '');
    (g[k] = g[k] || []).push(t.qty / (min / 60));
  });
  const out = {};
  Object.entries(g).forEach(([k, arr]) => {
    arr.sort((a, b) => a - b);
    const med = arr[Math.floor(arr.length / 2)];
    const [cat, unit] = k.split('|');
    (out[cat] = out[cat] || {})[unit] = { rate: Math.round(med * 10) / 10, n: arr.length, conf: arr.length >= 10 ? '高' : arr.length >= 5 ? '中' : '不足' };
  });
  return out;
}

/*
 * schedule(open, opts) → { tasks: {id: plan}, days, lines, late, overload, missing, … }
 * open tasks must already be in board order (urgent first, then sort_order).
 */
function schedule(open, opts) {
  const A = normAps(opts.aps);
  const today = opts.today;
  const nowMin = opts.nowMin == null ? 0 : opts.nowMin;
  const customers = opts.customers || {};
  const learned = opts.learned || {};
  const isWork = (d) => A.workdays.includes(dow(d)) && !A.holidays.includes(d);
  const prevWork = (d) => { let x = d; for (let i = 0; i < 60 && !isWork(x); i++) x = addDays(x, -1); return x; };
  const nextWork = (d) => { let x = d; for (let i = 0; i < 60 && !isWork(x); i++) x = addDays(x, 1); return x; };
  const lineOf = (cat) => A.lines.find((l) => l.cats.includes(cat)) || null;
  const capOf = (line, d) => {
    if (!isWork(d)) return 0;
    const ex = A.down.filter((x) => x.line === line.id && x.date === d);
    let cap = line.minutes;
    ex.forEach((x) => { cap = x.minutes == null ? 0 : Math.max(0, +x.minutes); });
    if (d === today) cap = Math.max(0, cap - Math.max(0, nowMin - toMin(line.start)));
    return cap;
  };
  const rateOf = (t) => {
    const l = (learned[t.cat] || {})[t.unit || ''];
    if (A.autoLearn && l && l.n >= 5) return { rate: l.rate, src: '學習值（' + l.n + ' 筆，可信度' + l.conf + '）' };
    const r = +((A.rates[t.cat] || {})[t.unit || ''] || 0);
    return r > 0 ? { rate: r, src: '設定值' } : null;
  };
  const deadlineOf = (t) => {
    const lead = Math.max(0, +A.lead[t.ship_method || ''] || 0);
    let d = t.ship_date;
    for (let i = 0; i < lead; i++) d = prevWork(addDays(d, -1));
    return prevWork(d);
  };
  const keyOf = (t) => (t.cat ? t.cat + '|' + (t.variety || '') : 'p' + t.product_id);

  const state = {}; // line id -> { day -> {used, last} }
  const plans = {};
  const missing = { noLine: new Set(), noRate: new Set(), noMethod: 0, noAddr: new Set() };
  const horizonEnd = addDays(today, Math.max(7, A.horizon) + 30);

  const ordered = open.slice().sort((a, b) => (b.started_at ? 1 : 0) - (a.started_at ? 1 : 0));
  for (const t of ordered) {
    const deadline = deadlineOf(t);
    const p = { id: t.id, deadline, late: false, flags: [], reasons: [] };
    plans[t.id] = p;
    if (!t.ship_method) missing.noMethod++;
    if (t.ship_method === '公司配送' && !(customers[t.customer] || '').trim()) missing.noAddr.add(t.customer);
    if (!t.cat) { p.flags.push('未設類別'); }
    const line = t.cat ? lineOf(t.cat) : null;
    if (!line) {
      if (t.cat) missing.noLine.add(t.cat);
      p.line = null; p.flags.push('未指定產線');
      p.day = t.hold_until && t.hold_until > today ? nextWork(t.hold_until) : nextWork(today);
      p.late = p.day > deadline;
      continue;
    }
    p.line = line.id;
    const r = rateOf(t);
    let need;
    if (r) { need = Math.ceil(t.qty / r.rate * 60); p.rateSrc = r.src; }
    else { need = 0; missing.noRate.add(t.cat + '｜' + (t.unit || '未填單位')); p.flags.push('工時未知'); }
    let d = nextWork(today);
    if (t.hold_until && t.hold_until > today) { d = nextWork(t.hold_until); p.flags.push('待料'); p.reasons.push('待料至 ' + t.hold_until + (t.hold_reason ? '（' + t.hold_reason + '）' : '')); }
    const L = state[line.id] = state[line.id] || {};
    let left = need, first = true, guard = 0;
    while (guard++ < 400) {
      if (d > horizonEnd) { p.flags.push('排不進'); break; }
      const cap = capOf(line, d);
      const s = L[d] = L[d] || { used: 0, last: null, items: [] };
      const co = s.last && s.last !== keyOf(t) ? line.changeover : 0;
      const free = cap - s.used;
      if (need === 0) { // unknown duration: just place it in sequence on the first workday with room
        if (cap > 0 && free > 0) { p.day = p.startDay = d; p.start = hm(toMin(line.start) + (d === today ? Math.max(0, nowMin - toMin(line.start)) : 0) + s.used); p.end = p.start; s.items.push(t.id); s.last = keyOf(t); break; }
        d = nextWork(addDays(d, 1)); continue;
      }
      if (free <= co) { d = nextWork(addDays(d, 1)); continue; }
      const base = toMin(line.start) + (d === today ? Math.max(0, nowMin - toMin(line.start)) : 0);
      if (first) { p.startDay = d; p.start = hm(base + s.used + co); if (co) p.changeover = co; s.used += co; first = false; }
      const take = Math.min(left, cap - s.used);
      s.used += take; left -= take; s.items.push(t.id); s.last = keyOf(t); (p.alloc = p.alloc || []).push([d, take]);
      if (left <= 0) { p.day = d; p.end = hm(base + s.used); break; }
      d = nextWork(addDays(d, 1));
    }
    p.minutes = need;
    if (p.day) p.late = p.day > deadline;
    if (p.startDay && p.day && p.startDay !== p.day) p.reasons.push('跨 ' + p.startDay.slice(5) + '～' + p.day.slice(5) + ' 生產');
  }

  // load per line per day + overload
  const days = [];
  for (let d = today, i = 0; i < Math.max(7, A.horizon); i++, d = addDays(d, 1)) days.push(d);
  const lines = A.lines.map((l) => ({
    id: l.id, name: l.name, staff: l.staff,
    days: days.map((d) => {
      const s = (state[l.id] || {})[d] || { used: 0, items: [] };
      const cap = capOf(l, d), full = l.minutes;
      const ex = A.down.find((x) => x.line === l.id && x.date === d);
      return { date: d, cap, used: Math.round(s.used), pct: cap ? Math.round(s.used * 100 / cap) : (s.used ? 999 : 0), items: s.items, work: isWork(d), note: ex ? ex.reason || '產能異動' : '', full };
    }),
  }));
  const late = Object.values(plans).filter((p) => p.late);
  const overload = [];
  lines.forEach((l) => l.days.forEach((d) => { if (d.work && d.cap && d.used >= d.cap * 0.98) overload.push({ line: l.name, date: d.date, pct: d.pct }); }));
  // bottleneck + options for each late order
  late.forEach((p) => {
    const t = open.find((x) => x.id === p.id);
    if (!p.line) { p.why = '這個品項沒有指定產線，系統無法計算。'; p.options = ['到「排程設定」把類別 ' + (t.cat || '（未設）') + ' 指定給一條產線']; return; }
    const L = lines.find((l) => l.id === p.line);
    const before = L.days.filter((d) => d.date <= p.deadline && d.work);
    const busy = before.length && before.every((d) => d.used >= d.cap * 0.95);
    const holdLate = t.hold_until && nextWork(t.hold_until) > p.deadline;
    p.why = holdLate ? '原料預計 ' + t.hold_until + ' 才到，晚於最晚完成日 ' + p.deadline + '。'
      : p.deadline < today ? '最晚完成日 ' + p.deadline + ' 已經過了（逾期單）。'
      : busy ? L.name + ' 在 ' + p.deadline + ' 前已滿載（瓶頸）。'
      : '排在前面的工作占用了 ' + L.name + ' 的產能。';
    const short = (p.alloc || []).filter(([d]) => d > p.deadline).reduce((s, [, m]) => s + m, 0);
    p.options = [];
    if (!holdLate && short && p.deadline >= today) p.options.push('在 ' + p.deadline.slice(5) + ' 前加班約 ' + Math.ceil(short / 30) * 30 + ' 分鐘（' + L.name + '），或把其他工作往後移');
    p.options.push('把這張單往前移或設為緊急');
    if (p.day) p.options.push('與客戶協調出貨日改到 ' + addDays(p.day, Math.max(0, +A.lead[t.ship_method || ''] || 0)).slice(5) + ' 之後');
    if (holdLate) p.options.push('催料，或改用現有庫存的原料');
  });
  return {
    tasks: plans, days, lines, late: late.map((p) => p.id), overload,
    missing: { noLine: [...missing.noLine], noRate: [...missing.noRate], noMethod: missing.noMethod, noAddr: [...missing.noAddr] },
    aps: A,
  };
}

/* compare two schedules: who moved day/line, who became late, who recovered */
function diffPlans(prev, cur, names) {
  const moved = [], newlyLate = [], recovered = [];
  Object.values(cur).forEach((p) => {
    const o = prev[p.id];
    if (!o) return;
    const when = (x) => (x.startDay && x.start ? x.startDay + ' ' + x.start : x.day || '—');
    if ((o.day || '') !== (p.day || '') || (o.line || '') !== (p.line || '') || (o.startDay || '') !== (p.startDay || '') || Math.abs(toMin(o.start || '00:00') - toMin(p.start || '00:00')) >= 30) moved.push({ id: p.id, name: names[p.id] || ('#' + p.id), from: when(o), to: when(p) });
    if (p.late && !o.late) newlyLate.push({ id: p.id, name: names[p.id] || ('#' + p.id) });
    if (!p.late && o.late) recovered.push({ id: p.id, name: names[p.id] || ('#' + p.id) });
  });
  const added = Object.keys(cur).filter((id) => !prev[id]).map((id) => ({ id: +id, name: names[id] || ('#' + id) }));
  const removed = Object.keys(prev).filter((id) => !cur[id]).map((id) => +id);
  return { moved, newlyLate, recovered, added, removed };
}

/* keep locked / started tasks at their slots, fill the rest in the suggested order */
function mergeLocked(currentIds, planIds, fixed) {
  const free = planIds.filter((id) => !fixed.has(id));
  let k = 0;
  return currentIds.map((id) => (fixed.has(id) ? id : free[k++])).filter((x) => x != null).concat(free.slice(k));
}

module.exports = { DEFAULT_APS, normAps, schedule, learnRates, diffPlans, mergeLocked, addDays, METHOD_RANK, UNITS };
