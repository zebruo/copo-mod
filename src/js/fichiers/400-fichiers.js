// ---------- fichiers ----------
let DL = null;
(async () => { try { if (window.claude && window.claude.use) DL = await window.claude.use('downloads'); } catch { DL = null; } })();
