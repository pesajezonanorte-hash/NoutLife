// Al compilar, escribe en dist/sw.js qué archivos forman la app y su versión (el hash de esa lista). El
// service worker los guarda al instalarse: la app abre sin conexión aunque nunca se hayan visitado sus
// zonas. Como sw.js cambia con cada versión de la app, el navegador lo actualiza él solo.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** Nada de esto hace falta para abrir la app: páginas para buscadores e imágenes para redes. */
const SKIP = /^(?:sw\.js|en\/|es\/|og-image|google[0-9a-f]+\.html|robots\.txt|sitemap\.xml)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

export function offlineShell(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'noutlife-offline-shell',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    closeBundle() {
      const dist = join(config.root, config.build.outDir);
      const files = walk(dist)
        .map((path) => relative(dist, path).split(sep).join('/'))
        .filter((path) => !SKIP.test(path))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(dist, file)));
      const version = hash.digest('hex').slice(0, 12);

      const sw = join(dist, 'sw.js');
      const source = readFileSync(sw, 'utf8');
      if (!source.includes('__SHELL_VERSION__') || !source.includes('__SHELL_FILES__')) throw new Error('[offline-shell] sw.js no tiene las marcas de la versión y la lista');
      writeFileSync(sw, source
        .replace('__SHELL_VERSION__', version)
        .replace('"__SHELL_FILES__"', JSON.stringify(files.map((file) => `/${file}`))));
    },
  };
}
