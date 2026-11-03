// Al compilar, escribe lo que hace falta para actualizar la app de Android sin APK nuevo (src/lib/ota.ts):
// dist/ota/version.json viaja dentro de cada versión y dice cuál es; dist/ota/manifest.json lista sus archivos
// con su hash, para que el teléfono baje solo los que cambiaron. No hay zip: los archivos son los de la web.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { shellFiles } from './offline-shell';

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

const NATIVE_PACKAGE = /^@(?:capacitor|capgo)\//;

function javaFiles(root: string, dir: string): string[] {
  return readdirSync(join(root, dir)).sort().flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) return javaFiles(root, path);
    return name.endsWith('.java') ? [path] : [];
  });
}

/**
 * Huella de lo que no se puede cambiar sin APK nuevo: plugins, permisos, código Java y configuración de
 * Capacitor. Una web con otra huella no se instala en un APK viejo (podría llamar a algo que no existe).
 * Tiene que dar lo mismo en este PC y en Vercel, o las actualizaciones se detendrían sin avisar: de ahí los
 * rangos de package.json y no lo instalado, y los finales de línea normalizados (git usa CRLF en Windows).
 */
export function nativeFingerprint(root: string): string {
  const { dependencies } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  const packages = Object.entries(dependencies).filter(([name]) => NATIVE_PACKAGE.test(name)).sort(([a], [b]) => a.localeCompare(b));
  const hash = createHash('sha256').update(JSON.stringify(packages));
  const files = ['capacitor.config.ts', 'android/app/src/main/AndroidManifest.xml', ...javaFiles(root, 'android/app/src/main/java')];
  for (const file of files) hash.update(file).update(readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n'));
  return hash.digest('hex').slice(0, 12);
}

export function writeOtaManifest(dist: string, native: string, builtAt: number) {
  const files = shellFiles(dist).map((name) => ({ name, hash: sha256(readFileSync(join(dist, name))) }));
  const version = sha256(files.map((file) => `${file.name} ${file.hash}`).join('\n')).slice(0, 12);

  const self = JSON.stringify({ version, builtAt, native });
  mkdirSync(join(dist, 'ota'), { recursive: true });
  writeFileSync(join(dist, 'ota', 'version.json'), self);
  writeFileSync(join(dist, 'ota', 'manifest.json'), JSON.stringify({
    version,
    builtAt,
    native,
    files: [...files, { name: 'ota/version.json', hash: sha256(self) }],
  }));
}

export function otaManifest(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'noutlife-ota-manifest',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    closeBundle() {
      writeOtaManifest(join(config.root, config.build.outDir), nativeFingerprint(config.root), Date.now());
    },
  };
}
