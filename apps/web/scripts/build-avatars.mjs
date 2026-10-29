// Genera las figuras del Coliseo, src/assets/models/body-{male,female}.glb: Blender corre
// scripts/blender/avatar.py sobre las mallas humanas de Blender Studio y gltf-transform
// cuantiza los atributos y comprime la geometría con meshopt (la textura queda en WebP).
//
//   node scripts/build-avatars.mjs [male] [female]
//
// BLENDER (blender.exe, 4.5) y HBM_BUNDLE (human_base_meshes_bundle.blend, «Human Base
// Meshes» v1.4.1, CC0: https://www.blender.org/download/demo/ → Asset Bundles) cambian las rutas.
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const blender = process.env.BLENDER ?? join(homedir(), 'Tools/Blender/blender-4.5.15-windows-x64/blender.exe');
const bundle = process.env.HBM_BUNDLE ?? join(homedir(), 'Tools/Blender/assets/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend');
const genders = process.argv.length > 2 ? process.argv.slice(2) : ['male', 'female'];
const tmp = mkdtempSync(join(tmpdir(), 'nl-avatars-'));
// npx es un .cmd en Windows: va por la consola, con los argumentos entre comillas.
const npx = (args) => execSync(['npx', ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '), { stdio: 'inherit' });

try {
  for (const gender of genders) {
    const raw = join(tmp, `${gender}.glb`);
    const out = join(web, `src/assets/models/body-${gender}.glb`);
    // El .blend es descargado: sin ejecutar sus scripts.
    execFileSync(blender, ['-b', '--factory-startup', '--disable-autoexec', bundle, '--python-exit-code', '1',
      '-P', join(web, 'scripts/blender/avatar.py'), '--', '--gender', gender, '--out', raw], { stdio: 'inherit' });
    // Atributos propios en 8 bits (ids exactos k/255); un búfer por atributo, sin filtros meshopt.
    npx(['--yes', '@gltf-transform/cli@4', 'meshopt', raw, out, '--level', 'medium', '--vertex-layout', 'separate',
      '--quantize-position', '14', '--quantize-normal', '10', '--quantize-texcoord', '12', '--quantize-color', '8', '--quantize-generic', '8']);
    console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
