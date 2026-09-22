/**
 * Genera src/assets/models/motorbike.glb a partir del ORIGINAL guardado en git.
 *
 *   node scripts/optimize-models.js
 *
 * Parte siempre del export original de Sketchfab (commit ORIGEN), nunca del
 * fichero ya optimizado. Así se puede ejecutar las veces que haga falta sin
 * encadenar pasadas con pérdida: Draco y WebP recomprimidos sobre sí mismos
 * degradan la calidad sin avisar.
 *
 * Qué hace, y por qué, en orden:
 *
 *  1. Hornea el skinning. La moto trae 12 esqueletos de Sketchfab sin ninguna
 *     animación: son solo la pose en la que quedó. Una SkinnedMesh cuesta
 *     4 multiplicaciones de matriz por vértice en cada frame y no se puede
 *     unir con otras. Se escribe la pose en los vértices y se quitan los huesos:
 *     misma forma exacta, malla estática.
 *  2. Cambia el cristal con transmission por transparencia normal. Con un solo
 *     material con transmission en escena, three.js renderiza TODO dos veces por
 *     frame (una para lo que se ve a través del cristal). Para un parabrisas
 *     del tamaño de una uña no merece la pena.
 *  3. Une las mallas que comparten material (menos draw calls), simplifica la
 *     geometría densa y quita los atributos que ningún material usa.
 *  4. Texturas a WebP: color a 1024, el resto (normal, rugosidad...) a 512,
 *     que es donde menos se nota. Y geometría con Draco.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');
const {
  dedup,
  draco,
  join,
  prune,
  simplify,
  textureCompress,
  weld,
  flatten,
} = require('@gltf-transform/functions');
const { abrirGlb } = require('./lib/mesh-uv');

/** Commit con el export original de la moto (38 MB, sin comprimir). */
const ORIGEN = '079b2fe2';
const DESTINO = 'src/assets/models/motorbike.glb';

/* ------------------------------------------------------------ 4x4 column-major */
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

/**
 * Escribe en los vértices la pose que three.js pinta hoy y quita el esqueleto.
 *
 * Como manda el estándar glTF, la transformación del nodo de una malla con
 * skin se ignora: el vértice en mundo es  Σ wᵢ · (Jᵢ · IBMᵢ) · v. GLTFLoader
 * hace lo mismo (enlaza con bindMatrix identidad). Eso es lo que se hornea, y
 * el nodo pasa a colgar de la raíz sin transformación.
 */
function hornearSkinning(doc) {
  const root = doc.getRoot();
  const escena = root.listScenes()[0];
  let mallas = 0;

  for (const nodo of root.listNodes()) {
    const skin = nodo.getSkin();
    const mesh = nodo.getMesh();
    if (!skin || !mesh) continue;

    const ibm = skin.getInverseBindMatrices().getArray();
    const huesos = skin.listJoints().map((j, i) => mul(j.getWorldMatrix(), Array.from(ibm.slice(i * 16, i * 16 + 16))));

    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const tan = prim.getAttribute('TANGENT');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      if (!pos || !joints || !weights) continue;

      const j = [0, 0, 0, 0];
      const w = [0, 0, 0, 0];
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        joints.getElement(i, j);
        weights.getElement(i, w);
        const P = new Array(16).fill(0);
        for (let k = 0; k < 4; k++) {
          if (!w[k]) continue;
          const H = huesos[j[k]];
          for (let e = 0; e < 16; e++) P[e] += w[k] * H[e];
        }
        const M = P;

        pos.getElement(i, v);
        pos.setElement(i, [
          M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12],
          M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13],
          M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14],
        ]);

        // Direcciones: solo la parte 3x3, y renormalizadas (la escala del
        // export es uniforme, así que no hace falta la inversa transpuesta).
        const rota = (x, y, z) => {
          const r = [M[0] * x + M[4] * y + M[8] * z, M[1] * x + M[5] * y + M[9] * z, M[2] * x + M[6] * y + M[10] * z];
          const l = Math.hypot(r[0], r[1], r[2]) || 1;
          return [r[0] / l, r[1] / l, r[2] / l];
        };
        if (nor) {
          nor.getElement(i, v);
          nor.setElement(i, rota(v[0], v[1], v[2]));
        }
        if (tan) {
          const t = [0, 0, 0, 0];
          tan.getElement(i, t);
          tan.setElement(i, [...rota(t[0], t[1], t[2]), t[3]]);
        }
      }

      prim.setAttribute('JOINTS_0', null);
      prim.setAttribute('WEIGHTS_0', null);
    }

    nodo.setSkin(null);
    // Ya está en coordenadas de mundo: fuera de la jerarquía y sin transform.
    nodo.getParentNode()?.removeChild(nodo);
    nodo.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    escena.addChild(nodo);
    mallas++;
  }

  for (const skin of root.listSkins()) skin.dispose();
  return mallas;
}

/** Transmission -> transparencia clásica, conservando el tinte del cristal. */
function quitarTransmission(doc) {
  let n = 0;
  for (const material of doc.getRoot().listMaterials()) {
    const ext = material.getExtension('KHR_materials_transmission');
    if (!ext) continue;
    const factor = ext.getTransmissionFactor();
    material.setExtension('KHR_materials_transmission', null);
    const [r, g, b, a] = material.getBaseColorFactor();
    // Cuanto más transmitía, más transparente queda; con un mínimo para que
    // el cristal siga leyéndose como cristal y no desaparezca.
    material.setBaseColorFactor([r, g, b, Math.min(a, Math.max(0.18, 1 - factor))]);
    material.setAlphaMode('BLEND');
    n++;
  }
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_transmission') ext.dispose();
  }
  return n;
}

/** Quita las tangentes: three.js las calcula en el shader para el normal map. */
function quitarTangentes(doc) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) prim.setAttribute('TANGENT', null);
}

(async () => {
  const temporal = path.join(os.tmpdir(), `motorbike-original-${ORIGEN}.glb`);
  if (!fs.existsSync(temporal)) {
    const bytes = execFileSync('git', ['show', `${ORIGEN}:${DESTINO}`], { maxBuffer: 200 * 1024 * 1024 });
    fs.writeFileSync(temporal, bytes);
  }

  const { io, doc } = await abrirGlb(temporal);
  const antes = fs.statSync(temporal).size;

  console.log(`esqueletos horneados: ${hornearSkinning(doc)} mallas`);
  console.log(`materiales sin transmission: ${quitarTransmission(doc)}`);
  quitarTangentes(doc);

  await MeshoptSimplifier.ready;
  await doc.transform(
    dedup(),
    flatten(),
    join(),
    weld(),
    // Error relativo al tamaño de la malla. 0.001 = una milésima de la moto:
    // invisible a la distancia a la que se ve, y quita los triángulos que
    // no aportan en las piezas densas (llantas, motor).
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.001 }),
    prune({ keepAttributes: false }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /^baseColor|^emissive/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], slots: /^(?!baseColor|emissive)/ }),
    draco({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );

  await io.write(DESTINO, doc);
  const despues = fs.statSync(DESTINO).size;
  const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
  console.log(`${path.basename(DESTINO)}: ${mb(antes)} (original) -> ${mb(despues)}`);
})();
