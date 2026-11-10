// ---------- unités d'affichage (le modèle reste toujours en mm et en mm/min) ----------
const UNIT = (() => { const d = { len: 'mm', feed: 'mm/min', frac: false }; try { return { ...d, ...JSON.parse(localStorage.getItem('copo.units') || '{}') }; } catch { return d; } })();
const uK = u => u === 'feed' ? ({ 'mm/s': 60, 'in/min': 25.4 }[UNIT.feed] || 1) : u === 'len' ? (UNIT.len === 'in' ? 25.4 : 1) : 1;
const uOn = () => UNIT.len !== 'mm' || UNIT.feed !== 'mm/min';
const decSep = s => LANG === 'fr' ? s.replace('.', ',') : s;
function fracIn(v) { const a = Math.abs(v) * 64, n = Math.round(a); if (Math.abs(a - n) > 0.02) return null; const w = Math.floor(n / 64); let r = n % 64, d = 64; while (r && r % 2 === 0) { r /= 2; d /= 2; } return (v < 0 && n ? '-' : '') + (w ? String(w) : '') + (r ? (w ? ' ' : '') + r + '/' + d : (w ? '' : '0')); }
function uNum(mm, kind = 'len', dec, noFrac) {
  const v = mm / uK(kind);
  if (kind === 'feed') return decSep(String(+v.toFixed(UNIT.feed === 'mm/min' ? 0 : 1)));
  if (UNIT.len === 'in') { if (UNIT.frac && !noFrac) { const f = fracIn(v); if (f) return f; } return decSep(String(+v.toFixed(dec == null ? 3 : dec))); }
  return decSep((Math.round(v * 10 ** (dec == null ? 2 : dec)) / 10 ** (dec == null ? 2 : dec)).toFixed(dec == null ? 2 : dec));
}
const uLbl = (kind = 'len') => kind === 'feed' ? UNIT.feed : UNIT.len;
const uTxt = (mm, dec) => uNum(mm, 'len', dec) + ' ' + uLbl();
function uConv(s) {
  if (!uOn() || !s || s.indexOf('mm') < 0) return s;
  const num = x => parseFloat(x.replace(',', '.')), N = '(-?\\d+(?:[.,]\\d+)?)';
  if (UNIT.feed !== 'mm/min') s = s.replace(new RegExp(N + '\\s?mm\\/min', 'g'), (m, a) => uNum(num(a), 'feed') + ' ' + UNIT.feed).replace(/\bmm\/min\b/g, UNIT.feed);
  if (UNIT.len === 'in') {
    s = s.replace(/1 mm \((Maj|Shift)\s?: 10 mm\)/g, '1/16 in ($1: 1/4 in)');
    s = s.replace(new RegExp(N + '\\s?/\\s?' + N + '\\s?mm(?![\\w/²³])', 'g'), (m, x, y) => uNum(num(x)) + ' / ' + uNum(num(y)) + ' in');
    s = s.replace(new RegExp(N + '\\s?×\\s?' + N + '(?:\\s?×\\s?' + N + ')?\\s?mm(?![\\w/²³])', 'g'), (m, a, b, c) => [a, b, c].filter(x => x != null).map(x => uNum(num(x))).join(' × ') + ' in');
    s = s.replace(new RegExp(N + '\\s?mm(?![\\w/²³])', 'g'), (m, a) => uNum(num(a)) + ' in').replace(/\bmm\b(?![\/²³])/g, 'in');
  }
  return s;
}
// champs de saisie marqués data-u="len" ou "feed" : affichés dans l'unité choisie, lus et écrits en mm par le reste du code
const _iv = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  configurable: true, enumerable: _iv.enumerable,
  get() { const raw = _iv.get.call(this), u = this.dataset ? this.dataset.u : null; if (!u) return raw; const k = uK(u); if (k === 1 || raw === '') return raw; if (this._uDisp != null && raw === this._uDisp) return String(this._uMM); const n = parseFloat(String(raw).replace(',', '.')); return isFinite(n) ? String(n * k) : raw; },
  set(v) { const u = this.dataset ? this.dataset.u : null; if (!u) return _iv.set.call(this, v); const k = uK(u), n = parseFloat(v); if (k === 1 || v === '' || v == null || !isFinite(n)) { this._uDisp = null; return _iv.set.call(this, v); } const d = String(+(n / k).toFixed(4)); this._uMM = n; this._uDisp = d; _iv.set.call(this, d); }
});
function niceStep(x) { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return +((m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p).toPrecision(3); }
function uAttrs(root) {
  const list = root.matches && root.matches('input[data-u]') ? [root] : [...(root.querySelectorAll ? root : document).querySelectorAll('input[data-u]')];
  for (const el of list) { if (el.dataset.s0 === undefined) { el.dataset.s0 = el.getAttribute('step') || ''; el.dataset.m0 = el.getAttribute('min') || ''; } const k = uK(el.dataset.u); if (el.dataset.s0 && el.dataset.s0 !== 'any') el.setAttribute('step', k === 1 ? el.dataset.s0 : niceStep(+el.dataset.s0 / k)); if (el.dataset.m0) el.setAttribute('min', k === 1 ? el.dataset.m0 : String(+(+el.dataset.m0 / k).toPrecision(3))); }
}
const GRID_MM = [[0.5, '0,5 mm'], [1, '1 mm'], [5, '5 mm'], [10, '10 mm']], GRID_IN = [[1 / 32, '1/32 in'], [1 / 16, '1/16 in'], [1 / 8, '1/8 in'], [1 / 4, '1/4 in'], [1, '1 in']];
function gridOptions() {
  const sel = document.getElementById('gridStep'); if (!sel) return; const inch = UNIT.len === 'in', L = inch ? GRID_IN.map(([v, t]) => [v * 25.4, t]) : GRID_MM;
  sel.innerHTML = L.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
  let cur = L.find(([v]) => Math.abs(v - S.ui.gridStep) < 1e-6); if (!cur) { cur = inch ? L[1] : L[1]; S.ui.gridStep = cur[0]; } sel.value = String(cur[0]);
}
function setUnits(nu) {
  const els = [...document.querySelectorAll('input[data-u]')], vals = els.map(el => el.value);
  Object.assign(UNIT, nu); try { localStorage.setItem('copo.units', JSON.stringify(UNIT)); } catch { }
  els.forEach((el, i) => { el.value = vals[i]; }); uAttrs(document); gridOptions();
  trObs.disconnect(); trRestore(document.body); if (trOn()) trTree(document.body); trWatch();
  unitsUi(); renderSel(); renderTools(); renderTpList(); renderGuides(); setTool(S.ui.tool); gcDirty = true; renderGcode(); draw();
  toast(UNIT.len === 'in' ? 'Unités : pouces.' : 'Unités : millimètres.');
}
function unitsUi() {
  const a = document.getElementById('uLen'), b = document.getElementById('uFeed'), c = document.getElementById('uFrac'), g = document.getElementById('mG20');
  if (a) a.value = UNIT.len; if (b) b.value = UNIT.feed; if (c) c.checked = !!UNIT.frac; if (g) g.checked = !!S.machine.g20;
  const fr_ = document.getElementById('uFracRow'), gr = document.getElementById('uG20Row'); if (fr_) fr_.hidden = UNIT.len !== 'in'; if (gr) gr.hidden = UNIT.len !== 'in';
}
const machineEff = () => ({ ...S.machine, g20: !!S.machine.g20 && UNIT.len === 'in' });
/*CORE-START*/
