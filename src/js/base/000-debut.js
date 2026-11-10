
// champs numériques : on accepte la virgule comme le point (les champs « number » refusent l’un ou l’autre selon le navigateur et la langue)
(() => {
  const D = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'), ok = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  const isFr = () => { try { return LANG === 'fr'; } catch { return true; } };
  const dec = st => { const m = String(st).match(/\.(\d+)/); return m ? m[1].length : 0; };
  const fix = el => {
    if (el.dataset.num) return; const v = D.get.call(el); el.dataset.num = '1';
    el.setAttribute('type', 'text'); el.setAttribute('inputmode', 'decimal'); el.setAttribute('autocomplete', 'off'); el.spellcheck = false;
    Object.defineProperty(el, 'type', { get: () => 'number', set: () => { }, configurable: true });
    Object.defineProperty(el, 'value', { get() { const t = D.get.call(this).replace(/\s/g, '').replace(',', '.'); return ok.test(t) ? t : ''; }, set(x) { const t = x == null ? '' : String(x); if (document.activeElement === this) { const cur = this.value; if (cur === '' ? t === '' || isNaN(+t) || D.get.call(this).trim() !== '' : +cur === +t) return; } D.set.call(this, isFr() ? t.replace('.', ',') : t); }, configurable: true });
    Object.defineProperty(el, 'valueAsNumber', { get() { const t = this.value; return t === '' ? NaN : +t; }, set(x) { this.value = x; }, configurable: true });
    el.addEventListener('beforeinput', e => { if (e.data && /[^0-9.,\-+eE*\/xX×÷() ]/.test(e.data)) e.preventDefault(); });
    el.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault();
      const sa = el.getAttribute('step'), st = sa && sa !== 'any' ? +sa || 1 : 1, mn = el.getAttribute('min'), mx = el.getAttribute('max');
      let n = (+el.value || 0) + (e.key === 'ArrowUp' ? st : -st) * (e.shiftKey ? 10 : 1); if (mn !== null && mn !== '') n = Math.max(+mn, n); if (mx !== null && mx !== '') n = Math.min(+mx, n);
      el.value = +n.toFixed(Math.max(dec(sa || ''), dec(el.value))); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    el.addEventListener('blur', () => { const t = el.value; if (t !== '' && D.get.call(el) !== (isFr() ? t.replace('.', ',') : t)) el.value = t; });
    el.value = v;
  };
  // calcul dans les champs : 595-140, 73,694/2, (10+5)*3, 2x12 ; le résultat remplace le calcul à Entrée ou en quittant le champ
  const expr = el => { const t = D.get.call(el).replace(/\s/g, '').replace(/,/g, '.').replace(/[xX×]/g, '*').replace(/÷/g, '/'); return /\d[-+*/]|[*/()]/.test(t) && !ok.test(t) ? t : null; };
  const calc = t => { let i = 0; const num = () => { const m = t.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i); if (!m) throw 0; i += m[0].length; return +m[0]; };
    const fac = () => { const c = t[i]; if (c === '-') { i++; return -fac(); } if (c === '+') { i++; return fac(); } if (c === '(') { i++; const v = sum(); if (t[i] !== ')') throw 0; i++; return v; } return num(); };
    const prod = () => { let v = fac(); while (t[i] === '*' || t[i] === '/') { const o = t[i++], w = fac(); v = o === '*' ? v * w : v / w; } return v; };
    const sum = () => { let v = prod(); while (t[i] === '+' || t[i] === '-') { const o = t[i++], w = prod(); v = o === '+' ? v + w : v - w; } return v; };
    const v = sum(); if (i !== t.length || !isFinite(v)) throw 0; return v; };
  const solve = el => { const t = expr(el); if (t === null) return false; let v; try { v = calc(t); } catch { return false; } const r = String(+v.toFixed(6)); D.set.call(el, isFr() ? r.replace('.', ',') : r); el.dispatchEvent(new Event('input', { bubbles: true })); return true; };
  const numEl = e => e.target && e.target.dataset && e.target.dataset.num ? e.target : null;
  document.addEventListener('input', e => { const el = numEl(e); if (el && expr(el) !== null) e.stopImmediatePropagation(); }, true); // calcul en cours : rien n'est appliqué
  document.addEventListener('keydown', e => { const el = numEl(e); if (el && e.key === 'Enter' && expr(el) !== null && solve(el)) el.dispatchEvent(new Event('change', { bubbles: true })); }, true);
  document.addEventListener('change', e => { const el = numEl(e); if (el && expr(el) !== null) solve(el); }, true);
  document.addEventListener('focusout', e => { const el = numEl(e); if (el && expr(el) !== null && solve(el)) el.dispatchEvent(new Event('change', { bubbles: true })); }, true);
  const scan = r => { if (r.matches && r.matches('input[type=number]')) fix(r); if (r.querySelectorAll) r.querySelectorAll('input[type=number]').forEach(fix); };
  scan(document); new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n); }).observe(document.documentElement, { childList: true, subtree: true });
  window.numFixScan = scan;
})();

'use strict';
