// ---------- exemple ----------
function pickTool(type, dia) { let t = S.tools.find(x => (type === 'v' ? x.type === 'v' : x.type !== 'v') && (!dia || Math.abs(x.dia - dia) < 0.01)) || S.tools.find(x => type === 'v' ? x.type === 'v' : x.type !== 'v'); if (!t) { t = DEFAULT_TOOLS().find(x => type === 'v' ? x.type === 'v' : x.id === 't2'); t = { ...t, id: uid() }; S.tools.push(t); } return t.id; }
/*@donnee sample-rotary*/
/*@donnee sample-project*/
function loadSample(rot) {
  const o = JSON.parse(JSON.stringify(rot ? SAMPLE_ROTARY : SAMPLE_PROJECT)), T = x => tr(x);
  o.layers.forEach(l => l.name = T(l.name)); o.tps.forEach(t => t.name = T(t.name)); o.meta.name = T(o.meta.name); o.meta.material = T(o.meta.material);
  // la bibliothèque de l'utilisateur est conservée ; seuls les outils manquants de l'exemple y sont ajoutés
  o.tools = o.tools.map(t => ({ ...t, name: T(t.name) })); S.sel.clear(); S.editTp = null; S.activeTp = null; S.ne = null; S.imgSel = null;
  restore(JSON.stringify(o)); S.form = newForm(); hist = []; hi = -1; commit(); renderSel(); renderTools(); renderForm(); renderLayers(); renderGuides(); fit(); if (typeof RV !== 'undefined') { RV.fitted = false; RV.touched = false; if (typeof rvSync === 'function') rvSync(); }
}

