// ---------- démarrage ----------
(function init() {
  if (!window.ClipperLib) $('#libErr').hidden = false;
  try { const m = JSON.parse(LS.get('copeau.machine') || 'null'); if (m) S.machine = { ...S.machine, ...m }; } catch { }
  S.ui.arrCx = S.stock.w / 2; S.ui.arrCy = S.stock.h / 2;
  syncMachine(); bindK(); setTool('select'); resize();
  let loaded = false; const saved = LS.get('copeau.project');
  if (saved) { try { const o = JSON.parse(saved); if (o.shapes && o.shapes.length) { restore(saved); hist = [histEntry(null)]; delete hist[0].full; hi = 0; S.form = newForm(); renderForm(); loaded = true; } } catch (e) { console.warn(e); } }
  if (!loaded) loadSample();
  bindImgPanel(); bindRelPanel(); relPanel(); loadImgData(); viewsApply(); dgInit(); icoInit(); dRefresh();
  renderTools(); renderSel(); renderLayers(); renderGuides(); renderImgPanel(); trStart(); requestAnimationFrame(fit);
})();

