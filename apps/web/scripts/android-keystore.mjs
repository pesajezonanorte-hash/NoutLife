// Crea la clave de subida de Google Play, una sola vez y fuera del repositorio.
// Uso: npm run android:keystore --workspace=apps/web
// La contraseña la genera este script y queda en el archivo de propiedades que lee android/app/build.gradle.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const dir = process.env.NOUTLIFE_KEYSTORE_DIR ?? join(homedir(), '.noutlife');
const store = join(dir, 'android-upload.jks');
const properties = join(dir, 'android-upload.properties');
const alias = 'noutlife-upload';

if (existsSync(store) || existsSync(properties)) {
  console.error(`Ya existe una clave en ${dir}. No se sobrescribe: sustituirla obligaría a tramitar el cambio con Google.`);
  process.exit(1);
}

const jdk = process.env.NOUTLIFE_JDK ?? join(homedir(), 'Tools', 'jdk-21');
const keytool = existsSync(jdk) ? join(jdk, 'bin', 'keytool') : 'keytool';
const password = randomBytes(24).toString('hex');
// La contraseña va por el entorno: en la línea de órdenes la vería cualquier proceso.
const env = { ...process.env, NOUTLIFE_STORE_PASS: password };

mkdirSync(dir, { recursive: true });
execFileSync(keytool, [
  '-genkeypair', '-keystore', store, '-storetype', 'PKCS12', '-alias', alias,
  '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
  '-dname', 'CN=NoutLife, O=NoutLife, C=CO',
  '-storepass:env', 'NOUTLIFE_STORE_PASS',
], { env, stdio: 'inherit' });

// En PKCS12 la clave usa la contraseña del almacén. En un .properties la barra invertida es un escape.
writeFileSync(properties, [
  `storeFile=${store.replace(/\\/g, '/')}`,
  `storePassword=${password}`,
  `keyAlias=${alias}`,
  `keyPassword=${password}`,
  '',
].join('\n'), { mode: 0o600 });

const fingerprints = execFileSync(keytool, ['-list', '-v', '-keystore', store, '-alias', alias, '-storepass:env', 'NOUTLIFE_STORE_PASS'], { env, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((line) => /^\s*SHA(1|256):/.test(line))
  .map((line) => line.trim());

console.log(`\nClave: ${store}\nContraseña: ${properties}\n${fingerprints.join('\n')}`);
console.log('\nGuarda ambos archivos en un gestor de contraseñas. Sin ellos no se puede firmar con esta clave.');
