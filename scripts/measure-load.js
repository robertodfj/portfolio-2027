/**
 * Mide cuánto tarda en estar lista la moto y cuánto se atasca al aparecer.
 *
 *   npm run build && npm run measure
 *   RED=lenta npm run measure      (perfiles: rapida, media, lenta)
 *   CPU=4 npm run measure          (ralentiza la CPU x4, como un móvil medio)
 *
 * Sirve el build como lo haría el hosting y abre la web con la red y la CPU
 * limitadas. Así se reproduce en local lo que pasa en el dominio, donde los
 * GLB llegan por la red de verdad y no desde el disco.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { resolverChrome } = require('./lib/chrome');

const RAIZ = path.resolve('dist/roberto-portfolio/browser');
const PUERTO = 4457;
const REPETICIONES = Number(process.env.REPETICIONES || 3);
const CPU = Number(process.env.CPU || 1);

/** Kbps y ms, a ojo de lo que da una conexión real de cada tipo. */
const REDES = {
  rapida: { down: 50000, up: 10000, latency: 20 },
  media: { down: 10000, up: 3000, latency: 60 },
  lenta: { down: 4000, up: 1000, latency: 150 },
};
const RED = REDES[process.env.RED || 'media'];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm', '.webp': 'image/webp',
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function medir(browser) {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (RED.down * 1024) / 8,
    uploadThroughput: (RED.up * 1024) / 8,
    latency: RED.latency,
  });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  // Bytes por fichero, para saber qué se descarga y cuántas veces.
  const descargas = [];
  cdp.on('Network.loadingFinished', (e) => descargas.push({ id: e.requestId, bytes: e.encodedDataLength }));
  const urls = new Map();
  cdp.on('Network.requestWillBeSent', (e) => urls.set(e.requestId, e.request.url));

  await page.evaluateOnNewDocument(() => {
    window.__largas = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push({ t: e.startTime, d: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  });

  const t0 = Date.now();
  await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });

  // Velo retirado = el visitante ya ve la página.
  await page.waitForFunction(() => !document.querySelector('app-loading-screen'), { timeout: 120000, polling: 50 });
  const velo = Date.now() - t0;

  await page.waitForFunction(() => performance.getEntriesByName('moto:montada').length > 0, {
    timeout: 120000,
    polling: 50,
  });
  const marcas = await page.evaluate(() => {
    const m = (n) => performance.getEntriesByName(n)[0]?.startTime ?? NaN;
    return { inicio: m('moto:inicio'), parseada: m('moto:parseada'), montada: m('moto:montada') };
  });

  // Bloqueo del hilo principal mientras se montaba la moto: es lo que se nota
  // como tirones si el visitante ya está haciendo scroll.
  const bloqueoCarga = await page.evaluate(({ inicio, montada }) =>
    window.__largas.filter((l) => l.t >= inicio && l.t <= montada + 50).reduce((s, l) => s + l.d - 50, 0),
  marcas);

  // Primera aparición: scroll suave hasta "Sobre mí" midiendo cada frame. Aquí
  // es donde se compilan shaders y se suben texturas a la GPU por primera vez.
  const frames = await page.evaluate(async () => {
    const destino = document.getElementById('about').getBoundingClientRect().top + window.scrollY;
    const tiempos = [];
    let previo = performance.now();
    const pasos = 90;
    for (let i = 1; i <= pasos; i++) {
      window.scrollTo(0, (destino * i) / pasos);
      await new Promise((r) => requestAnimationFrame(r));
      const ahora = performance.now();
      tiempos.push(ahora - previo);
      previo = ahora;
    }
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const ahora = performance.now();
      tiempos.push(ahora - previo);
      previo = ahora;
    }
    return tiempos;
  });

  const glb = {};
  for (const d of descargas) {
    const url = urls.get(d.id) || '';
    if (!/\.glb|draco/.test(url)) continue;
    const nombre = url.split('/').pop();
    glb[nombre] = glb[nombre] || { veces: 0, bytes: 0 };
    glb[nombre].veces++;
    glb[nombre].bytes += d.bytes;
  }

  await contexto.close();
  const orden = [...frames].sort((a, b) => a - b);
  return {
    velo,
    motoLista: marcas.montada,
    descargaYParseo: marcas.parseada - marcas.inicio,
    montaje: marcas.montada - marcas.parseada,
    bloqueoCarga,
    peorFrame: orden[orden.length - 1],
    framesMas50: frames.filter((f) => f > 50).length,
    p95: orden[Math.floor(orden.length * 0.95)],
    glb,
  };
}

(async () => {
  if (!fs.existsSync(RAIZ)) {
    console.error('No hay build. Ejecuta antes: npm run build');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const real = path.join(RAIZ, url === '/' ? 'index.html' : url);
    const file = fs.existsSync(real) && !fs.statSync(real).isDirectory() ? real : path.join(RAIZ, 'index.html');
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PUERTO, r));

  // GPU real (D3D11 en Windows): con SwiftShader la subida de texturas mide la
  // CPU, no la tarjeta, y los números no se parecen a los de un navegador.
  const browser = await puppeteer.launch({
    executablePath: resolverChrome(),
    headless: 'new',
    args: process.env.SWIFTSHADER
      ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
      : ['--enable-gpu', '--ignore-gpu-blocklist'],
  });

  console.log(`Red ${process.env.RED || 'media'} (${RED.down / 1000} Mbps, ${RED.latency} ms) · CPU x${CPU} · ${REPETICIONES} pasadas\n`);
  const resultados = [];
  for (let i = 0; i < REPETICIONES; i++) {
    const r = await medir(browser);
    resultados.push(r);
    console.log(
      `#${i + 1}  velo ${r.velo} ms · moto lista ${r.motoLista.toFixed(0)} ms ` +
        `(descarga+parseo ${r.descargaYParseo.toFixed(0)}, montaje ${r.montaje.toFixed(0)}) · ` +
        `bloqueo ${r.bloqueoCarga.toFixed(0)} ms · peor frame ${r.peorFrame.toFixed(0)} ms · ` +
        `>50ms ${r.framesMas50} · p95 ${r.p95.toFixed(1)} ms`,
    );
  }

  const mediana = (k) => {
    const v = resultados.map((r) => r[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  console.log('\nMediana:');
  for (const k of ['velo', 'motoLista', 'descargaYParseo', 'montaje', 'bloqueoCarga', 'peorFrame', 'framesMas50', 'p95']) {
    console.log(`  ${k.padEnd(16)} ${mediana(k).toFixed(0)}`);
  }
  console.log('\nGLB y Draco descargados (última pasada):');
  for (const [n, { veces, bytes }] of Object.entries(resultados[resultados.length - 1].glb)) {
    console.log(`  ${n.padEnd(24)} x${veces}  ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  }

  await browser.close();
  server.close();
})();
