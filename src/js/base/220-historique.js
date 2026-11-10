// ---------- historique ----------
let hist = [], hi = -1;
const snapObj = () => ({ meta: S.meta || {}, stock: S.stock, shapes: S.shapes.map(({ pts, map, ...r }) => r), tps: S.tps.map(tpDef), tools: S.tools, layers: S.layers, layerActive: S.layerActive, guides: S.guides, dims: S.dims, images: S.images, relief: S.relief });
const snapState = () => JSON.stringify(snapObj());
/* historique compact : un état est rangé en morceaux de texte (une forme, un parcours, un bloc...) dont la mise bout à bout redonne exactement le texte complet. Les morceaux inchangés sont partagés avec l'état précédent au lieu d'être recopiés. Si la mise bout à bout ne redonne pas le texte exact, on garde le texte complet (comme avant) */
function snapParts(v, d, out, pool) {
  if (v && typeof v === 'object' && d > 0 && typeof v.toJSON !== 'function' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)) {
    if (Array.isArray(v)) { out.push('['); for (let i = 0; i < v.length; i++) { if (i) out.push(','); snapParts(v[i], d - 1, out, pool); } out.push(']'); return true; }
    let f = true; for (const k of Object.keys(v)) { const x = v[k]; if (x === undefined || typeof x === 'function' || typeof x === 'symbol') continue; out.push((f ? '{' : ',') + JSON.stringify(k) + ':'); f = false; snapParts(x, d - 1, out, pool); } out.push(f ? '{}' : '}'); return true;
  }
  let j = JSON.stringify(v); if (j === undefined) j = 'null'; const q = pool.get(j); out.push(q === undefined ? j : q); return true;
}
/* le découpage reproduit exactement JSON.stringify ; on le vérifie sur les 3 premiers états de la session (texte complet comparé), et en cas d'écart on revient pour de bon au texte complet */
let histChk = 0, histOff = false;
function histEntry(prev) {
  const o = snapObj();
  if (histOff) { const full = JSON.stringify(o); return { p: [full], full }; }
  const pool = new Map(); if (prev && prev.p) for (const x of prev.p) if (x.length > 64) pool.set(x, x);
  const p = []; snapParts(o, 2, p, pool);
  if (histChk < 3) { histChk++; const full = JSON.stringify(o); if (p.join('') !== full) { histOff = true; return { p: [full], full }; } }
  return { p };
}
const histText = e => e.p.length === 1 ? e.p[0] : e.p.join('');
function histSame(a, b) { if (!a || !b) return false; if (a.p.length === b.p.length && a.p.every((x, i) => x === b.p[i])) return true; if (a.p.length > 1 && b.p.length > 1) return false; /* deux états découpés de la même façon : morceaux différents = états différents */ return (b.full || histText(b)) === (a.full || histText(a)); }
function tpDef(t) { return { id: t.id, name: t.name, type: t.type, toolId: t.toolId, shapeIds: t.shapeIds, ...(t.relIds && t.relIds.length ? { relIds: t.relIds } : {}), p: t.p, visible: t.visible, face: t.face === 2 ? 2 : 1 }; }
function rpmClamp(v) { const M = S.machine, lo = +M.rpmMin || 0, hi = +M.rpmMax || 0; v = +v || 0; if (hi > 0 && v > hi) v = hi; if (lo > 0 && v > 0 && v < lo) v = lo; return Math.round(v); } // vitesse de broche ramenée dans la plage de la machine
function commit(recompute = true) { if (typeof projDirty === 'function' && hist.length) projDirty(true); snapVer++; if (S.relief && S.relief.items.some(i => i.clip)) relDirty = true; const e = histEntry(hist[hi]); if (histSame(e, hist[hi])) return; delete e.full; hist = hist.slice(0, hi + 1); hist.push(e); if (hist.length > 120) hist.shift(); hi = hist.length - 1; if (recompute) recomputeAll(); autosave(); }
function restore(s) {
  const o = JSON.parse(s); S.meta = o.meta || {}; S.stock = { offX: 0, offY: 0, ...o.stock }; S.stock.originXY = originKey(S.stock); S.layers = o.layers && o.layers.length ? o.layers : DEFAULT_LAYERS(); S.layerActive = S.layers.find(l => l.id === o.layerActive) ? o.layerActive : S.layers[0].id;
  S.shapes = (o.shapes || []).map(migrateShape); if (o.tools && o.tools.length) S.tools = o.tools; S.tps = (o.tps || []).map(t => ({ ...t }));
  S.relief = o.relief && Array.isArray(o.relief.items) ? { show: true, res: 0.3, ...o.relief, items: o.relief.items.map(i => ({ ...i })) } : { items: [], show: true, res: 0.3 };
  for (const it of S.relief.items) { if (it.top === undefined) it.top = 0; if (it.kind === 'image' && it.src && it.linked !== false) { const im = S.images.find(x => x.id === it.src); if (im) { it.x = im.x; it.y = im.y; it.w = im.w; it.h = im.h; it.rot = im.rot || 0; S.images = S.images.filter(x => x !== im); } it.linked = false; delete it.src; } } if (S.relSel && !S.relief.items.some(i => i.id === S.relSel)) S.relSel = null; relDirty = true; if (typeof relPanel === 'function') relPanel();
  S.guides = o.guides || { x: [], y: [] }; S.dims = o.dims || []; S.images = (o.images || []).map(i => ({ ...i })); if (S.imgSel && !imgById(S.imgSel)) S.imgSel = null; if (typeof renderImgPanel === 'function') renderImgPanel();
  for (const id of [...S.sel]) if (!shapeById(id)) S.sel.delete(id); if (S.ne && !shapeById(S.ne.sid)) S.ne = null;
  if (typeof libLinkProject === 'function') libLinkProject(); syncStock(); recomputeAll(); renderTools(); renderSel(); renderLayers(); renderGuides(); autosave();
}
function undo() { if (hi > 0) { hi--; restore(histText(hist[hi])); } }
function redo() { if (hi < hist.length - 1) { hi++; restore(histText(hist[hi])); } }
let asT = 0; function autosave() { clearTimeout(asT); asT = setTimeout(() => { LS.set('copeau.project', snapState()); LS.set('copeau.machine', JSON.stringify(S.machine)); if (typeof machStore === 'function') machStore(); }, 400); }

