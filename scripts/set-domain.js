/**
 * Cambia el dominio público en los cuatro sitios donde aparece.
 *
 *   node scripts/set-domain.js https://tudominio.com
 *
 * Existe porque el dominio está en index.html (canonical, Open Graph, JSON-LD),
 * robots.txt y sitemap.xml: cambiarlo a mano es olvidarse de uno y publicar con
 * la vista previa rota o el canonical apuntando a otro sitio.
 */
const fs = require('fs');

const nuevo = process.argv[2];
if (!nuevo || !/^https?:\/\//.test(nuevo)) {
  console.error('Uso: node scripts/set-domain.js https://tudominio.com');
  process.exit(1);
}
const base = nuevo.replace(/\/+$/, '');

const FICHEROS = ['src/index.html', 'src/robots.txt', 'src/sitemap.xml'];
const ANTERIOR = /https?:\/\/[a-z0-9.-]+(?:\.[a-z]{2,}|:\d+)/gi;

let total = 0;
for (const fichero of FICHEROS) {
  const original = fs.readFileSync(fichero, 'utf8');
  let n = 0;
  const salida = original.replace(ANTERIOR, (url) => {
    // Solo el dominio propio: schema.org y demás referencias externas se quedan.
    if (/schema\.org|github\.com|linkedin\.com|fonts\.|gstatic/.test(url)) return url;
    n++;
    return base;
  });
  if (n) fs.writeFileSync(fichero, salida);
  console.log(`${fichero}: ${n} sustituciones`);
  total += n;
}
console.log(`\n${total} referencias apuntando ahora a ${base}`);
