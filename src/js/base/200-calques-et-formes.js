// ---------- calques et formes ----------
const layerOf = s => S.layers.find(l => l.id === s.layer) || S.layers[0];
const faceOf = s => (layerOf(s).face === 2 ? 2 : 1);
const faceShown = f => (S.ui.faceView || 'all') === 'all' || +S.ui.faceView === f;
const shown = s => layerOf(s).visible && faceShown(faceOf(s));
const editable = s => { const l = layerOf(s); return l.visible && !l.locked; };
const shapeById = id => S.shapes.find(s => s.id === id);
function ensureActiveLayer() { const l = S.layers.find(x => x.id === S.layerActive) || S.layers[0]; S.layerActive = l.id; if (!l.visible || l.locked) { l.visible = true; l.locked = false; renderLayers(); toast('Le calque « ' + l.name + ' » a été affiché et déverrouillé pour dessiner.'); } }
function mkShape(nodes, closed, opt = {}) {
  if (!opt.layer) ensureActiveLayer();
  const s = refresh({ id: uid(), nodes, closed, layer: opt.layer || S.layerActive, g: opt.g || null });
  if (s.pts.length < 2) return null; S.shapes.push(s); return s;
}
function bbox(shapes) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const s of shapes) for (const p of s.pts) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
const selShapes = () => S.shapes.filter(s => S.sel.has(s.id));
const selOrdered = () => [...S.sel].map(shapeById).filter(Boolean);
function units(ss) { const m = new Map(), out = []; for (const s of ss) { if (!s.g) { out.push([s]); continue; } if (!m.has(s.g)) { m.set(s.g, []); out.push(m.get(s.g)); } m.get(s.g).push(s); } return out; }
function groupIds(s) { return s.g ? S.shapes.filter(o => o.g === s.g && editable(o)).map(o => o.id) : [s.id]; }
function replaceShape(s, pieces) { // pieces : [{nodes, closed}]
  const i = S.shapes.indexOf(s); if (i < 0) return [];
  const made = pieces.filter(p => p.nodes.length > 1).map(p => refresh({ id: uid(), nodes: p.nodes, closed: !!p.closed, layer: s.layer, g: s.g }));
  S.shapes.splice(i, 1, ...made); S.sel.delete(s.id); made.forEach(m => S.sel.add(m.id));
  for (const tp of S.tps) if (tp.shapeIds.includes(s.id)) tp.shapeIds = tp.shapeIds.flatMap(id => id === s.id ? made.map(m => m.id) : [id]);
  if (S.ne && S.ne.sid === s.id) S.ne = made.length ? { sid: made[0].id, ni: null, seg: null } : null;
  return made;
}
function migrateShape(s) { if (!s.nodes) s.nodes = nodesFromPts(s.pts || []); if (!s.layer) s.layer = S.layers[0].id; if (s.g === undefined) s.g = null; return refresh(s); }

