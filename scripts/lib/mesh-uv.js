/**
 * Utilidades compartidas por los scripts de textura: cargar el GLB con Draco,
 * agrupar la malla en piezas y rasterizar sus UV sobre el mapa.
 */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const draco3d = require('draco3dgltf');

async function abrirGlb(ruta) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = await io.read(ruta);
  return { io, doc };
}

/** Union-Find sencillo con compresión de caminos. */
function crearUnionFind(n) {
  const padre = new Int32Array(n);
  for (let i = 0; i < n; i++) padre[i] = i;
  const find = (a) => {
    while (padre[a] !== a) { padre[a] = padre[padre[a]]; a = padre[a]; }
    return a;
  };
  return { find, une: (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) padre[ra] = rb; } };
}

/**
 * Agrupa los triángulos en PIEZAS geométricas: dos triángulos son de la misma
 * pieza si comparten una posición en el espacio, aunque sean vértices
 * distintos (en las costuras de UV el vértice se duplica pero la posición no).
 *
 * Devuelve un id de pieza por triángulo.
 */
function piezasGeometricas(pos, idx, count) {
  // La tolerancia de soldadura va RELATIVA al tamaño del modelo: este GLB mide
  // 0.01 unidades de alto, así que un redondeo fijo a 4 decimales fusionaría la
  // figura entera en un puñado de puntos.
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = pos[i * 3 + 1];
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const escala = 1e6 / Math.max(1e-9, max - min);

  const porClave = new Map();
  const soldado = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const k =
      Math.round(pos[i * 3] * escala) +
      ',' +
      Math.round(pos[i * 3 + 1] * escala) +
      ',' +
      Math.round(pos[i * 3 + 2] * escala);
    let r = porClave.get(k);
    if (r === undefined) { r = porClave.size; porClave.set(k, r); }
    soldado[i] = r;
  }

  const uf = crearUnionFind(porClave.size);
  for (let t = 0; t < idx.length; t += 3) {
    uf.une(soldado[idx[t]], soldado[idx[t + 1]]);
    uf.une(soldado[idx[t + 1]], soldado[idx[t + 2]]);
  }

  const ids = new Map();
  const piezaDeTri = new Int32Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) {
    const r = uf.find(soldado[idx[t]]);
    let id = ids.get(r);
    if (id === undefined) { id = ids.size; ids.set(r, id); }
    piezaDeTri[t / 3] = id;
  }

  return { piezaDeTri, total: ids.size, verticesSoldados: porClave.size };
}

/**
 * Rasteriza los triángulos sobre un mapa de N x N guardando, en cada téxel, el
 * valor que se le pase por triángulo (id de pieza, o 1 para una simple máscara).
 *
 * `dilatarTri` ensancha cada triángulo medio téxel: sin eso quedan huecos de un
 * píxel entre triángulos adyacentes por el redondeo del centro de téxel.
 */
function rasterizar(uv, idx, N, valorDeTri, vacio = -1) {
  const salida = new Int32Array(N * N).fill(vacio);
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

  for (let t = 0; t < idx.length; t += 3) {
    const valor = valorDeTri(t / 3);
    const p = [0, 1, 2].map((k) => {
      const i = idx[t + k];
      // glTF tiene el origen de UV ARRIBA a la izquierda: la fila de la
      // imagen es v * N directamente, sin invertir.
      return [uv[i * 2] * N, uv[i * 2 + 1] * N];
    });

    const total = area(p[0], p[1], p[2]);
    if (Math.abs(total) < 1e-12) continue;

    const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])) - 1);
    const maxX = Math.min(N - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])) + 1);
    const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])) - 1);
    const maxY = Math.min(N - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])) + 1);

    // Tolerancia en unidades de téxel, escalada por el tamaño del triángulo.
    const tol = 0.7 / Math.max(1e-6, Math.abs(total));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const q = [x + 0.5, y + 0.5];
        const w0 = area(p[1], p[2], q) / total;
        const w1 = area(p[2], p[0], q) / total;
        const w2 = area(p[0], p[1], q) / total;
        if (w0 >= -tol && w1 >= -tol && w2 >= -tol) salida[y * N + x] = valor;
      }
    }
  }
  return salida;
}

module.exports = { abrirGlb, crearUnionFind, piezasGeometricas, rasterizar };
