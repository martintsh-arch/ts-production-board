'use strict';
/*
 * Delivery planning (pure functions, no I/O).
 *  - drive-time matrix (real road figures when cached, otherwise straight-line × factor at an average speed)
 *  - customer receiving windows (opening hours, optional lunch break)
 *  - stop order that minimises total time + a heavy penalty for arriving after a customer closes
 *    (exhaustive branch-and-bound up to 9 stops, multi-start 2-opt / or-opt above that)
 */
const DEFAULT_DELIVERY = { depart: '09:00', svc: 20, load: 20, open: '09:00', close: '17:30', lunchFrom: '', lunchTo: '', speed: 30, factor: 1.3 };
const LATE_W = 10;          // one minute after closing time costs as much as 10 minutes of driving
const EXACT_MAX = 9;        // up to this many stops we prove the best order
const MAX_STOPS = 39;       // OSRM table limit (depot + stops ≤ 40 coordinates per request)

const pad = (n) => String(n).padStart(2, '0');
function tm(s, d) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s == null ? '' : s).trim());
  if (!m) return d == null ? null : d;
  const v = +m[1] * 60 + +m[2];
  return v >= 0 && v <= 1439 ? v : (d == null ? null : d);
}
const hm = (m) => pad(Math.floor(Math.round(m) / 60) % 24) + ':' + pad(Math.round(m) % 60);
const hmd = (m) => (m >= 1440 ? '隔天 ' : '') + hm(m);   // hm with a next-day marker
const num = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : d; };

function normCfg(x) {
  x = x || {};
  const o = { ...DEFAULT_DELIVERY };
  ['depart', 'open', 'close'].forEach((k) => { const v = tm(x[k]); if (v != null) o[k] = hm(v); });
  const lf = tm(x.lunchFrom), lt = tm(x.lunchTo);
  if (lf != null && lt != null && lt > lf) { o.lunchFrom = hm(lf); o.lunchTo = hm(lt); } else { o.lunchFrom = ''; o.lunchTo = ''; }
  o.svc = num(x.svc, 0, 180, DEFAULT_DELIVERY.svc);
  o.load = num(x.load, 0, 180, DEFAULT_DELIVERY.load);
  if (tm(o.close) <= tm(o.open)) { o.open = DEFAULT_DELIVERY.open; o.close = DEFAULT_DELIVERY.close; }
  return o;
}

/* a customer's receiving window; every blank field falls back to the company default */
function windowOf(cfg, c) {
  c = c || {};
  const pick = (a, b) => { const v = tm(a); return v != null ? v : tm(b); };
  let open = pick(c.recv_open, cfg.open), close = pick(c.recv_close, cfg.close);
  if (close <= open) { open = tm(cfg.open); close = tm(cfg.close); }
  let lf = null, lt = null;
  const cLf = tm(c.recv_lunch_from), cLt = tm(c.recv_lunch_to);
  if (cLf != null && cLt != null) { if (cLt > cLf) { lf = cLf; lt = cLt; } }
  else if (tm(cfg.lunchFrom) != null && tm(cfg.lunchTo) != null) { lf = tm(cfg.lunchFrom); lt = tm(cfg.lunchTo); }
  const custom = !!(c.recv_open || c.recv_close || c.recv_lunch_from || c.recv_lunch_to);
  return { open, close, lf, lt, custom };
}

const pk = (lat, lng) => (+lat).toFixed(5) + ',' + (+lng).toFixed(5);
function haversine(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* pts[0] is the depot. legs(keyA,keyB) → {min,km} | null (cached road figures). Returns {M, basis, missing} */
function buildMatrix(pts, cfg, legs) {
  const n = pts.length, keys = pts.map((p) => pk(p.lat, p.lng));
  const M = Array.from({ length: n }, () => new Array(n)), K = Array.from({ length: n }, () => new Array(n));
  let road = !!legs;
  for (let i = 0; i < n && road; i++) for (let j = 0; j < n; j++) {
    if (i === j || keys[i] === keys[j]) { M[i][j] = 0; K[i][j] = 0; continue; }
    const g = legs(keys[i], keys[j]);
    if (!g) { road = false; break; }
    M[i][j] = g.min; K[i][j] = g.km;
  }
  if (!road) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const km = i === j ? 0 : haversine([pts[i].lat, pts[i].lng], [pts[j].lat, pts[j].lng]) * cfg.factor;
      K[i][j] = km; M[i][j] = km / cfg.speed * 60;
    }
  }
  return { M, K, basis: road ? 'road' : 'estimate' };
}

/* serve a customer who is reached at minute `arr` */
function visit(arr, w, svc) {
  let s = Math.max(arr, w.open), lunch = false;
  if (w.lf != null && s >= w.lf && s < w.lt) { s = w.lt; lunch = true; }   // arrived during the lunch break → wait until it ends
  return { start: s, wait: s - arr, leave: s + svc, late: Math.max(0, s - w.close), lunch };      // late = service could only start after closing time
}

/* ord = indices 1..n into the matrix. Returns timeline + cost */
function simulate(ord, mx, wins, svc, depart) {
  let t = depart, prev = 0, late = 0, wait = 0, km = 0;
  const rows = [];
  for (const i of ord) {
    const legMin = mx.M[prev][i], legKm = mx.K[prev][i];
    const arr = t + legMin, v = visit(arr, wins[i], svc);
    rows.push({ idx: i, legMin, legKm, arrive: arr, start: v.start, wait: v.wait, leave: v.leave, late: v.late, lunch: v.lunch });
    late += v.late; wait += v.wait; km += legKm; t = v.leave; prev = i;
  }
  const backMin = mx.M[prev][0], backKm = mx.K[prev][0];
  t += backMin; km += backKm;
  return { rows, back: t, backMin, backKm, km, late, wait, cost: (t - depart) + LATE_W * late };
}

function improve(ord, cost) {
  // 2-opt then or-opt until nothing gets better
  let best = ord.slice(), bc = cost(best), better = true, guard = 0;
  while (better && guard++ < 60) {
    better = false;
    for (let i = 0; i < best.length - 1; i++) for (let j = i + 1; j < best.length; j++) {
      const c = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1)), cc = cost(c);
      if (cc < bc - 1e-9) { best = c; bc = cc; better = true; }
    }
    for (let len = 1; len <= 2; len++) for (let i = 0; i + len <= best.length; i++) {
      const seg = best.slice(i, i + len), rest = best.slice(0, i).concat(best.slice(i + len));
      for (let k = 0; k <= rest.length; k++) {
        if (k === i) continue;
        const c = rest.slice(0, k).concat(seg, rest.slice(k)), cc = cost(c);
        if (cc < bc - 1e-9) { best = c; bc = cc; better = true; }
      }
    }
  }
  return { ord: best, cost: bc };
}

function solve(n, mx, wins, svc, depart) {
  const idx = Array.from({ length: n }, (_, i) => i + 1);
  if (n <= 1) return { order: idx, exact: true };
  const cost = (o) => simulate(o, mx, wins, svc, depart).cost;
  // starting tours: nearest by drive time, earliest closing first, input order
  const nn = []; { const left = new Set(idx); let cur = 0; while (left.size) { let b = -1, bd = Infinity; left.forEach((i) => { if (mx.M[cur][i] < bd) { bd = mx.M[cur][i]; b = i; } }); nn.push(b); left.delete(b); cur = b; } }
  const edf = idx.slice().sort((a, b) => wins[a].close - wins[b].close || mx.M[0][a] - mx.M[0][b]);
  let best = null;
  [nn, edf, idx].forEach((s) => { const r = improve(s, cost); if (!best || r.cost < best.cost) best = r; });
  let exact = false;
  if (n <= EXACT_MAX) {
    let nodes = 0; const cap = 600000; let aborted = false;
    const used = new Array(n + 1).fill(false), cur = [];
    const dfs = (t, prev, late, c0) => {
      if (aborted) return;
      if (++nodes > cap) { aborted = true; return; }
      if (cur.length === n) {
        const end = t + mx.M[prev][0], total = (end - depart) + LATE_W * late;
        if (total < best.cost - 1e-9) best = { ord: cur.slice(), cost: total };
        return;
      }
      for (let i = 1; i <= n; i++) {
        if (used[i]) continue;
        const arr = t + mx.M[prev][i], v = visit(arr, wins[i], svc);
        const partial = (v.leave - depart) + LATE_W * (late + v.late);
        if (partial >= best.cost - 1e-9) continue;   // cannot beat the best tour found so far
        used[i] = true; cur.push(i);
        dfs(v.leave, i, late + v.late, partial);
        cur.pop(); used[i] = false;
      }
    };
    dfs(depart, 0, 0, 0);
    exact = !aborted;
  }
  return { order: best.ord, exact };
}

/*
 * cust: [{name, lat, lng, c}] where c is the customer row (recv_* fields); depot: {lat,lng}
 * returns { points, back, backMin, backKm, km, basis, exact, pts } ; points carry the full timeline
 */
const MEMO = new Map();   // the plan is recomputed on every refresh; identical inputs → reuse the (possibly expensive) stop order
function planRoute({ cust, depot, cfg, depart, legs }) {
  const pts = [depot].concat(cust);
  const mx = buildMatrix(pts, cfg, legs);
  const wins = [null].concat(cust.map((x) => windowOf(cfg, x.c)));
  const sig = JSON.stringify([pts.map((p) => pk(p.lat, p.lng)), wins, depart, cfg.svc, mx.basis, mx.M.map((r) => r.map((v) => Math.round(v * 10)))]);
  let r = MEMO.get(sig);
  if (!r) { r = solve(cust.length, mx, wins, cfg.svc, depart); MEMO.set(sig, r); if (MEMO.size > 200) MEMO.delete(MEMO.keys().next().value); }
  const sim = simulate(r.order, mx, wins, cfg.svc, depart);
  const points = sim.rows.map((x, k) => {
    const w = wins[x.idx], c = cust[x.idx - 1];
    const status = x.late > 0 ? 'late' : x.lunch ? 'lunch' : x.wait > 0 ? 'wait' : 'ok';
    return {
      seq: k + 1, name: c.name, lat: c.lat, lng: c.lng,
      legKm: Math.round(x.legKm * 10) / 10, legMin: Math.round(x.legMin),
      arrive: Math.round(x.arrive), start: Math.round(x.start), wait: Math.round(x.wait), leave: Math.round(x.leave),
      lateMin: Math.round(x.late), status,
      win: { open: hm(w.open), close: hm(w.close), lunchFrom: w.lf != null ? hm(w.lf) : '', lunchTo: w.lt != null ? hm(w.lt) : '', custom: w.custom },
    };
  });
  return {
    points, back: Math.round(sim.back), backMin: Math.round(sim.backMin), backKm: Math.round(sim.backKm * 10) / 10,
    km: Math.round(sim.km * 10) / 10, basis: mx.basis, exact: r.exact, late: Math.round(sim.late), wait: Math.round(sim.wait),
    pts: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
  };
}

module.exports = { DEFAULT_DELIVERY, MAX_STOPS, EXACT_MAX, LATE_W, normCfg, windowOf, buildMatrix, simulate, solve, planRoute, pk, haversine, tm, hm, hmd };
