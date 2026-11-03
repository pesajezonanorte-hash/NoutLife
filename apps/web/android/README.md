# App de Android

La web de `apps/web` dentro de Capacitor. Requiere el JDK 21 (`~/Tools/jdk-21`) y el Android SDK.

| Para | Comando (desde la raíz del repo) | Sale en |
|---|---|---|
| APK de prueba | `npm run android:apk --workspace=apps/web` | `app/build/outputs/apk/debug/app-debug.apk` |
| AAB firmado para Play | `npm run android:aab --workspace=apps/web` | `app/build/outputs/bundle/release/app-release.aab` |
| Clave de subida (una sola vez) | `npm run android:keystore --workspace=apps/web` | `~/.noutlife/` |

## Actualizaciones sin APK nuevo (OTA)

Cada despliegue de la web en producción es una actualización. No hay que subir nada más.

1. Al abrir la app, [`src/lib/ota.ts`](../src/lib/ota.ts) compara `https://www.noutlife.site/ota/version.json` con su propia versión.
2. Si hay una nueva, baja en segundo plano solo los archivos que cambiaron y comprueba su hash. Cambiar un texto cuesta cerca de 1 MB, porque los nombres con hash renombran en cascada unos 140 archivos.
3. Entra en la siguiente apertura, o al volver a la app tras 30 minutos fuera. Nunca con la app en uso.
4. Si esa versión no llega a arrancar en 30 segundos, el plugin vuelve a la anterior y no la reintenta.

**Retirar una versión mala:** volver al despliegue anterior en Vercel. Los teléfonos que ya la bajaron siguen a producción también hacia atrás.

**Cuándo sí hace falta un APK nuevo:** al cambiar un plugin de Capacitor en `package.json`, `AndroidManifest.xml`, el código Java o `capacitor.config.ts`. Esos archivos forman una huella (`native` en `version.json`). Una web con otra huella no se instala en un APK viejo: esos teléfonos se quedan en su última versión compatible hasta recibir el APK nuevo.

**Comprobar la huella:** `native` debe coincidir en estos dos sitios. Si no coinciden, ese APK no recibirá actualizaciones.

```sh
curl https://www.noutlife.site/ota/version.json
cat apps/web/dist/ota/version.json
```

Todo `versionCode` es nuevo porque Gradle lo calcula al compilar. Al instalar un APK con otro `versionCode`, el plugin borra lo descargado y arranca con lo que trae el APK.

## Publicar en Google Play

1. `npm run android:keystore --workspace=apps/web` crea la clave y muestra sus huellas SHA-1 y SHA-256. Guarda los dos archivos de `~/.noutlife/` en un gestor de contraseñas.
2. `npm run android:aab --workspace=apps/web` genera el AAB. Se sube a Play Console con **Play App Signing** activado.
3. Inicio de sesión con Google: en el proyecto **Sidepesaje** de Google Cloud, crea un cliente OAuth de Android para `com.noutlife.app` con el SHA-1 de **Play App Signing** (Play Console → Integridad de la app) y otro con el SHA-1 de la clave de subida si vas a probar el AAB fuera de Play. Sin esto, el botón de Google falla en esa firma.

Un teléfono con el APK de prueba no se actualiza a la versión de Play, porque la firma es otra: hay que desinstalar. Lo que no se haya sincronizado en ese teléfono se pierde.

Antes de publicar, decide `android:allowBackup` en `AndroidManifest.xml`. Hoy está activo: la copia de seguridad de Android incluye lo que la app guarda en el teléfono, también la sesión. Cambiarlo altera la huella nativa, así que hazlo en una versión con APK nuevo.

Reglas de Play que afectan a esto (compruébalas en Play Console, cambian):

- Una cuenta personal creada después del 13 de noviembre de 2023 necesita una prueba cerrada con al menos 12 personas durante 14 días seguidos antes de publicar en producción.
- Actualizar JavaScript en un WebView está permitido, pero una OTA no puede añadir funciones que eludan la revisión de Play ni cambiar el propósito de la app. Lo grande va por Play.
