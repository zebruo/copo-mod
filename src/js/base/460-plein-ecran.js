// ---------- plein écran ----------
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsOk = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && (document.fullscreenEnabled !== false || document.webkitFullscreenEnabled);
function fsToggle() {
  const d = document.documentElement;
  try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const r = (d.requestFullscreen || d.webkitRequestFullscreen).call(d); if (r && r.catch) r.catch(() => toast(tr('Le plein écran n’est pas disponible ici.'))); } } catch (e) { toast(tr('Le plein écran n’est pas disponible ici.')); }
}
function fsSync() { const on = !!fsEl(); document.documentElement.classList.toggle('isfs', on); const b = $('#fsBtn'); if (b) { const t = tr(on ? 'Quitter le plein écran (Échap)' : 'Plein écran'); b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', on); } const m = $('#fsMenu'); if (m) m.textContent = tr(on ? 'Quitter le plein écran' : 'Plein écran'); }
document.addEventListener('fullscreenchange', fsSync); document.addEventListener('webkitfullscreenchange', fsSync);
if (!fsOk()) { const w = document.querySelector('.fsw'); if (w) w.hidden = true; const m = $('#fsMenu'); if (m) m.hidden = true; }
