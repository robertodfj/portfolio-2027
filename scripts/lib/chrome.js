/**
 * Localiza un Chromium con el que puppeteer-core pueda trabajar.
 *
 * puppeteer-core no descarga navegador, así que hay que darle una ruta. Estaba
 * fijada a la de Chrome en Windows, de modo que en macOS y Linux todos los
 * scripts morían con "Browser was not found".
 *
 * Orden: la variable CHROME_PATH manda (para CI o instalaciones raras) y, si no
 * está, se prueban las rutas habituales de la plataforma.
 */
const fs = require('fs');

const RUTAS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/brave-browser',
  ],
};

/** Devuelve la ruta del navegador o corta la ejecución explicando qué hacer. */
function resolverChrome() {
  const candidatas = [process.env.CHROME_PATH, ...(RUTAS[process.platform] || [])].filter(Boolean);
  const encontrada = candidatas.find((p) => fs.existsSync(p));
  if (encontrada) return encontrada;

  console.error(
    `\nNo se ha encontrado ningún Chromium en ${process.platform}. Se han probado:\n` +
      candidatas.map((p) => `  - ${p}`).join('\n') +
      '\n\nInstala Chrome o indica la ruta a mano:\n  CHROME_PATH="/ruta/al/navegador" npm run <script>\n',
  );
  process.exit(1);
}

module.exports = { resolverChrome };
