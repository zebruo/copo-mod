// ---------- G-code ----------
const ORIGIN_LBL = { tl: 'coin haut gauche', tc: 'milieu haut', tr: 'coin haut droit', ml: 'milieu gauche', mc: 'centre du brut', mr: 'milieu droit', bl: 'coin bas gauche', bc: 'milieu bas', br: 'coin bas droit' };
const originKey = st => st.originXY === 'c' ? 'mc' : (ORIGIN_LBL[st.originXY] ? st.originXY : 'bl');
function originOf(st) { const o = originKey(st), r = o[0], c = o[1]; return [(c === 'l' ? 0 : c === 'c' ? st.w / 2 : st.w) + (+st.offX || 0), (r === 'b' ? 0 : r === 'm' ? st.h / 2 : st.h) + (+st.offY || 0)]; }
function originLabel(st) { const dx = +st.offX || 0, dy = +st.offY || 0; return ORIGIN_LBL[originKey(st)] + (dx || dy ? ' décalé de X ' + nf(dx) + ' Y ' + nf(dy) + ' mm' : ''); }
const nf = v => { const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
// post-processeurs : tc = mode de changement d'outil ; m6 = format ; g911 = mode IJ incrémental explicite ; head = ligne de sécurité en tête
