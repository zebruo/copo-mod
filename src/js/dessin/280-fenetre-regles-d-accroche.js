// ---------- fenêtre Règles d'accroche ----------
const SNAP_PREF = ['snapGrid', 'gridStep', 'snapGuide', 'snapStock', 'snapR', 'snapVert', 'snapEnd', 'snapMid', 'snapInt', 'snapCen', 'snapTan', 'snapOn', 'showGrid'];
const SNAP_DEF = { snapGrid: true, gridStep: 1, snapGuide: true, snapStock: false, snapR: 9, snapVert: true, snapEnd: true, snapMid: true, snapInt: true, snapCen: true, snapTan: true, snapOn: true, showGrid: true };
function snapSave() { const o = {}; for (const k of SNAP_PREF) o[k] = S.ui[k]; try { LS.set('copo.snap', JSON.stringify(o)); } catch { } }
function snapLoad() { let o = {}; try { o = JSON.parse(LS.get('copo.snap') || '{}') || {}; } catch { } for (const k of SNAP_PREF) S.ui[k] = k in o ? o[k] : (k in S.ui ? S.ui[k] : SNAP_DEF[k]); }
function snapBarSync() { const gs = $('#gridStep'); if ([...gs.options].some(o => Math.abs(+o.value - S.ui.gridStep) < 1e-9)) gs.value = String([...gs.options].find(o => Math.abs(+o.value - S.ui.gridStep) < 1e-9).value); refreshToggles(); }
function snapFill() {
  $$('#cfg [data-sw]').forEach(c => { c.checked = S.ui[c.dataset.sw] !== false && !!S.ui[c.dataset.sw]; });
  const sel = $('#swGridStep'); sel.innerHTML = $('#gridStep').innerHTML; sel.value = $('#gridStep').value; $('#swR').value = +S.ui.snapR || 9;
  const on = !!S.ui.snapVert; $$('#cfg .sw-sub input[type=checkbox]').forEach(c => { c.disabled = !on; c.closest('label').style.opacity = on ? '' : '.5'; });
}
function snapOpen() { cfgOpen('snap'); }
$$('#cfg [data-sw]').forEach(c => c.addEventListener('change', () => { S.ui[c.dataset.sw] = c.checked; snapVer++; snapSave(); snapBarSync(); snapFill(); draw(); }));
$('#swGridStep').addEventListener('change', e => { S.ui.gridStep = +e.target.value; snapSave(); snapBarSync(); });
$('#swR').addEventListener('input', e => { S.ui.snapR = +e.target.value; snapSave(); });
function drawSnapMark(C) {
  if (cenHint.length && S.ui.tool !== 'select') { ctx.save(); ctx.strokeStyle = '#ff9f1c'; ctx.globalAlpha = .75; ctx.lineWidth = 1.4; ctx.beginPath(); for (const q of cenHint) { if (snapMark && snapMark.p && hyp(snapMark.p, q) < 1e-6) continue; const X = sx(q[0]), Y = sy(q[1]); ctx.moveTo(X - 6, Y); ctx.lineTo(X + 6, Y); ctx.moveTo(X, Y - 6); ctx.lineTo(X, Y + 6); } ctx.stroke(); ctx.restore(); }
  const m = snapMark; if (!m || !m.p) return; const X = sx(m.p[0]), Y = sy(m.p[1]);
  ctx.save(); ctx.strokeStyle = '#ff9f1c'; ctx.fillStyle = '#ff9f1c'; ctx.lineWidth = 2; ctx.beginPath();
  if (m.k === 'end') ctx.rect(X - 5, Y - 5, 10, 10);
  else if (m.k === 'mid') { ctx.moveTo(X, Y - 6); ctx.lineTo(X + 6, Y + 5); ctx.lineTo(X - 6, Y + 5); ctx.closePath(); }
  else if (m.k === 'int') { ctx.moveTo(X - 6, Y - 6); ctx.lineTo(X + 6, Y + 6); ctx.moveTo(X + 6, Y - 6); ctx.lineTo(X - 6, Y + 6); }
  else if (m.k === 'gd') { ctx.moveTo(X, Y - 7); ctx.lineTo(X + 7, Y); ctx.lineTo(X, Y + 7); ctx.lineTo(X - 7, Y); ctx.closePath(); }
  else if (m.k === 'stk') { ctx.rect(X - 5, Y - 5, 10, 10); ctx.moveTo(X - 5, Y - 5); ctx.lineTo(X + 5, Y + 5); }
  else if (m.k === 'hor' || m.k === 'ver' || m.k === 'ang' || m.k === 'ext') { ctx.stroke(); ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx(m.from[0]), sy(m.from[1])); ctx.lineTo(X, Y); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.arc(X, Y, 4, 0, 7); }
  else if (m.k === 'org') { ctx.arc(X, Y, 7, 0, 7); ctx.moveTo(X - 11, Y); ctx.lineTo(X + 11, Y); ctx.moveTo(X, Y - 11); ctx.lineTo(X, Y + 11); }
  else if (m.k === 'on') { ctx.moveTo(X - 5, Y - 6); ctx.lineTo(X + 5, Y - 6); ctx.lineTo(X - 5, Y + 6); ctx.lineTo(X + 5, Y + 6); ctx.closePath(); }
  else if (m.k === 'cen') { ctx.arc(X, Y, 6, 0, 7); ctx.moveTo(X - 9, Y); ctx.lineTo(X + 9, Y); ctx.moveTo(X, Y - 9); ctx.lineTo(X, Y + 9); }
  else { ctx.arc(X, Y, 6, 0, 7); ctx.moveTo(X - 10, Y - 6); ctx.lineTo(X + 10, Y - 6); }
  ctx.stroke(); ctx.font = '600 11px ' + C.mono; ctx.fillText((LANG === 'en' ? SNAP_EN[m.k] : SNAP_LBL[m.k]) || '' + (m.k === 'ang' ? ' ' + m.a + '°' : ''), X + 10, Y - 9); ctx.restore();
}
function outXY(x, y) { const o = originOf(S.stock); return [x - o[0], y - o[1]]; }
function inXY(x, y) { const o = originOf(S.stock); return [x + o[0], y + o[1]]; }

