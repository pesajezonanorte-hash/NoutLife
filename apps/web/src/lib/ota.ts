// Actualiza la web de la app de Android sin APK nuevo, desde lo último publicado en producción. El plugin
// (@capgo/capacitor-updater, en modo manual: capacitor.config.ts) baja solo los archivos que cambiaron,
// comprueba su hash y vuelve atrás si una versión no llega a avisar de que arrancó (notifyAppReady).
// Aquí se decide qué bajar y cuándo aplicarlo: nunca con la app en uso, porque recargar borraría lo que se
// esté escribiendo. Se aplica al abrirla (OtaPendingPlugin.java, antes de crear el WebView) o al volver tras
// un buen rato.
import { App } from '@capacitor/app';
import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { OTA_FAILED_KEY, parseOtaVersion, shouldInstall, toDownloadList, type OtaManifest } from './otaPolicy';

/** La versión descargada que espera a la próxima apertura. */
const OtaPending = registerPlugin<{
  get(): Promise<{ id?: string }>;
  set(options: { id: string | null }): Promise<void>;
}>('OtaPending');

// www: noutlife.site redirige allí, y además dentro de la app es el propio teléfono (capacitor.config.ts).
const ORIGIN: string = import.meta.env.VITE_OTA_ORIGIN || 'https://www.noutlife.site';
/** Para no competir con el arranque. */
const FIRST_CHECK_DELAY_MS = 5000;
/** Con la app viva durante días, cada cuánto se mira de nuevo al volver a ella. */
const CHECK_EVERY_MS = 60 * 60 * 1000;
/** Volver tras esta ausencia ya es casi abrirla otra vez. */
const APPLY_AFTER_AWAY_MS = 30 * 60 * 1000;

let lastCheck = 0;
let checking = false;

/** Por red nativa: con fetch, un redireccionamiento hacia noutlife.site lo respondería el propio teléfono. */
async function getRemote(path: string): Promise<unknown> {
  const response = await CapacitorHttp.get({ url: `${ORIGIN}${path}`, responseType: 'json', connectTimeout: 10000, readTimeout: 15000 });
  if (response.status !== 200) throw new Error(`OTA ${path}: ${response.status}`);
  return response.data;
}

async function check() {
  if (checking || !navigator.onLine) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const remote = parseOtaVersion(await getRemote('/ota/version.json'));
    // Lo que corre ahora mismo: el fetch a su propia dirección lo responde el teléfono.
    const local = parseOtaVersion(await (await fetch('/ota/version.json')).json());
    if (!remote || !local) return;

    const { bundle: running } = await CapacitorUpdater.current();
    const wanted = shouldInstall(remote, local, running.id === 'builtin', localStorage.getItem(OTA_FAILED_KEY)) ? remote.version : null;

    // Lo descargado que producción ya no ofrece no debe entrar en la próxima apertura.
    const { bundles } = await CapacitorUpdater.list();
    const { id: pending } = await OtaPending.get();
    for (const bundle of bundles) {
      if (bundle.status !== 'pending' || bundle.version === wanted || bundle.id === running.id) continue;
      if (bundle.id === pending) await OtaPending.set({ id: null });
      await CapacitorUpdater.delete({ id: bundle.id });
    }
    if (!wanted) return;

    const ready = bundles.find((bundle) => bundle.version === wanted && bundle.status === 'pending');
    if (ready) {
      await OtaPending.set({ id: ready.id });
      return;
    }
    const manifest = await getRemote('/ota/manifest.json') as OtaManifest;
    const downloaded = await CapacitorUpdater.download({
      url: `${ORIGIN}/ota/manifest.json`,
      version: manifest.version,
      manifest: toDownloadList(manifest, ORIGIN),
    });
    await OtaPending.set({ id: downloaded.id });
  } catch {
    // Sin red o a medio publicar: la app sigue con lo que tiene y lo intenta en la próxima apertura.
  } finally {
    checking = false;
  }
}

async function applyPending(): Promise<boolean> {
  const { id } = await OtaPending.get();
  if (!id) return false;
  // Se borra antes de intentarlo: una versión que falle no puede entrar en bucle.
  await OtaPending.set({ id: null });
  void CapacitorUpdater.set({ id }).catch(() => undefined);
  return true;
}

async function onReturn(awayMs: number) {
  if (awayMs >= APPLY_AFTER_AWAY_MS && await applyPending()) return;
  if (Date.now() - lastCheck >= CHECK_EVERY_MS) await check();
}

let started = false;

/** Se llama con la app ya pintada: es lo que le dice al plugin que esta versión arrancó bien. */
export async function startOta() {
  if (started) return;
  started = true;
  await CapacitorUpdater.notifyAppReady();

  const failed = await CapacitorUpdater.getFailedUpdate();
  if (failed) localStorage.setItem(OTA_FAILED_KEY, failed.bundle.version);

  lastCheck = Date.now();
  window.setTimeout(() => void check(), FIRST_CHECK_DELAY_MS);

  let hiddenAt = 0;
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      hiddenAt = Date.now();
      return;
    }
    void onReturn(hiddenAt ? Date.now() - hiddenAt : 0).catch(() => undefined);
  });
}
