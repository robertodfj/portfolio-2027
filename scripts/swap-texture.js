/**
 * Sustituye la textura baseColor de un GLB conservando el rig, las animaciones
 * y la compresión Draco de la geometría.
 *
 *   node scripts/swap-texture.js <modelo.glb> <textura.(jpg|png|webp)> [salida.glb]
 *
 * Sin el tercer argumento sobrescribe el modelo de entrada, dejando antes una
 * copia .bak.glb junto a él.
 */
const fs = require('fs');
const path = require('path');
const { abrirGlb } = require('./lib/mesh-uv');

/**
 * Formato REAL del fichero, por sus bytes de cabecera. No se mira la extensión
 * a propósito: un JPEG guardado como .png es de lo más común, y escribir un
 * mime que no corresponde deja la textura ilegible para el visor.
 */
function sniffMime(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer.slice(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buffer.slice(0, 4).toString('latin1') === 'RIFF' && buffer.slice(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Dimensiones desde la cabecera, sin decodificar la imagen entera. */
function tamano(buffer, mime) {
  if (mime === 'image/png') return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
  if (mime !== 'image/jpeg') return null;
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) { i++; continue; }
    const m = buffer[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buffer.readUInt16BE(i + 5), w: buffer.readUInt16BE(i + 7) };
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return null;
}

(async () => {
  const [modelPath, texturePath, outPathArg] = process.argv.slice(2);
  if (!modelPath || !texturePath) {
    console.error('Uso: node scripts/swap-texture.js <modelo.glb> <textura> [salida.glb]');
    process.exit(1);
  }

  const { io, doc } = await abrirGlb(modelPath);
  const textures = doc.getRoot().listTextures();
  if (!textures.length) throw new Error('El modelo no tiene ninguna textura.');

  const baseColor =
    doc.getRoot().listMaterials().map((m) => m.getBaseColorTexture()).find(Boolean) ?? textures[0];

  const nueva = fs.readFileSync(texturePath);
  const mime = sniffMime(nueva);
  if (!mime) throw new Error('La textura no es JPEG, PNG ni WebP.');

  const ext = path.extname(texturePath).toLowerCase();
  const validas = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] }[mime];
  if (!validas.includes(ext)) {
    console.warn(`aviso: ${path.basename(texturePath)} tiene extensión ${ext} pero es ${mime}. Se usa el formato real.`);
  }

  const antes = baseColor.getImage();
  const ta = antes ? tamano(Buffer.from(antes), baseColor.getMimeType()) : null;
  const tn = tamano(nueva, mime);
  if (ta && tn && (ta.w !== tn.w || ta.h !== tn.h)) {
    // No es un error: las UV son relativas. Se avisa porque casi siempre indica
    // que la textura no corresponde al mismo modelo.
    console.warn(`aviso: la nueva es ${tn.w}x${tn.h} y la original ${ta.w}x${ta.h}.`);
  }

  baseColor.setImage(nueva).setMimeType(mime);

  const outPath = outPathArg ?? modelPath;
  if (!outPathArg) {
    const backup = modelPath.replace(/\.glb$/i, '.bak.glb');
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(modelPath, backup);
      console.log(`copia de seguridad: ${path.basename(backup)}`);
    }
  }

  await io.write(outPath, doc);

  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(
    `${path.basename(modelPath)} -> ${path.basename(outPath)} ` +
      `(textura ${kb(antes?.byteLength ?? 0)} -> ${kb(nueva.byteLength)}, modelo ${kb(fs.statSync(outPath).size)})`,
  );
})();
