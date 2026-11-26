// Folio desktop: resizable and hideable side panels (pages/bookmarks on the left, properties/comments on the right)
(function () {
  const $ = (id) => document.getElementById(id);
  const side = $('side'), panel = $('panel'), bSide = $('bSide');
  if (!side || !panel || !bSide) return;
  const desktop = () => !window.matchMedia('(max-width:760px)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('folio.layout.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('folio.layout.' + k, JSON.stringify(v)); } catch {} },
  };
  const root = document.documentElement;
  const LIM = { side: [190, 480, 220], panel: [220, 560, 252] };
  const setW = (which, w) => {
    const [lo, hi] = LIM[which];
    w = Math.round(Math.max(lo, Math.min(hi, w)));
    root.style.setProperty('--' + which + '-w', w + 'px');
    return w;
  };
  setW('side', store.get('side', LIM.side[2]));
  setW('panel', store.get('panel', LIM.panel[2]));
  const relayout = () => window.dispatchEvent(new Event('resize'));

  // --- right panel toggle button, next to the left one ---
  const bPanel = document.createElement('button');
  bPanel.className = 'btn ib';
  bPanel.id = 'bPanel';
  bPanel.title = 'Show or hide Properties & Comments';
  bPanel.innerHTML = bSide.innerHTML;
  bPanel.style.transform = 'scaleX(-1)';
  bSide.after(bPanel);
  bSide.title = 'Show or hide Pages & Bookmarks';
  const syncBtns = () => {
    bSide.classList.toggle('on', !side.classList.contains('hide'));
    bPanel.classList.toggle('on', !document.body.classList.contains('nopanel'));
  };
  const setPanel = (show) => {
    document.body.classList.toggle('nopanel', !show);
    store.set('panelHidden', !show);
    syncBtns(); relayout();
  };
  bPanel.onclick = () => {
    if (!desktop()) { panel.classList.toggle('open'); return; }
    setPanel(document.body.classList.contains('nopanel'));
  };
  if (store.get('panelHidden', false)) document.body.classList.add('nopanel');

  // remember the left panel's shown/hidden state (the app toggles the 'hide' class itself)
  if (store.get('sideHidden', false) && desktop()) side.classList.add('hide');
  new MutationObserver(() => {
    if (desktop()) store.set('sideHidden', side.classList.contains('hide'));
    syncBtns();
  }).observe(side, { attributes: true, attributeFilter: ['class'] });
  bSide.addEventListener('click', () => setTimeout(relayout, 0));

  // --- drag handles ---
  const grip = (which, el, after) => {
    const g = document.createElement('div');
    g.className = 'fgrip fgrip-' + which;
    g.title = 'Drag to resize · double-click to hide';
    after ? el.after(g) : el.before(g);
    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w0 = el.getBoundingClientRect().width;
      document.body.classList.add('fresizing');
      let w = w0;
      const move = (ev) => { w = setW(which, which === 'side' ? w0 + (ev.clientX - x0) : w0 - (ev.clientX - x0)); };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        document.body.classList.remove('fresizing');
        store.set(which, w);
        relayout();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    g.addEventListener('dblclick', () => {
      if (which === 'side') { side.classList.add('hide'); relayout(); }
      else setPanel(false);
    });
  };
  grip('side', side, true);
  grip('panel', panel, false);

  // Ctrl+[ and Ctrl+] toggle the panels
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (e.key === '[') { e.preventDefault(); bSide.click(); }
    else if (e.key === ']') { e.preventDefault(); bPanel.click(); }
  });
  syncBtns();
})();
