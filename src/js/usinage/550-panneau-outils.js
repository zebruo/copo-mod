// ---------- panneau Outils ----------
// avance par dent fz = avance / (vitesse × nombre de dents)
const toolFz = t => (+t.rpm > 0 && +t.flutes > 0) ? (+t.feed || 0) / (+t.rpm * +t.flutes) : 0;
function toolFzSync(t, keepInput) {
  const fz = toolFz(t), inp = $('#tFz'), h = $('#tFzHint'); if (!inp || !h) return; h.classList.remove('warn');
  if (!keepInput) inp.value = fz > 0 ? +fz.toFixed(4) : '';
  if (t.type === 'drill') { h.textContent = +t.rpm > 0 ? trf('Foret : avance par tour {f} mm (vitesse de descente ÷ vitesse de broche).', { f: uNum((+t.plunge || 0) / +t.rpm, 'len', 3) }) : ''; return; }
  if (!(fz > 0)) { h.textContent = tr('Renseignez la vitesse de broche et le nombre de dents pour obtenir l’avance par dent.'); return; }
  // repères : bois et plastiques selon le diamètre ; métaux selon la méthode du calculateur (fz = Ø / k, k selon le nombre de dents)
  const mat = typeof projMat === 'function' ? projMat() : 'softwood', metal = mat === 'alu' || mat === 'brass';
  let lo, hi, what;
  [lo, hi] = fzRange(mat, +t.dia || 0); what = tr({ brass: 'pour le laiton', alu: 'pour l’aluminium', acrylic: 'pour l’acrylique', pvc: 'pour le PVC', hdpe: 'pour le PEHD', mdf: 'pour le MDF', hardwood: 'pour le bois dur' }[mat] || 'pour le bois');
  const st = fz < lo ? tr('faible : la fraise risque de frotter et de chauffer (brûlures, usure)') : fz > hi ? tr('élevée : risque de casse ou de mauvais état de surface') : tr('dans la plage courante');
  const D = +t.dia || 0, pk = apK(mat, D), pdeep = (t.type === 'flat' || t.type === 'ball') && D > 0 && +t.pass > pk * D * 1.001;
  const mx = (S.machine && +S.machine.maxFeed) || 0; h.classList.toggle('warn', fz < lo || fz > hi || pdeep || (mx > 0 && +t.feed > mx)); const cap = mx > 0 && +t.feed > mx ? ' ' + trf('Attention : l’avance dépasse l’avance maximale de la machine ({m} mm/min) ; les parcours la plafonneront.', { m: mx }) : '';
  h.textContent = trf('{f} par dent — {s}. Repère pour une CNC de loisir {w} avec ce diamètre : {a} à {b} (machines rigides : 3 à 5 fois plus) ; suivez en priorité les données du fabricant de la fraise.', { f: uNum(fz, 'len', 3) + ' ' + uLbl(), s: st, w: what, a: uNum(lo, 'len', 3), b: uNum(hi, 'len', 3) + ' ' + uLbl() }) + cap + (pdeep ? ' ' + trf('Profondeur de passe forte : au-delà de {k} × Ø ({m}) pour ce matériau, la fraise peut casser ou la machine perdre des pas.', { k: String(+pk.toFixed(2)).replace('.', ','), m: uNum(pk * D, 'len', 2) + ' ' + uLbl() }) : '');
}
function toolCalcText(t) { if (t.type === 'drill') return 'Longueur de pointe ' + fr(t.dia / 2 / Math.tan((+t.angle || 118) * Math.PI / 360)) + ' mm'; return t.type === 'v' ? 'Prof. max ' + fr(t.dia / 2 / Math.tan(t.angle * Math.PI / 360)) + ' mm' : 'Pas latéral ' + fr(t.dia * Math.max(0.05, 1 - t.over / 100)) + ' mm'; }
function renderTools() { libRender(); }
let tT = 0;
function toolsChanged(soft) { if (!soft) renderTools(); renderForm(); clearTimeout(tT); tT = setTimeout(() => { commit(false); recomputeAll(); }, soft ? 350 : 0); }
$('#toolForm').addEventListener('input', () => illRefresh());

