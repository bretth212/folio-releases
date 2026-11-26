// Folio on phones and in the browser: the same licence codes as the desktop app, checked here.
// Mirrors src-tauri/src/licence.rs: a code is "FOLIO-" + Crockford base32 of (payload || Ed25519 signature),
// and the signed cancel/renew list (licences.json in folio-releases) is checked online, with 14 days' grace.
// It answers the same commands folio-licence.js sends to the desktop app (licence_status, licence_activate, ...).
(function () {
  if (window.__TAURI__) return;
  const PUBLIC_KEY = new Uint8Array([189, 93, 214, 18, 88, 32, 69, 238, 198, 253, 113, 80, 13, 47, 77, 207, 83, 34, 244, 206, 99, 26, 226, 114, 141, 234, 116, 192, 31, 42, 231, 125]);
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const LIST_URL = 'https://raw.githubusercontent.com/bretth212/folio-releases/main/licences.json';
  const GRACE_DAYS = 14;
  const EXTRAS = [[1, 'compiler'], [2, 'engineering-stamps']];
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
  const get = (k) => { try { return JSON.parse(localStorage.getItem('folio.web.' + k)); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem('folio.web.' + k, JSON.stringify(v)); } catch {} };

  const today = () => Math.floor(Date.now() / 86400000);
  const dayToDate = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  const dateToDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return dayToDate(t / 86400000) === s ? t / 86400000 : null; };
  const slug = (org) => { let o = ''; for (const c of org.trim()) { if (/[A-Za-z0-9]/.test(c)) o += c.toLowerCase(); else if (o && !o.endsWith('-')) o += '-'; } o = o.replace(/-+$/, ''); return o || 'default'; };
  const clean = (code) => { const up = String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); return up.startsWith('FOLIO') ? up.slice(5) : up; };
  function b32decode(s) {
    const out = []; let buf = 0, bits = 0;
    for (let c of s) { c = c === 'O' ? '0' : c === 'I' || c === 'L' ? '1' : c; const v = ALPHABET.indexOf(c); if (v < 0) return null;
      buf = (buf << 5) | v; bits += 5; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); } buf &= (1 << bits) - 1; }
    return new Uint8Array(out);
  }
  const unhex = (h) => /^([0-9a-f]{2})+$/i.test(h || '') ? new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16))) : null;
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  let keyP = null;
  async function verify(msg, sig) {
    if (!crypto.subtle) throw new Error('This browser cannot check Folio licences. Open Folio from its https:// address.');
    try { keyP = keyP || crypto.subtle.importKey('raw', PUBLIC_KEY, { name: 'Ed25519' }, false, ['verify']); return await crypto.subtle.verify({ name: 'Ed25519' }, await keyP, sig, msg); }
    catch (e) { keyP = null; throw new Error('This browser is too old to check Folio licences. Update it (iPhone: iOS 17 or later) and try again.'); }
  }

  const bad = 'That isn’t a valid Folio licence code. Check it was copied in full.';
  async function decode(code) {
    const raw = b32decode(clean(code));
    if (!raw || raw.length < 14 + 1 + 64) throw new Error(bad);
    const payload = raw.slice(0, raw.length - 64), sig = raw.slice(raw.length - 64);
    if (payload[0] !== 1 && payload[0] !== 2) throw new Error('This licence code is for a newer version of Folio. Reload Folio and try again.');
    if (!(await verify(cat(enc.encode('FOLIO-LICENCE-v1'), payload), sig))) throw new Error(bad);
    const u = (i) => (payload[i] | (payload[i + 1] << 8) | (payload[i + 2] << 16) | (payload[i + 3] << 24)) >>> 0;
    let org, bits, rest;
    try {
      if (payload[0] === 1) { org = 'OES Group'; bits = 255; rest = payload.slice(14); }
      else { const n = payload[15]; if (payload.length < 16 + n + 1) throw 0; org = dec.decode(payload.slice(16, 16 + n)); bits = payload[14]; rest = payload.slice(16 + n); }
      return { name: dec.decode(rest), org, org_slug: slug(org), extras: EXTRAS.filter((e) => bits & e[0]).map((e) => e[1]),
        role: payload[1] === 1 ? 'admin' : 'user', issued: dayToDate(u(2)), expires: u(6) ? dayToDate(u(6)) : null,
        id: [...payload.slice(10, 14)].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('') };
    } catch { throw new Error(bad); }
  }
  async function readList(text) {
    const v = JSON.parse(text); const sig = unhex(v && v.sig);
    if (typeof v.list !== 'string' || !sig || sig.length !== 64) throw new Error('bad list');
    if (!(await verify(cat(enc.encode('FOLIO-LIST-v1'), enc.encode(v.list)), sig))) throw new Error('The licence list is not signed by the administrator');
    const l = JSON.parse(v.list); return { cancelled: l.cancelled || [], renewed: l.renewed || {} };
  }

  async function status(codeIn) {
    const code = codeIn === undefined ? get('code') : codeIn;
    const check = get('check') || {};
    const now = today(), checked = check.last_ok != null ? dayToDate(check.last_ok) : null;
    const mk = (state, licence, days_left, message) => ({ state, licence, days_left, message, checked });
    if (!code || !String(code).trim()) return mk('missing', null, null, 'Enter your licence code to use Folio.');
    let l; try { l = await decode(code); } catch (e) { return mk('invalid', null, null, e.message); }
    let list = null; if (check.file) { try { list = await readList(check.file); } catch {} }
    if (list) {
      if (list.cancelled.some((c) => String(c).toUpperCase() === l.id)) return mk('cancelled', l, null, 'This licence code has been cancelled. Ask your administrator for a new one.');
      const r = list.renewed[l.id]; if (r) l.expires = r === 'never' ? null : (dateToDay(r) != null ? r : l.expires);
    }
    const left = l.expires ? dateToDay(l.expires) - now : null;
    if (left != null && left < 0) return mk('expired', l, left, `Your Folio licence ended on ${l.expires}. Ask your administrator to renew it.`);
    if (codeIn === undefined) {
      if (check.last_ok == null) return mk('offline', l, left, 'Folio needs to connect to the internet once to check this licence. Check you’re online, then tap Try again.');
      if (now - check.last_ok > GRACE_DAYS) return mk('offline', l, left, `Folio hasn’t been able to check its licence online for over ${GRACE_DAYS} days. Connect to the internet, then tap Try again.`);
    }
    return mk('ok', l, left, '');
  }
  async function refresh() {
    const r = await fetch(LIST_URL + '?t=' + Date.now(), { cache: 'no-store' });
    let file = null;
    if (r.status === 200) { file = await r.text(); await readList(file); }
    else if (r.status !== 404) throw new Error('The licence server answered ' + r.status);
    put('check', { last_ok: today(), file });
  }

  window.__folioWebInvoke = async function (cmd, a) {
    if (cmd === 'licence_status') return status();
    if (cmd === 'licence_refresh') { try { await refresh(); } catch {} return status(); }
    if (cmd === 'licence_code') return get('code');
    if (cmd === 'licence_remove') { localStorage.removeItem('folio.web.code'); return status(); }
    if (cmd === 'licence_activate') {
      const s = await status(a.code); if (s.state !== 'ok') throw s.message;
      put('code', 'FOLIO-' + clean(a.code));
      let err = null; try { await refresh(); } catch (e) { err = e; }
      const st = await status();
      if (st.state === 'ok') return st;
      throw st.message + (st.state === 'offline' && err ? ` (${err.message || err})` : '');
    }
    throw 'Not available in the phone and browser version of Folio';
  };
  // check the cancel/renew list now and every few hours while Folio is open, and say when the licence changes
  const recheck = async () => {
    const before = JSON.stringify(await status());
    try { await refresh(); } catch { return; }
    const s = await status(); if (JSON.stringify(s) !== before) window.dispatchEvent(new CustomEvent('folio-licence-changed', { detail: s }));
  };
  setTimeout(recheck, 1500); setInterval(recheck, 4 * 3600 * 1000);
})();
