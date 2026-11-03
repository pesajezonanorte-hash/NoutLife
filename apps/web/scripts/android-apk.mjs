// APK de prueba de la app de Android, de un paso: web → Capacitor → Gradle.
// Uso: npm run android:apk --workspace=apps/web
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

run('npm run build');
run('npx cap sync android');
run(`"${join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')}" assembleDebug`, android);

console.log(`\nAPK: ${join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}`);
