/**
 * Comprime los modelos 3D: geometría con Draco y texturas a WebP de 1024.
 *
 *   node scripts/optimize-models.js [--force]
 *
 * IMPORTANTE: se niega a comprimir un modelo que YA está comprimido. Draco y
 * WebP son con pérdida, así que una segunda pasada decodifica y vuelve a
 * codificar: se pierde calidad a cambio de unos pocos KB, y sin avisar. Antes
 * esto era un comando suelto en package.json que escribía sobre el mismo
 * fichero, y bastaba con ejecutarlo dos veces para degradar el modelo.
 *
 * Si de verdad hay que rehacerlo, primero se recupera el original
 * (`git checkout -- src/assets/models/`) y se ejecuta una sola vez.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { abrirGlb } = require('./lib/mesh-uv');

/** Solo la moto: roberto.glb ya viene comprimido del exportador. */
const MODELOS = [
  {
    ruta: 'src/assets/models/motorbike.glb',
    opciones: ['--texture-size', '1024', '--texture-compress', 'webp', '--compress', 'draco'],
  },
];

(async () => {
  const forzar = process.argv.includes('--force');
  let hechos = 0;

  for (const { ruta, opciones } of MODELOS) {
    if (!fs.existsSync(ruta)) {
      console.warn(`falta ${ruta}, se salta`);
      continue;
    }

    const { doc } = await abrirGlb(ruta);
    const extensiones = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
    const yaDraco = extensiones.includes('KHR_draco_mesh_compression');
    const yaWebp = extensiones.includes('EXT_texture_webp');

    if ((yaDraco || yaWebp) && !forzar) {
      console.log(
        `${path.basename(ruta)}: ya está comprimido ` +
          `(${[yaDraco && 'Draco', yaWebp && 'WebP'].filter(Boolean).join(' + ')}). Se salta.`,
      );
      console.log('  Volver a comprimirlo degradaría la calidad. Usa --force solo sobre el original.');
      continue;
    }

    const antes = fs.statSync(ruta).size;
    const temporal = ruta.replace(/\.glb$/i, '.opt.glb');

    execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['gltf-transform', 'optimize', ruta, temporal, ...opciones],
      { stdio: 'inherit' },
    );

    fs.renameSync(temporal, ruta);
    const despues = fs.statSync(ruta).size;
    const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
    console.log(`${path.basename(ruta)}: ${mb(antes)} -> ${mb(despues)}`);
    hechos++;
  }

  if (!hechos) console.log('\nNada que hacer: los modelos ya están optimizados.');
})();
