/* 統香營運中樞（第二代）：一個角色一個畫面
   核心想法：工廠做「批次」進庫存，訂單由庫存配貨（先到期先出）。
   這個檔案只加新的 API 與頁面，舊的看板與資料表照常使用。 */
const path = require('path');

module.exports = function mountV2(app, d) {
  const { pool, wrap, UserError, str, isDate, bump, getConfig, taipeiDate, lotPrefix, isAuto, LOT_RE, NO_LOT, UNITS,
    toLedger, defaultExpiry, dRoute, driversOf, rowTask, nextSeq } = d;

  pool.query(`CREATE TABLE IF NOT EXISTS delivery_photos (
      id SERIAL PRIMARY KEY, task_ids INTEGER[] NOT NULL, customer TEXT NOT NULL DEFAULT '', driver TEXT NOT NULL DEFAULT '',
      img BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS delivery_photos_tasks ON delivery_photos USING GIN (task_ids);`).catch((e) => console.error('v2 migrate', e.message));

  const send = (f) => (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, f)); };
  app.get('/v2', send('v2.html'));
  app.get('/v2/', send('v2.html'));
  app.get('/v2/app.js', send('v2app.js'));
  app.get('/v2/driver', send('v2driver.html'));

  const addDays = (iso, n) => { const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const byShip = (a, b) => String(a.ship_date).localeCompare(String(b.ship_date)) || (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.sort_order - b.sort_order || a.id - b.id;
  // order unit -> ledger unit and how many ledger pieces one order unit is
  function ledgerOf(p, unit) {
    unit = unit || '';
    if (unit === '箱') return p && p.pack_size && p.base_unit ? { ku: p.base_unit, f: p.pack_size } : { ku: '箱', f: 1 };
    return { ku: unit, f: 1 };
  }
  // free stock per product + ledger unit, lots oldest-expiry first
  function lotsMap(rows) {
    const m = {};
    rows.forEach((r) => { (m[r.product_id + '|' + r.unit] = m[r.product_id + '|' + r.unit] || []).push({ lot: r.lot, expiry: r.expiry || '', n: Number(r.n) }); });
    return m;
  }
  // take whole order units from the lots, earliest expiry first
  function take(lots, qty, f) {
    const out = []; let left = qty;
    for (const l of lots) {
      if (left <= 0) break;
      const can = Math.floor(l.n / f);
      const q = Math.min(can, left);
      if (q > 0) { out.push({ lot: l.lot, expiry: l.expiry, qty: q }); l.n -= q * f; left -= q; }
    }
    return { lots: out, got: qty - left };
  }

  /* ---------- 狀態：各畫面共用 ---------- */
  app.get('/api/v2/state', wrap(async (req, res) => {
    const today = taipeiDate(new Date());
    const [rev, open, active, products, cfg, customers, history, bal, makes, inbox, photos, lastLots] = await Promise.all([
      pool.query(`SELECT value FROM meta WHERE key='rev'`),
      pool.query(`SELECT * FROM tasks WHERE status='open'`),
      pool.query(`SELECT * FROM tasks WHERE status='done' AND (
          (delivery_status='' AND ship_date >= $1)
          OR (delivery_status IN ('delivered','failed') AND delivery_at >= now() - interval '3 days')
          OR (completed_at >= now() - interval '2 days' AND delivery_status <> 'legacy'))
        ORDER BY completed_at DESC LIMIT 1500`, [addDays(today, -21)]),
      pool.query(`SELECT id, name, cat, variety, code, active, pack_size, base_unit, no_lot, components FROM products ORDER BY code NULLS LAST, name`),
      getConfig(),
      pool.query(`SELECT name, code, address, (lat IS NOT NULL) AS geo FROM customers ORDER BY name`),
      pool.query(`SELECT customer, product_id, times FROM customer_products ORDER BY times DESC, last_at DESC`),
      pool.query(`SELECT product_id, unit, lot, expiry, SUM(qty)::int AS n, MIN(created_at) AS at FROM stock_moves
        GROUP BY product_id, unit, lot, expiry HAVING SUM(qty) > 0 ORDER BY (expiry=''), expiry, MIN(created_at)`),
      pool.query(`SELECT id, product_id, product_name, unit, lot, expiry, qty, operator, note, created_at FROM stock_moves
        WHERE kind='make' AND created_at >= now() - interval '3 days' ORDER BY id DESC LIMIT 60`),
      pool.query(`SELECT id, text, sent_at FROM line_msgs WHERE status='new' ORDER BY sent_at DESC, id DESC LIMIT 50`),
      pool.query(`SELECT DISTINCT unnest(task_ids) AS id FROM delivery_photos WHERE created_at >= now() - interval '4 days'`),
      pool.query(`SELECT product_id, lot, MAX(at) AS at FROM (
          SELECT product_id, lot, created_at AS at FROM stock_moves WHERE kind='make' AND lot <> '' AND created_at > now() - interval '400 days'
          UNION ALL SELECT product_id, lot, completed_at FROM tasks WHERE status='done' AND lot ~ '^[A-Z0-9]+(-[A-Z0-9]+)?$' AND NOT from_stock AND completed_at > now() - interval '400 days'
        ) x GROUP BY product_id, lot ORDER BY at DESC`),
    ]);
    const P = {}; products.rows.forEach((p) => { P[p.id] = p; });
    const lm = lotsMap(bal.rows);
    const work = {}; Object.keys(lm).forEach((k) => { work[k] = lm[k].map((l) => ({ ...l })); });
    const cover = {}, dem = {};
    open.rows.slice().sort(byShip).forEach((t) => {
      const p = P[t.product_id] || {}, L = ledgerOf(p, t.unit), key = t.product_id + '|' + L.ku;
      const r = take(work[key] || [], t.qty, L.f);
      const short = t.qty - r.got;
      cover[t.id] = { state: short === 0 ? 'stock' : r.got > 0 ? 'part' : 'short', lots: r.lots, short };
      const g = dem[key] = dem[key] || { productId: t.product_id, name: t.product_name, ku: L.ku, needL: 0, shortL: 0, units: {}, earliest: null, tasks: [] };
      g.needL += t.qty * L.f; g.shortL += short * L.f; g.units[t.unit || ''] = (g.units[t.unit || ''] || 0) + 1;
      if (short > 0 && (!g.earliest || t.ship_date < g.earliest)) g.earliest = t.ship_date;
      g.tasks.push({ id: t.id, customer: t.customer, qty: t.qty, unit: t.unit || '', f: L.f, shipDate: t.ship_date, urgent: !!t.urgent, short });
    });
    // spare stock (not promised to any open order) per product, in ledger units
    const spare = {};
    Object.keys(work).forEach((k) => { const [pid, u] = k.split('|'); const n = work[k].reduce((a, l) => a + l.n, 0); if (n > 0) (spare[pid] = spare[pid] || {})[u] = n; });
    const stockL = {};
    bal.rows.forEach((r) => { (stockL[r.product_id] = stockL[r.product_id] || {}); stockL[r.product_id][r.unit] = (stockL[r.product_id][r.unit] || 0) + Number(r.n); });
    const demand = Object.values(dem).map((g) => {
      const p = P[g.productId] || {};
      const shown = Object.keys(g.units).sort((a, b) => g.units[b] - g.units[a])[0] || '';
      const ku = g.ku, f = shown === '箱' && ku !== '箱' && p.pack_size ? p.pack_size : 1;
      const have = (stockL[g.productId] || {})[ku] || 0;
      return {
        key: g.productId + '|' + ku, productId: g.productId, name: (p.name || g.name), unit: shown, f, baseUnit: ku, needPack: ku === '箱',
        need: Math.ceil(g.needL / f), stock: Math.floor(have / f), make: Math.ceil(g.shortL / f), makeL: g.shortL,
        earliest: g.earliest, tasks: g.tasks,
      };
    }).sort((a, b) => (b.make > 0) - (a.make > 0) || String(a.earliest || '9').localeCompare(String(b.earliest || '9')) || a.name.localeCompare(b.name, 'zh-Hant'));
    const last = {};
    lastLots.rows.forEach((r) => { const a = last[r.product_id] = last[r.product_id] || []; if (a.length < 4) a.push(r.lot); });
    const { driverPin, ...c } = cfg;
    res.json({
      rev: Number(rev.rows[0].value), today, now: new Date().toISOString(),
      cfg: { people: c.people || [], drivers: driversOf(c), cats: c.cats || {}, varieties: c.varieties || {}, shelfMonths: c.shelfMonths || 24,
        aliases: c.aliases || { p: {}, c: {} }, lineReady: !!process.env.LINE_CHANNEL_SECRET, driverPinSet: !!driverPin },
      products: products.rows.map((p) => ({ id: p.id, name: p.name, cat: p.cat, variety: p.variety, code: p.code, active: p.active, packSize: p.pack_size, baseUnit: p.base_unit, noLot: !!p.no_lot, components: p.components || [] })),
      customers: customers.rows,
      history: history.rows.map((h) => [h.customer, h.product_id, h.times]),
      open: open.rows.map(rowTask), active: active.rows.map(rowTask),
      cover, demand, spare,
      stock: bal.rows.map((r) => ({ productId: r.product_id, unit: r.unit, lot: r.lot, expiry: r.expiry || '', qty: Number(r.n), at: r.at })),
      makes: makes.rows.map((r) => ({ id: r.id, productId: r.product_id, name: r.product_name, unit: r.unit, lot: r.lot, expiry: r.expiry, qty: r.qty, operator: r.operator, at: r.created_at })),
      lastLots: last,
      lineInbox: inbox.rows.map((r) => ({ id: r.id, text: r.text, at: r.sent_at })),
      photos: photos.rows.map((r) => r.id),
    });
  }));

  /* ---------- 生產台：做好一批 → 入庫 ---------- */
  async function nextSeqAll(client, prefix) {
    let n = await nextSeq(client, prefix);
    const { rows } = await client.query(`SELECT DISTINCT lot FROM stock_moves WHERE lot LIKE $1`, [prefix + '-%']);
    const re = new RegExp('^' + prefix + '-([A-Z])$');
    rows.forEach((r) => { const m = re.exec(r.lot || ''); if (m) n = Math.max(n, m[1].charCodeAt(0) - 64); });
    return n;
  }
  app.post('/api/v2/produce', wrap(async (req, res) => {
    const b = req.body || {};
    const operator = str(b.operator, 50), unit = str(b.unit, 4), qty = parseInt(b.qty, 10), pid = parseInt(b.productId, 10);
    if (!operator) throw new UserError('請先點選操作人');
    if (unit && !UNITS.includes(unit)) throw new UserError('單位只能是桶、箱或瓶');
    if (!qty || qty < 1 || qty > 100000) throw new UserError('請輸入做出來的數量');
    const expIn = str(b.expiry, 10);
    if (expIn && !isDate(expIn)) throw new UserError('有效日期格式不對');
    let pack = null;
    if (b.pack) { const s = parseInt(b.pack.size, 10), base = str(b.pack.base, 4); if (!(s >= 2 && s <= 1000) || !['桶', '瓶'].includes(base)) throw new UserError('一箱的入數要填 2 以上的數字，並選桶或瓶'); pack = { size: s, base }; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: pr } = await client.query('SELECT * FROM products WHERE id=$1', [pid]);
      const p = pr[0];
      if (!p) throw new UserError('找不到這個品項');
      const cfg = await getConfig(client);
      let lot, note = '生產入庫';
      const comps = p.components || [];
      if (p.no_lot) lot = NO_LOT;
      else if (comps.length) {
        const given = Array.isArray(b.comps) ? b.comps : [];
        const { rows: cp } = await client.query('SELECT id, name FROM products WHERE id = ANY($1::int[])', [comps]);
        const parts = comps.map((cid) => {
          const g = given.find((x) => +x.productId === cid) || {}, l = str(g.lot, 30).toUpperCase().replace(/\s/g, '');
          const nm = (cp.find((x) => x.id === cid) || {}).name || ('品項 ' + cid);
          if (!LOT_RE.test(l)) throw new UserError('請填「' + nm + '」的批號');
          return { nm, l };
        });
        lot = parts.map((x) => x.l).join('／');
        note = '禮盒入庫：' + parts.map((x) => x.nm + ' ' + x.l).join('、');
      } else if (cfg.cats[p.cat] && isAuto(cfg, p.cat)) {
        const prefix = lotPrefix(cfg, { cat: p.cat, variety: p.variety });
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);
        const n = await nextSeqAll(client, prefix);
        if (n > 25) throw new UserError('這個月這個品種的批次已用到 Z');
        lot = prefix + '-' + String.fromCharCode(65 + n);
      } else {
        lot = str(b.lot, 30).toUpperCase().replace(/\s/g, '');
        if (!LOT_RE.test(lot)) throw new UserError('批號格式不對（英文與數字，例如 HP111-A 或 HS0913B-F）');
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['stock' + pid]);
      const L = await toLedger(client, pid, unit, qty, pack);
      const dup = await client.query(`SELECT 1 FROM stock_moves WHERE product_id=$1 AND lot=$2 AND qty=$3 AND kind='make' AND created_at > now() - interval '15 seconds'`, [pid, lot, L.qty]);
      if (dup.rowCount) throw new UserError('這一批剛剛已經入庫了');
      const expiry = expIn || await defaultExpiry(client);
      await client.query(
        `INSERT INTO stock_moves (product_id, product_name, unit, lot, expiry, qty, kind, operator, note) VALUES ($1,$2,$3,$4,$5,$6,'make',$7,$8)`,
        [pid, p.name, L.unit, lot, expiry, L.qty, operator, note]);
      await bump(client);
      await client.query('COMMIT');
      res.json({ ok: true, lot, expiry, qty, unit });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }));

  // undo a production entry made in the last 30 minutes (typo in lot or quantity), only if nothing was shipped from it
  app.post('/api/v2/produce/:id/undo', wrap(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT * FROM stock_moves WHERE id=$1 AND kind='make' FOR UPDATE`, [req.params.id]);
      const m = rows[0];
      if (!m) throw new UserError('找不到這筆入庫紀錄');
      if (Date.now() - new Date(m.created_at).getTime() > 30 * 60000) throw new UserError('超過 30 分鐘，請到舊看板用「庫存調整」修正');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['stock' + m.product_id]);
      const { rows: b } = await client.query(`SELECT COALESCE(SUM(qty),0)::int AS n FROM stock_moves WHERE product_id=$1 AND unit=$2 AND lot=$3 AND expiry=$4`, [m.product_id, m.unit, m.lot, m.expiry]);
      if (b[0].n < m.qty) throw new UserError('這一批已經有貨出出去了，不能撤銷');
      await client.query(`DELETE FROM stock_moves WHERE id=$1`, [m.id]);
      await bump(client);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }));

  /* ---------- 出貨台：確認備貨（從庫存配批號，先到期先出） ---------- */
  app.post('/api/v2/ship', wrap(async (req, res) => {
    const b = req.body || {};
    const operator = str(b.operator, 50);
    if (!operator) throw new UserError('請先點選你是誰');
    const ids = [...new Set((Array.isArray(b.taskIds) ? b.taskIds : []).map((x) => parseInt(x, 10)).filter(Boolean))].slice(0, 60);
    if (!ids.length) throw new UserError('沒有選到要備貨的品項');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: ts } = await client.query(`SELECT * FROM tasks WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [ids]);
      if (ts.length !== ids.length || ts.some((t) => t.status !== 'open')) throw new UserError('有品項已經備好或取消了，請重新整理');
      const pids = [...new Set(ts.map((t) => t.product_id))].sort((a, b) => a - b);
      for (const pid of pids) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['stock' + pid]);
      const { rows: pr } = await client.query('SELECT id, pack_size, base_unit FROM products WHERE id = ANY($1::int[])', [pids]);
      const P = {}; pr.forEach((p) => { P[p.id] = p; });
      const { rows: bal } = await client.query(`SELECT product_id, unit, lot, expiry, SUM(qty)::int AS n FROM stock_moves WHERE product_id = ANY($1::int[])
        GROUP BY product_id, unit, lot, expiry HAVING SUM(qty) > 0 ORDER BY (expiry=''), expiry, MIN(created_at)`, [pids]);
      const lm = lotsMap(bal);
      const short = [];
      for (const t of ts.slice().sort(byShip)) {
        const L = ledgerOf(P[t.product_id], t.unit), key = t.product_id + '|' + L.ku;
        const r = take(lm[key] || [], t.qty, L.f);
        if (r.got < t.qty) { short.push(t.customer + ' ' + t.product_name + ' 還缺 ' + (t.qty - r.got) + (t.unit || '')); continue; }
        await client.query(
          `UPDATE tasks SET status='done', lot=$1, completed_at=now(), operator=$2, ordered_qty=COALESCE(ordered_qty, qty), from_stock=TRUE, use_stock=FALSE, ship_lots=$3 WHERE id=$4`,
          [[...new Set(r.lots.map((x) => x.lot))].join('、'), operator, JSON.stringify(r.lots), t.id]);
        for (const x of r.lots) {
          await client.query(
            `INSERT INTO stock_moves (product_id, product_name, unit, lot, expiry, qty, kind, task_id, customer, operator, note)
             VALUES ($1,$2,$3,$4,$5,$6,'use',$7,$8,$9,'出貨備貨')`,
            [t.product_id, t.product_name, L.ku, x.lot, x.expiry, -x.qty * L.f, t.id, t.customer, operator]);
        }
      }
      if (short.length) throw new UserError('庫存不夠：' + short.join('；') + '。請等生產台入庫後再備貨');
      await bump(client);
      await client.query('COMMIT');
      res.json({ ok: true, count: ts.length });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }));

  // put a prepared line back into stock (wrong item picked / customer changed the order) — only before the driver takes it
  app.post('/api/v2/unship/:id', wrap(async (req, res) => {
    const operator = str((req.body || {}).operator, 50);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT * FROM tasks WHERE id=$1 FOR UPDATE`, [req.params.id]);
      const t = rows[0];
      if (!t || t.status !== 'done' || !t.from_stock) throw new UserError('只有從庫存備好的貨可以退回');
      if (t.delivery_status) throw new UserError('這筆已經送出或交貨了，不能退回');
      if (t.trip_driver) throw new UserError('司機 ' + t.trip_driver + ' 已經帶走這筆貨，請司機先放回');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['stock' + t.product_id]);
      const { rows: mv } = await client.query(`SELECT unit, lot, expiry, SUM(qty)::int AS n FROM stock_moves WHERE task_id=$1 AND kind IN ('use','return') GROUP BY unit, lot, expiry HAVING SUM(qty) <> 0`, [t.id]);
      for (const m of mv) {
        await client.query(
          `INSERT INTO stock_moves (product_id, product_name, unit, lot, expiry, qty, kind, task_id, customer, operator, note)
           VALUES ($1,$2,$3,$4,$5,$6,'return',$7,$8,$9,'取消備貨，退回庫存')`,
          [t.product_id, t.product_name, m.unit, m.lot, m.expiry, -m.n, t.id, t.customer, operator]);
      }
      await client.query(`UPDATE tasks SET status='open', lot=NULL, completed_at=NULL, operator=NULL, from_stock=FALSE, ship_lots='[]' WHERE id=$1`, [t.id]);
      await bump(client);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }));

  /* ---------- 簽收照片：司機送達時拍一張，存 90 天 ---------- */
  dRoute('post', '/photo', async (req, res) => {
    const b = req.body || {}, driver = str(b.driver, 20);
    const ids = (Array.isArray(b.taskIds) ? b.taskIds : []).map((x) => parseInt(x, 10)).filter(Boolean).slice(0, 50);
    if (!driversOf(req.cfg).includes(driver)) throw new UserError('請先選擇司機');
    if (!ids.length) throw new UserError('沒有對應的貨');
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.img || ''));
    if (!m) throw new UserError('照片格式不對');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 1000 || buf.length > 900000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new UserError('照片太大或格式不對');
    const { rows } = await pool.query(`SELECT DISTINCT customer FROM tasks WHERE id = ANY($1::int[]) AND ship_method='公司配送'`, [ids]);
    if (!rows.length) throw new UserError('找不到這些貨');
    await pool.query(`INSERT INTO delivery_photos (task_ids, customer, driver, img) VALUES ($1,$2,$3,$4)`, [ids, rows[0].customer, driver, buf]);
    await pool.query(`DELETE FROM delivery_photos WHERE created_at < now() - interval '90 days'`);
    await bump();
    res.json({ ok: true });
  });
  app.get('/api/v2/photo/:taskId', wrap(async (req, res) => {
    const { rows } = await pool.query(`SELECT img, created_at, driver FROM delivery_photos WHERE $1 = ANY(task_ids) ORDER BY id DESC LIMIT 1`, [parseInt(req.params.taskId, 10) || 0]);
    if (!rows[0]) return res.status(404).json({ error: '沒有照片' });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(rows[0].img);
  }));
};
