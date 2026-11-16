// Reconstruit index.html à partir de src/ (voir commun.js pour l'organisation).
//
//   node outils/assembler.js              écrit index.html
//   node outils/assembler.js --verifier   vérifie seulement que index.html correspond à src/ (code de sortie 1 sinon)
//   node outils/assembler.js --surveiller réassemble index.html à chaque modification d'un fichier de src/
'use strict';
const fs = require('node:fs');
const { SRC, INDEX, lire, assembler } = require('./commun');

// fins de ligne CRLF (éditeur ou Git sous Windows) ou LF : même contenu
const memeTexte = (a, b) => a !== null && a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

function ecrire() {
  const html = assembler();
  const avant = fs.existsSync(INDEX) ? lire(INDEX) : null;
  if (memeTexte(avant, html)) return false;
  fs.writeFileSync(INDEX, html);
  return true;
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--verifier')) {
    const ok = memeTexte(lire(INDEX), assembler());
    console.log(ok ? 'index.html correspond à src/.' : 'index.html ne correspond pas à src/ : lancez « node outils/assembler.js ».');
    process.exitCode = ok ? 0 : 1;
    return;
  }
  console.log(ecrire() ? 'index.html réassemblé.' : 'index.html déjà à jour.');
  if (!args.has('--surveiller')) return;
  console.log('Surveillance de src/ (Ctrl+C pour arrêter)…');
  let t = 0;
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      try {
        if (ecrire()) console.log(new Date().toLocaleTimeString() + '  index.html réassemblé.');
      } catch (e) { console.error(e.message); }
    }, 150);
  });
}

try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
