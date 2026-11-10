// ---------- onglets ----------
let curTab = 'dessin';
function pjSummary() {
  const el = document.getElementById('pjSum'); if (!el) return; const st = S.stock, M = S.machine, has2 = S.layers.some(l => l.face === 2);
  const post = tr(postOf(M).short);
  const f1 = v => LANG === 'fr' ? fr(v, 1) : v.toFixed(1), RT = st.rotary || {}; el.textContent = (RT.on ? tr('Cylindre') + ' L ' + f1(RT.axis === 'y' ? st.h : st.w) + ' × Ø ' + f1(st.t) + ' mm' : f1(st.w) + ' × ' + f1(st.h) + ' × ' + f1(st.t) + ' mm') + (S.meta && S.meta.material ? ' · ' + S.meta.material : '') + '\n' + tr('Origine') + ' : ' + tr(originLabel(st)) + ' · Z0 : ' + (RT.on ? tr(RT.z0 === 'axis' ? 'axe du cylindre' : 'surface du cylindre') + ' · ' + tr('rotatif') + ', ' + (S.machine.rotL === 'B' ? 'B' : 'A') : tr(st.originZ === 'bottom' ? 'table' : 'dessus du brut') + (has2 && stMode() === 'double' ? ' · ' + tr('double face') : '')) + '\n' + post + ' · ' + UNIT.len + ' · ' + UNIT.feed;
  illRefresh(); el.style.whiteSpace = 'pre-line'; if (typeof libMatSync === 'function') libMatSync(); const m = document.getElementById('pjMat'); if (m && document.activeElement !== m) m.value = (S.meta && S.meta.material) || '';
}
function setTab(t) { if (t === 'gcode' && !tpManual() && tpLaterT) tpRecalcThen(() => { });  if (t !== 'parcours' && S.ui.tool !== 'tabedit') fwClose('tpWin'); if (t !== 'outils') fwClose('toolWin'); curTab = t; if (t === 'projet') pjSummary(); $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t)); $$('.pane').forEach(p => p.hidden = p.dataset.pane !== t); if (t === 'gcode') renderGcode(); if (t === 'parcours') { renderForm(); if (typeof VIEWS !== 'undefined' && !VIEWS.d3 && !VIEWS.userHid3) { VIEWS.d3 = true; viewsApply(); } } if (t === 'relief') { relPanel(); if (!VIEWS.d3 && !VIEWS.userHid3) { VIEWS.d3 = true; viewsApply(); } } draw(); coTabSoon(t); }
$$('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
document.querySelector('[data-pane="projet"]').addEventListener('change', () => setTimeout(pjSummary, 0)); document.getElementById('cfg').addEventListener('change', () => setTimeout(pjSummary, 0));
document.getElementById('pjMat').addEventListener('change', e => { S.meta = { ...(S.meta || {}), material: e.target.value.trim() }; commit(false); pjSummary(); });

