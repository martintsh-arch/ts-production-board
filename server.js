'use strict';
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const APP_PIN = (process.env.APP_PIN || '').trim();
const TZ = 'Asia/Taipei';

if (!DATABASE_URL) {
  console.error('缺少 DATABASE_URL 環境變數（請貼上 Neon 的連線字串）');
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1|\/var\/run|host=\//.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5,
});

/* ---------- default codes ---------- */
const DEFAULT_CONFIG = {
  people: [],
  cats: {
    S: { name: '糖漿', rule: 'material', mat: '果糖' },
    P: { name: '純蜜', rule: 'month' },
    J: { name: '果樂茶', rule: 'month', auto: true },
    O: { name: '油品', rule: 'month' },
    V: { name: '蜂蜜醋', rule: 'month' },
    R: { name: '玫瑰蜜露', rule: 'month', auto: true },
  },
  varieties: {
    P: { 1: '台灣龍眼蜜', 2: '泰國龍眼蜜', 3: '荔枝蜜', 4: '百花蜜' },
    J: { 1: '檸檬', 2: '百香果與紅葡萄柚', 3: '芒果柳橙與草莓', 4: '蜜桃與荔枝' },
    O: { 1: '苦茶油', 2: '芥花苦茶油' },
    V: { 1: '鳳梨', 2: '白柚' },
    R: { 1: '玫瑰蜜露' },
  },
  lotModeV: 1,
};

/* ---------- schema ---------- */
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      cat TEXT NOT NULL,
      variety TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      customer TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      cat TEXT NOT NULL,
      variety TEXT NOT NULL DEFAULT '',
      qty INTEGER NOT NULL CHECK (qty > 0),
      ordered_qty INTEGER,
      ship_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      sort_order INTEGER NOT NULL DEFAULT 0,
      lot TEXT,
      completed_at TIMESTAMPTZ,
      operator TEXT,
      mat_date TEXT,
      mat_arr TEXT,
      parent_id INTEGER,
      lot_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      void_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
    CREATE INDEX IF NOT EXISTS tasks_lot_idx ON tasks(lot);
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value BIGINT NOT NULL
    );
  `);
  await pool.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contents JSONB;
    CREATE UNIQUE INDEX IF NOT EXISTS products_code_idx ON products(code);
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS customer_products (
      customer TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      times INTEGER NOT NULL DEFAULT 1,
      last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (customer, product_id)
    );
  `);
  await pool.query(
    `INSERT INTO config (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(DEFAULT_CONFIG)]
  );
  await pool.query(`INSERT INTO meta (key, value) VALUES ('rev', 1) ON CONFLICT (key) DO NOTHING`);
  // v2 lot mode: manual lot entry by default; 果樂茶 J and 玫瑰蜜露 R are locked to system-generated lots
  const cfg = await getConfig();
  if (!cfg.lotModeV) {
    cfg.lotModeV = 1;
    if (cfg.cats.J) cfg.cats.J.auto = true;
    if (!cfg.cats.R) cfg.cats.R = { name: '玫瑰蜜露', rule: 'month' };
    cfg.cats.R.auto = true;
    cfg.varieties = cfg.varieties || {};
    cfg.varieties.R = Object.assign({ 1: '玫瑰蜜露' }, cfg.varieties.R || {});
    await pool.query(`UPDATE config SET data=$1 WHERE id=1`, [JSON.stringify(cfg)]);
    await pool.query(`UPDATE products SET cat='R', variety='1', active=TRUE
      WHERE cat='' AND (name LIKE '%玫瑰%' OR name LIKE '%花露%' OR name LIKE '%蜜露%') AND name NOT LIKE '%禮盒%'
        AND components = '[]'::jsonb`);
  }
}

/* ---------- helpers ---------- */
async function bump(client) {
  await (client || pool).query(`UPDATE meta SET value = value + 1 WHERE key = 'rev'`);
}
function taipeiParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, day] = f.format(d).split('-');
  return { y: +y, m, d: day };
}
function taipeiDate(d) { const t = taipeiParts(new Date(d)); return t.y + '-' + t.m + '-' + t.d; }
const yearCode = (y) => String.fromCharCode(65 + (y - 2019)); // 2026 = H
const str = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function rowTask(r) {
  return {
    id: r.id, customer: r.customer, productId: r.product_id, productName: r.product_name,
    cat: r.cat, variety: r.variety, qty: r.qty, orderedQty: r.ordered_qty, shipDate: r.ship_date,
    note: r.note, status: r.status, order: r.sort_order, lot: r.lot,
    completedAt: r.completed_at, operator: r.operator, matDate: r.mat_date, matArr: r.mat_arr,
    unit: r.unit || '', contents: r.contents || null, parentId: r.parent_id, lotHistory: r.lot_history, createdAt: r.created_at,
  };
}
async function getConfig(client) {
  const { rows } = await (client || pool).query('SELECT data FROM config WHERE id = 1');
  return rows[0] ? rows[0].data : DEFAULT_CONFIG;
}
class UserError extends Error {}
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    if (e instanceof UserError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  });

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: '3mb' }));

app.get('/healthz', (req, res) => res.send('ok'));

// optional shared PIN
app.use('/api', (req, res, next) => {
  if (!APP_PIN) return next();
  if (req.path === '/auth-required') return next();
  const pin = req.get('x-pin') || req.query.pin;
  if (pin === APP_PIN) return next();
  res.status(401).json({ error: 'pin' });
});
app.get('/api/auth-required', (req, res) => res.json({ required: !!APP_PIN }));

app.get('/api/rev', wrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT value FROM meta WHERE key = 'rev'`);
  res.json({ rev: Number(rows[0].value) });
}));

app.get('/api/state', wrap(async (req, res) => {
  const [rev, open, done, products, config, customers, history, recent] = await Promise.all([
    pool.query(`SELECT value FROM meta WHERE key = 'rev'`),
    pool.query(`SELECT * FROM tasks WHERE status = 'open' ORDER BY sort_order, id`),
    pool.query(`SELECT * FROM tasks WHERE status = 'done' ORDER BY completed_at DESC LIMIT 2000`),
    pool.query(`SELECT * FROM products ORDER BY code NULLS LAST, name`),
    getConfig(),
    pool.query(`SELECT id, name, code FROM customers ORDER BY name`),
    pool.query(`SELECT customer, product_id, times FROM customer_products ORDER BY times DESC, last_at DESC`),
    pool.query(`SELECT product_id, lot, MAX(completed_at) AS at FROM tasks
                WHERE status='done' AND lot ~ '^[A-Z0-9]+-[A-Z]$' AND completed_at > now() - interval '400 days'
                GROUP BY product_id, lot ORDER BY at DESC`),
  ]);
  const recentLots = {};
  recent.rows.forEach((r) => {
    const a = recentLots[r.product_id] = recentLots[r.product_id] || [];
    if (a.length < 8) a.push([r.lot, taipeiDate(r.at)]);
  });
  res.json({
    rev: Number(rev.rows[0].value),
    open: open.rows.map(rowTask),
    done: done.rows.map(rowTask),
    products: products.rows,
    customers: customers.rows,
    history: history.rows.map((h) => [h.customer, h.product_id, h.times]),
    recentLots,
    config,
    now: taipeiParts(),
  });
}));

/* orders */
const UNITS = ['桶', '箱', '瓶'];
async function readOrderBody(b) {
  const customer = str(b.customer, 100);
  const productId = parseInt(b.productId, 10);
  const qty = parseInt(b.qty, 10);
  const shipDate = str(b.shipDate, 10);
  const note = str(b.note, 300);
  const unit = str(b.unit, 4);
  if (unit && !UNITS.includes(unit)) throw new UserError('單位只能是桶、箱或瓶');
  if (!customer) throw new UserError('請輸入客戶名稱');
  if (!productId) throw new UserError('請選擇品項');
  if (!qty || qty < 1) throw new UserError('數量需大於 0');
  if (!isDate(shipDate)) throw new UserError('請選擇出貨日');
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (!rows[0]) throw new UserError('找不到這個品項');
  return { customer, product: rows[0], qty, shipDate, note, unit };
}

async function rememberPurchase(customer, productId) {
  await pool.query(`INSERT INTO customers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [customer]);
  await pool.query(
    `INSERT INTO customer_products (customer, product_id) VALUES ($1,$2)
     ON CONFLICT (customer, product_id) DO UPDATE SET times = customer_products.times + 1, last_at = now()`,
    [customer, productId]);
}

app.post('/api/tasks', wrap(async (req, res) => {
  const o = await readOrderBody(req.body || {});
  const { rows } = await pool.query(
    `INSERT INTO tasks (customer, product_id, product_name, cat, variety, qty, ordered_qty, ship_date, note, unit, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,(SELECT COALESCE(MAX(sort_order),0)+10 FROM tasks WHERE status='open'))
     RETURNING *`,
    [o.customer, o.product.id, o.product.name, o.product.cat, o.product.variety, o.qty, o.shipDate, o.note, o.unit]
  );
  await rememberPurchase(o.customer, o.product.id);
  await bump();
  res.json(rowTask(rows[0]));
}));

app.post('/api/tasks/batch', wrap(async (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw new UserError('請至少選一個品項');
  if (items.length > 50) throw new UserError('一次最多 50 個品項');
  const orders = [];
  for (let i = 0; i < items.length; i++) {
    try {
      orders.push(await readOrderBody({ customer: b.customer, shipDate: b.shipDate, note: b.note, ...items[i] }));
    } catch (e) {
      if (e instanceof UserError) throw new UserError('第 ' + (i + 1) + ' 行：' + e.message);
      throw e;
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: m } = await client.query(`SELECT COALESCE(MAX(sort_order),0) AS mx FROM tasks WHERE status='open'`);
    let order = Number(m[0].mx);
    for (const o of orders) {
      order += 10;
      await client.query(
        `INSERT INTO tasks (customer, product_id, product_name, cat, variety, qty, ordered_qty, ship_date, note, unit, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10)`,
        [o.customer, o.product.id, o.product.name, o.product.cat, o.product.variety, o.qty, o.shipDate, o.note, o.unit, order]);
    }
    await bump(client);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  for (const o of orders) await rememberPurchase(o.customer, o.product.id);
  res.json({ created: orders.length });
}));

app.put('/api/tasks/:id', wrap(async (req, res) => {
  const o = await readOrderBody(req.body || {});
  const { rowCount } = await pool.query(
    `UPDATE tasks SET customer=$1, product_id=$2, product_name=$3, cat=$4, variety=$5, qty=$6, ordered_qty=$6, ship_date=$7, note=$8, unit=$10
     WHERE id=$9 AND status='open'`,
    [o.customer, o.product.id, o.product.name, o.product.cat, o.product.variety, o.qty, o.shipDate, o.note, req.params.id, o.unit]
  );
  if (!rowCount) throw new UserError('這筆訂單已完成或已取消，無法修改');
  await bump();
  res.json({ ok: true });
}));

app.post('/api/tasks/:id/void', wrap(async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE tasks SET status='void', void_at=now() WHERE id=$1 AND status='open'`, [req.params.id]);
  if (!rowCount) throw new UserError('這筆訂單已完成或已取消');
  await bump();
  res.json({ ok: true });
}));

app.post('/api/tasks/reorder', wrap(async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map((x) => parseInt(x, 10)).filter(Boolean) : [];
  if (!ids.length) throw new UserError('排序資料不完整');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query(`UPDATE tasks SET sort_order=$1 WHERE id=$2 AND status='open'`, [(i + 1) * 10, ids[i]]);
    }
    await bump(client);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  res.json({ ok: true });
}));

/* lot preview / finish */
function lotPrefix(cfg, { cat, variety, matDate, matArr }) {
  const c = cfg.cats[cat];
  if (!c) throw new UserError(cat ? '沒有這個類別代碼：' + cat : '請先選擇產品類別');
  const t = taipeiParts();
  const y = yearCode(t.y);
  if (c.rule === 'material') {
    if (!/^\d{4}$/.test(matDate || '')) throw new UserError('原料有效日期需要 4 碼');
    const mm = +matDate.slice(0, 2), dd = +matDate.slice(2);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) throw new UserError(matDate + ' 不是有效日期');
    if (matArr && !/^[A-Z]$/.test(matArr)) throw new UserError('到貨次序只能是英文字母');
    return y + cat + matDate + (matArr || '');
  }
  const vars = (cfg.varieties || {})[cat] || {};
  if (!variety || !vars[variety]) throw new UserError('請選擇品種');
  return y + cat + t.m + variety;
}
const LOT_RE = /^[A-Z0-9]{2,20}(-[A-Z0-9]{1,4})?$/;
const LOT_FMT = '批號格式不對（英文與數字，例如 HP101-A 或 HS0913B-F）';
function isAuto(cfg, cat) { return !!(cfg.cats[cat] && cfg.cats[cat].auto); }
// manual lot: pull material date / arrival letter out of it when it follows the syrup pattern
function parseMat(lot) { const m = /^[A-Z][A-Z](\d{4})([A-Z]?)-/.exec(lot); return m ? { matDate: m[1], matArr: m[2] } : { matDate: null, matArr: null }; }
async function nextSeq(client, prefix) {
  const { rows } = await client.query(
    `SELECT lot FROM tasks WHERE status='done' AND lot LIKE $1`, [prefix + '-%']);
  let max = -1;
  const re = new RegExp('^' + prefix + '-([A-Z])$');
  rows.forEach((r) => { const m = re.exec(r.lot || ''); if (m) max = Math.max(max, m[1].charCodeAt(0) - 65); });
  return max + 1;
}

app.post('/api/lot-preview', wrap(async (req, res) => {
  const cfg = await getConfig();
  const b = req.body || {};
  const prefix = lotPrefix(cfg, { cat: str(b.cat, 2), variety: str(b.variety, 2), matDate: str(b.matDate, 4), matArr: str(b.matArr, 1) });
  const n = await nextSeq(pool, prefix);
  const { rows } = await pool.query(
    `SELECT lot, product_name, customer, qty, unit, completed_at FROM tasks
     WHERE status='done' AND lot LIKE $1 ORDER BY completed_at DESC LIMIT 60`, [prefix + '-%']);
  const re = new RegExp('^' + prefix + '-([A-Z])$');
  const batches = {};
  rows.forEach((r) => {
    const m = re.exec(r.lot || ''); if (!m) return;
    const b = batches[m[1]] = batches[m[1]] || { seq: m[1], lot: r.lot, last: r.completed_at, items: [] };
    if (b.items.length < 4) b.items.push(r.customer + ' ' + r.product_name + ' ×' + r.qty + (r.unit ? ' ' + r.unit : ''));
  });
  res.json({
    prefix,
    suggest: n < 26 ? String.fromCharCode(65 + n) : null,
    lot: n < 26 ? prefix + '-' + String.fromCharCode(65 + n) : null,
    batches: Object.values(batches).sort((a, b) => b.seq.localeCompare(a.seq)).slice(0, 6),
  });
}));

app.post('/api/tasks/:id/finish', wrap(async (req, res) => {
  const b = req.body || {};
  const operator = str(b.operator, 50);
  if (!operator) throw new UserError('請先點選操作人');
  // one or more lots; each {cat, variety, matDate, matArr, seq, qty}
  const raw = Array.isArray(b.lots) && b.lots.length ? b.lots : [b];
  if (raw.length > 10) throw new UserError('一筆最多 10 個批號');
  const parts = raw.map((l) => ({
    cat: str(l.cat, 2), variety: str(l.variety, 2), matDate: str(l.matDate, 4), matArr: str(l.matArr, 1),
    seq: str(l.seq, 1).toUpperCase(), qty: parseInt(l.qty, 10), lot: str(l.lot, 30).toUpperCase().replace(/\s/g, ''),
  }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM tasks WHERE id=$1 FOR UPDATE`, [req.params.id]);
    const t = rows[0];
    if (!t || t.status !== 'open') throw new UserError('這筆已經完成或取消了，請重新整理');
    const { rows: pr } = await client.query('SELECT * FROM products WHERE id=$1', [t.product_id]);
    const comps = (pr[0] && pr[0].components) || [];
    if (comps.length) {
      // gift box: no lot of its own, record each content's lot and date
      const qty = parseInt(b.qty, 10);
      if (!qty || qty < 1 || qty > t.qty) throw new UserError('數量需介於 1 到 ' + t.qty);
      const given = Array.isArray(b.contents) ? b.contents : [];
      const { rows: cp } = await client.query('SELECT id, name, code FROM products WHERE id = ANY($1::int[])', [comps]);
      const contents = comps.map((cid) => {
        const p = cp.find((x) => x.id === cid) || { id: cid, name: '品項 ' + cid };
        const g = given.find((x) => +x.productId === cid) || {};
        const lot = str(g.lot, 30).toUpperCase();
        const date = str(g.date, 10);
        if (!LOT_RE.test(lot)) throw new UserError('請選擇「' + p.name + '」的批號');
        if (!isDate(date)) throw new UserError('請選擇「' + p.name + '」的生產日期');
        return { productId: cid, code: p.code || '', name: p.name, lot, date };
      });
      const lotText = contents.map((c) => c.lot).join('／');
      await client.query(
        `UPDATE tasks SET status='done', lot=$1, contents=$2, completed_at=now(), operator=$3,
           qty=$4, ordered_qty=COALESCE(ordered_qty, qty) WHERE id=$5`,
        [lotText, JSON.stringify(contents), operator, qty, t.id]);
      const rest = t.qty - qty;
      if (rest > 0) {
        await client.query(
          `INSERT INTO tasks (customer, product_id, product_name, cat, variety, qty, ordered_qty, ship_date, note, sort_order, parent_id, unit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [t.customer, t.product_id, t.product_name, t.cat, t.variety, rest, t.ordered_qty || t.qty, t.ship_date, t.note, t.sort_order, t.id, t.unit || '']);
      }
      await bump(client);
      await client.query('COMMIT');
      return res.json({ lot: lotText, lots: contents.map((c) => c.name + ' ' + c.lot), rest, box: true });
    }
    const total = parts.reduce((a, p) => a + (p.qty || 0), 0);
    if (parts.some((p) => !p.qty || p.qty < 1)) throw new UserError('每個批號的數量都要大於 0');
    if (total > t.qty) throw new UserError('各批號數量合計 ' + total + '，超過訂單的 ' + t.qty);
    const cfg = await getConfig(client);
    const done = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], tag = parts.length > 1 ? '第 ' + (i + 1) + ' 個批號：' : '';
      if (!cfg.cats[p.cat]) throw new UserError(tag + (p.cat ? '沒有這個類別代碼：' + p.cat : '請先選擇產品類別'));
      if (!isAuto(cfg, p.cat)) {
        // operator keys in the lot by hand
        if (!LOT_RE.test(p.lot)) throw new UserError(tag + LOT_FMT);
        const isMatM = cfg.cats[p.cat].rule === 'material', mm = parseMat(p.lot);
        const valsM = [p.lot, operator, p.cat, isMatM ? t.variety : (p.variety || t.variety), p.qty, isMatM ? mm.matDate : null, isMatM ? mm.matArr : null];
        if (i === 0) {
          await client.query(
            `UPDATE tasks SET status='done', lot=$1, completed_at=now(), operator=$2, cat=$3, variety=$4,
               qty=$5, ordered_qty=COALESCE(ordered_qty, qty), mat_date=$6, mat_arr=$7 WHERE id=$8`, [...valsM, t.id]);
        } else {
          await client.query(
            `INSERT INTO tasks (customer, product_id, product_name, ship_date, note, unit, sort_order, parent_id, ordered_qty, status,
               lot, completed_at, operator, cat, variety, qty, mat_date, mat_arr)
             VALUES ($8,$9,$10,$11,$12,$13,$14,$15,$16,'done',$1,now(),$2,$3,$4,$5,$6,$7)`,
            [...valsM, t.customer, t.product_id, t.product_name, t.ship_date, t.note, t.unit || '', t.sort_order, t.id, t.ordered_qty || t.qty]);
        }
        done.push(p.lot + ' ×' + p.qty);
        continue;
      }
      p.seq = ''; // locked category: the system always issues the next serial
      let prefix;
      try { prefix = lotPrefix(cfg, p); } catch (e) { if (e instanceof UserError) throw new UserError(tag + e.message); throw e; }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);
      let seq = p.seq;
      if (seq && !/^[A-Z]$/.test(seq)) throw new UserError(tag + '批次序號只能是 A 到 Z');
      if (!seq) {
        const n = await nextSeq(client, prefix);
        if (n > 25) throw new UserError(tag + '這個批號的序號已用到 Z，請手動選擇序號');
        seq = String.fromCharCode(65 + n);
      }
      const isMat = cfg.cats[p.cat].rule === 'material';
      const lot = prefix + '-' + seq;
      const vals = [lot, operator, p.cat, isMat ? t.variety : p.variety, p.qty, isMat ? p.matDate : null, isMat ? (p.matArr || '') : null];
      if (i === 0) {
        await client.query(
          `UPDATE tasks SET status='done', lot=$1, completed_at=now(), operator=$2, cat=$3, variety=$4,
             qty=$5, ordered_qty=COALESCE(ordered_qty, qty), mat_date=$6, mat_arr=$7 WHERE id=$8`, [...vals, t.id]);
      } else {
        await client.query(
          `INSERT INTO tasks (customer, product_id, product_name, ship_date, note, unit, sort_order, parent_id, ordered_qty, status,
             lot, completed_at, operator, cat, variety, qty, mat_date, mat_arr)
           VALUES ($8,$9,$10,$11,$12,$13,$14,$15,$16,'done',$1,now(),$2,$3,$4,$5,$6,$7)`,
          [...vals, t.customer, t.product_id, t.product_name, t.ship_date, t.note, t.unit || '', t.sort_order, t.id, t.ordered_qty || t.qty]);
      }
      done.push(lot + ' ×' + p.qty);
    }
    const rest = t.qty - total;
    if (rest > 0) {
      await client.query(
        `INSERT INTO tasks (customer, product_id, product_name, cat, variety, qty, ordered_qty, ship_date, note, sort_order, parent_id, unit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [t.customer, t.product_id, t.product_name, t.cat, t.variety, rest, t.ordered_qty || t.qty, t.ship_date, t.note, t.sort_order, t.id, t.unit || '']
      );
    }
    await bump(client);
    await client.query('COMMIT');
    res.json({ lot: done.map((d) => d.split(' ×')[0]).join('、'), lots: done, rest });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

// one production batch shared by several orders: one lot for all
app.post('/api/tasks/finish-batch', wrap(async (req, res) => {
  const b = req.body || {};
  const operator = str(b.operator, 50);
  if (!operator) throw new UserError('請先點選操作人');
  const items = (Array.isArray(b.items) ? b.items : []).map((x) => ({ id: parseInt(x.id, 10), qty: parseInt(x.qty, 10) }));
  if (items.length < 1) throw new UserError('請至少選一筆訂單');
  if (items.length > 30) throw new UserError('一次最多 30 筆');
  if (items.some((x) => !x.id || !x.qty || x.qty < 1)) throw new UserError('每一筆的數量都要大於 0');
  const p = { cat: str(b.cat, 2), variety: str(b.variety, 2), matDate: str(b.matDate, 4), matArr: str(b.matArr, 1) };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cfg = await getConfig(client);
    if (!cfg.cats[p.cat]) throw new UserError(p.cat ? '沒有這個類別代碼：' + p.cat : '請先選擇產品類別');
    let lot;
    if (isAuto(cfg, p.cat)) {
      const prefix = lotPrefix(cfg, p);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);
      const n = await nextSeq(client, prefix);
      if (n > 25) throw new UserError('這個批號的序號已用到 Z');
      lot = prefix + '-' + String.fromCharCode(65 + n);
    } else {
      lot = str(b.lot, 30).toUpperCase().replace(/\s/g, '');
      if (!LOT_RE.test(lot)) throw new UserError(LOT_FMT);
      const mm = parseMat(lot); p.matDate = mm.matDate; p.matArr = mm.matArr;
    }
    const isMat = cfg.cats[p.cat].rule === 'material';
    const { rows } = await client.query(`SELECT * FROM tasks WHERE id = ANY($1::int[]) FOR UPDATE`, [items.map((x) => x.id)]);
    let rest = 0;
    for (const it of items) {
      const t = rows.find((r) => r.id === it.id);
      if (!t || t.status !== 'open') throw new UserError('有訂單已經完成或取消了，請重新整理');
      if (it.qty > t.qty) throw new UserError(t.customer + '：數量需介於 1 到 ' + t.qty);
      const { rows: pr } = await client.query('SELECT components FROM products WHERE id=$1', [t.product_id]);
      if (pr[0] && (pr[0].components || []).length) throw new UserError('禮盒不能和其他訂單一起完成，請個別完成');
      await client.query(
        `UPDATE tasks SET status='done', lot=$1, completed_at=now(), operator=$2, cat=$3, variety=$4,
           qty=$5, ordered_qty=COALESCE(ordered_qty, qty), mat_date=$6, mat_arr=$7 WHERE id=$8`,
        [lot, operator, p.cat, isMat ? t.variety : (p.variety || t.variety), it.qty, isMat ? p.matDate : null, isMat ? (p.matArr == null ? null : p.matArr) : null, t.id]);
      if (t.qty - it.qty > 0) {
        rest++;
        await client.query(
          `INSERT INTO tasks (customer, product_id, product_name, cat, variety, qty, ordered_qty, ship_date, note, sort_order, parent_id, unit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [t.customer, t.product_id, t.product_name, t.cat, t.variety, t.qty - it.qty, t.ordered_qty || t.qty, t.ship_date, t.note, t.sort_order, t.id, t.unit || '']);
      }
    }
    await bump(client);
    await client.query('COMMIT');
    res.json({ lot, count: items.length, rest });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

app.post('/api/tasks/:id/lot', wrap(async (req, res) => {
  const lot = str(req.body && req.body.lot, 30).toUpperCase();
  if (!LOT_RE.test(lot)) throw new UserError(LOT_FMT);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM tasks WHERE id=$1 AND status='done' FOR UPDATE`, [req.params.id]);
    const t = rows[0];
    if (!t) throw new UserError('找不到這筆紀錄');
    if (t.lot !== lot) {
      const hist = (t.lot_history || []).concat([{ at: new Date().toISOString(), from: t.lot, to: lot }]);
      await client.query(`UPDATE tasks SET lot=$1, lot_history=$2 WHERE id=$3`, [lot, JSON.stringify(hist), t.id]);
      await bump(client);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

/* products */
async function checkCat(cat, variety) {
  const cfg = await getConfig();
  if (!cat) return { cat: '', variety: '' };
  if (!cfg.cats[cat]) throw new UserError('沒有這個類別');
  if (cfg.cats[cat].rule === 'material') return { cat, variety: '' };
  if (!((cfg.varieties || {})[cat] || {})[variety]) throw new UserError('請選擇品種');
  return { cat, variety };
}
app.post('/api/products', wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100), code = str(b.code, 40).toUpperCase() || null;
  if (!name) throw new UserError('請輸入品名／規格');
  const cv = await checkCat(str(b.cat, 2), str(b.variety, 2));
  if (!cv.cat) throw new UserError('請選擇類別');
  if (code) {
    const dup = await pool.query('SELECT name FROM products WHERE code=$1', [code]);
    if (dup.rowCount) throw new UserError('品號 ' + code + ' 已經是「' + dup.rows[0].name + '」');
  }
  const { rows } = await pool.query(
    `INSERT INTO products (name, cat, variety, code) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, cv.cat, cv.variety, code]);
  await bump();
  res.json(rows[0]);
}));
app.put('/api/products/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const cv = await checkCat(str(b.cat, 2), str(b.variety, 2));
  const { rowCount } = await pool.query(`UPDATE products SET cat=$1, variety=$2 WHERE id=$3`, [cv.cat, cv.variety, req.params.id]);
  if (!rowCount) throw new UserError('找不到這個品項');
  // open orders of this product follow the new category
  await pool.query(`UPDATE tasks SET cat=$1, variety=$2 WHERE product_id=$3 AND status='open'`, [cv.cat, cv.variety, req.params.id]);
  await bump();
  res.json({ ok: true });
}));
app.put('/api/products/:id/components', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).map((x) => parseInt(x, 10)).filter(Boolean);
  const id = parseInt(req.params.id, 10);
  if (ids.includes(id)) throw new UserError('禮盒不能把自己當內容物');
  if (ids.length > 12) throw new UserError('內容物最多 12 項');
  if (ids.length) {
    const { rows } = await pool.query('SELECT id, components FROM products WHERE id = ANY($1::int[])', [ids]);
    if (rows.length !== new Set(ids).size) throw new UserError('找不到部分內容物品項');
    if (rows.some((r) => (r.components || []).length)) throw new UserError('內容物不能是另一個禮盒');
  }
  await pool.query('UPDATE products SET components=$1 WHERE id=$2', [JSON.stringify(ids), id]);
  await bump();
  res.json({ ok: true });
}));
app.post('/api/products/:id/toggle', wrap(async (req, res) => {
  await pool.query(`UPDATE products SET active = NOT active WHERE id=$1`, [req.params.id]);
  await bump();
  res.json({ ok: true });
}));

/* customers */
app.put('/api/customers/:id', wrap(async (req, res) => {
  const code = str(req.body && req.body.code, 40);
  await pool.query(`UPDATE customers SET code=$1 WHERE id=$2`, [code, req.params.id]);
  await bump();
  res.json({ ok: true });
}));

/* best-guess category for a product name; corrected by hand in 設定 when wrong */
const NOT_PRODUCED = /空桶|塑膠桶|運費|油瓶|花粉|蜂王|蜂蠟/;
function classify(name) {
  if (NOT_PRODUCED.test(name)) return { cat: '', variety: '', inactive: true };
  if (/禮盒/.test(name)) return { cat: '', variety: '' };
  if (/玫瑰|花露|蜜露/.test(name)) return { cat: 'R', variety: '1' };
  if (/糖漿/.test(name)) return { cat: 'S', variety: '' };
  if (/果樂茶/.test(name)) {
    const v = /檸檬/.test(name) ? '1' : /百香果|葡萄柚/.test(name) ? '2' : /芒果|柳橙|草莓/.test(name) ? '3' : /蜜桃|荔枝/.test(name) ? '4' : '';
    return { cat: v ? 'J' : '', variety: v };
  }
  if (/芥花/.test(name)) return { cat: 'O', variety: '2' };
  if (/苦茶油/.test(name)) return { cat: 'O', variety: '1' };
  if (/調和蜂蜜/.test(name)) return { cat: 'M', variety: '1' };
  if (/泰國/.test(name)) return { cat: 'P', variety: '2' };
  if (/琥珀/.test(name) && /龍眼/.test(name)) return { cat: 'P', variety: '2' };
  if (/嚴選龍眼/.test(name)) {
    const kg = (name.match(/([\d.]+)\s*公斤/) || [])[1];
    if (kg && parseFloat(kg) >= 1.2) return { cat: 'P', variety: '2' };
  }
  if (/黃金/.test(name) && /蜜/.test(name)) return { cat: 'P', variety: '3' };
  if (/龍眼|琥珀/.test(name)) return { cat: 'P', variety: '1' };
  if (/荔枝/.test(name)) return { cat: 'P', variety: '3' };
  if (/百花/.test(name)) return { cat: 'P', variety: '4' };
  if (/蜜/.test(name)) return { cat: 'P', variety: '4' };
  return { cat: '', variety: '' };
}

/* import sales history exported from 新高手: rows of {customerCode?, customer, code, name} */
app.post('/api/import-history', wrap(async (req, res) => {
  const list = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  const rows = list.map((r) => ({
    customerCode: str(r.customerCode, 40), customer: str(r.customer, 100),
    code: str(r.code, 40).toUpperCase(), name: str(r.name, 120),
  })).filter((r) => r.customer && r.code && r.name);
  if (!rows.length) throw new UserError('檔案裡找不到可用的資料（需要客戶、品號、品名）');
  // most common name per product code
  const names = {};
  rows.forEach((r) => { names[r.code] = names[r.code] || {}; names[r.code][r.name] = (names[r.code][r.name] || 0) + 1; });
  const pairs = {};
  rows.forEach((r) => { const k = r.customer + '\u0000' + r.code; pairs[k] = (pairs[k] || 0) + 1; });
  const custCodes = {};
  rows.forEach((r) => { if (r.customerCode) custCodes[r.customer] = r.customerCode; });
  const client = await pool.connect();
  let newProducts = 0, guessed = 0, hidden = 0;
  try {
    await client.query('BEGIN');
    // make sure the 調和蜂蜜 category exists for the classifier
    const cfg = await getConfig(client);
    if (!cfg.cats.M) {
      cfg.cats.M = { name: '調和蜂蜜', rule: 'month' };
      cfg.varieties = cfg.varieties || {};
      cfg.varieties.M = Object.assign({ 1: '特A級調和蜂蜜' }, cfg.varieties.M || {});
      await client.query(`UPDATE config SET data=$1 WHERE id=1`, [JSON.stringify(cfg)]);
    }
    const idByCode = {};
    for (const [code, m] of Object.entries(names)) {
      const name = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
      const g = classify(name);
      const r = await client.query(
        `INSERT INTO products (code, name, cat, variety, active) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
           cat = CASE WHEN products.cat = '' THEN EXCLUDED.cat ELSE products.cat END,
           variety = CASE WHEN products.cat = '' THEN EXCLUDED.variety ELSE products.variety END
         RETURNING id, (xmax = 0) AS inserted`, [code, name, g.cat, g.variety, !g.inactive]);
      idByCode[code] = r.rows[0].id;
      if (r.rows[0].inserted) { newProducts++; if (g.inactive) hidden++; else if (g.cat) guessed++; }
    }
    const customers = [...new Set(rows.map((r) => r.customer))];
    for (const c of customers) {
      await client.query(
        `INSERT INTO customers (name, code) VALUES ($1,$2)
         ON CONFLICT (name) DO UPDATE SET code = CASE WHEN EXCLUDED.code <> '' THEN EXCLUDED.code ELSE customers.code END`,
        [c, custCodes[c] || '']);
    }
    for (const [k, times] of Object.entries(pairs)) {
      const [c, code] = k.split('\u0000');
      await client.query(
        `INSERT INTO customer_products (customer, product_id, times) VALUES ($1,$2,$3)
         ON CONFLICT (customer, product_id) DO UPDATE SET times = GREATEST(customer_products.times, EXCLUDED.times)`,
        [c, idByCode[code], times]);
    }
    await bump(client);
    await client.query('COMMIT');
    res.json({ customers: customers.length, products: Object.keys(names).length, newProducts, guessed, hidden, pairs: Object.keys(pairs).length });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

/* config */
app.put('/api/config', wrap(async (req, res) => {
  const c = req.body || {};
  if (!c.cats || typeof c.cats !== 'object' || !Array.isArray(c.people)) throw new UserError('設定資料不完整');
  for (const [k, v] of Object.entries(c.cats)) {
    if (!/^[A-Z]$/.test(k) || !v || !v.name || !['month', 'material'].includes(v.rule)) throw new UserError('類別設定格式不對：' + k);
  }
  await pool.query(`UPDATE config SET data=$1 WHERE id=1`, [JSON.stringify(c)]);
  await bump();
  res.json({ ok: true });
}));

/* export */
app.get('/api/export.csv', wrap(async (req, res) => {
  const cfg = await getConfig();
  const { rows } = await pool.query(`SELECT * FROM tasks WHERE status='done' ORDER BY completed_at DESC`);
  const head = ['完成時間', '批號', '類別', '品項', '完成數量', '訂單數量', '單位', '客戶', '出貨日', '操作人', '原料有效日', '到貨次序', '禮盒內容物批號', '備註'];
  const fmt = (d) => d ? new Date(d).toLocaleString('zh-TW', { timeZone: TZ, hour12: false }) : '';
  const lines = [head].concat(rows.map((t) => [fmt(t.completed_at), t.lot, t.contents ? '禮盒' : ((cfg.cats[t.cat] || {}).name || t.cat),
    t.product_name, t.qty, t.ordered_qty || t.qty, t.unit || '', t.customer, t.ship_date, t.operator, t.mat_date || '', t.mat_arr || '', (t.contents || []).map((c) => c.name + ' ' + c.lot + '（' + c.date + '）').join('；'), t.note || '']));
  const csv = '﻿' + lines.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const name = '生產紀錄_' + Object.values(taipeiParts()).join('') + '.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.send(csv);
}));

/* static */
app.get('/vendor/Sortable.min.js', (req, res) =>
  res.sendFile(require.resolve('sortablejs/Sortable.min.js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));

migrate()
  .then(() => app.listen(PORT, () => console.log('生產看板已啟動，port ' + PORT)))
  .catch((e) => { console.error('資料庫初始化失敗：', e.message); process.exit(1); });
