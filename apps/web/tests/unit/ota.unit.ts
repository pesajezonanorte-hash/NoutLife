import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOtaVersion, shouldInstall, toDownloadList, type OtaManifest, type OtaVersion } from '../../src/lib/otaPolicy';
import { nativeFingerprint, writeOtaManifest } from '../../scripts/ota-manifest';
import { shellFiles } from '../../scripts/offline-shell';

const local: OtaVersion = { version: 'aaa', builtAt: 1000, native: 'n1' };
const remote = (over: Partial<OtaVersion> = {}): OtaVersion => ({ version: 'bbb', builtAt: 2000, native: 'n1', ...over });

test('OTA: se instala una versión distinta con la misma parte nativa', () => {
  assert.equal(shouldInstall(remote(), local, true, null), true);
  assert.equal(shouldInstall(remote(), local, false, null), true);
});

test('OTA: la misma versión no se vuelve a bajar', () => {
  assert.equal(shouldInstall(remote({ version: 'aaa' }), local, false, null), false);
});

test('OTA: una web para otro APK no entra, aunque sea más nueva', () => {
  assert.equal(shouldInstall(remote({ native: 'n2' }), local, false, null), false);
  assert.equal(shouldInstall(remote({ native: 'n2' }), local, true, null), false);
});

test('OTA: la versión que falló no se intenta otra vez, pero la siguiente sí', () => {
  assert.equal(shouldInstall(remote(), local, false, 'bbb'), false);
  assert.equal(shouldInstall(remote({ version: 'ccc' }), local, false, 'bbb'), true);
});

test('OTA: lo descargado sigue a producción aunque retroceda', () => {
  assert.equal(shouldInstall(remote({ builtAt: 500 }), local, false, null), true);
});

test('OTA: un APK más nuevo que la web publicada no se pisa', () => {
  assert.equal(shouldInstall(remote({ builtAt: 500 }), local, true, null), false);
});

test('OTA: lo que no es una versión no se toma por una (Vercel responde index.html a lo que no existe)', () => {
  assert.equal(parseOtaVersion('<!doctype html><html></html>'), null);
  assert.equal(parseOtaVersion(null), null);
  assert.equal(parseOtaVersion({ version: 'x' }), null);
  assert.deepEqual(parseOtaVersion({ ...local, extra: 1 }), local);
});

test('OTA: las direcciones de descarga salen del origen fijo, no del manifiesto', () => {
  const manifest: OtaManifest = { ...local, files: [{ name: 'assets/a.js', hash: 'h' }] };
  assert.deepEqual(toDownloadList(manifest, 'https://www.noutlife.site'), [
    { file_name: 'assets/a.js', file_hash: 'h', download_url: 'https://www.noutlife.site/assets/a.js' },
  ]);
});

function fakeDist() {
  const dist = mkdtempSync(join(tmpdir(), 'ota-dist-'));
  mkdirSync(join(dist, 'assets'));
  mkdirSync(join(dist, 'en'));
  writeFileSync(join(dist, 'index.html'), '<html>');
  writeFileSync(join(dist, 'assets', 'a.js'), 'a');
  writeFileSync(join(dist, 'sw.js'), 'sw');
  writeFileSync(join(dist, 'en', 'index.html'), 'seo');
  return dist;
}
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

test('manifiesto OTA: lista la app con su hash, también version.json, y no lo que solo sirve a la web', () => {
  const dist = fakeDist();
  writeOtaManifest(dist, 'n1', 1000);
  const manifest = readJson(join(dist, 'ota', 'manifest.json')) as OtaManifest;
  assert.deepEqual(manifest.files.map((file) => file.name), ['assets/a.js', 'index.html', 'ota/version.json']);

  const self = readFileSync(join(dist, 'ota', 'version.json'));
  assert.equal(manifest.files[2].hash, createHash('sha256').update(self).digest('hex'));
  assert.equal(manifest.files[0].hash, createHash('sha256').update('a').digest('hex'));
  assert.deepEqual(JSON.parse(self.toString()), { version: manifest.version, builtAt: 1000, native: 'n1' });
  rmSync(dist, { recursive: true });
});

test('manifiesto OTA: compilar lo mismo otra vez es la misma versión; cambiar un archivo, otra', () => {
  const dist = fakeDist();
  const version = () => (readJson(join(dist, 'ota', 'version.json')) as OtaVersion).version;
  writeOtaManifest(dist, 'n1', 1000);
  const first = version();
  writeOtaManifest(dist, 'n1', 9000);
  assert.equal(version(), first, 'ni la hora ni el propio ota/ cuentan');
  writeFileSync(join(dist, 'assets', 'a.js'), 'b');
  writeOtaManifest(dist, 'n1', 9000);
  assert.notEqual(version(), first);
  rmSync(dist, { recursive: true });
});

test('el service worker no guarda ota/: no forma parte de lo que abre la web', () => {
  const dist = fakeDist();
  writeOtaManifest(dist, 'n1', 1000);
  assert.deepEqual(shellFiles(dist), ['assets/a.js', 'index.html']);
  rmSync(dist, { recursive: true });
});

function fakeProject(eol: string) {
  const root = mkdtempSync(join(tmpdir(), 'ota-native-'));
  const java = join(root, 'android/app/src/main/java/com/noutlife/app');
  mkdirSync(java, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { '@capacitor/app': '^8.0.0', react: '^18.0.0' } }));
  writeFileSync(join(root, 'capacitor.config.ts'), `export default {};${eol}`);
  writeFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), `<manifest>${eol}</manifest>`);
  writeFileSync(join(java, 'MainActivity.java'), `class MainActivity {}${eol}`);
  return root;
}

test('huella nativa: da lo mismo con CRLF (este PC) y LF (Vercel)', () => {
  const windows = fakeProject('\r\n');
  const linux = fakeProject('\n');
  assert.equal(nativeFingerprint(windows), nativeFingerprint(linux));
  rmSync(windows, { recursive: true });
  rmSync(linux, { recursive: true });
});

test('huella nativa: cambia con un plugin, un permiso o código Java; no con otras dependencias', () => {
  const root = fakeProject('\n');
  const base = nativeFingerprint(root);
  const change = (file: string, text: string) => {
    const before = readFileSync(join(root, file), 'utf8');
    writeFileSync(join(root, file), text);
    const fingerprint = nativeFingerprint(root);
    writeFileSync(join(root, file), before);
    return fingerprint;
  };
  assert.notEqual(change('package.json', JSON.stringify({ dependencies: { '@capacitor/app': '^8.0.0', '@capacitor/camera': '^8.0.0', react: '^18.0.0' } })), base);
  assert.notEqual(change('android/app/src/main/AndroidManifest.xml', '<manifest><uses-permission/></manifest>'), base);
  assert.notEqual(change('android/app/src/main/java/com/noutlife/app/MainActivity.java', 'class Other {}'), base);
  assert.equal(change('package.json', JSON.stringify({ dependencies: { '@capacitor/app': '^8.0.0', react: '^19.0.0' } })), base);
  rmSync(root, { recursive: true });
});
