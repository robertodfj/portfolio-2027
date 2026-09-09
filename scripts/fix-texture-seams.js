/**
 * Corrige las "cicatrices" de la textura del personaje.
 *
 *   node scripts/fix-texture-seams.js [--ancho N] [--dry]
 *
 * EL PROBLEMA
 * El atlas no tiene separación entre zonas: el 56 % de los bordes está pegado a
 * otra zona sin un solo téxel de hueco. Y no vale con mirar "islas UV", porque
 * casi toda la malla es UNA sola isla que serpentea por el mapa: partes muy
 * lejanas del cuerpo (el torso y el brazo, por ejemplo) acaban una al lado de
 * la otra en el atlas.
 *
 * Al muestrear justo en ese límite, el filtrado bilineal y los mipmaps mezclan
 * las dos zonas y aparece una raya con el color de la otra: piel sobre la ropa
 * en el centro del torso, el bajo de la camiseta, la rodilla o el tobillo.
 *
 * Se comprobó pintando de verde todo lo que queda fuera de las UV: las rayas
 * salieron verdes, es decir, se está leyendo territorio ajeno.
 *
 * LA CORRECCIÓN
 * La clave es agrupar los téxeles por CONTINUIDAD EN 3D, no por isla UV: dos
 * téxeles vecinos en el mapa pertenecen a la misma zona solo si sus posiciones
 * en el modelo también están juntas. Con eso:
 *   1. Se reparan los ANCHO téxeles del borde de cada zona con el color del
 *      téxel sano más cercano DE SU MISMA ZONA.
 *   2. Se rellena el hueco del atlas con el color de la zona más cercana.
 * Así ningún téxel del borde conserva color de una parte distinta del cuerpo.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { abrirGlb } = require('./lib/mesh-uv');

const { resolverChrome } = require('./lib/chrome');
const CHROME = resolverChrome();
const MODELO = 'src/assets/models/roberto.glb';
const SALIDA = 'textura-roberto';
const VACIO = -1;

/** Téxeles del borde de cada zona que se consideran contaminados. */
const ANCHO_POR_DEFECTO = 6;

/**
 * Salto en 3D, como fracción de la altura del modelo, a partir del cual dos
 * téxeles vecinos en el atlas se consideran de zonas distintas.
 *
 * Medido sobre este GLB: los vecinos de una superficie continua se agrupan
 * en torno a 3e-4, y hay una cola clara por encima de 3e-3. El umbral cae en
 * ese hueco, así que no depende de afinar un número a ojo.
 */
const SALTO_3D = 3e-3;

function leerArg(nombre, pordefecto) {
  const i = process.argv.indexOf(nombre);
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : pordefecto;
}

(async () => {
  const ancho = leerArg('--ancho', ANCHO_POR_DEFECTO);
  const seco = process.argv.includes('--dry');

  const { doc } = await abrirGlb(MODELO);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();

  // --- 1. Leer la textura ---------------------------------------------------
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  const b64 = Buffer.from(doc.getRoot().listTextures()[0].getImage()).toString('base64');
  const { N, datos } = await page.evaluate(async (src) => {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.width);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    return { N: bmp.width, datos: Array.from(ctx.getImageData(0, 0, bmp.width, bmp.width).data) };
  }, 'data:image/jpeg;base64,' + b64);

  const px = new Uint8ClampedArray(datos);
  const salida = new Uint8ClampedArray(px);
  console.log(`textura ${N}x${N}, banda de reparación: ${ancho} téxeles`);

  // --- 2. Rasterizar guardando la posición 3D de cada téxel ----------------
  const P = new Float32Array(N * N * 3);
  const cubierto = new Uint8Array(N * N);
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

  const marca = (x, y, w, I) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const k = (y * N + x) * 3;
    for (let c = 0; c < 3; c++) {
      P[k + c] = w[0] * pos[I[0] * 3 + c] + w[1] * pos[I[1] * 3 + c] + w[2] * pos[I[2] * 3 + c];
    }
    cubierto[y * N + x] = 1;
  };

  for (let t = 0; t < idx.length; t += 3) {
    const I = [idx[t], idx[t + 1], idx[t + 2]];
    // glTF: origen de UV arriba a la izquierda, la fila es v * N sin invertir.
    const p = I.map((i) => [uv[i * 2] * N, uv[i * 2 + 1] * N]);
    const tot = area(p[0], p[1], p[2]);
    if (Math.abs(tot) < 1e-12) continue;

    // Los vértices siempre marcan su téxel: sin esto, los triángulos muy
    // pequeños se pierden entre centros de téxel y dejan huecos en la máscara.
    marca(Math.floor(p[0][0]), Math.floor(p[0][1]), [1, 0, 0], I);
    marca(Math.floor(p[1][0]), Math.floor(p[1][1]), [0, 1, 0], I);
    marca(Math.floor(p[2][0]), Math.floor(p[2][1]), [0, 0, 1], I);

    const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])) - 1);
    const maxX = Math.min(N - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])) + 1);
    const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])) - 1);
    const maxY = Math.min(N - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])) + 1);
    const tol = 0.7 / Math.max(1e-6, Math.abs(tot));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const q = [x + 0.5, y + 0.5];
        const w0 = area(p[1], p[2], q) / tot;
        const w1 = area(p[2], p[0], q) / tot;
        const w2 = area(p[0], p[1], q) / tot;
        if (w0 < -tol || w1 < -tol || w2 < -tol) continue;
        marca(x, y, [w0, w1, w2], I);
      }
    }
  }

  let nCub = 0;
  for (let i = 0; i < N * N; i++) nCub += cubierto[i];
  console.log(`téxeles usados por la malla: ${nCub.toLocaleString()} (${((nCub / (N * N)) * 100).toFixed(1)}%)`);

  // --- 3. Zonas por continuidad 3D -----------------------------------------
  let minY3 = Infinity;
  let maxY3 = -Infinity;
  for (let i = 0; i < prim.getAttribute('POSITION').getCount(); i++) {
    const y = pos[i * 3 + 1];
    if (y < minY3) minY3 = y;
    if (y > maxY3) maxY3 = y;
  }
  const umbral = (maxY3 - minY3) * SALTO_3D;
  const junto = (a, b) =>
    Math.abs(P[a * 3] - P[b * 3]) + Math.abs(P[a * 3 + 1] - P[b * 3 + 1]) + Math.abs(P[a * 3 + 2] - P[b * 3 + 2]) <
    umbral * 3;

  const zona = new Int32Array(N * N).fill(VACIO);
  const pila = new Int32Array(N * N);
  let nZonas = 0;
  for (let inicio = 0; inicio < N * N; inicio++) {
    if (!cubierto[inicio] || zona[inicio] !== VACIO) continue;
    const id = nZonas++;
    let tope = 0;
    pila[tope++] = inicio;
    zona[inicio] = id;
    while (tope) {
      const t = pila[--tope];
      const x = t % N, y = (t / N) | 0;
      for (const v of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, y > 0 ? t - N : -1, y < N - 1 ? t + N : -1]) {
        if (v < 0 || !cubierto[v] || zona[v] !== VACIO || !junto(t, v)) continue;
        zona[v] = id;
        pila[tope++] = v;
      }
    }
  }
  console.log(`zonas por continuidad 3D: ${nZonas.toLocaleString()}`);

  // --- 4. Distancia al borde de la zona ------------------------------------
  const dist = new Int16Array(N * N).fill(-1);
  const cola = new Int32Array(N * N);
  let tope = 0;
  for (let t = 0; t < N * N; t++) {
    const a = zona[t];
    if (a === VACIO) continue;
    const x = t % N, y = (t / N) | 0;
    if (
      x === 0 || zona[t - 1] !== a ||
      x === N - 1 || zona[t + 1] !== a ||
      y === 0 || zona[t - N] !== a ||
      y === N - 1 || zona[t + N] !== a
    ) { dist[t] = 0; cola[tope++] = t; }
  }
  console.log(`téxeles en borde de zona: ${tope.toLocaleString()}`);
  for (let q = 0; q < tope; q++) {
    const t = cola[q];
    const x = t % N, y = (t / N) | 0;
    const a = zona[t];
    for (const v of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, y > 0 ? t - N : -1, y < N - 1 ? t + N : -1]) {
      if (v < 0 || zona[v] !== a || dist[v] >= 0) continue;
      dist[v] = dist[t] + 1;
      cola[tope++] = v;
    }
  }

  // Zonas finas: no se puede reparar `ancho` sin borrarlas enteras.
  const profundidad = new Int32Array(nZonas);
  for (let t = 0; t < N * N; t++) {
    const a = zona[t];
    if (a !== VACIO && dist[t] > profundidad[a]) profundidad[a] = dist[t];
  }

  // --- 5. Reparar el borde con color de la propia zona ---------------------
  const fuente = new Int32Array(N * N).fill(-1);
  let bn = 0;
  for (let t = 0; t < N * N; t++) {
    const a = zona[t];
    if (a === VACIO) continue;
    if (dist[t] > Math.min(ancho, Math.floor(profundidad[a] / 2))) { fuente[t] = t; cola[bn++] = t; }
  }
  console.log(`téxeles sanos de partida: ${bn.toLocaleString()}`);
  for (let q = 0; q < bn; q++) {
    const t = cola[q];
    const x = t % N, y = (t / N) | 0;
    const a = zona[t];
    for (const v of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, y > 0 ? t - N : -1, y < N - 1 ? t + N : -1]) {
      if (v < 0 || zona[v] !== a || fuente[v] >= 0) continue;
      fuente[v] = fuente[t];
      cola[bn++] = v;
    }
  }

  let reparados = 0;
  for (let t = 0; t < N * N; t++) {
    const f = fuente[t];
    if (f < 0 || f === t) continue;
    salida[t * 4] = px[f * 4];
    salida[t * 4 + 1] = px[f * 4 + 1];
    salida[t * 4 + 2] = px[f * 4 + 2];
    salida[t * 4 + 3] = 255;
    reparados++;
  }
  console.log(`téxeles de borde reparados: ${reparados.toLocaleString()}`);

  // --- 6. Dilatar hacia el hueco del atlas ---------------------------------
  const dilat = new Int32Array(N * N).fill(-1);
  let dn = 0;
  for (let t = 0; t < N * N; t++) if (cubierto[t]) { dilat[t] = t; cola[dn++] = t; }
  for (let q = 0; q < dn; q++) {
    const t = cola[q];
    const x = t % N, y = (t / N) | 0;
    for (const v of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, y > 0 ? t - N : -1, y < N - 1 ? t + N : -1]) {
      if (v < 0 || dilat[v] >= 0) continue;
      dilat[v] = dilat[t];
      cola[dn++] = v;
    }
  }
  let rellenados = 0;
  for (let t = 0; t < N * N; t++) {
    if (cubierto[t]) continue;
    const f = dilat[t];
    if (f < 0) continue;
    salida[t * 4] = salida[f * 4];
    salida[t * 4 + 1] = salida[f * 4 + 1];
    salida[t * 4 + 2] = salida[f * 4 + 2];
    salida[t * 4 + 3] = 255;
    rellenados++;
  }
  console.log(`téxeles de hueco rellenados: ${rellenados.toLocaleString()}`);

  // --- 7. Guardar -----------------------------------------------------------
  fs.mkdirSync(SALIDA, { recursive: true });
  const dataUrl = await page.evaluate(
    async (d, n) => {
      const c = new OffscreenCanvas(n, n);
      const ctx = c.getContext('2d');
      ctx.putImageData(new ImageData(new Uint8ClampedArray(d), n, n), 0, 0);
      // Calidad alta: la reparación crea bordes duros y un JPEG flojo volvería
      // a difuminarlos, que es justo el problema que se está arreglando.
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
      return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    },
    Array.from(salida), N,
  );
  await browser.close();

  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const destino = path.join(SALIDA, 'baseColor-corregida.jpg');
  fs.writeFileSync(destino, buf);
  console.log(`\n${destino}  (${(buf.length / 1024).toFixed(0)} KB)`);
  if (seco) console.log('modo --dry: no se ha tocado el GLB.');
})();
