// ---------- fenêtres flottantes (réglages des parcours et des outils) ----------
function fwOpen(id, anchor) { if (id === 'tpWin') setTimeout(() => { if (typeof rvReq === 'function') rvReq(); }, 0);
  const w = $('#' + id); if (!w.hidden) return;
  if (anchor) { w.hidden = false; const r = w.getBoundingClientRect(), a = anchor.getBoundingClientRect(); w.style.left = Math.max(4, Math.min(a.right - r.width, innerWidth - r.width - 4)) + 'px'; w.style.top = Math.max(4, a.top - r.height - 8) + 'px'; return; } // fenêtre posée juste au-dessus du bouton qui l'ouvre
  let pos = null; try { pos = JSON.parse(LS.get('copo.fwin2.' + id) || 'null'); } catch { }
  const pr = document.querySelector('.panel').getBoundingClientRect();
  w.hidden = false; const r = w.getBoundingClientRect();
  let x = pos ? pos.x : pr.right + 10, y = pos ? pos.y : pr.top + 4;
  x = Math.max(4, Math.min(x, innerWidth - r.width - 4)); y = Math.max(4, Math.min(y, innerHeight - 80));
  w.style.left = x + 'px'; w.style.top = y + 'px';
}
function fwClose(id) { const w = $('#' + id); if (w) w.hidden = true; if (id === 'tpWin') { if (S.tpRels) S.tpRels.clear(); draw(); if (typeof rvReq === 'function') rvReq(); } }
document.querySelectorAll('.fwin-head').forEach(h => h.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return; const w = h.parentElement, r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; h.setPointerCapture(e.pointerId);
  const mv = ev => { const x = Math.max(4, Math.min(ev.clientX - dx, innerWidth - r.width - 4)), y = Math.max(4, Math.min(ev.clientY - dy, innerHeight - 40)); w.style.left = x + 'px'; w.style.top = y + 'px'; };
  const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); try { LS.set('copo.fwin2.' + w.id, JSON.stringify({ x: parseFloat(w.style.left), y: parseFloat(w.style.top) })); } catch { } };
  h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
}));
function tpNew(type) {
  setTab('parcours'); S.editTp = null; S.activeTp = null; const f = newForm(); f.type = type; S.tpRels = new Set(type === 'profile' && S.relSel ? [S.relSel] : []);
  const os = selShapes(); if (type === 'profile' && os.length && os.every(x => !x.closed)) f.side = 'on';
  if (type === 'thread') { const t = S.tools.find(t => t.type === 'thread'); if (t) f.toolId = t.id; f.depth = 10; }
  if (type === 'relief') { const fl = S.tools.filter(t => t.type === 'flat').sort((a, b) => b.dia - a.dia)[0]; if (fl) f.toolId = fl.id; }
  if (type === 'vcarve') { f.depth = 0; const v = S.tools.find(t => t.type === 'v'); if (v) f.toolId = v.id; }
  if (type === 'profile' && S.tpRels.size) { const d = tpRelDepth(S.tpRels); if (d) f.depth = d; }
  S.form = f; renderForm(); renderTpList(); draw(); fwOpen('tpWin');
}
document.querySelectorAll('#tpNew [data-newtp]').forEach(b => { b.insertAdjacentHTML('afterbegin', ICO['type_' + b.dataset.newtp] || ''); b.onclick = () => tpNew(b.dataset.newtp); });
