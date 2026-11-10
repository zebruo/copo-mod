// ---------- import PDF / AI (tracés vectoriels de la première page, courbes conservées ; PDF.js chargé à la demande) ----------
let pdfjsP = null;
function pdfjsLoad() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfjsP || (pdfjsP = new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'lib/pdf.js'; sc.onload = () => { if (!window.pdfjsLib) return ko(new Error('PDF.js')); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.js'; ok(window.pdfjsLib); }; sc.onerror = () => { pdfjsP = null; ko(new Error('Le lecteur de PDF n’a pas pu se charger : vérifiez la connexion ou ouvrez COPO depuis le site.')); }; document.head.appendChild(sc); }));
}
async function importPdfFile(f) {
  try {
    const buf = await f.arrayBuffer(), head = new TextDecoder('latin1').decode(new Uint8Array(buf, 0, Math.min(1024, buf.byteLength)));
    if (!/%PDF-/.test(head)) throw new Error(/^%!PS/.test(head) ? 'Ce fichier AI est d’un ancien format (PostScript) : réenregistrez-le depuis Illustrator avec « Créer un fichier compatible PDF », ou exportez-le en PDF ou en SVG.' : 'Ce fichier n’est pas un PDF lisible.');
    toast('Lecture du fichier…');
    const lib = await pdfjsLoad(), doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const r = await importPDFDoc(doc, lib); commit(); renderSel(); fit(); setTool('select');
    toast(trf('{n} vecteur(s) importé(s) en mm, courbes conservées', { n: r.n }) + (r.pages > 1 ? ' (' + trf('page 1 sur {p}', { p: r.pages }) + ')' : '') + (r.text ? '. ' + tr('Les textes non vectorisés sont ignorés : vectorisez-les avant l’export.') : '.'));
  } catch (e) { toast(e.message || 'Fichier illisible.'); }
}
async function importPDFDoc(doc, lib) {
  const page = await doc.getPage(1), ol = await page.getOperatorList(), O = lib.OPS, k = 25.4 / 72, out = [];
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  let M = [1, 0, 0, 1, 0, 0], text = false; const stack = [], PAINT = new Set([O.stroke, O.closeStroke, O.fill, O.eoFill, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke].filter(v => v !== undefined));
  let pend = null;
  const build = (ops, c, T) => { // sous-chemins en nœuds de Bézier, en mm
    const P = (x, y) => [(T[0] * x + T[2] * y + T[4]) * k, (T[1] * x + T[3] * y + T[5]) * k], subs = []; let cur = null, j = 0, cx = 0, cy = 0, sx = 0, sy = 0;
    const flush = () => { if (cur && cur.nodes.length > 1) subs.push(cur); cur = null; };
    const start = () => { if (!cur) { const p = P(cx, cy); cur = { nodes: [NODE(p[0], p[1])], closed: false }; } };
    const cub = (x1, y1, x2, y2, x3, y3) => { start(); const l = cur.nodes[cur.nodes.length - 1], a = P(x1, y1), b = P(x2, y2), e = P(x3, y3); l.o = [a[0] - l.x, a[1] - l.y]; cur.nodes.push(NODE(e[0], e[1], [b[0] - e[0], b[1] - e[1]])); cx = x3; cy = y3; };
    const close = () => { if (cur) { const a = cur.nodes[0], b = cur.nodes[cur.nodes.length - 1]; if (cur.nodes.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) { a.i = b.i; cur.nodes.pop(); } cur.closed = true; flush(); } cx = sx; cy = sy; };
    for (const op of ops) {
      if (op === O.moveTo) { flush(); cx = sx = c[j++]; cy = sy = c[j++]; start(); }
      else if (op === O.lineTo) { start(); cx = c[j++]; cy = c[j++]; const p = P(cx, cy); cur.nodes.push(NODE(p[0], p[1])); }
      else if (op === O.curveTo) { const v = c.slice(j, j + 6); j += 6; cub(...v); }
      else if (op === O.curveTo2) { const v = c.slice(j, j + 4); j += 4; cub(cx, cy, v[0], v[1], v[2], v[3]); } // v : 1er point de contrôle = point courant
      else if (op === O.curveTo3) { const v = c.slice(j, j + 4); j += 4; cub(v[0], v[1], v[2], v[3], v[2], v[3]); } // y : 2e point de contrôle = point final
      else if (op === O.closePath) close();
      else if (op === O.rectangle) { flush(); const x = c[j++], y = c[j++], w = c[j++], h = c[j++]; cx = sx = x; cy = sy = y; const q = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => P(a, b)); subs.push({ nodes: q.map(p => NODE(p[0], p[1])), closed: true }); }
    }
    flush(); return subs;
  };
  const F = ol.fnArray, A = ol.argsArray;
  for (let i = 0; i < F.length; i++) {
    const fn = F[i], a = A[i];
    if (fn === O.save) stack.push(M);
    else if (fn === O.restore) { M = stack.pop() || [1, 0, 0, 1, 0, 0]; pend = null; }
    else if (fn === O.transform) M = mul(M, a);
    else if (fn === O.paintFormXObjectBegin) { stack.push(M); if (a && a[0]) M = mul(M, a[0]); }
    else if (fn === O.paintFormXObjectEnd) M = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.constructPath) pend = build(a[0], a[1], M); // le tracé n'est gardé que s'il est peint (pas les masques de détourage)
    else if (PAINT.has(fn)) { if (pend) for (const sp of pend) { const sh = { nodes: sp.nodes, closed: sp.closed }; refresh(sh); if (sh.pts && sh.pts.length > 1) out.push(sh); } pend = null; }
    else if (fn === O.endPath || fn === O.clip || fn === O.eoClip) { if (fn === O.endPath) pend = null; }
    else if (fn === O.showText || fn === O.showSpacedText) text = true;
  }
  // un même tracé peint deux fois (fond + contour) n'est gardé qu'une fois
  const key = s => s.nodes.length + ':' + s.nodes.map(n => n.x.toFixed(3) + ',' + n.y.toFixed(3)).join(';'), seen = new Set(), uniq = out.filter(s => { const q = key(s); if (seen.has(q)) return false; seen.add(q); return true; });
  if (!uniq.length) throw new Error(text ? 'Aucun vecteur dans ce fichier, seulement du texte : vectorisez les textes (Illustrator : Texte › Vectoriser) puis réexportez.' : 'Aucun vecteur trouvé (le fichier ne contient peut-être qu’une image).');
  const n = placeImported(uniq); return { n, pages: doc.numPages, text };
}


