// ---------- paramètres (Édition › Paramètres) : rubriques à gauche, contenu qui défile à droite ----------
const relLevel = () => { const v = LS.get('copo.relQ'); return v === 'std' || v === 'fast' ? 0 : v === 'vhigh' ? 2 : 1; }; /* résolution d'affichage du relief : standard, haute (défaut), très haute */
const CFG_ICO = { dlib: '<path d="M5 4v16M9 4v16M13 4v16"/><path d="M16.5 4.5l3.5 15"/>', nav3d: '<path d="M12 3l7 4v8l-7 4-7-4V7z"/><path d="M5 7l7 4 7-4M12 11v8"/><path d="M3 18c3 3.5 15 3.5 18 0"/>', gen: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>', units: '<path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z"/><path d="M7 13l1.8 1.8M10 10l1.8 1.8M13 7l1.8 1.8"/>', machine: '<rect x="4" y="3" width="16" height="7" rx="1"/><path d="M12 10v5M9.5 15h5l-1 3h-3z"/><path d="M3 21h18"/>', snap: '<path d="M5 4v7a7 7 0 0 0 14 0V4"/><path d="M5 8h4M15 8h4"/>', view: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>', sim: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>' };
function cfgFill() {
  $('#cfgWelcome').checked = LS.get('copo.welcomeOff') !== '1'; $('#cfgTips').checked = LS.get('copo.tipsOff') !== '1';
  $('#cfgRelQ').value = ['std', 'high', 'vhigh'][relLevel()]; $('#cfgSimQ').value = $('#v3Q').value || '1'; $('#cfgRelShow').checked = !!(S.relief && S.relief.show !== false);
  $$('#cfg [data-cfgui]').forEach(c => { c.checked = S.ui[c.dataset.cfgui] !== false && !!S.ui[c.dataset.cfgui]; }); snapFill(); langMarks();
}
function cfgSpy() { const b = $('#cfgBody'), secs = $$('#cfgBody .cfg-sec'); let cur = secs[0]; for (const x of secs) if (x.offsetTop - b.offsetTop <= b.scrollTop + 24) cur = x; $$('#cfgNav button').forEach(n => { const on = n.dataset.go === cur.dataset.cfg; if (on && !n.classList.contains('on')) { const nv = n.parentElement; if (nv.scrollWidth > nv.clientWidth) nv.scrollLeft = Math.max(0, n.offsetLeft - nv.clientWidth / 2 + n.offsetWidth / 2); } n.classList.toggle('on', on); }); }
function cfgOpen(sec) {
  closeMenus(); const w = $('#cfg'); cfgFill(); w.hidden = false;
  const b = $('#cfgBody'), t = sec && b.querySelector('[data-cfg="' + sec + '"]'); b.style.scrollBehavior = 'auto'; b.scrollTop = t ? t.offsetTop - b.offsetTop : 0; b.style.scrollBehavior = ''; cfgSpy();
  setTimeout(() => { const f = w.querySelector('.cfg-nav button.on') || w.querySelector('.cfg-nav button'); if (f) f.focus({ preventScroll: true }); }, 0);
}
function cfgClose() { const w = $('#cfg'); if (w && !w.hidden) { w.hidden = true; renderGcode && (gcDirty = true, renderGcode()); } }
function gcPostName() { const el = $('#gcPostName'); if (!el) return; const o = $('#mPost') && $('#mPost').selectedOptions[0]; el.textContent = o ? o.textContent : ''; }
(function cfgInit() {
  const nav = $('#cfgNav'); for (const x of $$('#cfgBody .cfg-sec')) { const b = document.createElement('button'); b.type = 'button'; b.dataset.go = x.dataset.cfg; b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (CFG_ICO[x.dataset.ico] || '') + '</svg><span>' + x.querySelector('h2').textContent + '</span>'; b.onclick = () => { const bd = $('#cfgBody'); bd.scrollTop = x.offsetTop - bd.offsetTop; }; nav.appendChild(b); }
  $('#cfgBody').addEventListener('scroll', () => requestAnimationFrame(cfgSpy));
  $('#cfg').addEventListener('click', e => { if (e.target.id === 'cfg') cfgClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#cfg').hidden && !document.querySelector('.cobub, .cowel')) { e.preventDefault(); cfgClose(); } else if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); $('#cfg').hidden ? cfgOpen() : cfgClose(); } });
  $('#cfgWelcome').onchange = e => LS.set('copo.welcomeOff', e.target.checked ? '' : '1');
  $('#cfgTips').onchange = e => { if (e.target.checked) { LS.set('copo.tipsOff', ''); } else LS.set('copo.tipsOff', '1'); };
  $('#cfgDlibMode').value = DLIB.mode(); $('#cfgDlibMode').onchange = async e => { if (e.target.value === 'dir' && !window.showDirectoryPicker) { toast(tr('Ce navigateur ne permet pas d’utiliser un dossier de l’ordinateur : la bibliothèque reste dans le navigateur.')); e.target.value = 'idb'; return; } LS.set('copo.dlibMode', e.target.value); if (e.target.value === 'dir' && !(await dlMetaGet('dir'))) await dlibPickDir(); dlibCfgSync(); if (!$('#dlib').hidden) dlibRender(); };
  $('#cfgDlibTh').value = LS.get('copo.dlibTh') || '132'; $('#cfgDlibTh').onchange = e => { LS.set('copo.dlibTh', e.target.value); dlibThSync(); };
  $('#cfgDlibDbl').checked = LS.get('copo.dlibDbl') !== '0'; $('#cfgDlibDbl').onchange = e => LS.set('copo.dlibDbl', e.target.checked ? '1' : '0'); dlibCfgSync();
  $('#cfgTpAuto').value = tpManual() ? 'manual' : 'auto'; $('#cfgTpAuto').onchange = e => { LS.set('copo.tpAuto', e.target.value); if (e.target.value === 'auto') recomputeAll(); tpStaleUi(); };
  $('#cfgTheme').value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; $('#cfgTheme').onchange = e => themeSet(e.target.value);
  $('#cfgMat3d').value = MAT3D[LS.get('copo.mat3d')] ? LS.get('copo.mat3d') : 'orange'; $('#cfgMat3d').onchange = e => { LS.set('copo.mat3d', e.target.value); if (typeof rvReq === 'function') rvReq(); if (typeof V3 !== 'undefined' && V3.gl && !$('#v3d').hidden) v3Render(); };
  $('#cfgZoom3d').value = LS.get('copo.zoom3d') || 'cursor'; $('#cfgZoom3d').onchange = e => LS.set('copo.zoom3d', e.target.value);
  $('#cfgMouse3d').value = LS.get('copo.mouse3d') || 'cad'; $('#cfgMouse3d').onchange = e => { LS.set('copo.mouse3d', e.target.value); v3HelpSync(); };
  { const sync = () => { const v = LS.get('copo.orbit') || 'cursor'; for (const b of $$('#cfgOrbit button')) b.setAttribute('aria-pressed', b.dataset.orb === v); }; for (const b of $$('#cfgOrbit button')) b.onclick = () => { LS.set('copo.orbit', b.dataset.orb); sync(); }; sync(); }
  $('#cfgRelQ').onchange = e => { LS.set('copo.relQ', e.target.value); relDirty = true; if (typeof RV !== 'undefined') { RV.sig = ''; RV.lastBuild = 0; rvSync(); rvReq(); } if (typeof drawRelief !== 'undefined') drawRelief.last = 0; draw(); };
  $('#cfgSimQ').onchange = e => { $('#v3Q').value = e.target.value; LS.set('copo.simQ', e.target.value); };
  $('#cfgRelShow').onchange = e => { const c = $('#relShow'); if (c && c.checked !== e.target.checked) { c.checked = e.target.checked; c.dispatchEvent(new Event('change')); } };
  $$('#cfg [data-cfgui]').forEach(c => c.onchange = () => { const k = c.dataset.cfgui; S.ui[k] = c.checked; if (SNAP_PREF.includes(k)) { snapVer++; snapSave(); } refreshToggles(); draw(); });
  const mp = $('#mPost'); if (mp) { mp.addEventListener('change', () => setTimeout(gcPostName, 0)); new MutationObserver(gcPostName).observe(mp, { childList: true }); } gcPostName();
})();


// bouton Enregistrer : point bleu tant que des modifications ne sont pas enregistrées
let projDirtyV = false; function projDirty(v) { if (projDirtyV === v) return; projDirtyV = v; const b = document.getElementById('tbSave'); if (b) { b.classList.toggle('dirty', v); b.dataset.tip = v ? tr('Enregistrer le projet (Ctrl+S) : modifications non enregistrées') : tr('Enregistrer le projet (Ctrl+S)'); } }

