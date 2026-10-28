// Ejecuta blender/studio.py (el teléfono 3D del anuncio «Pro Studio») con Blender sin
// interfaz. Busca Blender en la variable BLENDER_PATH, en las versiones portables de
// ~/Tools/Blender/<versión>/, en Archivos de programa y, por último, en el PATH.
//
// Uso: node scripts/blender.mjs <track | render | still 100,190 carpeta> [--samples N] [--scale 50] [--force]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.platform === 'win32' ? 'blender.exe' : 'blender';

function findBlender() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  const versions = (dir) => (existsSync(dir) ? readdirSync(dir).sort().reverse().map((d) => join(dir, d, exe)) : []);
  const found = [...versions(join(homedir(), 'Tools', 'Blender')), ...versions('C:/Program Files/Blender Foundation')].find(existsSync);
  return found ?? 'blender';
}

const blender = findBlender();
const args = ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(ROOT, 'blender', 'studio.py'), '--', ...process.argv.slice(2)];
console.log(`${blender} ${args.join(' ')}`);
const run = spawnSync(blender, args, { cwd: ROOT, stdio: 'inherit' });
if (run.error) {
  console.error(`No se pudo ejecutar Blender (${run.error.message}). Instala Blender 4.5 LTS o indica su ruta en BLENDER_PATH.`);
  process.exit(1);
}
process.exit(run.status ?? 1);
