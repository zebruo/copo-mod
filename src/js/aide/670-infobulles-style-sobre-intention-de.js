// ---------- infobulles : style sobre, intention de survol (~250 ms après l'arrêt de la souris), disparition immédiate, enchaînement sans délai ----------
/*@donnee tips*/
(function tipInit() {
  const tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  let cur = null, timer = 0, lastHide = 0, lx = 0, ly = 0, lt = 0, shown = false;
  const conv = el => { if (!el.getAttribute || el.closest('svg') && el.tagName !== 'svg') return; const t = el.getAttribute('title'); if (!t) return; const O = trAOrig.get(el), S2 = trASet.get(el) || {}; el.dataset.tip = O && O.title && S2.title === t ? O.title : t; el.removeAttribute('title'); };
  const tipsApply = root => { for (const sel in TIPS) { const L = root.querySelectorAll ? [...root.querySelectorAll(sel)] : []; if (root.matches && root.matches(sel)) L.push(root); for (const m of L) { if (m.closest('.menu, .mdrop')) continue; const host = m.closest('label') || m; if (!host.dataset.tip && !host.hasAttribute('title')) host.dataset.tip = TIPS[sel]; } } }; // infobulles des réglages sans title, posées comme un title
  document.querySelectorAll('[title]').forEach(conv); tipsApply(document);
  new MutationObserver(recs => { for (const r of recs) { if (r.type === 'attributes') conv(r.target); else r.addedNodes.forEach(n => { if (n.nodeType !== 1) return; conv(n); n.querySelectorAll && n.querySelectorAll('[title]').forEach(conv); tipsApply(n); }); } }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
  const textOf = el => { const t = el.getAttribute('title'); if (t) { const O = trAOrig.get(el), S2 = trASet.get(el) || {}; el.dataset.tip = O && O.title && S2.title === t ? O.title : t; el.removeAttribute('title'); } const v = el.dataset.tip || ''; return v && trOn() ? disp(v) : v; }; // texte source gardé en français, traduit à l'affichage
  const target = n => { const e0 = n && n.nodeType === 1 ? n : n && n.parentElement; if (e0 && e0.closest && e0.closest('.tipw')) return null; for (let e = n; e && e !== document.body; e = e.parentElement) { if (e.nodeType !== 1) continue; if (e.hasAttribute('title') || e.dataset.tip) return e; if (e.tagName === 'BUTTON' && !e.dataset.tip && !e.textContent.trim() && e.getAttribute('aria-label')) { e.dataset.tip = e.getAttribute('aria-label'); return e; } }
    return null; };
/*@donnee gl*/
  const glK = new Map(); for (const [f, e, df, de] of GL) { for (const k of f) glK.set(k.toLowerCase(), [df, de]); for (const k of e) glK.set(k.toLowerCase(), [df, de]); }
  const glRe = new RegExp('(?<![A-Za-zÀ-ÿŒœ0-9-])(?:' + [...glK.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?:s|es)?(?![A-Za-zÀ-ÿŒœ0-9-])', 'gi');
  let gl = null, glT = 0, glX = -1, glY = -1;
  // mot du glossaire sous le pointeur : texte simple seulement (pas dans un champ, un menu, la vue 2D ni la 3D)
  const glAt = (x, y) => { const el = document.elementFromPoint(x, y); if (!el || !el.closest || el.closest('input, textarea, select, canvas, svg, code, .menu, .mdrop, #tip, [data-notr], #gcOut')) return null;
    let node, off; if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; off = p.offset; } else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; off = r.startOffset; } else return null;
    if (!node || node.nodeType !== 3 || !el.contains(node)) return null; const t = node.data.replace(/'/g, '’'); glRe.lastIndex = 0; let m;
    while ((m = glRe.exec(t))) { if (m.index > off) break; if (off > m.index + m[0].length) continue; const g = document.createRange(); g.setStart(node, m.index); g.setEnd(node, m.index + m[0].length);
      for (const rc of g.getClientRects()) if (x >= rc.left - 1 && x <= rc.right + 1 && y >= rc.top - 1 && y <= rc.bottom + 1) { const k = m[0].toLowerCase(), d = glK.get(k) || glK.get(k.replace(/e?s$/, '')) || glK.get(k.replace(/s$/, '')); return d ? { node, i: m.index, rect: rc, txt: d[LANG === 'en' ? 1 : 0] } : null; }
      return null; } return null; };
  const glShow = g => { tip.textContent = g.txt; tip.hidden = false; shown = true; const r = g.rect, w = tip.offsetWidth, h = tip.offsetHeight; let x = r.left + r.width / 2 - w / 2, y = r.bottom + 6; if (y + h > innerHeight - 4) y = r.top - h - 6; x = Math.max(6, Math.min(x, innerWidth - w - 6)); tip.style.left = x + 'px'; tip.style.top = Math.max(4, y) + 'px'; };
  const glMove = e => { if (Math.abs(e.clientX - glX) < 2 && Math.abs(e.clientY - glY) < 2) return; glX = e.clientX; glY = e.clientY; const g = glAt(e.clientX, e.clientY);
    if (gl && g && g.node === gl.node && g.i === gl.i) return; if (gl) { clearTimeout(glT); if (shown) { lastHide = performance.now(); shown = false; tip.hidden = true; } } gl = g; if (g) glT = setTimeout(() => { if (gl === g) glShow(g); }, performance.now() - lastHide < 700 ? 60 : 350); };
  const hide = () => { clearTimeout(timer); timer = 0; clearTimeout(glT); gl = null; if (shown) lastHide = performance.now(); shown = false; tip.hidden = true; };
  const place = el => {
    const txt = textOf(el); if (!txt) return; tip.textContent = txt; tip.hidden = false; shown = true;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight; let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
    if (y + h > innerHeight - 4) y = r.top - h - 8; x = Math.max(6, Math.min(x, innerWidth - w - 6)); tip.style.left = x + 'px'; tip.style.top = Math.max(4, y) + 'px';
  };
  const arm = () => { clearTimeout(timer); const warm = performance.now() - lastHide < 700; timer = setTimeout(() => { if (cur && cur.isConnected) place(cur); }, warm ? 60 : 260); };
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return; const el = target(e.target);
    if (el === cur) return; hide(); cur = el; if (el) { textOf(el); lx = e.clientX; ly = e.clientY; lt = performance.now(); arm(); }
  }, true);
  document.addEventListener('pointermove', e => { // le décompte ne repart que si la souris ralentit sur l'élément
    if (!cur && e.pointerType !== 'touch') { const u = document.elementFromPoint(e.clientX, e.clientY), el = u && u.closest && u.closest(':disabled, [aria-disabled="true"]') && target(u); if (el) { cur = el; lx = e.clientX; ly = e.clientY; lt = performance.now(); arm(); return; } }
    else if (cur && cur.matches && cur.matches(':disabled') && !cur.contains(document.elementFromPoint(e.clientX, e.clientY))) { hide(); cur = null; return; }
    if (!cur) { if (e.pointerType !== 'touch') glMove(e); return; } if (shown) return; const now = performance.now(), dt = Math.max(1, now - lt), v = Math.hypot(e.clientX - lx, e.clientY - ly) / dt; lx = e.clientX; ly = e.clientY; lt = now;
    if (v > 0.35 && performance.now() - lastHide >= 700) arm();
  }, true);
  document.addEventListener('pointerout', e => { if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) { hide(); cur = null; } else if (gl && !e.relatedTarget) hide(); }, true);
  document.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') return; const u = document.elementFromPoint(e.clientX, e.clientY); if (!u || u.closest('button, a, input, select, textarea, label, summary')) return; const g = glAt(e.clientX, e.clientY); if (!g) return; setTimeout(() => { gl = g; glShow(g); clearTimeout(glT); glT = setTimeout(hide, 4000); }, 0); }, true); // au toucher : la définition reste 4 s
  ['pointerdown', 'wheel', 'keydown', 'blur'].forEach(ev => window.addEventListener(ev, () => { hide(); }, true));
  document.addEventListener('scroll', hide, true);
})();

