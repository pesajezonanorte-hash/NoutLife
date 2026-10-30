// Genera los objetos 3D de las zonas, src/assets/models/props-<set>[-hd].glb: Blender corre
// scripts/blender/props.py (todo modelado por código, sin archivos de entrada) y
// gltf-transform cuantiza posiciones y normales y comprime la geometría con meshopt.
//
//   node scripts/build-props.mjs [habits] [goals] [hobbies] [gym] [finance] [trophies] [--render qa.png]
//
// BLENDER cambia la ruta de blender.exe (4.5).
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const blender = process.env.BLENDER ?? join(homedir(), 'Tools/Blender/blender-4.5.15-windows-x64/blender.exe');
const args = process.argv.slice(2);
const renderAt = args.indexOf('--render');
const render = renderAt >= 0 ? args.splice(renderAt, 2)[1] : null;
const sets = args.length ? args : ['habits', 'goals', 'hobbies', 'gym', 'finance', 'trophies'];
const tmp = mkdtempSync(join(tmpdir(), 'nl-props-'));
// npx es un .cmd en Windows: va por la consola, con los argumentos entre comillas.
const npx = (list) => execSync(['npx', ...list].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '), { stdio: 'inherit' });

try {
  execFileSync(blender, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(web, 'scripts/blender/props.py'), '--',
    '--sets', sets.join(','), '--dir', tmp, ...(render ? ['--render', render] : [])], { stdio: 'inherit' });
  // Con filtros meshopt (normales octaédricas): el lector de la web los decodifica. _PART en
  // 8 bits: k/255 vuelve exacto.
  for (const file of readdirSync(tmp).filter((n) => n.endsWith('.glb'))) {
    const out = join(web, 'src/assets/models', file);
    npx(['--yes', '@gltf-transform/cli@4', 'meshopt', join(tmp, file), out, '--level', 'high',
      '--quantize-position', '14', '--quantize-normal', '10', '--quantize-generic', '8']);
    console.log(`${out}: ${(statSync(out).size / 1024).toFixed(1)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
