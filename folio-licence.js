// Folio desktop: licence codes. The lock screen, the Licence window (Tools ▸ Licence…) and, for an
// administrator, making codes for other people. Codes are checked by the app itself (src-tauri/src/licence.rs).
(function () {
  const T = window.__TAURI__;
  // the desktop app checks codes in Rust; on phones and in the browser folio-web-licence.js answers instead
  const DESKTOP = !!(T && T.core);
  if (!DESKTOP && !window.__folioWebInvoke) return;
  const invoke = DESKTOP ? T.core.invoke : window.__folioWebInvoke;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => (window.__folioToast ? window.__folioToast(m) : console.log(m));
  const niceDate = (iso) => { if (!iso) return 'never'; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('folio.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('folio.' + k, JSON.stringify(v)); } catch {} },
  };

  const css = document.createElement('style');
  css.textContent = `
#folioLock{position:fixed;inset:0;z-index:100000;background:linear-gradient(160deg,#0b3954,#00557d 55%,#0e7490);display:grid;place-items:center;font:14px Inter,system-ui,sans-serif;color:#0f172a}
#folioLock .flcard{text-align:left;background:#fff;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.35);width:min(520px,92vw);padding:30px 30px 24px}
#folioLock h1{font-size:22px;margin:14px 0 6px} #folioLock p{color:#475569;margin:0 0 16px;line-height:1.5}
#folioLock .logo{width:44px;height:44px;border-radius:12px;background:#00557d;display:grid;place-items:center;color:#fff;font-weight:800;font-size:20px}
.flic textarea{width:100%;box-sizing:border-box;min-height:92px;font:13px/1.45 ui-monospace,Consolas,monospace;border:1px solid #cbd5e1;border-radius:10px;padding:10px;resize:vertical;word-break:break-all}
.flic .err{color:#b91c1c;font-size:13px;min-height:18px;margin:8px 0 0}
.flic .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;align-items:center}
.flic button{font:inherit;font-weight:600;border-radius:9px;padding:9px 16px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#0f172a}
.flic button.pri{background:#00557d;border-color:#00557d;color:#fff} .flic button:disabled{opacity:.5;cursor:default}
.flic small{color:#64748b}
#toast{z-index:100001!important}
#folioLicDlg{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.45);display:grid;place-items:center;font:14px Inter,system-ui,sans-serif;color:#0f172a}
#folioLicDlg .flcard{text-align:left;background:#fff;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.3);width:min(640px,94vw);max-height:90vh;overflow:auto;padding:24px}
#folioLicDlg h2{font-size:18px;margin:0 0 12px} #folioLicDlg h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:22px 0 10px}
#folioLicDlg .kv{display:grid;grid-template-columns:120px 1fr;gap:6px 12px;font-size:13.5px} #folioLicDlg .kv b{font-weight:600;color:#475569}
#folioLicDlg .tf{display:grid;grid-template-columns:120px 1fr;gap:10px 12px;align-items:center}
#folioLicDlg input[type=text],#folioLicDlg input[type=date]{font:inherit;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;width:100%;box-sizing:border-box}
#folioLicDlg .out{margin-top:12px;background:#f1f5f9;border-radius:10px;padding:10px;font:12.5px/1.45 ui-monospace,Consolas,monospace;word-break:break-all}
#folioLicDlg table{width:100%;border-collapse:collapse;font-size:12.5px} #folioLicDlg td,#folioLicDlg th{text-align:left;padding:6px 6px;border-bottom:1px solid #e2e8f0}
#folioLicDlg th{color:#64748b;font-weight:600} #folioLicDlg td button{padding:3px 8px;font-size:12px}
#folioLicDlg .note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 10px;font-size:12.5px;margin-top:10px}
`;
  document.head.appendChild(css);

  let status = null;
  const setStatus = (s) => {
    status = s;
    window.__folioLicence = s && s.state === 'ok' && s.licence ? s.licence : null;
    // the editor turns licence extras (compiler, engineering stamps) and team favourites on from this
    try { window.dispatchEvent(new CustomEvent('folio-licence', { detail: window.__folioLicence })); } catch {}
  };
  // the Compiler button in the top bar shows only for licences that include it
  const syncCompiler = () => { const b = document.getElementById('bCompiler'); const l = window.__folioLicence; if (b) b.style.display = DESKTOP && l && l.extras.includes('compiler') ? '' : 'none'; };
  window.addEventListener('folio-licence', syncCompiler);
  document.addEventListener('DOMContentLoaded', syncCompiler);
  const EXTRAS = [['compiler', 'Report & datasheet compiler'], ['engineering-stamps', 'Engineering stamps (FAT passed/failed, witnessed, as built)']];

  // ---------- lock screen ----------
  function lock(s) {
    const old = document.getElementById('folioLock'); if (old) old.remove();
    const d = document.createElement('div');
    d.id = 'folioLock';
    d.className = 'flic';
    const why = s.state === 'missing' ? `Paste the licence code you were given. You only need to do this once on this ${DESKTOP ? 'PC' : 'device'}.` : s.state === 'invalid' ? 'The saved licence code is not valid. Enter a new one.' : s.message;
    const offline = s.state === 'offline';
    d.innerHTML = `<div class="flcard"><div class="logo">F</div><h1>Activate Folio</h1><p>${esc(why)}</p>
      ${offline ? `<div class="row" style="justify-content:flex-start;margin:0 0 16px"><button class="pri" data-retry>Try again</button></div><p style="margin-bottom:8px">Or enter a different code:</p>` : ''}
      <textarea spellcheck="false" placeholder="FOLIO-…"></textarea><div class="err"></div>
      <div class="row"><small style="margin-right:auto">Need a code? Ask your Folio administrator.</small><button class="${offline ? '' : 'pri'}" data-go>Activate</button></div></div>`;
    document.body.appendChild(d);
    const ta = d.querySelector('textarea'), err = d.querySelector('.err'), go = d.querySelector('[data-go]');
    setTimeout(() => ta.focus(), 50);
    const activate = async () => {
      go.disabled = true; err.textContent = '';
      try {
        const st = await invoke('licence_activate', { code: ta.value });
        setStatus(st); d.remove();
        toast(`Welcome, ${st.licence.name}. Folio is activated${st.licence.expires ? ' until ' + niceDate(st.licence.expires) : ''}.`);
        // Files Folio was asked to open before it was activated: ask Windows to hand them over again
        setTimeout(() => location.reload(), 1200);
      } catch (e) { err.textContent = String(e); go.disabled = false; }
    };
    go.onclick = activate;
    const retry = d.querySelector('[data-retry]');
    if (retry) retry.onclick = async () => {
      retry.disabled = true; err.textContent = '';
      const st = await invoke('licence_refresh').catch((e) => ({ state: 'offline', message: String(e) }));
      setStatus(st);
      if (st.state === 'ok') { d.remove(); toast('Licence checked. Thanks!'); setTimeout(() => location.reload(), 1000); }
      else { err.textContent = st.message; retry.disabled = false; }
    };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); activate(); } });
    // keep keyboard shortcuts from reaching the editor underneath
    d.addEventListener('keydown', (e) => e.stopPropagation());
  }

  // ---------- the Licence window ----------
  async function dialog() {
    const s = await invoke('licence_status'); setStatus(s);
    const l = s.licence;
    // making, cancelling and renewing codes needs the signing key, so it's only in the desktop app
    const admin = DESKTOP && s.state === 'ok' && l && l.role === 'admin';
    const box = document.createElement('div');
    box.id = 'folioLicDlg'; box.className = 'flic';
    const in12 = new Date(); in12.setFullYear(in12.getFullYear() + 1);
    const iso = (d) => d.toISOString().slice(0, 10);
    box.innerHTML = `<div class="flcard"><h2>Folio licence</h2>
      <div class="kv"><b>Licensed to</b><span>${esc(l ? l.name : '—')}</span>
        <b>Organisation</b><span>${esc(l ? l.org : '—')}</span>
        <b>Extras</b><span>${l ? (l.extras.length ? esc(l.extras.map((x) => (EXTRAS.find((e) => e[0] === x) || [x, x])[1]).join(', ')) : 'none') : '—'}</span>
        <b>Type</b><span>${l ? (l.role === 'admin' ? 'Administrator' : 'User') : '—'}</span>
        <b>Expires</b><span>${l ? esc(niceDate(l.expires)) + (s.days_left != null ? ` <small>(${s.days_left} day${s.days_left === 1 ? '' : 's'} left)</small>` : '') : '—'}</span>
        <b>Code ID</b><span>${esc(l ? l.id : '—')}</span>
        <b>Checked online</b><span>${esc(s.checked ? niceDate(s.checked) : 'not yet')}</span></div>
      <h3>Use a different code</h3>
      <textarea spellcheck="false" placeholder="FOLIO-…" data-new style="min-height:64px"></textarea><div class="err" data-err1></div>
      <div class="row" style="margin-top:6px"><button data-change>Use this code</button></div>
      ${admin ? `<h3>Make a licence code</h3>
      <div data-keyinfo class="hint"></div>
      <div class="tf" style="margin-top:10px">
        <label>Name</label><input type="text" data-name maxlength="60" placeholder="e.g. Sam Taylor">
        <label>Organisation</label><div><input type="text" data-org maxlength="50" list="flOrgs" placeholder="Company name, or the person's name if they're on their own"><datalist id="flOrgs"></datalist><small>People in the same organisation share its team favourites.</small></div>
        <label>Extras</label><div data-extras>${EXTRAS.map(([k, t]) => `<label style="display:block"><input type="checkbox" value="${k}"> ${esc(t)}</label>`).join('')}</div>
        <label>Expires</label><div style="display:flex;gap:12px;align-items:center"><input type="date" data-exp value="${iso(in12)}" min="${iso(new Date(Date.now() + 864e5))}" style="width:180px"><label><input type="checkbox" data-never> Never</label></div>
        <label>Type</label><div><label><input type="radio" name="flrole" value="user" checked> User</label> &nbsp; <label><input type="radio" name="flrole" value="admin"> Administrator</label></div>
      </div>
      <div class="err" data-err2></div>
      <div class="row"><button class="pri" data-issue>Make code</button></div>
      <div data-out></div>
      <h3>Codes you've made</h3><div data-log></div><div data-backup style="margin-top:6px"></div>
      <h3>Cancel or renew any code</h3><div data-online><small>Checking…</small></div>` : ''}
      <div class="row" style="margin-top:22px"><button data-close class="pri">Close</button></div></div>`;
    document.body.appendChild(box);
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') box.remove(); });
    box.addEventListener('mousedown', (e) => { if (e.target === box) box.remove(); });
    box.querySelector('[data-close]').onclick = () => box.remove();
    box.querySelector('[data-change]').onclick = async () => {
      const err = box.querySelector('[data-err1]'); err.textContent = '';
      try { const st = await invoke('licence_activate', { code: box.querySelector('[data-new]').value }); setStatus(st); box.remove(); toast(`Licence updated: ${st.licence.name}`); dialog(); }
      catch (e) { err.textContent = String(e); }
    };
    if (!admin) return;

    const keyInfo = async () => {
      const el = box.querySelector('[data-keyinfo]');
      const k = await invoke('licence_key_info').catch((e) => ({ problem: String(e) }));
      el.innerHTML = k.problem
        ? `<div class="note">${esc(k.problem)} Making codes needs your signing key file (folio-licence-signing.key). <button data-pickkey>Choose key file…</button></div>`
        : `<small>Signing key: ${esc(k.path)}</small> <button data-pickkey style="padding:3px 8px;font-size:12px">Change…</button>`;
      el.querySelector('[data-pickkey]').onclick = async () => {
        const p = await invoke('pick_open', { multiple: false, filters: [{ name: 'Folio signing key', extensions: ['key', 'txt'] }] });
        if (!p || !p[0]) return;
        try { await invoke('licence_set_key', { path: p[0] }); toast('Signing key ready'); syncRecords(); } catch (e) { toast(String(e)); }
        keyInfo();
      };
    };
    keyInfo();
    const never = box.querySelector('[data-never]'), exp = box.querySelector('[data-exp]');
    // organisation: suggest ones used before, and tick the extras that organisation had last time
    const orgIn = box.querySelector('[data-org]'), orgExtras = store.get('orgExtras', {});
    const setExtras = (list) => box.querySelectorAll('[data-extras] input').forEach((c) => { c.checked = list.includes(c.value); });
    const orgsUsed = [...new Set([l.org, ...store.get('issuedCodes', []).map((x) => x.org).filter(Boolean)])];
    box.querySelector('#flOrgs').innerHTML = orgsUsed.map((o) => `<option value="${esc(o)}">`).join('');
    orgIn.value = store.get('lastOrg', l.org);
    setExtras(orgExtras[orgIn.value.trim().toLowerCase()] || (orgIn.value.trim() === l.org ? l.extras : []));
    orgIn.oninput = () => { const k = orgIn.value.trim().toLowerCase(); if (orgExtras[k]) setExtras(orgExtras[k]); };
    never.onchange = () => { exp.disabled = never.checked; };

    let online = null; // {connected, list}
    const drawLog = () => {
      const log = store.get('issuedCodes', []);
      const el = box.querySelector('[data-log]');
      const L = online && online.list;
      const st = (x) => { if (!x.id || !L) return ''; if (L.cancelled.includes(x.id)) return '<b style="color:#b91c1c">Cancelled</b>'; return 'Active'; };
      const ex = (x) => { const r = x.id && L && L.renewed[x.id]; return r ? `${esc(r === 'never' ? 'never' : niceDate(r))} <small>(renewed)</small>` : esc(niceDate(x.expires)); };
      const can = online && online.connected;
      el.innerHTML = log.length ? `<table><tr><th>Name</th><th>Organisation</th><th>ID</th><th>Expires</th><th>Status</th><th></th></tr>${log.map((x, i) => `<tr><td>${esc(x.name)}${x.admin ? ' <small>(admin)</small>' : ''}</td><td>${esc(x.org || 'OES Group')}</td><td><small>${esc(x.id || '')}</small></td><td>${ex(x)}</td><td>${st(x)}</td><td style="white-space:nowrap"><button data-copy="${i}">Copy</button>${can && x.id ? (L.cancelled.includes(x.id) ? ` <button data-act="restore" data-id="${x.id}">Restore</button>` : ` <button data-act="renew" data-id="${x.id}">Renew…</button> <button data-act="cancel" data-id="${x.id}" data-name="${esc(x.name)}">Cancel</button>`) : ''}</td></tr>`).join('')}</table>
        <div class="row" style="justify-content:flex-start"><button data-csv>Save list as CSV…</button></div>` : '<small>None yet.</small>';
      el.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = () => { navigator.clipboard.writeText(log[+b.dataset.copy].code); toast('Code copied'); }));
      el.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act, b.dataset.id, b.dataset.name, b)));
      const csv = el.querySelector('[data-csv]');
      if (csv) csv.onclick = async () => {
        const rows = [['Name', 'Organisation', 'Type', 'Extras', 'Expires', 'Made', 'Code']].concat(log.map((x) => [x.name, x.org || 'OES Group', x.admin ? 'Admin' : 'User', (x.extras || ['compiler', 'engineering-stamps']).join(' '), x.expires || 'never', x.made, x.code]));
        const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        try { await window.claude.use('downloads').then((d) => d.save({ filename: 'Folio licence codes.csv', data: new Blob([text], { type: 'text/csv' }) })); } catch (e) { if (!e || e.code !== 'declined') toast('Could not save the list'); }
      };
    };
    drawLog();

    // ---- cancel / renew (published to GitHub as a signed list every copy of Folio checks) ----
    async function act(action, id, name, btn) {
      let date = null;
      if (action === 'renew') {
        date = await askDate(btn);
        if (!date) return;
      }
      if (action === 'cancel' && !confirm(`Cancel ${name ? name + "'s" : 'this'} code (${id})? Folio will stop working for them the next time it checks, within a few hours.`)) return;
      try {
        const list = await invoke('licence_admin_change', { id, action, date });
        online.list = list; drawLog(); drawOnline();
        toast(action === 'cancel' ? `Code ${id} cancelled` : action === 'restore' ? `Code ${id} restored` : `Code ${id} renewed until ${date === 'never' ? 'further notice' : niceDate(date)}`);
      } catch (e) { toast(String(e)); }
    }
    function askDate(anchor) {
      return new Promise((res) => {
        const pop = document.createElement('div');
        const in12 = new Date(); in12.setFullYear(in12.getFullYear() + 1);
        pop.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:12px;display:flex;gap:8px;align-items:center;font:13px Inter,system-ui,sans-serif';
        const r = anchor.getBoundingClientRect(); pop.style.top = r.bottom + 6 + 'px'; pop.style.left = Math.max(8, r.right - 360) + 'px';
        pop.innerHTML = `New expiry <input type="date" value="${in12.toISOString().slice(0, 10)}" style="font:inherit;border:1px solid #cbd5e1;border-radius:6px;padding:5px"><label><input type="checkbox"> Never</label><button class="pri" style="font:inherit;font-weight:600;border:0;border-radius:7px;padding:6px 12px;background:#00557d;color:#fff;cursor:pointer">Renew</button><button style="font:inherit;border:0;background:none;cursor:pointer">×</button>`;
        document.body.appendChild(pop);
        const [inp, nv] = pop.querySelectorAll('input'); const [ok, x] = pop.querySelectorAll('button');
        const done = (v) => { pop.remove(); res(v); };
        ok.onclick = () => done(nv.checked ? 'never' : inp.value || null); x.onclick = () => done(null);
        pop.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done(null); });
      });
    }
    async function drawOnline() {
      const el = box.querySelector('[data-online]');
      if (!online) { el.innerHTML = '<small>Checking…</small>'; return; }
      if (!online.connected) {
        el.innerHTML = `<div class="hint" style="font-size:13px;line-height:1.5">To cancel or renew codes, Folio needs permission to update the licence list in your <b>folio-releases</b> GitHub repository. Do this once:<br>
          1. On GitHub: Settings → Developer settings → Fine-grained tokens → <b>Generate new token</b>.<br>
          2. Repository access: <b>Only select repositories → folio-releases</b>. Permissions: <b>Contents → Read and write</b>. Pick a long expiry.<br>
          3. Copy the token and paste it here. It's kept on this PC only.</div>
          <div style="display:flex;gap:8px;margin-top:10px"><input type="password" data-tok placeholder="github_pat_…" style="flex:1"><button class="pri" data-conn>Connect</button></div><div class="err" data-err3></div>`;
        el.querySelector('[data-conn]').onclick = async () => {
          const er = el.querySelector('[data-err3]'); er.textContent = '';
          try { await invoke('licence_set_token', { token: el.querySelector('[data-tok]').value }); await loadOnline(); toast('Connected to GitHub'); }
          catch (e) { er.textContent = String(e); }
        };
        return;
      }
      const L = online.list;
      el.innerHTML = `<small>Connected to GitHub. ${L.cancelled.length} cancelled, ${Object.keys(L.renewed).length} renewed${L.updated ? ', last changed ' + esc(niceDate(L.updated)) : ''}. Use the buttons in the table above, or enter any code ID (shown in each person's Licence window):</small>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><input type="text" data-mid placeholder="Code ID, e.g. 3F09A1C2" maxlength="8" style="width:200px"><button data-m="cancel">Cancel</button><button data-m="restore">Restore</button><button data-m="renew">Renew…</button>
        <span style="flex:1"></span><button data-disc style="font-size:12px;padding:4px 8px">Disconnect</button></div>`;
      el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { const id = el.querySelector('[data-mid]').value.trim(); if (!id) { toast('Enter a code ID'); return; } act(b.dataset.m, id, '', b); }));
      el.querySelector('[data-disc]').onclick = async () => { await invoke('licence_set_token', { token: '' }); await loadOnline(); };
    }
    // the record of codes made is also kept online, encrypted with the signing key, so it survives a lost PC
    let backup = '';
    async function syncRecords() {
      if (!online || !online.connected) return;
      try { const merged = await invoke('licence_records_sync', { local: store.get('issuedCodes', []) }); store.set('issuedCodes', merged); backup = 'ok'; }
      catch (e) { backup = String(e); }
      drawLog(); drawBackup();
    }
    function drawBackup() {
      const el = box.querySelector('[data-backup]'); if (!el) return;
      el.innerHTML = !online || !online.connected ? '' : backup === 'ok'
        ? '<small>\u2713 This list is backed up online, encrypted so only your signing key can read it. On a new PC, connect and choose your key to get it back.</small>'
        : backup ? `<small style="color:#b45309">Online backup not done: ${esc(backup)}</small>` : '<small>Backing up\u2026</small>';
    }
    async function loadOnline() {
      try { online = await invoke('licence_admin_list'); } catch (e) { online = { connected: false, list: { cancelled: [], renewed: {} } }; toast(String(e)); }
      drawLog(); drawOnline(); drawBackup(); syncRecords();
    }
    loadOnline();

    box.querySelector('[data-issue]').onclick = async () => {
      const err = box.querySelector('[data-err2]'); err.textContent = '';
      const name = box.querySelector('[data-name]').value.trim();
      const isAdmin = box.querySelector('input[name=flrole]:checked').value === 'admin';
      const expires = never.checked ? null : exp.value;
      const org = orgIn.value.trim();
      const extras = [...box.querySelectorAll('[data-extras] input:checked')].map((c) => c.value);
      if (!name) { err.textContent = "Enter the person's name"; return; }
      if (!org) { err.textContent = "Enter the organisation (a company, or the person's name if they're on their own)"; return; }
      if (!never.checked && !expires) { err.textContent = 'Choose an expiry date, or tick Never'; return; }
      try {
        const r = await invoke('licence_issue', { name, org, extras, expires, admin: isAdmin }); const code = r.code;
        store.set('lastOrg', org); orgExtras[org.toLowerCase()] = extras; store.set('orgExtras', orgExtras);
        const log = store.get('issuedCodes', []);
        log.unshift({ name, org, extras, admin: isAdmin, expires, made: new Date().toISOString().slice(0, 10), code, id: r.id });
        store.set('issuedCodes', log.slice(0, 500));
        const out = box.querySelector('[data-out]');
        out.innerHTML = `<div class="out">${esc(code)}</div><div class="row" style="justify-content:flex-start"><button class="pri" data-c>Copy code</button><small>Send this to ${esc(name)}. They paste it into Folio when it asks.</small></div>`;
        out.querySelector('[data-c]').onclick = () => { navigator.clipboard.writeText(code); toast('Code copied'); };
        navigator.clipboard.writeText(code).then(() => toast('Code made and copied')).catch(() => {});
        drawLog(); syncRecords();
      } catch (e) { err.textContent = String(e); }
    };
  }
  window.__folioLicenceDialog = dialog;

  // the app checks the cancel/renew list in the background and says when the licence changes
  const onChanged = (e) => {
    const s = e.payload; setStatus(s);
    if (s.state === 'ok') { const d = document.getElementById('folioLock'); if (d) d.remove(); }
    else lock(s);
  };
  if (DESKTOP && T.event && T.event.listen) T.event.listen('licence-changed', onChanged);
  window.addEventListener('folio-licence-changed', (e) => onChanged({ payload: e.detail }));

  // ---------- on start ----------
  invoke('licence_status').then((s) => {
    setStatus(s);
    if (s.state !== 'ok') { lock(s); return; }
    if (s.days_left != null && s.days_left <= 14) {
      setTimeout(() => toast(`Your Folio licence ends ${s.days_left <= 0 ? 'today' : 'in ' + s.days_left + ' day' + (s.days_left === 1 ? '' : 's')}. Ask your administrator for a new code.`), 3000);
    }
  }).catch(() => {});
})();
