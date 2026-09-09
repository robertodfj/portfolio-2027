/**
 * Sirve dist/ aplicando de verdad las cabeceras de src/_headers y carga la web
 * en un navegador real, fallando si el navegador reporta cualquier violación de
 * Content-Security-Policy o si el modelo 3D no llega a cargar.
 *
 *   node scripts/check-csp.js
 *
 * Existe porque una CSP solo se puede probar sirviéndola: un servidor estático
 * que devuelve los ficheros sin cabeceras da un falso "todo correcto" y el
 * fallo aparece en producción.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ = path.resolve('dist/roberto-portfolio/browser');
const PUERTO = 4455;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm', '.txt': 'text/plain', '.xml': 'application/xml',
};

/** Lee el bloque /* de src/_headers y devuelve sus cabeceras. */
function cabecerasGlobales() {
  const texto = fs.readFileSync('src/_headers', 'utf8').replace(/\r\n/g, '\n');
  const cabeceras = {};
  let dentro = false;
  for (const linea of texto.split('\n')) {
    if (linea.startsWith('/')) { dentro = linea.trim() === '/*'; continue; }
    if (!dentro) continue;
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf(':');
    if (i > 0) cabeceras[limpia.slice(0, i)] = limpia.slice(i + 1).trim();
  }
  return cabeceras;
}

(async () => {
  if (!fs.existsSync(RAIZ)) {
    console.error('No hay build. Ejecuta antes: npm run build');
    process.exit(1);
  }

  const cabeceras = cabecerasGlobales();
  console.log('CSP servida:\n  ' + (cabeceras['Content-Security-Policy'] ?? '(ninguna)') + '\n');

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(RAIZ, url === '/' ? 'index.html' : url);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(RAIZ, 'index.html');
    for (const [k, v] of Object.entries(cabeceras)) res.setHeader(k, v);
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PUERTO, r));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const violaciones = [];
  const otros = [];
  page.on('console', (m) => {
    const texto = m.text();
    const loc = m.location();
    const donde = loc?.url ? ` [${loc.url}:${loc.lineNumber}]` : '';
    if (/Content Security Policy|Refused to|violates the following/i.test(texto)) violaciones.push(texto + donde);
    else if (m.type() === 'error') otros.push(texto + donde);
    else if (m.type() === 'warning' && /ModelLoaderService|GLTFLoader/.test(texto)) otros.push('[warn] ' + texto);
  });
  page.on('pageerror', (e) => otros.push('[pageerror] ' + e.message));

  await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  // El personaje tiene 15 s de margen de carga; se espera algo más.
  await new Promise((r) => setTimeout(r, 20000));

  // Si el GLB no carga, entra el personaje suplente y se anuncia por a11y.
  // El aviso de suplente es el unico .visually-hidden fuera de un formulario.
  const suplente = otros.some((t) => /No se pudo cargar/.test(t));

  console.log(`violaciones de CSP: ${violaciones.length}`);
  for (const v of [...new Set(violaciones)].slice(0, 10)) console.log('  · ' + v);
  console.log(`otros errores: ${otros.length}`);
  for (const o of [...new Set(otros)].slice(0, 10)) console.log('  · ' + o.slice(0, 160));
  console.log(`personaje 3D: ${suplente ? 'SUPLENTE (el GLB no cargó)' : 'modelo real cargado'}`);

  if (process.env.CAPTURA) {
    await page.screenshot({ path: process.env.CAPTURA });
    console.log('captura: ' + process.env.CAPTURA);
  }

  await browser.close();
  server.close();

  const fallo = violaciones.length > 0 || suplente;
  console.log('\n' + (fallo ? 'FALLO' : 'CORRECTO'));
  process.exit(fallo ? 1 : 0);
})();
