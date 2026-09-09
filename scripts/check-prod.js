/**
 * Comprobación de producción de extremo a extremo.
 *
 *   npm run build && npm run check:prod
 *
 * Sirve el build con las cabeceras reales de src/_headers y recorre la web en un
 * navegador de verdad: las dos temáticas, los dos idiomas, todas las secciones y
 * también en móvil. Falla si aparece cualquier error de consola, cualquier
 * violación de CSP, cualquier recurso que no cargue o si el modelo 3D no llega.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ = path.resolve('dist/roberto-portfolio/browser');
const PUERTO = 4456;
const CAPTURAS = process.env.CAPTURAS;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm', '.txt': 'text/plain', '.xml': 'application/xml',
};

const SECCIONES = ['top', 'about', 'experience', 'technologies', 'projects', 'contact'];

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

const problemas = [];
const anota = (bloque, texto) => problemas.push(`[${bloque}] ${texto}`);

/** Engancha la captura de errores, CSP y peticiones fallidas a una pestaña. */
function vigilar(page, bloque) {
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to|violates the following/i.test(t)) anota(bloque, 'CSP: ' + t.slice(0, 120));
    else if (m.type() === 'error') anota(bloque, 'consola: ' + t.slice(0, 140));
    else if (m.type() === 'warning' && /No se pudo cargar|GLTFLoader/.test(t)) anota(bloque, 'aviso: ' + t.slice(0, 140));
  });
  page.on('pageerror', (e) => anota(bloque, 'excepción: ' + e.message.slice(0, 140)));
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    if (/ERR_ABORTED/.test(err)) return; // cancelaciones normales al navegar
    anota(bloque, `petición fallida: ${r.url().slice(0, 90)} (${err})`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) anota(bloque, `HTTP ${r.status()}: ${r.url().slice(0, 90)}`);
  });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(RAIZ)) {
    console.error('No hay build. Ejecuta antes: npm run build');
    process.exit(1);
  }
  if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });

  const cabeceras = cabecerasGlobales();
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const real = path.join(RAIZ, url === '/' ? 'index.html' : url);
    const existe = fs.existsSync(real) && !fs.statSync(real).isDirectory();
    // Igual que Netlify: lo que no existe cae en index.html, pero con 404 para
    // que la comprobación distinga un asset que falta de una ruta de la SPA.
    const file = existe ? real : path.join(RAIZ, 'index.html');
    if (!existe && path.extname(url)) res.statusCode = 404;
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

  // --- 1. Recorrido completo en escritorio, tema oscuro y claro ------------
  for (const tema of ['oscuro', 'claro']) {
    const contexto = await browser.createBrowserContext();
    const page = await contexto.newPage();
    vigilar(page, tema);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'networkidle2', timeout: 90000 });
    await esperar(6000);

    if (tema === 'claro') {
      await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
      await esperar(1500);
    }

    for (const id of SECCIONES) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), id);
      await esperar(2200);
      if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `${tema}-${id}.png`) });
    }

    // El modelo real tiene que haber cargado, no el suplente.
    const suplente = problemas.some((p) => p.startsWith(`[${tema}]`) && /No se pudo cargar/.test(p));
    if (suplente) anota(tema, 'el GLB no cargó: escena con personaje suplente');

    await page.close();
    await contexto.close();
  }

  // --- 2. Cambio de idioma -------------------------------------------------
  {
    const contexto = await browser.createBrowserContext();
    const page = await contexto.newPage();
    vigilar(page, 'idioma');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'networkidle2', timeout: 90000 });
    await esperar(5000);

    const es = await page.evaluate(() => document.querySelector('.nav__link')?.textContent?.trim());
    await page.evaluate(() => {
      const botones = document.querySelectorAll('.lang__flag');
      botones[botones.length - 1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await esperar(2500);
    const en = await page.evaluate(() => document.querySelector('.nav__link')?.textContent?.trim());

    if (!es || !en) anota('idioma', 'no se pudo leer el primer enlace de navegación');
    else if (es === en) anota('idioma', `el texto no cambió al pulsar inglés ("${es}")`);
    else console.log(`idioma: "${es}"  ->  "${en}"`);

    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, 'idioma-en.png') });
    await page.close();
    await contexto.close();
  }

  // --- 3. Móvil ------------------------------------------------------------
  {
    const contexto = await browser.createBrowserContext();
    const page = await contexto.newPage();
    vigilar(page, 'móvil');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'networkidle2', timeout: 90000 });
    await esperar(6000);

    // El menú plegado no debe ser alcanzable con el teclado.
    const menuOculto = await page.evaluate(() => {
      const nav = document.querySelector('.nav__links');
      return !!nav && (nav.hasAttribute('inert') || getComputedStyle(nav).visibility === 'hidden');
    });
    if (!menuOculto) anota('móvil', 'el menú plegado sigue siendo accesible (falta inert/visibility)');

    // Nada debe desbordar a lo ancho.
    const desborde = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (desborde > 2) anota('móvil', `scroll horizontal de ${desborde}px`);

    for (const id of ['about', 'projects', 'contact']) {
      await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), id);
      await esperar(2000);
      if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `movil-${id}.png`) });
    }
    await page.close();
    await contexto.close();
  }

  // --- 4. Movimiento reducido: el narrativo debe seguir estando ------------
  {
    const contexto = await browser.createBrowserContext();
    const page = await contexto.newPage();
    vigilar(page, 'movimiento reducido');
    await page.setViewport({ width: 1440, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'networkidle2', timeout: 90000 });
    await esperar(6000);
    await page.evaluate(() => document.getElementById('about')?.scrollIntoView({ block: 'start' }));
    await esperar(2500);
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, 'reducido-about.png') });
    await page.close();
    await contexto.close();
  }

  await browser.close();
  server.close();

  console.log('');
  if (!problemas.length) {
    console.log('CORRECTO: sin errores de consola, sin violaciones de CSP y sin recursos que fallen.');
    process.exit(0);
  }
  console.log(`PROBLEMAS (${problemas.length}):`);
  for (const p of [...new Set(problemas)]) console.log('  · ' + p);
  process.exit(1);
})();
