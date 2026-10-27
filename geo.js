'use strict';
/*
 * Free geocoding with OpenStreetMap Nominatim (no key, no card).
 * Usage policy: at most 1 request per second, identify the app, cache results.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const UA = 'ts-production-board/1.0 (TS Beehoney Co., Kaohsiung; production scheduling)';
const BASE = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tw&addressdetails=1&accept-language=zh-TW&limit=3&';

const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/台(北|中|南|東)/g, '臺$1').replace(/^\d{3,6}/, '');
const coreName = (n) => String(n || '').replace(/股份有限公司|有限公司|企業社|企業行|工作室|商行|分公司|總公司|門市|\(.*?\)|（.*?）/g, '').trim();

/* split a Taiwanese address into parts we can feed to Nominatim */
function parseAddr(addr) {
  const a = norm(addr);
  const m = a.match(/^(.{2}[市縣])?(.{1,4}?[區鄉鎮市])?(.*)$/) || [];
  const rest = m[3] || '';
  const road = (rest.match(/^(.*?(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/) || [])[1] || '';
  const num = /[巷弄]/.test(rest) ? '' : (rest.match(/(\d+)(?:之\d+|-\d+)?號/) || [])[1] || '';
  return { city: m[1] || '', dist: m[2] || '', road, num };
}

async function search(params) {
  const r = await fetch(BASE + params, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW' } });
  if (!r.ok) throw new Error('nominatim ' + r.status);
  return r.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;

/* address → coordinates; tries door number, then road, then district. Returns {lat,lng,precision} or null */
async function geocodeAddress(addr) {
  const p = parseAddr(addr);
  const tries = [];
  if (p.road && p.num) tries.push(['q=' + enc(p.road + ' ' + p.num + '號 ' + p.dist + ' ' + p.city), '門牌']);
  if (p.road) tries.push(['q=' + enc([p.road, p.dist, p.city].filter(Boolean).join(', ')), '路段']);
  if (p.dist || p.city) tries.push(['q=' + enc([p.dist, p.city].filter(Boolean).join(', ')), '行政區']);
  for (const [q, precision] of tries) {
    const res = await search(q);
    await sleep(1100);
    const hit = res.find((x) => !p.city || String(x.display_name).includes(p.city));
    if (hit) return { lat: +hit.lat, lng: +hit.lon, precision };
  }
  return null;
}

function addrFrom(a) {
  if (!a) return '';
  const city = a.city || a.county || a.state || '';
  const dist = a.suburb || a.town || a.city_district || a.district || '';
  const road = a.road || '';
  const num = a.house_number ? String(a.house_number).split(/[;,]/)[0] + '號' : '';
  return [city, dist, road, num].join('');
}

/* shop/company name → address candidate. Only accepts results whose name matches the customer's core name. */
async function searchName(name, near) {
  const core = coreName(name);
  if (core.length < 2) return null;
  const res = await search('q=' + enc(core + (near ? ' ' + near : '')));
  await sleep(1100);
  const hit = res.find((x) => { const n = coreName(x.name || ''); return n && (n.includes(core) || core.includes(n)) && Math.min(n.length, core.length) >= 2; });
  if (!hit) return null;
  const address = addrFrom(hit.address);
  if (!address) return null;
  const exact = coreName(hit.name) === core;
  return {
    address, lat: +hit.lat, lng: +hit.lon,
    src: 'OpenStreetMap：' + hit.name + (hit.address && hit.address.house_number ? '' : '（只到路名，門牌待確認）'),
    conf: exact && hit.address && hit.address.house_number ? '中' : '低',
  };
}

module.exports = { geocodeAddress, searchName, parseAddr, coreName };
