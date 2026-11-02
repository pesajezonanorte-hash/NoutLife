// Genera Nout Sans: scripts/font/nout_sans.py traza las letras y compila la fuente variable para la web
// (src/assets/fonts/nout-sans.woff2) y los TTF para diseño (design/type/). No hay Python en las máquinas del
// equipo, así que usa el de Blender; fontTools, brotli y skia-pathops se instalan aparte la primera vez.
//
//   node scripts/build-font.mjs
//
// BLENDER_PYTHON cambia la ruta de python.exe.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.BLENDER_PYTHON ?? join(homedir(), 'Tools/Blender/blender-4.5.15-windows-x64/4.5/python/bin/python.exe');
const deps = join(homedir(), 'Tools/font-deps');

if (!existsSync(join(deps, 'fontTools'))) {
  execFileSync(python, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '--target', deps, 'fonttools', 'brotli', 'skia-pathops'], { stdio: 'inherit' });
}
execFileSync(python, [join(web, 'scripts/font/nout_sans.py'), '--web', join(web, 'src/assets/fonts'), '--design', join(web, 'design/type')], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: deps, PYTHONIOENCODING: 'utf-8' },
});
