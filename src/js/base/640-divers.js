// ---------- divers ----------
let toastT = 0; function notice(m, btns) { const t = $('#note'); t.querySelector('span').textContent = m; const nb = t.querySelector('.nb'); nb.textContent = ''; for (const b of (btns || []).concat([{ t: '×', x: 1 }])) { const e = document.createElement('button'); e.type = 'button'; e.textContent = b.t; if (b.primary) e.className = 'primary'; if (b.x) { e.className = 'x'; e.title = tr('Fermer'); } e.onclick = () => { t.hidden = true; if (b.fn) b.fn(); }; nb.appendChild(e); } t.hidden = false; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, Math.max(3200, Math.min(9000, String(m).length * 55))); } // en haut de la zone de travail, au-dessus des barres flottantes ; reste affiché plus longtemps quand le message est long
snapLoad();
$('#gridStep').onchange = e => { S.ui.gridStep = +e.target.value; snapSave(); };
gridOptions(); unitsUi(); snapBarSync();
new ResizeObserver(resize).observe(cw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

