// ---------- langue (français d'origine, traduction anglaise par dictionnaire) ----------
/*@i18n en*/

let LANG = (() => { try { const v = localStorage.getItem('copo.lang'); if (v === 'fr' || v === 'en') return v; } catch { } return /^fr/i.test(navigator.language || 'fr') ? 'fr' : 'en'; })();
let trRe = null;
function trBuild() {
  const L = '[A-Za-zÀ-ÿŒœ]', isL = c => /[A-Za-zÀ-ÿŒœ]/.test(c), esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keys = Object.keys(I18N_EN).filter(k => k.length >= 3 && /[A-Za-zÀ-ÿ]{2}/.test(k)).sort((a, b) => b.length - a.length);
  trRe = new RegExp(keys.map(k => (isL(k[0]) ? '(?<!' + L + ')' : '') + esc(k) + (isL(k[k.length - 1]) ? '(?!' + L + ')' : '')).join('|'), 'g');
}
function tr(s) {
  if (LANG === 'fr' || s == null) return s; s = String(s); if (!/[A-Za-zÀ-ÿ]{2}|\sà\s/.test(s)) return s; // « 2 à 3 × Ø » : à traduire aussi
  const n = s.replace(/\s+/g, ' ').trim(), hit = I18N_EN[n];
  if (hit !== undefined) return s.match(/^\s*/)[0] + hit + s.match(/\s*$/)[0];
  if (LANG === 'en' && !trRe) trBuild();
  if (!trRe) trBuild(); return s.replace(trRe, m => I18N_EN[m] !== undefined ? I18N_EN[m] : m).replace(/[«“]\s+/g, '“').replace(/\s+[»”]/g, '”').replace(/[ \u00a0\u202f]([:;!?])(?=\s|$)/g, '$1');
}
const TR_ATTR = ['title', 'aria-label', 'placeholder'], trOrig = new WeakMap(), trSet = new WeakMap(), trAOrig = new WeakMap(), trASet = new WeakMap();
// accord des « (s) » d'après le dernier nombre qui précède (FR : pluriel à partir de 2 ; EN : tout sauf 1)
const trPlur = s => s.indexOf('(') < 0 ? s : s.replace(/([A-Za-zÀ-ÿœ])\((s|es|x)\)/g, (m, c, x, off) => { const ns = s.slice(0, off).match(/(?:^|[\s(])\d+(?:[.,]\d+)?(?=[\s\u00a0\u202f)]|$)/g); if (!ns) return m; const v = parseFloat(ns[ns.length - 1].replace(/[\s(]/g, '').replace(',', '.')); return c + ((LANG === 'en' ? v !== 1 : v >= 2) ? x : ''); });
// typographie : apostrophe ’ et … partout ; en français, espace insécable avant : et », fine avant ; ! ?, après « ; en anglais, point décimal
const trTypo = s => { s = s.replace(/([A-Za-zÀ-ÿœŒ])'(?=[A-Za-zÀ-ÿœŒ])/g, '$1’').replace(/(^|[^.])\.\.\.(?!\.)/g, '$1…');
  return LANG === 'fr' ? s.replace(/ ([:»])/g, '\u00a0$1').replace(/ ([;!?])(?=\s|$|[)»])/g, '\u202f$1').replace(/« /g, '«\u00a0') : s.replace(/(\d),(\d)/g, '$1.$2'); };
const disp = s => trTypo(trPlur(uConv(tr(s)))), trOn = () => true;
for (const P of [CanvasRenderingContext2D.prototype, window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype]) if (P) for (const f of ['fillText', 'strokeText', 'measureText']) { const o = P[f]; P[f] = function (t, ...a) { return o.call(this, LANG === 'en' && typeof t === 'string' ? t.replace(/(\d),(\d)/g, '$1.$2') : t, ...a); }; } // textes dessinés : point décimal en anglais // le texte d'origine est gardé (trOrig) : changer de langue le retrouve
const trSkip = el => !el || /^(SCRIPT|STYLE|TEXTAREA)$/.test(el.nodeName) || !!(el.closest && el.closest('[data-notr]'));
// data-en : traduction propre à un élément quand le même mot français a deux sens (Annuler = Undo / Cancel)
function trText(n) { if (trSkip(n.parentNode)) return; if (trSet.get(n) === n.data) return; trOrig.set(n, n.data); const en = LANG === 'en' && n.parentNode.dataset && n.parentNode.dataset.en, t = en ? en : /^(CODE|KBD|PRE)$/.test(n.parentNode.nodeName) ? uConv(tr(n.data)) : disp(n.data); if (t !== n.data) n.data = t; trSet.set(n, n.data); }
function trAttr(el, a) { if (trSkip(el)) return; const v = el.getAttribute(a); if (v == null) return; const S2 = trASet.get(el) || {}; if (S2[a] === v) return; const O = trAOrig.get(el) || {}; O[a] = v; trAOrig.set(el, O); const t = disp(v); if (t !== v) el.setAttribute(a, t); S2[a] = t; trASet.set(el, S2); }
function trTree(root) {
  if (root.nodeType === 3) return trText(root); if (root.nodeType !== 1 || trSkip(root)) return;
  for (const a of TR_ATTR) if (root.hasAttribute(a)) trAttr(root, a);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => n.nodeType === 1 && trSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else for (const a of TR_ATTR) if (n.hasAttribute(a)) trAttr(n, a); }
}
let trObs = null; const trWatch = () => trObs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TR_ATTR });
function trStart() {
  trObs = new MutationObserver(recs => { if (!trOn()) return; trObs.disconnect(); for (const r of recs) { if (r.type === 'characterData') trText(r.target); else if (r.type === 'attributes') trAttr(r.target, r.attributeName); else r.addedNodes.forEach(n => { trTree(n); if (n.nodeType === 1) uAttrs(n); }); } trWatch(); });
  uAttrs(document); if (trOn()) trTree(document.body); trWatch(); document.documentElement.lang = LANG; langMarks();
}
function trRestore(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) { if (trOrig.has(n) && trSet.get(n) === n.data) n.data = trOrig.get(n); trSet.delete(n); }
    else { const O = trAOrig.get(n), S2 = trASet.get(n) || {}; if (O) for (const a in O) if (S2[a] === n.getAttribute(a)) n.setAttribute(a, O[a]); trASet.delete(n); }
  }
}
function setLang(l) {
  if (l === LANG) return; try { localStorage.setItem('copo.lang', l); } catch { }
  trObs.disconnect(); trRestore(document.body); LANG = l; if (trOn()) trTree(document.body); trWatch();
  document.documentElement.lang = LANG; langMarks(); gcDirty = true; renderGcode(); setTool(S.ui.tool); draw();
  toast(LANG === 'fr' ? 'Interface en français.' : 'Interface in English.');
}
function langMarks() { document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG)); const g = document.getElementById('guideLink'); if (g) g.href = 'guide.html#' + LANG; }
