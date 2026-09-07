const fs = require('fs');
const path = require('path');

const URL =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';

// Con un UA moderno Google sirve woff2; con uno antiguo devolvería ttf.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const OUT_DIR = 'src/assets/fonts';

(async () => {
  const css = await (await fetch(URL, { headers: { 'User-Agent': UA } })).text();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Cada bloque @font-face viene precedido de un comentario con el subconjunto.
  const blocks = css.split('/*').filter(Boolean);
  const kept = [];
  let downloaded = 0;

  for (const block of blocks) {
    const subsetMatch = block.match(/^\s*([a-z-]+)\s*\*\//);
    const subset = subsetMatch ? subsetMatch[1] : '';
    // Solo latin: cubre los acentos del español y del inglés. Los demas
    // subconjuntos multiplican por seis el peso sin aportar nada aqui.
    if (subset !== 'latin') continue;

    let face = '@font-face' + block.split('@font-face')[1];
    const urlMatch = face.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!urlMatch) continue;

    const family = (face.match(/font-family:\s*'([^']+)'/) || [])[1].replace(/\s+/g, '');
    const weight = (face.match(/font-weight:\s*(\d+)/) || [])[1];
    const name = `${family}-${weight}-${subset}.woff2`;

    const bin = Buffer.from(await (await fetch(urlMatch[1])).arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, name), bin);
    downloaded++;

    face = face.replace(urlMatch[0], `url('./${name}')`);
    kept.push(face.trim());
  }

  const header = `/* Fuentes autoalojadas. Se sirven desde el propio dominio para no enviar la
   IP del visitante a Google (RGPD) y para ahorrar la conexión al CDN.
   Regenerar con scripts/fonts.js si se cambia alguna familia o peso. */\n\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'fonts.css'), header + kept.join('\n\n') + '\n');
  console.log(`${downloaded} ficheros woff2 descargados en ${OUT_DIR}`);
})();
