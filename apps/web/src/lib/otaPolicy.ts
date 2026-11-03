// Las reglas de las actualizaciones de la web en la app de Android, sin Capacitor para poder probarlas (lib/ota).

/** Lo que dice de sí misma cada versión de la web: dist/ota/version.json (scripts/ota-manifest). */
export interface OtaVersion {
  /** Hash del contenido: dos compilaciones iguales son la misma versión. */
  version: string;
  builtAt: number;
  /** Huella de la parte nativa con la que se compiló. Otra huella necesita otro APK. */
  native: string;
}

export interface OtaManifest extends OtaVersion {
  files: { name: string; hash: string }[];
}

/** La última versión que no llegó a arrancar y volvió atrás: no se intenta otra vez. */
export const OTA_FAILED_KEY = 'lq-ota-failed';

export function parseOtaVersion(value: unknown): OtaVersion | null {
  const candidate = value as Partial<OtaVersion> | null;
  if (typeof candidate?.version !== 'string' || !candidate.version) return null;
  if (typeof candidate.builtAt !== 'number' || typeof candidate.native !== 'string') return null;
  return { version: candidate.version, builtAt: candidate.builtAt, native: candidate.native };
}

export function shouldInstall(remote: OtaVersion, local: OtaVersion, runningBuiltin: boolean, failedVersion: string | null): boolean {
  if (remote.version === local.version || remote.version === failedVersion) return false;
  // Esta web puede usar algo que el APK instalado no trae.
  if (remote.native !== local.native) return false;
  // Lo descargado sigue a producción aunque retroceda: volver a un despliegue anterior en Vercel también
  // retira una versión mala de los teléfonos. Lo que trae el APK solo cede ante algo más nuevo: un APK
  // recién compilado no se pisa con la web publicada antes que él.
  return !runningBuiltin || remote.builtAt > local.builtAt;
}

/** El formato que pide el plugin. Las direcciones salen de aquí y no del manifiesto. */
export function toDownloadList(manifest: OtaManifest, origin: string) {
  return manifest.files.map((file) => ({
    file_name: file.name,
    file_hash: file.hash,
    download_url: `${origin}/${file.name}`,
  }));
}
