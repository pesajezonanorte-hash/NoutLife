// La app de Android, de un paso: web → Capacitor → Gradle.
// APK de prueba:       npm run android:apk --workspace=apps/web
// AAB firmado (Play):  npm run android:aab --workspace=apps/web (la clave sale de npm run android:keystore)
// JAVA_HOME y ANDROID_HOME se fijan solo para este proceso: el JDK del sistema puede ser otro (Capacitor 8 pide el 21).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('..', import.meta.url));
const android = join(web, 'android');
const jdk = process.env.NOUTLIFE_JDK ?? join(homedir(), 'Tools', 'jdk-21');
const env = {
  ...process.env,
  ...(existsSync(jdk) ? { JAVA_HOME: jdk } : {}),
  ANDROID_HOME: process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'Android'), 'Android', 'Sdk'),
};
const run = (command, cwd = web) => execSync(command, { cwd, env, stdio: 'inherit' });

const release = process.argv.includes('--release');
// El mismo archivo que lee android/app/build.gradle. Sin clave, Gradle daría un AAB sin firmar que Play rechaza.
const signing = process.env.NOUTLIFE_KEYSTORE_PROPERTIES ?? join(homedir(), '.noutlife', 'android-upload.properties');
if (release && !existsSync(signing)) {
  console.error(`Falta la clave de firma (${signing}). Créala con: npm run android:keystore --workspace=apps/web`);
  process.exit(1);
}

run('npm run build');
run('npx cap sync android');
run(`"${join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')}" ${release ? 'bundleRelease' : 'assembleDebug'}`, android);

const outputs = join(android, 'app', 'build', 'outputs');
console.log(release ? `\nAAB: ${join(outputs, 'bundle', 'release', 'app-release.aab')}` : `\nAPK: ${join(outputs, 'apk', 'debug', 'app-debug.apk')}`);
