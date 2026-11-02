// Genera «Materia calma»: Blender corre scripts/blender/calm.py (todo modelado por código) y deja
// el fuente en design/blender/calm-<juego>.blend; gltf-transform cuantiza y comprime el .glb con
// meshopt hacia src/assets/models/calm-<juego>.glb. Las tarjetas son DOM: de su losa, la web usa solo
// el bisel horneado para CSS (src/assets/textures/card-bevel.webp); el .glb queda en design/blender
// para clientes nativos.
//
//   node scripts/build-calm.mjs [pad] [focus] [nav] [card] [--render carpeta] [--samples 32]
//
// BLENDER cambia la ruta de blender.exe (4.5).
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const blender = process.env.BLENDER ?? join(homedir(), 'Tools/Blender/blender-4.5.15-windows-x64/blender.exe');
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : null;
};
const render = option('--render');
const samples = option('--samples');
const sets = args.length ? args : ['pad', 'focus', 'nav', 'card'];
const tmp = mkdtempSync(join(tmpdir(), 'nl-calm-'));
const blends = join(web, 'design/blender');
mkdirSync(blends, { recursive: true });
mkdirSync(join(web, 'src/assets/textures'), { recursive: true });
// npx es un .cmd en Windows: va por la consola, con los argumentos entre comillas.
const npx = (list) => execSync(['npx', ...list].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '), { stdio: 'inherit' });

/** Pesos por defecto en 0: el exportador deja los del último fotograma que muestreó. */
function zeroWeights(file) {
  const glb = readFileSync(file);
  const length = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8'));
  for (const mesh of json.meshes) if (mesh.weights) mesh.weights = mesh.weights.map(() => 0);
  const text = Buffer.from(JSON.stringify(json), 'utf8');
  const padded = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  glb.copy(header, 0, 0, 12);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([header, padded, glb.subarray(20 + length)]);
  out.writeUInt32LE(out.length, 8);
  writeFileSync(file, out);
}

try {
  execFileSync(blender, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(web, 'scripts/blender/calm.py'), '--',
    '--sets', sets.join(','), '--dir', tmp, '--blend', blends, '--bevel', join(web, 'src/assets/textures/card-bevel.webp'),
    ...(render ? ['--render', render] : []), ...(samples ? ['--samples', samples] : [])], { stdio: 'inherit' });
  // Sin filtros meshopt («medium»): las normales de los morphs son diferencias, no vectores
  // unitarios, y el filtro octaédrico las normalizaría.
  for (const file of readdirSync(tmp).filter((n) => n.endsWith('.glb'))) {
    const out = join(file === 'calm-card.glb' ? blends : join(web, 'src/assets/models'), file);
    npx(['--yes', '@gltf-transform/cli@4', 'meshopt', join(tmp, file), out, '--level', 'medium',
      '--quantize-position', '13', '--quantize-normal', '8', '--quantize-texcoord', '10']);
    zeroWeights(out);
    console.log(`${out}: ${(statSync(out).size / 1024).toFixed(1)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
